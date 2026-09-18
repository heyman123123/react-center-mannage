package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
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
		if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
			q = q.Where("tenant_id = ?", tenantID)
		}
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
