package service

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	casbinx "github.com/novaspay/admin-api/internal/platform/sys/casbin"
	"gorm.io/gorm"
)

type RoleService struct {
	db     *gorm.DB
	syncer *casbinx.Syncer
}

func NewRoleService(db *gorm.DB, syncer *casbinx.Syncer) *RoleService {
	return &RoleService{db: db, syncer: syncer}
}

type RoleDTO struct {
	ID          string   `json:"id"`
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	IsCustom    bool     `json:"isCustom"`
	PackIDs     []string `json:"packIds"`
	AppIDs      []string `json:"appIds"`
	CreatedAt   int64    `json:"createdAt"`
}

func (s *RoleService) List(ctx context.Context) ([]RoleDTO, error) {
	var roles []persistence.Role
	if err := s.db.WithContext(ctx).Order("created_at ASC").Find(&roles).Error; err != nil {
		return nil, err
	}
	out := make([]RoleDTO, 0, len(roles))
	for _, r := range roles {
		dto, err := s.toDTO(ctx, &r)
		if err != nil {
			return nil, err
		}
		out = append(out, *dto)
	}
	return out, nil
}

func (s *RoleService) Create(ctx context.Context, key, name, desc string, packIDs, appIDs []string) (*RoleDTO, error) {
	key = strings.TrimSpace(strings.ToUpper(key))
	if key == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	r := persistence.Role{ID: uuid.NewString(), Key: key, Name: name, Description: desc, IsCustom: true}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&r).Error; err != nil {
			return apperr.Wrap(40900, 409, "角色标识冲突", err)
		}
		if err := s.replacePacks(tx, r.ID, packIDs); err != nil {
			return err
		}
		return s.replaceApps(tx, r.ID, appIDs)
	})
	if err != nil {
		return nil, err
	}
	if err := s.syncer.SyncRole(ctx, r.Key); err != nil {
		return nil, err
	}
	return s.toDTO(ctx, &r)
}

func (s *RoleService) Update(ctx context.Context, id, name, desc string) (*RoleDTO, error) {
	var r persistence.Role
	if err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if desc != "" {
		updates["description"] = desc
	}
	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(&r).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	_ = s.db.WithContext(ctx).First(&r, "id = ?", id)
	return s.toDTO(ctx, &r)
}

func (s *RoleService) Delete(ctx context.Context, id string) error {
	var r persistence.Role
	if err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	if !r.IsCustom || r.Key == "SUPER_ADMIN" {
		return apperr.New(40301, 403, "内置角色不可删除")
	}
	roleKey := r.Key
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", id).Delete(&persistence.RolePack{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", id).Delete(&persistence.RoleApp{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", id).Delete(&persistence.RoleMenu{}).Error; err != nil {
			return err
		}
		return tx.Delete(&r).Error
	}); err != nil {
		return err
	}
	return s.syncer.SyncRole(ctx, roleKey)
}

func (s *RoleService) UpdatePermissions(ctx context.Context, id string, packIDs, appIDs []string) (*RoleDTO, error) {
	var r persistence.Role
	if err := s.db.WithContext(ctx).First(&r, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.replacePacks(tx, id, packIDs); err != nil {
			return err
		}
		return s.replaceApps(tx, id, appIDs)
	}); err != nil {
		return nil, err
	}
	if err := s.syncer.SyncRole(ctx, r.Key); err != nil {
		return nil, err
	}
	return s.toDTO(ctx, &r)
}

func (s *RoleService) replacePacks(tx *gorm.DB, roleID string, packIDs []string) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&persistence.RolePack{}).Error; err != nil {
		return err
	}
	for _, pid := range packIDs {
		if pid == "" {
			continue
		}
		if err := tx.Create(&persistence.RolePack{RoleID: roleID, PackID: pid}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *RoleService) replaceApps(tx *gorm.DB, roleID string, appIDs []string) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&persistence.RoleApp{}).Error; err != nil {
		return err
	}
	for _, aid := range appIDs {
		if aid == "" {
			continue
		}
		if err := tx.Create(&persistence.RoleApp{RoleID: roleID, AppID: aid}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *RoleService) toDTO(ctx context.Context, r *persistence.Role) (*RoleDTO, error) {
	var rps []persistence.RolePack
	s.db.WithContext(ctx).Where("role_id = ?", r.ID).Find(&rps)
	packIDs := make([]string, 0, len(rps))
	for _, rp := range rps {
		packIDs = append(packIDs, rp.PackID)
	}

	var ras []persistence.RoleApp
	s.db.WithContext(ctx).Where("role_id = ?", r.ID).Find(&ras)
	appIDs := make([]string, 0, len(ras))
	for _, ra := range ras {
		appIDs = append(appIDs, ra.AppID)
	}
	if len(appIDs) == 0 {
		appIDs = []string{"ALL"}
	}

	return &RoleDTO{
		ID: r.ID, Key: r.Key, Name: r.Name, Description: r.Description,
		IsCustom: r.IsCustom, PackIDs: packIDs, AppIDs: appIDs, CreatedAt: r.CreatedAt,
	}, nil
}
