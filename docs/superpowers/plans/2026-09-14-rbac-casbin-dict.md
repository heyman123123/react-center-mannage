# RBAC 权限包 + Casbin + 字典树 + 权限 HOC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 权限包管菜单树、角色多选权限包+应用范围；Casbin 裁决；字典分类树（后端字典根）；前端 `withPermission` HOC。

**Architecture:** 业务表 CRUD → Sync 写入 Casbin；`RequireMenu`/`/me.menuKeys` 走 Enforce；前端消费 `menuKeys`，共用 `AppScopeMultiSelect`。

**Tech Stack:** Go/Gin/GORM/PG、casbin/v2 + gorm-adapter/v3、React/Vite、i18n、现有 MultiSelect/SideSheet。

**Spec:** `docs/superpowers/specs/2026-09-14-rbac-casbin-dict-design.md`

## Global Constraints

- UI 文案必须 i18n（`AGENTS.md`）；禁止硬编码中英文壳层文案。
- Cookie 会话；勿存 token；`credentials: 'include'`。
- Casbin：**领域表 + Sync**；不把 `casbin_rule` 当管理 UI 真相源。
- 菜单挂**权限包**；应用范围挂**角色**；`SUPER_ADMIN` 中间件短路放行。
- 系统字典根 `key=backend` 不可删、可改名；系统分类下词条不可删。
- 禁止 `window.prompt` / `alert` 做字典分类增改。
- 仓库无 Go 单测：以 `cd backend && make build` + curl、前端 `npx tsc --noEmit` 验收。
- **未要求勿 git commit**（计划中 Commit 步默认跳过，除非用户明确要求）。

---

## File map

| 文件 | 职责 |
|------|------|
| `backend/internal/infra/persistence/models.go` | `PermissionPack`、`PermissionPackMenu`、`RolePack`、`RoleApp`、`DictionaryCategory`；`DictionaryEntry.CategoryID` |
| `backend/internal/platform/sys/casbin/*` | Model、Enforcer、SyncAll/SyncUser/SyncRole/SyncPack |
| `backend/internal/platform/sys/service/pack.go` | 权限包 CRUD + 绑菜单 |
| `backend/internal/platform/sys/handler/pack.go` | HTTP |
| `backend/internal/platform/sys/service/role.go` | `packIds`/`appIds`；停写 `RoleMenu` |
| `backend/internal/platform/sys/service/auth.go` | `menuKeys` 来自 Casbin |
| `backend/internal/middleware/middleware.go` | `RequireMenu` → Enforce；SUPER_ADMIN 短路 |
| `backend/migrations/seed.go` + SQL | 菜单 `permission_packs`；字典根；role→pack 迁移 |
| `backend/internal/platform/dictionary/*` | 分类树 API；系统保护 |
| `src/components/AppScopeMultiSelect.tsx` | 共用应用多选 |
| `src/components/PermissionPacksView.tsx` | 权限包页 |
| `src/components/PermissionsView.tsx` / `RolesView.tsx` | 角色页：包多选+应用范围 |
| `src/lib/permission.tsx` | `usePermission` / `withPermission` / `PermissionGate` |
| `src/lib/menuAccess.ts` | 优先 `menuKeys` |
| `src/locales/zh-CN/rbac.json` 等 | 文案 |
| `src/api/modules/iam.ts` | API 类型 |

---

### Task 1: Persistence 模型

**Files:**
- Modify: `backend/internal/infra/persistence/models.go`

**Interfaces:**
- Produces: `PermissionPack`, `PermissionPackMenu`, `RolePack`, `RoleApp`, `DictionaryCategory`；`DictionaryEntry.CategoryID *string`

- [ ] **Step 1: 在 `models.go` 增加类型并挂入 AutoMigrate**

```go
type PermissionPack struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string         `gorm:"size:64;uniqueIndex;not null" json:"key"`
	Name        string         `gorm:"size:128;not null" json:"name"`
	Description string         `gorm:"size:512" json:"description"`
	CreatedAt   int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type PermissionPackMenu struct {
	PackID string `gorm:"type:uuid;primaryKey"`
	MenuID string `gorm:"type:uuid;primaryKey"`
}

type RolePack struct {
	RoleID string `gorm:"type:uuid;primaryKey"`
	PackID string `gorm:"type:uuid;primaryKey"`
}

type RoleApp struct {
	RoleID string `gorm:"type:uuid;primaryKey"`
	AppID  string `gorm:"size:64;primaryKey"` // UUID 或 "ALL"
}

type DictionaryCategory struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID  *string        `gorm:"type:uuid;index" json:"parentId"`
	Key       string         `gorm:"size:64;uniqueIndex;not null" json:"key"`
	Name      string         `gorm:"size:128;not null" json:"name"`
	IsSystem  bool           `gorm:"not null;default:false" json:"isSystem"`
	SortOrder int            `gorm:"not null;default:1" json:"sortOrder"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
```

在 `DictionaryEntry` 增加：

```go
CategoryID *string `gorm:"type:uuid;index" json:"categoryId"`
```

`AutoMigrate` 列表追加：`&PermissionPack{}`, `&PermissionPackMenu{}`, `&RolePack{}`, `&RoleApp{}`, `&DictionaryCategory{}`。保留 `RoleMenu` 表本任务不删。

- [ ] **Step 2: 编译**

Run: `cd backend && make build`  
Expected: 成功

- [ ] **Step 3: Commit**（默认跳过）

---

### Task 2: Casbin Enforcer + Sync

**Files:**
- Create: `backend/internal/platform/sys/casbin/model.go`
- Create: `backend/internal/platform/sys/casbin/enforcer.go`
- Create: `backend/internal/platform/sys/casbin/sync.go`
- Modify: `backend/go.mod`（`go get github.com/casbin/casbin/v2 github.com/casbin/gorm-adapter/v3`）
- Modify: `backend/internal/platform/sys/module.go`（Provide Enforcer、启动 SyncAll）

**Interfaces:**
- Produces:
  - `casbinx.NewEnforcer(db *gorm.DB) (*casbin.Enforcer, error)`
  - `type Syncer struct{ DB *gorm.DB; E *casbin.Enforcer }`
  - `func (s *Syncer) SyncAll(ctx context.Context) error`
  - `func (s *Syncer) SyncUser(ctx context.Context, userID string) error`
  - `func (s *Syncer) SyncRole(ctx context.Context, roleKey string) error`
  - `func (s *Syncer) SyncPack(ctx context.Context, packKey string) error`
- Subject/object 前缀：`user:` / `role:` / `pack:` / `menu:` / `app:`；act 固定 `"access"`

- [ ] **Step 1: 安装依赖**

```bash
cd backend && go get github.com/casbin/casbin/v2@v2.103.0 github.com/casbin/gorm-adapter/v3@v3.32.0 && go mod tidy
```

- [ ] **Step 2: 写入 model 文本**

`model.go` 返回与规格 §3.2 一致的 conf 字符串（含 `keyMatch` 对 `app:ALL`）。

- [ ] **Step 3: NewEnforcer**

```go
a, err := gormadapter.NewAdapterByDB(db)
e, err := casbin.NewEnforcer(casbin.NewModel(modelText), a)
// LoadPolicy 已由 NewEnforcer 触发
```

包名可用 `casbinx` 避免与库冲突：`package casbinx`，目录仍为 `sys/casbin`。

- [ ] **Step 4: SyncAll 逻辑（先全量清策略再重建）**

伪代码必须落实为真实代码：

1. `e.ClearPolicy()` + `e.SavePolicy()` 或按 adapter 删除 `casbin_rule` 后重建。
2. 对每个 `PermissionPack`：查 menus → `p, pack:<key>, menu:<menu.Key>, access`。
3. 对每个 `Role`：`g, role:<key>, pack:<packKey>`；`p, role:<key>, app:<id>|app:ALL, access`（无 `role_apps` 行时默认 `app:ALL`）。
4. 对每个 User：个人 `UserRole` ∪ 部门 `DepartmentRole` → `g, user:<id>, role:<key>`。

- [ ] **Step 5: FX 注册**

在 `sys.Module`：`fx.Provide(casbinx.NewEnforcer, NewSyncer)`；`fx.Invoke` 启动时 `SyncAll`，失败则返回 error 阻止启动。

- [ ] **Step 6: 编译**

Run: `cd backend && make build`  
Expected: 成功（空表 SyncAll 也应成功）

- [ ] **Step 7: Commit**（默认跳过）

---

### Task 3: 权限包 API

**Files:**
- Create: `backend/internal/platform/sys/service/pack.go`
- Create: `backend/internal/platform/sys/handler/pack.go`
- Modify: `backend/internal/platform/sys/module.go`

**Interfaces:**
- Produces:
  - `PackDTO{ ID, Key, Name, Description, MenuIDs []string, CreatedAt }`
  - `List/Create/Update/Delete/ReplaceMenus`
  - Routes under `/api/v1`：`GET|POST /permission-packs`，`PUT|DELETE /permission-packs/:id`，`PUT /permission-packs/:id/menus`，均 `RequireMenu("permission_packs")`（若种子暂用 `permissions`，则与种子 key 保持一致，见 Task 6）
- Consumes: `*casbinx.Syncer`（写后 `SyncPack` 或 `SyncAll`）

- [ ] **Step 1: 实现 PackService**

- Create：校验 `key` 大写唯一；`ReplaceMenus` 事务替换 `permission_pack_menus`。
- Delete：若 `role_packs` 仍引用 → `apperr.New(40910, 409, "权限包仍被角色引用")`。

- [ ] **Step 2: Handler + 路由注册**（仿 `handler/role.go` / `NewSysRoute` 风格）

- [ ] **Step 3: 写后 Sync**

`ReplaceMenus` / Create / Update / Delete 成功后调用 `syncer.SyncPack` 或 `SyncAll`。

- [ ] **Step 4: 编译 + 手动 curl（需登录 Cookie）**

```bash
# 登录后
curl -s -b cookies.txt http://127.0.0.1:8080/api/v1/permission-packs -H 'X-App-Env: live'
```

Expected: `code=0` 空列表或已有数据

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 4: 角色 API 改为 packIds + appIds

**Files:**
- Modify: `backend/internal/platform/sys/service/role.go`
- Modify: `backend/internal/platform/sys/handler/role.go`

**Interfaces:**
- Change `RoleDTO`：`MenuIDs` → `PackIDs []string` + `AppIDs []string`
- `UpdatePermissions(ctx, id, packIDs, appIDs)`；Create 不再收 `menuIds`
- 写 `role_packs` / `role_apps`；**不再写入** `role_menus`
- 成功后 `syncer.SyncRole`

- [ ] **Step 1: 改 RoleDTO 与 toDTO**

加载 `RolePack` → pack uuid 列表；`RoleApp` → app id 列表（无行则返回 `["ALL"]`）。

- [ ] **Step 2: 改 Create / UpdatePermissions / Delete**

Delete 时清 `role_packs`、`role_apps`（及遗留 `role_menus`）。

- [ ] **Step 3: Handler JSON**

```go
PackIDs []string `json:"packIds"`
AppIDs  []string `json:"appIds"`
```

- [ ] **Step 4: make build**

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 5: RequireMenu + /me 接 Casbin

**Files:**
- Modify: `backend/internal/middleware/middleware.go`
- Modify: `backend/internal/platform/sys/service/auth.go`
- Modify: `backend/internal/platform/sys/module.go`（wire Enforcer 到 Bundle）

**Interfaces:**
- `Bundle` 增加 `enforcer *casbin.Enforcer` 与可选 `roleChecker`（查用户是否 SUPER_ADMIN）
- `RequireMenu(menuKey)`：取 `CtxUserID`；若用户任一 roleKey == `SUPER_ADMIN` → Next；否则 `e.Enforce("user:"+uid, "menu:"+menuKey, "access")`，失败 `apperr.Forbidden`
- `AuthService.effectivePerms`：roleKeys 仍从 DB 聚合；menuKeys 改为 Casbin 隐式权限过滤 `menu:` 前缀（SUPER_ADMIN 仍返回全量 menu key）

- [ ] **Step 1: 扩展 Bundle**

```go
func (b *Bundle) SetEnforcer(e *casbin.Enforcer) { b.enforcer = e }
func (b *Bundle) SetSuperAdminChecker(fn func(userID string) bool) { ... }
```

在 `wireSession` 旁增加 wire Enforcer / checker（查 `user_roles` + 部门角色是否含 SUPER_ADMIN）。

- [ ] **Step 2: 实现真正的 RequireMenu**

无 enforcer 时拒绝（fail-closed），避免误放行。

- [ ] **Step 3: 改 effectivePerms 读 Casbin**

```go
perms, _ := s.enforcer.GetImplicitPermissionsForUser("user:" + userID)
for _, p := range perms {
  if strings.HasPrefix(p[1], "menu:") {
    menuKeys = append(menuKeys, strings.TrimPrefix(p[1], "menu:"))
  }
}
```

- [ ] **Step 4: 启动 API，登录 admin，请求需菜单权限的接口**

Expected: admin（SUPER_ADMIN）通过；无权限用户 403

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 6: Seed / 迁移 — 角色菜单 → 权限包 + 菜单项

**Files:**
- Modify: `backend/migrations/seed.go`
- Create: `backend/migrations/004_migrate_role_menus_to_packs.go`（或在 seed 内幂等函数）
- Modify: `backend/migrations/002_seed_menus.sql` / seed 菜单定义

**Interfaces:**
- 菜单：将现有 `permissions` 标题改为「权限管理」且 **key 改为 `permission_packs`**（或保留 key=`permissions` 并在全站 RequireMenu/前端统一用 `permissions`——**本计划固定：菜单 key = `permission_packs`，路由 `#/permission_packs`**；同步改 `RequireMenu` 与前端 tab）
- `roles` 保持「角色管理」
- 启动迁移：对每个 Role，若无对应 pack，创建 `PermissionPack{Key: "PACK_"+role.Key, Name: role.Name+"权限包"}`，复制 `role_menus` → `permission_pack_menus`，插入 `role_packs`，`role_apps` 默认 `ALL`
- 字典：插入 `DictionaryCategory{Key:"backend", Name:"后端字典", IsSystem:true}`；子分类 `audit_action`（或把 `audit_action` 词条 `category_id` 指到该子节点）

- [ ] **Step 1: 更新菜单 seed**

在 `seed.go` 菜单列表将 `menu_permissions` 改为：

```go
{Logical: "menu_permission_packs", Key: "permission_packs", Title: "权限管理", MenuType: "route", Path: "/permission_packs", Icon: "KeyRound", Sort: 3, Parent: "root_system"},
```

并给 SUPER_ADMIN 绑定。本地若已有旧菜单，迁移函数 `ON CONFLICT` 更新 key 或插入新行并删旧 `permissions` 键（实现时写清幂等逻辑）。

- [ ] **Step 2: 实现 MigrateRoleMenusToPacks(db) 幂等**

- [ ] **Step 3: Seed 后端字典根 + 挂 audit 分类**

- [ ] **Step 4: `docker compose down -v && make run`（若列类型无冲突可只重启）后 SyncAll 日志无错**

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 7: 前端 AppScopeMultiSelect + API 类型

**Files:**
- Create: `src/components/AppScopeMultiSelect.tsx`
- Modify: `src/components/SystemUserManagementView.tsx`
- Modify: `src/api/modules/iam.ts`
- Modify: `src/locales/zh-CN/rbac.json`（必要时）

**Interfaces:**
- Produces:

```tsx
export function AppScopeMultiSelect(props: {
  apps: PaymentApp[];
  value: string[];
  onChange: (ids: string[]) => void;
  allowAllToggle?: boolean; // 角色页 true：开则 onChange(["ALL"])
  placeholder?: string;
  hint?: string;
}): JSX.Element
```

内部用现有 `MultiSelect` + `showToolbar`。

- [ ] **Step 1: 抽出组件并用到用户管理出海应用区块**

替换 `SystemUserManagementView` 内对应 `MultiSelect`（`allowAllToggle` 不传/false）。

- [ ] **Step 2: iam.ts**

```ts
export interface ApiPermissionPack {
  id: string; key: string; name: string; description: string; menuIds: string[]; createdAt: number;
}
export interface ApiRole {
  id: string; key: string; name: string; description: string; isCustom: boolean;
  packIds: string[]; appIds: string[]; createdAt: number;
}
// list/create/update packs；updateRolePermissions({ packIds, appIds })
```

- [ ] **Step 3: `npx tsc --noEmit`**

- [ ] **Step 4: Commit**（默认跳过）

---

### Task 8: 权限包页面 + 角色页改造

**Files:**
- Create: `src/components/PermissionPacksView.tsx`
- Modify: `src/components/PermissionsView.tsx` 或 `RolesView.tsx`（以 App 实际挂载为准：角色列表+配置侧栏）
- Modify: `src/App.tsx`、`src/components/Sidebar.tsx`（若写死 tab）
- Modify: `src/locales/zh-CN/rbac.json`、`nav.json`

**Interfaces:**
- `PermissionPacksView`：列表 CRUD；「配置权限」SideSheet 仅 `MenuPermissionTree`；保存调 `PUT .../menus`
- 角色页：去掉 `MenuPermissionTree`；SideSheet 含权限包 `MultiSelect` + `AppScopeMultiSelect allowAllToggle`；保存 `packIds`/`appIds`
- App：`permission_packs` tab 渲染新页；`roles`/`permissions` 旧入口重定向到对应页

- [ ] **Step 1: i18n keys**（packs 标题、空态、toast、角色绑包文案）

- [ ] **Step 2: 实现 PermissionPacksView（可从 PermissionsView 复制精简）**

- [ ] **Step 3: 改造角色配置 UI**

- [ ] **Step 4: App 路由/hash 接线**

- [ ] **Step 5: `npx tsc --noEmit` + 浏览器点选权限包/角色保存**

- [ ] **Step 6: Commit**（默认跳过）

---

### Task 9: 前端权限 HOC

**Files:**
- Create: `src/lib/permission.tsx`
- Modify: `src/lib/menuAccess.ts`
- Modify: `src/App.tsx`
- Modify: `src/locales/zh-CN/common.json` 或 `rbac.json`（无权限占位）

**Interfaces:**
- Produces:

```tsx
export function hasMenuAccess(user: SystemUser | null | undefined, keys: string | string[], mode?: "any" | "all"): boolean
export function usePermission(keys: string | string[], mode?: "any" | "all"): { allowed: boolean; ready: boolean }
export function withPermission<P>(keys: string | string[], options?: { mode?: "any"|"all"; fallback?: React.ReactNode })(Comp: React.ComponentType<P>): React.FC<P>
export function PermissionGate(props: { menuKey: string | string[]; mode?: "any"|"all"; fallback?: React.ReactNode; children: React.ReactNode }): JSX.Element
```

判定：`roleKeys` 含 `SUPER_ADMIN` → true；否则看 `user.menuKeys`。

- [ ] **Step 1: 实现 permission.tsx**（需能读到 currentUser：通过 props 注入或小型 React Context；若项目无 AuthContext，则 `withPermission` 从闭包/`App` 已有的 user 经 Context 提供——**本任务新增 `PermissionContext`**：`App` 在登录后 `Provider value={{ user: currentUser, ready: authReady }}`）

- [ ] **Step 2: menuAccess.canAccessTab 改为优先 hasMenuAccess(user, routeKey)**

弱化角色表 `menuPermissionIds` 分支（可留 fallback 一个版本）。

- [ ] **Step 3: 对系统管理类 View 包 HOC 或在 App 渲染处用 Gate**（至少：`system_users`、`roles`、`permission_packs`、`dictionary`、`menus`、`departments`）

- [ ] **Step 4: tsc + 用非管理员账号验证无权限页**

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 10: 字典分类树 API + 前端

**Files:**
- Modify: `backend/internal/platform/dictionary/service/entry.go`（或新建 `category.go`）
- Modify: `backend/internal/platform/dictionary/handler/entry.go`
- Modify: `backend/internal/platform/dictionary/module.go`
- Modify: `src/components/DictionaryView.tsx`
- Modify: `src/api/modules/iam.ts`（或 `dictionary` API）
- Modify: `src/locales/zh-CN/dictionary.json`

**Interfaces:**
- `GET /dictionary/categories` → 树节点 `{ id, parentId, key, name, isSystem, sortOrder, children }`
- `POST /dictionary/categories` body `{ parentId?, key, name }`
- `PUT /dictionary/categories/:id` body `{ name, sortOrder? }`（系统节点允许改 name）
- `DELETE /dictionary/categories/:id` → `isSystem` 拒绝；有子节点或词条时拒绝或级联策略：**有子/词条则 409**
- 词条：`categoryId` 必填；DeleteEntry 若分类 `isSystem` → 拒绝
- 前端：去掉 `window.prompt`；新增/重命名分类用 SideSheet；系统节点无删除菜单；左侧树渲染

- [ ] **Step 1: 后端 Category service/handler/routes**

- [ ] **Step 2: 词条 API 支持 categoryId；列表可按 categoryId 过滤**

- [ ] **Step 3: DictionaryView 接真实分类树 + SideSheet**

- [ ] **Step 4: make build + tsc + UI 手测**

- [ ] **Step 5: Commit**（默认跳过）

---

### Task 11: 清理与联调验收

**Files:**
- Modify: `backend/internal/platform/sys/service/role.go`（确认无 RoleMenu 写）
- Optional: 停止 AutoMigrate `RoleMenu` 写入路径文档注释；表可保留

- [ ] **Step 1: 验收清单（全部勾选）**

1. 权限包改菜单 → 用户重新 `/me` 的 `menuKeys` 变化；`RequireMenu` 一致。  
2. 角色只绑包+应用，无菜单树。  
3. 用户管理与角色页共用 `AppScopeMultiSelect`。  
4. 非 SUPER_ADMIN 无菜单 key 时 API 403、前端 HOC 挡页。  
5. 字典根「后端字典」不可删、可改名；业务分类树 CRUD；无系统弹窗。  
6. `cd backend && make build`；根目录 `npx tsc --noEmit`。

- [ ] **Step 2: 更新规格状态为「已实现」**（可选一行）

- [ ] **Step 3: Commit**（默认跳过）

---

## Spec coverage（自检）

| 规格项 | Task |
|--------|------|
| 权限包 + 独立菜单 | 3, 6, 8 |
| 角色绑包+应用 | 4, 7, 8 |
| Casbin Sync + Enforce | 2, 5 |
| RoleMenu 迁移 | 6 |
| AppScopeMultiSelect | 7 |
| 权限 HOC | 9 |
| 字典树 + 后端字典根 | 1, 6, 10 |
| 无系统弹窗 | 10 |
| SUPER_ADMIN 短路 | 5 |

## 执行说明

本地若 AutoMigrate/类型冲突：`cd backend && docker compose down -v && make run`。  
默认管理员：`admin@novaspay.global` / `Admin@123456`。
