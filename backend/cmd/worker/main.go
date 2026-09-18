package main

import (
	"context"
	"log"

	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra"
	paymentjobs "github.com/novaspay/admin-api/internal/payment/jobs"
	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
	"go.uber.org/fx"
)

func main() {
	fx.New(
		fx.Provide(conf.Load),
		infra.Module,
		fx.Provide(paymentsvc.NewService),
		fx.Invoke(registerWorkerLoops),
	).Run()
}

func registerWorkerLoops(lc fx.Lifecycle, svc *paymentsvc.Service) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go paymentjobs.RunChannelHealthLoop(svc)
			go paymentjobs.RunReconciliationLoop(svc)
			log.Printf("worker: background jobs started")
			return nil
		},
	})
}
