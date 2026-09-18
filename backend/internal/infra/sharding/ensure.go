package sharding

import (
	"fmt"
	"log"
	"time"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"gorm.io/gorm"
)

var monthlyModels = []interface{}{
	&persistence.PaymentTransaction{},
	&persistence.PaymentWebhookLog{},
	&persistence.PaymentRefund{},
	&persistence.PaymentChargeback{},
	&persistence.AuditLog{},
	&persistence.EmailWebhookLog{},
}

var monthlyBases = []string{
	BasePaymentTransactions,
	BasePaymentWebhookLogs,
	BasePaymentRefunds,
	BasePaymentChargebacks,
	BaseAuditLogs,
	BaseEmailWebhookLogs,
}

type Shards struct {
	db *gorm.DB
}

func NewShards(db *gorm.DB) *Shards {
	return &Shards{db: db}
}

// EnsureOnStartup creates current month, previous month, and next month physical tables.
func (s *Shards) EnsureOnStartup() error {
	now := time.Now().UTC()
	months := MonthsNewestFirst(now.AddDate(0, -1, 0), now.AddDate(0, 1, 0))
	for _, base := range monthlyBases {
		for _, ym := range months {
			if err := s.ensureTable(base, ym); err != nil {
				return err
			}
		}
	}
	if err := s.migrateLegacySingleTables(months[0]); err != nil {
		return err
	}
	log.Printf("sharding: ensured monthly tables for %v", months)
	return nil
}

func (s *Shards) ensureTable(base, yyyymm string) error {
	tbl := Table(base, yyyymm)
	if s.db.Migrator().HasTable(tbl) {
		return nil
	}
	var model interface{}
	switch base {
	case BasePaymentTransactions:
		model = &persistence.PaymentTransaction{}
	case BasePaymentWebhookLogs:
		model = &persistence.PaymentWebhookLog{}
	case BasePaymentRefunds:
		model = &persistence.PaymentRefund{}
	case BasePaymentChargebacks:
		model = &persistence.PaymentChargeback{}
	case BaseAuditLogs:
		model = &persistence.AuditLog{}
	case BaseEmailWebhookLogs:
		model = &persistence.EmailWebhookLog{}
	default:
		return fmt.Errorf("unknown sharded base table %s", base)
	}
	if err := s.db.Table(tbl).AutoMigrate(model); err != nil {
		return err
	}
	return s.ensureShardIndexes(base, yyyymm, tbl)
}

func (s *Shards) ensureShardIndexes(base, ym, tbl string) error {
	switch base {
	case BasePaymentTransactions:
		stmts := []string{
			fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_%s_tx_display" ON %s (display_id)`, ym, tbl),
			fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_%s_tx_channel_event" ON %s (channel_id, external_event_id)`, ym, tbl),
		}
		for _, q := range stmts {
			if err := s.db.Exec(q).Error; err != nil {
				return err
			}
		}
	case BasePaymentWebhookLogs:
		q := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_%s_wh_event" ON %s (event_id)`, ym, tbl)
		if err := s.db.Exec(q).Error; err != nil {
			return err
		}
	case BasePaymentRefunds:
		q := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_%s_ref_display" ON %s (display_id)`, ym, tbl)
		if err := s.db.Exec(q).Error; err != nil {
			return err
		}
	case BasePaymentChargebacks:
		q := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_%s_cb_display" ON %s (display_id)`, ym, tbl)
		if err := s.db.Exec(q).Error; err != nil {
			return err
		}
	}
	return nil
}

// migrateLegacySingleTables copies rows from non-suffixed tables into the current month shard once.
func (s *Shards) migrateLegacySingleTables(currentYYYYMM string) error {
	for i, base := range monthlyBases {
		legacy := base
		if !s.db.Migrator().HasTable(legacy) {
			continue
		}
		sharded := Table(base, currentYYYYMM)
		if !s.db.Migrator().HasTable(sharded) {
			continue
		}
		var legacyCount int64
		if err := s.db.Table(legacy).Count(&legacyCount).Error; err != nil || legacyCount == 0 {
			continue
		}
		var shardCount int64
		if err := s.db.Table(sharded).Count(&shardCount).Error; err != nil {
			return err
		}
		if shardCount > 0 {
			continue
		}
		model := monthlyModels[i]
		log.Printf("sharding: migrating %d rows from legacy %s -> %s", legacyCount, legacy, sharded)
		const batch = 500
		offset := 0
		for {
			rows := s.db.Table(legacy).Offset(offset).Limit(batch)
			switch base {
			case BasePaymentTransactions:
				var chunk []persistence.PaymentTransaction
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			case BasePaymentWebhookLogs:
				var chunk []persistence.PaymentWebhookLog
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			case BasePaymentRefunds:
				var chunk []persistence.PaymentRefund
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			case BasePaymentChargebacks:
				var chunk []persistence.PaymentChargeback
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			case BaseAuditLogs:
				var chunk []persistence.AuditLog
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			case BaseEmailWebhookLogs:
				var chunk []persistence.EmailWebhookLog
				if err := rows.Find(&chunk).Error; err != nil {
					return err
				}
				if len(chunk) == 0 {
					break
				}
				if err := s.db.Table(sharded).Create(&chunk).Error; err != nil {
					return err
				}
				offset += len(chunk)
				if len(chunk) < batch {
					break
				}
				continue
			default:
				_ = model
				return fmt.Errorf("legacy migrate not implemented for %s", base)
			}
		}
	}
	return nil
}

func (s *Shards) DB() *gorm.DB {
	return s.db
}

func (s *Shards) EnsureMonth(base string, yyyymm string) error {
	return s.ensureTable(base, yyyymm)
}
