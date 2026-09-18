# 内部运营 v1.1 — 阶段 1～4 + 按月分表

> **Goal:** 在 Creem 单机 Docker 运营闭环基础上，补齐阶段 1～4 交付物，并将**订单流水、支付 Webhook 日志、退款/拒付、审计日志、邮件 Webhook 日志**改为按月物理分表；Webhook 支持**多公网域名**反代，不写死单一域名。

**Architecture:** 模块化单体不变；高写入表通过 `internal/infra/sharding` 路由到 `{logical}_{YYYYMM}`；`cmd/worker` 承载渠道健康与对账定时任务（API 可通过 `NOVAS_EMBEDDED_JOBS=false` 关闭内嵌 goroutine）。

---

## 按月分表（已定案）

| 逻辑表 | 物理表名示例 | 路由键 |
|--------|----------------|--------|
| 支付流水 | `payment_transactions_202609` | `created_at`（UTC 月） |
| 支付 Webhook | `payment_webhook_logs_202609` | `created_at` |
| 退款 | `payment_refunds_202609` | `created_at` |
| 拒付 | `payment_chargebacks_202609` | `created_at` |
| 审计 | `audit_logs_202609` | `created_at` |
| 邮件 Webhook | `email_webhook_logs_202609` | `created_at` |

- **启动：** `sharding.Shards.EnsureOnStartup()` 创建上/当前/下月表；唯一索引名带 `uidx_{YYYYMM}_*` 避免跨表冲突。
- **写入：** Repository 经 `shards.Create*` 按事件时间选表。
- **列表：** 默认扫描最近 24 个月，跨表分页合并（`PaginateAcross`）。
- **按 ID 查：** `display_id` 含 `TX-YYYYMMDD-` 时优先命中对应月；否则倒序扫月。
- **Webhook 幂等：** `event_id` 在最近 24 个月内跨表查找。
- **遗留单表：** 若存在无后缀旧表且当月分表为空，启动时一次性拷贝到当月分表（幂等）。

---

## 阶段 1 — 运营修补

- [x] 折扣启用/停用调用 `PUT /discounts/:id` 持久化 `status`
- [x] Webhook 入站记录 `targetUrl` 存**实际请求路径**（适配多域名反代）
- [ ] E2E：Sandbox 下单 → Webhook → 流水（Runbook 已更新多域名说明）

## 阶段 2 — 数据与权限

- [x] 支付域查询/写入走分表
- [x] `payment_apps` / `settlement_batches` 核心字段列化 + `settlement_batch_items` 子表；启动回填 `data_json`
- [ ] 全链路 `X-App-Env` 强制过滤 — **后续迭代**

## 阶段 3 — 自动化

- [x] `cmd/worker`：渠道健康（5min）+ 对账（1h）
- [x] `NOVAS_EMBEDDED_JOBS` 控制 API 是否内嵌渠道健康 goroutine
- [ ] Webhook 连续失败告警（对接 `alert_rules`）— **后续迭代**

## 阶段 4 — 生产友好

- [x] 已有 `/healthz`、`/readyz`；`NOVAS_COOKIE_SECURE` 生产 HTTPS
- [x] `docker-compose` 增加 `worker` 服务；API 默认 `NOVAS_EMBEDDED_JOBS=false`
- [ ] K8s Helm / Ingress 样例 — **后续迭代**

---

## Webhook（多域名）

Creem 控制台配置的 URL **路径固定**，主机名任意，例如：

```
https://ops-a.example.com/api/v1/hooks/creem/{channelId}
https://pay-hooks.example.net/api/v1/hooks/creem/{channelId}
```

同一 `channelId` 可被多个 Ingress / 隧道指向同一 API 集群；验签仅依赖 `channelId` 与渠道 `Webhook Secret`，与域名无关。

---

## 验收

```bash
cd backend && go test ./... && go build -o /dev/null ./cmd/api ./cmd/worker
npx tsc --noEmit
```

---

## 文件索引

| 区域 | 路径 |
|------|------|
| 分表核心 | `backend/internal/infra/sharding/` |
| 支付服务 | `backend/internal/payment/service/` |
| Worker | `backend/cmd/worker/main.go` |
| Runbook | `docs/runbooks/internal-ops.md` |
