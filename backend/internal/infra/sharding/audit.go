package sharding

import (
	"context"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

func (s *Shards) CreateAuditLog(ctx context.Context, row *persistence.AuditLog) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	ym := MonthSuffixFromUnix(row.CreatedAt)
	_ = s.ensureTable(BaseAuditLogs, ym)
	return s.db.WithContext(ctx).Table(Table(BaseAuditLogs, ym)).Create(row).Error
}

func (s *Shards) ListAuditLogs(ctx context.Context, page, pageSize int, filter FilterFunc) ([]persistence.AuditLog, int64, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	return PaginateAcross(ctx, s.db, BaseAuditLogs, months, page, pageSize, filter,
		func(q *gorm.DB) ([]persistence.AuditLog, error) {
			var rows []persistence.AuditLog
			err := q.Find(&rows).Error
			return rows, err
		})
}

func (s *Shards) CreateEmailWebhookLog(ctx context.Context, row *persistence.EmailWebhookLog) error {
	if row.CreatedAt <= 0 {
		row.CreatedAt = timex.Now()
	}
	ym := MonthSuffixFromUnix(row.CreatedAt)
	_ = s.ensureTable(BaseEmailWebhookLogs, ym)
	return s.db.WithContext(ctx).Table(Table(BaseEmailWebhookLogs, ym)).Create(row).Error
}

func (s *Shards) ListEmailWebhookLogs(ctx context.Context, page, pageSize int, filter FilterFunc) ([]persistence.EmailWebhookLog, int64, error) {
	months := RecentMonthsNewestFirst(DefaultListMonths)
	return PaginateAcross(ctx, s.db, BaseEmailWebhookLogs, months, page, pageSize, filter,
		func(q *gorm.DB) ([]persistence.EmailWebhookLog, error) {
			var rows []persistence.EmailWebhookLog
			err := q.Find(&rows).Error
			return rows, err
		})
}
