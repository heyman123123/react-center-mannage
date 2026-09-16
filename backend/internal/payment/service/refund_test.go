package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"gorm.io/gorm"
)

func TestProcessRefund_CreemAPI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/refunds" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["transaction_id"] != "tran_test_1" {
			t.Fatalf("unexpected transaction_id: %v", body["transaction_id"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "succeeded"})
	}))
	defer srv.Close()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&persistence.PaymentChannel{},
		&persistence.PaymentTransaction{},
		&persistence.PaymentRefund{},
	); err != nil {
		t.Fatal(err)
	}

	channelID := uuid.NewString()
	txID := uuid.NewString()
	svc := NewService(db, &conf.Config{})
	secret := svc.sealSecret("test_api_key")
	if err := db.Create(&persistence.PaymentChannel{
		ID:           channelID,
		ChannelKey:   "creem",
		Name:         "Creem Sandbox",
		Environment:  "sandbox",
		Enabled:      true,
		ApiKey:       secret,
		ApiSecretKey: secret,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&persistence.PaymentTransaction{
		ID:               txID,
		DisplayID:        "TX-TEST-001",
		ChannelID:        channelID,
		TenantID:         "group_hq",
		Channel:          "creem",
		ExternalEventID:  "evt_1",
		ChannelTradeNo:   "tran_test_1",
		OrderAmountCents: 1999,
		Currency:         "USD",
		Status:           "done",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&persistence.PaymentRefund{
		ID:                  uuid.NewString(),
		DisplayID:           "ref_test_001",
		TransactionID:       txID,
		TransactionNo:       "TX-TEST-001",
		ChannelID:           channelID,
		TenantID:            "group_hq",
		Channel:             "creem",
		RefundAmountCents:   1999,
		OriginalAmountCents: 1999,
		Currency:            "USD",
		Reason:              "客户要求",
		Status:              "PROCESSING",
		RefundType:          "FULL",
	}).Error; err != nil {
		t.Fatal(err)
	}

	origNew := newCreemClient
	newCreemClient = func(environment, apiKey string) *creem.Client {
		return creem.NewClient(environment, apiKey).WithBaseURL(strings.TrimRight(srv.URL, "/") + "/v1")
	}
	defer func() { newCreemClient = origNew }()

	dto, err := svc.ProcessRefund(context.Background(), "ref_test_001")
	if err != nil {
		t.Fatal(err)
	}
	if dto.Status != "SUCCESS" {
		t.Fatalf("expected SUCCESS, got %s", dto.Status)
	}
}
