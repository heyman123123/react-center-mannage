package dictionary

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/platform/dictionary/handler"
	dictsvc "github.com/novaspay/admin-api/internal/platform/dictionary/service"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewDictionaryRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		g := r.Group("/dictionary", mw.Auth)
		{
			g.GET("/languages", mw.RequireMenu("dictionary"), h.ListLanguages)
			g.GET("/categories", mw.RequireMenu("dictionary"), h.ListCategories)
			g.POST("/categories", mw.RequireMenu("dictionary"), h.CreateCategory)
			g.PUT("/categories/:id", mw.RequireMenu("dictionary"), h.UpdateCategory)
			g.DELETE("/categories/:id", mw.RequireMenu("dictionary"), h.DeleteCategory)
			g.GET("/entries", mw.RequireMenu("dictionary"), h.ListEntries)
			g.POST("/entries", mw.RequireMenu("dictionary"), h.CreateEntry)
			g.PUT("/entries/:id", mw.RequireMenu("dictionary"), h.UpdateEntry)
			g.DELETE("/entries/:id", mw.RequireMenu("dictionary"), h.DeleteEntry)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		dictsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewDictionaryRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
