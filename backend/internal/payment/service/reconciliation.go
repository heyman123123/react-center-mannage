package service

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/tenant"
	"gorm.io/gorm"
)

type ReconciliationSummaryDTO struct {
	OrderTotalAmount   float64 `json:"orderTotalAmount"`
	GatewayTotalAmount float64 `json:"gatewayTotalAmount"`
	BankTotalAmount    float64 `json:"bankTotalAmount"`
	OrderCount         int64   `json:"orderCount"`
	MatchedRate        float64 `json:"matchedRate"`
	DiscrepancyCount   int64   `json:"discrepancyCount"`
	PendingCount       int64   `json:"pendingCount"`
}

type ReconciliationBatchDTO struct {
	BatchNo           string  `json:"batchNo"`
	Date              string  `json:"date"`
	TenantID          string  `json:"tenantId"`
	TotalCount        int     `json:"totalCount"`
	MatchedCount      int     `json:"matchedCount"`
	DiscrepancyCount  int     `json:"discrepancyCount"`
	PendingCount      int     `json:"pendingCount"`
	TotalAmount       float64 `json:"totalAmount"`
	MatchedAmount     float64 `json:"matchedAmount"`
	DiscrepancyAmount float64 `json:"discrepancyAmount"`
	Channel           string  `json:"channel"`
	Status            string  `json:"status"`
}

type ResolveDiscrepancyInput struct {
	ResolutionType string `json:"resolutionType"`
	Note           string `json:"note"`
}

func (s *Service) tenantTxFilter(tenantID string) sharding.FilterFunc {
	return func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL")
		q = tenant.Apply(q, tenantID)
		return q
	}
}

func (s *Service) GetReconciliationSummary(ctx context.Context, tenantID string) (*ReconciliationSummaryDTO, error) {
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	filter := s.tenantTxFilter(tenantID)
	var total, done, discrepancy, pending int64
	var orderAmountSum, netAmountSum int64
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		base := s.shards.DB().WithContext(ctx).Table(tbl)
		base = filter(base)
		var n int64
		_ = base.Count(&n).Error
		total += n
		var d int64
		_ = filter(s.shards.DB().WithContext(ctx).Table(tbl).Where("status = ?", "done")).Count(&d).Error
		done += d
		var disc int64
		_ = filter(s.shards.DB().WithContext(ctx).Table(tbl).Where("status = ?", "discrepancy")).Count(&disc).Error
		discrepancy += disc
		var pend int64
		_ = filter(s.shards.DB().WithContext(ctx).Table(tbl).Where("status IN ?", []string{"in_process", "pending_check"})).Count(&pend).Error
		pending += pend
		var orderPart, netPart int64
		_ = filter(s.shards.DB().WithContext(ctx).Table(tbl)).Select("COALESCE(SUM(order_amount_cents),0)").Scan(&orderPart).Error
		_ = filter(s.shards.DB().WithContext(ctx).Table(tbl)).Select("COALESCE(SUM(net_amount_cents),0)").Scan(&netPart).Error
		orderAmountSum += orderPart
		netAmountSum += netPart
	}
	rate := 0.0
	if total > 0 {
		rate = float64(done) / float64(total) * 100
	}
	orderAmount := float64(orderAmountSum) / 100
	netAmount := float64(netAmountSum) / 100
	return &ReconciliationSummaryDTO{
		OrderTotalAmount:   orderAmount,
		GatewayTotalAmount: orderAmount,
		BankTotalAmount:    netAmount,
		OrderCount:         total,
		MatchedRate:        rate,
		DiscrepancyCount:   discrepancy,
		PendingCount:       pending,
	}, nil
}

func (s *Service) ListReconciliationBatches(ctx context.Context, tenantID string) ([]ReconciliationBatchDTO, error) {
	type aggRow struct {
		Date         string
		Channel      string
		TenantID     string
		TotalCount   int
		DoneCount    int
		DiscCount    int
		PendingCount int
		TotalCents   int64
		DoneCents    int64
		DiscCents    int64
	}
	merged := map[string]aggRow{}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		q := s.shards.DB().WithContext(ctx).Table(tbl)
		q = s.tenantTxFilter(tenantID)(q)
		var rows []aggRow
		err := q.Select(`
		to_char(to_timestamp(created_at), 'YYYY-MM-DD') as date,
		channel,
		tenant_id,
		COUNT(*)::int as total_count,
		SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::int as done_count,
		SUM(CASE WHEN status = 'discrepancy' THEN 1 ELSE 0 END)::int as disc_count,
		SUM(CASE WHEN status IN ('in_process','pending_check') THEN 1 ELSE 0 END)::int as pending_count,
		COALESCE(SUM(order_amount_cents),0) as total_cents,
		COALESCE(SUM(CASE WHEN status = 'done' THEN order_amount_cents ELSE 0 END),0) as done_cents,
		COALESCE(SUM(CASE WHEN status = 'discrepancy' THEN order_amount_cents ELSE 0 END),0) as disc_cents
	`).Group("date, channel, tenant_id").Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for _, r := range rows {
			key := r.Date + "|" + r.Channel + "|" + r.TenantID
			cur := merged[key]
			if cur.Date == "" {
				cur = r
			} else {
				cur.TotalCount += r.TotalCount
				cur.DoneCount += r.DoneCount
				cur.DiscCount += r.DiscCount
				cur.PendingCount += r.PendingCount
				cur.TotalCents += r.TotalCents
				cur.DoneCents += r.DoneCents
				cur.DiscCents += r.DiscCents
			}
			merged[key] = cur
		}
	}
	out := make([]ReconciliationBatchDTO, 0, len(merged))
	for _, r := range merged {
		status := "COMPLETED"
		if r.DiscCount > 0 {
			status = "DISCREPANCY_FOUND"
		} else if r.PendingCount > 0 {
			status = "RUNNING"
		}
		out = append(out, ReconciliationBatchDTO{
			BatchNo:           fmt.Sprintf("BATCH-%s-%s-%s", strings.ReplaceAll(r.Date, "-", ""), strings.ToUpper(r.Channel), r.TenantID),
			Date:              r.Date,
			TenantID:          r.TenantID,
			TotalCount:        r.TotalCount,
			MatchedCount:      r.DoneCount,
			DiscrepancyCount:  r.DiscCount,
			PendingCount:      r.PendingCount,
			TotalAmount:       float64(r.TotalCents) / 100,
			MatchedAmount:     float64(r.DoneCents) / 100,
			DiscrepancyAmount: float64(r.DiscCents) / 100,
			Channel:           r.Channel,
			Status:            status,
		})
	}
	return out, nil
}

func (s *Service) RunReconciliation(ctx context.Context, tenantID string) (int64, error) {
	filter := func(q *gorm.DB) *gorm.DB {
		q = s.tenantTxFilter(tenantID)(q).Where("status IN ?", []string{"in_process", "pending_check"})
		return q
	}
	months := sharding.RecentMonthsNewestFirst(6)
	var updated int64
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var rows []struct {
			ID               string
			OrderAmountCents int64
			ChannelTradeNo   string
		}
		if err := filter(s.shards.DB().WithContext(ctx).Table(tbl)).Find(&rows).Error; err != nil {
			return updated, err
		}
		for _, row := range rows {
			status := "discrepancy"
			if row.OrderAmountCents > 0 && strings.TrimSpace(row.ChannelTradeNo) != "" {
				status = "done"
			}
			if err := s.shards.UpdatePaymentTransaction(ctx, tbl, row.ID, map[string]interface{}{"status": status}); err != nil {
				return updated, err
			}
			updated++
		}
	}
	return updated, nil
}

func (s *Service) ResolveDiscrepancy(ctx context.Context, txID string, in ResolveDiscrepancyInput) (*TransactionDTO, error) {
	row, tbl, err := s.shards.GetPaymentTransaction(ctx, txID)
	if err != nil {
		return nil, apperr.NotFound
	}
	if row.Status != "discrepancy" {
		return nil, apperr.New(42220, 422, "仅差错流水可核销")
	}
	_ = strings.TrimSpace(in.Note)
	updates := map[string]interface{}{"status": "done"}
	if err := s.shards.UpdatePaymentTransaction(ctx, tbl, row.ID, updates); err != nil {
		return nil, err
	}
	row.Status = "done"
	names := s.loadChannelNames(ctx, []persistence.PaymentTransaction{*row})
	dto := toTransactionDTO(*row, names[row.ChannelID], true)
	return &dto, nil
}

// --- 真实对账：渠道对账单导入 ---

type DiscrepancyItem struct {
	Type    string `json:"type"`    // long(渠道有系统无) / short(系统有渠道无) / amount_mismatch(金额不符) / missing_trade_no(系统交易无渠道号)
	TradeNo string `json:"tradeNo"`
	Message string `json:"message"`
}

type ImportResult struct {
	ImportedCount    int               `json:"importedCount"`
	MatchedCount     int               `json:"matchedCount"`
	DiscrepancyCount int               `json:"discrepancyCount"`
	Discrepancies   []DiscrepancyItem `json:"discrepancies"`
}

type DiscrepancyRecord struct {
	ID                string  `json:"id"`
	DisplayID         string  `json:"displayId"`
	ChannelTradeNo    string  `json:"channelTradeNo"`
	OrderAmount       float64 `json:"orderAmount"`
	Currency          string  `json:"currency"`
	Status            string  `json:"status"`
	DiscrepancyType   string  `json:"discrepancyType"`
	DiscrepancyNote   string  `json:"discrepancyNote"`
	TenantID          string  `json:"tenantId"`
	Channel           string  `json:"channel"`
	CreatedAt         string  `json:"createdAt"`
}

type HandleDiscrepancyInput struct {
	Action string `json:"action"` // accept / investigate / escalate
	Note   string `json:"note"`
}

// csvRecord 表示对账单一行。
type csvRecord struct {
	tradeNo string
	amount  int64
	currency string
	fee     int64
	status  string
}

// ImportChannelStatement 解析并比对渠道对账单 CSV。
func (s *Service) ImportChannelStatement(ctx context.Context, channelID, statementDate, fileName string, csvContent []byte) (*ImportResult, error) {
	if strings.TrimSpace(channelID) == "" {
		return nil, apperr.InvalidArgument
	}
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return nil, err
	}
	records, err := parseStatementCSV(csvContent)
	if err != nil {
		return nil, apperr.Wrap(42230, 422, "对账单 CSV 解析失败", err)
	}

	// 收集系统中该渠道近期交易，按 channel_trade_no 索引。
	systemByTrade := map[string]*persistence.PaymentTransaction{}
	systemTblByID := map[string]string{}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var rows []persistence.PaymentTransaction
		q := s.shards.DB().WithContext(ctx).Table(tbl).Where("channel_id = ? AND deleted_at IS NULL", channelID)
		if err := q.Find(&rows).Error; err != nil {
			return nil, err
		}
		for i := range rows {
			r := rows[i]
			if r.ChannelTradeNo != "" {
				cp := r
				systemByTrade[r.ChannelTradeNo] = &cp
				systemTblByID[r.ID] = tbl
			}
		}
	}

	result := &ImportResult{Discrepancies: []DiscrepancyItem{}}
	matchedTrades := map[string]bool{}
	var totalAmount int64

	for _, rec := range records {
		totalAmount += rec.amount
		if rec.tradeNo == "" {
			continue
		}
		sys, ok := systemByTrade[rec.tradeNo]
		if !ok {
			result.Discrepancies = append(result.Discrepancies, DiscrepancyItem{
				Type: "long", TradeNo: rec.tradeNo, Message: "渠道有流水但系统无记录",
			})
			continue
		}
		matchedTrades[rec.tradeNo] = true
		// 金额比对（允许 1 分钱误差）。
		if sys.OrderAmountCents != 0 && absDiff(sys.OrderAmountCents, rec.amount) > 1 {
			result.Discrepancies = append(result.Discrepancies, DiscrepancyItem{
				Type:    "amount_mismatch",
				TradeNo: rec.tradeNo,
				Message: fmt.Sprintf("金额不符: 系统=%d 渠道=%d", sys.OrderAmountCents, rec.amount),
			})
			s.markDiscrepancy(ctx, sys, systemTblByID[sys.ID], "amount_mismatch",
				fmt.Sprintf("渠道金额 %d 与系统 %d 不一致", rec.amount, sys.OrderAmountCents))
			continue
		}
		// 匹配且金额一致 → 标记 done。
		result.MatchedCount++
		s.markMatched(ctx, sys, systemTblByID[sys.ID], rec)
	}

	// 短款：系统有 channel_trade_no 但对账单未覆盖。
	for tradeNo, sys := range systemByTrade {
		if matchedTrades[tradeNo] {
			continue
		}
		// 仅对 done/discrepancy 的系统流水报短款，避免对未达账误报。
		if sys.Status == "done" || sys.Status == "discrepancy" {
			result.Discrepancies = append(result.Discrepancies, DiscrepancyItem{
				Type: "short", TradeNo: tradeNo, Message: "系统有流水但渠道对账单缺失",
			})
		}
	}
	// 渠道号缺失：系统交易无 channel_trade_no。
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var missing []persistence.PaymentTransaction
		_ = s.shards.DB().WithContext(ctx).Table(tbl).
			Where("channel_id = ? AND deleted_at IS NULL AND (channel_trade_no = '' OR channel_trade_no IS NULL)", channelID).
			Find(&missing).Error
		for i := range missing {
			result.Discrepancies = append(result.Discrepancies, DiscrepancyItem{
				Type: "missing_trade_no", TradeNo: missing[i].DisplayID, Message: "系统流水缺少渠道交易号",
			})
		}
		break // 只扫最近一张表即可定位缺失（避免重复）
	}

	result.ImportedCount = len(records)
	result.DiscrepancyCount = len(result.Discrepancies)

	// 落库对账单记录。
	rawJSON, _ := json.Marshal(records)
	stmt := persistence.ReconciliationStatement{
		ID:               uuid.NewString(),
		ChannelID:        channelID,
		Channel:          ch.ChannelKey,
		TenantID:         ch.TenantID,
		StatementDate:    statementDate,
		FileName:         fileName,
		TotalCount:       result.ImportedCount,
		TotalAmountCents: totalAmount,
		MatchedCount:     result.MatchedCount,
		DiscrepancyCount: result.DiscrepancyCount,
		Status:           "IMPORTED",
		RawCSVJSON:       string(rawJSON),
	}
	_ = s.db.WithContext(ctx).Create(&stmt).Error

	return result, nil
}

func (s *Service) markMatched(ctx context.Context, tx *persistence.PaymentTransaction, tbl string, rec csvRecord) {
	if tbl == "" {
		return
	}
	updates := map[string]interface{}{"status": "done"}
	if rec.fee > 0 {
		updates["channel_fee_cents"] = rec.fee
		updates["net_amount_cents"] = rec.amount - rec.fee
	}
	_ = s.shards.UpdatePaymentTransaction(ctx, tbl, tx.ID, updates)
}

func (s *Service) markDiscrepancy(ctx context.Context, tx *persistence.PaymentTransaction, tbl, dType, note string) {
	if tbl == "" {
		return
	}
	payload := map[string]interface{}{
		"_discrepancy_type": dType,
		"_discrepancy_note": note,
	}
	if tx.RawPayloadJSON != "" && tx.RawPayloadJSON != "{}" {
		existing := map[string]interface{}{}
		_ = json.Unmarshal([]byte(tx.RawPayloadJSON), &existing)
		for k, v := range payload {
			existing[k] = v
		}
		payload = existing
	}
	rawJSON, _ := json.Marshal(payload)
	_ = s.shards.UpdatePaymentTransaction(ctx, tbl, tx.ID, map[string]interface{}{
		"status":         "discrepancy",
		"raw_payload_json": string(rawJSON),
	})
}

// ListDiscrepancies 扫描最近月份分表，返回 status=discrepancy 的交易。
func (s *Service) ListDiscrepancies(ctx context.Context, tenantID, discrepancyType string) ([]DiscrepancyRecord, error) {
	out := []DiscrepancyRecord{}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var rows []persistence.PaymentTransaction
		q := s.shards.DB().WithContext(ctx).Table(tbl).
			Where("status = ? AND deleted_at IS NULL", "discrepancy")
		q = tenant.Apply(q, tenantID)
		if err := q.Order("created_at DESC").Limit(200).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, r := range rows {
			dType, dNote := parseDiscrepancyMeta(r.RawPayloadJSON)
			if discrepancyType != "" && discrepancyType != "all" && dType != discrepancyType {
				continue
			}
			out = append(out, DiscrepancyRecord{
				ID:              r.ID,
				DisplayID:       r.DisplayID,
				ChannelTradeNo:  r.ChannelTradeNo,
				OrderAmount:     float64(r.OrderAmountCents) / 100,
				Currency:        r.Currency,
				Status:          r.Status,
				DiscrepancyType: dType,
				DiscrepancyNote: dNote,
				TenantID:        r.TenantID,
				Channel:         r.Channel,
				CreatedAt:       time.Unix(r.CreatedAt, 0).UTC().Format("2006-01-02 15:04"),
			})
		}
	}
	return out, nil
}

func parseDiscrepancyMeta(raw string) (dType, dNote string) {
	if raw == "" {
		return "", ""
	}
	m := map[string]interface{}{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return "", ""
	}
	dType, _ = m["_discrepancy_type"].(string)
	dNote, _ = m["_discrepancy_note"].(string)
	if dType == "" {
		dType = "unclassified"
	}
	return dType, dNote
}

// HandleDiscrepancy 处理单笔差错：accept=接受并标记 done，investigate=标记 investigating，escalate=升级。
func (s *Service) HandleDiscrepancy(ctx context.Context, txID, action, note string) error {
	row, tbl, err := s.shards.GetPaymentTransaction(ctx, txID)
	if err != nil {
		return apperr.NotFound
	}
	action = strings.ToLower(strings.TrimSpace(action))
	status := row.Status
	switch action {
	case "accept":
		status = "done"
	case "investigate":
		status = "investigating"
	case "escalate":
		status = "escalated"
	default:
		return apperr.InvalidArgument
	}
	updates := map[string]interface{}{"status": status}
	if strings.TrimSpace(note) != "" {
		payload := map[string]interface{}{}
		if row.RawPayloadJSON != "" && row.RawPayloadJSON != "{}" {
			_ = json.Unmarshal([]byte(row.RawPayloadJSON), &payload)
		}
		payload["_discrepancy_note"] = note
		if action == "accept" {
			payload["_resolved_by"] = note
		}
		rawJSON, _ := json.Marshal(payload)
		updates["raw_payload_json"] = string(rawJSON)
	}
	return s.shards.UpdatePaymentTransaction(ctx, tbl, row.ID, updates)
}

func parseStatementCSV(content []byte) ([]csvRecord, error) {
	reader := csv.NewReader(strings.NewReader(string(content)))
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return nil, nil
	}
	header := rows[0]
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	idxTrade := pickCol(col, "trade_no", "channel_trade_no", "channeltradeno", "tradeid", "id")
	idxAmount := pickCol(col, "amount", "amount_cents", "order_amount", "orderamount", "total")
	idxFee := pickCol(col, "fee", "fee_cents", "channel_fee", "service_fee")
	idxCurrency := pickCol(col, "currency", "ccy")
	idxStatus := pickCol(col, "status", "state")

	out := make([]csvRecord, 0, len(rows)-1)
	for _, r := range rows[1:] {
		if len(r) == 0 {
			continue
		}
		rec := csvRecord{}
		if idxTrade >= 0 && idxTrade < len(r) {
			rec.tradeNo = strings.TrimSpace(r[idxTrade])
		}
		if idxAmount >= 0 && idxAmount < len(r) {
			rec.amount = parseAmountCents(r[idxAmount])
		}
		if idxFee >= 0 && idxFee < len(r) {
			rec.fee = parseAmountCents(r[idxFee])
		}
		if idxCurrency >= 0 && idxCurrency < len(r) {
			rec.currency = strings.ToUpper(strings.TrimSpace(r[idxCurrency]))
		}
		if idxStatus >= 0 && idxStatus < len(r) {
			rec.status = strings.TrimSpace(r[idxStatus])
		}
		out = append(out, rec)
	}
	return out, nil
}

func pickCol(col map[string]int, names ...string) int {
	for _, n := range names {
		if i, ok := col[n]; ok {
			return i
		}
	}
	return -1
}

// parseAmountCents 兼容 "12.34"（元）与 "1234"（分）两种写法。
func parseAmountCents(s string) int64 {
	s = strings.TrimSpace(strings.TrimPrefix(s, "$"))
	if s == "" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	// 含小数点视为元。
	if strings.Contains(s, ".") {
		return int64(f * 100)
	}
	return int64(f)
}

func absDiff(a, b int64) int64 {
	if a > b {
		return a - b
	}
	return b - a
}
