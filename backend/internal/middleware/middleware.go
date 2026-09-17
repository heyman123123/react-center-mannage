package middleware

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

const (
	CtxUserID       = "user_id"
	CtxUserName     = "user_name"
	CtxAppEnv       = "app_env"
	CtxRequestID    = "request_id"
	CtxPaymentAppID = "payment_app_id"
)

type SessionVerifier interface {
	VerifyAccess(token string) (userID, userName string, err error)
}

// AppSecretResolver maps an application secretKey to payment app id.
type AppSecretResolver func(ctx context.Context, secretKey string) (appID string, err error)

type Bundle struct {
	cfg               *conf.Config
	sessions          SessionVerifier
	enforcer          *casbin.Enforcer
	superAdminChecker func(userID string) bool
	appSecretResolver AppSecretResolver
}

func NewBundle(cfg *conf.Config) *Bundle {
	return &Bundle{cfg: cfg}
}

func (b *Bundle) SetSessionVerifier(v SessionVerifier) {
	b.sessions = v
}

func (b *Bundle) SetEnforcer(e *casbin.Enforcer) {
	b.enforcer = e
}

func (b *Bundle) SetSuperAdminChecker(fn func(userID string) bool) {
	b.superAdminChecker = fn
}

func (b *Bundle) SetAppSecretResolver(r AppSecretResolver) {
	b.appSecretResolver = r
}

func (b *Bundle) Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		response.Fail(c, apperr.New(50000, 500, "内部错误"))
		c.Abort()
	})
}

func (b *Bundle) RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-Id")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(CtxRequestID, id)
		c.Writer.Header().Set("X-Request-Id", id)
		c.Next()
	}
}

func (b *Bundle) AccessLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery
		c.Next()
		if query != "" {
			path = path + "?" + query
		}
		rid, _ := c.Get(CtxRequestID)
		log.Printf(
			"access method=%s path=%s status=%d latency=%s ip=%s request_id=%v",
			c.Request.Method,
			path,
			c.Writer.Status(),
			time.Since(start).Round(time.Microsecond),
			c.ClientIP(),
			rid,
		)
	}
}

func (b *Bundle) CORS() gin.HandlerFunc {
	allowed := map[string]struct{}{}
	for _, o := range b.cfg.CORSOrigins {
		allowed[o] = struct{}{}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowed[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, X-App-Env")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func (b *Bundle) Timeout(d time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// lightweight placeholder; handlers use request context
		c.Next()
	}
}

func (b *Bundle) AppEnv() gin.HandlerFunc {
	return func(c *gin.Context) {
		env := c.GetHeader("X-App-Env")
		if env == "" {
			env = b.cfg.DefaultAppEnv
		}
		env = strings.ToLower(strings.TrimSpace(env))
		if env != "live" && env != "sandbox" {
			response.Fail(c, apperr.InvalidAppEnv)
			c.Abort()
			return
		}
		c.Set(CtxAppEnv, env)
		c.Next()
	}
}

func (b *Bundle) Auth(c *gin.Context) {
	if b.sessions == nil {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	token, err := c.Cookie("novas_access")
	if err != nil || token == "" {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	uid, name, err := b.sessions.VerifyAccess(token)
	if err != nil {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	c.Set(CtxUserID, uid)
	c.Set(CtxUserName, name)
	c.Next()
}

// AppSecretAuth authenticates payment apps via Authorization: Bearer <secretKey>.
func (b *Bundle) AppSecretAuth(c *gin.Context) {
	if b.appSecretResolver == nil {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	auth := strings.TrimSpace(c.GetHeader("Authorization"))
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	secret := strings.TrimSpace(strings.TrimPrefix(auth, prefix))
	if secret == "" {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	appID, err := b.appSecretResolver(c.Request.Context(), secret)
	if err != nil || appID == "" {
		response.Fail(c, apperr.Unauthorized)
		c.Abort()
		return
	}
	c.Set(CtxPaymentAppID, appID)
	c.Next()
}

// RequireMenu gates routes by Casbin menu access; SUPER_ADMIN bypasses Enforce.
func (b *Bundle) RequireMenu(menuKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		uidVal, ok := c.Get(CtxUserID)
		if !ok {
			response.Fail(c, apperr.Unauthorized)
			c.Abort()
			return
		}
		uid, _ := uidVal.(string)
		if uid == "" {
			response.Fail(c, apperr.Unauthorized)
			c.Abort()
			return
		}
		if b.enforcer == nil {
			response.Fail(c, apperr.Forbidden)
			c.Abort()
			return
		}
		if b.superAdminChecker != nil && b.superAdminChecker(uid) {
			c.Next()
			return
		}
		allowed, err := b.enforcer.Enforce("user:"+uid, "menu:"+menuKey, "access")
		if err != nil || !allowed {
			response.Fail(c, apperr.Forbidden)
			c.Abort()
			return
		}
		c.Next()
	}
}
