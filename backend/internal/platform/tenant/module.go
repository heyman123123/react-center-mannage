package tenant

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/platform/tenant/handler"
	tenantsvc "github.com/novaspay/admin-api/internal/platform/tenant/service"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewTenantRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		g := r.Group("/tenants", mw.Auth)
		{
			g.GET("", mw.RequireMenu("tenants"), h.List)
			g.GET("/:id", mw.RequireMenu("tenants"), h.Get)
			g.POST("", mw.RequireMenu("tenants"), h.Create)
			g.PUT("/:id", mw.RequireMenu("tenants"), h.Update)
			g.DELETE("/:id", mw.RequireMenu("tenants"), h.Delete)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		tenantsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewTenantRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
