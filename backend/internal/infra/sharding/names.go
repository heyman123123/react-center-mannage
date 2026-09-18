package sharding

import (
	"fmt"
	"time"
)

const (
	BasePaymentTransactions = "payment_transactions"
	BasePaymentWebhookLogs  = "payment_webhook_logs"
	BasePaymentRefunds      = "payment_refunds"
	BasePaymentChargebacks  = "payment_chargebacks"
	BaseAuditLogs           = "audit_logs"
	BaseEmailWebhookLogs    = "email_webhook_logs"
)

// DefaultListMonths is how many calendar months (newest first) list APIs scan by default.
const DefaultListMonths = 24

// DedupScanMonths is how far back webhook event_id dedup searches.
const DedupScanMonths = 24

func Table(base, yyyymm string) string {
	return fmt.Sprintf("%s_%s", base, yyyymm)
}

func MonthSuffix(t time.Time) string {
	return t.UTC().Format("200601")
}

func MonthSuffixFromUnix(sec int64) string {
	if sec <= 0 {
		return MonthSuffix(time.Now().UTC())
	}
	return MonthSuffix(time.Unix(sec, 0).UTC())
}

// MonthsNewestFirst returns yyyymm strings from `from` through `to` inclusive (UTC calendar months).
func MonthsNewestFirst(from, to time.Time) []string {
	from = time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	to = time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC)
	if from.After(to) {
		from, to = to, from
	}
	var out []string
	cur := to
	for !cur.Before(from) {
		out = append(out, MonthSuffix(cur))
		cur = cur.AddDate(0, -1, 0)
	}
	return out
}

func RecentMonthsNewestFirst(n int) []string {
	if n < 1 {
		n = 1
	}
	now := time.Now().UTC()
	start := now.AddDate(0, -(n - 1), 0)
	return MonthsNewestFirst(start, now)
}

func MonthsSpanningUnix(fromSec, toSec int64) []string {
	if toSec <= 0 {
		toSec = time.Now().UTC().Unix()
	}
	if fromSec <= 0 {
		fromSec = toSec
	}
	return MonthsNewestFirst(time.Unix(fromSec, 0).UTC(), time.Unix(toSec, 0).UTC())
}
