package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/casbin/casbin/v2"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/cache"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db       *gorm.DB
	rdb      *cache.Redis
	cfg      *conf.Config
	enforcer *casbin.Enforcer
}

func NewAuthService(db *gorm.DB, rdb *cache.Redis, cfg *conf.Config, e *casbin.Enforcer) *AuthService {
	return &AuthService{db: db, rdb: rdb, cfg: cfg, enforcer: e}
}

type UserDTO struct {
	ID         string   `json:"id"`
	Email      string   `json:"email"`
	Name       string   `json:"name"`
	Status     string   `json:"status"`
	Phone      string   `json:"phone,omitempty"`
	AvatarText string   `json:"avatarText,omitempty"`
	RoleKeys   []string `json:"roleKeys"`
	MenuKeys   []string `json:"menuKeys,omitempty"`
	CreatedAt  int64    `json:"createdAt,omitempty"`
}

func (s *AuthService) Register(ctx context.Context, email, password, name string) (*UserDTO, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || password == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&persistence.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, apperr.EmailExists
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}
	u := persistence.User{
		ID: uuid.NewString(), Email: email, Name: name,
		PasswordHash: string(hash), Status: "ACTIVE", AvatarText: firstRune(name),
	}
	if err := s.db.WithContext(ctx).Create(&u).Error; err != nil {
		return nil, err
	}
	return &UserDTO{ID: u.ID, Email: u.Email, Name: u.Name, Status: u.Status, RoleKeys: []string{}}, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*UserDTO, string, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var u persistence.User
	if err := s.db.WithContext(ctx).Where("email = ?", email).First(&u).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, "", "", apperr.InvalidCredential
		}
		return nil, "", "", err
	}
	if u.Status != "ACTIVE" {
		return nil, "", "", apperr.Forbidden
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return nil, "", "", apperr.InvalidCredential
	}
	now := timex.Now()
	_ = s.db.WithContext(ctx).Model(&u).Update("last_login_at", &now).Error

	access, refresh, err := s.issueSession(ctx, u.ID, u.Name)
	if err != nil {
		return nil, "", "", err
	}
	dto, err := s.buildUserDTO(ctx, &u)
	if err != nil {
		return nil, "", "", err
	}
	return dto, access, refresh, nil
}

func (s *AuthService) issueSession(ctx context.Context, userID, name string) (access, refresh string, err error) {
	access = randomToken()
	refresh = randomToken()
	accessVal := fmt.Sprintf("%s|%s", userID, name)
	if err = s.rdb.Set(ctx, "novas:sess:access:"+access, accessVal, s.cfg.AccessTTL); err != nil {
		return "", "", err
	}
	if err = s.rdb.Set(ctx, "novas:sess:refresh:"+refresh, userID+"|"+access, s.cfg.RefreshTTL); err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

func (s *AuthService) VerifyAccess(token string) (userID, userName string, err error) {
	val, err := s.rdb.Get(context.Background(), "novas:sess:access:"+token)
	if err != nil {
		return "", "", err
	}
	parts := strings.SplitN(val, "|", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("bad session")
	}
	return parts[0], parts[1], nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (access, refresh string, err error) {
	val, err := s.rdb.Get(ctx, "novas:sess:refresh:"+refreshToken)
	if err != nil {
		return "", "", apperr.Unauthorized
	}
	parts := strings.SplitN(val, "|", 2)
	userID := parts[0]
	oldAccess := ""
	if len(parts) == 2 {
		oldAccess = parts[1]
	}
	var u persistence.User
	if err := s.db.WithContext(ctx).First(&u, "id = ?", userID).Error; err != nil {
		return "", "", apperr.Unauthorized
	}
	_ = s.rdb.Del(ctx, "novas:sess:refresh:"+refreshToken)
	if oldAccess != "" {
		_ = s.rdb.Del(ctx, "novas:sess:access:"+oldAccess)
	}
	return s.issueSession(ctx, u.ID, u.Name)
}

func (s *AuthService) Logout(ctx context.Context, access, refresh string) {
	if access != "" {
		_ = s.rdb.Del(ctx, "novas:sess:access:"+access)
	}
	if refresh != "" {
		_ = s.rdb.Del(ctx, "novas:sess:refresh:"+refresh)
	}
}

func (s *AuthService) Me(ctx context.Context, userID string) (*UserDTO, error) {
	var u persistence.User
	if err := s.db.WithContext(ctx).First(&u, "id = ?", userID).Error; err != nil {
		return nil, apperr.NotFound
	}
	return s.buildUserDTO(ctx, &u)
}

func (s *AuthService) buildUserDTO(ctx context.Context, u *persistence.User) (*UserDTO, error) {
	roles, menus, err := s.effectivePerms(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	return &UserDTO{
		ID: u.ID, Email: u.Email, Name: u.Name, Status: u.Status,
		Phone: u.Phone, AvatarText: u.AvatarText, RoleKeys: roles, MenuKeys: menus,
		CreatedAt: u.CreatedAt,
	}, nil
}

// effectivePerms = personal roles ∪ department inherited roles → menu keys
func (s *AuthService) effectivePerms(ctx context.Context, userID string) (roleKeys, menuKeys []string, err error) {
	var urs []persistence.UserRole
	if err = s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&urs).Error; err != nil {
		return
	}
	set := map[string]struct{}{}
	for _, ur := range urs {
		set[ur.RoleKey] = struct{}{}
	}
	var uds []persistence.UserDepartment
	if err = s.db.WithContext(ctx).Where("user_id = ?", userID).Find(&uds).Error; err != nil {
		return
	}
	if len(uds) > 0 {
		deptIDs := make([]string, 0, len(uds))
		for _, ud := range uds {
			deptIDs = append(deptIDs, ud.DepartmentID)
		}
		var drs []persistence.DepartmentRole
		if err = s.db.WithContext(ctx).Where("department_id IN ?", deptIDs).Find(&drs).Error; err != nil {
			return
		}
		for _, dr := range drs {
			set[dr.RoleKey] = struct{}{}
		}
	}
	for k := range set {
		roleKeys = append(roleKeys, k)
	}
	if len(roleKeys) == 0 {
		return []string{}, []string{}, nil
	}
	// SUPER_ADMIN gets all menu keys
	for _, k := range roleKeys {
		if k == "SUPER_ADMIN" {
			var menus []persistence.Menu
			if err = s.db.WithContext(ctx).Find(&menus).Error; err != nil {
				return
			}
			for _, m := range menus {
				menuKeys = append(menuKeys, m.Key)
			}
			return
		}
	}
	// Non-super: menu keys from Casbin implicit permissions (fail-closed if nil).
	if s.enforcer == nil {
		return roleKeys, []string{}, nil
	}
	perms, err := s.enforcer.GetImplicitPermissionsForUser("user:" + userID)
	if err != nil {
		return roleKeys, nil, err
	}
	seen := map[string]struct{}{}
	for _, p := range perms {
		if len(p) < 2 {
			continue
		}
		obj := p[1]
		if !strings.HasPrefix(obj, "menu:") {
			continue
		}
		key := strings.TrimPrefix(obj, "menu:")
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		menuKeys = append(menuKeys, key)
	}
	return
}

func randomToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func firstRune(s string) string {
	for _, r := range s {
		return string(r)
	}
	return "U"
}

func GeneratePassword(n int) string {
	const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$"
	b := make([]byte, n)
	_, _ = rand.Read(b)
	out := make([]byte, n)
	for i := range out {
		out[i] = chars[int(b[i])%len(chars)]
	}
	return string(out)
}
