# 内部运营 Runbook

面向 NovasPay 管理端内部运营团队，指导在 **Creem Sandbox** 环境下完成首笔测试交易与日常排查。

**前置：** 管理端已部署并可登录（见 [Docker 单机部署](../deploy/docker.md)）。生产环境请先修改默认密码并设置 `SEED_DEMO=false`。

---

## 1. 配置 Creem Sandbox 渠道

### 1.1 在 Creem 控制台获取凭证

1. 登录 [Creem Dashboard](https://creem.io)（Sandbox 模式）。
2. 创建或选择 Sandbox 项目，复制 **API Key**（Secret）。
3. 记录 Webhook 签名密钥（若 Creem 提供 `webhook_secret`）。

### 1.2 在管理端创建渠道

1. 登录管理端 → **支付渠道**。
2. 新建渠道：
   - **渠道类型**：`creem`
   - **环境**：`sandbox`
   - **API Secret**：粘贴 Creem API Key
   - **Webhook Secret**（可选）：用于验签
3. 保存后点击 **连通性测试**，确认状态正常。

### 1.3 配置 Webhook URL（支持多域名）

Creem 按**渠道 ID** 区分回调，路径固定为：

```
https://<任意可达公网主机>/api/v1/hooks/creem/{channelId}
```

同一套 API 可同时挂在多个域名或 Ingress 上（例如运营入口域名、专用 Webhook 子域、不同区域的反代）。**无需**在代码或环境变量里配置「唯一 Webhook 域名」；验签只依赖该渠道的 `Webhook Secret` 与路径中的 `{channelId}`。

| 场景 | URL 示例 |
|------|----------|
| 内网穿透 A | `https://tunnel-a.ngrok.io/api/v1/hooks/creem/abc-123` |
| 内网穿透 B | `https://hooks.corp.example/api/v1/hooks/creem/abc-123` |
| 生产 Ingress | `https://ops.example.com/api/v1/hooks/creem/abc-123` |

管理端 **支付 Webhook** 列表中的「目标 URL」记录的是 Creem **实际请求的路径**（含 `/api/v1/...`），便于对照不同域名下的投递。

**注意：** Creem 必须能 HTTPS 访问该 URL；本机 `localhost` 无法直接收 Webhook，需公网入口或隧道。

### 1.4 本机用 ngrok 穿透 API（:8080）

```bash
# 一次性：安装 + 登录（Token 见 https://dashboard.ngrok.com/get-started/your-authtoken）
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <YOUR_TOKEN>

# 终端 A：启动 API
cd backend && make run

# 终端 B：隧道到本机 8080
cd backend && make ngrok
# 或: NGROK_AUTHTOKEN=<token> make ngrok
```

- 隧道详情：`http://127.0.0.1:4040`
- Creem Webhook 填：`https://<ngrok 分配的域名>/api/v1/hooks/creem/<channelId>`
- 配置文件：`backend/scripts/ngrok.yml`（`addr: 8080`）

---

## 2. 创建商品并同步

### 2.1 在 Creem 创建商品

在 Creem Sandbox 中创建 Product，记录 **Product ID**（如 `prod_xxx`）。

### 2.2 在管理端维护商品

1. 进入 **商品管理** → 新建商品。
2. 绑定刚创建的 Creem 渠道，填写名称、价格、币种等。
3. **External Product ID** 填 Creem 的 Product ID。
4. 保存后，对单条商品执行 **同步到渠道**（`POST /api/v1/products/:id/sync`），将本地商品推送到 Creem 或对齐状态。

> 若 Creem 侧已有商品，确保 `external_product_id` 与 Creem Product ID 一致后再做测试下单。

---

## 3. Sandbox 测试下单

1. 打开 **支付渠道** → 选择 Creem Sandbox 渠道 → **测试交易** 侧栏。
2. 填写 **Product ID**（Creem 侧 ID，必填）。
3. 可选填写客户邮箱、成功回调 URL。
4. 点击 **Sandbox 测试下单**。
5. 系统调用 `POST /api/v1/payment-channels/:id/checkout-test`，返回 Checkout URL；浏览器新窗口打开并完成 Sandbox 支付。

支付完成后等待 Creem Webhook 回调（通常数秒内）。管理端 **交易流水** 应出现对应记录。

---

## 4. 查看流水 / 对账 / 退款

### 4.1 交易流水

- 菜单：**交易流水**
- API：`GET /api/v1/transactions`
- 关注字段：渠道、金额、状态、`external_trade_no`（Creem 交易号）

### 4.2 对账

- 菜单：**对账**
- API：`GET /api/v1/reconciliation/summary`、`POST /api/v1/reconciliation/run`
- 按租户/日期范围核对本地流水与渠道侧是否一致。

### 4.3 退款

1. 菜单：**退款** → 新建退款，关联原交易。
2. 提交后执行 **处理退款**（`POST /api/v1/refunds/:id/process`）。
3. Creem 渠道会调用 Creem Refund API；成功或 Webhook 确认后状态变为 SUCCESS。

### 4.4 Webhook 日志

- 菜单：**Webhook 日志**
- API：`GET /api/v1/payment-webhooks`
- 查看每条事件的原始 payload、处理状态与错误信息。

---

## 5. 故障排查：Webhook 未到达

按以下顺序排查：

### 5.1 确认公网可达

```bash
curl -sf -X POST "https://<域名>/api/v1/hooks/creem/<channelId>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

应返回 HTTP 响应（非连接超时）。502/504 检查 Nginx/Ingress 与 `api` 容器。

### 5.2 查 Webhook 日志表

管理端 **Webhook 日志** 或数据库：

```sql
SELECT id, channel_id, event_type, status, external_event_id, error_message, created_at
FROM payment_webhook_logs
ORDER BY created_at DESC
LIMIT 20;
```

| 现象 | 可能原因 |
|------|----------|
| 无记录 | Creem 未投递或 URL 配置错误 |
| `status=FAILED` | 验签失败、payload 解析错误或业务处理异常，查看 `error_message` |
| 重复 `external_event_id` | 正常幂等；系统返回 200 不重复写流水 |

### 5.3 查看 API 日志

```bash
docker compose logs api --tail=200 | grep -i webhook
```

### 5.4 重投递

对已有 Webhook 日志记录，在管理端或通过 API 重试：

```
POST /api/v1/payment-webhooks/:id/redeliver
```

系统从 `payment_webhook_logs` 读取原始 body 重新走处理管道，并写入审计 `PAYMENT_WEBHOOK_REDELIVER`。

### 5.5 渠道健康

支付渠道列表会展示定时探测结果（约每 5 分钟 Ping）。若渠道不健康，先修复 API Key / 网络再重试 Webhook。

---

## 6. 相关文档

- [Docker 单机部署](../deploy/docker.md)
- [后端 API 列表](../../backend/README.md)
- [架构文档](../backend-architecture.md)
