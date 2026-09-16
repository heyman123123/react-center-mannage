package service

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

type UserListItem struct {
	ID           string   `json:"id"`
	Email        string   `json:"email"`
	Name         string   `json:"name"`
	Status       string   `json:"status"`
	Phone        string   `json:"phone,omitempty"`
	AvatarText   string   `json:"avatarText,omitempty"`
	RoleKeys     []string `json:"roleKeys"`
	DepartmentIDs []string `json:"departmentIds"`
	CreatedAt     int64    `json:"createdAt"`
}

func (s *UserService) List(ctx context.Context, page, pageSize int, keyword, status string) ([]UserListItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := s.db.WithContext(ctx).Model(&persistence.User{})
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("(email ILIKE ? OR name ILIKE ?)", like, like)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []persistence.User
	if err := q.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	items := make([]UserListItem, 0, len(users))
	for _, u := range users {
		item, err := s.toItem(ctx, &u)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *item)
	}
	return items, total, nil
}

func (s *UserService) Create(ctx context.Context, email, name, phone string, roleKeys, deptIDs []string) (*UserListItem, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || name == "" {
		return nil, "", apperr.InvalidArgument
	}
	var count int64
	s.db.WithContext(ctx).Model(&persistence.User{}).Where("email = ?", email).Count(&count)
	if count > 0 {
		return nil, "", apperr.EmailExists
	}
	plain := GeneratePassword(12)
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	if err != nil {
		return nil, "", err
	}
	u := persistence.User{
		ID: uuid.NewString(), Email: email, Name: name, Phone: phone,
		PasswordHash: string(hash), Status: "ACTIVE", AvatarText: firstRune(name),
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&u).Error; err != nil {
			return err
		}
		return s.replaceBindings(tx, u.ID, roleKeys, deptIDs)
	})
	if err != nil {
		return nil, "", err
	}
	item, err := s.toItem(ctx, &u)
	return item, plain, err
}

func (s *UserService) Update(ctx context.Context, id, name, phone, status string, roleKeys, deptIDs []string) (*UserListItem, error) {
	var u persistence.User
	if err := s.db.WithContext(ctx).First(&u, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{}
		if name != "" {
			updates["name"] = name
		}
		if phone != "" {
			updates["phone"] = phone
		}
		if status != "" {
			updates["status"] = status
		}
		if len(updates) > 0 {
			if err := tx.Model(&u).Updates(updates).Error; err != nil {
				return err
			}
		}
		if roleKeys != nil || deptIDs != nil {
			rk, dk := roleKeys, deptIDs
			if rk == nil {
				var urs []persistence.UserRole
				tx.Where("user_id = ?", id).Find(&urs)
				rk = make([]string, 0, len(urs))
				for _, ur := range urs {
					rk = append(rk, ur.RoleKey)
				}
			}
			if dk == nil {
				var uds []persistence.UserDepartment
				tx.Where("user_id = ?", id).Find(&uds)
				dk = make([]string, 0, len(uds))
				for _, ud := range uds {
					dk = append(dk, ud.DepartmentID)
				}
			}
			return s.replaceBindings(tx, id, rk, dk)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&u, "id = ?", id)
	return s.toItem(ctx, &u)
}

func (s *UserService) Delete(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.User{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	_ = s.db.WithContext(ctx).Where("user_id = ?", id).Delete(&persistence.UserRole{}).Error
	_ = s.db.WithContext(ctx).Where("user_id = ?", id).Delete(&persistence.UserDepartment{}).Error
	return nil
}

func (s *UserService) ResetPassword(ctx context.Context, id string) (string, error) {
	var u persistence.User
	if err := s.db.WithContext(ctx).First(&u, "id = ?", id).Error; err != nil {
		return "", apperr.NotFound
	}
	plain := GeneratePassword(12)
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	if err != nil {
		return "", err
	}
	if err := s.db.WithContext(ctx).Model(&u).Update("password_hash", string(hash)).Error; err != nil {
		return "", err
	}
	return plain, nil
}

func (s *UserService) replaceBindings(tx *gorm.DB, userID string, roleKeys, deptIDs []string) error {
	if err := tx.Where("user_id = ?", userID).Delete(&persistence.UserRole{}).Error; err != nil {
		return err
	}
	if err := tx.Where("user_id = ?", userID).Delete(&persistence.UserDepartment{}).Error; err != nil {
		return err
	}
	for _, k := range roleKeys {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		if err := tx.Create(&persistence.UserRole{UserID: userID, RoleKey: k}).Error; err != nil {
			return err
		}
	}
	for _, d := range deptIDs {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		if err := tx.Create(&persistence.UserDepartment{UserID: userID, DepartmentID: d}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *UserService) toItem(ctx context.Context, u *persistence.User) (*UserListItem, error) {
	var urs []persistence.UserRole
	s.db.WithContext(ctx).Where("user_id = ?", u.ID).Find(&urs)
	rk := make([]string, 0, len(urs))
	for _, ur := range urs {
		rk = append(rk, ur.RoleKey)
	}
	var uds []persistence.UserDepartment
	s.db.WithContext(ctx).Where("user_id = ?", u.ID).Find(&uds)
	dk := make([]string, 0, len(uds))
	for _, ud := range uds {
		dk = append(dk, ud.DepartmentID)
	}
	return &UserListItem{
		ID: u.ID, Email: u.Email, Name: u.Name, Status: u.Status, Phone: u.Phone,
		AvatarText: u.AvatarText, RoleKeys: rk, DepartmentIDs: dk, CreatedAt: u.CreatedAt,
	}, nil
}
