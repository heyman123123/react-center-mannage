package payment

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/payment/handler"
	"github.com/novaspay/admin-api/internal/payment/jobs"
	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewPaymentRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		r.POST("/hooks/creem/:channelId", h.CreemWebhook)

		ch := r.Group("/payment-channels", mw.Auth)
		{
			ch.GET("", mw.RequireMenu("payment_channels"), h.ListChannels)
			ch.POST("", mw.RequireMenu("payment_channels"), h.CreateChannel)
			ch.GET("/:id", mw.RequireMenu("payment_channels"), h.GetChannel)
			ch.PUT("/:id", mw.RequireMenu("payment_channels"), h.UpdateChannel)
			ch.DELETE("/:id", mw.RequireMenu("payment_channels"), h.DeleteChannel)
			ch.POST("/:id/test", mw.RequireMenu("payment_channels"), h.TestChannel)
			ch.POST("/:id/checkout-test", mw.RequireMenu("payment_channels"), h.CheckoutTestChannel)
			ch.POST("/:id/reveal-secret", mw.RequireMenu("payment_channels"), h.RevealChannelSecret)
		}

		wh := r.Group("/payment-webhooks", mw.Auth)
		{
			wh.GET("", mw.RequireMenu("payment_webhooks"), h.ListWebhooks)
			wh.POST("/:id/redeliver", mw.RequireMenu("payment_webhooks"), h.RedeliverWebhook)
		}

		r.GET("/dashboard/kpi", mw.Auth, mw.RequireMenu("dashboard"), h.GetDashboardKPI)

		tx := r.Group("/transactions", mw.Auth)
		{
			tx.GET("", mw.RequireMenu("transactions"), h.ListTransactions)
			tx.GET("/:id", mw.RequireMenu("transactions"), h.GetTransaction)
		}

		rf := r.Group("/refunds", mw.Auth)
		{
			rf.GET("", mw.RequireMenu("refunds"), h.ListRefunds)
			rf.POST("", mw.RequireMenu("refunds"), h.CreateRefund)
			rf.POST("/:id/process", mw.RequireMenu("refunds"), h.ProcessRefund)
		}

		cb := r.Group("/chargebacks", mw.Auth)
		{
			cb.GET("", mw.RequireMenu("refunds"), h.ListChargebacks)
			cb.GET("/:id", mw.RequireMenu("refunds"), h.GetChargeback)
			cb.POST("/:id/evidence", mw.RequireMenu("refunds"), h.UploadChargebackEvidence)
			cb.POST("/:id/submit", mw.RequireMenu("refunds"), h.SubmitChargeback)
			cb.POST("/:id/accept", mw.RequireMenu("refunds"), h.AcceptChargeback)
		}

		rc := r.Group("/reconciliation", mw.Auth)
		{
			rc.GET("/summary", mw.RequireMenu("reconciliation"), h.GetReconciliationSummary)
			rc.GET("/batches", mw.RequireMenu("reconciliation"), h.ListReconciliationBatches)
			rc.GET("/discrepancies", mw.RequireMenu("reconciliation"), h.ListDiscrepancies)
			rc.POST("/run", mw.RequireMenu("reconciliation"), h.RunReconciliation)
			rc.POST("/import", mw.RequireMenu("reconciliation"), h.ImportStatement)
			rc.POST("/discrepancies/:id/resolve", mw.RequireMenu("reconciliation"), h.ResolveDiscrepancy)
			rc.POST("/discrepancies/:id/handle", mw.RequireMenu("reconciliation"), h.HandleDiscrepancy)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		paymentsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewPaymentRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
	fx.Invoke(jobs.RegisterChannelHealthJob),
)
