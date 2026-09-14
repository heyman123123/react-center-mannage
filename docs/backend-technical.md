# NovasPay 海外聚合支付中台 — 后端技术文档

> 配套文档：[后端架构文档](./backend-architecture.md)  
> 技术栈：**Go 1.22+ · Gin · GORM · PostgreSQL 15+ · Redis 7+ · go.uber.org/fx**  
> 本文档面向实现与联调，尽量可执行、少空话。  
> **一期范围**：IAM（登录/注册、用户、角色、菜单、部门）+ 字典 + 统一响应 + Cookie 会话 + Env 中间件预留；**不含**支付业务域。

---

## 1. 技术选型与理由

| 组件 | 选型 | 理由 |
|------|------|------|
| HTTP | Gin | 生态成熟、中间件齐全，适合管理端 CRUD + 中等复杂度编排 |
| DI / 生命周期 | Uber FX | 模块化组装；`group:"routes"` 自动搜集路由，新增域零改集中路由表 |
| ORM | GORM | 与 PG 契合好；迁移、预加载、软删开箱即用 |
| DB | PostgreSQL | 强约束、JSONB 演进空间（业务域上线后 Webhook payload 等） |
| Cache | Redis | 会话、权限缓存、限流 |
| 迁移 | golang-migrate 或 Atlas | 版本化 DDL，禁止只靠 AutoMigrate 上生产 |
| 日志 | zap / zerolog | 结构化、低分配 |
| 配置 | Viper / envconfig | 12-factor，环境变量覆盖 YAML |
| 鉴权 | Cookie 会话（可选 JWT 载荷）+ Redis | Access/Refresh **仅**经 HttpOnly Cookie 下发；响应 JSON **无** token |

---

## 2. 工程约定

### 2.1 Go Module

```text
module github.com/<org>/novaspay-admin-api

go 1.22
```

### 2.2 包命名

- `internal/<domain>/`：业务域，不对外 import
- `handler` 只依赖 `service` 接口，不依赖 GORM
- 禁止 `internal` 被外部模块引用
- 各域导出 `var Module = fx.Options(...)`；路由经 `fx.Annotate(..., fx.ResultTags(\`group:"routes\`"))` 推入

### 2.3 错误处理

```go
// 业务错误：带稳定错误码，供前端映射
type AppError struct {
    Code    int
    Message string
    HTTP    int
    Err     error // 可选根因，日志用，不返回前端
}
```

Handler 统一：

```go
if err != nil {
    WriteError(c, err) // 识别 AppError / validation / 其他 → 500
    return
}
WriteOK(c, data)
```

### 2.4 统一响应（对齐前端）

与 `src/api/types.ts` 中 `ApiResponse` / `PageResult` 一致：

```go
type Response struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
}

type PageResult[T any] struct {
    List     []T   `json:"list"`
    Total    int64 `json:"total"`
    Page     int   `json:"page"`
    PageSize int   `json:"pageSize"`
}
```

- 成功：`code=0`, `message="ok"`
- 与前端 `request.ts` 中 `json.code !== 0` 分支一致

### 2.5 推荐错误码段

| 段 | 含义 |
|----|------|
| 0 | 成功 |
| 40001–40099 | 参数 / 校验 |
| 40100–40199 | 未登录 / 会话失效 |
| 40300–40399 | 无权限 |
| 40400–40499 | 资源不存在 |
| 40900–40999 | 冲突（邮箱已注册、状态非法等） |
| 50000+ | 内部错误 |

---

## 3. 配置

### 3.1 示例 `configs/config.example.yaml`

```yaml
server:
  addr: ":8080"
  mode: debug # release
  read_timeout: 15s
  write_timeout: 30s

postgres:
  dsn: "host=127.0.0.1 user=novas password=secret dbname=novaspay port=5432 sslmode=disable TimeZone=UTC"
  max_open: 50
  max_idle: 10
  max_lifetime: 30m

redis:
  addr: "127.0.0.1:6379"
  password: ""
  db: 0
  prefix: "novas"

auth:
  access_ttl: 2h
  refresh_ttl: 168h
  jwt_secret: "CHANGE_ME"   # 若 Cookie 内嵌 JWT；纯 session id 方案可弱化
  issuer: "novaspay-admin"
  cookie_domain: ""          # 本地可空；生产按域名配置
  cookie_secure: false       # 生产 true
  cookie_same_site: "Lax"    # Lax | Strict

cors:
  origins:
    - "http://localhost:3000"
```

生产用环境变量覆盖：`NOVAS_POSTGRES_DSN`、`NOVAS_AUTH_JWT_SECRET` 等。  
（渠道数据加密 `data_key` 等属 M2+，一期配置可不引入。）

---

## 4. Gin 服务、中间件与 FX 路由

### 4.1 中间件顺序（建议）

```
Recovery → RequestID → AccessLog → CORS → Timeout → CSRF（写操作）
  → [可选全局] AppEnv（预留）
  → 各模块 RouteFunc 内：Auth（除白名单）→ RBAC → Handler
```

全局中间件在 `NewGinEngine`（或 `RegisterAllRoutes`）挂载；模块级 Auth/RBAC 在 `NewXxxRoute` 内挂载。

### 4.2 Auth 白名单（一期）

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`（依赖 Refresh Cookie，响应体无 token）
- `GET /healthz`、`GET /readyz`

（`/api/v1/hooks/*` 属渠道 Webhook，**M2+**，一期不注册。）

### 4.3 AppEnv 中间件（预留，非业务分桶）

一期只把环境写入 context，**不**据此强制过滤业务表（一期也无支付业务表）。

```go
// Header: X-App-Env: live | sandbox
// 缺省 live；非法值可返回 40001，或宽松回落为 live（产品二选一，建议宽松）
env := c.GetHeader("X-App-Env")
if env == "" {
    env = "live"
}
c.Set("app_env", env)
```

后续（M2+）业务 Repository 再按需：

```go
db.Where("environment = ?", env)
```

**不要**在一期要求前端 `AppEnvironment` 切换；前端可不送 Header。

### 4.4 RBAC 中间件

- 路由注册时声明所需 `menu_id` 或权限码：`r.GET("/users", RequireMenu("users"), h.List)`
- 从 Redis 读 `perm:user:{id}`，未命中则回源 PG 并回填
- 一期以菜单权限为主；按 `app_id` 的数据范围属租户域上线后扩展

### 4.5 路由自动搜集（Uber FX）— 完整可复制模式

#### 4.5.1 统一类型

```go
// internal/pkg/routing/routing.go
package routing

import "github.com/gin-gonic/gin"

// RouteFunc 业务模块注册到 /api/v1 下的路由函数。
type RouteFunc func(r *gin.RouterGroup)
```

#### 4.5.2 模块内推入 `group:"routes"`

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
        authG := r.Group("/auth")
        {
            authG.POST("/login", auth.Login)
            authG.POST("/register", auth.Register)
            authG.POST("/refresh", auth.Refresh)
            authG.POST("/logout", mw.Auth, auth.Logout)
        }

        secured := r.Group("", mw.Auth)
        {
            secured.GET("/me", auth.Me)

            secured.GET("/users", mw.RequireMenu("users"), users.List)
            secured.POST("/users", mw.RequireMenu("users"), users.Create)
            secured.PUT("/users/:id", mw.RequireMenu("users"), users.Update)
            secured.DELETE("/users/:id", mw.RequireMenu("users"), users.Delete)

            secured.GET("/roles", mw.RequireMenu("roles"), roles.List)
            secured.POST("/roles", mw.RequireMenu("roles"), roles.Create)
            secured.PUT("/roles/:id", mw.RequireMenu("roles"), roles.Update)
            secured.DELETE("/roles/:id", mw.RequireMenu("roles"), roles.Delete)
            secured.PUT("/roles/:id/permissions", mw.RequireMenu("roles"), roles.UpdatePermissions)

            secured.GET("/menus", mw.RequireMenu("menus"), menus.Tree)
            secured.PUT("/menus", mw.RequireMenu("menus"), menus.ReplaceTree)

            secured.GET("/departments", mw.RequireMenu("departments"), depts.Tree)
            secured.POST("/departments", mw.RequireMenu("departments"), depts.Create)
            secured.PUT("/departments/:id", mw.RequireMenu("departments"), depts.Update)
            secured.DELETE("/departments/:id", mw.RequireMenu("departments"), depts.Delete)
        }
    }
}
```

```go
// internal/iam/module.go
package iam

import "go.uber.org/fx"

var Module = fx.Options(
    fx.Provide(
        NewAuthService,
        NewUserService,
        NewRoleService,
        NewMenuService,
        NewDepartmentService,
        NewAuthHandler,
        NewUserHandler,
        NewRoleHandler,
        NewMenuHandler,
        NewDepartmentHandler,
        // NewUserRepo, ...
        fx.Annotate(
            NewIAMRoute,
            fx.ResultTags(`group:"routes"`),
        ),
    ),
)
```

```go
// internal/dictionary/route.go
package dictionary

import (
    "github.com/gin-gonic/gin"
    "github.com/<org>/novaspay-admin-api/internal/middleware"
    "github.com/<org>/novaspay-admin-api/internal/pkg/routing"
)

func NewDictionaryRoute(h *Handler, mw *middleware.Bundle) routing.RouteFunc {
    return func(r *gin.RouterGroup) {
        g := r.Group("/dictionary", mw.Auth)
        {
            g.GET("/languages", mw.RequireMenu("dictionary"), h.ListLanguages)
            g.GET("/entries", mw.RequireMenu("dictionary"), h.ListEntries)
            g.POST("/entries", mw.RequireMenu("dictionary"), h.CreateEntry)
            g.PUT("/entries/:id", mw.RequireMenu("dictionary"), h.UpdateEntry)
            g.DELETE("/entries/:id", mw.RequireMenu("dictionary"), h.DeleteEntry)
        }
    }
}
```

```go
// internal/dictionary/module.go
package dictionary

import "go.uber.org/fx"

var Module = fx.Options(
    fx.Provide(
        NewService,
        NewHandler,
        fx.Annotate(
            NewDictionaryRoute,
            fx.ResultTags(`group:"routes"`),
        ),
    ),
)
```

#### 4.5.3 引擎、注册与启动

```go
// internal/server/engine.go
package server

import (
    "github.com/gin-gonic/gin"
    "github.com/<org>/novaspay-admin-api/internal/middleware"
)

func NewGinEngine(mw *middleware.Bundle, cfg *Config) *gin.Engine {
    gin.SetMode(cfg.Mode)
    r := gin.New()
    r.Use(
        mw.Recovery,
        mw.RequestID,
        mw.AccessLog,
        mw.CORS,
        mw.Timeout,
        mw.AppEnv, // 预留：仅注入 app_env
    )
    r.GET("/healthz", func(c *gin.Context) { c.Status(200) })
    r.GET("/readyz", mw.Readyz) // ping PG + Redis
    return r
}
```

```go
// internal/server/register.go
package server

import (
    "context"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "go.uber.org/fx"
    "github.com/<org>/novaspay-admin-api/internal/pkg/routing"
)

// RegisterAllRoutes 将 FX 搜集到的全部 RouteFunc 挂到 /api/v1。
func RegisterAllRoutes(r *gin.Engine, routes []routing.RouteFunc) {
    v1 := r.Group("/api/v1")
    for _, register := range routes {
        register(v1)
    }
}

func StartServer(lc fx.Lifecycle, r *gin.Engine, cfg *Config) {
    srv := &http.Server{
        Addr:         cfg.Addr,
        Handler:      r,
        ReadTimeout:  cfg.ReadTimeout,
        WriteTimeout: cfg.WriteTimeout,
    }
    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            go srv.ListenAndServe()
            return nil
        },
        OnStop: func(ctx context.Context) error {
            shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
            defer cancel()
            return srv.Shutdown(shutdownCtx)
        },
    })
}
```

```go
// internal/server/module.go
package server

import "go.uber.org/fx"

var Module = fx.Options(
    fx.Provide(NewGinEngine),
    // middleware.Bundle、Config 可由 infra / conf Provide
)
```

注入路由组时，`RegisterAllRoutes` 的第二参数需带 tag：

```go
fx.Invoke(
    fx.Annotate(
        RegisterAllRoutes,
        fx.ParamTags(``, `group:"routes"`),
    ),
    StartServer,
)
```

或在函数签名上使用：

```go
func RegisterAllRoutes(
    r *gin.Engine,
    routes []routing.RouteFunc `group:"routes"`,
) { /* ... */ }
```

（以项目采用的 FX 版本注解方式为准；核心是 **ResultTags `group:"routes"` + 消费侧 group 注入**。）

#### 4.5.4 `cmd/api/main.go`

```go
package main

import (
    "go.uber.org/fx"
    "github.com/<org>/novaspay-admin-api/internal/conf"
    "github.com/<org>/novaspay-admin-api/internal/dictionary"
    "github.com/<org>/novaspay-admin-api/internal/iam"
    "github.com/<org>/novaspay-admin-api/internal/infra"
    "github.com/<org>/novaspay-admin-api/internal/server"
)

func main() {
    fx.New(
        conf.Module,
        infra.Module,
        server.Module,
        iam.Module,
        dictionary.Module,
        // ops.Module, // 可选：仅审计日志
        fx.Invoke(
            fx.Annotate(
                server.RegisterAllRoutes,
                fx.ParamTags(``, `group:"routes"`),
            ),
            server.StartServer,
        ),
    ).Run()
}
```

**新增模块**：实现 `NewXxxRoute` + `var Module`，在 `main` 追加一行 `xxx.Module` 即可。  
**一期不要**加入 `payment` / `ledger` / `settlement` 等业务 Module。

---

## 5. GORM + PostgreSQL

### 5.1 初始化

```go
db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
    Logger: logger.Default.LogMode(logger.Warn),
    NowFunc: func() time.Time { return time.Now().UTC() },
})
sqlDB, _ := db.DB()
sqlDB.SetMaxOpenConns(cfg.MaxOpen)
sqlDB.SetMaxIdleConns(cfg.MaxIdle)
sqlDB.SetConnMaxLifetime(cfg.MaxLifetime)
```

### 5.2 Model 规范（一期）

```go
type BaseModel struct {
    ID        string         `gorm:"type:uuid;primaryKey"`
    CreatedAt time.Time      `gorm:"not null"`
    UpdatedAt time.Time      `gorm:"not null"`
    DeletedAt gorm.DeletedAt `gorm:"index"` // 配置类软删
}
```

- 主键：UUID（或 ULID 字符串），与前端 `id` 字符串兼容
- 时间：UTC 存储；API 输出 ISO8601 或 `2006-01-02 15:04:05`
- JSON：`datatypes.JSON` / `jsonb`（字典 translations、菜单 meta 等）

**关于 `EnvScoped`：** 业务表 `environment` 列与按环境 Scope 属 **M2+**。一期模型不必嵌入 `EnvScoped`；Env 中间件仅注入 context。

### 5.3 事务

```go
err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
    // 例如：更新角色 + 重写 role_menus + 写 audit
    return nil
})
```

### 5.4 迁移

- 开发可 `AutoMigrate` 加速，**生产只跑 migrations/**
- 一期迁移仅覆盖 users/roles/menus/departments/dictionary（及可选 audit_logs）

### 5.5 一期核心表 DDL

```sql
-- 系统用户
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         CITEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  status        VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE|DISABLED
  avatar_text   TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY,
  key         VARCHAR(64) NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_custom   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE role_menus (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL,
  PRIMARY KEY (role_id, menu_id)
);

-- 应用权限绑定属租户/应用域；一期可暂缓 role_apps
-- CREATE TABLE role_apps (...);  -- M2+

CREATE TABLE departments (
  id          UUID PRIMARY KEY,
  parent_id   UUID REFERENCES departments(id),
  name        TEXT NOT NULL,
  code        VARCHAR(64) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 1,
  leader      TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE department_roles (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_key      VARCHAR(64) NOT NULL,
  PRIMARY KEY (department_id, role_key)
);

CREATE TABLE user_departments (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

CREATE TABLE user_roles (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key VARCHAR(64) NOT NULL,
  PRIMARY KEY (user_id, role_key)
);

CREATE TABLE menus (
  id         UUID PRIMARY KEY,
  parent_id  UUID REFERENCES menus(id),
  key        VARCHAR(128) NOT NULL UNIQUE, -- 稳定权限码，如 users / dictionary
  title      TEXT NOT NULL,                -- 配置下发标题；前端可直接展示
  path       TEXT,
  icon       TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  hidden     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE languages (
  code       VARCHAR(16) PRIMARY KEY, -- zh-CN, en-US
  name       TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 1
);

CREATE TABLE dictionary_entries (
  id           UUID PRIMARY KEY,
  namespace    VARCHAR(128) NOT NULL,
  entry_key    VARCHAR(256) NOT NULL,
  description  TEXT,
  translations JSONB NOT NULL DEFAULT '{}', -- {"zh-CN":"...","en-US":"..."}
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ,
  UNIQUE (namespace, entry_key)
);

CREATE INDEX idx_dict_ns ON dictionary_entries (namespace);

-- 审计（可选；亦可放在 iam 域逻辑写入）
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY,
  action          VARCHAR(64) NOT NULL,
  user_id         UUID,
  user_name       TEXT,
  role            TEXT,
  target_resource TEXT,
  target_id       TEXT,
  details         TEXT,
  ip_address      TEXT,
  status          VARCHAR(16),
  created_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
```

> 交易、渠道、结算、退款等 DDL **不在一期迁移**；业务表增加 `environment` 列与分桶索引属后续排期，见架构文档演进路线。

### 5.6 列表查询模式（一期示例：用户）

```go
func (r *UserRepo) List(ctx context.Context, q ListQuery) (items []User, total int64, err error) {
    db := r.db.WithContext(ctx).Model(&User{})
    if q.Keyword != "" {
        db = db.Where("(email ILIKE ? OR name ILIKE ?)", "%"+q.Keyword+"%", "%"+q.Keyword+"%")
    }
    if q.Status != "" {
        db = db.Where("status = ?", q.Status)
    }
    if err = db.Count(&total).Error; err != nil {
        return
    }
    err = db.Order("created_at DESC").
        Offset((q.Page - 1) * q.PageSize).
        Limit(q.PageSize).
        Find(&items).Error
    return
}
```

---

## 6. Redis 技术细节

### 6.1 客户端

```go
rdb := redis.NewClient(&redis.Options{
    Addr:     cfg.Addr,
    Password: cfg.Password,
    DB:       cfg.DB,
})
```

Key 统一前缀：`{prefix}:{biz}:...`。一期可不强制 `{env}` 段；M2+ 业务分桶启用后再扩展。

### 6.2 权限缓存

```text
SET novas:perm:user:{userId}  <json>  EX 600
DEL novas:perm:user:{userId}          # 角色/部门/菜单变更时
```

JSON 内容建议：

```json
{
  "menu_ids": ["..."],
  "menu_keys": ["users", "roles", "dictionary"],
  "role_keys": ["SUPER_ADMIN"]
}
```

### 6.3 限流

对登录、注册接口：滑动窗口或令牌桶（Redis + Lua）。

### 6.4 Cookie 会话 / Refresh

```text
SET novas:sess:{jti} {userId} EX {refresh_ttl}
DEL 同上  // logout / 强制下线
```

Cookie 建议名：`novas_access`、`novas_refresh`。值可为签名 JWT 或不透明 session id（推荐 session id + Redis，便于强制下线）。

---

## 7. 认证实现要点（Cookie）

### 7.1 密码

- 使用 **bcrypt**（cost ≥ 12）或 **argon2id**
- 禁止可逆加密

### 7.2 会话载荷（仅服务端 / Cookie，不下发到 JSON）

若 Cookie 内嵌 JWT，Claims 示例：

```json
{
  "sub": "user-uuid",
  "name": "Eddie Lake",
  "jti": "access-jti",
  "exp": 123,
  "iss": "novaspay-admin"
}
```

说明：即使启用 Env 中间件，也 **不要**把业务环境绑死在会话里；`app_env` 以 Header（或缺省）为准，与会话解耦。

### 7.3 注册接口

`POST /api/v1/auth/register`

请求：

```json
{
  "email": "a@novaspay.global",
  "password": "******",
  "name": "新用户"
}
```

响应 `data`（**禁止**出现 token 字段）：

```json
{
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

冲突（邮箱已存在）→ `409xx`。是否注册后自动登录由产品决定；若自动登录，同样只 `Set-Cookie`，JSON 仍无 token。

### 7.4 登录接口（Cookie 下发，响应无 token）

`POST /api/v1/auth/login`

请求：

```json
{ "email": "a@novaspay.global", "password": "******" }
```

响应头（示例）：

```http
Set-Cookie: novas_access=...; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200
Set-Cookie: novas_refresh=...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
```

响应 `data`（**禁止**出现 `access_token` / `refresh_token` / 任何可被前端持久化的凭证字段）：

```json
{
  "user": { "id": "...", "name": "...", "email": "...", "role_keys": [] }
}
```

前端：`credentials: "include"` 调用；成功后跳转仪表盘。**禁止**把 Cookie 内容读出、禁止 localStorage/sessionStorage 存会话凭证。登出只调 `POST /auth/logout`，由服务端清 Cookie。

### 7.5 Auth 中间件

- 从 Cookie（非 `Authorization`）解析会话；无效 / 缺失 → `401`
- `POST /auth/refresh`：校验 Refresh Cookie → 轮换双 Cookie → JSON 无 token
- CSRF：对非安全方法进行校验（与 `SameSite` 策略配套）
- CORS：`Access-Control-Allow-Credentials: true` + 精确 Origin 白名单

---

## 8. API 清单（一期）

### 8.1 Auth / IAM

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录（Set-Cookie，JSON 无 token） |
| POST | `/api/v1/auth/refresh` | 刷新会话 Cookie |
| POST | `/api/v1/auth/logout` | 登出并清空 Cookie |
| GET | `/api/v1/me` | 当前用户 + 有效权限摘要 |
| GET/POST/PUT/DELETE | `/api/v1/users` | 系统用户 |
| GET/POST/PUT/DELETE | `/api/v1/roles` | 角色 |
| PUT | `/api/v1/roles/:id/permissions` | 菜单权限 |
| GET/POST/PUT/DELETE | `/api/v1/departments` | 部门树 |
| GET/PUT | `/api/v1/menus` | 菜单树 |

### 8.2 字典

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/dictionary/languages` | 语言列表 |
| GET | `/api/v1/dictionary/entries` | 词条分页列表 |
| POST/PUT/DELETE | `/api/v1/dictionary/entries` | 词条写操作 |

### 8.3 审计（可选）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/audit-logs` | 审计分页列表 |

### 8.4 明确不在一期

交易、对账、结算、退款、支付渠道、应用密钥、Webhook、商品促销、邮件、风控 KYB、告警与定时任务等 API — **M2+**。

### 8.5 查询参数约定

```
GET /api/v1/users?page=1&pageSize=20&keyword=&status=
Cookie: 自动携带（credentials: include）
```

一期列表接口 **不依赖** `X-App-Env`；该 Header 仅预留给后续业务域。

---

## 9. 加密与脱敏（一期说明）

- 一期敏感数据主要是密码哈希；禁止明文密码落库或写日志。
- 渠道 Secret / Webhook Secret 的 AES-GCM 加解密与掩码展示属 **M2+**（业务密钥上线时再启用 `data_key`）。

---

## 10. Worker / Cron

一期 **可不部署** 对账/结算/汇率等 Worker。若需要「会话清理」或「审计归档」，可用同进程 `robfig/cron` + Redis 锁选主。

业务定时任务（对账、结算、汇率同步、邮件重试）全部 **M2+**。

---

## 11. 测试策略

| 层级 | 内容 |
|------|------|
| Domain | 权限合并（个人角色 ∪ 部门角色）、密码校验边界 |
| Service | 接口 mock Repo + miniredis（登录、注册、会话失效） |
| Handler | `httptest` + 测试 PG；断言 **Set-Cookie** 存在且 JSON **无** token 字段 |
| 迁移 | CI 起 Postgres 跑 migrate up/down |
| FX | 启动测试：注入假 RouteFunc，断言 `/api/v1` 下路由已注册 |

关键不变量测试：

- 登录/注册响应体不含 `access_token` / `refresh_token`
- 无 Cookie 访问 `/me` → 401
- 登出后会话 Cookie 失效
- 禁用用户立即 401（会话失效）
- 无菜单权限 → 403

---

## 12. 本地开发

```bash
# 依赖
docker compose up -d postgres redis

# 迁移（仅一期表）
make migrate-up

# 运行 API
make run-api

# 前端
VITE_USE_MOCK=false VITE_API_BASE_URL=http://localhost:8080/api/v1 npm run dev
```

建议 `docker-compose.yml` 提供 `postgres:15`、`redis:7`。  
联调注意：浏览器跨域时 CORS Origin 白名单须包含前端源，且 `credentials: include`。

---

## 13. 部署与运维

### 13.1 构建

```bash
CGO_ENABLED=0 go build -o bin/api ./cmd/api
```

多阶段 Docker：builder → distroless/alpine。

### 13.2 健康检查

- `GET /healthz` → 200
- `GET /readyz` → ping PG + Redis

### 13.3 日志与配置

- `GIN_MODE=release`
- 日志 JSON 到 stdout，由采集侧收集
- 禁止配置文件提交真实密钥
- Cookie `Secure` 在生产开启

### 13.4 容量粗算（一期）

管理端 IAM/字典 QPS 通常很低；关注：

- 登录暴力破解 → 限流 + 失败计数
- 权限缓存命中率
- 菜单树读写并发（变更时主动失效 Redis）

---

## 14. OpenAPI

- 使用 `swaggo/swag` 或手写 OpenAPI 3，CI 校验与 Handler 同步
- 一期文档覆盖 auth/users/roles/menus/departments/dictionary
- 前端可在关闭 mock 后用同一契约做联调清单

---

## 15. 安全检查清单（一期上线前）

- [ ] JWT Secret / 会话密钥已轮换且非默认值
- [ ] CORS 仅允许可信前端 Origin，且 `Allow-Credentials: true`
- [ ] Cookie：`HttpOnly` + 生产 `Secure` + `SameSite`；登出清空
- [ ] 登录/注册/refresh 响应 JSON **无** token 字段
- [ ] CSRF 方案已落地（或严格 SameSite + 同源部署）
- [ ] IAM / 字典写操作有审计（若启用 audit_logs）
- [ ] 数据库备份与恢复演练
- [ ] Ready 探针已挂载到编排平台

（Webhook 验签、沙箱/生产密钥隔离、业务 env 分桶等列入 **M2+** 上线清单。）

---

## 16. 与架构文档的分工

| 文档 | 回答的问题 |
|------|------------|
| [架构文档](./backend-architecture.md) | 一期边界、域划分、演进、Cookie 原则、FX 目录与组装意图 |
| **本文** | 怎么配、怎么写 FX 路由/中间件/表/登录 Cookie API、怎么跑起来 |

---

## 17. FX 组装速查（一期）

```
conf.Module
infra.Module          → PG, Redis
server.Module         → NewGinEngine
iam.Module            → RouteFunc @ group:"routes"
dictionary.Module     → RouteFunc @ group:"routes"
[+ ops.Module]        → 可选审计

Invoke:
  RegisterAllRoutes(engine, []RouteFunc `group:"routes"`)
  StartServer
```

新增业务域（M2+）时复制 `dictionary` 模式，**禁止**在未排期时把支付 Module 塞进一期 `main`。

---

*文档版本：v1.1 · 一期平台基础（IAM + 字典 + Cookie 会话 + FX 路由自动搜集）；支付业务与 Live/Sandbox 业务分桶排期至 M2+；实现以迁移文件与 OpenAPI 为最终契约*
