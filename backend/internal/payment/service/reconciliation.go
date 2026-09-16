package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
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

func (s *Service) GetReconciliationSummary(ctx context.Context, tenantID string) (*ReconciliationSummaryDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentTransaction{})
	if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	var total int64
	var done int64
	var discrepancy int64
	var pending int64
	var amountSum int64
	base := q
	_ = base.Count(&total).Error
	_ = base.Where("status = ?", "done").Count(&done).Error
	_ = base.Where("status = ?", "discrepancy").Count(&discrepancy).Error
	_ = base.Where("status IN ?", []string{"in_process", "pending_check"}).Count(&pending).Error
	_ = base.Select("COALESCE(SUM(order_amount_cents),0)").Scan(&amountSum).Error
	rate := 0.0
	if total > 0 {
		rate = float64(done) / float64(total) * 100
	}
	amount := float64(amountSum) / 100
	return &ReconciliationSummaryDTO{
		OrderTotalAmount:   amount,
		GatewayTotalAmount: amount,
		BankTotalAmount:    amount * 0.997,
		OrderCount:         total,
		MatchedRate:        rate,
		DiscrepancyCount:   discrepancy,
		PendingCount:       pending,
	}, nil
}

func (s *Service) ListReconciliationBatches(ctx context.Context, tenantID string) ([]ReconciliationBatchDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentTransaction{})
	if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
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
	var rows []aggRow
	err := q.Select(`
		to_char(to_timestamp(created_at), 'YYYY-MM-DD') as date,
		channel,
		tenant_id,
		COUNT(*) as total_count,
		SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
		SUM(CASE WHEN status = 'discrepancy' THEN 1 ELSE 0 END) as disc_count,
		SUM(CASE WHEN status IN ('in_process','pending_check') THEN 1 ELSE 0 END) as pending_count,
		COALESCE(SUM(order_amount_cents),0) as total_cents,
		COALESCE(SUM(CASE WHEN status = 'done' THEN order_amount_cents ELSE 0 END),0) as done_cents,
		COALESCE(SUM(CASE WHEN status = 'discrepancy' THEN order_amount_cents ELSE 0 END),0) as disc_cents
	`).Group("date, channel, tenant_id").Order("date DESC, channel ASC").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]ReconciliationBatchDTO, 0, len(rows))
	for _, r := range rows {
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
	q := s.db.WithContext(ctx).Model(&persistence.PaymentTransaction{}).Where("status IN ?", []string{"in_process", "pending_check"})
	if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	res := q.Update("status", "done")
	return res.RowsAffected, res.Error
}

func (s *Service) ResolveDiscrepancy(ctx context.Context, txID string, in ResolveDiscrepancyInput) (*TransactionDTO, error) {
	var row persistence.PaymentTransaction
	if err := s.db.WithContext(ctx).Where("display_id = ? OR id = ?", txID, txID).First(&row).Error; err != nil {
		return nil, apperr.NotFound
	}
	if row.Status != "discrepancy" {
		return nil, apperr.New(42220, 422, "仅差错流水可核销")
	}
	note := strings.TrimSpace(in.Note)
	if note == "" {
		note = strings.TrimSpace(in.ResolutionType)
	}
	updates := map[string]interface{}{
		"status": "done",
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", row.ID)
	names := s.loadChannelNames(ctx, []persistence.PaymentTransaction{row})
	dto := toTransactionDTO(row, names[row.ChannelID], true)
	return &dto, nil
}
