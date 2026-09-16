package migrations

import (
	"log"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MigrateRoleMenusToPacks creates one PermissionPack per Role that has no RolePack yet,
// copies RoleMenu → PermissionPackMenu, and inserts RolePack. RoleApp is left empty
// (Casbin Sync defaults to app:ALL). Idempotent: skips roles that already have a RolePack.
func MigrateRoleMenusToPacks(db *gorm.DB) {
	var roles []persistence.Role
	if err := db.Find(&roles).Error; err != nil {
		log.Printf("migrate role menus→packs: load roles: %v", err)
		return
	}

	migrated := 0
	for _, role := range roles {
		var n int64
		if err := db.Model(&persistence.RolePack{}).Where("role_id = ?", role.ID).Count(&n).Error; err != nil {
			log.Printf("migrate role menus→packs: count RolePack %s: %v", role.Key, err)
			continue
		}
		if n > 0 {
			continue
		}

		key := "PACK_" + role.Key
		pack := persistence.PermissionPack{
			ID:   packID(key),
			Key:  key,
			Name: role.Name + "权限包",
		}
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoNothing: true,
		}).Create(&pack).Error; err != nil {
			log.Printf("migrate role menus→packs: create pack %s: %v", key, err)
			continue
		}
		var existing persistence.PermissionPack
		if err := db.Where("key = ?", key).First(&existing).Error; err != nil {
			log.Printf("migrate role menus→packs: load pack %s: %v", key, err)
			continue
		}
		pack = existing

		var rms []persistence.RoleMenu
		if err := db.Where("role_id = ?", role.ID).Find(&rms).Error; err != nil {
			log.Printf("migrate role menus→packs: load RoleMenu %s: %v", role.Key, err)
			continue
		}
		for _, rm := range rms {
			_ = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&persistence.PermissionPackMenu{
				PackID: pack.ID,
				MenuID: rm.MenuID,
			}).Error
		}

		if err := db.Create(&persistence.RolePack{RoleID: role.ID, PackID: pack.ID}).Error; err != nil {
			log.Printf("migrate role menus→packs: RolePack %s: %v", role.Key, err)
			continue
		}
		migrated++
	}
	log.Printf("migrate: role menus→packs done (migrated=%d, roles=%d)", migrated, len(roles))
}
