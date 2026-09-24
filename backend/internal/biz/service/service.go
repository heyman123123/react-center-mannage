package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/tenant"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	shards *sharding.Shards
}

func NewService(db *gorm.DB, shards *sharding.Shards) *Service {
	return &Service{db: db, shards: shards}
}

func (s *Service) listDoneTransactions(ctx context.Context, tenantID string) ([]persistence.PaymentTransaction, error) {
	filter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL").Where("status = ?", "done")
		q = tenant.Apply(q, tenantID)
		return q
	}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	var txs []persistence.PaymentTransaction
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var chunk []persistence.PaymentTransaction
		if err := filter(s.shards.DB().WithContext(ctx).Table(tbl)).Find(&chunk).Error; err != nil {
			return nil, err
		}
		txs = append(txs, chunk...)
	}
	return txs, nil
}

// --- Apps ---

type AppDTO map[string]interface{}

func (s *Service) ListApps(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentApp{})
	q = tenant.Apply(q, tenantID)
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
	return paymentAppToMap(row)
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
	var existing persistence.PaymentApp
	err := s.db.WithContext(ctx).First(&existing, "id = ?", id).Error
	if err == nil {
		existing.TenantID = tenantID
		existing.Code = code
		applyPaymentAppPayload(&existing, payload)
		if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return nil, err
		}
		return payload, nil
	}
	row := persistence.PaymentApp{ID: id, TenantID: tenantID, Code: code}
	applyPaymentAppPayload(&row, payload)
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
		m, err := paymentAppToMap(r)
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
	q = tenant.Apply(q, tenantID)
	var rows []persistence.SettlementBatch
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := s.settlementDTO(ctx, r)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}

func (s *Service) settlementDTO(ctx context.Context, row persistence.SettlementBatch) (map[string]interface{}, error) {
	var items []persistence.SettlementBatchItem
	_ = s.db.WithContext(ctx).Where("batch_id = ?", row.ID).Order("created_at ASC").Find(&items).Error
	return settlementToMap(row, items)
}

func (s *Service) GetSettlement(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	return s.settlementDTO(ctx, row)
}

func (s *Service) GenerateSettlements(ctx context.Context, tenantID string) (int, error) {
	txs, err := s.listDoneTransactions(ctx, tenantID)
	if err != nil {
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
			"fees": map[string]interface{}{
				"channelFee": float64(fee) / 100,
			},
		}
		row := persistence.SettlementBatch{
			ID: batchID, TenantID: tid, Channel: ch, BatchDate: day, Status: "PENDING",
		}
		applySettlementFromPayload(&row, payload)
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			continue
		}
		for _, tx := range items {
			item := persistence.SettlementBatchItem{
				ID:                   newID(),
				BatchID:              batchID,
				TransactionID:        tx.ID,
				TransactionDisplayID: tx.DisplayID,
				OrderAmountCents:     tx.OrderAmountCents,
				ChannelFeeCents:      tx.ChannelFeeCents,
				Currency:             tx.Currency,
			}
			_ = s.db.WithContext(ctx).Create(&item).Error
		}
		created++
	}
	return created, nil
}

func (s *Service) CreatePayout(ctx context.Context, batchID string, amount float64) error {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return apperr.NotFound
	}
	now := time.Now().UTC().Unix()
	// 状态机：APPROVED → PAYING → PAID（同步简化，经过 PAYING 状态记录）。
	row.Status = "PAYING"
	row.PaidAt = &now
	row.Remark = fmt.Sprintf("出金 %.2f", amount)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return err
	}
	row.Status = "PAID"
	return s.db.WithContext(ctx).Save(&row).Error
}

// ApproveSettlement 审核通过结算批次：PENDING/UNDER_REVIEW → APPROVED。
func (s *Service) ApproveSettlement(ctx context.Context, batchID, reviewer string) (map[string]interface{}, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return nil, apperr.NotFound
	}
	switch row.Status {
	case "APPROVED", "PAID", "PAYING":
		return nil, apperr.Conflict
	case "REJECTED":
		return nil, apperr.New(42240, 422, "已驳回的批次不能直接通过，请重新生成")
	}
	now := time.Now().UTC().Unix()
	row.Status = "APPROVED"
	row.ReviewedAt = &now
	row.ApprovedAt = &now
	row.Reviewer = strings.TrimSpace(reviewer)
	row.RejectReason = ""
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return s.settlementDTO(ctx, row)
}

// RejectSettlement 驳回结算批次：任意待处理状态 → REJECTED。
func (s *Service) RejectSettlement(ctx context.Context, batchID, reason, reviewer string) (map[string]interface{}, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return nil, apperr.NotFound
	}
	switch row.Status {
	case "PAID", "PAYING":
		return nil, apperr.New(42241, 422, "已打款的批次不能驳回")
	}
	now := time.Now().UTC().Unix()
	row.Status = "REJECTED"
	row.ReviewedAt = &now
	row.Reviewer = strings.TrimSpace(reviewer)
	row.RejectReason = strings.TrimSpace(reason)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return s.settlementDTO(ctx, row)
}

// UploadPayoutProof 追加打款凭证到 PayoutProofJSON。
func (s *Service) UploadPayoutProof(ctx context.Context, batchID, fileName, fileSize string) (map[string]interface{}, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return nil, apperr.NotFound
	}
	proofs := []map[string]interface{}{}
	if row.PayoutProofJSON != "" && row.PayoutProofJSON != "[]" {
		_ = json.Unmarshal([]byte(row.PayoutProofJSON), &proofs)
	}
	proofs = append(proofs, map[string]interface{}{
		"fileName":  fileName,
		"fileSize":  fileSize,
		"uploadedAt": timex.FormatUTC(time.Now().UTC().Unix()),
	})
	raw, _ := json.Marshal(proofs)
	row.PayoutProofJSON = string(raw)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return s.settlementDTO(ctx, row)
}

// SupplementBatch 批次补单：将同 tenant+channel+batchDate 当天新增、已对账(done)且未入批次的交易补入。
func (s *Service) SupplementBatch(ctx context.Context, batchID string) (int, error) {
	var row persistence.SettlementBatch
	if err := s.db.WithContext(ctx).First(&row, "id = ?", batchID).Error; err != nil {
		return 0, apperr.NotFound
	}
	// 已在批次中的交易 id。
	existing := map[string]bool{}
	var items []persistence.SettlementBatchItem
	_ = s.db.WithContext(ctx).Where("batch_id = ?", batchID).Find(&items).Error
	for _, it := range items {
		existing[it.TransactionID] = true
	}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	added := 0
	var extraGross, extraFee int64
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var txs []persistence.PaymentTransaction
		q := s.shards.DB().WithContext(ctx).Table(tbl).
			Where("tenant_id = ? AND channel = ? AND status = ? AND deleted_at IS NULL", row.TenantID, row.Channel, "done")
		if err := q.Find(&txs).Error; err != nil {
			return added, err
		}
		for _, tx := range txs {
			if timex.FormatDate(tx.CreatedAt) != row.BatchDate {
				continue
			}
			if existing[tx.ID] {
				continue
			}
			item := persistence.SettlementBatchItem{
				ID:                   newID(),
				BatchID:              batchID,
				TransactionID:        tx.ID,
				TransactionDisplayID: tx.DisplayID,
				OrderAmountCents:     tx.OrderAmountCents,
				ChannelFeeCents:      tx.ChannelFeeCents,
				Currency:             tx.Currency,
			}
			if err := s.db.WithContext(ctx).Create(&item).Error; err == nil {
				added++
				extraGross += tx.OrderAmountCents
				extraFee += tx.ChannelFeeCents
				existing[tx.ID] = true
			}
		}
	}
	if added > 0 {
		row.ReceivableAmountCents += extraGross
		row.FeeCents += extraFee
		row.NetAmountCents += (extraGross - extraFee)
		_ = s.db.WithContext(ctx).Save(&row).Error
	}
	return added, nil
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
	q = tenant.Apply(q, tenantID)
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

// ToggleRiskRule 切换规则状态 ENABLED <-> DISABLED（DRAFT/OBSERVE 不参与切换）。
func (s *Service) ToggleRiskRule(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.RiskRule
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

func (s *Service) ListBlacklist(ctx context.Context, filterType string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.BlacklistEntry{})
	var rows []persistence.BlacklistEntry
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			continue
		}
		if filterType != "" {
			t, _ := m["type"].(string)
			if t != filterType {
				continue
			}
		}
		out = append(out, m)
	}
	return out, nil
}
func (s *Service) SaveBlacklist(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	if _, ok := p["status"]; !ok {
		p["status"] = "ACTIVE"
	}
	if _, ok := p["source"]; !ok {
		p["source"] = "MANUAL"
	}
	return s.saveDomain(ctx, &persistence.BlacklistEntry{}, p, "blacklist_entries")
}
func (s *Service) DeleteBlacklist(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.BlacklistEntry{}, id)
}

// BatchImportBlacklist 批量导入黑名单，按 type+value 去重，返回 imported/skipped。
func (s *Service) BatchImportBlacklist(ctx context.Context, entries []map[string]interface{}, tenantID string) (map[string]interface{}, error) {
	// 加载已有 ACTIVE 记录，构建 type|value 去重集合。
	existing := map[string]bool{}
	raws, err := fetchDataJSONRows(ctx, s.db, &persistence.BlacklistEntry{}, "created_at DESC")
	if err != nil {
		return nil, err
	}
	for _, raw := range raws {
		m, err := unmarshalMap(raw)
		if err != nil {
			continue
		}
		st, _ := m["status"].(string)
		if st == "" {
			st = "ACTIVE"
		}
		if st != "ACTIVE" {
			continue
		}
		t, _ := m["type"].(string)
		v, _ := m["value"].(string)
		if t != "" && v != "" {
			existing[t+"|"+v] = true
		}
	}
	imported, skipped := 0, 0
	for _, e := range entries {
		t, _ := e["type"].(string)
		v, _ := e["value"].(string)
		reason, _ := e["reason"].(string)
		if t == "" || v == "" || existing[t+"|"+v] {
			skipped++
			continue
		}
		payload := map[string]interface{}{
			"type":     t,
			"value":    v,
			"reason":   reason,
			"source":   "IMPORT",
			"status":   "ACTIVE",
			"tenantId": tenantID,
		}
		if _, err := s.saveDomain(ctx, &persistence.BlacklistEntry{}, payload, "blacklist_entries"); err != nil {
			skipped++
			continue
		}
		existing[t+"|"+v] = true
		imported++
	}
	return map[string]interface{}{"imported": imported, "skipped": skipped}, nil
}

// --- Risk Decisions / Reviews ---

// riskMatchedRule 命中规则摘要。
type riskMatchedRule struct {
	RuleID      string `json:"ruleId"`
	RuleName    string `json:"ruleName"`
	RuleType    string `json:"ruleType"`
	ScoreWeight int    `json:"scoreWeight"`
	Observed    bool   `json:"observed,omitempty"` // OBSERVE 规则只记录不影响决策
}

// riskBlacklistHit 命中黑名单摘要。
type riskBlacklistHit struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// EvaluateRisk 风控评估主入口：黑名单命中 + 规则命中 -> 风险分 -> decision，
// 落库 RiskDecision；REVIEW 时自动创建 RiskReview。
func (s *Service) EvaluateRisk(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
	tenantID, _ := payload["tenantId"].(string)
	transactionID, _ := payload["transactionId"].(string)
	amount, _ := payload["amount"].(float64)
	customerEmail, _ := payload["customerEmail"].(string)
	customerIP, _ := payload["customerIp"].(string)
	customerCountry, _ := payload["customerCountry"].(string)
	cardBin, _ := payload["cardBin"].(string)
	deviceFP, _ := payload["deviceFingerprint"].(string)

	// a. 黑名单匹配：每命中一条加 20 分。
	blacklistHits := []riskBlacklistHit{}
	rawBL, err := fetchDataJSONRows(ctx, s.db, &persistence.BlacklistEntry{}, "created_at DESC")
	if err != nil {
		return nil, err
	}
	for _, raw := range rawBL {
		m, err := unmarshalMap(raw)
		if err != nil {
			continue
		}
		st, _ := m["status"].(string)
		if st != "" && st != "ACTIVE" {
			continue
		}
		t, _ := m["type"].(string)
		v, _ := m["value"].(string)
		hit := false
		switch t {
		case "EMAIL":
			hit = customerEmail != "" && strings.EqualFold(customerEmail, v)
		case "IP":
			hit = customerIP != "" && customerIP == v
		case "COUNTRY":
			hit = customerCountry != "" && strings.EqualFold(customerCountry, v)
		case "CARD_BIN":
			hit = cardBin != "" && strings.HasPrefix(cardBin, v)
		case "DEVICE_FINGERPRINT":
			hit = deviceFP != "" && deviceFP == v
		}
		if hit {
			blacklistHits = append(blacklistHits, riskBlacklistHit{Type: t, Value: v})
		}
	}
	score := 20 * len(blacklistHits)

	// b/c. 遍历 ENABLED + OBSERVE 规则。ENABLED 命中计入风险分；OBSERVE 只记录不影响决策。
	matchedRules := []riskMatchedRule{}
	rawRules, err := fetchDataJSONRows(ctx, s.db, &persistence.RiskRule{}, "created_at DESC")
	if err != nil {
		return nil, err
	}
	for _, raw := range rawRules {
		m, err := unmarshalMap(raw)
		if err != nil {
			continue
		}
		st, _ := m["status"].(string)
		if st != "ENABLED" && st != "OBSERVE" {
			continue
		}
		ruleType, _ := m["ruleType"].(string)
		cond, _ := m["condition"].(map[string]interface{})
		hit := false
		switch ruleType {
		case "AMOUNT":
			threshold, _ := cond["threshold"].(float64)
			hit = threshold > 0 && amount > threshold
		case "REGION":
			countries, _ := cond["countries"].([]interface{})
			for _, c := range countries {
				if cc, _ := c.(string); strings.EqualFold(cc, customerCountry) {
					hit = true
					break
				}
			}
		case "FREQUENCY":
			// TODO: 真实窗口计数需 Redis，MVP 暂不命中。
			// windowMinutes, _ := cond["windowMinutes"].(float64)
			// maxCount, _ := cond["maxCount"].(float64)
			_ = cond
		case "BEHAVIOR":
			// TODO: 行为序列评估 MVP 暂跳过。
		}
		if !hit {
			continue
		}
		w, _ := m["scoreWeight"].(float64)
		ruleID, _ := m["id"].(string)
		ruleName, _ := m["name"].(string)
		entry := riskMatchedRule{
			RuleID:      ruleID,
			RuleName:    ruleName,
			RuleType:    ruleType,
			ScoreWeight: int(w),
		}
		if st == "ENABLED" {
			score += int(w)
		} else {
			entry.Observed = true
		}
		matchedRules = append(matchedRules, entry)
	}

	// e. 决策阈值。
	decision := "PASS"
	if score >= 80 {
		decision = "BLOCK"
	} else if score >= 40 {
		decision = "REVIEW"
	}

	// f. 落库 RiskDecision。
	now := time.Now().UTC().Unix()
	decisionID := newID()
	decisionPayload := map[string]interface{}{
		"id":            decisionID,
		"tenantId":      tenantID,
		"transactionId": transactionID,
		"riskScore":     score,
		"decision":      decision,
		"matchedRules":  matchedRules,
		"blacklistHits": blacklistHits,
		"request":       payload,
		"evaluatedAt":   timex.FormatDateTime(now),
	}
	dataJSON, _ := json.Marshal(decisionPayload)
	rd := persistence.RiskDecision{
		ID: decisionID, TenantID: tenantID, TransactionID: transactionID,
		RiskScore: score, Decision: decision, DataJSON: string(dataJSON),
	}
	if err := s.db.WithContext(ctx).Create(&rd).Error; err != nil {
		return nil, err
	}

	// g. REVIEW 自动创建 PENDING 复核记录。
	if decision == "REVIEW" {
		reviewID := newID()
		reviewPayload := map[string]interface{}{
			"id":            reviewID,
			"decisionId":    decisionID,
			"transactionId": transactionID,
			"tenantId":      tenantID,
			"status":        "PENDING",
			"source":        "RISK_ENGINE",
		}
		rdata, _ := json.Marshal(reviewPayload)
		rv := persistence.RiskReview{
			ID: reviewID, DecisionID: decisionID, TransactionID: transactionID,
			TenantID: tenantID, Status: "PENDING", DataJSON: string(rdata),
		}
		_ = s.db.WithContext(ctx).Create(&rv).Error
	}

	return map[string]interface{}{
		"riskScore":     score,
		"decision":      decision,
		"matchedRules":   matchedRules,
		"blacklistHits": blacklistHits,
		"decisionId":    decisionID,
	}, nil
}

// ListRiskDecisions 决策记录列表（按时间倒序）。
func (s *Service) ListRiskDecisions(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.RiskDecision{})
	q = tenant.Apply(q, tenantID)
	var rows []persistence.RiskDecision
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

// ListRiskReviews 复核队列列表，可按 status 过滤。
func (s *Service) ListRiskReviews(ctx context.Context, status string) ([]map[string]interface{}, error) {
	q := s.db.WithContext(ctx).Model(&persistence.RiskReview{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var rows []persistence.RiskReview
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

// ApproveRiskReview 通过复核：PENDING -> APPROVED。
func (s *Service) ApproveRiskReview(ctx context.Context, id, reviewer string) (map[string]interface{}, error) {
	var row persistence.RiskReview
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if row.Status != "PENDING" {
		return nil, apperr.Conflict
	}
	now := time.Now().UTC().Unix()
	row.Status = "APPROVED"
	row.Reviewer = strings.TrimSpace(reviewer)
	row.ReviewedAt = &now
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		m = map[string]interface{}{}
	}
	m["status"] = "APPROVED"
	m["reviewer"] = row.Reviewer
	m["reviewedAt"] = timex.FormatDateTime(now)
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

// RejectRiskReview 拒绝复核：PENDING -> REJECTED。
func (s *Service) RejectRiskReview(ctx context.Context, id, reason, reviewer string) (map[string]interface{}, error) {
	var row persistence.RiskReview
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if row.Status != "PENDING" {
		return nil, apperr.Conflict
	}
	now := time.Now().UTC().Unix()
	row.Status = "REJECTED"
	row.Reviewer = strings.TrimSpace(reviewer)
	row.ReviewNote = strings.TrimSpace(reason)
	row.ReviewedAt = &now
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		m = map[string]interface{}{}
	}
	m["status"] = "REJECTED"
	m["reviewer"] = row.Reviewer
	m["reviewNote"] = row.ReviewNote
	m["reviewedAt"] = timex.FormatDateTime(now)
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListMerchantApplications(ctx context.Context, status string) ([]map[string]interface{}, error) {
	all, err := s.listDomain(ctx, &persistence.MerchantApplication{})
	if err != nil {
		return nil, err
	}
	if status == "" {
		return all, nil
	}
	out := make([]map[string]interface{}, 0, len(all))
	for _, m := range all {
		st, _ := m["status"].(string)
		if st == status {
			out = append(out, m)
		}
	}
	return out, nil
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
	now := timex.FormatDateTime(time.Now().UTC().Unix())
	switch status {
	case "APPROVED":
		m["approvedAt"] = now
		m["approvedBy"] = ""
	case "REJECTED":
		m["rejectedAt"] = now
		m["rejectedBy"] = ""
		if reason != "" {
			m["rejectReason"] = reason
		}
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

func (s *Service) ListAlertHistory(ctx context.Context, status, severity string) ([]map[string]interface{}, error) {
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
		if status != "" {
			st, _ := m["status"].(string)
			if st != status {
				continue
			}
		}
		if severity != "" {
			sev, _ := m["severity"].(string)
			if sev != severity {
				continue
			}
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
	txs, err := s.listDoneTransactions(ctx, tenantID)
	if err != nil {
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

// --- M3 Module 2: Real-time Alerts ---

// queryTxMetricsInWindow 跨分表查询时间窗口内的交易指标（总数、done数、金额）。
func (s *Service) queryTxMetricsInWindow(ctx context.Context, tenantID string, sinceSec int64) (total, doneCount int64, totalAmountCents int64, err error) {
	now := time.Now().UTC().Unix()
	months := sharding.MonthsSpanningUnix(sinceSec, now)
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var txs []persistence.PaymentTransaction
		q := s.shards.DB().WithContext(ctx).Table(tbl).
			Where("deleted_at IS NULL AND created_at >= ?", sinceSec)
		if tenantID != "" && tenantID != "ALL" {
			q = q.Where("tenant_id = ?", tenantID)
		}
		if e := q.Find(&txs).Error; e != nil {
			return 0, 0, 0, e
		}
		for _, tx := range txs {
			total++
			totalAmountCents += tx.OrderAmountCents
			if tx.Status == "done" {
				doneCount++
			}
		}
	}
	return total, doneCount, totalAmountCents, nil
}

// TriggerAlertRule 手动触发告警规则检查，基于最近24小时交易指标。
func (s *Service) TriggerAlertRule(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.AlertRule
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	rule, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}

	metricType, _ := rule["metricType"].(string)
	threshold, _ := rule["threshold"].(float64)
	comparisonOperator, _ := rule["comparisonOperator"].(string)
	tenantID, _ := rule["tenantId"].(string)

	since := time.Now().UTC().Add(-24 * time.Hour).Unix()
	total, doneCount, _, err := s.queryTxMetricsInWindow(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	var currentValue float64
	switch metricType {
	case "TRANSACTION_COUNT":
		currentValue = float64(total)
	case "SUCCESS_RATE":
		if total > 0 {
			currentValue = float64(doneCount) / float64(total) * 100
		}
	case "FAILURE_RATE":
		if total > 0 {
			currentValue = float64(total-doneCount) / float64(total) * 100
		}
	case "REFUND_RATE":
		currentValue = 0 // TODO: 需关联退款表
	default:
		currentValue = 0
	}

	triggered := false
	switch comparisonOperator {
	case "GT":
		triggered = currentValue > threshold
	case "LT":
		triggered = currentValue < threshold
	case "GTE":
		triggered = currentValue >= threshold
	case "LTE":
		triggered = currentValue <= threshold
	}

	name, _ := rule["name"].(string)
	severity, _ := rule["severity"].(string)
	message := fmt.Sprintf("告警规则[%s]触发: 当前值 %.2f %s %.2f", name, currentValue, comparisonOperator, threshold)

	result := map[string]interface{}{
		"triggered":    triggered,
		"currentValue": currentValue,
		"threshold":    threshold,
		"message":      message,
	}

	if triggered {
		now := time.Now().UTC().Unix()
		historyPayload := map[string]interface{}{
			"id":          "alert_" + strings.ToLower(uuid.NewString()[:8]),
			"ruleId":      id,
			"title":       name,
			"severity":    severity,
			"status":      "UNHANDLED",
			"metricValue": currentValue,
			"threshold":   threshold,
			"message":     message,
			"triggeredAt": timex.FormatDateTime(now),
		}
		_, _ = s.SaveAlertHistory(ctx, historyPayload)
	}

	return result, nil
}

// AckAlertHistory 确认告警：UNHANDLED → PROCESSING。
func (s *Service) AckAlertHistory(ctx context.Context, id, ackBy string) (map[string]interface{}, error) {
	var row persistence.AlertHistory
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	m["status"] = "PROCESSING"
	m["ackBy"] = ackBy
	m["ackAt"] = timex.FormatDateTime(time.Now().UTC().Unix())
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

// ResolveAlertHistory 解决告警：→ RESOLVED，记录解决备注和操作人。
func (s *Service) ResolveAlertHistory(ctx context.Context, id, resolutionNote, resolvedBy string) (map[string]interface{}, error) {
	var row persistence.AlertHistory
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	m["status"] = "RESOLVED"
	m["resolvedBy"] = resolvedBy
	m["resolvedAt"] = timex.FormatDateTime(time.Now().UTC().Unix())
	m["resolutionNote"] = resolutionNote
	data, _ := json.Marshal(m)
	row.DataJSON = string(data)
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return nil, err
	}
	return m, nil
}

// --- Alert Channels ---

func (s *Service) ListAlertChannels(ctx context.Context) ([]map[string]interface{}, error) {
	var rows []persistence.AlertChannel
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m, err := unmarshalMap(r.DataJSON)
		if err != nil {
			m = map[string]interface{}{}
		}
		m["id"] = r.ID
		m["name"] = r.Name
		m["channelType"] = r.ChannelType
		m["enabled"] = r.Enabled
		out = append(out, m)
	}
	return out, nil
}

func (s *Service) SaveAlertChannel(ctx context.Context, p map[string]interface{}) (map[string]interface{}, error) {
	id, _ := p["id"].(string)
	if id == "" {
		id = newID()
		p["id"] = id
	}
	name, _ := p["name"].(string)
	channelType, _ := p["channelType"].(string)
	enabled := true
	if e, ok := p["enabled"].(bool); ok {
		enabled = e
	}
	// 列化字段之外的配置存入 data_json
	config := map[string]interface{}{}
	for k, v := range p {
		switch k {
		case "id", "name", "channelType", "enabled":
			continue
		default:
			config[k] = v
		}
	}
	data, _ := json.Marshal(config)
	var existing persistence.AlertChannel
	err := s.db.WithContext(ctx).First(&existing, "id = ?", id).Error
	if err == nil {
		existing.Name = name
		existing.ChannelType = channelType
		existing.Enabled = enabled
		existing.DataJSON = string(data)
		if e := s.db.WithContext(ctx).Save(&existing).Error; e != nil {
			return nil, e
		}
	} else {
		row := persistence.AlertChannel{
			ID: id, Name: name, ChannelType: channelType, Enabled: enabled, DataJSON: string(data),
		}
		if e := s.db.WithContext(ctx).Create(&row).Error; e != nil {
			return nil, e
		}
	}
	return p, nil
}

func (s *Service) DeleteAlertChannel(ctx context.Context, id string) error {
	return deleteByID(ctx, s.db, &persistence.AlertChannel{}, id)
}

// --- M3 Module 3: Merchant Management ---

// GetMerchantApplication 商户详情，返回完整 data_json。
func (s *Service) GetMerchantApplication(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.MerchantApplication
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	return m, nil
}

// GetMerchantStats 商户数据看板：最近30天交易汇总 + 按天趋势。
func (s *Service) GetMerchantStats(ctx context.Context, id string) (map[string]interface{}, error) {
	var row persistence.MerchantApplication
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	m, err := unmarshalMap(row.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	// TODO: 精确商户-交易关联；MVP 从 data_json 取 tenantId，否则统计全部
	tenantID, _ := m["tenantId"].(string)

	txs, err := s.listDoneTransactions(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	since := time.Now().AddDate(0, 0, -30).Unix()
	var totalAmountCents int64
	txCount := 0
	type dayBucket struct {
		volume int64
		count  int
	}
	trendMap := map[string]*dayBucket{}

	for _, tx := range txs {
		if tx.CreatedAt < since {
			continue
		}
		totalAmountCents += tx.OrderAmountCents
		txCount++
		day := timex.FormatDate(tx.CreatedAt)
		bucket, ok := trendMap[day]
		if !ok {
			bucket = &dayBucket{}
			trendMap[day] = bucket
		}
		bucket.volume += tx.OrderAmountCents
		bucket.count++
	}

	trend := make([]map[string]interface{}, 0, 30)
	for i := 29; i >= 0; i-- {
		day := timex.FormatDate(time.Now().AddDate(0, 0, -i).Unix())
		volume := float64(0)
		count := 0
		if bucket, ok := trendMap[day]; ok {
			volume = float64(bucket.volume) / 100
			count = bucket.count
		}
		trend = append(trend, map[string]interface{}{
			"date":   day,
			"volume": volume,
			"count":  count,
		})
	}

	var totalVolume, successRate, avgAmount float64
	if txCount > 0 {
		totalVolume = float64(totalAmountCents) / 100
		avgAmount = totalVolume / float64(txCount)
		// TODO: listDoneTransactions 仅返回 done 交易，successRate 需查询全量交易计算 done/total
		successRate = 1.0
	}

	return map[string]interface{}{
		"totalVolume":          totalVolume,
		"transactionCount":     txCount,
		"successRate":          successRate,
		"refundRate":           0, // TODO: 需关联退款表
		"avgTransactionAmount": avgAmount,
		"trend":                trend,
	}, nil
}

