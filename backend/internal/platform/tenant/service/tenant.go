package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

type TenantDTO struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Code                 string   `json:"code"`
	Currency             string   `json:"currency"`
	Description          string   `json:"description"`
	Color                string   `json:"color"`
	DailyCap             int64    `json:"dailyCap"`
	UsedToday            int64    `json:"usedToday"`
	ChannelsEnabled      []string `json:"channelsEnabled"`
	IsolationLevel       string   `json:"isolationLevel"`
	ActiveMerchantsCount int      `json:"activeMerchantsCount"`
	CreatedAt            int64    `json:"createdAt"`
	UpdatedAt            int64    `json:"updatedAt"`
}

type TenantInput struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Code                 string   `json:"code"`
	Currency             string   `json:"currency"`
	Description          string   `json:"description"`
	Color                string   `json:"color"`
	DailyCap             int64    `json:"dailyCap"`
	ChannelsEnabled      []string `json:"channelsEnabled"`
	IsolationLevel       string   `json:"isolationLevel"`
	ActiveMerchantsCount int      `json:"activeMerchantsCount"`
}

func (s *Service) List(ctx context.Context) ([]TenantDTO, error) {
	var rows []persistence.Tenant
	if err := s.db.WithContext(ctx).Order("created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]TenantDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toTenantDTO(r))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id string) (*TenantDTO, error) {
	var row persistence.Tenant
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	dto := toTenantDTO(row)
	return &dto, nil
}

func (s *Service) Create(ctx context.Context, in TenantInput) (*TenantDTO, error) {
	id := strings.TrimSpace(in.ID)
	code := strings.TrimSpace(in.Code)
	name := strings.TrimSpace(in.Name)
	if id == "" || code == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	chJSON, _ := json.Marshal(in.ChannelsEnabled)
	isolation := in.IsolationLevel
	if isolation == "" {
		isolation = "LOGICAL_TENANT"
	}
	currency := strings.TrimSpace(in.Currency)
	if currency == "" {
		currency = "USD"
	}
	row := persistence.Tenant{
		ID:                   id,
		Name:                 name,
		Code:                 strings.ToUpper(code),
		Currency:             currency,
		Description:          strings.TrimSpace(in.Description),
		Color:                strings.TrimSpace(in.Color),
		DailyCap:             in.DailyCap,
		ChannelsEnabledJSON:  string(chJSON),
		IsolationLevel:       isolation,
		ActiveMerchantsCount: in.ActiveMerchantsCount,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "租户 ID 或编码冲突", err)
	}
	dto := toTenantDTO(row)
	return &dto, nil
}

func (s *Service) Update(ctx context.Context, id string, in TenantInput) (*TenantDTO, error) {
	var row persistence.Tenant
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
	}
	if code := strings.TrimSpace(in.Code); code != "" {
		updates["code"] = strings.ToUpper(code)
	}
	if currency := strings.TrimSpace(in.Currency); currency != "" {
		updates["currency"] = currency
	}
	if in.Description != "" {
		updates["description"] = strings.TrimSpace(in.Description)
	}
	if in.Color != "" {
		updates["color"] = strings.TrimSpace(in.Color)
	}
	if in.DailyCap > 0 {
		updates["daily_cap"] = in.DailyCap
	}
	if in.IsolationLevel != "" {
		updates["isolation_level"] = in.IsolationLevel
	}
	if in.ActiveMerchantsCount >= 0 {
		updates["active_merchants_count"] = in.ActiveMerchantsCount
	}
	if in.ChannelsEnabled != nil {
		chJSON, _ := json.Marshal(in.ChannelsEnabled)
		updates["channels_enabled_json"] = string(chJSON)
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := toTenantDTO(row)
	return &dto, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	if id == "group_hq" {
		return apperr.New(40910, 409, "总部租户不可删除")
	}
	res := s.db.WithContext(ctx).Delete(&persistence.Tenant{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func toTenantDTO(r persistence.Tenant) TenantDTO {
	ch := []string{}
	_ = json.Unmarshal([]byte(r.ChannelsEnabledJSON), &ch)
	return TenantDTO{
		ID:                   r.ID,
		Name:                 r.Name,
		Code:                 r.Code,
		Currency:             r.Currency,
		Description:          r.Description,
		Color:                r.Color,
		DailyCap:             r.DailyCap,
		UsedToday:            r.UsedToday,
		ChannelsEnabled:      ch,
		IsolationLevel:       r.IsolationLevel,
		ActiveMerchantsCount: r.ActiveMerchantsCount,
		CreatedAt:            r.CreatedAt,
		UpdatedAt:            r.UpdatedAt,
	}
}
