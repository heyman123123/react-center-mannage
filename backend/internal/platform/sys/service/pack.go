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

type PackService struct {
	db     *gorm.DB
	syncer *casbinx.Syncer
}

func NewPackService(db *gorm.DB, syncer *casbinx.Syncer) *PackService {
	return &PackService{db: db, syncer: syncer}
}

type PackDTO struct {
	ID          string   `json:"id"`
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	MenuIDs     []string `json:"menuIds"`
	CreatedAt   int64    `json:"createdAt"`
}

func (s *PackService) List(ctx context.Context) ([]PackDTO, error) {
	var packs []persistence.PermissionPack
	if err := s.db.WithContext(ctx).Order("created_at ASC").Find(&packs).Error; err != nil {
		return nil, err
	}
	out := make([]PackDTO, 0, len(packs))
	for _, p := range packs {
		dto, err := s.toDTO(ctx, &p)
		if err != nil {
			return nil, err
		}
		out = append(out, *dto)
	}
	return out, nil
}

func (s *PackService) Create(ctx context.Context, key, name, desc string, menuIDs []string) (*PackDTO, error) {
	key = strings.TrimSpace(strings.ToUpper(key))
	if key == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	p := persistence.PermissionPack{ID: uuid.NewString(), Key: key, Name: name, Description: desc}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&p).Error; err != nil {
			return apperr.Wrap(40900, 409, "权限包标识冲突", err)
		}
		return s.replaceMenus(tx, p.ID, menuIDs)
	})
	if err != nil {
		return nil, err
	}
	if err := s.syncer.SyncPack(ctx, p.Key); err != nil {
		return nil, err
	}
	return s.toDTO(ctx, &p)
}

func (s *PackService) Update(ctx context.Context, id, name, desc string) (*PackDTO, error) {
	var p persistence.PermissionPack
	if err := s.db.WithContext(ctx).First(&p, "id = ?", id).Error; err != nil {
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
		if err := s.db.WithContext(ctx).Model(&p).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	_ = s.db.WithContext(ctx).First(&p, "id = ?", id)
	if err := s.syncer.SyncPack(ctx, p.Key); err != nil {
		return nil, err
	}
	return s.toDTO(ctx, &p)
}

func (s *PackService) Delete(ctx context.Context, id string) error {
	var p persistence.PermissionPack
	if err := s.db.WithContext(ctx).First(&p, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	var refCount int64
	if err := s.db.WithContext(ctx).Model(&persistence.RolePack{}).Where("pack_id = ?", id).Count(&refCount).Error; err != nil {
		return err
	}
	if refCount > 0 {
		return apperr.New(40910, 409, "权限包仍被角色引用")
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("pack_id = ?", id).Delete(&persistence.PermissionPackMenu{}).Error; err != nil {
			return err
		}
		return tx.Delete(&p).Error
	}); err != nil {
		return err
	}
	return s.syncer.SyncAll(ctx)
}

func (s *PackService) ReplaceMenus(ctx context.Context, id string, menuIDs []string) (*PackDTO, error) {
	var p persistence.PermissionPack
	if err := s.db.WithContext(ctx).First(&p, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.replaceMenus(tx, id, menuIDs)
	}); err != nil {
		return nil, err
	}
	if err := s.syncer.SyncPack(ctx, p.Key); err != nil {
		return nil, err
	}
	return s.toDTO(ctx, &p)
}

func (s *PackService) replaceMenus(tx *gorm.DB, packID string, menuIDs []string) error {
	if err := tx.Where("pack_id = ?", packID).Delete(&persistence.PermissionPackMenu{}).Error; err != nil {
		return err
	}
	for _, mid := range menuIDs {
		if mid == "" {
			continue
		}
		if err := tx.Create(&persistence.PermissionPackMenu{PackID: packID, MenuID: mid}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *PackService) toDTO(ctx context.Context, p *persistence.PermissionPack) (*PackDTO, error) {
	var links []persistence.PermissionPackMenu
	s.db.WithContext(ctx).Where("pack_id = ?", p.ID).Find(&links)
	ids := make([]string, 0, len(links))
	for _, l := range links {
		ids = append(ids, l.MenuID)
	}
	return &PackDTO{
		ID: p.ID, Key: p.Key, Name: p.Name, Description: p.Description,
		MenuIDs: ids, CreatedAt: p.CreatedAt,
	}, nil
}
