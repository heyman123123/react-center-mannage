package service

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"
)

type ChannelBreakdownItem struct {
	Channel string  `json:"channel"`
	Revenue float64 `json:"revenue"`
	Count   int64   `json:"count"`
}

type KPIDTO struct {
	TotalRevenue         float64                `json:"totalRevenue"`
	OrderCount           int64                  `json:"orderCount"`
	RefundRate           float64                `json:"refundRate"`
	ChannelBreakdown     []ChannelBreakdownItem `json:"channelBreakdown"`
	RevenueChangePercent float64                `json:"revenueChangePercent"`
}

func (s *Service) GetDashboardKPI(ctx context.Context, tenantID string) (*KPIDTO, error) {
	now := time.Now().UTC()
	currentStart := now.AddDate(0, 0, -30).Unix()
	priorStart := now.AddDate(0, 0, -60).Unix()

	tenantFilter := strings.TrimSpace(tenantID)
	if tenantFilter == "" || tenantFilter == "ALL" || tenantFilter == "group_hq" {
		tenantFilter = ""
	}

	var currentRevenue int64
	var currentOrders int64
	var priorRevenue int64
	var refundCents int64

	currentBase := func() *gorm.DB {
		q := s.db.WithContext(ctx).Table("payment_transactions").
			Where("deleted_at IS NULL").
			Where("status = ?", "done").
			Where("created_at >= ?", currentStart)
		if tenantFilter != "" {
			q = q.Where("tenant_id = ?", tenantFilter)
		}
		return q
	}

	if err := currentBase().Select("COALESCE(SUM(order_amount_cents), 0)").Scan(&currentRevenue).Error; err != nil {
		return nil, err
	}
	if err := currentBase().Count(&currentOrders).Error; err != nil {
		return nil, err
	}

	priorQ := s.db.WithContext(ctx).Table("payment_transactions").
		Where("deleted_at IS NULL").
		Where("status = ?", "done").
		Where("created_at >= ? AND created_at < ?", priorStart, currentStart)
	if tenantFilter != "" {
		priorQ = priorQ.Where("tenant_id = ?", tenantFilter)
	}
	if err := priorQ.Select("COALESCE(SUM(order_amount_cents), 0)").Scan(&priorRevenue).Error; err != nil {
		return nil, err
	}

	refundQ := s.db.WithContext(ctx).Table("payment_refunds").
		Where("deleted_at IS NULL").
		Where("status = ?", "SUCCESS").
		Where("created_at >= ?", currentStart)
	if tenantFilter != "" {
		refundQ = refundQ.Where("tenant_id = ?", tenantFilter)
	}
	if err := refundQ.Select("COALESCE(SUM(refund_amount_cents), 0)").Scan(&refundCents).Error; err != nil {
		return nil, err
	}

	type channelRow struct {
		Channel string
		Revenue int64
		Count   int64
	}
	var channelRows []channelRow
	channelQ := s.db.WithContext(ctx).Table("payment_transactions").
		Select("channel, COALESCE(SUM(order_amount_cents), 0) as revenue, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Where("status = ?", "done").
		Where("created_at >= ?", currentStart)
	if tenantFilter != "" {
		channelQ = channelQ.Where("tenant_id = ?", tenantFilter)
	}
	if err := channelQ.Group("channel").Order("revenue DESC").Scan(&channelRows).Error; err != nil {
		return nil, err
	}

	breakdown := make([]ChannelBreakdownItem, 0, len(channelRows))
	for _, row := range channelRows {
		breakdown = append(breakdown, ChannelBreakdownItem{
			Channel: row.Channel,
			Revenue: float64(row.Revenue) / 100,
			Count:   row.Count,
		})
	}

	var revenueChange float64
	if priorRevenue > 0 {
		revenueChange = (float64(currentRevenue-priorRevenue) / float64(priorRevenue)) * 100
	} else if currentRevenue > 0 {
		revenueChange = 100
	}

	var refundRate float64
	if currentRevenue > 0 {
		refundRate = (float64(refundCents) / float64(currentRevenue)) * 100
	}

	return &KPIDTO{
		TotalRevenue:         float64(currentRevenue) / 100,
		OrderCount:           currentOrders,
		RefundRate:           refundRate,
		ChannelBreakdown:     breakdown,
		RevenueChangePercent: revenueChange,
	}, nil
}
