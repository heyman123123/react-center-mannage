# NovasPay 管理端 —— 测试用例文档

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 编写角色 | 资深 QA（基于代码静态分析梳理，需人工评审后作为正式基线） |
| 更新日期 | 2026-09-17 |
| 被测系统 | NovasPay 管理端（Go+Gin+PostgreSQL+Redis 后端 / React+Vite 前端） |
| API 基础路径 | `{ROOT_URL}/api/v1`，例如 `http://localhost:8080/api/v1` |
| 默认测试账号 | `admin@novaspay.global` / `Admin@123456`（角色 `SUPER_ADMIN`） |
| 关联自动化脚本 | `backend/scripts/smoke_test.sh`（冒烟）、`backend/scripts/e2e_channel_email_test.sh`（渠道+邮件深度 E2E）、`automation/automa/`（浏览器 RPA） |

> 本文档基于对 `backend/internal/**`（路由/service 业务规则）、`src/**`（页面交互与文案）、`docs/**`（架构与 Runbook）的静态代码分析编写，覆盖后端全部业务模块与前端主要交互页面。若代码有 drift，以 `backend/internal/**/module.go`、`migrations/` 与前端组件源码为准。

## 图例说明

**优先级**

| 级别 | 含义 |
|------|------|
| P0 | 核心链路 / 阻断性缺陷会导致主业务不可用，每次回归必须验证 |
| P1 | 重要功能，影响主要使用场景 |
| P2 | 一般功能/体验类，边缘场景 |

**用例类型**

`功能` 正常业务流程 · `异常` 非法输入/依赖缺失等错误处理 · `边界` 临界值/极限值 · `权限` RBAC/菜单权限相关 · `状态机` 状态流转合法性 · `安全` 鉴权/防注入/敏感信息保护 · `UI` 纯前端交互与文案

**自动化标记**

| 标记 | 含义 |
|------|------|
| **Y（冒烟）** | 已被 `backend/scripts/smoke_test.sh` 的 **CORE 层**自动执行，无需任何外部真实凭据，可在任意刚部署的环境直接运行 |
| **Y\*（冒烟-扩展）** | 已被 `smoke_test.sh` 的 **EXTENDED 层**自动执行，但依赖真实 Creem / Resend 凭据；未提供凭据时脚本会以 `SKIP` 记录，不计入失败 |
| **N（人工）** | 当前仅能人工/UI 层验证，或涉及高风险操作（如全量覆盖菜单树）、需要复杂前置数据（如已完成交易、KYB 申请单）而暂未纳入自动化脚本，后续可视 ROI 逐步补充自动化 |

## 用例数量统计（按模块）

| 模块 | 用例数 | 冒烟自动化数(Y+Y\*) |
|------|--------|----------------------|
| 1. 登录与会话管理 | 15 | 8 |
| 2. 系统用户管理 | 9 | 5 |
| 3. 角色管理 | 8 | 4 |
| 4. 权限包管理 | 6 | 3 |
| 5. 菜单管理 | 6 | 1 |
| 6. 部门管理 | 7 | 4 |
| 7. 租户管理 | 9 | 5 |
| 8. 支付渠道管理 | 16 | 8 |
| 9. 支付 Webhook | 7 | 1 |
| 10. 交易流水 | 8 | 1 |
| 11. 对账管理 | 7 | 3 |
| 12. 退款管理 | 8 | 1 |
| 13. 拒付管理 | 5 | 1 |
| 14. 商品管理 | 11 | 3 |
| 15. 折扣管理 | 8 | 1 |
| 16. 促销活动 | 6 | 1 |
| 17. 邮件渠道管理 | 11 | 6 |
| 18. 邮件模板 | 6 | 1 |
| 19. 邮件 Webhook | 4 | 1 |
| 20. 应用管理 | 5 | 1 |
| 21. 结算管理 | 8 | 1 |
| 22. 财务报表 | 4 | 1 |
| 23. 汇率管理 | 6 | 1 |
| 24. 费率规则 | 5 | 1 |
| 25. 风控规则与黑名单 | 7 | 2 |
| 26. 商户审核（KYB） | 5 | 1 |
| 27. 告警中心 | 5 | 1 |
| 28. 字典管理 | 14 | 8 |
| 29. 审计日志 | 6 | 1 |
| 30. 系统参数与定时任务 | 8 | 3 |
| 31. 终端客户管理 | 5 | 1 |
| 32. 仪表盘 | 5 | 1 |
| 33. 全局/跨模块 | 12 | 3 |
| **合计** | **252** | **87（CORE 82 + EXTENDED 5）** |

---

## 1. 登录与会话管理（Auth / Session）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-AUTH-001 | 正确邮箱密码登录成功 | P0 | 功能 | 管理员账号存在且状态 ACTIVE | 1) `POST /auth/login` 传入正确 `email`+`password` | 返回 `code=0`，HTTP 200，响应体不含 token；Set-Cookie 含 `novas_access`(`Path=/`) 与 `novas_refresh`(`Path=/api/v1/auth`) | Y（冒烟） |
| TC-AUTH-002 | 前端邮箱/密码为空时拦截提交 | P2 | 边界/UI | 打开登录页 | 1) 邮箱或密码留空点击「登录」 | 前端本地拦截，Toast「请填写邮箱和密码」，不发起网络请求 | N（人工） |
| TC-AUTH-003 | 密码错误登录失败 | P0 | 异常 | 管理员账号存在 | 1) `POST /auth/login` 传入正确邮箱+错误密码 | HTTP 401，`code=40101`，`message=邮箱或密码错误` | Y（冒烟） |
| TC-AUTH-004 | 邮箱不存在时报错文案与密码错误一致 | P1 | 安全 | - | 1) `POST /auth/login` 传入不存在的邮箱 | 同样返回 `40101`「邮箱或密码错误」，不泄露账号是否存在 | N（人工） |
| TC-AUTH-005 | 同一 IP 连续 5 次登录失败触发限流 | P0 | 安全 | - | 1) 同一来源连续 5 次用错误密码登录 2) 第 6 次请求（无论密码是否正确） | 第 6 次返回 HTTP 429，`code=42901`「登录失败次数过多，请 15 分钟后再试」；限流窗口结束前始终拒绝 | N（人工/专项脚本，冒烟环境需避免误触发自锁） |
| TC-AUTH-006 | 账号被停用（DISABLED）后无法登录 | P1 | 异常 | 存在一个 `status=DISABLED` 的用户 | 1) 用该账号密码登录 | 登录被拒绝（403/401，视实现返回统一错误） | N（需要造数据） |
| TC-AUTH-007 | GET /me 返回当前用户信息与权限 | P0 | 功能 | 已登录 | 1) `GET /me` | `code=0`；`data` 含 `email`/`name`/`roleKeys`/`menuKeys` | Y（冒烟） |
| TC-AUTH-008 | 未登录访问受保护接口返回 401 | P0 | 权限 | 不携带任何 Cookie | 1) `GET /users`（或任意 `Auth` 保护路由） | HTTP 401，`code=40100`「未登录或会话已失效」 | Y（冒烟） |
| TC-AUTH-009 | `X-App-Env` 传非法值返回 400 | P1 | 异常 | - | 1) 任意 API 请求携带 `X-App-Env: foo` | HTTP 400，`code=40001`「非法的 X-App-Env」 | Y（冒烟） |
| TC-AUTH-010 | `X-App-Env` 缺省时默认按 `live` 处理 | P2 | 功能 | - | 1) 请求不携带 `X-App-Env` 头 | 请求正常处理，等价于 `live` 环境，不报错 | Y（冒烟，脚本默认不传该 Header，隐式覆盖） |
| TC-AUTH-011 | 登出后原会话立即失效 | P0 | 功能 | 已登录 | 1) `POST /auth/logout` 2) 再次 `GET /me` | 登出返回 `code=0`；再次 `/me` 返回 401/40100 | Y（冒烟，使用独立会话验证，不影响主流程） |
| TC-AUTH-012 | 未登录直接访问业务 hash 路由自动跳转登录页 | P1 | 功能/UI | 浏览器未登录 | 1) 直接在地址栏输入 `#/payment_channels` 等业务路由 | 前端自动重定向到 `#/login`，展示登录页 | N（前端 UI） |
| TC-AUTH-013 | 登录按钮防重复提交 | P2 | UI | 打开登录页 | 1) 点击「登录」后立即再次点击 | 按钮文案变为「登录中…」且禁用，不会触发第二次请求 | N（人工） |
| TC-AUTH-014 | SUPER_ADMIN 账号 `/me` 返回全部菜单 key | P0 | 权限 | 使用 SUPER_ADMIN 账号登录 | 1) `GET /me` | `data.menuKeys` 覆盖全部种子菜单 key（数量 ≥ 20，含 `payment_channels`/`email_channels`/`roles`/`menus` 等） | Y（冒烟） |
| TC-AUTH-015 | 账户设置-修改密码校验规则 | P2 | 边界 | 已登录，打开「账户设置-安全」 | 1) 新密码 <8 位提交 2) 两次新密码不一致提交 3) 未填当前密码提交 | 分别提示「新密码长度必须至少为 8 位字符」「两次输入的新密码不一致，请核对」「请输入当前登录密码进行安全验证」 | N（人工） |

---

## 2. 系统用户管理（`/users`，前端 tab `system_users`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-USR-001 | 创建系统用户成功 | P0 | 功能 | 已登录且拥有 `users` 菜单权限；邮箱未被占用 | 1) `POST /users` 传 `email`+`name`(+可选`roleKeys`/`departmentIds`) | `code=0`；返回新用户信息及系统自动生成的 12 位初始密码（明文仅本次返回一次） | Y（冒烟） |
| TC-USR-002 | 邮箱重复创建失败 | P0 | 异常 | 已存在同邮箱用户 | 1) 用相同邮箱再次 `POST /users` | HTTP 409，`code=40901`「邮箱已注册」 | Y（冒烟） |
| TC-USR-003 | 姓名/邮箱必填前端校验 | P2 | UI | 打开新建用户表单 | 1) 姓名或邮箱留空提交 | 前端拦截并提示必填 | N（人工） |
| TC-USR-004 | 编辑用户信息（角色/部门/状态） | P1 | 功能 | 已存在用户 | 1) `PUT /users/:id` 修改 `roleKeys`/`departmentIds`/`status` | `code=0`，返回信息与修改一致 | N（人工） |
| TC-USR-005 | 停用用户后无法登录 | P1 | 异常/状态机 | 已存在用户 | 1) 编辑用户 `status=DISABLED` 2) 用该账号尝试登录（联动 TC-AUTH-006） | 登录被拒绝 | N（人工） |
| TC-USR-006 | 重置密码返回新初始密码 | P1 | 功能 | 已存在用户 | 1) `POST /users/:id/reset-password` | `code=0`；返回新的随机初始密码（与原密码不同） | Y（冒烟） |
| TC-USR-007 | 删除用户 | P1 | 功能 | 已存在测试用户 | 1) `DELETE /users/:id` | `code=0`；再次 `GET /users` 该用户不在列表中（软删除） | Y（冒烟，作为清理步骤） |
| TC-USR-008 | 用户绑定角色+部门后拥有对应菜单权限 | P0 | 权限 | 已创建自定义角色（绑定特定权限包） | 1) 创建用户并绑定该角色 2) 用该用户登录 3) `GET /me` 校验 `menuKeys` 4) 访问对应受限 API | `menuKeys` 与角色权限包菜单一致；访问被授权的 API 返回 200，未授权的返回 403 | N（需组合校验，建议人工/专项权限矩阵脚本） |
| TC-USR-009 | `GET /users` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /users?page=1&pageSize=20` | `code=0`；`data.list`/`data.total` 存在 | Y（冒烟） |

---

## 3. 角色管理（`/roles`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-ROLE-001 | 创建自定义角色（绑定权限包+应用范围） | P0 | 功能 | 已存在至少 1 个权限包 | 1) `POST /roles` 传 `key`(大写)+`name`+`packIds`+`appIds` | `code=0`；`isCustom=true`；Casbin 策略同步（`user:*→role:KEY→pack:PACK`） | Y（冒烟） |
| TC-ROLE-002 | 角色 Key 重复创建失败 | P1 | 异常 | 已存在同 Key 角色 | 1) 用相同 `key` 再次创建 | 返回 409 冲突 | N（人工） |
| TC-ROLE-003 | 更新角色绑定的权限包/应用范围 | P1 | 功能 | 已存在自定义角色 | 1) `PUT /roles/:id/permissions` 替换 `packIds`/`appIds` | `code=0`；角色的 `role_packs`/`role_apps` 全量替换为新值，Casbin 重新同步 | N（人工） |
| TC-ROLE-004 | 删除自定义角色成功 | P1 | 功能 | 已存在未被用户引用的自定义角色 | 1) `DELETE /roles/:id` | `code=0` | Y（冒烟，清理步骤） |
| TC-ROLE-005 | 删除内置角色 SUPER_ADMIN 被拒绝 | P0 | 异常 | - | 1) `DELETE /roles/{SUPER_ADMIN的id}` | HTTP 403，`code=40301`「内置角色不可删除」 | Y（冒烟） |
| TC-ROLE-006 | 角色未绑定 `appIds` 时默认全部应用 `["ALL"]` | P2 | 功能 | 创建角色时不传 `appIds` | 1) `POST /roles` 不传 `appIds` 2) `GET /roles` 查看该角色 | 返回的 `appIds` 为 `["ALL"]` | N（人工） |
| TC-ROLE-007 | 角色权限变更后下次请求即时生效 | P1 | 权限 | 某用户已绑定角色 A | 1) 移除角色 A 的某个权限包 2) 该用户立即再次访问相关 API | 无需重新登录，下一次请求即因 Casbin 策略已更新而被拒绝/放行 | N（人工） |
| TC-ROLE-008 | `GET /roles` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /roles` | `code=0`，返回数组，至少含 `SUPER_ADMIN` | Y（冒烟） |

---

## 4. 权限包管理（`/permission-packs`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-PACK-001 | 创建权限包成功 | P0 | 功能 | - | 1) `POST /permission-packs` 传 `key`(大写)+`name`(+`menuIds`) | `code=0`，返回新权限包 | Y（冒烟） |
| TC-PACK-002 | 权限包 Key 重复创建失败 | P1 | 异常 | 已存在同 Key 权限包 | 1) 用相同 `key` 再次创建 | 返回 409 冲突 | N（人工） |
| TC-PACK-003 | 全量替换权限包菜单（ReplaceMenus） | P1 | 功能 | 已存在权限包 | 1) `PUT /permission-packs/:id/menus` 传新的 `menuIds` 全集 | `code=0`；该权限包的菜单关联被整体替换为新集合（而非增量合并） | N（人工） |
| TC-PACK-004 | 删除仍被角色引用的权限包被拒绝 | P0 | 异常 | 权限包已被至少一个角色绑定 | 1) `DELETE /permission-packs/:id` | HTTP 409，`code=40910`「权限包仍被角色引用」 | N（需联动角色绑定，建议人工验证或后续补充自动化） |
| TC-PACK-005 | 未被引用的权限包可正常删除 | P1 | 功能 | 权限包未被任何角色绑定 | 1) `DELETE /permission-packs/:id` | `code=0` | Y（冒烟，清理步骤） |
| TC-PACK-006 | `GET /permission-packs` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /permission-packs` | `code=0`，返回数组，至少含 `PACK_SUPER_ADMIN` | Y（冒烟） |

---

## 5. 菜单管理（`/menus`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-MENU-001 | `GET /menus` 任意登录用户均可访问 | P0 | 权限 | 使用任意已登录账号（无需 `menus` 菜单权限） | 1) `GET /menus` | `code=0`，返回菜单树（该接口只挂 `Auth` 中间件，不走 `RequireMenu`） | Y（冒烟） |
| TC-MENU-002 | 创建菜单缺少 `key`/`title` 时校验失败 | P2 | 边界 | 拥有 `menus` 权限 | 1) `POST /menus` 缺少必填字段 | 返回 422 参数错误 | N（人工） |
| TC-MENU-003 | 菜单 `key` 重复创建失败 | P2 | 异常 | 已存在同 key 菜单 | 1) 用相同 `key` 再次创建 | 返回 409 冲突 | N（人工） |
| TC-MENU-004 | 全量替换菜单树（`PUT /menus` ReplaceTree）会先删全表再重建 | P0 | 高风险/功能 | ⚠️ 仅允许在隔离/一次性环境执行 | 1) `PUT /menus` 传入完整新菜单树 | 旧菜单树被整体删除并替换为新树；所有依赖旧菜单 ID 的角色-菜单/权限包-菜单关联需重新核对 | N（**禁止**在共享/生产环境自动化执行，仅人工在隔离环境验证） |
| TC-MENU-005 | 删除菜单联动清理角色-菜单绑定关系 | P2 | 功能 | 某菜单已被角色/权限包引用 | 1) `DELETE /menus/:id` | `code=0`；该菜单从所有权限包的 `menuIds` 中移除 | N（人工） |
| TC-MENU-006 | 路由型菜单未填 `path` 时前端拦截 | P2 | UI | 打开新建菜单表单，类型选「路由」 | 1) 不填路径直接提交 | 前端提示「路由类型菜单必须填写路径」 | N（人工） |

---

## 6. 部门管理（`/departments`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-DEPT-001 | 创建部门（树形结构） | P0 | 功能 | - | 1) `POST /departments` 传 `name`+`code`(+`parentId`) | `code=0`，返回新部门节点 | Y（冒烟） |
| TC-DEPT-002 | 部门 `code` 重复创建失败 | P1 | 异常 | 已存在同 code 部门 | 1) 用相同 `code` 再次创建 | HTTP 409 冲突 | Y（冒烟） |
| TC-DEPT-003 | 删除有子部门的部门被拒绝 | P0 | 异常 | 已创建父部门+至少一个子部门 | 1) `DELETE /departments/{父部门id}` | HTTP 409，`code=40902`「请先删除或转移子部门」 | Y（冒烟） |
| TC-DEPT-004 | 用户转移到其他部门（Transfer） | P1 | 功能 | 存在用户及目标部门 | 1) `POST /departments/transfer` 传用户 ID + 目标部门 ID | `code=0`；用户所属部门变更为目标部门 | N（人工） |
| TC-DEPT-005 | 部门转移到新上级（不可转移给自身） | P2 | 边界 | 存在两个部门 A、B | 1) 将 A 的父级设为 A 自身 2) 将 A 的父级设为 B（合法） | 步骤1被拒绝；步骤2成功 | N（人工） |
| TC-DEPT-006 | 部门角色继承：成员自动获得部门绑定角色权限 | P0 | 权限 | 部门绑定角色 A，用户属于该部门 | 1) 用户未直接绑定角色 A 2) 用该用户登录查看 `/me.menuKeys` | 用户的有效角色 = 个人角色 ∪ 部门角色，`menuKeys` 应包含角色 A 授予的菜单 | N（需组合校验，人工） |
| TC-DEPT-007 | `GET /departments` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /departments` | `code=0`，返回部门树 | Y（冒烟） |

---

## 7. 租户管理（`/tenants`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-TEN-001 | 创建租户成功（默认 `LOGICAL_TENANT`/USD） | P0 | 功能 | `id`/`code` 未被占用 | 1) `POST /tenants` 传 `id`+`name`+`code` | `code=0`；未传 `isolationLevel`/`currency` 时默认为 `LOGICAL_TENANT`/`USD` | Y（冒烟） |
| TC-TEN-002 | 租户 ID 或编码冲突创建失败 | P1 | 异常 | 已存在同 `id` 或 `code` 的租户 | 1) 用相同 `id` 或 `code` 再次创建 | HTTP 409「租户 ID 或编码冲突」 | Y（冒烟） |
| TC-TEN-003 | 必填项（id/name/code）缺失前端拦截 | P2 | UI | 打开新建租户表单 | 1) 任一必填项留空提交 | 前端提示「请填写租户 ID、名称与编码」 | N（人工） |
| TC-TEN-004 | 删除总部租户 `group_hq` 被拒绝 | P0 | 异常 | - | 1) `DELETE /tenants/group_hq` | HTTP 409，`code=40910`「总部租户不可删除」 | Y（冒烟） |
| TC-TEN-005 | 删除普通业务租户成功（前端二次确认） | P1 | 功能 | 已创建非 `group_hq` 测试租户 | 1) 前端点击删除，确认弹窗「确定删除该租户？此操作不可恢复。」2) 确认 | `code=0`，租户列表中不再出现 | Y（冒烟，接口层跳过 UI 二次确认，直接调用 DELETE 完成清理） |
| TC-TEN-006 | 隔离级别三种取值均可设置 | P2 | 功能 | - | 1) 分别创建/更新租户为 `STRICT_ISOLATED`/`LOGICAL_TENANT`/`GROUP_CONSOLIDATED` | 三种取值均可正常保存并回显 | N（人工） |
| TC-TEN-007 | 集团视图（`tenantId` 为空/`ALL`）下跨租户数据不过滤 | P1 | 功能 | 存在多租户数据 | 1) 各业务列表接口 `tenantId` 参数留空或传 `ALL`/`group_hq` | 返回全量跨租户数据，不做 `tenant_id` 过滤 | N（人工） |
| TC-TEN-008 | 指定 BU 租户下各业务列表只返回该租户数据 | P0 | 功能/安全 | 存在至少 2 个业务租户各自的数据 | 1) 传具体 `tenantId=bu_na_ecom` 查询交易/商品等列表 | 只返回该租户下的数据，不泄露其他租户数据 | N（人工，租户数据隔离是安全重点，建议纳入回归） |
| TC-TEN-009 | `GET /tenants` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /tenants` | `code=0`，至少包含 `group_hq` | Y（冒烟） |

---

## 8. 支付渠道管理（`/payment-channels`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-PAYCH-001 | 创建 Creem 支付渠道成功（创建本身不触发外部调用） | P0 | 功能 | 已登录且拥有 `payment_channels` 权限 | 1) `POST /payment-channels` 传 `name`+`apiSecretKey`(+`mode`等) | `code=0`；`apiSecretKey` 仅以 AES 加密落库，**创建阶段不会调用 Creem 外部 API**（即使密钥是假的也能创建成功） | Y（冒烟） |
| TC-PAYCH-002 | 未填渠道名称/API Secret 前端拦截 | P2 | UI | 打开新增渠道 Sheet | 1) 名称或 Secret 留空点击「确认接入」 | Toast「请填写渠道名称与 API Secret」 | N（人工） |
| TC-PAYCH-003 | 连通性测试成功返回 HEALTHY | P0 | 功能 | 渠道配置了**真实有效**的 Creem Sandbox API Secret | 1) `POST /payment-channels/:id/test` | `code=0`；`data.testStatus=HEALTHY`，`latencyMs` 有值；前端 Toast「API 握手成功！公私钥校验通过…」 | Y\*（冒烟-扩展，需配置 `CREEM_API_SECRET`） |
| TC-PAYCH-004 | 连通性测试失败：接口报错但状态仍异步落库为 DOWN | P1 | 异常 | 渠道配置了**无效**的 API Secret（无需真实凭据） | 1) `POST /payment-channels/:id/test` 2) 测试完成后再 `GET /payment-channels/:id` | 步骤1返回 HTTP 502，`code=50210`「渠道连通性测试失败: …」；**但**该渠道记录已在数据库中先被更新为 `testStatus=DOWN`、`latencyMs`/`lastTestedAt` 已刷新——步骤2应能看到这个「已落库的失败态」，不能仅因为接口报错就认为完全没有留痕 | Y（冒烟） |
| TC-PAYCH-005 | Sandbox 测试下单成功创建 Checkout（仅 Creem） | P0 | 功能 | 渠道为 Creem 且配置真实 API Secret；已有可用 `productId` | 1) `POST /payment-channels/:id/checkout-test` 传 `productId` | `code=0`；返回 `checkoutUrl`+`sessionId`+`expiresAt`；前端提示「Checkout 已创建，请在新窗口完成支付…」 | Y\*（冒烟-扩展） |
| TC-PAYCH-006 | Sandbox 测试下单未填商品 ID 前端拦截 | P2 | UI | 打开测试交易面板 | 1) 商品 ID 留空点击「Sandbox 测试下单」 | Toast「请填写 Creem 商品 ID」 | N（人工） |
| TC-PAYCH-007 | 非 Creem 渠道调用 checkout-test 返回 422 | P2 | 异常 | 假设存在非 creem 渠道（当前系统仅内置 creem） | 1) 对非 creem 渠道调用 `checkout-test` | 返回 422（`ProviderNotSupported`）；前端提示「仅 Creem 渠道支持 Sandbox 测试下单」 | N（当前无可用非 creem 渠道数据，设计预留） |
| TC-PAYCH-008 | 设为主力渠道（同环境唯一） | P1 | 功能 | 同一环境下存在 ≥2 个渠道 | 1) 将渠道 B 设为主力 | 渠道 B 变为 primary；同环境下原主力渠道 A 自动取消 primary（同环境唯一） | N（人工） |
| TC-PAYCH-009 | 编辑渠道信息（名称/优先级等） | P1 | 功能 | 已存在渠道 | 1) `PUT /payment-channels/:id` 修改 `name`/`routingPriority` 等（`apiSecretKey` 留空表示不覆盖） | `code=0`，字段按预期更新，未传的敏感字段保持原值 | Y（冒烟） |
| TC-PAYCH-010 | 删除渠道 | P1 | 功能 | 已存在测试渠道 | 1) `DELETE /payment-channels/:id` | `code=0` | Y（冒烟，清理步骤） |
| TC-PAYCH-011 | 渠道列表按环境（live/sandbox）与 `channelKey` 筛选 | P2 | 功能 | 存在不同环境/渠道类型的数据 | 1) `GET /payment-channels?mode=sandbox&channelKey=creem` | 只返回匹配条件的渠道 | N（人工） |
| TC-PAYCH-012 | 渠道健康探测定时任务自动刷新健康状态 | P2 | 功能 | 已启用渠道存在 | 1) 等待约 5 分钟定时任务周期 2) 查看渠道健康状态 | 健康状态被后台任务自动刷新，无需手动点击测试 | N（依赖定时任务节奏，人工观察） |
| TC-PAYCH-013 | API Secret / Webhook Secret 响应中始终掩码 | P1 | 安全 | 已存在配置了密钥的渠道 | 1) `GET /payment-channels` 或 `GET /payment-channels/:id` | 返回体中密钥字段显示为掩码（如 `****`），不泄露明文 | N（人工核查响应体） |
| TC-PAYCH-014 | 无 `payment_channels` 菜单权限角色访问返回 403 | P0 | 权限 | 使用未授予 `payment_channels` 权限的角色登录 | 1) `GET /payment-channels` | HTTP 403，`code=40300`「无权限」 | N（需要另建低权限测试账号，建议纳入权限矩阵专项） |
| TC-PAYCH-015 | Checkout 测试时渠道未配置 API Secret 返回 422 | P2 | 异常 | 渠道 `apiSecretKey` 为空 | 1) `POST /payment-channels/:id/checkout-test` | 返回 422，`code=42212`「渠道未配置 API Secret」 | N（人工） |
| TC-PAYCH-016 | `GET /payment-channels` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /payment-channels` | `code=0`，返回数组 | Y（冒烟） |

---

## 9. 支付 Webhook（`/payment-webhooks`、`/hooks/creem/:channelId`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-PAYWH-001 | Creem Webhook 签名正确时入账成功 | P0 | 功能 | 已配置渠道 Webhook Secret；有真实/模拟签名的 Creem 事件请求 | 1) `POST /hooks/creem/:channelId` 携带正确签名 | 返回成功；对应交易流水/结算数据正确入账 | N（需真实 Creem 签名请求，建议人工或专项脚本用真实 sandbox 触发） |
| TC-PAYWH-002 | Creem Webhook 签名错误返回 401 | P0 | 异常/安全 | - | 1) `POST /hooks/creem/:channelId` 携带错误/缺失签名 | HTTP 401，`code=40102`「Webhook 签名校验失败」 | N（人工） |
| TC-PAYWH-003 | 相同 `event_id` 重复投递保持幂等 | P0 | 状态机 | 已成功处理过一次某 `event_id` | 1) 用相同 `event_id` 再投递一次 | 第二次请求被识别为重复并跳过处理，不产生重复流水 | N（人工） |
| TC-PAYWH-004 | Webhook 日志列表按渠道/事件类型筛选 | P1 | 功能 | 存在历史 Webhook 日志 | 1) `GET /payment-webhooks?channelId=xxx&eventType=xxx` | 只返回匹配条件的日志 | N（人工） |
| TC-PAYWH-005 | 重新投递（redeliver）历史 Webhook | P1 | 功能 | 存在历史 Webhook 日志 | 1) `POST /payment-webhooks/:id/redeliver` | `code=0`；前端 Toast「Webhook {{eventId}} 已成功重新投递至下游…」 | N（人工） |
| TC-PAYWH-006 | 报文详情侧栏展示原始 payload | P2 | UI | 存在 Webhook 日志 | 1) 点击「报文」查看详情 | 侧栏展示完整原始请求体（格式化 JSON） | N（人工） |
| TC-PAYWH-007 | `GET /payment-webhooks` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /payment-webhooks?page=1&pageSize=5` | `code=0` | Y（冒烟） |

---

## 10. 交易流水（`/transactions`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-TXN-001 | 交易列表分页查询 | P0 | 功能 | 已登录 | 1) `GET /transactions?page=1&pageSize=20` | `code=0`，返回分页数据结构 | Y（冒烟） |
| TC-TXN-002 | 交易详情查看 | P1 | 功能 | 存在至少一条交易 | 1) `GET /transactions/:id` | `code=0`，返回完整交易详情 | N（人工，依赖已有交易数据） |
| TC-TXN-003 | 按渠道/状态筛选交易 | P1 | 功能 | 存在多种状态/渠道的交易 | 1) `GET /transactions?channel=creem&status=discrepancy` | 只返回匹配条件的交易 | N（人工） |
| TC-TXN-004 | 关键词搜索交易（订单号/客户邮箱等） | P1 | 功能 | 存在可搜索交易 | 1) `GET /transactions?keyword=xxx` | 返回匹配关键词的交易 | N（人工） |
| TC-TXN-005 | 有权限时导出 CSV 成功 | P2 | 功能 | 拥有导出权限 | 1) 点击「导出 CSV」 | 成功下载 CSV 文件，字段与列表一致 | N（人工） |
| TC-TXN-006 | 无导出权限时前端提示拒绝 | P1 | 权限 | 无导出权限的角色 | 1) 点击「导出 CSV」 | 前端 alert 拒绝提示（`list.exportDenied`） | N（人工） |
| TC-TXN-007 | 差错流水下钻查看时间轴 | P2 | UI | 存在 `discrepancy` 状态交易 | 1) 点击某差错流水的「下钻时间轴」 | 侧栏展示该交易的完整处理时间轴 | N（人工） |
| TC-TXN-008 | 差错流水快捷处置（调账） | P1 | 功能 | 存在 `discrepancy` 状态交易 | 1) 点击「处理调账」并提交处置意见 | 交易状态发生对应变化，记录处置备注 | N（人工） |

---

## 11. 对账管理（`/reconciliation`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-RECON-001 | 对账汇总（三方节点概览）可正常访问 | P1 | 功能 | 已登录 | 1) `GET /reconciliation/summary` | `code=0` | Y（冒烟） |
| TC-RECON-002 | 运行自动化对账引擎：`in_process`/`pending_check` 批量转 `done` | P0 | 状态机 | 存在 `in_process`/`pending_check` 状态交易 | 1) `POST /reconciliation/run` | `code=0`；符合条件的交易状态批量更新为 `done`；前端 Toast「自动化三方对账引擎运行完毕，已匹配平账全部合格流水！」 | N（需要造存量数据，建议人工/专项数据集验证） |
| TC-RECON-003 | 人工核销差错流水（`discrepancy`→`done`） | P0 | 状态机 | 存在 `discrepancy` 状态交易 | 1) `POST /reconciliation/discrepancies/:id/resolve` | `code=0`；该交易状态变为 `done` | N（人工） |
| TC-RECON-004 | 对非差错状态流水执行核销被拒绝 | P1 | 异常 | 存在非 `discrepancy` 状态的交易（如 `done`） | 1) 对该交易 ID 调用 `resolve` | HTTP 422，`code=42220`「仅差错流水可核销」 | Y（冒烟，best-effort：若环境暂无可用交易数据则 WARN 跳过） |
| TC-RECON-005 | 无对账权限角色发起对账引擎被拒绝 | P1 | 权限 | 使用无 `reconciliation` 权限的角色 | 1) `POST /reconciliation/run` | HTTP 403；前端提示「权限不足：当前登录角色无权发起跨租户或自动化对账任务！」 | N（人工） |
| TC-RECON-006 | 对账批次列表分页查询 | P2 | 功能 | 已登录 | 1) `GET /reconciliation/batches?page=1&pageSize=20` | `code=0` | Y（冒烟） |
| TC-RECON-007 | 导出对账差错 CSV | P2 | 功能 | 存在差错数据 | 1) 点击「导出 CSV」 | 成功下载差错清单 | N（人工） |

---

## 12. 退款管理（`/refunds`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-REFUND-001 | 发起全额退款成功（状态 `PROCESSING`） | P0 | 功能 | 存在一条已完成（`done`）交易 | 1) `POST /refunds` 传关联交易 ID，不传金额（视为全额） | `code=0`；退款记录 `status=PROCESSING`，类型自动推断为 `FULL` | N（需要一条真实已完成交易，建议人工/专项数据） |
| TC-REFUND-002 | 发起部分退款成功（自动推断 `PARTIAL`） | P1 | 功能 | 同上 | 1) `POST /refunds` 传小于交易金额的退款金额 | `code=0`；类型自动推断为 `PARTIAL` | N（人工） |
| TC-REFUND-003 | 关联交易不存在时创建退款失败 | P1 | 异常 | - | 1) `POST /refunds` 传一个不存在的交易 ID | HTTP 404，`code=40401`「关联交易流水不存在」 | N（人工） |
| TC-REFUND-004 | 处理退款（process）成功变为 `SUCCESS` | P0 | 状态机 | 存在 `PROCESSING` 状态退款且渠道 Creem API 可用 | 1) `POST /refunds/:id/process` | `code=0`；退款状态变为 `SUCCESS` | N（人工） |
| TC-REFUND-005 | 处理退款调用 Creem 失败返回 502 | P2 | 异常 | Creem 侧退款失败（如已退款/金额不符） | 1) `POST /refunds/:id/process` | HTTP 502，`code=50211`「Creem 退款失败」 | N（人工） |
| TC-REFUND-006 | 退款理由缺省时默认为「客户要求」 | P2 | 功能 | 创建退款时不传 `reason` | 1) `POST /refunds` 不传 `reason` | 返回记录 `reason=客户要求` | N（人工） |
| TC-REFUND-007 | 退款列表按状态/渠道筛选 | P2 | 功能 | 存在多状态退款 | 1) `GET /refunds?status=SUCCESS&channel=creem` | 只返回匹配条件的退款 | N（人工） |
| TC-REFUND-008 | `GET /refunds` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /refunds` | `code=0` | Y（冒烟） |

---

## 13. 拒付管理（Chargeback，`/chargebacks`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-CB-001 | 拒付列表查看 | P1 | 功能 | 已登录 | 1) `GET /chargebacks` | `code=0` | Y（冒烟） |
| TC-CB-002 | 上传拒付证据后状态变为「已提交证据」 | P0 | 状态机 | 存在「待响应」状态拒付单 | 1) `POST /chargebacks/:id/evidence` 上传证据材料 | `code=0`；状态由「待响应」变为「已提交证据」 | N（人工） |
| TC-CB-003 | 提交拒付申诉（submit） | P0 | 功能 | 已上传证据的拒付单 | 1) `POST /chargebacks/:id/submit` | `code=0`；申诉提交成功，进入等待仲裁状态 | N（人工） |
| TC-CB-004 | 未上传证据直接提交申诉时前端拦截 | P2 | UI | 拒付单尚未上传证据 | 1) 直接点击「提交证据」 | 前端拦截并提示需先上传证据材料 | N（人工） |
| TC-CB-005 | `GET /chargebacks` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /chargebacks` | `code=0` | （与 TC-CB-001 合并执行，见冒烟脚本） |

---

## 14. 商品管理（`/products`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-PROD-001 | 创建商品 SKU 成功（会同步真实调用 Creem 创建商品） | P0 | 功能 | 存在 `channelKey=creem` 且配置了**真实有效** API Secret 的渠道 | 1) `POST /products` 传 `channelId`+`code`+`name`+`price>0` | `code=0`；`syncStatus=SYNCED`，`externalProductId` 已回填。**注意：即使密钥无效，本地也会插入一条 `syncStatus=ERROR` 的记录**，而非直接报错吞掉数据 | Y\*（冒烟-扩展，需 `CREEM_API_SECRET`） |
| TC-PROD-002 | 价格 `<=0` 时校验拒绝 | P1 | 边界 | - | 1) `POST /products` 传 `price=0` 或负数 | HTTP 422，`InvalidArgument` | N（人工） |
| TC-PROD-003 | 未选择 Creem 渠道/渠道非 Creem 时提示 | P1 | UI/异常 | - | 1) `channelId` 对应渠道 `channelKey != creem` | 返回 422（`ProviderNotSupported`）；前端提示「请选择 Creem 渠道账号」 | N（人工） |
| TC-PROD-004 | 从 Creem 批量同步商品（`sync-from-creem`） | P1 | 功能 | 渠道配置真实 API Secret，Creem 侧已有商品 | 1) `POST /products/sync-from-creem?channelId=xxx` | `code=0`；返回 `created`/`updated`/`total`；按 `external_product_id` upsert 本地商品 | Y\*（冒烟-扩展） |
| TC-PROD-005 | 单个商品重新同步（`POST /:id/sync`） | P2 | 功能 | 已存在商品 | 1) `POST /products/:id/sync` | `code=0`，与 Creem 侧数据重新对齐 | N（人工） |
| TC-PROD-006 | 删除商品联动 Creem 归档 | P1 | 功能 | 已存在商品 | 1) `DELETE /products/:id` | `code=0`；Creem 侧商品被 archive，本地记录删除 | N（人工） |
| TC-PROD-007 | 商品列表按货币/类型筛选 | P2 | 功能 | 存在多币种/类型商品 | 1) `GET /products?currency=USD&type=SUBSCRIPTION` | 只返回匹配条件商品 | N（人工） |
| TC-PROD-008 | 商品同步状态 `PENDING`/`SYNCED`/`ERROR` 正确展示 | P1 | 功能 | 存在不同同步状态的商品 | 1) 查看商品列表 | 状态 Badge 与实际 `syncStatus` 一致 | N（人工） |
| TC-PROD-009 | 派生多币种 SKU | P2 | 功能 | 已存在基础商品 | 1) 基于现有商品「派生」新币种 SKU | 创建成功；前端 Toast「新币种商品【{{code}}】已成功创建并录入网关！」 | N（人工） |
| TC-PROD-010 | 编辑商品保存更改 | P1 | 功能 | 已存在商品 | 1) `PUT /products/:id` 修改名称/描述等 | `code=0`，字段按预期更新 | N（人工） |
| TC-PROD-011 | `GET /products` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /products` | `code=0` | Y（冒烟） |

---

## 15. 折扣管理（`/discounts`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-DISC-001 | 创建折扣码成功（百分比/固定金额） | P1 | 功能 | 已有 ≥1 个 `syncStatus=SYNCED` 的商品 | 1) `POST /discounts` 传 `code`+`name`+`channelId`+已同步商品 ID 列表 | `code=0`；同步创建 Creem 侧折扣 | N（依赖已同步 Creem 商品，人工/专项数据） |
| TC-DISC-002 | 未选择任何已同步商品时被拒绝 | P0 | 异常 | - | 1) `POST /discounts` 不传商品或商品均未同步 | HTTP 422，`code=42212`「请至少选择一个已同步的商品」 | N（人工） |
| TC-DISC-003 | 未选择 Creem 渠道时被拒绝 | P1 | 异常 | - | 1) `POST /discounts` 不传 `channelId` | 校验失败，前端提示需选择渠道 | N（人工） |
| TC-DISC-004 | 更新折扣（先删旧 Creem 折扣再创建新的） | P2 | 功能 | 已存在折扣 | 1) `PUT /discounts/:id` 修改折扣力度 | `code=0`；旧 Creem 折扣被删除，新折扣被创建并关联 | N（人工） |
| TC-DISC-005 | 折扣列表按类型/状态筛选 | P2 | 功能 | 存在多类型折扣 | 1) `GET /discounts?type=PERCENTAGE` | 只返回匹配条件折扣 | N（人工） |
| TC-DISC-006 | 删除折扣码 | P2 | 功能 | 已存在折扣 | 1) `DELETE /discounts/:id` | `code=0` | N（人工） |
| TC-DISC-007 | 折扣码重复创建校验 | P2 | 异常 | 已存在同 `code` 折扣 | 1) 用相同 `code` 再次创建 | 返回冲突错误 | N（人工） |
| TC-DISC-008 | `GET /discounts` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /discounts` | `code=0` | Y（冒烟） |

---

## 16. 促销活动（`/promo-campaigns`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-PROMO-001 | 新建促销活动 | P1 | 功能 | 已登录 | 1) 点击「新建促销营销活动」填写并保存 | 活动创建成功并出现在列表中 | N（人工） |
| TC-PROMO-002 | 立即派发活动 | P1 | 功能 | 存在待派发活动 | 1) 点击「立即派发活动」 | 活动状态变为已派发/生效中 | N（人工） |
| TC-PROMO-003 | 保存活动排期 | P2 | 功能 | 编辑活动排期时间 | 1) 点击「保存活动排期」 | 排期信息保存成功 | N（人工） |
| TC-PROMO-004 | 复制已有活动 | P2 | 功能 | 存在活动 | 1) 点击「复制」 | 生成一份内容相同、状态为草稿的新活动 | N（人工） |
| TC-PROMO-005 | 活动预览展示 | P2 | UI | 存在活动 | 1) 点击「预览」 | 展示活动对客展示效果 | N（人工） |
| TC-PROMO-006 | `GET /promo-campaigns` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /promo-campaigns` | `code=0` | Y（冒烟） |

---

## 17. 邮件渠道管理（`/email-channels`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-ECH-001 | 创建 Resend 渠道成功（创建本身不触发外部调用） | P0 | 功能 | 已登录且拥有 `email_channels` 权限 | 1) `POST /email-channels` 传 `name`+`senderEmail`+`apiKey` | `code=0`；即使 `apiKey` 是假的也能创建成功（发信测试时才会真正调用 Resend） | Y（冒烟） |
| TC-ECH-002 | 未填必填项前端拦截 | P2 | UI | 打开新增渠道 Sheet | 1) 渠道名称或发件人邮箱留空提交 | Toast「请填写渠道名称与发件人邮箱」 | N（人工） |
| TC-ECH-003 | 同环境首个渠道自动设为 `isPrimary` | P1 | 功能 | 该环境下当前无任何邮件渠道 | 1) 创建第一个渠道 | 返回的 `isPrimary=true` | Y（冒烟） |
| TC-ECH-004 | 手动设为主力（同环境唯一 primary） | P1 | 功能 | 同环境下存在 ≥2 个渠道 | 1) `PUT /email-channels/:id/primary` 设渠道 B 为主力 | 渠道 B 变为 primary；原主力 A 自动取消 | N（人工） |
| TC-ECH-005 | 发送测试邮件成功（仅 Resend） | P0 | 功能 | 渠道配置真实有效 Resend API Key | 1) `POST /email-channels/:id/test` 传 `recipient` | `code=0`；返回 `messageId`；生成一条 `email.delivered` 的 Webhook 日志 | Y\*（冒烟-扩展，需 `RESEND_API_KEY`+`RESEND_SENDER_EMAIL`） |
| TC-ECH-006 | 非 Resend 服务商发测试信被拒绝（无需真实凭据即可验证） | P1 | 异常 | 创建一个 `providerKey` 非 `resend` 的渠道（如任意占位值） | 1) `POST /email-channels/:id/test` | HTTP 422，`code=42210`「该邮件服务商暂未接入」——**该校验发生在调用外部 API 之前**，因此不需要真实密钥即可复现 | Y（冒烟） |
| TC-ECH-007 | API Key 响应中掩码显示 | P1 | 安全 | 已存在配置 Key 的渠道 | 1) `GET /email-channels` | 返回体中 `apiKey` 显示为掩码 | N（人工核查） |
| TC-ECH-008 | 删除邮件渠道 | P1 | 功能 | 已存在测试渠道 | 1) `DELETE /email-channels/:id` | `code=0` | Y（冒烟，清理步骤） |
| TC-ECH-009 | 配额进度展示（`dailyQuota`/`sentToday`） | P2 | UI | 已发送过测试邮件的渠道 | 1) 查看渠道卡片配额进度条 | 展示 `sentToday/dailyQuota` 比例，与后端数据一致 | N（人工） |
| TC-ECH-010 | 发信失败（无效 Key）返回 502 | P2 | 异常 | 渠道为 `resend` 但 `apiKey` 无效 | 1) `POST /email-channels/:id/test` | HTTP 502，`code=50210`「邮件发送失败: …」；**该失败路径不会写入 Webhook 日志、不会累加 `sentToday`**（与 TC-ECH-005 成功路径的落库行为不同，需重点区分回归） | N（需真实网络但故意用无效 Key，建议人工验证） |
| TC-ECH-011 | `GET /email-channels` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /email-channels` | `code=0` | Y（冒烟） |

---

## 18. 邮件模板（`/email-templates`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-ETPL-001 | 创建邮件模板（多语言） | P1 | 功能 | 已登录 | 1) 新建模板，填写多语言内容 | 创建成功，各语言版本均可保存 | N（人工） |
| TC-ETPL-002 | 克隆已有模板 | P2 | 功能 | 存在模板 | 1) 点击「克隆」 | 生成一份内容相同的新模板（草稿态） | N（人工） |
| TC-ETPL-003 | 编辑模板并保存 | P1 | 功能 | 存在模板 | 1) 修改内容后保存 | `code=0`，内容更新成功 | N（人工） |
| TC-ETPL-004 | 测试发送模板邮件 | P1 | 功能 | 存在模板+可用邮件渠道 | 1) 点击「测试发送」 | 邮件按模板内容发出（依赖真实渠道凭据） | N（人工） |
| TC-ETPL-005 | 删除模板 | P2 | 功能 | 存在模板 | 1) 删除操作 | `code=0` | N（人工） |
| TC-ETPL-006 | `GET /email-templates` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /email-templates` | `code=0` | Y（冒烟） |

---

## 19. 邮件 Webhook（`/email-webhooks`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-EWH-001 | 邮件送达回执列表查询 | P1 | 功能 | 已登录 | 1) `GET /email-webhooks` | `code=0` | Y（冒烟） |
| TC-EWH-002 | 送达率统计展示 | P2 | UI | 存在送达数据 | 1) 查看统计卡片 | 送达率计算正确 | N（人工） |
| TC-EWH-003 | 导出 CSV | P2 | 功能 | 存在数据 | 1) 点击导出 | 成功下载 | N（人工） |
| TC-EWH-004 | `GET /email-webhooks` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /email-webhooks` | `code=0` | （与 TC-EWH-001 合并执行） |

---

## 20. 应用管理（`/apps`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-APP-001 | 6 步 Wizard 完整接入新应用成功 | P0 | 功能 | 已登录 | 1) 依次完成基础信息/渠道/商品/折扣/邮件/语言 6 步 2) 点击「完成接入并生成应用」 | 应用创建成功，各步骤配置均正确关联 | N（复杂多步表单，建议人工验证） |
| TC-APP-002 | 编辑已有应用配置 | P1 | 功能 | 存在应用 | 1) `PUT /apps/:id` | `code=0` | N（人工） |
| TC-APP-003 | 删除应用 | P1 | 功能 | 存在测试应用 | 1) `DELETE /apps/:id` | `code=0` | N（人工） |
| TC-APP-004 | 应用卡片列表展示 | P2 | UI | 存在应用 | 1) 查看应用列表页 | 卡片信息（名称/渠道/商品数等）展示正确 | N（人工） |
| TC-APP-005 | `GET /apps` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /apps` | `code=0` | Y（冒烟） |

---

## 21. 结算管理（`/settlements`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-SETTLE-001 | 按 tenant+channel+日生成结算批次 | P0 | 功能 | 存在 `status=done` 的交易 | 1) `POST /settlements/generate`（或对应接口）按日期/渠道/租户生成 | `code=0`；生成批次，初始状态 `PENDING` | N（依赖已完成交易数据，人工/专项） |
| TC-SETTLE-002 | 重复生成同一批次不重复（批次 ID 幂等 `STL-{date}-{channel}-{tenant}`） | P0 | 状态机 | 已生成过一次批次 | 1) 用相同 日期+渠道+租户 再次生成 | 不产生重复批次，返回已存在的批次 | N（人工） |
| TC-SETTLE-003 | 仅 `PENDING` 批次可创建出金申请 | P0 | 状态机 | 存在 `PENDING` 批次 | 1) `POST /settlements/.../payout`（`CreatePayout`） | `code=0`；批次状态变为 `PAID` | N（人工） |
| TC-SETTLE-004 | 出金申请成功后批次状态变为 `PAID` | P0 | 状态机 | 同上 | 见上 | 批次状态由 `PENDING`→`PAID` | N（人工，与003联合验证） |
| TC-SETTLE-005 | 非 `PENDING` 批次再次出金申请被拒绝 | P1 | 异常 | 批次已是 `PAID` | 1) 再次对该批次发起出金 | 请求被拒绝（状态非法） | N（人工） |
| TC-SETTLE-006 | 结算批次详情查看 | P2 | UI | 存在批次 | 1) 打开详情 Sheet | 展示批次明细流水 | N（人工） |
| TC-SETTLE-007 | 结算列表分页/筛选 | P2 | 功能 | 存在多批次 | 1) `GET /settlements?status=PENDING` | 只返回匹配条件批次 | N（人工） |
| TC-SETTLE-008 | `GET /settlements` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /settlements` | `code=0` | Y（冒烟） |

---

## 22. 财务报表（`/reports/revenue`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-FIN-001 | 渠道费率报表展示 | P2 | UI | 存在费率配置 | 1) 查看报表页 | 各渠道费率数据展示正确 | N（人工） |
| TC-FIN-002 | 导出全周期财务清算汇总 | P2 | 功能 | 存在数据 | 1) 点击「导出全周期财务清算汇总」 | 成功下载汇总报表 | N（人工） |
| TC-FIN-003 | 收入报表按时间维度切换 | P2 | 功能 | 存在收入数据 | 1) 切换日/周/月维度 | 图表与数据按对应维度重新聚合 | N（人工） |
| TC-FIN-004 | `GET /reports/revenue` 可正常访问 | P1 | 功能 | 已登录 | 1) `GET /reports/revenue` | `code=0` | Y（冒烟） |

---

## 23. 汇率管理（`/exchange-rates`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-FX-001 | 新增汇率（买卖价） | P1 | 功能 | 已登录 | 1) `POST /exchange-rates` 传币种对+买价+卖价 | `code=0` | N（人工） |
| TC-FX-002 | 30 天走势图展示 | P2 | UI | 存在历史汇率快照 | 1) 查看走势图 | 曲线与历史数据一致 | N（人工） |
| TC-FX-003 | 启用/停用汇率 | P1 | 功能 | 存在汇率记录 | 1) 切换启用状态 | 状态按预期切换 | N（人工） |
| TC-FX-004 | 保存汇率写入历史快照 | P1 | 功能 | 修改汇率并保存 | 1) `POST/PUT` 保存汇率 | 同时写入一条历史快照记录（`ExchangeRateHistory`） | N（人工） |
| TC-FX-005 | 删除汇率 | P2 | 功能 | 存在汇率记录 | 1) 删除操作 | `code=0` | N（人工） |
| TC-FX-006 | `GET /exchange-rates` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /exchange-rates` | `code=0` | Y（冒烟） |

---

## 24. 费率规则（`/fee-rules`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-FEE-001 | 新增费率规则（优先级 1-99） | P1 | 功能 | 已登录 | 1) `POST /fee-rules` 传优先级值 | `code=0` | N（人工） |
| TC-FEE-002 | 费率试算工具计算结果正确 | P1 | 功能 | 已配置费率规则 | 1) 输入交易金额试算 | 计算结果与规则定义一致 | N（人工） |
| TC-FEE-003 | 删除费率规则 | P2 | 功能 | 存在规则 | 1) 删除操作 | `code=0` | N（人工） |
| TC-FEE-004 | 优先级冲突时排序规则符合预期 | P2 | 边界 | 存在相同优先级的多条规则 | 1) 触发试算 | 排序/命中规则符合预期优先级顺序 | N（人工） |
| TC-FEE-005 | `GET /fee-rules` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /fee-rules` | `code=0` | Y（冒烟） |

---

## 25. 风控规则与黑名单（`/risk-rules`、`/blacklist`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-RISK-001 | 新增风控规则 | P1 | 功能 | 已登录 | 1) `POST /risk-rules` | `code=0` | N（人工） |
| TC-RISK-002 | 删除风控规则 | P2 | 功能 | 存在规则 | 1) 删除操作 | `code=0` | N（人工） |
| TC-RISK-003 | 加入黑名单 | P1 | 功能 | 已登录 | 1) `POST /blacklist` | `code=0` | N（人工） |
| TC-RISK-004 | 移出黑名单 | P2 | 功能 | 存在黑名单记录 | 1) 删除操作 | `code=0` | N（人工） |
| TC-RISK-005 | 风控规则 Tab 与黑名单 Tab 切换正常 | P2 | UI | 已登录 | 1) 切换 Tab | 两个 Tab 内容分别正确展示 | N（人工） |
| TC-RISK-006 | `GET /risk-rules` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /risk-rules` | `code=0` | Y（冒烟） |
| TC-RISK-007 | `GET /blacklist` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /blacklist` | `code=0` | Y（冒烟） |

---

## 26. 商户审核 / KYB（`/merchant-applications`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-KYB-001 | 商户审核列表查看 | P1 | 功能 | 已登录 | 1) `GET /merchant-applications` | `code=0` | Y（冒烟） |
| TC-KYB-002 | 审核通过（APPROVED） | P0 | 状态机 | 存在待审核商户申请 | 1) `POST /merchant-applications/:id/approve` | 状态变为 `APPROVED` | N（人工） |
| TC-KYB-003 | 审核驳回需填写驳回原因（REJECTED+rejectReason） | P0 | 状态机 | 存在待审核商户申请 | 1) `POST /merchant-applications/:id/reject` 传 `rejectReason` | 状态变为 `REJECTED`，原因已记录 | N（人工） |
| TC-KYB-004 | 驳回原因为空时前端拦截 | P1 | UI | 打开驳回弹窗 | 1) 不填原因直接提交 | 前端拦截，提示必填驳回原因 | N（人工） |
| TC-KYB-005 | `GET /merchant-applications` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /merchant-applications` | `code=0` | （与 TC-KYB-001 合并执行） |

---

## 27. 告警中心（`/alert-rules`、`/alert-history`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-ALERT-001 | 新增告警规则 | P1 | 功能 | 已登录 | 1) `POST /alert-rules` | `code=0` | N（人工） |
| TC-ALERT-002 | 启停告警规则（Toggle `ENABLED`/`DISABLED`） | P1 | 状态机 | 存在规则 | 1) 切换启停状态 | 状态在两值间正确切换 | N（人工） |
| TC-ALERT-003 | 告警历史列表查看 | P1 | 功能 | 已登录 | 1) `GET /alert-history` | `code=0` | Y（冒烟） |
| TC-ALERT-004 | 处理告警历史记录 | P2 | 功能 | 存在未处理告警 | 1) 标记处理/备注 | 状态更新为已处理 | N（人工） |
| TC-ALERT-005 | `GET /alert-rules` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /alert-rules` | `code=0` | Y（冒烟） |

---

## 28. 字典管理（`/dictionary`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-DICT-001 | 新增字典分类成功 | P1 | 功能 | `key` 未被占用 | 1) `POST /dictionary/categories` 传 `key`+`name`(+`parentId`) | `code=0` | Y（冒烟） |
| TC-DICT-002 | 更新字典分类（改名/排序） | P2 | 功能 | 已存在分类 | 1) `PUT /dictionary/categories/:id` | `code=0`，字段更新成功 | N（人工） |
| TC-DICT-003 | 删除系统分类（如 `audit_action`）被拒绝 | P0 | 异常 | - | 1) `DELETE /dictionary/categories/{audit_action的id}` | HTTP 409，`code=40910`「系统分类不可删除」 | Y（冒烟） |
| TC-DICT-004 | 分类下仍有词条时删除分类被拒绝 | P0 | 异常 | 分类下存在 ≥1 个词条 | 1) `DELETE /dictionary/categories/:id` | HTTP 409，`code=40912`「分类下仍有词条，无法删除」 | Y（冒烟） |
| TC-DICT-005 | 新增字典词条（`(namespace, entryKey)` 唯一） | P1 | 功能 | 分类已存在 | 1) `POST /dictionary/entries` 传 `namespace`+`entryKey`+`categoryId` | `code=0` | Y（冒烟） |
| TC-DICT-006 | 删除系统分类下的词条被拒绝 | P0 | 异常 | 词条挂在系统分类（如 `audit_action`）下 | 1) `DELETE /dictionary/entries/:id` | HTTP 409，`code=40913`「系统分类下的词条不可删除」 | Y（冒烟） |
| TC-DICT-007 | 删除有子分类的分类被拒绝 | P1 | 异常 | 分类下存在子分类 | 1) `DELETE /dictionary/categories/{父分类id}` | HTTP 409，`code=40911`「请先删除子分类」 | N（冒烟脚本暂未构造二级分类场景，留作扩展） |
| TC-DICT-008 | 词条多语言编辑（`translations`） | P2 | 功能 | 存在词条 | 1) `PUT /dictionary/entries/:id` 更新 `translations` | 多语言内容正确保存 | N（人工） |
| TC-DICT-009 | 批量删除词条 | P2 | 功能 | 存在多个可删除词条 | 1) 前端多选批量删除 | 逐条调用删除并汇总结果 | N（人工） |
| TC-DICT-010 | 导出 i18n 语言包 | P2 | 功能 | 存在词条数据 | 1) 点击导出 | 成功导出对应语言包文件 | N（人工） |
| TC-DICT-011 | 词条转移分类 | P2 | 功能 | 存在词条与目标分类 | 1) 修改 `categoryId` | 词条归属分类变更成功 | N（人工） |
| TC-DICT-012 | `GET /dictionary/categories` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /dictionary/categories` | `code=0` | Y（冒烟） |
| TC-DICT-013 | `GET /dictionary/entries` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /dictionary/entries` | `code=0` | Y（冒烟） |
| TC-DICT-014 | `GET /dictionary/languages` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /dictionary/languages` | `code=0` | Y（冒烟） |

---

## 29. 审计日志（`/audit-logs`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-AUDIT-001 | 按时间范围筛选审计日志 | P1 | 功能 | 存在跨时间段日志 | 1) `GET /audit-logs?startTime=xxx&endTime=xxx` | 只返回时间范围内日志 | N（人工） |
| TC-AUDIT-002 | 按操作人筛选 | P2 | 功能 | 存在多操作人日志 | 1) `GET /audit-logs?operator=xxx` | 只返回该操作人日志 | N（人工） |
| TC-AUDIT-003 | 按操作类型筛选 | P2 | 功能 | 存在多类型日志 | 1) `GET /audit-logs?action=USER_CREATE` | 只返回匹配类型日志 | N（人工） |
| TC-AUDIT-004 | 关键操作均产生对应审计记录 | P0 | 功能 | 执行创建用户/删除角色等关键操作 | 1) 执行 TC-USR-001/TC-ROLE-004 等 2) 查询审计日志 | 每个关键操作都能在审计日志中找到对应记录（`USER_CREATE`/`ROLE_DELETE` 等） | N（建议作为回归重点，交叉验证其他模块用例执行痕迹） |
| TC-AUDIT-005 | 导出 CSV | P2 | 功能 | 存在日志数据 | 1) 点击导出 | 成功下载 | N（人工） |
| TC-AUDIT-006 | `GET /audit-logs` 列表可正常访问 | P0 | 功能 | 已登录 | 1) `GET /audit-logs` | `code=0` | Y（冒烟） |

---

## 30. 系统参数与定时任务（`/system-configs`、`/scheduled-tasks`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-SYSCFG-001 | 新增系统参数（分类 Tab） | P1 | 功能 | 已登录 | 1) `POST /system-configs` | `code=0` | N（人工） |
| TC-SYSCFG-002 | 编辑/删除系统参数 | P2 | 功能 | 存在参数 | 1) `PUT`/`DELETE /system-configs/:id` | `code=0` | N（人工） |
| TC-SYSCFG-003 | `GET /system-configs` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /system-configs` | `code=0` | Y（冒烟） |
| TC-TASK-001 | 新建定时任务默认状态为 `DISABLED` | P1 | 功能 | 已登录 | 1) `POST /scheduled-tasks` | `code=0`；返回记录 `status=DISABLED` | N（人工） |
| TC-TASK-002 | 启停任务状态（仅接受 `ENABLED`/`DISABLED` 两种取值） | P1 | 边界 | 存在任务 | 1) `PUT /scheduled-tasks/:id/status` 传非法值 | 校验失败；传合法值则正常切换 | N（人工） |
| TC-TASK-003 | 手动触发任务：内置执行器记录一次 SUCCESS 运行 | P1 | 功能 | 存在至少一条定时任务（脚本会在列表为空时自动创建一条） | 1) `POST /scheduled-tasks/:id/trigger` | 当前实现已内置执行器：`code=0`，写入一条 `SUCCESS` 的 run 记录并回写 `lastRunStatus`。历史错误码 `50100` 仍保留在 `apperr` 中但已不再被该接口返回 | Y（冒烟） |
| TC-TASK-004 | 查看任务执行记录（runs） | P2 | 功能 | 任务曾执行过 | 1) `GET /scheduled-tasks/:id/runs` | `code=0`，返回执行历史 | N（人工） |
| TC-TASK-005 | `GET /scheduled-tasks` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /scheduled-tasks` | `code=0` | Y（冒烟） |

---

## 31. 终端客户管理（`/end-users`，前端 tab `users`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-ENDUSER-001 | 录入新客户档案（姓名+有效邮箱必填） | P1 | 功能 | 已登录 | 1) `POST /end-users` 传姓名+邮箱 | `code=0` | N（人工） |
| TC-ENDUSER-002 | 必填项缺失前端拦截 | P2 | UI | 打开新建客户表单 | 1) 姓名或邮箱留空提交 | Toast「请填写客户姓名与有效邮箱！」 | N（人工） |
| TC-ENDUSER-003 | 导出客户列表 CSV | P2 | 功能 | 存在客户数据 | 1) 点击「导出客户列表 (CSV)」 | 成功下载 | N（人工） |
| TC-ENDUSER-004 | 编辑/删除客户档案 | P2 | 功能 | 存在客户 | 1) `PUT`/`DELETE /end-users/:id` | `code=0` | N（人工） |
| TC-ENDUSER-005 | `GET /end-users` 列表可正常访问 | P1 | 功能 | 已登录 | 1) `GET /end-users` | `code=0` | Y（冒烟） |

---

## 32. 仪表盘（`/dashboard/kpi`）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-DASH-001 | `GET /dashboard/kpi` 返回核心指标 | P0 | 功能 | 已登录 | 1) `GET /dashboard/kpi` | `code=0`，返回核心 KPI 数据 | Y（冒烟） |
| TC-DASH-002 | KPI 卡片（总收入/订单数/退款率/活跃渠道）展示正确 | P1 | UI | 存在业务数据 | 1) 打开仪表盘首页 | 4 张 KPI 卡片数值与后端一致 | N（人工） |
| TC-DASH-003 | 流水 Tab 切换（全部/处理中/差错/已完成） | P1 | 功能 | 存在多状态流水 | 1) 切换各 Tab | 表格内容按对应状态筛选 | N（人工） |
| TC-DASH-004 | 趋势图渲染 | P2 | UI | 存在历史数据 | 1) 查看趋势图 | 图表正确渲染，无报错 | N（人工） |
| TC-DASH-005 | 差错快捷处置入口跳转正确 | P2 | UI | 存在差错流水 | 1) 点击快捷处置入口 | 正确跳转到对账/交易详情并预填上下文 | N（人工） |

---

## 33. 全局 / 跨模块（Global）

| 用例ID | 用例标题 | 优先级 | 类型 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|--------|----------|--------|------|----------|----------|----------|--------|
| TC-GLB-001 | `X-App-Env` 切换 live/sandbox 后各模块数据按环境隔离 | P0 | 功能 | 两个环境下各有独立数据 | 1) 分别用 `live`/`sandbox` Header 查询同一业务列表 | 返回不同环境下的数据集（注：当前业务表尚未强制按 `environment` 列过滤，为架构文档标注的演进项，需重点关注是否已落地） | N（人工，需人工确认当前实现是否已完成环境分桶） |
| TC-GLB-002 | 无权限访问页面统一展示拒绝文案 | P0 | UI | 使用低权限角色 | 1) 访问未授权的 tab | 展示「您没有访问该页面的权限」「如需开通，请联系管理员。」 | N（人工） |
| TC-GLB-003 | 侧栏菜单按当前用户 `menuKeys` 动态过滤 | P0 | 权限 | 使用非 SUPER_ADMIN 账号 | 1) 登录后查看侧栏菜单 | 只展示该用户 `menuKeys` 对应的菜单项（及其祖先节点） | N（人工） |
| TC-GLB-004 | `Ctrl/Cmd+K` 快捷键打开 QuickCreateModal | P2 | UI | 已登录 | 1) 按下 `Ctrl/Cmd+K` | 弹出快捷创建面板 | N（人工） |
| TC-GLB-005 | 移动端底栏导航（看板/交易/结算/退款/我的） | P2 | UI | 移动端视口 | 1) 切换底栏 5 个入口 | 均正确跳转到对应页面 | N（人工） |
| TC-GLB-006 | 所有 API 异常响应均遵循统一 `{code,message,data}` 格式 | P0 | 功能 | - | 1) 触发任意错误路径（如 TC-AUTH-003/TC-DICT-003 等） | 响应体均含 `code`/`message`/`data` 三个字段，`data` 在失败时为 `null` | Y（冒烟，在各负向用例断言中隐式覆盖） |
| TC-GLB-007 | 分页参数（`page`/`pageSize`）边界值处理 | P1 | 边界 | - | 1) 传 `page=0`、`page=-1`、`pageSize=100000` 等 | 后端做兜底（如 `page<1` 强制为 1，`pageSize` 超限强制为默认值），不报 500 | N（人工/建议补充专项边界测试脚本） |
| TC-GLB-008 | SQL 注入 / XSS 等恶意输入基础安全校验 | P0 | 安全 | - | 1) 在关键词搜索、姓名等自由文本字段中输入 `' OR 1=1 --`、`<script>alert(1)</script>` 等 | 均被参数化查询/前端转义安全处理，不产生注入或脚本执行 | N（安全专项，建议单独渗透测试） |
| TC-GLB-009 | 并发重复提交（双击按钮）不产生重复数据 | P1 | 功能 | - | 1) 快速连续两次点击「创建」类按钮 | 前端按钮 loading 态阻止重复提交，或后端有幂等保护，不产生两条重复记录 | N（人工） |
| TC-GLB-010 | 会话过期后前端自动跳转登录页并保留返回路径 | P2 | UI | 登录态过期 | 1) Cookie 过期后在业务页操作 | 自动跳转 `#/login`，重新登录后可返回原页面（若已实现） | N（人工） |
| TC-GLB-011 | `GET /healthz` 健康检查通过 | P0 | 功能 | 后端服务已启动 | 1) `GET /healthz` | HTTP 200，`{"status":"ok"}` | Y（冒烟） |
| TC-GLB-012 | `GET /readyz` 就绪检查（PG+Redis）通过 | P0 | 功能 | PostgreSQL、Redis 均已就绪 | 1) `GET /readyz` | HTTP 200 | Y（冒烟） |

---

## 附录 A：状态机与业务规则速查（供设计状态转换类用例参考）

| 域 | 合法状态 | 关键转换规则 |
|----|----------|--------------|
| 用户 | `ACTIVE` / `DISABLED` | `DISABLED` 无法登录 |
| 交易 | `done` / `in_process` / `discrepancy` / `pending_check` | `run` 对账：`in_process`/`pending_check`→`done`；`resolve`：仅 `discrepancy`→`done`，否则 42220 |
| 退款 | `PROCESSING` → `SUCCESS` | 关联交易不存在 → 40401；Creem 侧失败 → 50211 |
| 拒付 | 待响应 → 已提交证据 → （胜诉/败诉） | 需先上传证据才能提交申诉 |
| 结算批次 | `PENDING` → `PAID` | 仅 `PENDING` 可发起出金；批次 ID 幂等 `STL-{date}-{channel}-{tenant}` |
| KYB 商户 | `PENDING`/`IN_REVIEW` → `APPROVED`/`REJECTED` | 驳回需填 `rejectReason` |
| 告警规则 | `ENABLED` ↔ `DISABLED` | 双向自由切换 |
| 定时任务 | `ENABLED` / `DISABLED` | 新建默认 `DISABLED`；手动 trigger 由内置执行器记一条 SUCCESS run（`50100` 已不再返回） |
| Webhook | - | `event_id`/`external_event_id` 幂等；签名失败 → 40102 |
| 商品同步 | `PENDING` / `SYNCED` / `ERROR` | 创建即同步调用 Creem，失败也会落库为 `ERROR` 而非丢弃 |
| 租户 | - | `group_hq` 不可删除 |
| 角色 | 内置 / 自定义 | 内置角色（如 `SUPER_ADMIN`）不可删除 |

## 附录 B：核心错误码速查

| Code | HTTP | 说明 |
|------|------|------|
| 40001 | 400 | 非法的 X-App-Env |
| 40100 | 401 | 未登录或会话已失效 |
| 40101 | 401 | 邮箱或密码错误 |
| 40102 | 401 | Webhook 签名校验失败 |
| 40300 | 403 | 无权限 |
| 40301 | 403 | 内置角色不可删除 |
| 40400 | 404 | 资源不存在 |
| 40401 | 404 | 关联交易流水不存在 |
| 40901 | 409 | 邮箱已注册 |
| 40902 | 409 | 请先删除或转移子部门 |
| 40910 | 409 | 权限包仍被角色引用 / 总部租户不可删除（同码复用于两个场景） |
| 40911 | 409 | 请先删除子分类 |
| 40912 | 409 | 分类下仍有词条，无法删除 |
| 40913 | 409 | 系统分类下的词条不可删除 |
| 42200 | 422 | 参数错误 |
| 42210 | 422 | 该邮件服务商暂未接入（亦用于非 Creem 渠道场景） |
| 42212 | 422 | 请至少选择一个已同步的 Creem 商品 / 渠道未配置 API Secret（同码复用） |
| 42220 | 422 | 仅差错流水可核销 |
| 42901 | 429 | 登录失败次数过多，请 15 分钟后再试 |
| 50100 | 200 | 定时任务执行器未启用（历史码，当前 `POST /scheduled-tasks/:id/trigger` 已改为内置执行器成功路径，不再返回此码） |
| 50210 | 502 | 邮件发送失败 / 渠道连通性测试失败（同码复用） |
| 50211 | 502 | Creem 退款失败 |
| 50212 | 502 | Creem Checkout 创建失败 |

## 附录 C：如何使用本文档配合自动化脚本

1. **冒烟自动化（推荐日常/每次部署后执行）**：运行 `backend/scripts/smoke_test.sh`，会自动执行本文档中标记为 **Y（冒烟）** 的全部用例（CORE 层，无需任何外部凭据），并对标记 **Y\*（冒烟-扩展）** 的用例在提供 `CREEM_API_SECRET`/`RESEND_API_KEY` 等真实凭据后一并执行；执行结束会在 `backend/scripts/reports/` 下生成一份 Markdown 格式的冒烟测试报告，报告中的每一行都会引用本文档对应的用例 ID，可直接互相对照追溯。
2. **渠道+邮件深度 E2E（涉及真实外部调用）**：运行 `backend/scripts/e2e_channel_email_test.sh`，覆盖 TC-PAYCH-003/005、TC-ECH-005 等需要真实 Creem/Resend 联调的深度场景。
3. **浏览器 UI 层 RPA 回归**：导入 `automation/automa/novaspay-automa-workflow.json` 到 Automa 插件，覆盖登录、渠道/邮件配置页面的真实 UI 交互路径。
4. **人工回归**：本文档中标记 **N（人工）** 的用例（约 2/3），建议在每个迭代版本发布前，由 QA 按优先级 P0 > P1 > P2 顺序人工执行，尤其关注状态机类（退款/结算/KYB/拒付）与权限矩阵类用例——这两类是本系统中风险最高、当前自动化覆盖率最低的部分，建议作为后续自动化建设的优先方向。
