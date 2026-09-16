# biz — 业务域扩展

运营侧业务 API，通过 FX 在 `cmd/api/main.go` 注册。

| 子域 | 路由前缀 | 说明 |
|------|----------|------|
| `apps` | `/api/v1/apps` | 接入应用管理 |
| `settlements` | `/api/v1/settlements` | 结算批次与出金 |
| `promo` | `/api/v1/promo-campaigns` | 促销邮件活动 |
| `endusers` | `/api/v1/end-users` | 终端客户 |
| `finance` | `/api/v1/exchange-rates`、`/fee-rules` | 汇率与费率 |
| `risk` | `/api/v1/risk-rules`、`/blacklist` | 风控与黑名单 |
| `merchant` | `/api/v1/merchant-applications` | 商户 KYB 审核 |
| `alerts` | `/api/v1/alert-rules`、`/alert-history` | 告警规则与历史 |
| `reports` | `/api/v1/reports/revenue` | 财务报表聚合 |

约定：每个子域按 `service/` + `handler/` + `module.go` 组织。
