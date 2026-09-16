# NovasPay Admin API

v1.0 管理端后端：IAM（Cookie 会话）+ RBAC 权限包 + 字典/审计 + 租户/邮件 + Creem 支付 + 商品/折扣 + 运营扩展。

## 快速启动

```bash
cd backend
make help   # 查看全部目标
make run    # 拉起 PG/Redis + 编译并启动 API（:8080）
```

| 命令 | 作用 |
|------|------|
| `make up` | 仅启动 Postgres(5433) + Redis(6380) |
| `make run` | up + 编译 `bin/api` 并前台启动 |
| `make stop` | 结束占用 `:8080` 的进程 |
| `make status` | 健康检查 |
| `make down` | 停止 compose |

- Health: `GET http://localhost:8080/healthz`
- API 前缀: `/api/v1`
- 默认管理员：`admin@novaspay.global` / `Admin@123456`

## 前端联调

仓库根目录 `.env`：

```bash
VITE_API_BASE_URL=/api/v1
```

```bash
# 终端 1
cd backend && make run

# 终端 2
npm run dev
```

## API 概览

### 平台（IAM / 字典 / 审计 / 运维）

| 前缀 | 说明 |
|------|------|
| `POST /api/v1/auth/login` | 登录（Set-Cookie） |
| `POST /api/v1/auth/logout` | 登出 |
| `GET/POST/PUT/DELETE /api/v1/users` | 系统用户 |
| `GET/POST/PUT/DELETE /api/v1/roles` | 角色（绑定权限包） |
| `GET/POST/PUT/DELETE /api/v1/permission-packs` | 权限包 |
| `GET/PUT /api/v1/menus` | 菜单树 |
| `GET/POST/PUT/DELETE /api/v1/departments` | 部门 |
| `GET/POST/PUT/DELETE /api/v1/dictionary/*` | 字典词条与分类 |
| `GET /api/v1/audit-logs` | 操作审计 |
| `GET/PUT /api/v1/system-config` | 系统参数 |
| `GET/POST/PUT/DELETE /api/v1/scheduled-tasks` | 定时任务 |

### 租户与邮件

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/tenants` | 租户 CRUD |
| `GET/POST/PUT/DELETE /api/v1/email-channels` | 邮件渠道（Resend） |
| `POST /api/v1/email-channels/:id/test` | 发测试信 |
| `GET/POST/PUT/DELETE /api/v1/email-templates` | 多语言邮件模板 |
| `GET /api/v1/email-webhooks` | 投递回执分页 |

### 支付（Creem）

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/payment-channels` | 支付渠道（`channelKey`: `creem`） |
| `POST /api/v1/payment-channels/:id/test` | 连通性探活 |
| `POST /api/v1/hooks/creem/:channelId` | Creem Webhook 入站 |
| `GET /api/v1/payment-webhooks` | Webhook 日志 |
| `GET/POST/PUT/DELETE /api/v1/products` | 商品 CRUD |
| `GET/POST/PUT/DELETE /api/v1/discounts` | 折扣 CRUD |
| `GET /api/v1/transactions` | 交易流水分页 |
| `GET/POST /api/v1/refunds` | 退款 |
| `GET /api/v1/chargebacks` | 拒付 |
| `GET/POST /api/v1/reconciliation/*` | 对账 |

### 运营扩展（biz）

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/apps` | 接入应用 |
| `GET/POST /api/v1/settlements/*` | 结算批次与出金 |
| `GET/POST/PUT/DELETE /api/v1/promo-campaigns` | 促销邮件活动 |
| `GET/POST/PUT/DELETE /api/v1/end-users` | 终端客户 |
| `GET/POST/PUT/DELETE /api/v1/exchange-rates` | 汇率 |
| `GET/POST/PUT/DELETE /api/v1/fee-rules` | 费率规则 |
| `GET/POST/PUT/DELETE /api/v1/risk-rules` | 风控规则 |
| `GET/POST/DELETE /api/v1/blacklist` | 黑名单 |
| `GET/POST /api/v1/merchant-applications/*` | 商户 KYB |
| `GET/POST/PUT/DELETE /api/v1/alert-rules` | 告警规则 |
| `GET /api/v1/reports/revenue` | 收入报表 |

## Cookie / CORS

- Cookie：`novas_access` / `novas_refresh`，HttpOnly；响应 JSON **无** token
- 本地推荐走 Vite 代理（`:3000` → `:8080`）

## 环境变量

| 变量 | 默认 |
|------|------|
| `NOVAS_HTTP_ADDR` | `:8080` |
| `NOVAS_POSTGRES_DSN` | port=`5433`（compose） |
| `NOVAS_REDIS_ADDR` | `127.0.0.1:6380` |
| `NOVAS_CORS_ORIGINS` | localhost:3000 / 5173 |
