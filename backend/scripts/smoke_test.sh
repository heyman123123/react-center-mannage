#!/usr/bin/env bash
#
# NovasPay 管理端 —— 冒烟测试脚本
#
# 读取 docs/qa/NovasPay-测试用例文档.md 中标记为 Y / Y* 的用例，调用后端 API 执行，
# 并在 backend/scripts/reports/ 生成 Markdown 冒烟报告（报告每一行引用用例 ID）。
#
# 用法：
#   ./smoke_test.sh                         # CORE 层，无需外部凭据
#   ./smoke_test.sh smoke_test.env          # 加载配置；若填了 Creem/Resend 则追加 EXTENDED 层
#
# 依赖：bash 4+, curl, jq, python3
#
# 退出码：0 = 无 FAIL；1 = 存在 FAIL；2 = 环境/依赖问题

set -uo pipefail
set +B   # 关闭 brace expansion，避免用例标题/JSON 片段中的 {a,b} 被拆词

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CATALOG="${REPO_ROOT}/docs/qa/NovasPay-测试用例文档.md"
REPORT_DIR="${SCRIPT_DIR}/reports"
REPORT_PY="${SCRIPT_DIR}/lib/smoke_report.py"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,16p' "${BASH_SOURCE[0]}"
  exit 0
fi

if [[ -n "${1:-}" && -f "${1:-}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$1"
  set +a
  echo "已加载配置文件: $1"
fi

ROOT_URL="${ROOT_URL:-http://localhost:8080}"
API_BASE="${ROOT_URL%/}/api/v1"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novaspay.global}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123456}"
CREEM_API_SECRET="${CREEM_API_SECRET:-}"
CREEM_WEBHOOK_SECRET="${CREEM_WEBHOOK_SECRET:-}"
CREEM_PRODUCT_ID="${CREEM_PRODUCT_ID:-}"
CREEM_CUSTOMER_EMAIL="${CREEM_CUSTOMER_EMAIL:-tester@novaspay.global}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
RESEND_SENDER_EMAIL="${RESEND_SENDER_EMAIL:-}"
RESEND_SENDER_NAME="${RESEND_SENDER_NAME:-Novas Notifications}"
TEST_RECIPIENT_EMAIL="${TEST_RECIPIENT_EMAIL:-}"
ALLOW_CREEM_WRITE="${ALLOW_CREEM_WRITE:-false}"
CLEANUP="${CLEANUP:-true}"

RUN_TAG="$(date +%Y%m%d%H%M%S)"
STARTED_AT="$(date +%s)"
LAYERS="CORE"

for bin in curl jq python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "缺少依赖命令: $bin" >&2
    exit 2
  fi
done
if [[ ! -f "$CATALOG" ]]; then
  echo "找不到用例文档: $CATALOG" >&2
  exit 2
fi
if [[ ! -f "$REPORT_PY" ]]; then
  echo "找不到报告生成器: $REPORT_PY" >&2
  exit 2
fi

mkdir -p "$REPORT_DIR"
RESULTS_JSONL="${REPORT_DIR}/smoke_${RUN_TAG}.jsonl"
META_JSON="${REPORT_DIR}/smoke_${RUN_TAG}.meta.json"
REPORT_MD="${REPORT_DIR}/smoke_${RUN_TAG}.md"
COOKIE_JAR="$(mktemp)"
HTTP_CODE=""
RESP_BODY=""

COLOR_RED=$'\033[0;31m'; COLOR_GREEN=$'\033[0;32m'; COLOR_YELLOW=$'\033[0;33m'
COLOR_BLUE=$'\033[0;34m'; COLOR_RESET=$'\033[0m'
log_info() { echo "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"; }
log_pass() { echo "${COLOR_GREEN}[PASS]${COLOR_RESET} $*"; }
log_fail() { echo "${COLOR_RED}[FAIL]${COLOR_RESET} $*"; }
log_warn() { echo "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"; }

USER_ID=""
ROLE_ID=""
PACK_ID=""
DEPT_PARENT_ID=""
DEPT_CHILD_ID=""
TENANT_ID=""
CHANNEL_ID=""
EXT_CHANNEL_ID=""
EMAIL_CHANNEL_ID=""
EMAIL_FAKE_ID=""
EXT_EMAIL_ID=""
DICT_CAT_ID=""
DICT_ENTRY_ID=""
TASK_ID=""
CREATED_TASK="false"

FAIL_COUNT=0
REPORT_DONE=0

json_escape() {
  jq -n --arg s "${1:-}" '$s'
}

record() {
  local id="$1" title="$2" layer="$3" status="$4" detail="${5:-}"
  python3 "${SCRIPT_DIR}/lib/smoke_record.py" "$id" "$title" "$layer" "$status" "$detail" "$RESULTS_JSONL"
  case "$status" in
    PASS) log_pass "$id $title - $detail" ;;
    FAIL)
      log_fail "$id $title - $detail"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      ;;
    WARN) log_warn "$id $title - $detail" ;;
    SKIP) log_warn "$id $title SKIP - $detail" ;;
  esac
}

# call METHOD PATH [JSON_BODY] [extra_header]
# COOKIE_MODE: default=jar | none | jarfile
call() {
  local method="$1" path="$2" data="${3:-}" extra_header="${4:-}"
  local url="${API_BASE}${path}"
  local args=(-sS --connect-timeout 3 --max-time 20 -X "$method" "$url" -w $'\n%{http_code}')
  if [[ "${COOKIE_MODE:-jar}" == "jar" ]]; then
    args+=(-c "$COOKIE_JAR" -b "$COOKIE_JAR")
  elif [[ "${COOKIE_MODE:-jar}" == "none" ]]; then
    :
  fi
  if [[ -n "$extra_header" ]]; then
    args+=(-H "$extra_header")
  fi
  local raw
  if [[ -n "$data" ]]; then
    raw="$(curl "${args[@]}" -H "Content-Type: application/json" --data "$data" 2>/dev/null || true)"
  else
    raw="$(curl "${args[@]}" 2>/dev/null || true)"
  fi
  # 连接失败时 curl -w 仍可能写出 "\n000"；空输出同样视为不可达
  if [[ -z "${raw//$'\n'/}" ]]; then
    HTTP_CODE="000"
    RESP_BODY=""
    return 0
  fi
  HTTP_CODE="$(printf '%s' "$raw" | tail -n1)"
  RESP_BODY="$(printf '%s' "$raw" | sed '$d')"
  if [[ ! "$HTTP_CODE" =~ ^[0-9]{3}$ ]]; then
    HTTP_CODE="000"
  fi
}

biz_code() { echo "${RESP_BODY:-}" | jq -r '.code // empty' 2>/dev/null || true; }
biz_msg()  { echo "${RESP_BODY:-}" | jq -r '.message // empty' 2>/dev/null || true; }
data_get() { echo "${RESP_BODY:-}" | jq -r "$1" 2>/dev/null || true; }

expect_ok() {
  local id="$1" title="$2" layer="${3:-CORE}" extra="${4:-}"
  if [[ "$(biz_code)" == "0" ]]; then
    record "$id" "$title" "$layer" "PASS" "http=$HTTP_CODE ${extra}"
    return 0
  fi
  record "$id" "$title" "$layer" "FAIL" "http=$HTTP_CODE code=$(biz_code) msg=$(biz_msg) ${extra}"
  return 1
}

expect_err() {
  local id="$1" title="$2" want_code="$3" layer="${4:-CORE}" extra="${5:-}"
  if [[ "$(biz_code)" == "$want_code" ]]; then
    record "$id" "$title" "$layer" "PASS" "http=$HTTP_CODE code=$want_code ${extra}"
    return 0
  fi
  record "$id" "$title" "$layer" "FAIL" "期望 code=$want_code，实际 http=$HTTP_CODE code=$(biz_code) msg=$(biz_msg) ${extra}"
  return 1
}

cleanup_resources() {
  [[ "$CLEANUP" == "true" ]] || return 0
  [[ -n "$DICT_ENTRY_ID" ]] && call DELETE "/dictionary/entries/$DICT_ENTRY_ID" || true
  [[ -n "$DICT_CAT_ID" ]] && call DELETE "/dictionary/categories/$DICT_CAT_ID" || true
  [[ -n "$EMAIL_FAKE_ID" ]] && call DELETE "/email-channels/$EMAIL_FAKE_ID" || true
  [[ -n "$EMAIL_CHANNEL_ID" ]] && call DELETE "/email-channels/$EMAIL_CHANNEL_ID" || true
  [[ -n "$EXT_EMAIL_ID" ]] && call DELETE "/email-channels/$EXT_EMAIL_ID" || true
  [[ -n "$CHANNEL_ID" ]] && call DELETE "/payment-channels/$CHANNEL_ID" || true
  [[ -n "$EXT_CHANNEL_ID" ]] && call DELETE "/payment-channels/$EXT_CHANNEL_ID" || true
  [[ -n "$TENANT_ID" ]] && call DELETE "/tenants/$TENANT_ID" || true
  [[ -n "$DEPT_CHILD_ID" ]] && call DELETE "/departments/$DEPT_CHILD_ID" || true
  [[ -n "$DEPT_PARENT_ID" ]] && call DELETE "/departments/$DEPT_PARENT_ID" || true
  [[ -n "$USER_ID" ]] && call DELETE "/users/$USER_ID" || true
  [[ -n "$ROLE_ID" ]] && call DELETE "/roles/$ROLE_ID" || true
  [[ -n "$PACK_ID" ]] && call DELETE "/permission-packs/$PACK_ID" || true
  log_info "已尝试清理本次创建的测试数据"
}

write_meta() {
  local elapsed=$(( $(date +%s) - STARTED_AT ))
  jq -nc --arg root "$ROOT_URL" --arg email "$ADMIN_EMAIL" --arg layers "$LAYERS" \
    --arg catalog "docs/qa/NovasPay-测试用例文档.md" \
    --arg finished "$(date '+%Y-%m-%d %H:%M:%S')" --argjson elapsed "$elapsed" \
    '{rootUrl:$root,adminEmail:$email,layers:$layers,catalogRel:$catalog,finishedAt:$finished,elapsedSec:$elapsed}' \
    > "$META_JSON"
}

generate_report() {
  [[ "$REPORT_DONE" == "1" ]] && return 0
  write_meta
  python3 "$REPORT_PY" --catalog "$CATALOG" --results "$RESULTS_JSONL" --output "$REPORT_MD" --meta "$META_JSON" >/dev/null
  REPORT_DONE=1
  log_info "冒烟报告已生成: $REPORT_MD"
}

on_exit() {
  local code=$?
  COOKIE_MODE=jar
  cleanup_resources
  call POST "/auth/logout" || true
  generate_report || true
  rm -f "$COOKIE_JAR"
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
  fi
  exit "$code"
}
trap on_exit EXIT INT TERM

# ------------------------------------------------------------------------------------
# CORE
# ------------------------------------------------------------------------------------

log_info "目标环境: $ROOT_URL  用例文档: $CATALOG"

# TC-GLB-011 /healthz
healthz_code="$(curl -sS --connect-timeout 3 --max-time 10 -o /dev/null -w '%{http_code}' "${ROOT_URL%/}/healthz" 2>/dev/null || true)"
[[ "$healthz_code" =~ ^[0-9]{3}$ ]] || healthz_code="000"
if [[ "$healthz_code" == "200" ]]; then
  record "TC-GLB-011" "GET /healthz 健康检查通过" "CORE" "PASS" "http=$healthz_code"
else
  record "TC-GLB-011" "GET /healthz 健康检查通过" "CORE" "FAIL" "http=$healthz_code"
fi

# TC-GLB-012 /readyz
readyz_code="$(curl -sS --connect-timeout 3 --max-time 10 -o /dev/null -w '%{http_code}' "${ROOT_URL%/}/readyz" 2>/dev/null || true)"
[[ "$readyz_code" =~ ^[0-9]{3}$ ]] || readyz_code="000"
if [[ "$readyz_code" == "200" ]]; then
  record "TC-GLB-012" "GET /readyz 就绪检查通过" "CORE" "PASS" "http=${readyz_code}"
else
  record "TC-GLB-012" "GET /readyz 就绪检查通过" "CORE" "FAIL" "http=${readyz_code}"
fi

# TC-AUTH-008 未登录
COOKIE_MODE=none
call GET "/users"
expect_err "TC-AUTH-008" "未登录访问受保护接口返回 401" "40100"
if [[ "$(biz_code)" == "40100" ]] && echo "${RESP_BODY:-{}}" | jq -e 'type=="object" and has("code") and has("message") and has("data")' >/dev/null 2>&1; then
  record "TC-GLB-006" "所有 API 异常响应均遵循统一 code/message/data 格式" "CORE" "PASS" "抽样 /users 未登录响应"
else
  record "TC-GLB-006" "所有 API 异常响应均遵循统一 code/message/data 格式" "CORE" "FAIL" "http=$HTTP_CODE code=$(biz_code)"
fi

# TC-AUTH-009 非法 X-App-Env
call GET "/users" "" "X-App-Env: foo"
expect_err "TC-AUTH-009" "X-App-Env 传非法值返回 400" "40001"

# TC-AUTH-003 密码错误（仅 1 次，避免触发限流）
call POST "/auth/login" "$(jq -n --arg e "$ADMIN_EMAIL" '{email:$e,password:"definitely-wrong-password"}')"
expect_err "TC-AUTH-003" "密码错误登录失败" "40101"

# TC-AUTH-001 正确登录
COOKIE_MODE=jar
call POST "/auth/login" "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')"
login_ok=true
if [[ "$(biz_code)" != "0" ]]; then login_ok=false; fi
if echo "$RESP_BODY" | jq -e '.data.accessToken or .data.token or .data.refreshToken' >/dev/null 2>&1; then
  login_ok=false
  record "TC-AUTH-001" "正确邮箱密码登录成功" "CORE" "FAIL" "响应 JSON 含 token 字段，违反 Cookie 会话约定"
elif ! grep -q "novas_access" "$COOKIE_JAR"; then
  login_ok=false
  record "TC-AUTH-001" "正确邮箱密码登录成功" "CORE" "FAIL" "Cookie 未写入 novas_access"
elif [[ "$login_ok" == "true" ]]; then
  record "TC-AUTH-001" "正确邮箱密码登录成功" "CORE" "PASS" "http=$HTTP_CODE cookie=novas_access 响应不含 token"
else
  record "TC-AUTH-001" "正确邮箱密码登录成功" "CORE" "FAIL" "http=$HTTP_CODE code=$(biz_code) msg=$(biz_msg)"
fi

# TC-AUTH-010 缺省 X-App-Env（隐式 live）——登录已成功即覆盖
if [[ "$login_ok" == "true" ]]; then
  record "TC-AUTH-010" "X-App-Env 缺省时默认按 live 处理" "CORE" "PASS" "登录请求未带该 Header 且成功"
else
  record "TC-AUTH-010" "X-App-Env 缺省时默认按 live 处理" "CORE" "SKIP" "登录失败，无法验证"
fi

# TC-AUTH-007 /me
call GET "/me"
expect_ok "TC-AUTH-007" "GET /me 返回当前用户信息与权限"
ME_EMAIL="$(data_get '.data.email // empty')"

# TC-AUTH-014 SUPER_ADMIN menuKeys
# 必须先确认业务码为 0 且 menuKeys 为数组：空响应时 jq 解析失败 stdout 为空，
# 若只判断「缺失列表为空」会把不可达环境误判为 PASS。
AUTH014_TITLE="SUPER_ADMIN 账号 /me 返回全部菜单 key"
if [[ "$(biz_code)" != "0" || "$HTTP_CODE" != "200" ]]; then
  record "TC-AUTH-014" "$AUTH014_TITLE" "CORE" "FAIL" "http=$HTTP_CODE code=$(biz_code) msg=$(biz_msg) 无有效 /me 响应"
else
  menu_check="$(echo "$RESP_BODY" | jq -r --argjson need '["dashboard","transactions","payment_channels","email_channels","roles","menus","users","system_users","dictionary"]' '
    if ((.data.menuKeys | type) != "array") then
      "MENUKEYS_NOT_ARRAY"
    else
      ((.data.menuKeys | length) | tostring) as $n
      | ($need - .data.menuKeys | join(",")) as $missing
      | if ((.data.menuKeys | length) < 20) then
          "TOO_FEW:" + $n + (if $missing == "" then "" else " missing:" + $missing end)
        else
          $missing
        end
    end
  ' 2>/dev/null || echo "PARSE_ERROR")"
  if [[ -z "$menu_check" ]]; then
    record "TC-AUTH-014" "$AUTH014_TITLE" "CORE" "PASS" "menuKeys=$(data_get '.data.menuKeys | length') email=$ME_EMAIL"
  else
    record "TC-AUTH-014" "$AUTH014_TITLE" "CORE" "FAIL" "$menu_check"
  fi
fi

# TC-MENU-001
call GET "/menus"
expect_ok "TC-MENU-001" "GET /menus 任意登录用户均可访问"

# TC-USR-009
call GET "/users?page=1&pageSize=20"
expect_ok "TC-USR-009" "GET /users 列表可正常访问" "CORE" "total=$(data_get '.data.total // 0')"

# TC-USR-001 创建用户
SMOKE_USER_EMAIL="smoke.${RUN_TAG}@novaspay.test"
call POST "/users" "$(jq -n --arg e "$SMOKE_USER_EMAIL" --arg n "Smoke User $RUN_TAG" '{email:$e,name:$n}')"
if [[ "$(biz_code)" == "0" ]]; then
  USER_ID="$(data_get '.data.user.id')"
  INIT_PWD="$(data_get '.data.initialPassword')"
  if [[ -n "$USER_ID" && "$USER_ID" != "null" && ${#INIT_PWD} -eq 12 ]]; then
    record "TC-USR-001" "创建系统用户成功" "CORE" "PASS" "userId=$USER_ID initialPasswordLen=12"
  else
    record "TC-USR-001" "创建系统用户成功" "CORE" "FAIL" "userId=$USER_ID pwdLen=${#INIT_PWD}"
  fi
else
  record "TC-USR-001" "创建系统用户成功" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

# TC-USR-002 邮箱重复
if [[ -n "$USER_ID" ]]; then
  call POST "/users" "$(jq -n --arg e "$SMOKE_USER_EMAIL" --arg n "Dup" '{email:$e,name:$n}')"
  expect_err "TC-USR-002" "邮箱重复创建失败" "40901"
else
  record "TC-USR-002" "邮箱重复创建失败" "CORE" "SKIP" "用户创建失败"
fi

# TC-USR-006 重置密码
if [[ -n "$USER_ID" ]]; then
  call POST "/users/$USER_ID/reset-password"
  NEW_PWD="$(data_get '.data.password')"
  if [[ "$(biz_code)" == "0" && -n "$NEW_PWD" && "$NEW_PWD" != "$INIT_PWD" ]]; then
    record "TC-USR-006" "重置密码返回新初始密码" "CORE" "PASS" "新密码长度=${#NEW_PWD}"
  else
    record "TC-USR-006" "重置密码返回新初始密码" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
  fi
else
  record "TC-USR-006" "重置密码返回新初始密码" "CORE" "SKIP" "用户创建失败"
fi

# TC-PACK-006 / TC-PACK-001 / TC-PACK-005
call GET "/permission-packs"
expect_ok "TC-PACK-006" "GET /permission-packs 列表可正常访问" "CORE" "含PACK_SUPER_ADMIN=$(echo "$RESP_BODY" | jq -r '[.data[]?.key] | index("PACK_SUPER_ADMIN") != null')"

call POST "/permission-packs" "$(jq -n --arg k "SMOKE_PACK_${RUN_TAG}" --arg n "冒烟权限包 ${RUN_TAG}" '{key:$k,name:$n,description:"smoke",menuIds:[]}')"
if [[ "$(biz_code)" == "0" ]]; then
  PACK_ID="$(data_get '.data.id')"
  record "TC-PACK-001" "创建权限包成功" "CORE" "PASS" "packId=$PACK_ID"
else
  record "TC-PACK-001" "创建权限包成功" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

# TC-ROLE-008 / TC-ROLE-001 / TC-ROLE-005 / TC-ROLE-004
call GET "/roles"
expect_ok "TC-ROLE-008" "GET /roles 列表可正常访问"
SUPER_ROLE_ID="$(echo "$RESP_BODY" | jq -r '.data[] | select(.key=="SUPER_ADMIN") | .id' | head -n1)"

call POST "/roles" "$(jq -n --arg k "SMOKE_ROLE_${RUN_TAG}" --arg n "冒烟角色 ${RUN_TAG}" --arg p "${PACK_ID}" '{key:$k,name:$n,description:"smoke",packIds: (if $p=="" then [] else [$p] end), appIds:["ALL"]}')"
if [[ "$(biz_code)" == "0" ]]; then
  ROLE_ID="$(data_get '.data.id')"
  record "TC-ROLE-001" "创建自定义角色（绑定权限包+应用范围）" "CORE" "PASS" "roleId=$ROLE_ID isCustom=$(data_get '.data.isCustom')"
else
  record "TC-ROLE-001" "创建自定义角色（绑定权限包+应用范围）" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

if [[ -n "$SUPER_ROLE_ID" ]]; then
  call DELETE "/roles/$SUPER_ROLE_ID"
  expect_err "TC-ROLE-005" "删除内置角色 SUPER_ADMIN 被拒绝" "40301"
else
  record "TC-ROLE-005" "删除内置角色 SUPER_ADMIN 被拒绝" "CORE" "FAIL" "未能从列表解析 SUPER_ADMIN id"
fi

# 角色删除放到 cleanup（TC-ROLE-004）

# TC-DEPT-007 / 001 / 002 / 003
call GET "/departments"
expect_ok "TC-DEPT-007" "GET /departments 列表可正常访问"

call POST "/departments" "$(jq -n --arg n "冒烟父部门 ${RUN_TAG}" --arg c "SMOKE-P-${RUN_TAG}" '{name:$n,code:$c}')"
if [[ "$(biz_code)" == "0" ]]; then
  DEPT_PARENT_ID="$(data_get '.data.id')"
  record "TC-DEPT-001" "创建部门（树形结构）" "CORE" "PASS" "deptId=$DEPT_PARENT_ID"
else
  record "TC-DEPT-001" "创建部门（树形结构）" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

if [[ -n "$DEPT_PARENT_ID" ]]; then
  call POST "/departments" "$(jq -n --arg n "重复编码" --arg c "SMOKE-P-${RUN_TAG}" '{name:$n,code:$c}')"
  expect_err "TC-DEPT-002" "部门 code 重复创建失败" "40900"
  call POST "/departments" "$(jq -n --arg n "冒烟子部门 ${RUN_TAG}" --arg c "SMOKE-C-${RUN_TAG}" --arg p "$DEPT_PARENT_ID" '{name:$n,code:$c,parentId:$p}')"
  if [[ "$(biz_code)" == "0" ]]; then
    DEPT_CHILD_ID="$(data_get '.data.id')"
    call DELETE "/departments/$DEPT_PARENT_ID"
    expect_err "TC-DEPT-003" "删除有子部门的部门被拒绝" "40902"
  else
    record "TC-DEPT-003" "删除有子部门的部门被拒绝" "CORE" "SKIP" "子部门创建失败 code=$(biz_code)"
  fi
else
  record "TC-DEPT-002" "部门 code 重复创建失败" "CORE" "SKIP" "父部门创建失败"
  record "TC-DEPT-003" "删除有子部门的部门被拒绝" "CORE" "SKIP" "父部门创建失败"
fi

# TC-TEN-009 / 001 / 002 / 004 / 005
call GET "/tenants"
expect_ok "TC-TEN-009" "GET /tenants 列表可正常访问"
if echo "$RESP_BODY" | jq -e '.data[] | select(.id=="group_hq")' >/dev/null 2>&1; then
  :
else
  log_warn "租户列表未发现 group_hq（不影响列表用例本身）"
fi

TENANT_ID="smoke_${RUN_TAG}"
call POST "/tenants" "$(jq -n --arg id "$TENANT_ID" --arg n "冒烟租户 ${RUN_TAG}" --arg c "SMK${RUN_TAG: -6}" '{id:$id,name:$n,code:$c}')"
if [[ "$(biz_code)" == "0" ]]; then
  iso="$(data_get '.data.isolationLevel')"
  cur="$(data_get '.data.currency')"
  if [[ "$iso" == "LOGICAL_TENANT" && "$cur" == "USD" ]]; then
    record "TC-TEN-001" "创建租户成功（默认 LOGICAL_TENANT/USD）" "CORE" "PASS" "id=$TENANT_ID"
  else
    record "TC-TEN-001" "创建租户成功（默认 LOGICAL_TENANT/USD）" "CORE" "FAIL" "isolation=$iso currency=$cur"
  fi
  call POST "/tenants" "$(jq -n --arg id "$TENANT_ID" --arg n "冲突" --arg c "SMK${RUN_TAG: -6}" '{id:$id,name:$n,code:$c}')"
  expect_err "TC-TEN-002" "租户 ID 或编码冲突创建失败" "40900"
else
  record "TC-TEN-001" "创建租户成功（默认 LOGICAL_TENANT/USD）" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
  record "TC-TEN-002" "租户 ID 或编码冲突创建失败" "CORE" "SKIP" "租户创建失败"
  TENANT_ID=""
fi

call DELETE "/tenants/group_hq"
expect_err "TC-TEN-004" "删除总部租户 group_hq 被拒绝" "40910"

# TC-TEN-005 删除普通租户 —— 放到 cleanup 里记一次结果
# 先在这里主动删除再记录，cleanup 中 TENANT_ID 置空
if [[ -n "$TENANT_ID" ]]; then
  call DELETE "/tenants/$TENANT_ID"
  if [[ "$(biz_code)" == "0" ]]; then
    record "TC-TEN-005" "删除普通业务租户成功" "CORE" "PASS" "id=$TENANT_ID"
    TENANT_ID=""
  else
    record "TC-TEN-005" "删除普通业务租户成功" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
  fi
else
  record "TC-TEN-005" "删除普通业务租户成功" "CORE" "SKIP" "租户创建失败"
fi

# 支付渠道 CORE
call GET "/payment-channels"
expect_ok "TC-PAYCH-016" "GET /payment-channels 列表可正常访问"

call POST "/payment-channels" "$(jq -n --arg n "[SMOKE] Creem ${RUN_TAG}" '{
  channelKey:"creem", name:$n, accountName:"smoke", description:"smoke core",
  mode:"sandbox", apiSecretKey:"sk_test_invalid_smoke_secret", webhookSecret:"",
  supportedCurrencies:["USD"], feeRateText:"smoke", routingPriority:99
}')"
if [[ "$(biz_code)" == "0" ]]; then
  CHANNEL_ID="$(data_get '.data.id')"
  record "TC-PAYCH-001" "创建 Creem 支付渠道成功（创建本身不触发外部调用）" "CORE" "PASS" "channelId=$CHANNEL_ID"
else
  record "TC-PAYCH-001" "创建 Creem 支付渠道成功（创建本身不触发外部调用）" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

if [[ -n "$CHANNEL_ID" ]]; then
  call PUT "/payment-channels/$CHANNEL_ID" "$(jq -n --arg n "[SMOKE] Creem ${RUN_TAG} updated" '{name:$n,routingPriority:80}')"
  expect_ok "TC-PAYCH-009" "编辑渠道信息（名称/优先级等）" "CORE" "name=$(data_get '.data.name')"

  call POST "/payment-channels/$CHANNEL_ID/test"
  test_code="$(biz_code)"
  if [[ "$test_code" == "50210" ]]; then
    call GET "/payment-channels/$CHANNEL_ID"
    st="$(data_get '.data.testStatus')"
    if [[ "$st" == "DOWN" ]]; then
      record "TC-PAYCH-004" "连通性测试失败：接口报错但状态仍异步落库为 DOWN" "CORE" "PASS" "testStatus=DOWN lastTestedAt=$(data_get '.data.lastTestedAt')"
    else
      record "TC-PAYCH-004" "连通性测试失败：接口报错但状态仍异步落库为 DOWN" "CORE" "FAIL" "testStatus=$st body=$(biz_msg)"
    fi
  else
    record "TC-PAYCH-004" "连通性测试失败：接口报错但状态仍异步落库为 DOWN" "CORE" "FAIL" "期望 50210，实际 code=$test_code msg=$(biz_msg)"
  fi
else
  record "TC-PAYCH-009" "编辑渠道信息（名称/优先级等）" "CORE" "SKIP" "渠道创建失败"
  record "TC-PAYCH-004" "连通性测试失败：接口报错但状态仍异步落库为 DOWN" "CORE" "SKIP" "渠道创建失败"
fi

call GET "/payment-webhooks?page=1&pageSize=5"
expect_ok "TC-PAYWH-007" "GET /payment-webhooks 列表可正常访问"

call GET "/transactions?page=1&pageSize=20"
expect_ok "TC-TXN-001" "交易列表分页查询" "CORE" "total=$(data_get '.data.total // 0')"

call GET "/reconciliation/summary"
expect_ok "TC-RECON-001" "对账汇总（三方节点概览）可正常访问"

call GET "/reconciliation/batches?page=1&pageSize=20"
expect_ok "TC-RECON-006" "对账批次列表分页查询"

# TC-RECON-004 对非差错流水核销
tx_id="$(echo "$RESP_BODY" | jq -r '.data.list[]? | select(.status != "discrepancy") | .id' 2>/dev/null | head -n1)"
# 上面用的是 batches 响应；改用 transactions
call GET "/transactions?page=1&pageSize=50"
tx_id="$(echo "$RESP_BODY" | jq -r '[.data.list[]? | select(.status != "discrepancy") | .id] | first // empty')"
if [[ -z "$tx_id" ]]; then
  # 用一个不存在的 id 会得到 404 而不是 42220，按文档应 WARN 跳过
  record "TC-RECON-004" "对非差错状态流水执行核销被拒绝" "CORE" "WARN" "环境暂无非 discrepancy 交易，跳过 42220 断言"
else
  call POST "/reconciliation/discrepancies/${tx_id}/resolve" '{"note":"smoke"}'
  expect_err "TC-RECON-004" "对非差错状态流水执行核销被拒绝" "42220"
fi

call GET "/refunds"
expect_ok "TC-REFUND-008" "GET /refunds 列表可正常访问"

call GET "/chargebacks"
if expect_ok "TC-CB-001" "拒付列表查看"; then
  record "TC-CB-005" "GET /chargebacks 列表可正常访问" "CORE" "PASS" "与 TC-CB-001 合并执行"
else
  record "TC-CB-005" "GET /chargebacks 列表可正常访问" "CORE" "FAIL" "与 TC-CB-001 合并执行"
fi

call GET "/products"
expect_ok "TC-PROD-011" "GET /products 列表可正常访问"

call GET "/discounts"
expect_ok "TC-DISC-008" "GET /discounts 列表可正常访问"

call GET "/promo-campaigns"
expect_ok "TC-PROMO-006" "GET /promo-campaigns 列表可正常访问"

# 邮件渠道 CORE
call GET "/email-channels"
expect_ok "TC-ECH-011" "GET /email-channels 列表可正常访问"
sandbox_email_count="$(echo "$RESP_BODY" | jq '[.data[]? | select((.mode // .environment // "") | test("sandbox";"i"))] | length')"

call POST "/email-channels" "$(jq -n --arg n "[SMOKE] Resend ${RUN_TAG}" '{
  providerKey:"resend", name:$n, description:"smoke core", mode:"sandbox",
  senderEmail:"smoke@example.test", senderName:"Smoke", apiKey:"re_invalid_smoke_key",
  smtpHost:"smtp.resend.com", smtpPort:465, dailyQuota:100
}')"
if [[ "$(biz_code)" == "0" ]]; then
  EMAIL_CHANNEL_ID="$(data_get '.data.id')"
  is_primary="$(data_get '.data.isPrimary')"
  record "TC-ECH-001" "创建 Resend 渠道成功（创建本身不触发外部调用）" "CORE" "PASS" "id=$EMAIL_CHANNEL_ID isPrimary=$is_primary"
  if [[ "$sandbox_email_count" == "0" && "$is_primary" == "true" ]]; then
    record "TC-ECH-003" "同环境首个渠道自动设为 isPrimary" "CORE" "PASS" "sandbox 下首个渠道 isPrimary=true"
  elif [[ "$sandbox_email_count" != "0" ]]; then
    record "TC-ECH-003" "同环境首个渠道自动设为 isPrimary" "CORE" "WARN" "sandbox 环境已有 $sandbox_email_count 个渠道，跳过首个 primary 断言（实际 isPrimary=$is_primary）"
  else
    record "TC-ECH-003" "同环境首个渠道自动设为 isPrimary" "CORE" "FAIL" "sandbox 下本应成为 primary，实际 isPrimary=$is_primary"
  fi
else
  record "TC-ECH-001" "创建 Resend 渠道成功（创建本身不触发外部调用）" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
  record "TC-ECH-003" "同环境首个渠道自动设为 isPrimary" "CORE" "SKIP" "渠道创建失败"
fi

call POST "/email-channels" "$(jq -n --arg n "[SMOKE] FakeProvider ${RUN_TAG}" '{
  providerKey:"not-resend", name:$n, description:"smoke fake provider", mode:"sandbox",
  senderEmail:"fake@example.test", senderName:"Fake", apiKey:"fake-key"
}')"
if [[ "$(biz_code)" == "0" ]]; then
  EMAIL_FAKE_ID="$(data_get '.data.id')"
  call POST "/email-channels/${EMAIL_FAKE_ID}/test" '{"recipient":"anyone@example.test"}'
  expect_err "TC-ECH-006" "非 Resend 服务商发测试信被拒绝" "42210"
else
  record "TC-ECH-006" "非 Resend 服务商发测试信被拒绝" "CORE" "FAIL" "假 provider 渠道创建失败 code=$(biz_code) msg=$(biz_msg)"
fi

call GET "/email-templates"
expect_ok "TC-ETPL-006" "GET /email-templates 列表可正常访问"

call GET "/email-webhooks?page=1&pageSize=5"
if expect_ok "TC-EWH-001" "邮件送达回执列表查询"; then
  record "TC-EWH-004" "GET /email-webhooks 列表可正常访问" "CORE" "PASS" "与 TC-EWH-001 合并执行"
else
  record "TC-EWH-004" "GET /email-webhooks 列表可正常访问" "CORE" "FAIL" "与 TC-EWH-001 合并执行"
fi

call GET "/apps"
expect_ok "TC-APP-005" "GET /apps 列表可正常访问"

call GET "/settlements"
expect_ok "TC-SETTLE-008" "GET /settlements 列表可正常访问"

call GET "/reports/revenue"
expect_ok "TC-FIN-004" "GET /reports/revenue 可正常访问"

call GET "/exchange-rates"
expect_ok "TC-FX-006" "GET /exchange-rates 列表可正常访问"

call GET "/fee-rules"
expect_ok "TC-FEE-005" "GET /fee-rules 列表可正常访问"

call GET "/risk-rules"
expect_ok "TC-RISK-006" "GET /risk-rules 列表可正常访问"

call GET "/blacklist"
expect_ok "TC-RISK-007" "GET /blacklist 列表可正常访问"

call GET "/merchant-applications"
if expect_ok "TC-KYB-001" "商户审核列表查看"; then
  record "TC-KYB-005" "GET /merchant-applications 列表可正常访问" "CORE" "PASS" "与 TC-KYB-001 合并执行"
else
  record "TC-KYB-005" "GET /merchant-applications 列表可正常访问" "CORE" "FAIL" "与 TC-KYB-001 合并执行"
fi

call GET "/alert-history"
expect_ok "TC-ALERT-003" "告警历史列表查看"

call GET "/alert-rules"
expect_ok "TC-ALERT-005" "GET /alert-rules 列表可正常访问"

# 字典
call GET "/dictionary/languages"
expect_ok "TC-DICT-014" "GET /dictionary/languages 列表可正常访问"

call GET "/dictionary/categories"
expect_ok "TC-DICT-012" "GET /dictionary/categories 列表可正常访问"
AUDIT_CAT_ID="$(echo "$RESP_BODY" | jq -r '
  .data
  | ..
  | objects
  | select(.key=="audit_action")
  | .id
' | head -n1)"

if [[ -n "$AUDIT_CAT_ID" ]]; then
  call DELETE "/dictionary/categories/$AUDIT_CAT_ID"
  expect_err "TC-DICT-003" "删除系统分类（如 audit_action）被拒绝" "40910"
else
  record "TC-DICT-003" "删除系统分类（如 audit_action）被拒绝" "CORE" "FAIL" "未找到 audit_action 分类"
fi

call GET "/dictionary/entries?page=1&pageSize=20"
expect_ok "TC-DICT-013" "GET /dictionary/entries 列表可正常访问"

call POST "/dictionary/categories" "$(jq -n --arg k "smoke_cat_${RUN_TAG}" --arg n "冒烟分类 ${RUN_TAG}" '{key:$k,name:$n}')"
if [[ "$(biz_code)" == "0" ]]; then
  DICT_CAT_ID="$(data_get '.data.id')"
  record "TC-DICT-001" "新增字典分类成功" "CORE" "PASS" "id=$DICT_CAT_ID"
else
  record "TC-DICT-001" "新增字典分类成功" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
fi

if [[ -n "$DICT_CAT_ID" ]]; then
  call POST "/dictionary/entries" "$(jq -n --arg ns "smoke" --arg k "smoke_entry_${RUN_TAG}" --arg cid "$DICT_CAT_ID" '{namespace:$ns,entryKey:$k,categoryId:$cid,label:"smoke"}')"
  if [[ "$(biz_code)" == "0" ]]; then
    DICT_ENTRY_ID="$(data_get '.data.id')"
    record "TC-DICT-005" "新增字典词条" "CORE" "PASS" "id=$DICT_ENTRY_ID"
    call DELETE "/dictionary/categories/$DICT_CAT_ID"
    expect_err "TC-DICT-004" "分类下仍有词条时删除分类被拒绝" "40912"
  else
    record "TC-DICT-005" "新增字典词条" "CORE" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
    record "TC-DICT-004" "分类下仍有词条时删除分类被拒绝" "CORE" "SKIP" "词条创建失败"
  fi
else
  record "TC-DICT-005" "新增字典词条" "CORE" "SKIP" "分类创建失败"
  record "TC-DICT-004" "分类下仍有词条时删除分类被拒绝" "CORE" "SKIP" "分类创建失败"
fi

if [[ -n "$AUDIT_CAT_ID" ]]; then
  call GET "/dictionary/entries?page=1&pageSize=5&categoryId=$AUDIT_CAT_ID"
  sys_entry="$(data_get '[.data.list[]?.id] | first // empty')"
  if [[ -n "$sys_entry" ]]; then
    call DELETE "/dictionary/entries/$sys_entry"
    expect_err "TC-DICT-006" "删除系统分类下的词条被拒绝" "40913"
  else
    record "TC-DICT-006" "删除系统分类下的词条被拒绝" "CORE" "WARN" "audit_action 下暂无词条，无法验证 40913"
  fi
else
  record "TC-DICT-006" "删除系统分类下的词条被拒绝" "CORE" "SKIP" "未找到 audit_action 分类"
fi

call GET "/audit-logs?page=1&pageSize=20"
expect_ok "TC-AUDIT-006" "GET /audit-logs 列表可正常访问"

call GET "/system-configs"
expect_ok "TC-SYSCFG-003" "GET /system-configs 列表可正常访问"

call GET "/scheduled-tasks"
expect_ok "TC-TASK-005" "GET /scheduled-tasks 列表可正常访问"
TASK_ID="$(data_get '[.data[]?.id] | first // empty')"
if [[ -z "$TASK_ID" ]]; then
  call POST "/scheduled-tasks" "$(jq -n --arg n "冒烟任务 ${RUN_TAG}" '{name:$n,type:"SMOKE",cron:"0 0 * * *",jobKey:"smoke"}')"
  if [[ "$(biz_code)" == "0" ]]; then
    TASK_ID="$(data_get '.data.id')"
    CREATED_TASK="true"
    log_info "列表为空，已创建临时定时任务 $TASK_ID 用于 trigger 断言"
  fi
fi
if [[ -n "$TASK_ID" ]]; then
  call POST "/scheduled-tasks/${TASK_ID}/trigger"
  expect_ok "TC-TASK-003" "手动触发任务：内置执行器记录一次 SUCCESS 运行" "CORE" "lastRunStatus=$(data_get '.data.lastRunStatus')"
else
  record "TC-TASK-003" "手动触发任务：内置执行器记录一次 SUCCESS 运行" "CORE" "FAIL" "无法取得或创建定时任务"
fi

call GET "/end-users"
expect_ok "TC-ENDUSER-005" "GET /end-users 列表可正常访问"

call GET "/dashboard/kpi"
expect_ok "TC-DASH-001" "GET /dashboard/kpi 返回核心指标"

# 删除用户作为 TC-USR-007
if [[ -n "$USER_ID" ]]; then
  call DELETE "/users/$USER_ID"
  expect_ok "TC-USR-007" "删除用户" "CORE" "userId=$USER_ID"
  USER_ID=""
else
  record "TC-USR-007" "删除用户" "CORE" "SKIP" "用户创建失败"
fi

# 删除自定义角色 / 权限包
if [[ -n "$ROLE_ID" ]]; then
  call DELETE "/roles/$ROLE_ID"
  expect_ok "TC-ROLE-004" "删除自定义角色成功"
  ROLE_ID=""
else
  record "TC-ROLE-004" "删除自定义角色成功" "CORE" "SKIP" "角色创建失败"
fi
if [[ -n "$PACK_ID" ]]; then
  call DELETE "/permission-packs/$PACK_ID"
  expect_ok "TC-PACK-005" "未被引用的权限包可正常删除"
  PACK_ID=""
else
  record "TC-PACK-005" "未被引用的权限包可正常删除" "CORE" "SKIP" "权限包创建失败"
fi

# 删除支付/邮件渠道记入对应删除用例
if [[ -n "$CHANNEL_ID" ]]; then
  call DELETE "/payment-channels/$CHANNEL_ID"
  expect_ok "TC-PAYCH-010" "删除渠道"
  CHANNEL_ID=""
else
  record "TC-PAYCH-010" "删除渠道" "CORE" "SKIP" "渠道创建失败"
fi
if [[ -n "$EMAIL_CHANNEL_ID" ]]; then
  call DELETE "/email-channels/$EMAIL_CHANNEL_ID"
  expect_ok "TC-ECH-008" "删除邮件渠道"
  EMAIL_CHANNEL_ID=""
else
  record "TC-ECH-008" "删除邮件渠道" "CORE" "SKIP" "渠道创建失败"
fi

# TC-AUTH-011 独立会话登出
LOGOUT_JAR="$(mktemp)"
COOKIE_MODE=jar
# 临时换 jar
OLD_JAR="$COOKIE_JAR"
COOKIE_JAR="$LOGOUT_JAR"
call POST "/auth/login" "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')"
call POST "/auth/logout"
logout_code="$(biz_code)"
call GET "/me"
if [[ "$logout_code" == "0" && "$(biz_code)" == "40100" ]]; then
  record "TC-AUTH-011" "登出后原会话立即失效" "CORE" "PASS" "logout=0 /me=40100"
else
  record "TC-AUTH-011" "登出后原会话立即失效" "CORE" "FAIL" "logout=$logout_code me=$(biz_code)"
fi
COOKIE_JAR="$OLD_JAR"
rm -f "$LOGOUT_JAR"
COOKIE_MODE=jar

# ------------------------------------------------------------------------------------
# EXTENDED
# ------------------------------------------------------------------------------------

run_extended=false
if [[ -n "$CREEM_API_SECRET" || -n "$RESEND_API_KEY" ]]; then
  run_extended=true
  LAYERS="CORE+EXTENDED"
fi

if [[ "$run_extended" == "true" ]]; then
  log_info "检测到外部凭据，开始 EXTENDED 层"

  if [[ -n "$CREEM_API_SECRET" ]]; then
    call POST "/payment-channels" "$(jq -n --arg n "[SMOKE-EXT] Creem ${RUN_TAG}" --arg s "$CREEM_API_SECRET" --arg w "$CREEM_WEBHOOK_SECRET" '{
      channelKey:"creem", name:$n, accountName:"smoke-ext", description:"smoke extended",
      mode:"sandbox", apiSecretKey:$s, webhookSecret:$w, supportedCurrencies:["USD"],
      feeRateText:"smoke-ext", routingPriority:98
    }')"
    if [[ "$(biz_code)" == "0" ]]; then
      EXT_CHANNEL_ID="$(data_get '.data.id')"
      call POST "/payment-channels/${EXT_CHANNEL_ID}/test"
      st="$(data_get '.data.testStatus')"
      if [[ "$st" == "HEALTHY" ]]; then
        record "TC-PAYCH-003" "连通性测试成功返回 HEALTHY" "EXTENDED" "PASS" "latency=$(data_get '.data.latencyMs')ms"
      else
        record "TC-PAYCH-003" "连通性测试成功返回 HEALTHY" "EXTENDED" "FAIL" "testStatus=$st code=$(biz_code) msg=$(biz_msg)"
      fi

      call POST "/products/sync-from-creem?channelId=${EXT_CHANNEL_ID}"
      expect_ok "TC-PROD-004" "从 Creem 批量同步商品" "EXTENDED" "$(echo "$RESP_BODY" | jq -r 'if .data then "created=\(.data.created) updated=\(.data.updated) total=\(.data.total)" else .message end')"

      pid="$CREEM_PRODUCT_ID"
      if [[ -z "$pid" ]]; then
        call GET "/products?channelId=${EXT_CHANNEL_ID}"
        pid="$(data_get '.data[0].externalProductId // empty')"
      fi
      if [[ -n "$pid" ]]; then
        call POST "/payment-channels/${EXT_CHANNEL_ID}/checkout-test" "$(jq -n --arg p "$pid" --arg e "$CREEM_CUSTOMER_EMAIL" '{productId:$p,customerEmail:$e}')"
        url="$(data_get '.data.checkoutUrl // empty')"
        if [[ -n "$url" ]]; then
          record "TC-PAYCH-005" "Sandbox 测试下单成功创建 Checkout" "EXTENDED" "PASS" "session=$(data_get '.data.sessionId')"
        else
          record "TC-PAYCH-005" "Sandbox 测试下单成功创建 Checkout" "EXTENDED" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
        fi
      else
        record "TC-PAYCH-005" "Sandbox 测试下单成功创建 Checkout" "EXTENDED" "WARN" "未提供 CREEM_PRODUCT_ID 且同步列表为空"
      fi

      if [[ "$ALLOW_CREEM_WRITE" == "true" ]]; then
        call POST "/products" "$(jq -n --arg cid "$EXT_CHANNEL_ID" --arg code "SMOKE-${RUN_TAG}" --arg name "Smoke SKU ${RUN_TAG}" '{channelId:$cid,code:$code,name:$name,price:1,currency:"USD",type:"ONETIME"}')"
        expect_ok "TC-PROD-001" "创建商品 SKU 成功" "EXTENDED" "syncStatus=$(data_get '.data.syncStatus')"
      else
        record "TC-PROD-001" "创建商品 SKU 成功" "EXTENDED" "SKIP" "未设置 ALLOW_CREEM_WRITE=true，避免向 Creem 写入测试商品"
      fi
    else
      record "TC-PAYCH-003" "连通性测试成功返回 HEALTHY" "EXTENDED" "FAIL" "扩展渠道创建失败 code=$(biz_code) msg=$(biz_msg)"
      record "TC-PROD-004" "从 Creem 批量同步商品" "EXTENDED" "SKIP" "扩展渠道创建失败"
      record "TC-PAYCH-005" "Sandbox 测试下单成功创建 Checkout" "EXTENDED" "SKIP" "扩展渠道创建失败"
      record "TC-PROD-001" "创建商品 SKU 成功" "EXTENDED" "SKIP" "扩展渠道创建失败"
    fi
  else
    record "TC-PAYCH-003" "连通性测试成功返回 HEALTHY" "EXTENDED" "SKIP" "未配置 CREEM_API_SECRET"
    record "TC-PAYCH-005" "Sandbox 测试下单成功创建 Checkout" "EXTENDED" "SKIP" "未配置 CREEM_API_SECRET"
    record "TC-PROD-004" "从 Creem 批量同步商品" "EXTENDED" "SKIP" "未配置 CREEM_API_SECRET"
    record "TC-PROD-001" "创建商品 SKU 成功" "EXTENDED" "SKIP" "未配置 CREEM_API_SECRET"
  fi

  if [[ -n "$RESEND_API_KEY" && -n "$RESEND_SENDER_EMAIL" && -n "$TEST_RECIPIENT_EMAIL" ]]; then
    call POST "/email-channels" "$(jq -n --arg n "[SMOKE-EXT] Resend ${RUN_TAG}" --arg k "$RESEND_API_KEY" --arg s "$RESEND_SENDER_EMAIL" --arg sn "$RESEND_SENDER_NAME" '{
      providerKey:"resend", name:$n, description:"smoke extended", mode:"live",
      senderEmail:$s, senderName:$sn, apiKey:$k, smtpHost:"smtp.resend.com", smtpPort:465, dailyQuota:50000
    }')"
    if [[ "$(biz_code)" == "0" ]]; then
      EXT_EMAIL_ID="$(data_get '.data.id')"
      call POST "/email-channels/${EXT_EMAIL_ID}/test" "$(jq -n --arg to "$TEST_RECIPIENT_EMAIL" '{recipient:$to}')"
      mid="$(data_get '.data.messageId // empty')"
      if [[ -n "$mid" ]]; then
        record "TC-ECH-005" "发送测试邮件成功（仅 Resend）" "EXTENDED" "PASS" "messageId=$mid"
      else
        record "TC-ECH-005" "发送测试邮件成功（仅 Resend）" "EXTENDED" "FAIL" "code=$(biz_code) msg=$(biz_msg)"
      fi
    else
      record "TC-ECH-005" "发送测试邮件成功（仅 Resend）" "EXTENDED" "FAIL" "扩展邮件渠道创建失败 code=$(biz_code) msg=$(biz_msg)"
    fi
  else
    record "TC-ECH-005" "发送测试邮件成功（仅 Resend）" "EXTENDED" "SKIP" "未完整配置 RESEND_API_KEY / RESEND_SENDER_EMAIL / TEST_RECIPIENT_EMAIL"
  fi
else
  log_info "未配置 CREEM_API_SECRET / RESEND_API_KEY，跳过 EXTENDED 层（文档中 Y* 用例将显示为未执行）"
fi

log_info "CORE 执行结束，FAIL=$FAIL_COUNT"
# 主动成功退出，交给 trap 清理+出报告
exit 0
