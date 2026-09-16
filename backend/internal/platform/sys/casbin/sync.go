package casbinx

import (
	"context"
	"fmt"

	"github.com/casbin/casbin/v2"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"gorm.io/gorm"
)

const actAccess = "access"

// Syncer rebuilds Casbin policies from domain tables.
type Syncer struct {
	DB *gorm.DB
	E  *casbin.Enforcer
}

// NewSyncer wires DB + Enforcer for FX.
func NewSyncer(db *gorm.DB, e *casbin.Enforcer) *Syncer {
	return &Syncer{DB: db, E: e}
}

// SyncAll clears all policies and rebuilds from domain tables. Empty tables are OK.
func (s *Syncer) SyncAll(ctx context.Context) error {
	s.E.ClearPolicy()
	if err := s.E.SavePolicy(); err != nil {
		return fmt.Errorf("clear casbin policy: %w", err)
	}

	db := s.DB.WithContext(ctx)

	var packs []persistence.PermissionPack
	if err := db.Find(&packs).Error; err != nil {
		return fmt.Errorf("load permission packs: %w", err)
	}
	for _, pack := range packs {
		if err := s.writePackPolicies(ctx, pack); err != nil {
			return err
		}
	}

	var roles []persistence.Role
	if err := db.Find(&roles).Error; err != nil {
		return fmt.Errorf("load roles: %w", err)
	}
	for _, role := range roles {
		if err := s.writeRolePolicies(ctx, role); err != nil {
			return err
		}
	}

	var users []persistence.User
	if err := db.Find(&users).Error; err != nil {
		return fmt.Errorf("load users: %w", err)
	}
	for _, user := range users {
		if err := s.writeUserGrouping(ctx, user.ID); err != nil {
			return err
		}
	}
	return nil
}

// SyncUser refreshes g bindings for one user (personal ∪ department roles).
func (s *Syncer) SyncUser(ctx context.Context, userID string) error {
	if _, err := s.E.RemoveFilteredGroupingPolicy(0, "user:"+userID); err != nil {
		return fmt.Errorf("remove user grouping: %w", err)
	}
	return s.writeUserGrouping(ctx, userID)
}

// SyncRole refreshes pack grouping and app policies for one role.
func (s *Syncer) SyncRole(ctx context.Context, roleKey string) error {
	if _, err := s.E.RemoveFilteredGroupingPolicy(0, "role:"+roleKey); err != nil {
		return fmt.Errorf("remove role grouping: %w", err)
	}
	if _, err := s.E.RemoveFilteredPolicy(0, "role:"+roleKey); err != nil {
		return fmt.Errorf("remove role policy: %w", err)
	}
	var role persistence.Role
	if err := s.DB.WithContext(ctx).Where("key = ?", roleKey).First(&role).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return fmt.Errorf("load role %s: %w", roleKey, err)
	}
	return s.writeRolePolicies(ctx, role)
}

// SyncPack refreshes menu policies for one permission pack.
func (s *Syncer) SyncPack(ctx context.Context, packKey string) error {
	if _, err := s.E.RemoveFilteredPolicy(0, "pack:"+packKey); err != nil {
		return fmt.Errorf("remove pack policy: %w", err)
	}
	var pack persistence.PermissionPack
	if err := s.DB.WithContext(ctx).Where("key = ?", packKey).First(&pack).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return fmt.Errorf("load pack %s: %w", packKey, err)
	}
	return s.writePackPolicies(ctx, pack)
}

func (s *Syncer) writePackPolicies(ctx context.Context, pack persistence.PermissionPack) error {
	var links []persistence.PermissionPackMenu
	if err := s.DB.WithContext(ctx).Where("pack_id = ?", pack.ID).Find(&links).Error; err != nil {
		return fmt.Errorf("load pack menus %s: %w", pack.Key, err)
	}
	if len(links) == 0 {
		return nil
	}
	menuIDs := make([]string, 0, len(links))
	for _, l := range links {
		menuIDs = append(menuIDs, l.MenuID)
	}
	var menus []persistence.Menu
	if err := s.DB.WithContext(ctx).Where("id IN ?", menuIDs).Find(&menus).Error; err != nil {
		return fmt.Errorf("load menus for pack %s: %w", pack.Key, err)
	}
	sub := "pack:" + pack.Key
	for _, m := range menus {
		if _, err := s.E.AddPolicy(sub, "menu:"+m.Key, actAccess); err != nil {
			return fmt.Errorf("add pack menu policy: %w", err)
		}
	}
	return nil
}

func (s *Syncer) writeRolePolicies(ctx context.Context, role persistence.Role) error {
	db := s.DB.WithContext(ctx)
	roleSub := "role:" + role.Key

	var rps []persistence.RolePack
	if err := db.Where("role_id = ?", role.ID).Find(&rps).Error; err != nil {
		return fmt.Errorf("load role packs %s: %w", role.Key, err)
	}
	if len(rps) > 0 {
		packIDs := make([]string, 0, len(rps))
		for _, rp := range rps {
			packIDs = append(packIDs, rp.PackID)
		}
		var packs []persistence.PermissionPack
		if err := db.Where("id IN ?", packIDs).Find(&packs).Error; err != nil {
			return fmt.Errorf("load packs for role %s: %w", role.Key, err)
		}
		for _, p := range packs {
			if _, err := s.E.AddGroupingPolicy(roleSub, "pack:"+p.Key); err != nil {
				return fmt.Errorf("add role-pack grouping: %w", err)
			}
		}
	}

	var apps []persistence.RoleApp
	if err := db.Where("role_id = ?", role.ID).Find(&apps).Error; err != nil {
		return fmt.Errorf("load role apps %s: %w", role.Key, err)
	}
	if len(apps) == 0 {
		if _, err := s.E.AddPolicy(roleSub, "app:ALL", actAccess); err != nil {
			return fmt.Errorf("add default app:ALL: %w", err)
		}
		return nil
	}
	for _, a := range apps {
		obj := "app:" + a.AppID
		if _, err := s.E.AddPolicy(roleSub, obj, actAccess); err != nil {
			return fmt.Errorf("add role app policy: %w", err)
		}
	}
	return nil
}

func (s *Syncer) writeUserGrouping(ctx context.Context, userID string) error {
	roleKeys, err := s.effectiveRoleKeys(ctx, userID)
	if err != nil {
		return err
	}
	userSub := "user:" + userID
	for _, rk := range roleKeys {
		if _, err := s.E.AddGroupingPolicy(userSub, "role:"+rk); err != nil {
			return fmt.Errorf("add user-role grouping: %w", err)
		}
	}
	return nil
}

func (s *Syncer) effectiveRoleKeys(ctx context.Context, userID string) ([]string, error) {
	db := s.DB.WithContext(ctx)
	set := map[string]struct{}{}

	var urs []persistence.UserRole
	if err := db.Where("user_id = ?", userID).Find(&urs).Error; err != nil {
		return nil, fmt.Errorf("load user roles: %w", err)
	}
	for _, ur := range urs {
		set[ur.RoleKey] = struct{}{}
	}

	var uds []persistence.UserDepartment
	if err := db.Where("user_id = ?", userID).Find(&uds).Error; err != nil {
		return nil, fmt.Errorf("load user departments: %w", err)
	}
	if len(uds) > 0 {
		deptIDs := make([]string, 0, len(uds))
		for _, ud := range uds {
			deptIDs = append(deptIDs, ud.DepartmentID)
		}
		var drs []persistence.DepartmentRole
		if err := db.Where("department_id IN ?", deptIDs).Find(&drs).Error; err != nil {
			return nil, fmt.Errorf("load department roles: %w", err)
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
