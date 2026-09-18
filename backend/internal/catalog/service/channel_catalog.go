package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type CopyBetweenChannelsResult struct {
	Created int `json:"created"`
	Skipped int `json:"skipped"`
	Total   int `json:"total"`
}

func (s *Service) assertCreemChannelPair(ctx context.Context, sourceID, targetID string) (*persistence.PaymentChannel, *persistence.PaymentChannel, error) {
	if sourceID == "" || targetID == "" {
		return nil, nil, apperr.InvalidArgument
	}
	if sourceID == targetID {
		return nil, nil, apperr.New(40002, 400, "源渠道与目标渠道不能相同")
	}
	src, err := s.payment.GetRawChannel(ctx, sourceID)
	if err != nil {
		return nil, nil, err
	}
	dst, err := s.payment.GetRawChannel(ctx, targetID)
	if err != nil {
		return nil, nil, err
	}
	if src.ChannelKey != "creem" || dst.ChannelKey != "creem" {
		return nil, nil, apperr.ProviderNotSupported
	}
	return src, dst, nil
}

func (s *Service) CopyProductsBetweenChannels(ctx context.Context, sourceChannelID, targetChannelID string) (*CopyBetweenChannelsResult, error) {
	_, dstCh, err := s.assertCreemChannelPair(ctx, sourceChannelID, targetChannelID)
	if err != nil {
		return nil, err
	}
	var rows []persistence.CatalogProduct
	if err := s.db.WithContext(ctx).Where("channel_id = ?", sourceChannelID).Order("created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := &CopyBetweenChannelsResult{Total: len(rows)}
	tenantID := dstCh.TenantID
	if tenantID == "" || tenantID == "ALL" {
		tenantID = "group_hq"
	}
	for _, row := range rows {
		var exists int64
		_ = s.db.WithContext(ctx).Model(&persistence.CatalogProduct{}).
			Where("channel_id = ? AND code = ?", targetChannelID, row.Code).Count(&exists)
		if exists > 0 {
			result.Skipped++
			continue
		}
		features := []string{}
		_ = json.Unmarshal([]byte(row.FeaturesJSON), &features)
		in := ProductInput{
			ChannelID:       targetChannelID,
			TenantID:        tenantID,
			Code:            row.Code,
			Name:            row.Name,
			Type:            row.ProductType,
			Currency:        row.Currency,
			Price:           float64(row.PriceCents) / 100,
			Description:     row.Description,
			Features:        features,
			TrialDays:       row.TrialDays,
			Status:          row.Status,
			BillingInterval: row.BillingInterval,
		}
		if _, err := s.Create(ctx, in); err != nil {
			return nil, err
		}
		result.Created++
	}
	return result, nil
}

func (s *Service) mapTargetProductIDsByCode(ctx context.Context, sourceChannelID, targetChannelID string, sourceProductIDs []string) ([]string, error) {
	if len(sourceProductIDs) == 0 {
		return []string{}, nil
	}
	var sourceRows []persistence.CatalogProduct
	if err := s.db.WithContext(ctx).Where("channel_id = ? AND id IN ?", sourceChannelID, sourceProductIDs).Find(&sourceRows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(sourceRows))
	for _, sp := range sourceRows {
		var target persistence.CatalogProduct
		err := s.db.WithContext(ctx).
			Where("channel_id = ? AND code = ?", targetChannelID, sp.Code).
			First(&target).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		out = append(out, target.ID)
	}
	return out, nil
}

func (s *Service) CopyDiscountsBetweenChannels(ctx context.Context, sourceChannelID, targetChannelID string) (*CopyBetweenChannelsResult, error) {
	_, dstCh, err := s.assertCreemChannelPair(ctx, sourceChannelID, targetChannelID)
	if err != nil {
		return nil, err
	}
	var rows []persistence.CatalogDiscount
	if err := s.db.WithContext(ctx).Where("channel_id = ?", sourceChannelID).Order("created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := &CopyBetweenChannelsResult{Total: len(rows)}
	tenantID := dstCh.TenantID
	if tenantID == "" || tenantID == "ALL" {
		tenantID = "group_hq"
	}
	for _, row := range rows {
		var exists int64
		_ = s.db.WithContext(ctx).Model(&persistence.CatalogDiscount{}).
			Where("channel_id = ? AND code = ?", targetChannelID, row.Code).Count(&exists)
		if exists > 0 {
			result.Skipped++
			continue
		}
		sourceProductIDs := []string{}
		_ = json.Unmarshal([]byte(row.AppliesToProductsJSON), &sourceProductIDs)
		targetProductIDs, err := s.mapTargetProductIDsByCode(ctx, sourceChannelID, targetChannelID, sourceProductIDs)
		if err != nil {
			return nil, err
		}
		if len(targetProductIDs) == 0 {
			result.Skipped++
			continue
		}
		val := float64(row.Value)
		if row.DiscountType == "FIXED_AMOUNT" {
			val = float64(row.Value) / 100
		}
		in := DiscountInput{
			ChannelID:           targetChannelID,
			TenantID:            tenantID,
			Code:                row.Code,
			Name:                row.Name,
			Type:                row.DiscountType,
			Value:               val,
			Currency:            row.Currency,
			MinOrderAmount:      float64(row.MinOrderAmountCents) / 100,
			MaxUsageLimit:       row.MaxUsageLimit,
			StartDate:           row.StartDate,
			EndDate:             row.EndDate,
			ApplicableScope:     row.ApplicableScope,
			TargetTenantID:      row.TargetTenantID,
			Status:              row.Status,
			Duration:            row.Duration,
			DurationInMonths:    row.DurationInMonths,
			AppliesToProductIds: targetProductIDs,
		}
		if _, err := s.CreateDiscount(ctx, in); err != nil {
			return nil, err
		}
		result.Created++
	}
	return result, nil
}

func (s *Service) SyncDiscountsFromCreem(ctx context.Context, channelID string) (*SyncFromCreemResult, error) {
	channelID = strings.TrimSpace(channelID)
	if channelID == "" {
		return nil, apperr.InvalidArgument
	}
	ch, err := s.payment.GetRawChannel(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	tenantID := ch.TenantID
	if tenantID == "" || tenantID == "ALL" {
		tenantID = "group_hq"
	}
	result := &SyncFromCreemResult{}
	page := 1
	for {
		items, err := client.ListDiscounts(ctx, page, 100)
		if err != nil {
			return nil, apperr.Wrap(50210, 502, "Creem 拉取折扣失败: "+err.Error(), err)
		}
		if len(items) == 0 {
			break
		}
		for _, disc := range items {
			if strings.TrimSpace(disc.ID) == "" {
				continue
			}
			localProductIDs, _ := s.resolveLocalProductIDsByExternal(ctx, channelID, disc.AppliesToProducts)
			appliesJSON, _ := json.Marshal(localProductIDs)
			discountType := "PERCENTAGE"
			value := 0
			if strings.EqualFold(disc.Type, "fixed") {
				discountType = "FIXED_AMOUNT"
				if disc.Amount != nil {
					value = *disc.Amount
				}
			} else if disc.Percentage != nil {
				value = *disc.Percentage
			}
			status := "ACTIVE"
			if strings.EqualFold(disc.Status, "disabled") || strings.EqualFold(disc.Status, "expired") {
				status = "DISABLED"
			}
			var existing persistence.CatalogDiscount
			err := s.db.WithContext(ctx).
				Where("channel_id = ? AND external_discount_id = ?", channelID, disc.ID).
				First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				code := strings.ToUpper(strings.TrimSpace(disc.Code))
				if code == "" {
					code = "CREEM-" + strings.ToUpper(disc.ID)
				}
				row := persistence.CatalogDiscount{
					ID:                    uuid.NewString(),
					ChannelID:             channelID,
					TenantID:              tenantID,
					Code:                  code,
					Name:                  disc.Name,
					DiscountType:          discountType,
					Value:                 value,
					Currency:              strings.ToUpper(defaultCurrency(disc.Currency)),
					MaxUsageLimit:         0,
					UsedCount:             disc.RedeemCount,
					EndDate:               disc.ExpiryDate,
					ApplicableScope:       "ALL",
					Status:                status,
					Duration:              defaultDuration(disc.Duration),
					AppliesToProductsJSON: string(appliesJSON),
					ExternalDiscountID:    disc.ID,
					SyncStatus:            "SYNCED",
				}
				if disc.MaxRedemptions != nil {
					row.MaxUsageLimit = *disc.MaxRedemptions
				}
				if disc.DurationInMonths != nil {
					row.DurationInMonths = *disc.DurationInMonths
				}
				if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
					return nil, err
				}
				result.Created++
			} else if err != nil {
				return nil, err
			} else {
				updates := map[string]interface{}{
					"name":                     disc.Name,
					"code":                     strings.ToUpper(strings.TrimSpace(disc.Code)),
					"discount_type":            discountType,
					"value":                    value,
					"used_count":               disc.RedeemCount,
					"end_date":                 disc.ExpiryDate,
					"status":                   status,
					"applies_to_products_json": string(appliesJSON),
					"sync_status":              "SYNCED",
					"sync_error":               "",
				}
				if disc.MaxRedemptions != nil {
					updates["max_usage_limit"] = *disc.MaxRedemptions
				}
				if err := s.db.WithContext(ctx).Model(&existing).Updates(updates).Error; err != nil {
					return nil, err
				}
				result.Updated++
			}
			result.Total++
		}
		if len(items) < 100 {
			break
		}
		page++
	}
	return result, nil
}

func (s *Service) resolveLocalProductIDsByExternal(ctx context.Context, channelID string, externalIDs []string) ([]string, error) {
	if len(externalIDs) == 0 {
		return []string{}, nil
	}
	var rows []persistence.CatalogProduct
	if err := s.db.WithContext(ctx).
		Where("channel_id = ? AND external_product_id IN ?", channelID, externalIDs).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.ID)
	}
	return out, nil
}
