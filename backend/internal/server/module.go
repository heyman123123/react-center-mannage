package server

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	gin.DefaultWriter = os.Stdout
	gin.DefaultErrorWriter = os.Stderr
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

func resolveSPADist() string {
	var bases []string
	if exe, err := os.Executable(); err == nil {
		bases = append(bases, filepath.Dir(exe))
	}
	if cwd, err := os.Getwd(); err == nil {
		bases = append(bases, cwd)
	}
	for _, base := range bases {
		for _, rel := range []string{"web/dist", "../web/dist"} {
			candidate := filepath.Clean(filepath.Join(base, rel))
			if info, err := os.Stat(candidate); err == nil && info.IsDir() {
				return candidate
			}
		}
	}
	return ""
}

// RegisterSPA serves the Vite build from web/dist when present.
// API routes must be registered first; unknown /api|/healthz|/readyz still return JSON 404.
func RegisterSPA(r *gin.Engine) {
	dist := resolveSPADist()
	if dist == "" {
		log.Printf("SPA: web/dist not found (tried relative to executable and cwd), skipping static hosting")
		return
	}
	log.Printf("SPA: serving UI from %s", dist)

	index := filepath.Join(dist, "index.html")
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") || path == "/healthz" || path == "/readyz" {
			c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "not found"})
			return
		}

		rel := strings.TrimPrefix(filepath.Clean(path), "/")
		if rel != "" && rel != "." {
			filePath := filepath.Join(dist, rel)
			if absFile, err := filepath.Abs(filePath); err == nil {
				if absDist, err := filepath.Abs(dist); err == nil &&
					strings.HasPrefix(absFile, absDist+string(os.PathSeparator)) {
					if info, err := os.Stat(absFile); err == nil && !info.IsDir() {
						c.File(absFile)
						return
					}
				}
			}
		}
		c.File(index)
	})
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
		RegisterSPA,
		StartServer,
	),
)
