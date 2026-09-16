package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/cache"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func NewGinEngine(mw *middleware.Bundle, cfg *conf.Config) *gin.Engine {
	gin.SetMode(cfg.Mode)
	r := gin.New()
	r.Use(
		mw.Recovery(),
		mw.RequestID(),
		mw.AccessLog(),
		mw.CORS(),
		mw.Timeout(15*time.Second),
	)
	return r
}

func RegisterHealth(r *gin.Engine, db *gorm.DB, rdb *cache.Redis) {
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/readyz", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db_down"})
			return
		}
		if err := rdb.Client.Ping(c.Request.Context()).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "redis_down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
}

func RegisterAllRoutes(r *gin.Engine, routes []routing.RouteFunc, mw *middleware.Bundle) {
	v1 := r.Group("/api/v1", mw.AppEnv())
	for _, register := range routes {
		register(v1)
	}
}

func StartServer(lc fx.Lifecycle, r *gin.Engine, cfg *conf.Config) {
	srv := &http.Server{
		Addr:         cfg.HTTPAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			go func() {
				_ = srv.ListenAndServe()
			}()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()
			return srv.Shutdown(shutdownCtx)
		},
	})
}

var Module = fx.Options(
	fx.Provide(middleware.NewBundle, NewGinEngine),
	fx.Invoke(
		RegisterHealth,
		fx.Annotate(
			RegisterAllRoutes,
			fx.ParamTags(``, `group:"routes"`, ``),
		),
		StartServer,
	),
)
