package biz

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/biz/handler"
	bizsvc "github.com/novaspay/admin-api/internal/biz/service"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewBizRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		apps := r.Group("/apps", mw.Auth)
		{
			apps.GET("", mw.RequireMenu("apps"), h.ListApps)
			apps.GET("/:id", mw.RequireMenu("apps"), h.GetApp)
			apps.POST("", mw.RequireMenu("apps"), h.CreateApp)
			apps.PUT("/:id", mw.RequireMenu("apps"), h.UpdateApp)
			apps.DELETE("/:id", mw.RequireMenu("apps"), h.DeleteApp)
		}

		st := r.Group("/settlements", mw.Auth)
		{
			st.GET("", mw.RequireMenu("settlements"), h.ListSettlements)
			st.GET("/:id", mw.RequireMenu("settlements"), h.GetSettlement)
			st.POST("/generate", mw.RequireMenu("settlements"), h.GenerateSettlements)
			st.POST("/payout", mw.RequireMenu("settlements"), h.CreatePayout)
		}

		pr := r.Group("/promo-campaigns", mw.Auth)
		{
			pr.GET("", mw.RequireMenu("promo_campaigns"), h.ListPromo)
			pr.POST("", mw.RequireMenu("promo_campaigns"), h.SavePromo)
			pr.PUT("/:id", mw.RequireMenu("promo_campaigns"), h.SavePromo)
			pr.DELETE("/:id", mw.RequireMenu("promo_campaigns"), h.DeletePromo)
		}

		eu := r.Group("/end-users", mw.Auth)
		{
			eu.GET("", mw.RequireMenu("users"), h.ListEndUsers)
			eu.POST("", mw.RequireMenu("users"), h.SaveEndUser)
			eu.PUT("/:id", mw.RequireMenu("users"), h.SaveEndUser)
			eu.DELETE("/:id", mw.RequireMenu("users"), h.DeleteEndUser)
		}

		er := r.Group("/exchange-rates", mw.Auth)
		{
			er.GET("", mw.RequireMenu("exchange_rates"), h.ListExchangeRates)
			er.POST("", mw.RequireMenu("exchange_rates"), h.SaveExchangeRate)
			er.PUT("/:id", mw.RequireMenu("exchange_rates"), h.SaveExchangeRate)
			er.DELETE("/:id", mw.RequireMenu("exchange_rates"), h.DeleteExchangeRate)
			er.GET("/:id/history", mw.RequireMenu("exchange_rates"), h.ExchangeRateHistory)
		}

		fr := r.Group("/fee-rules", mw.Auth)
		{
			fr.GET("", mw.RequireMenu("fee_rules"), h.ListFeeRules)
			fr.POST("", mw.RequireMenu("fee_rules"), h.SaveFeeRule)
			fr.PUT("/:id", mw.RequireMenu("fee_rules"), h.SaveFeeRule)
			fr.DELETE("/:id", mw.RequireMenu("fee_rules"), h.DeleteFeeRule)
		}

		rk := r.Group("/risk-rules", mw.Auth)
		{
			rk.GET("", mw.RequireMenu("risk_rules"), h.ListRiskRules)
			rk.POST("", mw.RequireMenu("risk_rules"), h.SaveRiskRule)
			rk.PUT("/:id", mw.RequireMenu("risk_rules"), h.SaveRiskRule)
			rk.DELETE("/:id", mw.RequireMenu("risk_rules"), h.DeleteRiskRule)
		}

		bl := r.Group("/blacklist", mw.Auth)
		{
			bl.GET("", mw.RequireMenu("risk_rules"), h.ListBlacklist)
			bl.POST("", mw.RequireMenu("risk_rules"), h.SaveBlacklist)
			bl.DELETE("/:id", mw.RequireMenu("risk_rules"), h.DeleteBlacklist)
		}

		ma := r.Group("/merchant-applications", mw.Auth)
		{
			ma.GET("", mw.RequireMenu("merchant_review"), h.ListMerchants)
			ma.POST("/:id/approve", mw.RequireMenu("merchant_review"), h.ApproveMerchant)
			ma.POST("/:id/reject", mw.RequireMenu("merchant_review"), h.RejectMerchant)
		}

		al := r.Group("/alert-rules", mw.Auth)
		{
			al.GET("", mw.RequireMenu("alerts"), h.ListAlertRules)
			al.POST("", mw.RequireMenu("alerts"), h.SaveAlertRule)
			al.PUT("/:id", mw.RequireMenu("alerts"), h.SaveAlertRule)
			al.DELETE("/:id", mw.RequireMenu("alerts"), h.DeleteAlertRule)
			al.POST("/:id/toggle", mw.RequireMenu("alerts"), h.ToggleAlertRule)
		}

		ah := r.Group("/alert-history", mw.Auth)
		{
			ah.GET("", mw.RequireMenu("alerts"), h.ListAlertHistory)
		}

		rp := r.Group("/reports", mw.Auth)
		{
			rp.GET("/revenue", mw.RequireMenu("financial_reports"), h.RevenueReport)
		}

	}
}

var Module = fx.Options(
	fx.Provide(
		bizsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewBizRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
