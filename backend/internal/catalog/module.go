package catalog

import (
	"github.com/gin-gonic/gin"
	cataloghandler "github.com/novaspay/admin-api/internal/catalog/handler"
	catalogsvc "github.com/novaspay/admin-api/internal/catalog/service"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewCatalogRoute(h *cataloghandler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		p := r.Group("/products", mw.Auth)
		{
			p.GET("", mw.RequireMenu("products"), h.ListProducts)
			p.POST("", mw.RequireMenu("products"), h.CreateProduct)
			p.POST("/sync-from-creem", mw.RequireMenu("products"), h.SyncFromCreem)
			p.PUT("/:id", mw.RequireMenu("products"), h.UpdateProduct)
			p.DELETE("/:id", mw.RequireMenu("products"), h.DeleteProduct)
			p.POST("/:id/sync", mw.RequireMenu("products"), h.SyncProduct)
		}

		d := r.Group("/discounts", mw.Auth)
		{
			d.GET("", mw.RequireMenu("discounts"), h.ListDiscounts)
			d.POST("", mw.RequireMenu("discounts"), h.CreateDiscount)
			d.PUT("/:id", mw.RequireMenu("discounts"), h.UpdateDiscount)
			d.DELETE("/:id", mw.RequireMenu("discounts"), h.DeleteDiscount)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		catalogsvc.NewService,
		cataloghandler.NewHandler,
		fx.Annotate(
			NewCatalogRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
