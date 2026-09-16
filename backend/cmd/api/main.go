package main

import (
	"github.com/novaspay/admin-api/internal/platform/audit"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/platform/dictionary"
	"github.com/novaspay/admin-api/internal/infra"
	"github.com/novaspay/admin-api/internal/platform/ops"
	"github.com/novaspay/admin-api/internal/server"
	"github.com/novaspay/admin-api/internal/platform/sys"
	"go.uber.org/fx"
)

func main() {
	fx.New(
		fx.Provide(conf.Load),
		infra.Module,
		sys.Module,
		dictionary.Module,
		audit.Module,
		ops.Module,
		server.Module,
	).Run()
}
