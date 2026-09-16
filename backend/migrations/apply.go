package migrations

import (
	"log"

	"gorm.io/gorm"
)

// ApplySeed 执行初始化数据（语言、菜单、超管、审计字典、字典分类、角色→权限包迁移等）。
// 幂等：已存在则跳过或 upsert，逻辑见 seed.go / 004_migrate_role_menus_to_packs.go。
func ApplySeed(db *gorm.DB) {
	log.Printf("migrations: applying seed data")
	seedDefaults(db)
}
