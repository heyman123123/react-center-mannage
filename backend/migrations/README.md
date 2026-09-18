# Seed（初始化数据）

v1 使用 GORM `AutoMigrate` 建表（**不含**按月分表的高写入表）；订单 / Webhook / 审计等分表由 `internal/infra/sharding` 在启动时 `EnsureOnStartup` 创建 `{table}_{YYYYMM}`。

**初始化数据**在启动时由 `migrations.ApplySeed` 幂等写入：

| 内容 | 说明 |
|------|------|
| 语言 | `zh-CN` / `en-US` |
| 菜单树 | 稳定 UUID，含全部管理端路由 |
| 超管 | 角色 `SUPER_ADMIN` + 权限包 `PACK_SUPER_ADMIN`（Casbin 走权限包） |
| 默认账号 | `admin@novaspay.global` / `Admin@123456` |
| 审计字典 | `audit_action` 命名空间词条 |
| 演示数据 | 租户、接入应用、汇率、费率、风控、告警、促销等 |

本地启动：`cd backend && make run`（自动灌数）。

时间字段：库内一律存 **UTC Unix 秒（bigint）**。
