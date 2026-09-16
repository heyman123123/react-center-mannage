# biz — 业务域（二期起）

目录分层约定：

| 路径 | 职责 |
|------|------|
| `internal/conf`、`pkg`、`infra`、`middleware`、`server` | 系统配置与公用底座 |
| `internal/platform/` | 平台能力（sys / dictionary / audit / ops） |
| `internal/biz/` | 业务域（二期起） |

本目录预留给业务域模块，例如：

- `payment/` — 支付 / 订单
- `settlement/` — 结算
- `risk/` — 风控
- …

约定：每个业务域按 `service/` + `handler/` + `module.go` 组织，通过 FX 在 `cmd/api/main.go` 注册。
