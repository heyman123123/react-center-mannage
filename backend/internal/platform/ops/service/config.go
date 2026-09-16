package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type ConfigDTO struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Remark      string `json:"remark,omitempty"`
	UpdatedAt   int64  `json:"updatedAt"`
	UpdatedBy   string `json:"updatedBy"`
}

func (s *Service) ListConfigs(ctx context.Context, category, keyword string) ([]ConfigDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.SystemConfig{})
	if category != "" && category != "ALL" {
		q = q.Where("category = ?", category)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("(key ILIKE ? OR description ILIKE ?)", like, like)
	}
	var rows []persistence.SystemConfig
	if err := q.Order("category ASC, key ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ConfigDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, configDTO(r))
	}
	return out, nil
}

func (s *Service) CreateConfig(ctx context.Context, key, value, desc, category, remark, updatedBy string) (*ConfigDTO, error) {
	if key == "" || category == "" {
		return nil, apperr.InvalidArgument
	}
	row := persistence.SystemConfig{
		ID: uuid.NewString(), Key: key, Value: value, Description: desc,
		Category: category, Remark: remark, UpdatedBy: updatedBy,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "参数键已存在", err)
	}
	dto := configDTO(row)
	return &dto, nil
}

func (s *Service) UpdateConfig(ctx context.Context, id, value, desc, category, remark, updatedBy string) (*ConfigDTO, error) {
	var row persistence.SystemConfig
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{
		"value": value, "description": desc, "remark": remark, "updated_by": updatedBy,
	}
	if category != "" {
		updates["category"] = category
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := configDTO(row)
	return &dto, nil
}

func (s *Service) DeleteConfig(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.SystemConfig{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func configDTO(r persistence.SystemConfig) ConfigDTO {
	return ConfigDTO{
		ID: r.ID, Key: r.Key, Value: r.Value, Description: r.Description,
		Category: r.Category, Remark: r.Remark, UpdatedBy: r.UpdatedBy,
		UpdatedAt: r.UpdatedAt,
	}
}
