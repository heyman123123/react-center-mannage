# NovasPay 管理端 —— 测试用例与冒烟报告

本目录存放 **全量测试用例文档**。配套自动化脚本在 `backend/scripts/`。

| 文件 | 说明 |
|------|------|
| [`NovasPay-测试用例文档.md`](./NovasPay-测试用例文档.md) | 全量用例（约 252 条），覆盖登录会话、RBAC、租户、支付/邮件渠道、交易对账退款拒付、商品折扣、字典审计、运营配置等 33 个模块 |
| `backend/scripts/smoke_test.sh` | 读取本文档中标记 **Y / Y\*** 的用例，调用后端 API 执行，并生成冒烟报告 |
| `backend/scripts/e2e_channel_email_test.sh` | Creem + Resend 深度端到端（需真实凭据） |
| `automation/automa/` | 浏览器 Automa RPA 工作流 |

## 用例文档怎么读

每条用例包含：ID、标题、优先级（P0/P1/P2）、类型、前置条件、步骤、预期结果、自动化标记。

| 自动化标记 | 含义 |
|------------|------|
| **Y（冒烟）** | `smoke_test.sh` 的 CORE 层自动执行，无需外部凭据 |
| **Y\*** | CORE 之后的 EXTENDED 层，依赖真实 Creem / Resend 凭据；未配置则 SKIP |
| **N（人工）** | UI / 状态机造数 / 权限矩阵等，发布前按 P0→P1→P2 人工回归 |

## 跑冒烟并出报告

```bash
# 1) 确保后端已启动（PostgreSQL + Redis 就绪）
curl -sS http://localhost:8080/healthz
curl -sS http://localhost:8080/readyz

# 2) 仅 CORE 层（默认管理员账号）
cd backend/scripts
./smoke_test.sh

# 3) 带真实渠道凭据（追加 EXTENDED）
cp smoke_test.env.example smoke_test.env   # 填入 CREEM_API_SECRET / RESEND_API_KEY 等
./smoke_test.sh smoke_test.env
```

执行结束后会在 `backend/scripts/reports/` 生成：

- `smoke_<时间戳>.md` —— 给人看的冒烟报告，每一行引用用例 ID
- `smoke_<时间戳>.jsonl` —— 原始结果，便于二次分析
- `smoke_<时间戳>.meta.json` —— 环境元数据

报告结构：

1. 结论（通过 / 未通过）与环境信息
2. PASS / FAIL / WARN / SKIP 计数
3. 与用例文档的覆盖对照（CORE 标记数 vs 实际执行数）
4. 失败用例列表
5. 本次执行明细（含用例 ID）
6. 文档中仍需人工回归的 N 类用例清单

退出码：`0` 无 FAIL，`1` 存在 FAIL，`2` 环境/依赖问题（缺 curl/jq/python3 或找不到用例文档）。
