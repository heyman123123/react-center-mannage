# 权限包 / Casbin / 字典分类树 / 前端权限 HOC — 设计说明

> 日期：2026-09-14  
> 状态：已实现（实现计划见 `docs/superpowers/plans/2026-09-14-rbac-casbin-dict.md`）  

> 范围：后端（Go + Casbin）+ 前端（权限包/角色拆页、应用范围组件、字典树、权限 HOC）

---

## 1. 目标与非目标

### 1.1 目标

1. **权限分层**：菜单树只在「权限包」上配置；「角色」多选权限包 + 出海应用授权范围。两个**独立菜单**。
2. **运行时裁决用 Casbin**：业务表服务管理端 CRUD；保存后同步策略；`RequireMenu` / `/me.menuKeys` 走 Casbin。
3. **应用范围组件复用**：用户管理与角色管理共用封装后的出海应用多选组件。
4. **字典分类树**：独立根「后端字典」（系统、不可删、可改显示名）；业务分类树形 CRUD；新增/编辑用 SideSheet，禁止系统弹窗。
5. **前端权限管控**：封装 HOC（辅以 Hook / Gate）基于 `/me.menuKeys` 控制页面与按钮。

### 1.2 非目标（本期不做）

- 不以 `casbin_rule` 为管理端唯一真相源（不直接暴露策略 CRUD UI）。
- 不按 HTTP method/path 做 API 级 Casbin 策略（继续用菜单 key → `RequireMenu`）。
- 不做按钮级独立 `act` 细分（统一 `access`）；不做权限包嵌套权限包。
- 不做多副本 Redis Watcher（单进程 `LoadPolicy`；多副本后置）。
- 不在前端再实现一套 Casbin。

---

## 2. 产品模型

```
权限管理（新菜单 permission_packs）
  └─ 权限包 CRUD + 菜单树勾选（MenuPermissionTree）

角色管理（现有 roles，改造）
  └─ 角色 CRUD + 权限包多选 + 出海应用授权范围多选
       └─ 不再直接勾选菜单树

用户 / 部门
  └─ 仍绑定角色；生效菜单 = 个人角色 ∪ 部门角色 → 权限包 → 菜单（Casbin 传递闭包）
```

有效应用范围：

```
effectiveApps = 用户 allowedAppIds ∩（用户有效角色的 app 并集）
```

- 若用户 `allowedAppIds` 为空：仅用角色并集。
- 角色侧 `app:ALL` 表示该角色不限制应用；与用户侧多选语义对齐（空/全选约定在 API 契约中写清，见 §5）。

---

## 3. Casbin 方案（推荐：领域表 + 同步）

### 3.1 选型

| 方案 | 说明 | 结论 |
|------|------|------|
| **领域表 + Sync → Casbin** | CRUD 走业务表；保存后同步；Enforce 裁决 | **采用** |
| Casbin 唯一真相 | UI 直接改 `casbin_rule` | 不采用 |
| 仅套中间件、策略仍手写 SQL | 双轨 | 不采用 |

依赖：`github.com/casbin/casbin/v2` + `github.com/casbin/gorm-adapter/v3`（共用现有 PG）。

### 3.2 Model

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && (
      r.obj == p.obj ||
      (keyMatch(r.obj, "app:*") && p.obj == "app:ALL")
    ) && r.act == p.act
```

### 3.3 策略约定

| 规则 | 含义 |
|------|------|
| `g, user:<uid>, role:<roleKey>` | 用户绑定角色（含部门继承物化进用户侧 g，或 `g, user, role` 在 Sync 时展开部门） |
| `g, role:<roleKey>, pack:<packKey>` | 角色绑定权限包 |
| `p, pack:<packKey>, menu:<menuKey>, access` | 权限包授予菜单 |
| `p, role:<roleKey>, app:<appId>, access` | 角色应用范围 |
| `p, role:<roleKey>, app:ALL, access` | 角色不限应用 |

部门角色：Sync 时对每个用户解析 `DepartmentRole`，写入等价的 `g, user:<uid>, role:<roleKey>`（物化），避免运行时再查部门表。

`SUPER_ADMIN`：Sync 时写入覆盖策略，或中间件短路放行（二选一，实现固定为：**中间件对 SUPER_ADMIN 短路放行**，仍同步其绑定以便审计一致）。

### 3.4 工程落点

```
internal/platform/sys/casbin/
  model.go          # model 文本
  enforcer.go       # NewEnforcer + FX Provide
  sync.go           # SyncUser / SyncRole / SyncPack / SyncAll
```

- Adapter：`NewAdapterByDB(db)`，表名 `casbin_rule`。
- 写路径：权限包菜单、角色绑包、角色应用、用户角色、部门角色变更 → DB 事务成功后调用对应 Sync（可先全量 SyncAll，再优化增量）。
- 读路径：
  - `RequireMenu(menuKey)` → `Enforce("user:"+id, "menu:"+menuKey, "access")`
  - `/me.menuKeys` → 隐式权限中过滤 `menu:` 前缀并去前缀返回
- 包路径：`internal/platform/sys/`（与 IAM 同域）；底座仍不放 Casbin。

### 3.5 迁移

1. 建 `permission_packs` / `permission_pack_menus` / `role_packs` / `role_apps`。
2. 对每个现有角色：生成同名权限包，迁移 `role_menus` → `permission_pack_menus`，写 `role_packs`；应用权限若前端 mock 有值则写入 `role_apps`，否则默认 `app:ALL`。
3. `SyncAll` 灌入 Casbin。
4. 切换 `RequireMenu` 与 `/me`；保留旧 SQL 路径开关一个版本（配置或编译期常量），稳定后删除 `RoleMenu` 写路径。

---

## 4. 后端数据与 API

### 4.1 新/改表

**权限**

- `permission_packs(id, key, name, description, created_at, updated_at, deleted_at)`
- `permission_pack_menus(pack_id, menu_id)`
- `role_packs(role_id, pack_id)`
- `role_apps(role_id, app_id)` — `app_id` 存业务应用 UUID，或字面量 `ALL`
- 停用角色直写 `role_menus`（迁移后只读兼容期可保留表）

**字典**

- `dictionary_categories(id, parent_id, key, name, is_system, sort_order, created_at, updated_at, deleted_at)`
- `dictionary_entries` 增加 `category_id`（UUID FK）；保留过渡期 `category` 字符串列可选，API 以 `category_id` 为准
- Seed：插入系统根 `key=backend`、`name=后端字典`、`is_system=true`；将现有系统命名空间（如 `audit_action` 及原「通用词汇」类）挂到该根下或作为其子分类

### 4.2 API 草案

**权限包**（菜单 key：`permission_packs`）

- `GET/POST /permission-packs`
- `PUT/DELETE /permission-packs/:id`
- `PUT /permission-packs/:id/menus` body `{ menuIds: string[] }`

**角色改造**

- `PUT /roles/:id/permissions` 改为 `{ packIds: string[], appIds: string[] }`（不再接收 `menuIds`）
- `GET /roles` 返回 `packIds`、`appIds`（及可选 pack 摘要）

**字典分类**

- `GET /dictionary/categories` → 树
- `POST /dictionary/categories`、`PUT /dictionary/categories/:id`
- `DELETE /dictionary/categories/:id` — `is_system=true` 返回业务错误（不可删）
- 词条 CRUD：系统分类下**禁止删除词条**；允许改翻译/描述；分类显示名可改

---

## 5. 前端

### 5.1 导航与页面

| 菜单 | 说明 |
|------|------|
| 权限管理 | 新页：权限包列表 + SideSheet 配菜单树 |
| 角色管理 | 改造现 `PermissionsView`/`RolesView`：去掉菜单树；权限包 MultiSelect + `AppScopeMultiSelect` |
| 字典管理 | 左侧分类树；系统根不可删；分类/词条编辑 SideSheet |

Seed 菜单：增加 `permission_packs`；调整 `roles` 文案；权限相关 i18n 全部走 `src/locales/zh-CN/`。

### 5.2 `AppScopeMultiSelect`

从用户管理「出海应用授权范围」抽出：

```tsx
<AppScopeMultiSelect
  apps={apps}
  value={appIds}
  onChange={setAppIds}
/>
```

角色页与用户页共用；内部基于现有 `MultiSelect`，`showToolbar` 等行为保持一致。

**契约**：`value` 为应用 id 列表；空数组表示「未授权任何应用」（角色创建时可默认不选或提供「全部应用」快捷：写入 `ALL` / 或选中全部 id——**实现固定为：与用户管理一致，多选具体应用 id；若需要「全部」则选中当前全部应用 id，后端角色另支持显式 `ALL` 仅当保存时检测到全选或专用开关**）。为避免歧义，本期约定：

- 前端多选具体 `appId[]`；
- 角色保存时若勾选「全部应用」开关（沿用现角色页「全选应用」能力，改为组件内工具条），则 API 传 `appIds: ["ALL"]`；
- 用户侧保持现有逻辑（多选具体 id，无 `ALL` 字面量则表示所列范围）。

### 5.3 权限 HOC

权限源：仅 `currentUser.menuKeys`（及 `SUPER_ADMIN` 角色短路）。

```ts
withPermission(menuKey | menuKey[], options?)(Component)
usePermission(menuKey | menuKey[], options?) => { allowed: boolean; ready: boolean }
<PermissionGate menuKey="users" fallback={null}>…</PermissionGate>
```

| 选项 | 默认 | 说明 |
|------|------|------|
| `mode` | `any` | 多 key：`any` / `all` |
| `fallback` | 统一无权限占位（i18n） | HOC 无权限时渲染 |

- `App` 切 Tab / hash 守卫改为调用同一判定（收敛 `menuAccess.ts`：优先 `menuKeys`，弱化角色表菜单 ID 分支）。
- 页面级：对需管控的 View 包 `withPermission('<routeKey>')`。
- 按钮级：用 `PermissionGate`（与 HOC 同一函数判定）。

### 5.4 字典 UI

- 左侧树：展开/选中过滤右侧词条。
- 右键或工具条：新增子分类、重命名、删除（系统节点无删除）；全部 SideSheet / Popconfirm，**禁止** `window.prompt` / `alert`。
- 词条新增/编辑：现有 SideSheet 保留，分类选择器改为树选。

---

## 6. 错误与边界

| 场景 | 行为 |
|------|------|
| 删除仍被角色引用的权限包 | 409 / 业务码拒绝，提示先解绑 |
| 删除系统字典分类 | 业务错误，前端不展示删除入口 |
| 删除系统分类下词条 | API 拒绝 |
| Casbin Sync 失败 | 写路径事务已提交则记错误日志并重试 Sync；启动时 SyncAll 失败则进程不启动（与 migrate 同级严格） |
| 无 menuKeys 访问 Tab | 前端 HOC/守卫跳转首个可访问页；后端仍 403 |

---

## 7. 测试要点

- 迁移后：原角色菜单能力经权限包仍可访问对应 API。
- 角色只绑包、不直绑菜单；改包菜单后角色用户 `/me` 与 `RequireMenu` 立即反映（Sync 后）。
- 部门继承角色 → 用户获得菜单。
- `app:ALL` 与具体 app 交集规则符合第 2 节「有效应用范围」。
- 系统字典根不可删、可改名；业务分类树 CRUD；无系统弹窗。
- `withPermission` 无权限不渲染业务页；`PermissionGate` 隐藏按钮。

---

## 8. 实现顺序建议

1. 后端：表结构 + 权限包/角色 API + 迁移脚本 + Casbin Sync + 切换裁决。  
2. 前端：`AppScopeMultiSelect` + 权限包页 + 角色页改造。  
3. 前端：`withPermission` / `usePermission` / `PermissionGate` + App 守卫收敛。  
4. 后端字典分类树 API + seed；前端字典树与 SideSheet。  
5. 联调与删旧 `RoleMenu` 写路径。

---

## 9. 已确认决策摘要

- 权限包 / 角色两层；独立菜单（非 Tab）。
- Casbin：领域表 + 同步；菜单挂包、应用挂角色。
- 字典：独立系统根「后端字典」。
- 前后端一起做。
- 前端权限 HOC + Hook/Gate；消费 `menuKeys`。
