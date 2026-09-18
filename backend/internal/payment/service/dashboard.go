package service

import (
	"context"
	"strings"
	"time"

	"github.com/novaspay/admin-api/internal/infra/sharding"
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

	baseFilter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL").Where("status = ?", "done")
		if tenantFilter != "" {
			q = q.Where("tenant_id = ?", tenantFilter)
		}
		return q
	}

	currentRevenue, currentOrders, channelParts, err := s.shards.AggregatePaymentTransactions(ctx, currentStart, baseFilter, true)
	if err != nil {
		return nil, err
	}

	priorFilter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL").Where("status = ?", "done").
			Where("created_at >= ? AND created_at < ?", priorStart, currentStart)
		if tenantFilter != "" {
			q = q.Where("tenant_id = ?", tenantFilter)
		}
		return q
	}
	monthsPrior := sharding.MonthsSpanningUnix(priorStart, currentStart)
	var priorRevenue int64
	for _, ym := range monthsPrior {
		tbl := sharding.Table(sharding.BasePaymentTransactions, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		q := s.shards.DB().WithContext(ctx).Table(tbl)
		q = priorFilter(q)
		var part int64
		if err := q.Select("COALESCE(SUM(order_amount_cents), 0)").Scan(&part).Error; err != nil {
			return nil, err
		}
		priorRevenue += part
	}

	refundFilter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL").Where("status = ?", "SUCCESS").Where("created_at >= ?", currentStart)
		if tenantFilter != "" {
			q = q.Where("tenant_id = ?", tenantFilter)
		}
		return q
	}
	refundCents, err := s.shards.SumRefundAmountCents(ctx, currentStart, refundFilter)
	if err != nil {
		return nil, err
	}

	channelMap := map[string]ChannelBreakdownItem{}
	for _, part := range channelParts {
		cur := channelMap[part.Channel]
		cur.Channel = part.Channel
		cur.Revenue += float64(part.Revenue) / 100
		cur.Count += part.Count
		channelMap[part.Channel] = cur
	}
	breakdown := make([]ChannelBreakdownItem, 0, len(channelMap))
	for _, v := range channelMap {
		breakdown = append(breakdown, v)
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
