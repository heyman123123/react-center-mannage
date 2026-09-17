#!/usr/bin/env bash
#
# NovasPay 管理端 —— 支付渠道 (Creem) + 邮件渠道 (Resend) 端到端自动化测试脚本
#
# 用途：使用你已经准备好的 Creem 沙箱账号 / API Secret 和 Resend 账号 / API Key，
#       对管理端后端 API 跑一遍完整的渠道接入 -> 连通性测试 -> 商品同步 -> Sandbox 下单
#       -> 邮件渠道接入 -> 发测试信 全链路自动化冒烟测试。
#
# 用法：
#   1) 复制 e2e_channel_email_test.env.example 为 e2e_channel_email_test.env 并填好真实凭据
#   2) ./e2e_channel_email_test.sh e2e_channel_email_test.env
#      或者直接用环境变量：CREEM_API_SECRET=xxx RESEND_API_KEY=xxx ... ./e2e_channel_email_test.sh
#
# 依赖：bash 4+, curl, jq
#
# 退出码：0 = 全部关键步骤通过；1 = 存在失败的关键步骤（非关键步骤失败仅告警，不影响退出码）

set -uo pipefail

# ------------------------------------------------------------------------------------
# 0. 加载配置
# ------------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,20p' "${BASH_SOURCE[0]}"
  exit 0
fi

if [[ -n "${1:-}" && -f "${1:-}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$1"
  set +a
  echo "已加载配置文件: $1"
fi

# 根地址（不含 /api/v1），例如 http://localhost:8080
ROOT_URL="${ROOT_URL:-http://localhost:8080}"
API_BASE="${ROOT_URL%/}/api/v1"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novaspay.global}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123456}"

CREEM_MODE="${CREEM_MODE:-sandbox}"
CREEM_API_SECRET="${CREEM_API_SECRET:-}"
CREEM_WEBHOOK_SECRET="${CREEM_WEBHOOK_SECRET:-}"
CREEM_PRODUCT_ID="${CREEM_PRODUCT_ID:-}"
CREEM_CUSTOMER_EMAIL="${CREEM_CUSTOMER_EMAIL:-tester@novaspay.global}"

EMAIL_MODE="${EMAIL_MODE:-live}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
RESEND_SENDER_EMAIL="${RESEND_SENDER_EMAIL:-}"
RESEND_SENDER_NAME="${RESEND_SENDER_NAME:-Novas Notifications}"
TEST_RECIPIENT_EMAIL="${TEST_RECIPIENT_EMAIL:-}"

CLEANUP="${CLEANUP:-true}"
KEEP_ON_FAILURE="${KEEP_ON_FAILURE:-true}"

RUN_TAG="$(date +%Y%m%d%H%M%S)"

# ------------------------------------------------------------------------------------
# 1. 工具函数
# ------------------------------------------------------------------------------------

COLOR_RED=$'\033[0;31m'; COLOR_GREEN=$'\033[0;32m'; COLOR_YELLOW=$'\033[0;33m'
COLOR_BLUE=$'\033[0;34m'; COLOR_RESET=$'\033[0m'

log_info()  { echo "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"; }
log_pass()  { echo "${COLOR_GREEN}[PASS]${COLOR_RESET} $*"; }
log_fail()  { echo "${COLOR_RED}[FAIL]${COLOR_RESET} $*"; }
log_warn()  { echo "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"; }

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "缺少依赖命令: $bin，请先安装后再运行本脚本。" >&2
    exit 2
  fi
done

MISSING_ENV=()
[[ -z "$CREEM_API_SECRET" ]] && MISSING_ENV+=("CREEM_API_SECRET")
[[ -z "$RESEND_API_KEY" ]] && MISSING_ENV+=("RESEND_API_KEY")
[[ -z "$RESEND_SENDER_EMAIL" ]] && MISSING_ENV+=("RESEND_SENDER_EMAIL")
[[ -z "$TEST_RECIPIENT_EMAIL" ]] && MISSING_ENV+=("TEST_RECIPIENT_EMAIL")
if [[ ${#MISSING_ENV[@]} -gt 0 ]]; then
  echo "缺少必填配置项: ${MISSING_ENV[*]}" >&2
  echo "请参考 e2e_channel_email_test.env.example 补齐后再运行。" >&2
  exit 2
fi

COOKIE_JAR="$(mktemp)"
CHANNEL_ID=""
EMAIL_CHANNEL_ID=""
FAILED_STEPS=0
declare -a STEP_NAMES=()
declare -a STEP_RESULTS=()

# 注意：清理（DELETE 渠道）与登出都放在这个 EXIT trap 里，且严格保证
# “先清理、后登出”，否则登出会让 Cookie 会话失效，导致清理请求 401。
cleanup_and_exit() {
  local exit_code=$?
  if [[ "$CLEANUP" == "true" ]]; then
    if [[ "$FAILED_STEPS" -gt 0 && "$KEEP_ON_FAILURE" == "true" ]]; then
      log_warn "存在失败步骤且 KEEP_ON_FAILURE=true，跳过清理，便于排查现场：channelId=$CHANNEL_ID emailChannelId=$EMAIL_CHANNEL_ID"
    else
      [[ -n "$CHANNEL_ID" ]] && { call DELETE "/payment-channels/$CHANNEL_ID"; log_info "已清理测试支付渠道 $CHANNEL_ID"; }
      [[ -n "$EMAIL_CHANNEL_ID" ]] && { call DELETE "/email-channels/$EMAIL_CHANNEL_ID"; log_info "已清理测试邮件渠道 $EMAIL_CHANNEL_ID"; }
    fi
  fi
  call POST "/auth/logout"
  rm -f "$COOKIE_JAR"
  exit "$exit_code"
}
trap cleanup_and_exit EXIT INT TERM

# call METHOD PATH [JSON_BODY]
# 结果写入全局变量 HTTP_CODE / RESP_BODY
call() {
  local method="$1" path="$2" data="${3:-}"
  local url="${API_BASE}${path}"
  local raw
  if [[ -n "$data" ]]; then
    raw="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X "$method" "$url" \
      -H "Content-Type: application/json" --data "$data" -w $'\n%{http_code}')"
  else
    raw="$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X "$method" "$url" -w $'\n%{http_code}')"
  fi
  HTTP_CODE="$(echo "$raw" | tail -n1)"
  RESP_BODY="$(echo "$raw" | sed '$d')"
}

# step NAME REQUIRED(true|false) -- 记录结果并在必要时终止脚本
record_step() {
  local name="$1" ok="$2" required="$3" detail="${4:-}"
  STEP_NAMES+=("$name")
  if [[ "$ok" == "true" ]]; then
    STEP_RESULTS+=("PASS")
    log_pass "$name ${detail:+- $detail}"
  else
    STEP_RESULTS+=("FAIL")
    FAILED_STEPS=$((FAILED_STEPS + 1))
    log_fail "$name ${detail:+- $detail}"
    if [[ "$required" == "true" ]]; then
      log_fail "关键步骤失败，终止后续测试。"
      print_summary
      exit 1
    fi
  fi
}

print_summary() {
  echo
  echo "==================== 测试结果汇总 ===================="
  local i
  for i in "${!STEP_NAMES[@]}"; do
    printf "  [%s] %s\n" "${STEP_RESULTS[$i]}" "${STEP_NAMES[$i]}"
  done
  echo "========================================================"
  if [[ "$FAILED_STEPS" -eq 0 ]]; then
    log_pass "全部步骤通过 (channelId=$CHANNEL_ID, emailChannelId=$EMAIL_CHANNEL_ID)"
  else
    log_fail "共有 $FAILED_STEPS 个步骤失败"
  fi
}

# ------------------------------------------------------------------------------------
# 2. 健康检查
# ------------------------------------------------------------------------------------

log_info "目标环境: $ROOT_URL"

healthz_code="$(curl -sS -o /dev/null -w '%{http_code}' "${ROOT_URL%/}/healthz" || true)"
record_step "健康检查 /healthz" "$([[ "$healthz_code" == "200" ]] && echo true || echo false)" "true" "http=$healthz_code"

readyz_code="$(curl -sS -o /dev/null -w '%{http_code}' "${ROOT_URL%/}/readyz" || true)"
record_step "就绪检查 /readyz (PG/Redis)" "$([[ "$readyz_code" == "200" ]] && echo true || echo false)" "true" "http=$readyz_code"

# ------------------------------------------------------------------------------------
# 3. 登录
# ------------------------------------------------------------------------------------

call POST "/auth/login" "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')"
login_ok="false"
if [[ "$HTTP_CODE" == "200" && "$(echo "$RESP_BODY" | jq -r '.code')" == "0" ]]; then
  login_ok="true"
fi
record_step "管理员登录 ($ADMIN_EMAIL)" "$login_ok" "true" "http=$HTTP_CODE"

call GET "/me"
record_step "会话校验 GET /me" "$([[ "$(echo "$RESP_BODY" | jq -r '.code')" == "0" ]] && echo true || echo false)" "true" \
  "user=$(echo "$RESP_BODY" | jq -r '.data.name // .data.email // "?"')"

# ------------------------------------------------------------------------------------
# 4. 创建 / 测试 Creem 支付渠道
# ------------------------------------------------------------------------------------

CHANNEL_NAME="[E2E测试] Creem ${CREEM_MODE} ${RUN_TAG}"
create_channel_body="$(jq -n \
  --arg name "$CHANNEL_NAME" \
  --arg mode "$CREEM_MODE" \
  --arg secret "$CREEM_API_SECRET" \
  --arg wh "$CREEM_WEBHOOK_SECRET" \
  '{
    channelKey: "creem",
    name: $name,
    accountName: "E2E 自动化测试",
    description: "由 e2e_channel_email_test.sh 自动创建",
    mode: $mode,
    apiSecretKey: $secret,
    webhookSecret: $wh,
    supportedCurrencies: ["USD"],
    feeRateText: "automated-test",
    routingPriority: 99
  }')"
call POST "/payment-channels" "$create_channel_body"
create_ok="false"
if [[ "$(echo "$RESP_BODY" | jq -r '.code')" == "0" ]]; then
  CHANNEL_ID="$(echo "$RESP_BODY" | jq -r '.data.id')"
  [[ -n "$CHANNEL_ID" && "$CHANNEL_ID" != "null" ]] && create_ok="true"
fi
record_step "创建 Creem 支付渠道" "$create_ok" "true" "channelId=$CHANNEL_ID"

call POST "/payment-channels/$CHANNEL_ID/test"
test_status="$(echo "$RESP_BODY" | jq -r '.data.testStatus // "UNKNOWN"')"
latency="$(echo "$RESP_BODY" | jq -r '.data.latencyMs // "?"')"
record_step "Creem 渠道连通性测试" "$([[ "$test_status" == "HEALTHY" ]] && echo true || echo false)" "false" \
  "testStatus=$test_status latency=${latency}ms"

call POST "/products/sync-from-creem?channelId=$CHANNEL_ID"
sync_ok="$([[ "$(echo "$RESP_BODY" | jq -r '.code')" == "0" ]] && echo true || echo false)"
record_step "从 Creem 同步商品" "$sync_ok" "false" \
  "$(echo "$RESP_BODY" | jq -r 'if .data then "created=\(.data.created) updated=\(.data.updated) total=\(.data.total)" else .message end')"

if [[ -z "$CREEM_PRODUCT_ID" ]]; then
  call GET "/products?channelId=$CHANNEL_ID"
  CREEM_PRODUCT_ID="$(echo "$RESP_BODY" | jq -r '.data[0].externalProductId // empty')"
  [[ -n "$CREEM_PRODUCT_ID" ]] && log_info "自动选用同步到的商品 externalProductId=$CREEM_PRODUCT_ID 作为 Sandbox 下单测试对象"
fi

if [[ -n "$CREEM_PRODUCT_ID" ]]; then
  checkout_body="$(jq -n --arg pid "$CREEM_PRODUCT_ID" --arg email "$CREEM_CUSTOMER_EMAIL" '{productId:$pid, customerEmail:$email}')"
  call POST "/payment-channels/$CHANNEL_ID/checkout-test" "$checkout_body"
  checkout_url="$(echo "$RESP_BODY" | jq -r '.data.checkoutUrl // empty')"
  record_step "Creem Sandbox 测试下单 (checkout-test)" "$([[ -n "$checkout_url" ]] && echo true || echo false)" "false" \
    "${checkout_url:-$(echo "$RESP_BODY" | jq -r '.message')}"
else
  log_warn "未提供 CREEM_PRODUCT_ID 且未能从 Creem 同步到任何商品，跳过 Sandbox 测试下单步骤"
fi

# ------------------------------------------------------------------------------------
# 5. 创建 / 测试 Resend 邮件渠道
# ------------------------------------------------------------------------------------

EMAIL_CHANNEL_NAME="[E2E测试] Resend ${RUN_TAG}"
create_email_body="$(jq -n \
  --arg name "$EMAIL_CHANNEL_NAME" \
  --arg mode "$EMAIL_MODE" \
  --arg sender "$RESEND_SENDER_EMAIL" \
  --arg senderName "$RESEND_SENDER_NAME" \
  --arg key "$RESEND_API_KEY" \
  '{
    providerKey: "resend",
    name: $name,
    description: "由 e2e_channel_email_test.sh 自动创建",
    mode: $mode,
    senderEmail: $sender,
    senderName: $senderName,
    apiKey: $key,
    smtpHost: "smtp.resend.com",
    smtpPort: 465,
    dailyQuota: 50000
  }')"
call POST "/email-channels" "$create_email_body"
create_email_ok="false"
if [[ "$(echo "$RESP_BODY" | jq -r '.code')" == "0" ]]; then
  EMAIL_CHANNEL_ID="$(echo "$RESP_BODY" | jq -r '.data.id')"
  [[ -n "$EMAIL_CHANNEL_ID" && "$EMAIL_CHANNEL_ID" != "null" ]] && create_email_ok="true"
fi
record_step "创建 Resend 邮件渠道" "$create_email_ok" "true" "emailChannelId=$EMAIL_CHANNEL_ID"

call POST "/email-channels/$EMAIL_CHANNEL_ID/test" "$(jq -n --arg to "$TEST_RECIPIENT_EMAIL" '{recipient:$to}')"
message_id="$(echo "$RESP_BODY" | jq -r '.data.messageId // empty')"
record_step "发送 Resend 测试邮件至 $TEST_RECIPIENT_EMAIL" "$([[ -n "$message_id" ]] && echo true || echo false)" "false" \
  "${message_id:+messageId=$message_id}${message_id:-$(echo "$RESP_BODY" | jq -r '.message')}"

# ------------------------------------------------------------------------------------
# 6. 附加只读检查（不影响通过/失败判定）
# ------------------------------------------------------------------------------------

call GET "/payment-webhooks?page=1&pageSize=5&channelId=$CHANNEL_ID"
log_info "支付 Webhook 日志条数(近5条): $(echo "$RESP_BODY" | jq -r '.data.total // 0')"

call GET "/email-webhooks?page=1&pageSize=5"
log_info "邮件投递回执条数(近5条): $(echo "$RESP_BODY" | jq -r '.data.total // 0')"

# 注：登出与清理统一在脚本退出时的 cleanup_and_exit 中处理（见文件顶部 trap 注册）。

# ------------------------------------------------------------------------------------
# 7. 汇总
# ------------------------------------------------------------------------------------

print_summary
[[ "$FAILED_STEPS" -eq 0 ]]
