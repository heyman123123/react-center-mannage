# Ops 壳层 + 审计筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统参数/定时任务空数据真实 API + `#/scheduled_tasks/:id` 详情；审计操作类型走字典、操作人用户多选模糊筛选；不接 Worker。

**Architecture:** 改造 `backend/internal/ops`（空种子、runs 表、trigger 50100）；字典 seed `audit_action`；审计 List 支持 `actions`/`userIds`；前端 SystemConfig 路由分支 + AuditLogs 筛选下沉。

**Tech Stack:** Go/Gin/GORM/PG、React/Vite、现有 `MultiSelect`、i18n。

**Spec:** `docs/superpowers/specs/2026-09-14-ops-audit-shell-design.md`

## Global Constraints

- 不接入 `gocraft/work`；触发返回业务码 `50100`「定时任务执行器未启用」。
- 系统参数 / 定时任务 / runs **启动无种子数据**。
- UI 文案必须 i18n（`AGENTS.md`）。
- Cookie 会话；勿存 token。
- 仓库无 Go 单测：以 `make build` + curl/`tsc` 验收；未要求勿 git commit（计划中 Commit 步默认跳过，除非用户明确要求）。

---

## File map

| 文件 | 职责 |
|------|------|
| `backend/internal/infra/persistence/models.go` | `ScheduledTask` 加 `JobKey`；`NextRunAt` 可空；新增 `ScheduledTaskRun`；AutoMigrate |
| `backend/internal/pkg/apperr/apperr.go` | `ExecutorDisabled = New(50100, 200, "定时任务执行器未启用")`（或 HTTP 与现有 Fail 一致） |
| `backend/internal/ops/module.go` | 去种子；CRUD/详情/runs；trigger 返回 ExecutorDisabled；列表不含全量 logs |
| `backend/internal/infra/seed.go` 或 `dictionary` seed | 种子 `audit_action` 字典 |
| `backend/internal/audit/module.go` | List 支持 `actions`、`userIds` |
| `src/api/modules/iam.ts` | API 类型与函数对齐 |
| `src/components/SystemConfigView.tsx` | 空态；任务行跳转 hash；去掉嵌套假日志依赖 |
| `src/components/ScheduledTaskDetailView.tsx` | 新建：详情 + runs 分页 |
| `src/App.tsx` | 解析 `#/scheduled_tasks/:id` |
| `src/components/AuditLogsView.tsx` | 字典 + MultiSelect 用户；请求带 filters |
| `src/components/ui/MultiSelect.tsx` | 可选：面板内关键词过滤（模糊） |
| `src/locales/zh-CN/system.json` 等 | 空态/详情/未启用文案 |

---

### Task 1: Persistence + apperr

**Files:**
- Modify: `backend/internal/infra/persistence/models.go`
- Modify: `backend/internal/pkg/apperr/apperr.go`

**Interfaces:**
- Produces: `persistence.ScheduledTask`（含 `JobKey string`，`NextRunAt *time.Time`）；`persistence.ScheduledTaskRun`；`apperr.ExecutorDisabled`

- [ ] **Step 1: 更新模型**

在 `models.go` 将 `ScheduledTask` 改为：

```go
type ScheduledTask struct {
	ID            string     `gorm:"type:uuid;primaryKey" json:"id"`
	Name          string     `gorm:"size:128;not null" json:"name"`
	Type          string     `gorm:"size:64;not null" json:"type"`
	JobKey        string     `gorm:"size:128;index" json:"jobKey"`
	Cron          string     `gorm:"size:64;not null" json:"cron"`
	LastRunAt     *time.Time `json:"lastRunAt"`
	LastRunStatus string     `gorm:"size:16" json:"lastRunStatus"`
	NextRunAt     *time.Time `json:"nextRunAt"`
	Status        string     `gorm:"size:16;not null;default:DISABLED" json:"status"`
	LogsJSON      string     `gorm:"type:jsonb;not null;default:'[]'" json:"-"` // 遗留列，API 不再使用
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type ScheduledTaskRun struct {
	ID            string     `gorm:"type:uuid;primaryKey" json:"id"`
	TaskID        string     `gorm:"type:uuid;not null;index:idx_task_runs_started,priority:1" json:"taskId"`
	Status        string     `gorm:"size:16;not null" json:"status"`
	StartedAt     time.Time  `gorm:"index:idx_task_runs_started,priority:2" json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
	DurationMs    int        `json:"durationMs"`
	Summary       string     `gorm:"size:512" json:"summary"`
	DetailJSON    string     `gorm:"type:jsonb;not null;default:'{}'" json:"detailJson"`
	TriggerSource string     `gorm:"size:16;not null;default:MANUAL" json:"triggerSource"`
	CreatedAt     time.Time  `json:"createdAt"`
}
```

在 `AutoMigrate` 列表加入 `&ScheduledTaskRun{}`。

- [ ] **Step 2: 增加错误码**

```go
ExecutorDisabled = New(50100, 200, "定时任务执行器未启用")
```

（若 `response.Fail` 用 `e.HTTP` 写状态码，确认 200+body Fail 与现有客户端一致；否则用 `New(50100, 501, ...)` 并让前端按 code 识别。）

- [ ] **Step 3: 验收**

Run: `cd backend && make build`  
Expected: 成功。

---

### Task 2: 改造 ops 模块（空数据 + runs + trigger）

**Files:**
- Modify: `backend/internal/ops/module.go`（可整文件重写服务层，保持 FX Module 注册）

**Interfaces:**
- Consumes: `persistence.SystemConfig|ScheduledTask|ScheduledTaskRun`, `apperr.ExecutorDisabled`
- Produces:
  - `GET/POST /system-configs`, `PUT/DELETE /system-configs/:id`
  - `GET/POST /scheduled-tasks`, `GET /scheduled-tasks/:id`, `PUT /scheduled-tasks/:id/status`, `GET /scheduled-tasks/:id/runs`, `POST /scheduled-tasks/:id/trigger`
  - TaskDTO **无** `logs` 全量字段（或恒为 `[]`）；RunDTO 含 id/status/startedAt/finishedAt/durationMs/summary/triggerSource

- [ ] **Step 1: 删除 `seedOps` 中全部 Create 种子**；`fx.Invoke` 可删除 seed 调用，或留空函数。

- [ ] **Step 2: TaskDTO / RunDTO**

```go
type TaskDTO struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	JobKey        string `json:"jobKey"`
	Cron          string `json:"cron"`
	LastRunAt     string `json:"lastRunAt,omitempty"`
	LastRunStatus string `json:"lastRunStatus,omitempty"`
	NextRunAt     string `json:"nextRunAt,omitempty"`
	Status        string `json:"status"`
}

type RunDTO struct {
	ID            string `json:"id"`
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	StartedAt     string `json:"startedAt"`
	FinishedAt    string `json:"finishedAt,omitempty"`
	DurationMs    int    `json:"durationMs"`
	Summary       string `json:"summary"`
	TriggerSource string `json:"triggerSource"`
}
```

- [ ] **Step 3: 实现 CreateTask / GetTask / ListRuns**

`CreateTask(ctx, name, typ, cron, jobKey string) (*TaskDTO, error)`：默认 `Status=DISABLED`，`JobKey` 空则用 `typ`。  
`ListRuns(ctx, taskID string, page, pageSize int) ([]RunDTO, int64, error)`。  
`TriggerTask`：**直接** `return nil, apperr.ExecutorDisabled`（先校验任务存在，不存在则 NotFound）。

去掉 `math/rand` 假执行与 `LogsJSON` 解析路径。

- [ ] **Step 4: 注册路由**

```go
g.GET("/scheduled-tasks", ..., h.ListTasks)
g.POST("/scheduled-tasks", ..., h.CreateTask)
g.GET("/scheduled-tasks/:id", ..., h.GetTask)
g.PUT("/scheduled-tasks/:id/status", ..., h.UpdateTaskStatus)
g.GET("/scheduled-tasks/:id/runs", ..., h.ListRuns)
g.POST("/scheduled-tasks/:id/trigger", ..., h.TriggerTask)
```

- [ ] **Step 5: 验收**

```bash
cd backend && make build && make run   # 用户终端已有则重启
# 登录后：
curl -s -b cookies.txt 'http://127.0.0.1:8080/api/v1/system-configs' | jq .
# 期望 data: []
curl -s -b cookies.txt 'http://127.0.0.1:8080/api/v1/scheduled-tasks' | jq .
# 期望 data: []
```

---

### Task 3: 字典 seed `audit_action`

**Files:**
- Modify: `backend/internal/infra/seed.go`（或 `dictionary` 包内 seed，与现有 seed 风格一致）

**Interfaces:**
- Produces: `namespace=audit_action` 下若干 `DictionaryEntry`（仅当 count==0）

- [ ] **Step 1: 实现 `seedAuditActionDict(db *gorm.DB)`**

对每个 action 码写入：

```go
{Namespace: "audit_action", EntryKey: "AUTH_LOGIN", Category: "audit",
 Translations: `{"zh-CN":"登录"}`, Description: "用户登录"}
```

完整码表见 spec §3.4（含 SYSTEM_CONFIG_*、SCHEDULED_TASK_*）。

在 `seedDefaults` 中调用。

- [ ] **Step 2: 验收**

```bash
curl -s -b cookies.txt 'http://127.0.0.1:8080/api/v1/dictionary/entries?namespace=audit_action&pageSize=100' | jq '.data.items | length'
# 期望 > 20
```

---

### Task 4: 审计 List 多选筛选

**Files:**
- Modify: `backend/internal/audit/module.go`

**Interfaces:**
- Consumes: query `actions`（逗号分隔）、`userIds`（逗号分隔）
- Produces: `List(ctx, page, pageSize, keyword string, actions, userIds []string)`

- [ ] **Step 1: 改 Service.List**

```go
if len(actions) > 0 {
  q = q.Where("action IN ?", actions)
}
if len(userIds) > 0 {
  q = q.Where("user_id IN ?", userIds)
}
```

Handler 解析：

```go
actions := splitCSV(c.Query("actions"))
userIds := splitCSV(c.Query("userIds"))
// 兼容旧参数：
if a := c.Query("action"); a != "" && a != "ALL" { actions = append(actions, a) }
if op := c.Query("operator"); op != "" && op != "ALL" {
  // 兼容：按 user_name 精确匹配（旧前端）；新前端只用 userIds
  q = q.Where("user_name = ?", op) // 仅当 userIds 为空时
}
```

- [ ] **Step 2: make build 验收**

---

### Task 5: 前端 API 模块

**Files:**
- Modify: `src/api/modules/iam.ts`

- [ ] **Step 1: 更新类型与函数**

```ts
export interface ApiScheduledTask {
  id: string;
  name: string;
  type: string;
  jobKey?: string;
  cron: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  nextRunAt?: string;
  status: "ENABLED" | "DISABLED";
}

export interface ApiScheduledTaskRun {
  id: string;
  taskId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  durationMs: number;
  summary: string;
  triggerSource: string;
}

export const getScheduledTask = (id: string) =>
  http.get<ApiScheduledTask>(`/scheduled-tasks/${id}`);

export const listScheduledTaskRuns = (
  id: string,
  query?: { page?: number; pageSize?: number },
) => http.get<PageResult<ApiScheduledTaskRun>>(`/scheduled-tasks/${id}/runs`, query);

export const createScheduledTask = (body: {
  name: string; type: string; cron: string; jobKey?: string;
}) => http.post<ApiScheduledTask>("/scheduled-tasks", body);

export const listAuditLogs = (query?: {
  page?: number; pageSize?: number; keyword?: string;
  actions?: string; // comma-separated
  userIds?: string;
}) => http.get<PageResult<ApiAuditLog>>("/audit-logs", query);
```

去掉 Task 上强制 `logs` 字段。

- [ ] **Step 2: `npx tsc --noEmit`**（可能暂有 View 编译错误，Task 6–8 修完后必须绿）

---

### Task 6: MultiSelect 模糊过滤

**Files:**
- Modify: `src/components/ui/MultiSelect.tsx`
- Modify: `src/locales/zh-CN/shell.json`（若缺 search placeholder）

- [ ] **Step 1: 增加可选搜索**

Props 增加 `searchable?: boolean`。面板顶部 input，本地 `filter`：`label` 转字符串后 `includes` 关键词（忽略大小写）。

- [ ] **Step 2: 文案** `multiSelect.searchPlaceholder`: `"搜索…"`

---

### Task 7: AuditLogsView 筛选改造

**Files:**
- Modify: `src/components/AuditLogsView.tsx`
- Modify: `src/locales/zh-CN/system.json`（如需要）

**Interfaces:**
- Consumes: `listDictionaryEntries({ namespace: "audit_action", pageSize: 100 })`、`listUsers({ pageSize: 200 })`、`listAuditLogs({ actions, userIds, ... })`

- [ ] **Step 1: 加载选项**

```ts
const [actionOptions, setActionOptions] = useState<{value:string;label:string}[]>([]);
const [userOptions, setUserOptions] = useState<{value:string;label:string}[]>([]);
const [selectedActions, setSelectedActions] = useState<string[]>([]);
const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
```

USE_MOCK 时可用 mock 列表；真实环境拉 API。

- [ ] **Step 2: 筛选 UI**

操作类型、操作人各一个 `MultiSelect searchable`；变更后 `loadRows` 传：

```ts
actions: selectedActions.join(",") || undefined,
userIds: selectedUserIds.join(",") || undefined,
```

去掉从当前 `rows` 推导 operators/actions 的本地过滤。

- [ ] **Step 3: 表格展示** `actionLabel = map.get(l.action) ?? l.action`

---

### Task 8: SystemConfig + 任务详情路由

**Files:**
- Modify: `src/components/SystemConfigView.tsx`
- Create: `src/components/ScheduledTaskDetailView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/locales/zh-CN/system.json`、`src/locales/zh-CN/nav.json`（pageTitle）

- [ ] **Step 1: SystemConfigView**

- 任务列表行 `onClick` → `window.history` / 回调 `onOpenTask(id)` → `#/scheduled_tasks/${id}`
- 空态文案 i18n
- 触发若仍在列表菜单：调用 API，toast 展示后端 message（50100）
- `mapTask` 不再依赖 `logs`

- [ ] **Step 2: ScheduledTaskDetailView**

```tsx
export const ScheduledTaskDetailView: React.FC<{
  taskId: string;
  onBack: () => void;
}> = ...
```

加载 `getScheduledTask` + `listScheduledTaskRuns`；返回按钮 `onBack` → `#/system_config`（tasks tab 可用 hash `#/system_config?tab=tasks` 或 sessionStorage 记 tab）。

- [ ] **Step 3: App.tsx hash**

```ts
// 解析 scheduled_tasks/:id
const detailMatch = raw.match(/^scheduled_tasks\/([^/]+)$/);
if (detailMatch) { /* render ScheduledTaskDetailView */ }
```

权限：与 `system_config` 相同（`canAccessTab("system_config", ...)`）。

- [ ] **Step 4: 验收**

1. `#/system_config` 参数/任务均为空态，可建参数。  
2. （可选 curl POST 一条任务）点进详情，刷新 hash 仍在详情。  
3. 触发提示未启用。  
4. 审计筛选字典中文 + 用户多选。  
5. `make build` && `npx tsc --noEmit`。

---

## Spec coverage check

| Spec 项 | Task |
|---------|------|
| 空系统参数 CRUD | 1–2, 5, 8 |
| 空任务 + runs API | 1–2, 5, 8 |
| trigger 50100 | 1–2, 8 |
| `#/scheduled_tasks/:id` | 8 |
| audit_action 字典 | 3, 7 |
| 操作人模糊多选 | 6–7 |
| 筛选下沉后端 | 4, 7 |
| 不做 Worker | 全局 |

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-09-14-ops-audit-shell.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每 Task 新子代理，任务间复核  
2. **Inline Execution** — 本会话按 Task 连续实现  

Which approach?
