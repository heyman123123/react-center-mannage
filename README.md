# NovasPay 海外聚合支付管理端

集团出海聚合支付 **B 端运营管理中台**（v1.0）。前端 React + Vite，后端 Go + Gin + PostgreSQL + Redis，全链路真实 API，无 Mock 层。

## 功能范围

| 模块 | 能力 |
|------|------|
| 平台 | 登录/注册、用户/角色/部门、菜单、权限包（Casbin）、字典、审计 |
| 租户 | 多 BU 租户管理 |
| 支付 | Creem 渠道、Webhook、交易流水、退款/拒付、对账 |
| 商品 | 商品/折扣 CRUD（同步 Creem） |
| 邮件 | Resend 渠道、多语言模板、投递回执 |
| 运营 | 接入应用、结算、促销、终端客户、汇率/费率、风控、KYB、告警、财务报表 |

## 快速启动

### Docker 一键部署（推荐）

适合内部运营单机环境，包含 Postgres、Redis、API 与 Nginx 前端：

```bash
cp .env.docker.example .env   # 编辑 NOVAS_JWT_SECRET 等
make docker-up                # 或 docker compose up -d --build
```

访问 `http://localhost:3000`，默认管理员 `admin@novaspay.global` / `Admin@123456`。

详见 [Docker 部署文档](./docs/deploy/docker.md)。

### 本地开发

#### 1. 后端

```bash
cd backend
make run    # 拉起 Postgres(5433) + Redis(6380) + API(:8080)
```

默认管理员：`admin@novaspay.global` / `Admin@123456`

#### 2. 前端

```bash
cp .env.example .env   # 或手动设置 VITE_API_BASE_URL=/api/v1
npm install
npm run dev          # http://localhost:3000
```

Vite 将 `/api` 代理到 `http://127.0.0.1:8080`，Cookie 会话同源。

#### 3. 健康检查

```bash
curl http://localhost:8080/healthz
```

## 项目结构

```
├── src/                 # React 管理端（hash 路由、i18n）
├── backend/
│   ├── cmd/api/         # 入口
│   ├── internal/
│   │   ├── platform/    # sys / dictionary / audit / ops / tenant / messaging
│   │   ├── payment/     # Creem 支付域
│   │   ├── catalog/     # 商品/折扣
│   │   └── biz/         # 应用/结算/运营扩展
│   └── migrations/      # 启动时幂等种子
└── docs/                # 架构与技术文档
```

## 开发约定

- UI 壳层文案必须走 i18n（见 `AGENTS.md`）
- 会话鉴权：HttpOnly Cookie，`credentials: 'include'`，前端不存 token
- API 前缀：`/api/v1`

## 文档

- [后端 README](./backend/README.md) — API 列表与本地命令
- [架构文档](./docs/backend-architecture.md)
- [技术文档](./docs/backend-technical.md)
- [协作约定](./AGENTS.md)
- [Docker 单机部署](./docs/deploy/docker.md)
