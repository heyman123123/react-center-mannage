package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

func signCreemBody(secret string, raw []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(raw)
	return hex.EncodeToString(mac.Sum(nil))
}

func setupWebhookTest(t *testing.T, webhookSecret string) (*Service, *sharding.Shards, string) {
	t.Helper()
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
	svc := NewService(db, &conf.Config{}, shards)
	row := persistence.PaymentChannel{
		ID:           channelID,
		ChannelKey:   "creem",
		Name:         "Creem Sandbox",
		Environment:  "sandbox",
		Enabled:      true,
		ApiKey:       svc.sealSecret("api_key"),
		ApiSecretKey: svc.sealSecret("api_key"),
	}
	if webhookSecret != "" {
		row.WebhookSecret = svc.sealSecret(webhookSecret)
	}
	if err := db.Create(&row).Error; err != nil {
		t.Fatal(err)
	}
	return svc, shards, channelID
}

func TestHandleCreemWebhook_Idempotent(t *testing.T) {
	secret := "whsec_test"
	svc, shards, channelID := setupWebhookTest(t, secret)

	raw := []byte(`{"id":"evt_dup_1","eventType":"checkout.expired","object":{"id":"ch_1","product":{"id":"prod_1","name":"Test"}}}`)
	sig := signCreemBody(secret, raw)
	ctx := context.Background()
	path := "/api/v1/hooks/creem/" + channelID
	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw, path); err != nil {
		t.Fatal(err)
	}

	afterFirst, _, err := shards.FindPaymentWebhookByEventID(ctx, "evt_dup_1")
	if err != nil {
		t.Fatal(err)
	}
	if afterFirst.Status != "DELIVERED" {
		t.Fatalf("expected DELIVERED after first, got %s", afterFirst.Status)
	}
	if afterFirst.Attempts != 1 {
		t.Fatalf("expected 1 attempt after first delivery, got %d", afterFirst.Attempts)
	}

	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw, path); err != nil {
		t.Fatal(err)
	}

	again, _, err := shards.FindPaymentWebhookByEventID(ctx, "evt_dup_1")
	if err != nil {
		t.Fatal(err)
	}
	if again.Status != "DELIVERED" {
		t.Fatalf("expected DELIVERED, got %s", again.Status)
	}
	if again.Attempts != 1 {
		t.Fatalf("idempotent success should keep attempts=1, got %d", again.Attempts)
	}
}

func TestHandleCreemWebhook_EmptySecretRejects(t *testing.T) {
	svc, _, channelID := setupWebhookTest(t, "")
	raw := []byte(`{"id":"evt_unsigned","eventType":"checkout.expired"}`)
	err := svc.HandleCreemWebhook(context.Background(), channelID, "any", raw, "/hooks")
	if err == nil {
		t.Fatal("expected rejection when webhook secret is empty")
	}
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.HTTP != 401 {
		t.Fatalf("expected 401 apperr, got %v", err)
	}
}

func TestHandleCreemWebhook_FailedAllowsReprocess(t *testing.T) {
	secret := "whsec_retry"
	svc, shards, channelID := setupWebhookTest(t, secret)
	ctx := context.Background()

	raw := []byte(`{"id":"evt_retry_1","eventType":"checkout.expired","object":{"id":"ch_1","product":{"id":"prod_1","name":"Test"}}}`)
	sig := signCreemBody(secret, raw)

	if err := shards.CreatePaymentWebhookLog(ctx, &persistence.PaymentWebhookLog{
		ID:          uuid.NewString(),
		ChannelID:   channelID,
		EventID:     "evt_retry_1",
		EventType:   "checkout.expired",
		Channel:     "creem",
		Status:      "FAILED",
		Attempts:    1,
		PayloadJSON: string(raw),
	}); err != nil {
		t.Fatal(err)
	}

	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw, "/hooks"); err != nil {
		t.Fatal(err)
	}

	row, _, err := shards.FindPaymentWebhookByEventID(ctx, "evt_retry_1")
	if err != nil {
		t.Fatal(err)
	}
	if row.Status != "DELIVERED" {
		t.Fatalf("expected reprocess to DELIVERED, got %s", row.Status)
	}
	if row.Attempts != 2 {
		t.Fatalf("expected attempts=2 after reprocess, got %d", row.Attempts)
	}
}
