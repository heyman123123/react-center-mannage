package jobs

import (
	"context"
	"log"
	"time"

	"github.com/novaspay/admin-api/internal/conf"
	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
	"go.uber.org/fx"
)

const channelHealthInterval = 5 * time.Minute

func RegisterChannelHealthJob(lc fx.Lifecycle, svc *paymentsvc.Service, cfg *conf.Config) {
	if cfg != nil && !cfg.EmbeddedJobs {
		return
	}
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go RunChannelHealthLoop(svc)
			return nil
		},
	})
}

func RunChannelHealthLoop(svc *paymentsvc.Service) {
	ticker := time.NewTicker(channelHealthInterval)
	defer ticker.Stop()

	runOnce(svc)
	for range ticker.C {
		runOnce(svc)
	}
}

func runOnce(svc *paymentsvc.Service) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := svc.CheckAllChannelsHealth(ctx); err != nil {
		log.Printf("channel health check failed: %v", err)
	}
}
