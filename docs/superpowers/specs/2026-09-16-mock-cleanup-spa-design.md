# 假数据清理 / 渠道字典 / 邮件默认模板 / SPA 托管 — 设计说明

> 日期：2026-09-16  
> 状态：已确认  
> 范围：前端壳层假数据清理 + 字典渠道统一 + 租户 UI + 邮件英文默认 seed + Go 托管前端 dist

---

## 1. 目标与非目标

### 1.1 目标

1. 看板「聚合交易流水与清算峰值」：无交易时**空态**，禁止假曲线。
2. 交易流水、费率规则/试算：渠道下拉统一来自字典 **PAYMENT_CHANNEL** 词条。
3. 对账「差错待调账」：笔数 + **真实差异金额**（插值），去掉写死 ¥10,450。
4. 租户管理：去掉「活跃商户」展示与编辑（后端字段可保留默认 0）。
5. 促销邮件：去掉写死 openRate；无数据用 0 / —。
6. 邮件模板：seed 各场景 **en-US ACTIVE** 默认模板。
7. 邮件 webhook：顶部送达率/打开率按**当前列表事件现算**；无数据 —。
8. 前端 `pnpm build` 产物由后端同端口托管（SPA）。

### 1.2 非目标

- 不做真实邮件投递统计服务 / 独立 stats 表。
- 不做「字典 ∩ 租户已启用渠道」交集（本期字典全量即可）。
- 不改 Casbin / 权限包模型。

---

## 2. 渠道字典约定

- 分类：既有 `PAYMENT_CHANNEL`（或后端字典树下等价分类）。
- 词条：`entryKey` = 渠道码（如 `stripe`）；展示名优先 `translations["zh-CN"]`，缺省用 `entryKey`。
- 前端：`src/lib/paymentChannels.ts`（或 hook）拉取字典 entries，供：
  - `TransactionsView` 筛选
  - `FeeRulesView` 表单勾选 + 试算下拉
- Seed：若无渠道词条，在 migrations 中幂等插入常用渠道（stripe/paypal/adyen/…）到 PAYMENT_CHANNEL，避免空下拉。

---

## 3. 假数据与指标

| 位置 | 行为 |
|------|------|
| `TransactionAreaChart` | `transactions.length===0` → 空态文案；删除硬编码 dates/rhythms |
| `reconciliation.json` + View | `t('nodes.discrepancyPending', { count, amount })`，amount = formatCurrency(Σ\|差异\|) |
| `PromoCampaignsView` | 创建/更新不写死 openRate；展示 API 值或 0 |
| `EmailWebhooksView` | deliveryRate = delivered/total；openRate = opened/delivered（或 opened/total，实现固定：**opened/total** 与 **delivered/total**）；分母 0 → `—` |
| 租户 | UI 移除 `activeMerchantsCount`；提交固定 0 |

---

## 4. 邮件默认模板 seed

对每个 `EmailCategory`：`BILLING` / `SECURITY` / `LIFECYCLE` / `RISK` / `PROMOTION` / `SYSTEM`：

- `code` = `DEFAULT_<CATEGORY>_EN`
- `language` = `en-US`
- `status` = `ACTIVE`（或与模型一致的启用态）
- 极简英文 HTML/文本占位
- 幂等：按 code 存在则跳过

---

## 5. SPA 托管

```
pnpm build  →  dist/
复制或 Vite outDir → backend/web/dist
Gin:
  /api/* /healthz /readyz 走 API
  其余 StaticFS(web/dist) + NoRoute → index.html
```

- `Makefile`：`make frontend` 构建并同步到 `backend/web/dist`；`make run` 可选依赖。
- `.gitignore`：可忽略 `backend/web/dist` 或提交空 `.gitkeep`（实现选 ignore + 构建生成）。

---

## 6. 验收

- 无交易时看板图为空态，非假峰。
- 交易/费率渠道选项与字典一致；改字典名后刷新可见。
- 对账差错行金额随数据变。
- 租户表单无活跃商户。
- 邮件模板库至少 6 条英文默认。
- webhook 顶部数字随过滤列表变化；空列表为 —。
- 仅启动 backend，浏览器打开 `:8080` 可登录使用前端。

---

## 7. 已确认决策

- 范围 C（9 点全做）。
- 租户：不要活跃商户。
- 渠道：字典词条即可。
- Webhook KPI：现算。
