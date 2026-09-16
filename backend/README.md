# NovasPay Admin API

一期平台后端：IAM（Cookie 会话）+ 菜单/角色/用户/部门 + 字典；M2 起含租户与邮件（Resend）渠道。

## 快速启动（推荐 Make）

```bash
cd backend
make help   # 查看全部目标
make run    # 拉起 PG/Redis + 编译并启动 API（:8080）
```

常用：

| 命令 | 作用 |
|------|------|
| `make up` | 仅启动 Postgres(5433) + Redis(6380) |
| `make run` | up + 编译 `bin/api` 并前台启动 |
| `make stop` | 结束占用 `:8080` 的进程 |
| `make status` | 健康检查 |
| `make down` | 停止 compose |

- Health: `GET http://localhost:8080/healthz`
- API 前缀: `/api/v1`

默认管理员（首次启动种子）：`admin@novaspay.global` / `Admin@123456`

## 前端联调

仓库根目录 `.env`（可参考 `.env.example`）：

```bash
VITE_API_BASE_URL=/api/v1
```

Vite 将 `/api` 代理到 `http://127.0.0.1:8080`，Cookie 同源落在 `:3000`。

```bash
# 终端 1
cd backend && make run

# 终端 2
npm run dev
```

## M2 API（租户 / 邮件）

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/tenants` | 租户 CRUD |
| `GET/POST/PUT/DELETE /api/v1/email-channels` | 邮件渠道（`mode`: `live` / `sandbox`） |
| `POST /api/v1/email-channels/:id/test` | 发测试信（当前仅 **Resend**） |
| `GET/POST/PUT/DELETE /api/v1/email-templates` | 多语言邮件模板 |
| `GET /api/v1/email-webhooks` | 投递回执分页 |

## M3 API（Creem 支付渠道 / 商品 / 折扣）

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/payment-channels` | 支付渠道账号（`channelKey`: `creem`，`mode`: `live` / `sandbox`） |
| `POST /api/v1/payment-channels/:id/test` | Creem 连通性探活 |
| `POST /api/v1/hooks/creem/:channelId` | Creem Webhook 入站（公开，HMAC 验签） |
| `GET /api/v1/payment-webhooks` | 支付 Webhook 日志分页 |
| `GET/POST/PUT/DELETE /api/v1/products` | 商品 CRUD（创建/更新时推送 Creem） |
| `POST /api/v1/products/:id/sync` | 手动重同步商品至 Creem |
| `GET/POST/DELETE /api/v1/discounts` | 折扣 CRUD（创建时推送 Creem） |
| `GET /api/v1/transactions` | 交易流水分页（Creem Webhook 自动落库） |
| `GET /api/v1/transactions/:id` | 交易流水详情（含时间轴） |

Creem Webhook 事件 `checkout.completed` / `subscription.paid` 等会自动写入 `payment_transactions` 表。

## M4 API（退款 / 拒付 / 对账）

| 前缀 | 说明 |
|------|------|
| `GET/POST /api/v1/refunds` | 退款列表 / 创建退款（按流水号关联交易） |
| `POST /api/v1/refunds/:id/process` | 处理退款（推送 Creem 或标记完成） |
| `GET /api/v1/chargebacks` | 拒付列表 |
| `POST /api/v1/chargebacks/:id/evidence` | 上传拒付证据 |
| `POST /api/v1/chargebacks/:id/submit` | 提交拒付抗辩 |
| `GET /api/v1/reconciliation/summary` | 对账摘要 KPI |
| `GET /api/v1/reconciliation/batches` | 对账批次（按日/渠道聚合） |
| `POST /api/v1/reconciliation/run` | 运行对账引擎 |
| `POST /api/v1/reconciliation/discrepancies/:id/resolve` | 差错核销 |

Webhook 事件 `refund.created` / `dispute.created` 会自动写入 `payment_refunds` / `payment_chargebacks` 表，并联动更新交易流水对账状态。

Creem Base URL：`live` → `api.creem.io`，`sandbox` → `test-api.creem.io`。Webhook 回调建议配置为 `/api/v1/hooks/creem/{channelId}`。

## M5 API（接入应用 / 结算 / 运营扩展）

| 前缀 | 说明 |
|------|------|
| `GET/POST/PUT/DELETE /api/v1/apps` | 接入应用 CRUD |
| `GET /api/v1/settlements` | 结算批次列表 |
| `GET /api/v1/settlements/:id` | 结算批次详情 |
| `POST /api/v1/settlements/generate` | 从交易流水生成结算批次 |
| `POST /api/v1/settlements/payout` | 出金确认 |
| `GET/POST/PUT/DELETE /api/v1/promo-campaigns` | 促销邮件活动 |
| `GET/POST/PUT/DELETE /api/v1/end-users` | 终端客户 |
| `GET/POST/PUT/DELETE /api/v1/exchange-rates` | 汇率管理 |
| `GET /api/v1/exchange-rates/:id/history` | 汇率历史 |
| `GET/POST/PUT/DELETE /api/v1/fee-rules` | 费率规则 |
| `GET/POST/PUT/DELETE /api/v1/risk-rules` | 风控规则 |
| `GET/POST/DELETE /api/v1/blacklist` | 黑名单 |
| `GET /api/v1/merchant-applications` | 商户 KYB 申请列表 |
| `POST /api/v1/merchant-applications/:id/approve` | 审核通过 |
| `POST /api/v1/merchant-applications/:id/reject` | 审核驳回 |
| `GET/POST/PUT/DELETE /api/v1/alert-rules` | 告警规则 |
| `POST /api/v1/alert-rules/:id/toggle` | 启用/禁用告警 |
| `GET /api/v1/alert-history` | 告警历史 |
| `GET /api/v1/reports/revenue` | 收入报表聚合 |
| `POST /api/v1/payment-webhooks/:id/redeliver` | Webhook 重投递 |

## Cookie / CORS

- Cookie：`novas_access` / `novas_refresh`，HttpOnly；响应 JSON **无** token
- 直连后端时 CORS Origin 白名单含 `http://localhost:3000`
- 本地推荐走 Vite 代理，不必直连跨端口

## 环境变量

| 变量 | 默认 |
|------|------|
| `NOVAS_HTTP_ADDR` | `:8080` |
| `NOVAS_POSTGRES_DSN` | port=`5433`（compose） |
| `NOVAS_REDIS_ADDR` | `127.0.0.1:6380` |
| `NOVAS_CORS_ORIGINS` | localhost:3000 / 5173 |
