# NovasPay 管理端 — QA 测试清单（汇总）

> 基于三份代码级静态盘点汇总（前端页面、后端 143 API、支付/邮件/鉴权安全矩阵）。  
> 生成日期：2026-09-17 · **未改业务代码，仅文档**  
> 默认管理员：`admin@novaspay.global` / `Admin@123456`

---

## 0. 测试前必读：当前实现现状

正式开测前先给每个操作打标，避免「界面成功但刷新丢失」假阳性。

| 标签 | 含义 |
|------|------|
| **REAL** | 真实调用后端并持久化 |
| **PARTIAL** | 加载走 API，写操作只改前端内存 |
| **MOCK** | 纯前端模拟（`setTimeout` / alert / Toast） |
| **BROKEN** | UI 入口存在但回调/数据未接通 |

### 0.1 已知断点（影响预期）

1. **无租户切换入口**：登录后默认取租户列表第一项。
2. **PARTIAL/MOCK 写操作**（刷新丢失）：应用启停/密钥轮换、商品上下架、折扣启停、促销创建/派发、邮件模板 CRUD/测试发送、费率/风控/黑名单、汇率、商户审核、告警闭环、结算出金、终端客户建档等。
3. **支付渠道页**：`apps`/`dictionary` 未加载 →「从字典选渠道」可能为空；启停只改本地。
4. **交易差错调账**：`App.tsx` 未传 `onOpenDiscrepancy`，按钮基本无效。
5. **快捷创建交易**：提交后仅关窗，不入列表/后端。
6. **模拟成功**：Webhook 重投、非 Creem 支付测试、财务报表导出、结算出金等。
7. **列表截断**：交易/审计 ≤200；Webhook/字典壳层 ≤100；超限不可见。
8. **后端自动化极少**：`go test ./...` 约 11 项，覆盖加密/Webhook 基础幂等/Checkout/退款 Happy Path；IAM、租户、并发基本空白。

---

## 1. P0 安全与账务门禁（上线阻断）

按优先级执行；任一项失败建议阻断上线。

### 1.1 Creem Webhook

| ID | 用例 | 期望 | 现状风险 |
|----|------|------|----------|
| WH-001 | 正确 HMAC-SHA256 签名 | 200，业务落库 | — |
| WH-002 | 错签/空签/改 Body | 401，无业务数据 | — |
| WH-003 | 渠道 `webhookSecret` 为空 | **应拒绝回调或禁止启用** | 当前接受无签名请求 |
| WH-004 | 同渠道同 `event_id` 重投 2/10/100 次 | 业务只一份 | — |
| WH-005 | 不同渠道同 `event_id` | 各自独立处理 | 全局唯一键会互吞 |
| WH-006 | 无 `event_id` | **应拒绝** | 随机生成，无法幂等 |
| WH-007 | 日志成功、业务失败后 Provider 重试 | **应再处理或标记失败可恢复** | 当前直接 200 吞掉 |
| WH-008 | 超大 Body（1MB/10MB） | 入口限流/拒绝 | 无大小限制 |
| WH-009 | `refund.created` | 只走退款生命周期，不新建销售交易 | 可能污染交易/对账 |
| WH-010 | 前端「重投递」 | 调 `/payment-webhooks/:id/redeliver` | 现为本地模拟 |

### 1.2 退款 / 出金

| ID | 用例 | 期望 | 现状风险 |
|----|------|------|----------|
| REF-001 | 全额/部分退款 E2E | 渠道+本地一致 | — |
| REF-002 | 金额 0 / 负 / 超原单 | **拒绝** | 0/负变全额；可超原单 |
| REF-003 | 累计部分退款 ≤ 可退余额 | 超额拒绝 | 无累计上限 |
| REF-004 | 重复 Process / 并发双人点 | Creem 只调一次 | 无状态锁/幂等 |
| REF-005 | Creem 返回 pending | 本地保持处理中 | 2xx 即标 SUCCESS |
| REF-006 | 跨租户退款 | 403 | 缺对象级租户校验 |
| PAY-001 | 重复出金同一批次 | 冲突/拒绝 | 可重复成功覆盖 |

### 1.3 对账

| ID | 用例 | 期望 | 现状风险 |
|----|------|------|----------|
| REC-001 | 与 Creem/银行真实账单匹配 | 逐笔差异 | 仅把 pending 改 done |
| REC-002 | Sandbox 不进 Live 对账 | 环境隔离 | `X-App-Env` 多未参与查询 |
| REC-003 | 重复跑同一范围 | 幂等，不误改历史 | 批量改 done |
| REC-004 | 核销备注持久化 | DB 可查 | note 未持久化 |

### 1.4 鉴权 / 会话 / CSRF

| ID | 用例 | 期望 | 现状风险 |
|----|------|------|----------|
| AUTH-001 | Cookie HttpOnly / Secure / SameSite | 生产 Secure 强制 | — |
| AUTH-002 | 响应 JSON 无 token | 扫描 login/refresh/me | — |
| AUTH-003 | CSRF：跨站写请求 | 拒绝 | 无 CSRF 校验 |
| AUTH-004 | 同 Refresh 并发 50～100 次 | **最多一套新会话** | GET→DEL 非原子 |
| AUTH-005 | 禁用用户 Access/Refresh | 立即失效 | 不查用户状态；不撤会话 |
| AUTH-006 | 改密/删用户后旧会话 | 失效 | 未撤销 Redis |

### 1.5 RBAC / 租户 / 环境

| ID | 用例 | 期望 | 现状风险 |
|----|------|------|----------|
| RBAC-001 | 未登录 401；无菜单 403 | 逐 API 矩阵 | — |
| RBAC-002 | 角色/部门/权限包变更后即时生效 | 无需重启 | 部分变更不同步 Casbin |
| RBAC-003 | 查看≠退款≠出金≠对账 | 动作级权限 | 仅菜单 access |
| TEN-001 | 忽略客户端权威 `tenantId` | 服务端授权范围 | 可任意传 tenantId |
| TEN-002 | 路径 IDOR（渠道/交易/退款/应用…） | 跨租户 403 | 缺对象级校验 |
| APP-001 | `RoleApp` 实际约束业务 API | 越权失败 | 只 RequireMenu |
| ENV-001 | Live/Sandbox 密钥与数据隔离 | Header 与资源一致 | 环境隔离不可靠 |
| SEC-001 | 应用详情不返回 `secretKey` | 掩码 | 现原样返回 |
| SEC-002 | 支付密钥加密；邮件 Key 加密 | DB 无明文 | 邮件明文；加密失败可回退明文 |
| SEC-003 | 生产禁止固定开发 `NOVAS_DATA_KEY` | 启动失败 | 缺 key 用仓库固定密钥 |

### 1.6 通用 PUT 契约（阻断级）

以下 PUT **路径 `:id` 多数未注入 payload**，body 无 id 会新建，带错 id 会改错对象：

- `PUT /promo-campaigns/:id`
- `PUT /end-users/:id`
- `PUT /exchange-rates/:id`
- `PUT /fee-rules/:id`
- `PUT /risk-rules/:id`
- `PUT /alert-rules/:id`

| ID | 用例 | 期望 |
|----|------|------|
| PUT-001 | 只带 path id、body 无 id | 更新该资源 |
| PUT-002 | path 与 body id 不一致 | 以 path 为准或 422 |
| PUT-003 | 跨租户 id | 403 |

---

## 2. P0/P1 主流程冒烟（REAL 链路优先）

### 2.1 登录与壳层

- [ ] 有效账号登录 → Cookie 建立 → 进入首个可访问菜单
- [ ] 刷新后 `/me` 成功，不闪登录页
- [ ] 登出后 `#/login`，改 hash 进不了业务页
- [ ] 无权 hash 重定向；`#/permissions` → `#/permission_packs`
- [ ] 空菜单 / 仅部门继承 / 超管 三种菜单结果正确

### 2.2 支付：渠道 → 商品 → Checkout → Webhook → 交易

- [ ] 创建 Creem **Sandbox**；API Key/Webhook Secret DB 为密文；列表仅掩码
- [ ] 探活 HEALTHY；禁用后不可下单/同步/退款
- [ ] 商品创建/同步；注意：Creem 成功本地失败会产生孤儿商品（记缺陷）
- [ ] Checkout 返回 session URL；Live 禁止随意「测试下单」
- [ ] `success_url` 仅可信 HTTPS（开放重定向记缺陷）
- [ ] Webhook `checkout.completed` → 交易出现；重复事件不重复入账
- [ ] 交易列表筛选/详情/CSV；注意 ≤200 截断

### 2.3 退款 / 拒付 / 对账 / 结算

- [ ] 从成功交易创建部分+全额退款；超额/重复 Process 行为符合门禁
- [ ] 拒付证据上传（现多为元数据）与截止日后禁止提交
- [ ] 对账摘要/批次；**不要**把「一键对账」当真实三方匹配验收
- [ ] 结算出金：确认是否 MOCK；金额边界与重复出金

### 2.4 邮件

- [ ] Resend 渠道创建；**DB 检查 ApiKey 是否明文**（已知明文）
- [ ] 设主通道唯一；禁用不可发；配额边界
- [ ] 测试发送：Resend 2xx ≠ 已投递（现会伪造 `email.delivered`）
- [ ] 模板：注意前端 CRUD/测试多为 MOCK；XSS/变量缺失
- [ ] 邮件 Webhook 页：无入站路由；送达率勿信固定值（若已改为按日志计算则复测）

### 2.5 IAM

- [ ] 用户多角色+多部门继承；重置密码一次性凭证
- [ ] 权限包菜单勾选 → 角色绑定 → 用户登录四层校验（菜单/hash/按钮/API）
- [ ] 部门转移、删含子部门、循环父节点
- [ ] 菜单整树替换同 key 软删唯一冲突（已知风险）
- [ ] 字典系统分类保护、词条唯一、壳层 ≤100

---

## 3. 前端模块速查（测什么 / 别误判）

| 模块 | 重点正向 | 反向/边界 | 持久化注意 |
|------|----------|-----------|------------|
| 登录/个人中心 | Cookie 会话、主题 | 弱密、401、连续点击 | 资料/2FA/通知多为本地 |
| 仪表盘/交易 | KPI、筛选、详情 | 局部失败、CSV 注入 | 差错按钮可能 BROKEN |
| 对账 | 跑批、导出 | 无权限、并发跑 | 凭证核验或为 alert |
| 结算 | 筛选、导出 | 超额出金 | 出金多为 MOCK |
| 退款拒付 | 创建/处理/证据 | 超额、无证据、过期 | 接受拒付或仅本地 |
| 财务报表 | 汇总 | 无权限 | 导出/回执 MOCK；订单数可能用总额 |
| 汇率/费率/风控 | 试算/规则 | 非法区间 | CRUD 多 PARTIAL |
| 商品/折扣 | Creem 同步、绑定 | 负价、单位 | 上下架/启停 PARTIAL；折扣更新先删后建成风险 |
| 促销/应用 | 六步向导 | 非法 URL、语言 | 写操作多本地 |
| 支付/邮件渠道 | 探活、测试信 | Secret、配额 | 渠道启停 PARTIAL |
| Webhook 两页 | 筛选、报文 | 脱敏、截断 | 重投 MOCK |
| 邮件模板 | 预览变量 | XSS | CRUD/测试 MOCK |
| 终端客户 | 导出、详情 | 非法邮箱 | 建档/订阅本地 |
| 用户/角色/权限包/菜单/部门 | RBAC 闭环 | 假删除短 ID 角色、右键删部门绕过 | 部分 UI 乐观更新 |
| 审计 | 筛选导出 | 竞态、≤200 | — |
| 商户/告警/参数/任务/租户 | CRUD | 状态机、Cron | 审核/告警多本地；任务无真执行器 |

---

## 4. 跨模块 E2E 场景

### E2E-1 新应用上线

租户 → 支付渠道探活 → 邮件渠道测试 → 商品同步 → 折扣绑定 → 模板 → 应用六步 → 角色/权限包/用户 → 最小权限登录。  
**卡点**：渠道字典空、应用仅本地、应用范围是否进后端。

### E2E-2 支付成功到结算

Sandbox Checkout → Webhook → 交易 → 对账 → 结算批次 → 出金 → 报表/审计。  
**卡点**：对账非真账单、出金 MOCK、Webhook 失败不可恢复。

### E2E-3 差错处置

差错交易 → 看板/对账发现 → 抹平/退款/挂账 → 状态与审计。  
**卡点**：回调未接、失败仍关面板。

### E2E-4 退款与拒付

退款 → 冲减报表 → 拒付证据 → 提交/接受 → 告警审计。

### E2E-5 营销转化（多 MOCK）

折扣 → 模板 → 促销派发 → 邮件回执 → 核销交易。先确认哪些步骤 REAL。

### E2E-6 RBAC 生效

菜单 → 权限包 → 角色(+应用范围) → 部门 → 用户 → 刷新后四层权限；撤权立即生效。

---

## 5. 后端 API 测试分层建议

1. **Handler 契约**：HTTP status、`code/message/data`、Cookie、分页字段  
2. **Service 状态机**：退款/拒付/对账/渠道启停  
3. **PG 集成**：唯一索引、软删、事务、并发（勿只靠 SQLite）  
4. **Redis**：refresh 原子消费、TTL、登录限流、故障开放行为  
5. **RBAC 矩阵**：用户 × 角色 × 部门 × 菜单 × 租户 × 动作  
6. **故障注入**：第三方成功本地失败；日志成功业务失败  
7. **并发 + `-race`**：Webhook、refresh、退款 process、出金  

### 错误码抽检

| Code | HTTP | 场景 |
|------|------|------|
| 40100 | 401 | 未登录 |
| 40101 | 401 | 账密错误 |
| 40102 | 401 | Webhook 签名失败 |
| 40300 | 403 | 无权限/禁用 |
| 40400 | 404 | 资源不存在 |
| 409xx | 409 | 冲突（邮箱/部门/字典等） |
| 422xx | 422 | 参数/服务商未接入 |
| 42901 | 429 | 登录限流 |
| 5021x | 502 | Creem/Resend 失败 |

注意：多业务复用同一 code；非 `apperr` 可能把内部 `err.Error()` 回传客户端。

### 基础设施

- `GET /healthz`：存活；`GET /readyz`：PG+Redis  
- `X-App-Env`：仅 `live`/`sandbox`，非法 40001；**多数查询未真正隔离**  
- Timeout 中间件名义 15s，实现可能未真正取消；第三方客户端 30s  

---

## 6. 建议执行批次

| 批次 | 内容 | 出口标准 |
|------|------|----------|
| **B0** | Webhook 验签/重试、Refresh 并发、CSRF、租户 IDOR、Secret 泄漏扫描、退款幂等 | 无 P0 开放 |
| **B1** | 渠道→商品→Checkout→Webhook→交易→退款 | Sandbox 真链路可追踪 |
| **B2** | 对账/结算/报表（区分 REAL vs 占位） | 文档化能力差距 |
| **B3** | 邮件渠道/模板/回执 | Key 加密与真实 dispatch 达标或记债 |
| **B4** | 全模块 UI 回归 + CSV/截断/空态 | 无误成功、无误空表 |
| **B5** | 韧性：多副本、崩溃恢复、限流、容量 | 资金路径可恢复 |

---

## 7. 缺陷登记模板（建议）

```text
标题: [模块] 简述
优先级: P0/P1/P2
标签: REAL|PARTIAL|MOCK|BROKEN|SECURITY|MONEY
复现: 步骤…
期望 / 实际:
证据: 请求 ID、DB 行、截图、渠道侧单号
```

### 盘点已标高优先级缺陷（建议直接建单）

1. 空 Webhook Secret 可无签收单  
2. Webhook 先写日志导致失败重试被吞  
3. event_id 全局唯一 / 缺失则随机  
4. 退款无金额校验与 Process 非幂等  
5. 对账非真实三方匹配  
6. Refresh 并发可双会话；禁用不撤会话  
7. 无租户/应用对象级授权；Casbin 部分不同步  
8. 多资源 PUT 忽略 path id  
9. 邮件 API Key 明文；支付加密可回退明文/开发密钥  
10. 应用 `secretKey` 回传前端  
11. 商品/折扣远端与本地顺序导致孤儿或丢失  
12. 大量前端写操作未调 API（假成功）  

---

## 8. 环境与账号

| 项 | 值 |
|----|-----|
| 管理员 | `admin@novaspay.global` / `Admin@123456` |
| API | `http://127.0.0.1:8080`（`cd backend && docker compose up -d && make run`） |
| 探针 | `/healthz`、`/readyz` |
| 启动头 | `X-App-Env: sandbox`（支付联调）/ `live` |
| Creem | Sandbox：`test-api.creem.io`；Live：`api.creem.io`（禁止混用） |

**安全提醒：** 上线前改默认密码；生产 `SEED_DEMO=false`；设置强随机 `NOVAS_DATA_KEY`；Webhook 必须配置 Secret。

---

## 9. 参考范围（盘点来源）

- 前端：32 主 Tab + 登录/个人中心/快捷操作；`src/components`、`src/api/modules`、locales  
- 后端：`/api/v1` 143 路由 + 2 探针；PG / Redis / Casbin / Creem / Resend  
- 专项：支付渠道、Checkout、Webhook、退款拒付对账、商品同步、邮件、鉴权敏感信息  

详细用例编号见盘点子报告（支付矩阵 PAY/CHK/WH/REF/REC/MAIL/AUTH；前端模块 A–G；后端模块 1–17）。

---

## 10. 实跑记录（2026-09-17 22:40 UTC+8）

### 10.1 环境处置

| 项 | 结果 |
|----|------|
| API `:8080` | 已在跑（`./bin/api`） |
| `GET /healthz` | PASS → ok |
| `GET /readyz` | 先 `redis_down`；重建 `backend/data/redis` 并重启 Redis 后 PASS → ready |
| Postgres `:5433` | healthy；`payment_channels=0`、`email_channels=0`、`catalog_products=0` |
| 登录 | PASS（`SUPER_ADMIN`，菜单齐全） |

**阻断说明：** 当前连接库中 **没有支付渠道 / 邮件渠道 / 商品**。支付 Checkout、Webhook 验签、探活、Resend 测试发送、退款 E2E **全部 BLOCKED**，需先在库中创建渠道或提供 Sandbox 密钥后再续跑。

> 若你在前端页面「配置成功」但刷新后消失，符合盘点中的 PARTIAL/MOCK 行为，并不会写入上述表。

### 10.2 已执行结果摘要

| 批次 | 结果 |
|------|------|
| 基础设施 + 登录/me/错密/非法 Env | **PASS** |
| 未登录访问交易 | **PASS** → 40100 |
| Refresh 单次 | **PASS** |
| Refresh 并发 40 次同 Cookie | **FAIL（P0）** → **4 次成功**（期望 ≤1） |
| Logout 后 /me | **PASS** → 40100 |
| 35+ 业务 LIST 接口 | **PASS**（多为空列表） |
| 不存在 Creem Webhook channel | **PASS** → 40400 |
| 空 body 创建支付/邮件渠道 | **PASS** → 42200 |
| 缺失交易创建退款 | **PASS** → 42200 |
| `POST /reconciliation/run`（空库） | 跑通 HTTP 200，`matchedCount=0`（**未验证真实三方对账**） |
| `POST /settlements/generate` | 200，`created=0` |
| `PUT /promo-campaigns/:pathId` + body 另 id | **FAIL（P0）** → 忽略 path id，按 body/生成 id **新建** |
| `PUT /fee-rules/:pathId` 同理 | **FAIL（P0）** → 忽略 path id 新建（已清理 QA 数据） |
| 支付/邮件/商品/Checkout/Webhook 签名/退款真链路 | **BLOCKED**（无渠道数据） |

### 10.3 续跑所需输入

请提供（Sandbox 即可），或在管理端 **真实保存** 到后端后告诉我渠道名：

1. Creem Sandbox API Key + Webhook Secret  
2. 至少一个可 Checkout 的 Creem Product ID（或允许我调同步接口）  
3. Resend API Key + 发件人邮箱 + 测试收件邮箱  

拿到后将续跑：`渠道探活 → 商品同步/创建 → Checkout →（模拟）Webhook 正反向 → 交易 → 退款边界 → 邮件测试发送与密钥是否明文`。

---

## 11. 缺陷修复回验（2026-09-18 00:15 UTC+8）

> 在临时进程 `NOVAS_HTTP_ADDR=:18080 ./bin/api` 上复测；**`:8080` 若仍是旧进程需手动重启才能吃到补丁**。未提交 git。

### 11.1 已修复并复测

| 优先级 | 项 | 修复要点 | 复测 |
|--------|----|----------|------|
| P0 | Refresh 并发原子消费 | Redis `GetDel` | 同 Cookie 并发 40 → **成功 1 / 401×39** |
| P0 | PUT path `:id` | `bindMapWithPathID` | `PUT /fee-rules/:id` 以 path id 更新，body 伪 id 被忽略 |
| P0 | Webhook FAILED 可重试 | 仅 SUCCESS/DELIVERED 短路 | 代码 + 单测 |
| P0 | 退款金额上限 + Process 幂等 | PENDING→PROCESSING→SUCCESS | 单测 |
| P1 | 邮件 API Key 加密 + `email.accepted` | seal/open + 明文升级 | 列表掩码 `re_****`；不伪造 delivered |
| P1 | 空/错 Webhook 签名拒绝 | 空 secret 直接 401 | 无签回调 → **40102** |
| P1 | 支付密钥掩码 | `********` / 尾四位 | 渠道列表已掩码 |
| P1 | CSRF | Origin / Sec-Fetch-Site | cross-site / 恶意 Origin → **40301** |
| P1 | 对账不再批量假成功 | 按金额+渠道单号一致性落 done/discrepancy；汇总用 `net_amount_cents` | `run`→`matchedCount=0`；summary bank=净额 |
| P1 | Webhook 重投前端假成功 | 调真实 `redeliver` API | 代码已接 |
| P1 | 非 Creem 测试下单假成功 | toast「仅 Creem」 | 代码已改 |

### 11.2 仍为债（未本轮清零）

1. **租户/对象级 IDOR**：菜单权限 ≠ 数据隔离；后端用户无强制 tenant 绑定。  
2. **对账非真三方账单**：现为内部一致性，未拉 Creem/银行对账单。  
3. **大量前端 PARTIAL/MOCK**：结算出金、邮件模板 CRUD、促销派发、应用启停密钥轮换、告警闭环等刷新仍可能丢。  
4. **本机无公网**：Creem 真实 Webhook 仍需隧道。  
5. **生产 Secure Cookie / 双提交 CSRF Token**：当前为 Origin 校验 + SameSite=Lax。
