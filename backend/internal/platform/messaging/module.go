package messaging

import (
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/platform/messaging/handler"
	msgsvc "github.com/novaspay/admin-api/internal/platform/messaging/service"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
)

func NewMessagingRoute(h *handler.Handler, mw *middleware.Bundle) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		ch := r.Group("/email-channels", mw.Auth)
		{
			ch.GET("", mw.RequireMenu("email_channels"), h.ListChannels)
			ch.POST("", mw.RequireMenu("email_channels"), h.CreateChannel)
			ch.GET("/:id", mw.RequireMenu("email_channels"), h.GetChannel)
			ch.PUT("/:id", mw.RequireMenu("email_channels"), h.UpdateChannel)
			ch.DELETE("/:id", mw.RequireMenu("email_channels"), h.DeleteChannel)
			ch.PUT("/:id/primary", mw.RequireMenu("email_channels"), h.SetPrimary)
			ch.POST("/:id/test", mw.RequireMenu("email_channels"), h.TestChannel)
		}

		tpl := r.Group("/email-templates", mw.Auth)
		{
			tpl.GET("", mw.RequireMenu("email_templates"), h.ListTemplates)
			tpl.POST("", mw.RequireMenu("email_templates"), h.CreateTemplate)
			tpl.PUT("/:id", mw.RequireMenu("email_templates"), h.UpdateTemplate)
			tpl.DELETE("/:id", mw.RequireMenu("email_templates"), h.DeleteTemplate)
		}

		wh := r.Group("/email-webhooks", mw.Auth)
		{
			wh.GET("", mw.RequireMenu("email_webhooks"), h.ListWebhooks)
		}
	}
}

var Module = fx.Options(
	fx.Provide(
		msgsvc.NewService,
		handler.NewHandler,
		fx.Annotate(
			NewMessagingRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
)
