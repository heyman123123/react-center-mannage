package ops

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/platform/ops/handler"
	opssvc "github.com/novaspay/admin-api/internal/platform/ops/service"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewOpsRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		g := r.Group("", mw.Auth)
		{
			g.GET("/system-configs", mw.RequireMenu("system_config"), h.ListConfigs)
			g.POST("/system-configs", mw.RequireMenu("system_config"), h.CreateConfig)
			g.PUT("/system-configs/:id", mw.RequireMenu("system_config"), h.UpdateConfig)
			g.DELETE("/system-configs/:id", mw.RequireMenu("system_config"), h.DeleteConfig)

			g.GET("/scheduled-tasks", mw.RequireMenu("system_config"), h.ListTasks)
			g.POST("/scheduled-tasks", mw.RequireMenu("system_config"), h.CreateTask)
			g.GET("/scheduled-tasks/:id", mw.RequireMenu("system_config"), h.GetTask)
			g.PUT("/scheduled-tasks/:id/status", mw.RequireMenu("system_config"), h.UpdateTaskStatus)
			g.GET("/scheduled-tasks/:id/runs", mw.RequireMenu("system_config"), h.ListRuns)
			g.POST("/scheduled-tasks/:id/trigger", mw.RequireMenu("system_config"), h.TriggerTask)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		opssvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewOpsRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
