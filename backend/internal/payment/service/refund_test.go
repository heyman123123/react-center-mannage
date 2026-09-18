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
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"gorm.io/gorm"
)

func TestProcessRefund_CreemAPI(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/refunds" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		calls++
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
	if err := db.AutoMigrate(&persistence.PaymentChannel{}); err != nil {
		t.Fatal(err)
	}
	shards := sharding.NewShards(db)
	if err := shards.EnsureOnStartup(); err != nil {
		t.Fatal(err)
	}

	channelID := uuid.NewString()
	txID := uuid.NewString()
	svc := NewService(db, &conf.Config{}, shards)
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
	ctx := context.Background()
	if err := shards.CreatePaymentTransaction(ctx, &persistence.PaymentTransaction{
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
	}); err != nil {
		t.Fatal(err)
	}
	if err := shards.CreatePaymentRefund(ctx, &persistence.PaymentRefund{
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
		Status:              "PENDING",
		RefundType:          "FULL",
	}); err != nil {
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

	// Idempotent: second process must not call Creem again.
	dto2, err := svc.ProcessRefund(context.Background(), "ref_test_001")
	if err != nil {
		t.Fatal(err)
	}
	if dto2.Status != "SUCCESS" {
		t.Fatalf("expected SUCCESS no-op, got %s", dto2.Status)
	}
	if calls != 1 {
		t.Fatalf("expected exactly 1 Creem call, got %d", calls)
	}
}

func TestCreateRefund_RejectsInvalidAmount(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	shards := sharding.NewShards(db)
	if err := shards.EnsureOnStartup(); err != nil {
		t.Fatal(err)
	}
	txID := uuid.NewString()
	ctx := context.Background()
	if err := shards.CreatePaymentTransaction(ctx, &persistence.PaymentTransaction{
		ID:               txID,
		DisplayID:        "TX-AMT-001",
		TenantID:         "group_hq",
		Channel:          "creem",
		OrderAmountCents: 1000,
		Currency:         "USD",
		Status:           "done",
	}); err != nil {
		t.Fatal(err)
	}
	svc := NewService(db, &conf.Config{}, shards)

	if _, err := svc.CreateRefund(ctx, RefundInput{TransactionNo: "TX-AMT-001", RefundAmount: 0}); err == nil {
		t.Fatal("expected reject amount=0")
	}
	if _, err := svc.CreateRefund(ctx, RefundInput{TransactionNo: "TX-AMT-001", RefundAmount: -1}); err == nil {
		t.Fatal("expected reject negative amount")
	}
	if _, err := svc.CreateRefund(ctx, RefundInput{TransactionNo: "TX-AMT-001", RefundAmount: 20.01}); err == nil {
		t.Fatal("expected reject amount > original")
	}

	dto, err := svc.CreateRefund(ctx, RefundInput{TransactionNo: "TX-AMT-001", RefundAmount: 5})
	if err != nil {
		t.Fatal(err)
	}
	if dto.Status != "PENDING" {
		t.Fatalf("expected PENDING, got %s", dto.Status)
	}
	// Cumulative would exceed
	if _, err := svc.CreateRefund(ctx, RefundInput{TransactionNo: "TX-AMT-001", RefundAmount: 6}); err == nil {
		t.Fatal("expected reject cumulative overflow")
	}
}

func TestMaskKey_NoCiphertextLeak(t *testing.T) {
	if got := maskKey("enc:v1:abcXYZ1234567890"); got != "********" {
		t.Fatalf("expected fixed mask for enc, got %q", got)
	}
	if got := maskKey("sk_live_abcdefgh"); got != "****efgh" {
		t.Fatalf("expected ****last4 for plaintext, got %q", got)
	}
}
