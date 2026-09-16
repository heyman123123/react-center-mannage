package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	payment *paymentsvc.Service
}

func NewService(db *gorm.DB, payment *paymentsvc.Service) *Service {
	return &Service{db: db, payment: payment}
}

type ProductDTO struct {
	ID                string   `json:"id"`
	ChannelID         string   `json:"channelId"`
	TenantID          string   `json:"tenantId"`
	Code              string   `json:"code"`
	Name              string   `json:"name"`
	Type              string   `json:"type"`
	Currency          string   `json:"currency"`
	Price             float64  `json:"price"`
	Description       string   `json:"description"`
	Features          []string `json:"features"`
	TrialDays         int      `json:"trialDays"`
	Status            string   `json:"status"`
	BillingInterval   string   `json:"billingInterval"`
	ExternalProductID string   `json:"externalProductId"`
	CreemProductId    string   `json:"creemProductId"`
	ProviderChannelId string   `json:"providerChannelId"`
	SyncStatus        string   `json:"syncStatus"`
	SyncError         string   `json:"syncError"`
	BoundChannelIds   []string `json:"boundChannelIds"`
	CreatedAt         string   `json:"createdAt"`
}

type ProductInput struct {
	ChannelID       string   `json:"channelId"`
	TenantID        string   `json:"tenantId"`
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	Type            string   `json:"type"`
	Currency        string   `json:"currency"`
	Price           float64  `json:"price"`
	Description     string   `json:"description"`
	Features        []string `json:"features"`
	TrialDays       int      `json:"trialDays"`
	Status          string   `json:"status"`
	BillingInterval string   `json:"billingInterval"`
}

func (s *Service) List(ctx context.Context, tenantID, channelID, keyword string) ([]ProductDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.CatalogProduct{})
	if tenantID != "" && tenantID != "ALL" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	if channelID != "" {
		q = q.Where("channel_id = ?", channelID)
	}
	if kw := strings.TrimSpace(keyword); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("name ILIKE ? OR code ILIKE ?", like, like)
	}
	var rows []persistence.CatalogProduct
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ProductDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toProductDTO(r))
	}
	return out, nil
}

func (s *Service) Create(ctx context.Context, in ProductInput) (*ProductDTO, error) {
	ch, err := s.payment.GetRawChannel(ctx, in.ChannelID)
	if err != nil {
		return nil, err
	}
	if ch.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	code := strings.TrimSpace(in.Code)
	name := strings.TrimSpace(in.Name)
	if code == "" || name == "" || in.Price <= 0 {
		return nil, apperr.InvalidArgument
	}
	tenantID := strings.TrimSpace(in.TenantID)
	if tenantID == "" {
		tenantID = ch.TenantID
	}
	if tenantID == "" {
		tenantID = "group_hq"
	}
	featuresJSON, _ := json.Marshal(in.Features)
	row := persistence.CatalogProduct{
		ID:              uuid.NewString(),
		ChannelID:       in.ChannelID,
		TenantID:        tenantID,
		Code:            code,
		Name:            name,
		Description:     strings.TrimSpace(in.Description),
		ProductType:     defaultProductType(in.Type),
		Currency:        strings.ToUpper(defaultCurrency(in.Currency)),
		PriceCents:      int64(in.Price * 100),
		BillingInterval: defaultBillingInterval(in.BillingInterval, in.Type),
		TrialDays:       in.TrialDays,
		Status:          "ACTIVE",
		FeaturesJSON:    string(featuresJSON),
		SyncStatus:      "PENDING",
	}
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	billingType, billingPeriod := mapBilling(row.ProductType, row.BillingInterval)
	creemProd, err := client.CreateProduct(ctx, creem.CreateProductReq{
		Name:          row.Name,
		Description:   row.Description,
		Price:         row.PriceCents,
		Currency:      row.Currency,
		BillingType:   billingType,
		BillingPeriod: billingPeriod,
		TaxCategory:   "saas",
	})
	if err != nil {
		row.SyncStatus = "ERROR"
		row.SyncError = err.Error()
		_ = s.db.WithContext(ctx).Create(&row)
		return nil, apperr.Wrap(50210, 502, "Creem 创建商品失败: "+err.Error(), err)
	}
	now := time.Now().Unix()
	row.ExternalProductID = creemProd.ID
	row.SyncStatus = "SYNCED"
	row.LastSyncedAt = &now
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := toProductDTO(row)
	return &dto, nil
}

func (s *Service) Update(ctx context.Context, id string, in ProductInput) (*ProductDTO, error) {
	var row persistence.CatalogProduct
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	ch, err := s.payment.GetRawChannel(ctx, row.ChannelID)
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
		row.Name = name
	}
	if in.Description != "" {
		updates["description"] = strings.TrimSpace(in.Description)
		row.Description = strings.TrimSpace(in.Description)
	}
	if in.Price > 0 {
		updates["price_cents"] = int64(in.Price * 100)
		row.PriceCents = int64(in.Price * 100)
	}
	if in.Status != "" {
		updates["status"] = in.Status
	}
	if in.Features != nil {
		fj, _ := json.Marshal(in.Features)
		updates["features_json"] = string(fj)
	}
	if row.ExternalProductID != "" && ch.ChannelKey == "creem" {
		client := creem.NewClient(ch.Environment, ch.ApiKey)
		patch := map[string]interface{}{
			"name":        row.Name,
			"description": row.Description,
			"price":       row.PriceCents,
		}
		if _, err := client.UpdateProduct(ctx, row.ExternalProductID, patch); err != nil {
			return nil, apperr.Wrap(50210, 502, "Creem 更新商品失败: "+err.Error(), err)
		}
		now := time.Now().Unix()
		updates["last_synced_at"] = now
		updates["sync_status"] = "SYNCED"
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	return ptr(toProductDTO(row)), nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	var row persistence.CatalogProduct
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	if row.ExternalProductID != "" {
		ch, err := s.payment.GetRawChannel(ctx, row.ChannelID)
		if err == nil && ch.ChannelKey == "creem" {
			client := creem.NewClient(ch.Environment, ch.ApiKey)
			_ = client.ArchiveProduct(ctx, row.ExternalProductID)
		}
	}
	res := s.db.WithContext(ctx).Delete(&persistence.CatalogProduct{}, "id = ?", id)
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return res.Error
}

func (s *Service) SyncFromProvider(ctx context.Context, id string) (*ProductDTO, error) {
	var row persistence.CatalogProduct
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if row.ExternalProductID == "" {
		return nil, apperr.New(42211, 422, "商品尚未关联 Creem")
	}
	ch, err := s.payment.GetRawChannel(ctx, row.ChannelID)
	if err != nil {
		return nil, err
	}
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	prod, err := client.GetProduct(ctx, row.ExternalProductID)
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	updates := map[string]interface{}{
		"name":            prod.Name,
		"description":     prod.Description,
		"price_cents":     prod.Price,
		"currency":        strings.ToUpper(prod.Currency),
		"sync_status":     "SYNCED",
		"last_synced_at":  now,
		"sync_error":      "",
	}
	if prod.Status == "archived" {
		updates["status"] = "ARCHIVED"
	}
	_ = s.db.WithContext(ctx).Model(&row).Updates(updates)
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	return ptr(toProductDTO(row)), nil
}

func (s *Service) ResolveExternalProductIDs(ctx context.Context, channelID string, localIDs []string) ([]string, error) {
	if len(localIDs) == 0 {
		return []string{}, nil
	}
	var rows []persistence.CatalogProduct
	if err := s.db.WithContext(ctx).
		Where("channel_id = ? AND id IN ?", channelID, localIDs).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		if r.ExternalProductID != "" {
			out = append(out, r.ExternalProductID)
		}
	}
	return out, nil
}

func ptr(d ProductDTO) *ProductDTO { return &d }

func toProductDTO(r persistence.CatalogProduct) ProductDTO {
	features := []string{}
	_ = json.Unmarshal([]byte(r.FeaturesJSON), &features)
	createdAt := timex.FormatUTC(r.CreatedAt)
	return ProductDTO{
		ID:                r.ID,
		ChannelID:         r.ChannelID,
		TenantID:          r.TenantID,
		Code:              r.Code,
		Name:              r.Name,
		Type:              r.ProductType,
		Currency:          r.Currency,
		Price:             float64(r.PriceCents) / 100,
		Description:       r.Description,
		Features:          features,
		TrialDays:         r.TrialDays,
		Status:            r.Status,
		BillingInterval:   r.BillingInterval,
		ExternalProductID: r.ExternalProductID,
		CreemProductId:    r.ExternalProductID,
		ProviderChannelId: r.ChannelID,
		SyncStatus:        r.SyncStatus,
		SyncError:         r.SyncError,
		BoundChannelIds:   []string{r.ChannelID},
		CreatedAt:         createdAt,
	}
}

func defaultProductType(t string) string {
	if t != "" {
		return t
	}
	return "SUBSCRIPTION"
}

func defaultCurrency(c string) string {
	if c != "" {
		return c
	}
	return "USD"
}

func defaultBillingInterval(interval, productType string) string {
	if interval != "" {
		return interval
	}
	if productType == "ONE_TIME" || productType == "ADDON" {
		return "ONE_TIME"
	}
	return "MONTHLY"
}

func mapBilling(productType, interval string) (string, string) {
	if productType == "ONE_TIME" || productType == "ADDON" || interval == "ONE_TIME" || interval == "LIFETIME" {
		return "onetime", "once"
	}
	switch interval {
	case "YEARLY":
		return "recurring", "every-year"
	default:
		return "recurring", "every-month"
	}
}
