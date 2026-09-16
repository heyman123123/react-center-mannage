package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type AuthHandler struct {
	svc   *syssvc.AuthService
	cfg   *conf.Config
	audit *auditsvc.Service
}

func NewAuthHandler(svc *syssvc.AuthService, cfg *conf.Config, auditSvc *auditsvc.Service) *AuthHandler {
	return &AuthHandler{svc: svc, cfg: cfg, audit: auditSvc}
}

func (h *AuthHandler) setCookies(c *gin.Context, access, refresh string) {
	secure := h.cfg.CookieSecure
	domain := h.cfg.CookieDomain
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("novas_access", access, int(h.cfg.AccessTTL.Seconds()), "/", domain, secure, true)
	c.SetCookie("novas_refresh", refresh, int(h.cfg.RefreshTTL.Seconds()), "/api/v1/auth", domain, secure, true)
}

func (h *AuthHandler) clearCookies(c *gin.Context) {
	secure := h.cfg.CookieSecure
	domain := h.cfg.CookieDomain
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("novas_access", "", -1, "/", domain, secure, true)
	c.SetCookie("novas_refresh", "", -1, "/api/v1/auth", domain, secure, true)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	u, err := h.svc.Register(c.Request.Context(), req.Email, req.Password, req.Name)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"user": u})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	ip := c.ClientIP()
	if err := h.svc.CheckLoginRateLimit(c.Request.Context(), ip); err != nil {
		response.Fail(c, err)
		return
	}
	u, access, refresh, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		var appErr *apperr.Error
		if errors.As(err, &appErr) && appErr.Code == apperr.InvalidCredential.Code {
			h.svc.RecordLoginFailure(c.Request.Context(), ip)
		}
		response.Fail(c, err)
		return
	}
	h.svc.ClearLoginFailures(c.Request.Context(), ip)
	h.setCookies(c, access, refresh)
	h.audit.Write(c.Request.Context(), auditsvc.Entry{
		Action:         "AUTH_LOGIN",
		UserID:         u.ID,
		UserName:       u.Name,
		Role:           firstRole(u.RoleKeys),
		TargetResource: "AUTH",
		TargetID:       u.ID,
		Details:        "用户登录成功: " + u.Email,
		IPAddress:      c.ClientIP(),
		Status:         "SUCCESS",
	})
	response.OK(c, gin.H{"user": u})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	refresh, err := c.Cookie("novas_refresh")
	if err != nil || refresh == "" {
		response.Fail(c, apperr.Unauthorized)
		return
	}
	access, newRefresh, err := h.svc.Refresh(c.Request.Context(), refresh)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.setCookies(c, access, newRefresh)
	response.OK(c, gin.H{})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	access, _ := c.Cookie("novas_access")
	refresh, _ := c.Cookie("novas_refresh")
	h.svc.Logout(c.Request.Context(), access, refresh)
	h.audit.WriteFromContext(c, "AUTH_LOGOUT", "AUTH", "", "用户退出登录")
	h.clearCookies(c)
	response.OK(c, gin.H{})
}

func (h *AuthHandler) Me(c *gin.Context) {
	uid, _ := c.Get(middleware.CtxUserID)
	u, err := h.svc.Me(c.Request.Context(), uid.(string))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, u)
}

func firstRole(keys []string) string {
	if len(keys) == 0 {
		return ""
	}
	return keys[0]
}
