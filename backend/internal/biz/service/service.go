package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// --- Apps ---

type AppDTO map[string]interface{}

func (s *Service) ListApps(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentApp{})
	if tenantID != "" && tenantID != "group_hq" && tenantID != "ALL" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var rows []persistence.PaymentApp
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return appsFromRows(rows)
}

func (s *Service) GetApp(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.PaymentApp
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	return unmarshalMap(row.DataJSON)
}

func (s *Service) SaveApp(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
	id, _ := payload["id"].(string)
	if id == "" {
		id = "app_" + strings.ToLower(uuid.NewString()[:8])
		payload["id"] = id
	}
	tenantID, _ := payload["tenantId"].(string)
	code, _ := payload["code"].(string)
	if code == "" {
		code = id
		payload["code"] = code
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, apperr.Internal
	}
	var existing persistence.PaymentApp
	err = s.db.WithContext(ctx).First(&existing, "id = ?", id).Error
	if err == nil {
		existing.TenantID = tenantID
		existing.Code = code
		existing.DataJSON = string(data)
		if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, err
		}
		return payload, nil
	}
	row := persistence.PaymentApp{ID: id, TenantID: tenantID, Code: code, DataJSON: string(data)}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "应用编码冲突", err)
	}
	return payload, nil
}

func (s *Service) DeleteApp(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.PaymentApp{}, id)
}

func appsFromRows(rows []persistence.PaymentApp) ([]map[string]interface{}, error) {
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}

func unmarshalMap(raw string) (map[string]interface{}, error) {
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil, err
	}
	return m, nil
}

// --- Settlements ---

func (s *Service) ListSettlements(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.SettlementBatch{})
	if tenantID != "" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var rows []persistence.SettlementBatch
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}

func (s *Service) GetSettlement(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	return unmarshalMap(row.DataJSON)
}

func (s *Service) GenerateSettlements(ctx context.Context, tenantID string) (int, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentTransaction{}).Where("status = ?", "done")
	if tenantID != "" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var txs []persistence.PaymentTransaction
	if err := q.Find(&txs).Error; err != nil {
		return 0, err
	}
	groups := map[string][]persistence.PaymentTransaction{}
	for _, tx := range txs {
		day := timex.FormatDate(tx.CreatedAt)
		key := tx.TenantID + "|" + tx.Channel + "|" + day
		groups[key] = append(groups[key], tx)
	}
	created := 0
	for key, items := range groups {
		parts := strings.Split(key, "|")
		if len(parts) != 3 {
			continue
		}
		tid, ch, day := parts[0], parts[1], parts[2]
		batchID := fmt.Sprintf("STL-%s-%s-%s", day, ch, tid)
		var count int64
		s.db.WithContext(ctx).Model(&persistence.SettlementBatch{}).Where("id = ?", batchID).Count(&count)
		if count > 0 {
			continue
		}
		var gross, fee int64
		for _, tx := range items {
			gross += tx.OrderAmountCents
			fee += tx.ChannelFeeCents
		}
		payload := map[string]interface{}{
			"id":               batchID,
			"tenantId":         tid,
			"channel":          ch,
			"currency":         items[0].Currency,
			"receivableAmount": float64(gross) / 100,
			"fee":              float64(fee) / 100,
			"netAmount":        float64(gross-fee) / 100,
			"status":           "PENDING",
			"cycle":            "T+1",
			"createdAt":        timex.FormatDateTime(time.Now().Unix()),
			"txItems":          []interface{}{},
			"fees": map[string]interface{}{
				"channelFee": float64(fee) / 100,
			},
		}
		data, _ := json.Marshal(payload)
		row := persistence.SettlementBatch{
			ID: batchID, TenantID: tid, Channel: ch, BatchDate: day, Status: "PENDING", DataJSON: string(data),
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err == nil {
			created++
		}
	}
	return created, nil
}

func (s *Service) CreatePayout(ctx context.Context, batchID string, amount float64) error {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return apperr.Internal
	}
	m["status"] = "PAID"
	m["remark"] = fmt.Sprintf("出金 %.2f", amount)
	data, _ := json.Marshal(m)
	row.Status = "PAID"
	row.DataJSON = string(data)
	return s.db.WithContext(ctx).Save(&row).Error
}

// --- Generic JSON CRUD helpers for remaining domains ---

func (s *Service) listDomain(ctx context.Context, model any) ([]map[string]interface{}, error) {
	rows, err := fetchDataJSONRows(ctx, s.db, model, "created_at DESC")
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, raw := range rows {
		m, err := unmarshalMap(raw)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}

func (s *Service) saveDomain(ctx context.Context, model any, payload map[string]interface{}, table string) (map[string]interface{}, error) {
	id, _ := payload["id"].(string)
	if id == "" {
		id = table + "_" + strings.ToLower(uuid.NewString()[:8])
		payload["id"] = id
	}
	if _, ok := payload["createdAt"]; !ok {
		payload["createdAt"] = timex.FormatDateTime(time.Now().Unix())
	}
	payload["updatedAt"] = timex.FormatDateTime(time.Now().Unix())
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, apperr.Internal
	}
	// upsert by checking existence
	var count int64
	s.db.WithContext(ctx).Table(table).Where("id = ?", id).Count(&count)
	if count > 0 {
		if err := s.db.WithContext(ctx).Table(table).Where("id = ?", id).Update("data_json", string(data)).Error; err != nil {
			return nil, err
		}
		return payload, nil
	}
	row := map[string]interface{}{"id": id, "data_json": string(data)}
	if tenantID, ok := payload["tenantId"].(string); ok && tenantID != "" {
		row["tenant_id"] = tenantID
	}
	if email, ok := payload["email"].(string); ok && email != "" {
		row["email"] = email
	}
	if err := s.db.WithContext(ctx).Table(table).Create(row).Error; err != nil {
		return nil, err
	}
	return payload, nil
}

func (s *Service) ListPromoCampaigns(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.PromoCampaign{})
}
func (s *Service) SavePromoCampaign(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.PromoCampaign{}, p, "promo_campaigns")
}
func (s *Service) DeletePromoCampaign(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.PromoCampaign{}, id)
}

func (s *Service) ListEndUsers(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.EndUser{})
	if tenantID != "" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var rows []persistence.EndUser
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}
func (s *Service) SaveEndUser(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.EndUser{}, p, "end_users")
}
func (s *Service) DeleteEndUser(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.EndUser{}, id)
}

func (s *Service) ListExchangeRates(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.ExchangeRate{})
}
func (s *Service) SaveExchangeRate(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	item, err := s.saveDomain(ctx, &persistence.ExchangeRate{}, p, "exchange_rates")
	if err != nil {
		return nil, err
	}
	id, _ := item["id"].(string)
	hist := persistence.ExchangeRateHistory{
		ID: newID(), RateID: id,
		Rate:       avgRate(item),
		RecordedAt: time.Now().Unix(),
	}
	_ = s.db.WithContext(ctx).Create(&hist).Error
	return item, nil
}
func (s *Service) DeleteExchangeRate(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.ExchangeRate{}, id)
}

func avgRate(m map[string]interface{}) float64 {
	bid, _ := m["bid"].(float64)
	ask, _ := m["ask"].(float64)
	if bid > 0 && ask > 0 {
		return (bid + ask) / 2
	}
	if bid > 0 {
		return bid
	}
	return ask
}

func (s *Service) GetExchangeRateHistory(ctx context.Context, rateID string, days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days).Unix()
	var rows []persistence.ExchangeRateHistory
	if err := s.db.WithContext(ctx).Where("rate_id = ? AND recorded_at >= ?", rateID, since).
		Order("recorded_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		out = append(out, map[string]interface{}{
			"rate":       r.Rate,
			"recordedAt": timex.FormatDateTime(r.RecordedAt),
		})
	}
	return out, nil
}

func (s *Service) ListFeeRules(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.FeeRule{})
}
func (s *Service) SaveFeeRule(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.FeeRule{}, p, "fee_rules")
}
func (s *Service) DeleteFeeRule(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.FeeRule{}, id)
}

func (s *Service) ListRiskRules(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.RiskRule{})
}
func (s *Service) SaveRiskRule(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.RiskRule{}, p, "risk_rules")
}
func (s *Service) DeleteRiskRule(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.RiskRule{}, id)
}

func (s *Service) ListBlacklist(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.BlacklistEntry{})
}
func (s *Service) SaveBlacklist(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.BlacklistEntry{}, p, "blacklist_entries")
}
func (s *Service) DeleteBlacklist(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.BlacklistEntry{}, id)
}

func (s *Service) ListMerchantApplications(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.MerchantApplication{})
}
func (s *Service) SaveMerchantApplication(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.MerchantApplication{}, p, "merchant_applications")
}
func (s *Service) ApproveMerchant(ctx context.Context, id string) (map[string]interface{}, error) {
	return s.updateMerchantStatus(ctx, id, "APPROVED", "")
}
func (s *Service) RejectMerchant(ctx context.Context, id string, reason string) (map[string]interface{}, error) {
	return s.updateMerchantStatus(ctx, id, "REJECTED", reason)
}

func (s *Service) updateMerchantStatus(ctx context.Context, id, status, reason string) (map[string]interface{}, error) {
	var row persistence.MerchantApplication
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	m["status"] = status
	if reason != "" {
		m["rejectReason"] = reason
	}
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListAlertRules(ctx context.Context) ([]map[string]interface{}, error) {
	return s.listDomain(ctx, &persistence.AlertRule{})
}
func (s *Service) SaveAlertRule(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	return s.saveDomain(ctx, &persistence.AlertRule{}, p, "alert_rules")
}
func (s *Service) DeleteAlertRule(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.AlertRule{}, id)
}
func (s *Service) ToggleAlertRule(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.AlertRule
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	st, _ := m["status"].(string)
	if st == "ENABLED" {
		m["status"] = "DISABLED"
	} else {
		m["status"] = "ENABLED"
	}
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListAlertHistory(ctx context.Context) ([]map[string]interface{}, error) {
	var rows []persistence.AlertHistory
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}
func (s *Service) SaveAlertHistory(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	id, _ := p["id"].(string)
	if id == "" {
		id = "alert_" + strings.ToLower(uuid.NewString()[:8])
		p["id"] = id
	}
	data, _ := json.Marshal(p)
	ruleID, _ := p["ruleId"].(string)
	row := persistence.AlertHistory{ID: id, RuleID: ruleID, DataJSON: string(data)}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	return p, nil
}

// --- Reports ---

func (s *Service) RevenueReport(ctx context.Context, tenantID, from, to string) (map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentTransaction{}).Where("status = ?", "done")
	if tenantID != "" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var txs []persistence.PaymentTransaction
	if err := q.Find(&txs).Error; err != nil {
		return nil, err
	}
	var total int64
	byChannel := map[string]float64{}
	for _, tx := range txs {
		total += tx.OrderAmountCents
		byChannel[tx.Channel] += float64(tx.OrderAmountCents) / 100
	}
	return map[string]interface{}{
		"totalRevenue":   float64(total) / 100,
		"orderCount":     len(txs),
		"channelBreakdown": byChannel,
		"from":           from,
		"to":             to,
	}, nil
}

