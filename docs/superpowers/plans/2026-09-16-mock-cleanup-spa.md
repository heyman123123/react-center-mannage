# Mock Cleanup + Channel Dict + Email Seed + SPA Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉看板/对账/促销/webhook 假数据；交易与费率渠道走字典；租户去掉活跃商户；seed 英文默认邮件；Go 托管前端 dist。

**Architecture:** 前端共用字典渠道 hook；文案/图表空态修正；migrations seed 渠道+邮件；Gin Static+SPA。

**Tech Stack:** React/Vite/i18n、Go Gin、既有 dictionary API。

**Spec:** `docs/superpowers/specs/2026-09-16-mock-cleanup-spa-design.md`

## Global Constraints

- UI 文案 i18n（`AGENTS.md`）。
- Cookie 会话；勿存 token。
- 渠道来源：字典 PAYMENT_CHANNEL 词条全量。
- Webhook KPI：按当前过滤列表现算；分母 0 → `—`。
- 未要求勿 git commit。

---

## File map

| 文件 | 职责 |
|------|------|
| `src/lib/paymentChannels.ts` | 拉取/映射字典渠道 options |
| `src/components/TransactionsView.tsx` | 渠道下拉改字典 |
| `src/components/FeeRulesView.tsx` | 表单+试算渠道改字典 |
| `src/components/TransactionAreaChart.tsx` | 空态，删假曲线 |
| `src/locales/zh-CN/dashboard.json` | 空态文案 |
| `src/locales/zh-CN/reconciliation.json` + `ReconciliationView.tsx` | 差异金额插值 |
| `src/components/TenantManagementView.tsx` | 去掉活跃商户 |
| `src/components/PromoCampaignsView.tsx` | 去掉假 openRate |
| `src/components/EmailWebhooksView.tsx` | KPI 现算 |
| `backend/migrations/seed.go` | 渠道词条 + 英文默认邮件 |
| `backend/internal/server/module.go` | Static + SPA |
| `vite.config.ts` / `Makefile` | outDir 或 copy 到 `backend/web/dist` |

---

### Task 1: paymentChannels helper + seed 渠道词条

**Files:**
- Create: `src/lib/paymentChannels.ts`
- Modify: `backend/migrations/seed.go`（幂等插入 PAYMENT_CHANNEL）

- [ ] **Step 1:** 实现 `loadPaymentChannelOptions(): Promise<{value,label}[]>` 调用现有 dictionary list API（namespace/category 与项目一致，优先 category PAYMENT_CHANNEL 或 namespace `payment_channel`——以现有 PaymentChannelsView / 字典 seed 为准）。
- [ ] **Step 2:** seed 常用渠道词条若缺失。
- [ ] **Step 3:** `make build`（backend）通过。

### Task 2: Transactions + FeeRules 接字典

- [ ] 两视图替换硬编码渠道列表为 hook/state from Task 1。
- [ ] `npx tsc --noEmit`。

### Task 3: 图表空态 + 对账金额 + 租户 + 促销 + webhook KPI

- [ ] TransactionAreaChart 空态 + i18n。
- [ ] reconciliation 插值 amount。
- [ ] Tenant 去掉 activeMerchants UI。
- [ ] Promo 不写死 openRate。
- [ ] EmailWebhooks 现算 KPI。
- [ ] tsc。

### Task 4: 英文默认邮件 seed

- [ ] seed 6 类 DEFAULT_*_EN 模板幂等。
- [ ] make build。

### Task 5: SPA 托管

- [ ] Vite `outDir` → `backend/web/dist` 或 Makefile copy。
- [ ] Gin Static + NoRoute index.html；API 路由优先。
- [ ] 文档：`pnpm build && cd backend && make run`，访问 `:8080`。

### Task 6: 验收

- [ ] 勾选规格 §6；记录报告。

---

执行默认：**本会话 Inline** 连续实现（用户已确认决策）。
