package sharding

import (
	"testing"
	"time"
)

func TestMonthSuffixFromUnix(t *testing.T) {
	ts := time.Date(2026, 9, 18, 12, 0, 0, 0, time.UTC).Unix()
	if MonthSuffixFromUnix(ts) != "202609" {
		t.Fatalf("expected 202609 got %s", MonthSuffixFromUnix(ts))
	}
}

func TestMonthHintFromTransactionID(t *testing.T) {
	if MonthHintFromTransactionID("TX-20260918-123456") != "202609" {
		t.Fatal("hint parse failed")
	}
	if MonthHintFromTransactionID("uuid") != "" {
		t.Fatal("expected empty hint")
	}
}

func TestMonthsNewestFirst(t *testing.T) {
	from := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)
	m := MonthsNewestFirst(from, to)
	if len(m) != 3 || m[0] != "202609" || m[2] != "202607" {
		t.Fatalf("unexpected months: %v", m)
	}
}
