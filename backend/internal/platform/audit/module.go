package audit

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/platform/audit/handler"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewAuditRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		g := r.Group("", mw.Auth)
		{
			g.GET("/audit-logs", mw.RequireMenu("audit_logs"), h.List)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		auditsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewAuditRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
