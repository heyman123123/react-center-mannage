package infra

import (
	"github.com/novaspay/admin-api/internal/infra/cache"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	bizmigrate "github.com/novaspay/admin-api/internal/biz/migrate"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/migrations"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func migrate(db *gorm.DB, shards *sharding.Shards) error {
	if err := persistence.AutoMigrate(db); err != nil {
		return err
	}
	if err := shards.EnsureOnStartup(); err != nil {
		return err
	}
	bizmigrate.BackfillRelationalColumns(db)
	return nil
}

func seed(db *gorm.DB) {
	migrations.ApplySeed(db)
}

var Module = fx.Options(
	fx.Provide(
		persistence.NewDB,
		cache.NewRedis,
		sharding.NewShards,
	),
	fx.Invoke(migrate, seed),
)
