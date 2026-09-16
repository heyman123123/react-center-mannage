package migrations

import (
	"log"

	"gorm.io/gorm"
)

// ApplySeed 执行 v1 初始化数据（语言、菜单、超管权限包、演示业务数据等）。
// 幂等：已存在则跳过或 upsert，逻辑见 seed.go。
func ApplySeed(db *gorm.DB) {
	log.Printf("migrations: applying seed data")
	seedDefaults(db)
}
