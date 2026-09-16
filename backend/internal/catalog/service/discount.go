package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

type DiscountDTO struct {
	ID                 string   `json:"id"`
	ChannelID          string   `json:"channelId"`
	TenantID           string   `json:"tenantId"`
	Code               string   `json:"code"`
	Name               string   `json:"name"`
	Type               string   `json:"type"`
	Value              float64  `json:"value"`
	Currency           string   `json:"currency"`
	MinOrderAmount     float64  `json:"minOrderAmount"`
	MaxUsageLimit      int      `json:"maxUsageLimit"`
	UsedCount          int      `json:"usedCount"`
	StartDate          string   `json:"startDate"`
	EndDate            string   `json:"endDate"`
	ApplicableScope    string   `json:"applicableScope"`
	TargetTenantID     string   `json:"targetTenantId"`
	Status             string   `json:"status"`
	Duration           string   `json:"duration"`
	DurationInMonths   int      `json:"durationInMonths"`
	AppliesToProductIds []string `json:"appliesToProductIds"`
	ExternalDiscountID string   `json:"externalDiscountId"`
	CreemDiscountId    string   `json:"creemDiscountId"`
	ProviderChannelId  string   `json:"providerChannelId"`
	SyncStatus         string   `json:"syncStatus"`
	BoundChannelIds    []string `json:"boundChannelIds"`
	CreatedAt          string   `json:"createdAt"`
}

type DiscountInput struct {
	ChannelID           string   `json:"channelId"`
	TenantID            string   `json:"tenantId"`
	Code                string   `json:"code"`
	Name                string   `json:"name"`
	Type                string   `json:"type"`
	Value               float64  `json:"value"`
	Currency            string   `json:"currency"`
	MinOrderAmount      float64  `json:"minOrderAmount"`
	MaxUsageLimit       int      `json:"maxUsageLimit"`
	StartDate           string   `json:"startDate"`
	EndDate             string   `json:"endDate"`
	ApplicableScope     string   `json:"applicableScope"`
	TargetTenantID      string   `json:"targetTenantId"`
	Status              string   `json:"status"`
	Duration            string   `json:"duration"`
	DurationInMonths    int      `json:"durationInMonths"`
	AppliesToProductIds []string `json:"appliesToProductIds"`
}

func (s *Service) ListDiscounts(ctx context.Context, tenantID, channelID string) ([]DiscountDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.CatalogDiscount{})
	if tenantID != "" && tenantID != "ALL" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	if channelID != "" {
		q = q.Where("channel_id = ?", channelID)
	}
	var rows []persistence.CatalogDiscount
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]DiscountDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDiscountDTO(r))
	}
	return out, nil
}

func (s *Service) CreateDiscount(ctx context.Context, in DiscountInput) (*DiscountDTO, error) {
	ch, err := s.payment.GetRawChannel(ctx, in.ChannelID)
	if err != nil {
		return nil, err
	}
	if ch.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	code := strings.TrimSpace(in.Code)
	name := strings.TrimSpace(in.Name)
	if code == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	tenantID := strings.TrimSpace(in.TenantID)
	if tenantID == "" {
		tenantID = "group_hq"
	}
	productSvc := &Service{db: s.db, payment: s.payment}
	extProducts, err := productSvc.ResolveExternalProductIDs(ctx, in.ChannelID, in.AppliesToProductIds)
	if err != nil {
		return nil, err
	}
	if len(extProducts) == 0 {
		return nil, apperr.New(42212, 422, "请至少选择一个已同步的 Creem 商品")
	}
	appliesJSON, _ := json.Marshal(in.AppliesToProductIds)
	row := persistence.CatalogDiscount{
		ID:                    uuid.NewString(),
		ChannelID:             in.ChannelID,
		TenantID:              tenantID,
		Code:                  strings.ToUpper(code),
		Name:                  name,
		DiscountType:          mapDiscountType(in.Type),
		Value:                 int(in.Value),
		Currency:              strings.ToUpper(defaultCurrency(in.Currency)),
		MinOrderAmountCents:   int64(in.MinOrderAmount * 100),
		MaxUsageLimit:         in.MaxUsageLimit,
		StartDate:             in.StartDate,
		EndDate:               in.EndDate,
		ApplicableScope:       defaultScope(in.ApplicableScope),
		TargetTenantID:        in.TargetTenantID,
		Status:                "ACTIVE",
		Duration:              defaultDuration(in.Duration),
		DurationInMonths:      in.DurationInMonths,
		AppliesToProductsJSON: string(appliesJSON),
		SyncStatus:            "PENDING",
	}
	req := creem.CreateDiscountReq{
		Name:              name,
		Code:              row.Code,
		Type:              mapCreemDiscountType(row.DiscountType),
		Duration:          row.Duration,
		AppliesToProducts: extProducts,
	}
	if in.EndDate != "" {
		req.ExpiryDate = in.EndDate
	}
	if in.MaxUsageLimit > 0 {
		req.MaxRedemptions = &in.MaxUsageLimit
	}
	if row.Duration == "repeating" && in.DurationInMonths > 0 {
		req.DurationInMonths = &in.DurationInMonths
	}
	if row.DiscountType == "PERCENTAGE" {
		pct := int(in.Value)
		req.Percentage = &pct
	} else {
		amt := int(in.Value * 100)
		req.Amount = &amt
		req.Currency = row.Currency
	}
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	disc, err := client.CreateDiscount(ctx, req)
	if err != nil {
		row.SyncStatus = "ERROR"
		row.SyncError = err.Error()
		_ = s.db.WithContext(ctx).Create(&row)
		return nil, apperr.Wrap(50210, 502, "Creem 创建折扣失败: "+err.Error(), err)
	}
	row.ExternalDiscountID = disc.ID
	row.UsedCount = disc.RedeemCount
	row.SyncStatus = "SYNCED"
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := toDiscountDTO(row)
	return &dto, nil
}

func (s *Service) UpdateDiscount(ctx context.Context, id string, in DiscountInput) (*DiscountDTO, error) {
	var row persistence.CatalogDiscount
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	ch, err := s.payment.GetRawChannel(ctx, row.ChannelID)
	if err != nil {
		return nil, err
	}
	if ch.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	code := strings.TrimSpace(in.Code)
	name := strings.TrimSpace(in.Name)
	if code == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	productIds := in.AppliesToProductIds
	if len(productIds) == 0 {
		_ = json.Unmarshal([]byte(row.AppliesToProductsJSON), &productIds)
	}
	productSvc := &Service{db: s.db, payment: s.payment}
	extProducts, err := productSvc.ResolveExternalProductIDs(ctx, row.ChannelID, productIds)
	if err != nil {
		return nil, err
	}
	if len(extProducts) == 0 {
		return nil, apperr.New(42212, 422, "请至少选择一个已同步的 Creem 商品")
	}
	discountType := mapDiscountType(in.Type)
	duration := defaultDuration(in.Duration)
	if in.Duration == "" {
		duration = row.Duration
	}
	appliesJSON, _ := json.Marshal(productIds)
	updates := map[string]interface{}{
		"code":                     strings.ToUpper(code),
		"name":                     name,
		"discount_type":            discountType,
		"value":                    int(in.Value),
		"currency":                 strings.ToUpper(defaultCurrency(in.Currency)),
		"min_order_amount_cents":   int64(in.MinOrderAmount * 100),
		"max_usage_limit":          in.MaxUsageLimit,
		"start_date":               in.StartDate,
		"end_date":                 in.EndDate,
		"applicable_scope":         defaultScope(in.ApplicableScope),
		"target_tenant_id":         in.TargetTenantID,
		"duration":                 duration,
		"duration_in_months":       in.DurationInMonths,
		"applies_to_products_json": string(appliesJSON),
	}
	if in.Status != "" {
		updates["status"] = in.Status
	}
	if discountType == "FIXED_AMOUNT" {
		updates["value"] = int(in.Value * 100)
	}
	if strings.TrimSpace(ch.ApiKey) != "" {
		req := creem.CreateDiscountReq{
			Name:              name,
			Code:              strings.ToUpper(code),
			Type:              mapCreemDiscountType(discountType),
			Duration:          duration,
			AppliesToProducts: extProducts,
		}
		if in.EndDate != "" {
			req.ExpiryDate = in.EndDate
		}
		if in.MaxUsageLimit > 0 {
			req.MaxRedemptions = &in.MaxUsageLimit
		}
		if duration == "repeating" {
			months := in.DurationInMonths
			if months == 0 {
				months = row.DurationInMonths
			}
			if months > 0 {
				req.DurationInMonths = &months
			}
		}
		if discountType == "PERCENTAGE" {
			pct := int(in.Value)
			req.Percentage = &pct
		} else {
			amt := int(in.Value * 100)
			req.Amount = &amt
			req.Currency = strings.ToUpper(defaultCurrency(in.Currency))
		}
		client := creem.NewClient(ch.Environment, ch.ApiKey)
		if row.ExternalDiscountID != "" {
			_ = client.DeleteDiscount(ctx, row.ExternalDiscountID)
		}
		disc, err := client.CreateDiscount(ctx, req)
		if err != nil {
			return nil, apperr.Wrap(50210, 502, "Creem 更新折扣失败: "+err.Error(), err)
		}
		updates["external_discount_id"] = disc.ID
		updates["used_count"] = disc.RedeemCount
		updates["sync_status"] = "SYNCED"
		updates["sync_error"] = ""
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := toDiscountDTO(row)
	return &dto, nil
}

func (s *Service) DeleteDiscount(ctx context.Context, id string) error {
	var row persistence.CatalogDiscount
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	if row.ExternalDiscountID != "" {
		ch, err := s.payment.GetRawChannel(ctx, row.ChannelID)
		if err == nil {
			client := creem.NewClient(ch.Environment, ch.ApiKey)
			_ = client.DeleteDiscount(ctx, row.ExternalDiscountID)
		}
	}
	res := s.db.WithContext(ctx).Delete(&persistence.CatalogDiscount{}, "id = ?", id)
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return res.Error
}

func toDiscountDTO(r persistence.CatalogDiscount) DiscountDTO {
	productIds := []string{}
	_ = json.Unmarshal([]byte(r.AppliesToProductsJSON), &productIds)
	val := float64(r.Value)
	if r.DiscountType == "FIXED_AMOUNT" {
		val = float64(r.Value) / 100
	}
	return DiscountDTO{
		ID:                  r.ID,
		ChannelID:           r.ChannelID,
		TenantID:            r.TenantID,
		Code:                r.Code,
		Name:                r.Name,
		Type:                r.DiscountType,
		Value:               val,
		Currency:            r.Currency,
		MinOrderAmount:      float64(r.MinOrderAmountCents) / 100,
		MaxUsageLimit:       r.MaxUsageLimit,
		UsedCount:           r.UsedCount,
		StartDate:           r.StartDate,
		EndDate:             r.EndDate,
		ApplicableScope:     r.ApplicableScope,
		TargetTenantID:      r.TargetTenantID,
		Status:              r.Status,
		Duration:            r.Duration,
		DurationInMonths:    r.DurationInMonths,
		AppliesToProductIds: productIds,
		ExternalDiscountID:  r.ExternalDiscountID,
		CreemDiscountId:     r.ExternalDiscountID,
		ProviderChannelId:   r.ChannelID,
		SyncStatus:          r.SyncStatus,
		BoundChannelIds:     []string{r.ChannelID},
		CreatedAt:           timex.FormatUTC(r.CreatedAt),
	}
}

func mapDiscountType(t string) string {
	if strings.ToUpper(t) == "FIXED_AMOUNT" {
		return "FIXED_AMOUNT"
	}
	return "PERCENTAGE"
}

func mapCreemDiscountType(t string) string {
	if t == "FIXED_AMOUNT" {
		return "fixed"
	}
	return "percentage"
}

func defaultScope(s string) string {
	if s != "" {
		return s
	}
	return "ALL"
}

func defaultDuration(d string) string {
	if d != "" {
		return d
	}
	return "once"
}
