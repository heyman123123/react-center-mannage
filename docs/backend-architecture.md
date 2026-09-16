# NovasPay 海外聚合支付中台 — 后端架构文档

> 对应前端仓库：`react-center-mannage`  
> 技术栈：**Go + Gin + GORM + PostgreSQL + Redis** · DI：**go.uber.org/fx**  
> 文档目标：定义一期可交付边界、分层、域划分与演进路径，便于前后端对齐与独立交付。

---

## 1. 背景与目标

### 1.1 系统定位

本系统是 **集团出海聚合支付管理中台**（B 端运营/财务/风控/运维），不是 C 端收银台本身。

**一期（M1）只交付平台基础能力**，让管理端能够登录、按菜单授权访问壳层，并具备字典与统一 API 契约；**不实现支付业务域**。

| 一期做 | 一期不做（二期及以后） |
|--------|------------------------|
| 用户体系：登录、注册（Cookie HttpOnly 会话） | 交易流水、对账、长短款 |
| RBAC：角色、菜单树、部门、系统用户 | 结算出金、退款、拒付 |
| 字典管理 | 支付/邮件渠道、Webhook、商品促销 |
| 统一响应（`ApiResponse` / `PageResult`） | 风控规则、商户 KYB、告警与定时任务 |
| Env 中间件预留（仅注入 `app_env`） | Live/Sandbox 业务数据分桶与密钥隔离 |

全量愿景（中长期仍适用，但**不是一期交付物**）：

- 全渠道交易流水查询、对账、长短款处置
- 结算出金、退款与拒付（Chargeback）工单
- 支付/邮件渠道配置、应用与密钥、Webhook 投递审计
- 商品/折扣/促销、邮件模板
- 汇率、费率规则、风控规则与黑名单、商户 KYB 审核
- 告警规则与处置、系统参数与定时任务
- Live / Sandbox 业务数据与密钥分桶（后续排期）

### 1.2 架构目标

| 目标 | 说明 |
|------|------|
| 可对接前端 | 响应契约对齐现有 `ApiResponse` / `PageResult`（`src/api/types.ts`） |
| 深模块边界 | Handler 薄、Domain 厚；基础设施可替换 |
| 路由可扩展 | Uber FX `group:"routes"` 自动搜集；新模块只加 Module + main 一行 |
| 会话安全 | Cookie HttpOnly；响应体零 token；前端零 token 存储 |
| 可观测 | 请求链路、审计日志可追踪 |
| 可演进 | 模块化单体起步，按域拆服务时 seam 已清晰 |

### 1.3 非目标

**一期：**

- 不实现任何支付业务域（交易、对账、结算、退款、渠道、Webhook、商品促销、邮件、风控 KYB、告警任务等）
- 不要求 Live/Sandbox 业务表 `environment` 列与分桶查询
- 不要求前端 `AppEnvironment` 切换与业务环境 Header 强依赖

**全局（各阶段）：**

- 不实现 C 端收银台收单核心（由独立 Payment Gateway 服务承担）
- 不替代渠道侧（Stripe/PayPal 等）账本，仅做归集、对账与运营配置（业务域上线后）
- 不引入复杂分布式事务；跨模块一致性优先最终一致 + 审计

---

## 2. 总体架构

```
                    ┌─────────────────────────────────────┐
                    │         React Admin (Vite)          │
                    │   hash 路由 / ApiResponse 契约      │
                    └─────────────────┬───────────────────┘
                                      │ HTTPS + Cookie 会话（credentials: include）
                    ┌─────────────────▼───────────────────┐
                    │           API Gateway / Nginx       │
                    │     TLS / 限流 / 静态资源 / 反代     │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────────┐
        │         NovasPay Admin API (Gin + Uber FX Monolith)       │
        │  fx.Provide(Gin) → Modules(group:"routes") → Register     │
        │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
        │  │ Handler │→ │  Service │→ │  Domain  │→ │Repository │ │
        │  └─────────┘  └──────────┘  └──────────┘  └─────┬─────┘ │
        │       │              │                           │       │
        │       │         ┌────▼────┐                 ┌────▼────┐ │
        │       │         │  Redis  │                 │Postgres │ │
        │       │         │ Session │                 │  GORM   │ │
        │       │         │ Cache   │                 └─────────┘ │
        │       │         └─────────┘                              │
        │  ┌────▼──────────────────────────────────────────────┐  │
        │  │ 一期模块：iam · dictionary（可选 ops 审计）         │  │
        │  │ 二期+：payment / ledger / settlement / … Worker    │  │
        │  └───────────────────────────────────────────────────┘  │
        └───────────────────────────────────────────────────────────┘
```

**一期采用模块化单体（Modular Monolith）**：一个可部署进程，内部按业务域分包；进程内调用，避免过早微服务。路由由 FX 按 `group:"routes"` 自动挂载，新增域只需定义 Module 并在 `main` 追加一行。

---

## 3. 逻辑分层（深模块）

| 层 | 职责 | 允许依赖 |
|----|------|----------|
| **Transport / Handler** | HTTP 绑定、鉴权上下文注入、DTO 校验、统一响应 | Service 接口 |
| **Application / Service** | 用例编排、事务边界、缓存策略 | Domain + Repo + Redis |
| **Domain** | 实体、值对象、领域规则、不变量 | 无基础设施 |
| **Infrastructure** | GORM Repo、Redis、时钟、ID | 实现上层接口 |

原则：

- Handler **不写业务 if/else**，只做适配。
- Service 暴露 **用例级接口**（如 `Login`、`Register`、`ListMenus`），而非 CRUD 透传。
- Repository 接口定义在使用方附近（或域包内），实现放在 `internal/infra/persistence`。
- **一个真实适配器不够时不强行抽象**；有内存 Fake + PG 两套实现时再抽 seam。
- 各域通过 `fx.Module` / `fx.Options` 组装；路由以 `RouteFunc` 推入 FX group，由入口统一注册。

---

## 4. 业务域划分（Bounded Context）

对齐前端能力面；**一期只落地标注为 M1 的域**。

| 域 | 代码包 | 阶段 | 核心聚合 / 实体 | 说明 |
|----|--------|------|-----------------|------|
| **Identity & Access** | `iam` | **M1** | User, Role, Menu, Department, Session | 登录、注册、RBAC 菜单树、部门、系统用户 |
| **I18n Dictionary** | `dictionary` | **M1** | DictionaryEntry, Language | 全局多语言词条 |
| **Ops Platform（可选）** | `ops` | **M1 可选** | AuditLog | 若审计算基础能力可独立；否则审计落在 `iam` |
| **Tenant & App** | `tenant` | M2+ | Tenant, PaymentApp, AppSecret | 租户、接入应用、密钥轮换 |
| **Payment Ops** | `payment` | M2+ | ChannelConfig, WebhookLog | 渠道配置、健康探测、Webhook 入站审计 |
| **Billing Ledger** | `ledger` | M2+ | Transaction, Lifecycle, ReconBatch | 流水、生命周期、对账差异 |
| **Settlement** | `settlement` | M2+ | SettlementBatch, PayoutAccount | 结算批次、出金账户 |
| **Refund & Dispute** | `dispute` | M2+ | Refund, Chargeback | 退款审批、拒付证据链 |
| **Catalog & Promo** | `catalog` | M2+ | Product, Discount, Campaign | 商品方案、折扣、促销 |
| **Messaging** | `messaging` | M2+ | EmailChannel, EmailTemplate, EmailWebhook | 邮件渠道与模板、投递回执 |
| **Risk & Compliance** | `risk` | M2+ | RiskRule, Blacklist, MerchantApplication | 风控、黑名单、KYB |
| **Finance Config** | `finance` | M2+ | ExchangeRate, FeeRule | 汇率、费率引擎 |
| **Ops（告警/任务）** | `ops` | M2+ | AlertRule, SystemConfig, ScheduledTask | 告警、参数、定时任务（审计若一期已做则延续） |

跨域规则：

- **IAM 鉴权** 横切所有需登录 Handler；权限判定依据「菜单节点 ID」（一期）及后续「应用授权」。
- **AuditLog** 由 Service 用例显式写入或通过装饰器/中间件采集写操作。
- **一期禁止**在 Module 列表中引入 `payment` / `ledger` / `settlement` 等业务包。

---

## 5. 环境字段与 Env 中间件（基础设施预留）

一期 **保留** `X-App-Env` 注入能力，作为横切基础设施；**不**把 Live/Sandbox 业务分桶写成一期必做能力。

| 维度 | 一期 | 后续排期（M2+） |
|------|------|-----------------|
| 中间件 | 解析 Header `X-App-Env`（缺省 `live`），写入 Gin/context `app_env` | 同左 |
| 业务表 | **不要求** `environment` 列与强制过滤 | 业务表增加 `environment`；查询强制带环境过滤 |
| 密钥 | 一期无渠道密钥 | 渠道 Secret / App Secret 分环境存储 |
| Redis Key | `novas:...`（可不按 env 分桶） | 可选前缀 `novas:{env}:...` |
| 前端 | **不要求** `AppEnvironment` 切换驱动业务 | 按产品需要再对齐 Header |

说明：Env 中间件可在一期挂上，便于二期业务域直接读取 `app_env`；但 Repository **一期不要**假定「必须按 environment 过滤」。

---

## 6. 认证与授权

### 6.1 认证（HttpOnly Cookie，禁止前端持有 Token）

**原则**：会话凭证只通过 **Set-Cookie** 下发；响应体 **不返回** access/refresh token；前端 **不得** 读写删 Cookie，也 **不得** 将 token 存入 localStorage / sessionStorage / 内存全局变量供手动附加。

| 项 | 约定 |
|----|------|
| 注册 | `POST /api/v1/auth/register` 创建用户；成功后可选自动登录（同样只 `Set-Cookie`）或要求再走登录 |
| 登录 | `POST /api/v1/auth/login` 校验通过后，`Set-Cookie` 写入会话 Cookie；JSON `data` 仅含用户摘要等业务字段 |
| Cookie 属性 | `HttpOnly` + `Secure`（生产）+ `SameSite=Lax`（或 `Strict`）+ 合适 `Path`/`Domain`；前端 JS **无法** 读取或修改 |
| Access | 短 TTL Cookie（如 `novas_access`），值为 JWT 或会话 ID |
| Refresh | 可选更长 TTL Cookie（如 `novas_refresh`）；**仅**由服务端刷新接口轮换，前端不接触其内容 |
| 后续请求 | 浏览器自动携带 Cookie（`credentials: 'include'`）；服务端中间件从 Cookie 解析会话（**不**依赖 `Authorization: Bearer`） |
| 凭证刷新 | `POST /api/v1/auth/refresh`：读 Refresh Cookie → 轮换并再次 `Set-Cookie`；响应体无 token |
| 登出 | `POST /api/v1/auth/logout`：服务端失效会话 + `Set-Cookie` 过期清空；前端只调接口，**不**自行删 Cookie |
| 会话探测 | `GET /api/v1/me`：有有效 Cookie 则返回用户；否则 401，前端跳转登录 |
| CSRF | Cookie 会话须配套防护（如 `SameSite` + 双重 Cookie / CSRF Token 头）；写操作校验 |
| CORS | 生产须 `Access-Control-Allow-Credentials: true` + **精确** Origin 白名单（禁止 `*`） |

可选：会话黑名单 / 强制下线写入 Redis（按 `jti` 或 session id）。

### 6.2 授权（RBAC）

对齐前端权限/菜单视图：

1. **菜单树权限**：角色绑定 `menu_permission_ids`（与系统菜单树一致）。
2. **部门继承**：用户所属部门的 `role_keys` 并入有效角色集合。
3. **应用权限**（`app_permission_ids` / `ALL`）：属租户/应用域上线后的扩展，**一期可不实现数据范围按 app 过滤**。

鉴权流程（一期）：

```
Cookie 会话 → 加载用户 → 合并 个人角色 ∪ 部门角色
     → 解析菜单权限集合 → 校验当前路由/资源所需 menu_id
```

菜单 ↔ API 映射表维护在 IAM 域（或配置表），避免前端路由字符串散落在后端。

---

## 7. 数据架构概览

### 7.1 PostgreSQL

- 主库：OLTP（用户、权限、字典、审计）。
- 一期表规模小；大表分区/归档留给业务域上线后。
- 敏感字段（密码哈希除外）：后续渠道 Secret 等须 **应用层加密** 后落库。

### 7.2 Redis 用途（一期）

| 场景 | Key 模式示例 | TTL |
|------|--------------|-----|
| 登录失败次数 | `novas:login:fail:{email}` | 15m |
| Cookie 会话 / Refresh | `novas:sess:{jti}` | 与 refresh Cookie TTL 一致 |
| 权限缓存 | `novas:perm:user:{id}` | 5–30m，变更失效 |
| 接口限流 | `novas:rl:{user}:{route}` | 窗口滑动 |

（业务锁、按 env 的配置缓存等属 M2+。）

### 7.3 核心表

> 详细字段见《技术文档》；此处列聚合级表名。

**一期（M1）必建：**

- **IAM**：`users`, `roles`, `role_menus`, `departments`, `department_roles`, `user_departments`, `user_roles`, `menus`
- **Dictionary**：`dictionary_entries`, `languages`（或等价结构）
- **审计（可选）**：`audit_logs`（可无 `environment` 列；后续再扩展）

**二期及以后：** `tenants`, `apps`, `app_secrets`, `payment_channels`, `payment_webhook_logs`, `transactions`, `transaction_lifecycle`, `recon_batches`, `settlements`, `refunds`, `chargebacks`, `products`, `discounts`, `campaigns`, `email_*`, `risk_rules`, `blacklist`, `merchant_applications`, `exchange_rates`, `fee_rules`, `alert_*`, `system_configs`, `scheduled_tasks` 等。

---

## 8. API 风格与模块映射

### 8.1 统一约定

与前端 `src/api/types.ts` 对齐：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

分页：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

- 前缀：`/api/v1`
- 成功：`code = 0`
- 业务错误：非 0 + 可读 `message`；HTTP 状态码按语义（401/403/404/409/422/500）
- 列表默认分页；写操作返回更新后的资源或 `{ id }`

### 8.2 一期 REST 映射

| 能力 | 建议 REST 前缀 |
|------|----------------|
| Auth | `/api/v1/auth`（login / register / refresh / logout） |
| 当前用户 | `/api/v1/me` |
| 系统用户 | `/api/v1/users` |
| 角色 | `/api/v1/roles` |
| 菜单 | `/api/v1/menus` |
| 部门 | `/api/v1/departments` |
| 字典 | `/api/v1/dictionary`（或 `/api/v1/dictionaries`） |
| 审计（可选） | `/api/v1/audit-logs` |

交易、结算、退款、渠道、应用等前端模块对应的 API **属 M2+**，一期不交付。

---

## 9. 依赖注入与路由自动搜集（Uber FX）

### 9.1 约定

- 统一路由函数类型：`type RouteFunc func(r *gin.RouterGroup)`
- 各业务模块导出 `var Module = fx.Options(...)`，用 `fx.Annotate(NewXxxRoute, fx.ResultTags(\`group:"routes\`"))` 将路由推入组
- `cmd/api/main.go` 只负责：Provide Gin、引入各 Module、`fx.Invoke(RegisterAllRoutes, StartServer)`
- `RegisterAllRoutes` 将组内全部 `RouteFunc` 挂到 `/api/v1`
- **新增模块**：定义 Module + main 追加一行即可
- **模块中间件**在 `NewXxxRoute` 内挂载；**全局中间件**在 `NewGinEngine` / `RegisterAllRoutes` 挂载

### 9.2 一期 Module 列表

```go
fx.New(
    server.Module,       // Gin Engine、全局中间件、RegisterAllRoutes、StartServer
    infra.Module,        // PG、Redis、配置
    iam.Module,          // auth / users / roles / menus / departments
    dictionary.Module,   // 字典
    // ops.Module,       // 可选：仅审计日志
    // 禁止一期引入：payment.Module、ledger.Module、settlement.Module …
)
```

完整可复制示例见 §10 与《技术文档》「路由 / DI」章节。

---

## 10. 仓库与目录结构（建议）

独立后端仓库或本仓 `backend/`：

```
backend/
├── cmd/
│   └── api/
│       └── main.go              # fx.New：Provide + Modules + Invoke
├── configs/
│   ├── config.yaml
│   └── config.example.yaml
├── internal/
│   ├── conf/                    # 配置加载
│   ├── server/                  # NewGinEngine、RegisterAllRoutes、StartServer
│   ├── middleware/              # Auth、Env（预留）、Trace、Recover、CORS、CSRF
│   ├── pkg/                     # 响应封装、错误码、分页、RouteFunc 类型
│   ├── iam/
│   │   ├── module.go            # var Module = fx.Options(...)
│   │   ├── route.go             # NewIAMRoute → RouteFunc，group:"routes"
│   │   ├── handler/
│   │   ├── service/
│   │   ├── domain/
│   │   └── dto/
│   ├── dictionary/
│   │   ├── module.go
│   │   ├── route.go
│   │   └── ...
│   ├── ops/                     # 可选：audit（一期）；告警/任务（M2+）
│   └── infra/
│       ├── persistence/         # GORM models + repos
│       └── cache/               # Redis
├── migrations/                  # golang-migrate 或 Atlas（一期仅 IAM/字典/审计）
├── scripts/
├── docs/
├── go.mod
└── Makefile
```

**二期及以后**再增加 `internal/payment`、`ledger`、`settlement`、`dispute`、`catalog`、`messaging`、`risk`、`finance`、`tenant` 及可选 `cmd/worker`。

### 10.1 路由类型与注册（完整示例）

```go
// internal/pkg/routing/routing.go
package routing

import "github.com/gin-gonic/gin"

// RouteFunc 各业务模块向 FX 推入的路由注册函数。
type RouteFunc func(r *gin.RouterGroup)
```

```go
// internal/iam/route.go
package iam

import (
    "github.com/gin-gonic/gin"
    "github.com/<org>/novaspay-admin-api/internal/middleware"
    "github.com/<org>/novaspay-admin-api/internal/pkg/routing"
)

func NewIAMRoute(
    auth *AuthHandler,
    users *UserHandler,
    roles *RoleHandler,
    menus *MenuHandler,
    depts *DepartmentHandler,
    mw *middleware.Bundle,
) routing.RouteFunc {
    return func(r *gin.RouterGroup) {
        // 公开：登录 / 注册
        authG := r.Group("/auth")
        {
            authG.POST("/login", auth.Login)
            authG.POST("/register", auth.Register)
            authG.POST("/refresh", auth.Refresh)
            authG.POST("/logout", mw.Auth, auth.Logout)
        }

        // 需登录（模块内中间件）
        api := r.Group("", mw.Auth)
        {
            api.GET("/me", auth.Me)
            api.GET("/users", mw.RequireMenu("users"), users.List)
            api.POST("/users", mw.RequireMenu("users"), users.Create)
            // roles / menus / departments …
            _ = roles
            _ = menus
            _ = depts
        }
    }
}
```

```go
// internal/iam/module.go
package iam

import (
    "go.uber.org/fx"
    "github.com/<org>/novaspay-admin-api/internal/pkg/routing"
)

var Module = fx.Options(
    fx.Provide(
        NewAuthHandler,
        NewUserHandler,
        NewRoleHandler,
        NewMenuHandler,
        NewDepartmentHandler,
        NewAuthService,
        NewUserService,
        // … repos
        fx.Annotate(
            NewIAMRoute,
            fx.ResultTags(`group:"routes"`),
        ),
    ),
)

// 编译期确认类型（可选）
var _ routing.RouteFunc = (routing.RouteFunc)(nil)
```

```go
// internal/dictionary/module.go（同模式）
package dictionary

import "go.uber.org/fx"

var Module = fx.Options(
    fx.Provide(
        NewDictionaryHandler,
        NewDictionaryService,
        fx.Annotate(
            NewDictionaryRoute,
            fx.ResultTags(`group:"routes"`),
        ),
    ),
)
```

```go
// internal/server/register.go
package server

import (
    "github.com/gin-gonic/gin"
    "github.com/<org>/novaspay-admin-api/internal/pkg/routing"
)

func RegisterAllRoutes(r *gin.Engine, routes []routing.RouteFunc) {
    v1 := r.Group("/api/v1")
    // 可选：在此挂全局业务前中间件（Auth 白名单外的路由由各模块自行挂 Auth）
    for _, register := range routes {
        register(v1)
    }
}

func StartServer(r *gin.Engine, cfg *Config) {
    // 阻塞或配合 fx.Lifecycle 启动 http.Server
    go r.Run(cfg.Addr)
}
```

```go
// cmd/api/main.go
package main

import (
    "go.uber.org/fx"
    "github.com/<org>/novaspay-admin-api/internal/dictionary"
    "github.com/<org>/novaspay-admin-api/internal/iam"
    "github.com/<org>/novaspay-admin-api/internal/infra"
    "github.com/<org>/novaspay-admin-api/internal/server"
)

func main() {
    fx.New(
        infra.Module,
        server.Module, // Provide NewGinEngine；Invoke RegisterAllRoutes、StartServer
        iam.Module,
        dictionary.Module,
        // ops.Module, // 可选
        fx.Invoke(server.RegisterAllRoutes, server.StartServer),
    ).Run()
}
```

新增域时：实现 `NewXxxRoute` + `Module`，在 `main` 增加一行 `xxx.Module` 即可，无需改动集中式路由表。

---

## 11. 关键用例流（一期）

### 11.1 注册

1. `POST /auth/register` 校验邮箱唯一、密码强度  
2. 密码 Argon2id/bcrypt 哈希落库；默认角色/状态按产品约定  
3. 写 `audit_logs`（REGISTER，若启用）  
4. 返回用户摘要；是否自动 `Set-Cookie` 由产品决定（推荐：仅注册成功，再走登录）

### 11.2 登录

1. `POST /auth/login` 校验邮箱密码  
2. 查有效角色与权限 → 写入 Redis 权限缓存  
3. 签发会话（JWT 或 session id），仅通过 **Set-Cookie** 下发；响应体返回用户摘要；写审计（LOGIN）  
4. 前端根据业务成功进入仪表盘（不存储任何 token）

### 11.3 菜单鉴权访问

1. 浏览器携带 Cookie 请求受保护资源  
2. Auth 中间件解析会话 → RBAC 校验 `menu_id`  
3. Handler 调用 Service → 统一 `WriteOK` / `WriteError`

（对账处置、渠道 Webhook 等用例属 **M2+**，本文不展开为期交付。）

---

## 12. 安全基线

- 全站 HTTPS；生产关闭 Debug 与 Gin 默认日志明文密钥
- CORS 白名单 + Credentials；会话 Cookie 必须 `HttpOnly` + `Secure` + `SameSite`；禁止把 token 放进 JSON 给前端持久化
- 管理端写操作审计（谁、何时、对何资源、前后快照摘要）——一期至少覆盖 IAM / 字典变更
- SQL 仅走 GORM / 参数化；禁止字符串拼接
- CSRF 与 CORS 与 Cookie 会话配套落地
- 后续业务域上线时：Secret 加密存储 + 脱敏；沙箱与生产密钥隔离

---

## 13. 可观测性

- **Trace**：每个请求 `X-Request-Id`，日志贯穿
- **Metrics**：QPS、延迟、登录失败率（一期）；业务指标随域上线补充
- **Logs**：结构化 JSON（zerolog/zap）；禁止打 Secret / Cookie 原文
- **Health**：`/healthz`（进程）、`/readyz`（PG + Redis）

---

## 14. 部署拓扑（一期）

```
[用户] → CDN/Nginx → Admin API (2+ 副本)
                         ├─ PostgreSQL 主从
                         └─ Redis 哨兵/集群
```

配置来自环境变量 / `config.yaml`（12-factor）；密钥走环境变量或 Secret 管理，不进 Git。  
Worker / 对账 Cron 等与业务域一并排期，**一期可不单独部署 Worker**。

---

## 15. v1.0 功能范围

v1.0 作为首发版本，已交付以下能力（模块化单体，单进程部署）：

| 域 | 包路径 | 已交付 |
|----|--------|--------|
| IAM / RBAC | `platform/sys` | 登录注册、用户/角色/部门、菜单、权限包（Casbin）、Cookie 会话 |
| 字典 | `platform/dictionary` | 多语言词条与分类 |
| 审计 / 运维 | `platform/audit`、`platform/ops` | 操作审计、系统参数、定时任务、告警 |
| 租户 | `platform/tenant` | 多 BU 租户 |
| 邮件 | `platform/messaging` | Resend 渠道、模板、Webhook 回执 |
| 支付 | `payment` | Creem 渠道、Webhook、流水、退款/拒付、对账 |
| 商品 | `catalog` | 商品/折扣（同步 Creem） |
| 运营扩展 | `biz` | 接入应用、结算、促销、终端客户、汇率/费率、风控、KYB、报表 |

**后续演进方向**（非 v1 范围）：业务表 Live/Sandbox 分桶、流水分区归档、独立 Worker、按域拆微服务。

---

## 16. 与前端协作清单

- [ ] 确认 `VITE_API_BASE_URL` 与 Vite 代理配置
- [ ] 错误码表共享（前端 Toast 文案）
- [ ] OpenAPI/Swagger 由后端生成，前端可选 codegen
- [ ] Cookie 名 / Domain / SameSite / CSRF 方案与前端 `credentials: 'include'` 对齐
- [ ] 确认前端 **零** token 存储（不读 Cookie、不用 localStorage 存会话凭证）
- [ ] 一期 **不要求** 前端依赖 `AppEnvironment` / Live·Sandbox 业务切换
- [ ] Env Header（`X-App-Env`）仅作预留：前端可暂不发送；后端缺省 `live`

---

## 17. 相关文档

- [后端技术文档](./backend-technical.md) — 工程规范、FX 路由/DI、中间件、GORM/Redis、一期 DDL 与登录 Cookie 接口、部署

---

*文档版本：v1.0 · 首发版本已包含全量管理端 API；Live/Sandbox 业务分桶与独立 Worker 为后续演进*
