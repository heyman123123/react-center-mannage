# 系统参数 / 定时任务壳层 + 审计筛选 — 设计说明

> 日期：2026-09-14  
> 状态：待用户审阅  
> 方案：方案 1（先壳后 Worker）  
> 范围：后端 API + 前端联调；**不接入** `gocraft/work` Worker（后续再做）

---

## 1. 目标与非目标

### 1.1 目标

1. **系统参数**：真实 CRUD API；启动时**无种子数据**（空表）；前端可新建/编辑/删除。
2. **定时任务**：任务列表 + 详情（含执行日志分页）；数据初始为空；前端一页两 Tab，详情用独立 hash。
3. **审计日志筛选**：
   - 操作类型选项来自**字典**（后端 seed 配置）；
   - 操作人来自**用户列表**，支持**模糊搜索 + 多选**；
   - 列表筛选条件下沉到后端查询。

### 1.2 非目标（本期不做）

- 不引入 `gocraft/work` Enqueuer/Worker、不跑真实 cron。
- 不实现业务 Job（对账/结算/汇率等）。
- 不拆独立 `cmd/worker` 进程。
- 不改审计写入语义以外的 IAM/字典业务逻辑。

---

## 2. 架构概览

```
前端 SystemConfigView
  ├─ Tab 参数  → /api/v1/system-configs
  └─ Tab 任务  → /api/v1/scheduled-tasks
       └─ 点击行 → hash #/scheduled_tasks/:id
            → GET /scheduled-tasks/:id
            → GET /scheduled-tasks/:id/runs

前端 AuditLogsView
  ├─ 操作类型 ← 字典 namespace=audit_action
  ├─ 操作人   ← GET /users（模糊 + 多选）
  └─ 列表     ← GET /audit-logs?actions=&userIds=&keyword=&page=

后端 ops 模块（已有，改造）
  ├─ SystemConfig CRUD（去掉种子数据）
  ├─ ScheduledTask CRUD/启停
  ├─ ScheduledTaskRun 分页查询
  └─ Trigger：本期固定返回「未启用」(501 或业务码)，不写假随机成功

后端 dictionary / audit
  ├─ seed 字典 audit_action（与现有 WriteFromContext action 码对齐）
  └─ List 支持 actions[]、userIds[] 查询
```

---

## 3. 数据模型

### 3.1 `system_configs`（沿用）

字段保持现有：`id, key, value, description, category, remark, updated_by, timestamps`。  
**启动不插入任何行。** 删除 `ops.seedOps` 中对 config 的种子写入。

### 3.2 `scheduled_tasks`（沿用并收紧）

| 字段 | 说明 |
|------|------|
| id | UUID |
| name | 展示名 |
| type | 任务类型码（字符串，后续可再字典化） |
| job_key | Worker 注册名预留（如 `recon.daily`）；本期可空或等于 type |
| cron | cron 表达式 |
| status | `ENABLED` / `DISABLED` |
| last_run_at / last_run_status / next_run_at | 可空；无 Worker 时由手动/占位更新 |
| timestamps | |

**去掉**任务表内嵌 `logs_json` 作为主日志源（迁移：若已有列可保留但 API 不再依赖；新日志走 runs 表）。

启动**不插入**任何任务行。

### 3.3 `scheduled_task_runs`（新增）

| 字段 | 说明 |
|------|------|
| id | UUID |
| task_id | FK → scheduled_tasks |
| status | `RUNNING` / `SUCCESS` / `FAILED` |
| started_at / finished_at | |
| duration_ms | |
| summary | 短摘要 |
| detail_json | 可选，结构化结果/错误（本期可空对象） |
| trigger_source | `MANUAL` / `CRON` / `SYSTEM`（本期仅可能 MANUAL，且触发未启用） |

索引：`(task_id, started_at DESC)`。

### 3.4 字典 `audit_action`

- `namespace` = `audit_action`
- `entry_key` = 审计写入的 `action` 码（如 `AUTH_LOGIN`、`USER_CREATE`）
- `translations.zh-CN`（及必要语言）= 展示名（如「登录」）
- `category` = `audit`（便于字典页分组）

种子列表（与当前代码写入对齐，可增不可随意改码）：

`AUTH_LOGIN`, `AUTH_LOGOUT`,  
`USER_CREATE`, `USER_UPDATE`, `USER_DELETE`, `USER_RESET_PASSWORD`,  
`ROLE_CREATE`, `ROLE_UPDATE`, `ROLE_DELETE`, `ROLE_UPDATE_PERMISSIONS`,  
`MENU_REPLACE_TREE`, `MENU_CREATE`, `MENU_UPDATE`, `MENU_DELETE`,  
`DEPARTMENT_CREATE`, `DEPARTMENT_UPDATE`, `DEPARTMENT_DELETE`, `DEPARTMENT_TRANSFER`,  
`DICTIONARY_CREATE`, `DICTIONARY_UPDATE`, `DICTIONARY_DELETE`,  
`SYSTEM_CONFIG_CREATE`, `SYSTEM_CONFIG_UPDATE`, `SYSTEM_CONFIG_DELETE`,  
`SCHEDULED_TASK_STATUS`, `SCHEDULED_TASK_TRIGGER`

仅当该 namespace 下条目数为 0 时 seed，避免覆盖运维在字典页的修改。

---

## 4. API 契约

统一响应：现有 `ApiResponse` / `PageResult`。

### 4.1 系统参数

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/system-configs` | `category`, `keyword`；空数组合法 |
| POST | `/system-configs` | 创建 |
| PUT | `/system-configs/:id` | 更新 value/description/category/remark |
| DELETE | `/system-configs/:id` | 删除 |

权限菜单码：`system_config`。

### 4.2 定时任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/scheduled-tasks` | `keyword`；列表**不含**全量 logs |
| GET | `/scheduled-tasks/:id` | 详情（无 runs 或仅带最近一条摘要） |
| PUT | `/scheduled-tasks/:id/status` | `{ status: ENABLED\|DISABLED }` |
| GET | `/scheduled-tasks/:id/runs` | 分页：`page`, `pageSize`；按 `started_at DESC` |
| POST | `/scheduled-tasks/:id/trigger` | **本期**：统一业务错误（建议 `code=50100`，HTTP 200 包体 Fail 或 HTTP 501，与现有 `apperr` 风格二选一并写死为：**HTTP 200 + Fail，`code=50100`，message=`定时任务执行器未启用`**）；**不**写 run、不随机成功 |

可选（空数据阶段可后置）：`POST /scheduled-tasks` 创建任务定义，便于手工造数；若本期不做，前端仅展示空态 + 文案引导。

**本期决定**：提供最小 `POST /scheduled-tasks`（name/type/cron/job_key）与可选 DELETE，方便联调空壳；不强制 UI 暴露「新建任务」——UI 可先只有空态。

权限：与系统参数同菜单 `system_config`（未拆菜单）。

### 4.3 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/audit-logs` | 见下查询参数 |

查询参数：

| 参数 | 说明 |
|------|------|
| page / pageSize | 分页 |
| keyword | 模糊：details / target / action 等（保持现有语义，可收窄） |
| actions | 逗号分隔或多个同名 query：操作类型码多选；空=全部 |
| userIds | 逗号分隔：操作人用户 ID 多选；空=全部 |
| ~~action~~ / ~~operator~~ | 废弃单值筛选项；兼容期内若传入单值可映射为单元素 actions/userIds |

列表项仍返回 `action`（码）+ `userId` / `userName`（operator）；前端用字典把 `action` 译成展示名。

### 4.4 筛选数据源（复用）

- 操作类型：`GET /dictionary/entries?namespace=audit_action`（或现有字典 list API 等价参数）
- 操作人：`GET /users`（已有用户列表）；前端本地模糊过滤 name/email，多选；请求审计时传选中 `userIds`

不新增专用 `/audit-logs/operators` 接口，避免与用户主数据双源。

---

## 5. 前端行为

### 5.1 系统参数与定时任务页

- 路由：`#/system_config`（保持现有 `routeKey`）
- Tab：`params` | `tasks`（可用 query 或内部 state；进入详情前记住 Tab）
- 参数 Tab：拉真实 API；空态 + 新建
- 任务 Tab：列表；行点击 → `navigate` 到 `#/scheduled_tasks/:id`
- 详情页（可同文件路由分支或独立 View）：
  - 展示任务元数据
  - 分页加载 runs
  - 「手动触发」按钮：调用 trigger，展示后端「未启用」提示（toast）
  - 返回：回到 `#/system_config` 并恢复 tasks Tab

Hash 解析：App 层扩展 `VALID_TABS` / `tabFromHash`，支持 `scheduled_tasks/:id` 形态（或独立解析函数），无权限则回退首个可访问页。

### 5.2 审计页

- 操作类型：`ShadcnSelect` 或多选组件，选项 = 字典 `audit_action`（label=翻译，value=entry_key）
- 操作人：可搜索多选（用户 id 为 value，展示 name/email）；选项来自用户列表 API/壳层已加载 users
- 筛选变更 → 带 `actions`/`userIds` 重新请求后端分页（**不再**仅前端从当前页过滤操作人/类型）
- 表格「操作类型」列展示字典译名，缺字典时回退显示原始 action 码

### 5.3 i18n

所有新增壳层文案走 `src/locales/zh-CN/`（空态、未启用触发、详情返回等）。

---

## 6. 错误与空态

| 场景 | 行为 |
|------|------|
| 参数/任务列表为空 | 前端空态，不报错 |
| 任务详情 id 不存在 | 404 → toast + 回列表 |
| 触发未启用 | 明确错误码/文案，不静默失败 |
| 字典未加载到某 action | 展示原始码 |
| 用户列表为空 | 操作人筛选为空多选，不影响列表（不筛 userIds） |

---

## 7. 测试与验收

1. 新库启动：`system_configs` / `scheduled_tasks` / `scheduled_task_runs` 均为空；字典含 `audit_action` 种子。
2. 可创建系统参数并刷新仍在。
3. `#/system_config` → 任务 Tab →（若手工插入或 POST 创建一条）点进 `#/scheduled_tasks/:id`，刷新仍在详情；返回回 Tab。
4. 触发按钮提示未启用。
5. 审计页：操作类型为中文（字典）；操作人可搜可多选；筛选结果与后端一致。
6. `npx tsc --noEmit`、`make build` 通过。

---

## 8. 后续（不在本期）

- 接入 `gocraft/work`：按 `job_key` 注册 handler，cron 调度，写 `scheduled_task_runs`
- 可选独立 `cmd/worker`
- 任务类型字典化、菜单拆分为独立「定时任务」项

---

## 9. 决策记录

| 决策 | 选择 |
|------|------|
| Worker | 本期不做；库选型预留 gocraft/work |
| 初始数据 | 参数/任务/runs 全空 |
| 任务 UI | 一页两 Tab + `#/scheduled_tasks/:id` |
| 操作类型 | 字典 `audit_action` |
| 操作人 | 用户列表，模糊 + 多选，按 userId 筛 |
| 触发 | 明确未启用，不写假日志 |
