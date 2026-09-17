# 支付场景自动发信 — 设计说明

> 日期：2026-09-16  
> 状态：已确认（方案 1）  
> 范围：应用默认全开邮件事件 + 内部 dispatch API 真发 + DEFAULT 模板回退

## 1. 目标

支付/业务服务在事件发生时调用管理端 API，按应用配置与默认模板经 Resend 真实发信，并写入邮件 Webhook 日志。

## 2. 已确认决策

| 项 | 选择 |
|----|------|
| 范围 | 配置默认全开 + 运行时真发 |
| 触发 | 内部 API（业务方调用），非网关回调内嵌 |
| 收件人 | 调用方传 `to` + 可选 `variables` |
| 鉴权 | `Authorization: Bearer <app.secretKey>` |
| 模板 | 事件→分类映射；优先 `triggerEvent`+语言 ACTIVE；否则 `DEFAULT_<CATEGORY>_EN` |

## 3. 事件映射

| event | category |
|-------|----------|
| `subscription_welcome_receipt` | BILLING |
| `recurring_renewal_success` | BILLING |
| `payment_failed_dunning` | RISK |
| `subscription_canceled_notice` | LIFECYCLE |
| `security_password_reset` | SECURITY |

`PROMOTION` / `SYSTEM` 仅保留 DEFAULT seed，不挂上述支付事件。

## 4. API

`POST /api/messaging/dispatch`（App Secret，无 Cookie 会话）

```json
{
  "event": "subscription_welcome_receipt",
  "to": "user@example.com",
  "language": "en-US",
  "variables": { "customer_name": "Ada", "amount": "9.99" }
}
```

- `language` 缺省：`app.defaultLanguage` → `en-US`
- `enabledEmailEvents` 缺失/空 → 视为全部 5 事件已启用
- 发件人：应用 `senderName/Email` 优先，否则渠道
- 插值：`{{key}}` 简单替换
- 响应：`{ messageId, templateCode, channelId }`；失败写 FAILED 日志

## 5. 非目标

- 不接支付网关回调自动 dispatch
- 不按 customerId 查邮箱
- 不做促销群发 / 复杂字典运行时解析
