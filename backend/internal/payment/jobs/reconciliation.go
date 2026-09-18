package jobs

import (
	"context"
	"log"
	"time"

	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
)

const reconciliationInterval = 1 * time.Hour

func RunReconciliationLoop(svc *paymentsvc.Service) {
	ticker := time.NewTicker(reconciliationInterval)
	defer ticker.Stop()
	runReconciliationOnce(svc)
	for range ticker.C {
		runReconciliationOnce(svc)
	}
}

func runReconciliationOnce(svc *paymentsvc.Service) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	n, err := svc.RunReconciliation(ctx, "")
	if err != nil {
		log.Printf("reconciliation job failed: %v", err)
		return
	}
	if n > 0 {
		log.Printf("reconciliation job updated %d transactions", n)
	}
}
