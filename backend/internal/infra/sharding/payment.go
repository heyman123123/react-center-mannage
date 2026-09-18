package sharding

import (
	"context"
	"time"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

func (s *Shards) txTableAt(sec int64) string {
	ym := MonthSuffixFromUnix(sec)
	_ = s.ensureTable(BasePaymentTransactions, ym)
	return Table(BasePaymentTransactions, ym)
}

func (s *Shards) webhookTableAt(sec int64) string {
	ym := MonthSuffixFromUnix(sec)
	_ = s.ensureTable(BasePaymentWebhookLogs, ym)
	return Table(BasePaymentWebhookLogs, ym)
}

func (s *Shards) refundTableAt(sec int64) string {
	ym := MonthSuffixFromUnix(sec)
	_ = s.ensureTable(BasePaymentRefunds, ym)
	return Table(BasePaymentRefunds, ym)
}

func (s *Shards) chargebackTableAt(sec int64) string {
	ym := MonthSuffixFromUnix(sec)
	_ = s.ensureTable(BasePaymentChargebacks, ym)
	return Table(BasePaymentChargebacks, ym)
}

func (s *Shards) CreatePaymentTransaction(ctx context.Context, row *persistence.PaymentTransaction) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	tbl := s.txTableAt(row.CreatedAt)
	return s.db.WithContext(ctx).Table(tbl).Create(row).Error
}

func (s *Shards) FindPaymentTransactionByChannelEvent(ctx context.Context, channelID, externalEventID string) (*persistence.PaymentTransaction, error) {
	months := RecentMonthsNewestFirst(DedupScanMonths)
	var row persistence.PaymentTransaction
	_, err := s.FindFirstAcross(ctx, BasePaymentTransactions, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("channel_id = ? AND external_event_id = ?", channelID, externalEventID)
	}, &row)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Shards) GetPaymentTransaction(ctx context.Context, id string) (*persistence.PaymentTransaction, string, error) {
	hint := MonthHintFromTransactionID(id)
	months := ScanMonthsForLookup(hint)
	var row persistence.PaymentTransaction
	tbl, err := s.FindFirstAcross(ctx, BasePaymentTransactions, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("display_id = ? OR id = ?", id, id)
	}, &row)
	if err != nil {
		return nil, "", err
	}
	return &row, tbl, nil
}

func (s *Shards) ListPaymentTransactions(ctx context.Context, page, pageSize int, filter FilterFunc) ([]persistence.PaymentTransaction, int64, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	return PaginateAcross(ctx, s.db, BasePaymentTransactions, months, page, pageSize, filter,
		func(q *gorm.DB) ([]persistence.PaymentTransaction, error) {
			var rows []persistence.PaymentTransaction
			err := q.Find(&rows).Error
			return rows, err
		})
}

func (s *Shards) UpdatePaymentTransaction(ctx context.Context, tbl string, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Table(tbl).Where("id = ?", id).Updates(updates).Error
}

func (s *Shards) CreatePaymentWebhookLog(ctx context.Context, row *persistence.PaymentWebhookLog) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	tbl := s.webhookTableAt(row.CreatedAt)
	return s.db.WithContext(ctx).Table(tbl).Create(row).Error
}

func (s *Shards) FindPaymentWebhookByEventID(ctx context.Context, eventID string) (*persistence.PaymentWebhookLog, string, error) {
	months := RecentMonthsNewestFirst(DedupScanMonths)
	var row persistence.PaymentWebhookLog
	tbl, err := s.FindFirstAcross(ctx, BasePaymentWebhookLogs, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("event_id = ?", eventID)
	}, &row)
	if err != nil {
		return nil, "", err
	}
	return &row, tbl, nil
}

func (s *Shards) GetPaymentWebhookByID(ctx context.Context, id string) (*persistence.PaymentWebhookLog, string, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var row persistence.PaymentWebhookLog
	tbl, err := s.FindFirstAcross(ctx, BasePaymentWebhookLogs, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("id = ?", id)
	}, &row)
	if err != nil {
		return nil, "", err
	}
	return &row, tbl, nil
}

func (s *Shards) UpdatePaymentWebhook(ctx context.Context, tbl string, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Table(tbl).Where("id = ?", id).Updates(updates).Error
}

func (s *Shards) ListPaymentWebhooks(ctx context.Context, page, pageSize int, filter FilterFunc) ([]persistence.PaymentWebhookLog, int64, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	return PaginateAcross(ctx, s.db, BasePaymentWebhookLogs, months, page, pageSize, filter,
		func(q *gorm.DB) ([]persistence.PaymentWebhookLog, error) {
			var rows []persistence.PaymentWebhookLog
			err := q.Find(&rows).Error
			return rows, err
		})
}

func (s *Shards) CreatePaymentRefund(ctx context.Context, row *persistence.PaymentRefund) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	tbl := s.refundTableAt(row.CreatedAt)
	return s.db.WithContext(ctx).Table(tbl).Create(row).Error
}

func (s *Shards) ListPaymentRefunds(ctx context.Context, filter FilterFunc) ([]persistence.PaymentRefund, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var out []persistence.PaymentRefund
	for _, ym := range months {
		tbl := Table(BasePaymentRefunds, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		q := s.db.WithContext(ctx).Table(tbl).Order("created_at DESC")
		if filter != nil {
			q = filter(q)
		}
		var chunk []persistence.PaymentRefund
		if err := q.Find(&chunk).Error; err != nil {
			return nil, err
		}
		out = append(out, chunk...)
	}
	return out, nil
}

func (s *Shards) SumRefundAmountCents(ctx context.Context, fromSec int64, filter FilterFunc) (int64, error) {
	months := MonthsSpanningUnix(fromSec, time.Now().UTC().Unix())
	var sum int64
	for _, ym := range months {
		tbl := Table(BasePaymentRefunds, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		q := s.db.WithContext(ctx).Table(tbl)
		if filter != nil {
			q = filter(q)
		}
		var part int64
		if err := q.Select("COALESCE(SUM(refund_amount_cents), 0)").Scan(&part).Error; err != nil {
			return 0, err
		}
		sum += part
	}
	return sum, nil
}

func (s *Shards) SumRefundsForTransaction(ctx context.Context, transactionID string, statuses []string) (int64, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var sum int64
	for _, ym := range months {
		tbl := Table(BasePaymentRefunds, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		q := s.db.WithContext(ctx).Table(tbl).
			Where("transaction_id = ? AND status IN ?", transactionID, statuses)
		var part int64
		if err := q.Select("COALESCE(SUM(refund_amount_cents), 0)").Scan(&part).Error; err != nil {
			return 0, err
		}
		sum += part
	}
	return sum, nil
}

func (s *Shards) FindPaymentRefundByExternalEvent(ctx context.Context, externalEventID string) (*persistence.PaymentRefund, error) {
	months := RecentMonthsNewestFirst(DedupScanMonths)
	var row persistence.PaymentRefund
	_, err := s.FindFirstAcross(ctx, BasePaymentRefunds, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("external_event_id = ?", externalEventID)
	}, &row)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Shards) GetPaymentRefund(ctx context.Context, id string) (*persistence.PaymentRefund, string, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var row persistence.PaymentRefund
	tbl, err := s.FindFirstAcross(ctx, BasePaymentRefunds, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("id = ? OR display_id = ?", id, id)
	}, &row)
	if err != nil {
		return nil, "", err
	}
	return &row, tbl, nil
}

func (s *Shards) UpdatePaymentRefund(ctx context.Context, tbl string, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Table(tbl).Where("id = ?", id).Updates(updates).Error
}

func (s *Shards) CreatePaymentChargeback(ctx context.Context, row *persistence.PaymentChargeback) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	tbl := s.chargebackTableAt(row.CreatedAt)
	return s.db.WithContext(ctx).Table(tbl).Create(row).Error
}

func (s *Shards) ListPaymentChargebacks(ctx context.Context, filter FilterFunc) ([]persistence.PaymentChargeback, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var out []persistence.PaymentChargeback
	for _, ym := range months {
		tbl := Table(BasePaymentChargebacks, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		q := s.db.WithContext(ctx).Table(tbl).Order("created_at DESC")
		if filter != nil {
			q = filter(q)
		}
		var chunk []persistence.PaymentChargeback
		if err := q.Find(&chunk).Error; err != nil {
			return nil, err
		}
		out = append(out, chunk...)
	}
	return out, nil
}

func (s *Shards) FindPaymentChargebackByExternalEvent(ctx context.Context, externalEventID string) (*persistence.PaymentChargeback, error) {
	months := RecentMonthsNewestFirst(DedupScanMonths)
	var row persistence.PaymentChargeback
	_, err := s.FindFirstAcross(ctx, BasePaymentChargebacks, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("external_event_id = ?", externalEventID)
	}, &row)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Shards) GetPaymentChargeback(ctx context.Context, id string) (*persistence.PaymentChargeback, string, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var row persistence.PaymentChargeback
	tbl, err := s.FindFirstAcross(ctx, BasePaymentChargebacks, months, func(q *gorm.DB) *gorm.DB {
		return q.Where("id = ? OR display_id = ?", id, id)
	}, &row)
	if err != nil {
		return nil, "", err
	}
	return &row, tbl, nil
}

func (s *Shards) UpdatePaymentChargeback(ctx context.Context, tbl string, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Table(tbl).Where("id = ?", id).Updates(updates).Error
}

// AggregatePaymentTransactions runs SUM/COUNT/GROUP across months for KPI & reconciliation.
func (s *Shards) AggregatePaymentTransactions(ctx context.Context, fromSec int64, filter FilterFunc, groupByChannel bool) (sumCents int64, count int64, channelRows []struct {
	Channel string
	Revenue int64
	Count   int64
}, err error) {
	months := MonthsSpanningUnix(fromSec, time.Now().UTC().Unix())
	for _, ym := range months {
		tbl := Table(BasePaymentTransactions, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		base := func() *gorm.DB {
			q := s.db.WithContext(ctx).Table(tbl).Where("deleted_at IS NULL").Where("created_at >= ?", fromSec)
			if filter != nil {
				q = filter(q)
			}
			return q
		}
		var partSum int64
		if err := base().Select("COALESCE(SUM(order_amount_cents), 0)").Scan(&partSum).Error; err != nil {
			return 0, 0, nil, err
		}
		sumCents += partSum
		var partCount int64
		if err := base().Count(&partCount).Error; err != nil {
			return 0, 0, nil, err
		}
		count += partCount
		if groupByChannel {
			type row struct {
				Channel string
				Revenue int64
				Count   int64
			}
			var rows []row
			gq := base()
			if err := gq.Select("channel, COALESCE(SUM(order_amount_cents), 0) as revenue, COUNT(*) as count").
				Group("channel").Scan(&rows).Error; err != nil {
				return 0, 0, nil, err
			}
			for _, r := range rows {
				channelRows = append(channelRows, struct {
					Channel string
					Revenue int64
					Count   int64
				}{r.Channel, r.Revenue, r.Count})
			}
		}
	}
	return sumCents, count, channelRows, nil
}

func (s *Shards) FindPaymentTransactionByTradeNo(ctx context.Context, channelID, tradeNo, orderNo string) (*persistence.PaymentTransaction, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	var row persistence.PaymentTransaction
	_, err := s.FindFirstAcross(ctx, BasePaymentTransactions, months, func(q *gorm.DB) *gorm.DB {
		q = q.Where("channel_id = ?", channelID)
		if tradeNo != "" {
			q = q.Where("channel_trade_no = ? OR order_number = ?", tradeNo, tradeNo)
		} else if orderNo != "" {
			q = q.Where("order_number = ?", orderNo)
		} else {
			q = q.Where("1 = 0")
		}
		return q.Order("created_at DESC")
	}, &row)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *Shards) ListPaymentTransactionsByStatus(ctx context.Context, statuses []string, limit int) ([]persistence.PaymentTransaction, error) {
	months := RecentMonthsNewestFirst(3)
	var out []persistence.PaymentTransaction
	for _, ym := range months {
		tbl := Table(BasePaymentTransactions, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		var chunk []persistence.PaymentTransaction
		q := s.db.WithContext(ctx).Table(tbl).Where("status IN ?", statuses).Order("created_at DESC").Limit(limit)
		if err := q.Find(&chunk).Error; err != nil {
			return nil, err
		}
		out = append(out, chunk...)
		if len(out) >= limit {
			break
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}
