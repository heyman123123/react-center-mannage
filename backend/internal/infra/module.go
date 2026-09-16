package infra

import (
	"github.com/novaspay/admin-api/internal/infra/cache"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/migrations"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func migrate(db *gorm.DB) error {
	return persistence.AutoMigrate(db)
}

func seed(db *gorm.DB) {
	migrations.ApplySeed(db)
}

var Module = fx.Options(
	fx.Provide(
		persistence.NewDB,
		cache.NewRedis,
	),
	fx.Invoke(migrate, seed),
)
