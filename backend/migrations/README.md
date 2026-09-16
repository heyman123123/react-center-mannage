# Migrations / Seed

一期开发仍以 GORM `AutoMigrate` 建表；**初始化数据**放在本目录：

| 文件 | 说明 |
|------|------|
| `seed.go` / `apply.go` | 启动时幂等写入语言、菜单、SUPER_ADMIN、默认管理员、审计字典、字典分类、角色菜单→权限包迁移 |
| `001_seed_languages.sql` | 语言快照（可审计） |
| `002_seed_menus.sql` | 菜单快照（稳定 UUID；权限管理 key=`permission_packs`） |
| `003_seed_audit_action.sql` | 审计操作类型字典快照 |
| `004_migrate_role_menus_to_packs.go` | 角色菜单 → 权限包幂等迁移 |

生产环境可改为 golang-migrate / Atlas 执行 SQL；本地 `make run` 通过 `migrations.ApplySeed` 灌数。

默认管理员：`admin@novaspay.global` / `Admin@123456`

时间字段：库内一律存 **UTC Unix 秒（bigint）**。
