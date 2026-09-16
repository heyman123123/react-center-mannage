package sys

import (
	"context"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/routing"
	casbinx "github.com/novaspay/admin-api/internal/platform/sys/casbin"
	"github.com/novaspay/admin-api/internal/platform/sys/handler"
	"github.com/novaspay/admin-api/internal/platform/sys/service"
	"go.uber.org/fx"
	"gorm.io/gorm"
)

func NewSysRoute(
	auth *handler.AuthHandler,
	users *handler.UserHandler,
	roles *handler.RoleHandler,
	packs *handler.PackHandler,
	menus *handler.MenuHandler,
	depts *handler.DepartmentHandler,
	mw *middleware.Bundle,
) routing.RouteFunc {
	return func(r *gin.RouterGroup) {
		authG := r.Group("/auth")
		{
			authG.POST("/login", auth.Login)
			authG.POST("/register", auth.Register)
			authG.POST("/refresh", auth.Refresh)
			authG.POST("/logout", mw.Auth, auth.Logout)
		}

		secured := r.Group("", mw.Auth)
		{
			secured.GET("/me", auth.Me)

			secured.GET("/users", mw.RequireMenu("users"), users.List)
			secured.POST("/users", mw.RequireMenu("users"), users.Create)
			secured.PUT("/users/:id", mw.RequireMenu("users"), users.Update)
			secured.DELETE("/users/:id", mw.RequireMenu("users"), users.Delete)
			secured.POST("/users/:id/reset-password", mw.RequireMenu("users"), users.ResetPassword)

			secured.GET("/roles", mw.RequireMenu("roles"), roles.List)
			secured.POST("/roles", mw.RequireMenu("roles"), roles.Create)
			secured.PUT("/roles/:id", mw.RequireMenu("roles"), roles.Update)
			secured.DELETE("/roles/:id", mw.RequireMenu("roles"), roles.Delete)
			secured.PUT("/roles/:id/permissions", mw.RequireMenu("roles"), roles.UpdatePermissions)

			secured.GET("/permission-packs", mw.RequireMenu("permission_packs"), packs.List)
			secured.POST("/permission-packs", mw.RequireMenu("permission_packs"), packs.Create)
			secured.PUT("/permission-packs/:id", mw.RequireMenu("permission_packs"), packs.Update)
			secured.DELETE("/permission-packs/:id", mw.RequireMenu("permission_packs"), packs.Delete)
			secured.PUT("/permission-packs/:id/menus", mw.RequireMenu("permission_packs"), packs.ReplaceMenus)

			secured.GET("/menus", menus.Tree)
			secured.PUT("/menus", mw.RequireMenu("menus"), menus.ReplaceTree)
			secured.POST("/menus", mw.RequireMenu("menus"), menus.Create)
			secured.PUT("/menus/:id", mw.RequireMenu("menus"), menus.Update)
			secured.DELETE("/menus/:id", mw.RequireMenu("menus"), menus.Delete)

			secured.GET("/departments", mw.RequireMenu("departments"), depts.Tree)
			secured.POST("/departments", mw.RequireMenu("departments"), depts.Create)
			secured.PUT("/departments/:id", mw.RequireMenu("departments"), depts.Update)
			secured.DELETE("/departments/:id", mw.RequireMenu("departments"), depts.Delete)
			secured.POST("/departments/transfer", mw.RequireMenu("departments"), depts.Transfer)
		}
	}
}

func wireSession(mw *middleware.Bundle, auth *service.AuthService) {
	mw.SetSessionVerifier(auth)
}

func wireAuthz(mw *middleware.Bundle, e *casbin.Enforcer, db *gorm.DB) {
	mw.SetEnforcer(e)
	mw.SetSuperAdminChecker(func(userID string) bool {
		keys, err := effectiveRoleKeys(db, userID)
		if err != nil {
			return false
		}
		for _, k := range keys {
			if k == "SUPER_ADMIN" {
				return true
			}
		}
		return false
	})
}

// effectiveRoleKeys = personal roles ∪ department inherited roles (same as Syncer).
func effectiveRoleKeys(db *gorm.DB, userID string) ([]string, error) {
	set := map[string]struct{}{}

	var urs []persistence.UserRole
	if err := db.Where("user_id = ?", userID).Find(&urs).Error; err != nil {
		return nil, err
	}
	for _, ur := range urs {
		set[ur.RoleKey] = struct{}{}
	}

	var uds []persistence.UserDepartment
	if err := db.Where("user_id = ?", userID).Find(&uds).Error; err != nil {
		return nil, err
	}
	if len(uds) > 0 {
		deptIDs := make([]string, 0, len(uds))
		for _, ud := range uds {
			deptIDs = append(deptIDs, ud.DepartmentID)
		}
		var drs []persistence.DepartmentRole
		if err := db.Where("department_id IN ?", deptIDs).Find(&drs).Error; err != nil {
			return nil, err
		}
		for _, dr := range drs {
			set[dr.RoleKey] = struct{}{}
		}
	}

	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	return keys, nil
}

func syncCasbinOnStart(s *casbinx.Syncer) error {
	return s.SyncAll(context.Background())
}

var Module = fx.Options(
	fx.Provide(
		casbinx.NewEnforcer,
		casbinx.NewSyncer,
		service.NewAuthService,
		service.NewUserService,
		service.NewRoleService,
		service.NewPackService,
		service.NewMenuService,
		service.NewDepartmentService,
		handler.NewAuthHandler,
		handler.NewUserHandler,
		handler.NewRoleHandler,
		handler.NewPackHandler,
		handler.NewMenuHandler,
		handler.NewDepartmentHandler,
		fx.Annotate(
			NewSysRoute,
			fx.ResultTags(`group:"routes"`),
		),
	),
	fx.Invoke(wireSession),
	fx.Invoke(wireAuthz),
	fx.Invoke(syncCasbinOnStart),
)
