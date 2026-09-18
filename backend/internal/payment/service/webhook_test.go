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
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

func signCreemBody(secret string, raw []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(raw)
	return hex.EncodeToString(mac.Sum(nil))
}

func setupWebhookTest(t *testing.T, webhookSecret string) (*Service, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&persistence.PaymentChannel{},
		&persistence.PaymentWebhookLog{},
		&persistence.PaymentTransaction{},
	); err != nil {
		t.Fatal(err)
	}

	channelID := uuid.NewString()
	svc := NewService(db, &conf.Config{})
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
	return svc, channelID
}

func TestHandleCreemWebhook_Idempotent(t *testing.T) {
	secret := "whsec_test"
	svc, channelID := setupWebhookTest(t, secret)

	raw := []byte(`{"id":"evt_dup_1","eventType":"checkout.expired","object":{"id":"ch_1","product":{"id":"prod_1","name":"Test"}}}`)
	sig := signCreemBody(secret, raw)
	ctx := context.Background()
	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw); err != nil {
		t.Fatal(err)
	}

	var afterFirst persistence.PaymentWebhookLog
	if err := svc.db.Where("event_id = ?", "evt_dup_1").First(&afterFirst).Error; err != nil {
		t.Fatal(err)
	}
	if afterFirst.Status != "DELIVERED" {
		t.Fatalf("expected DELIVERED after first, got %s", afterFirst.Status)
	}
	if afterFirst.Attempts != 1 {
		t.Fatalf("expected 1 attempt after first delivery, got %d", afterFirst.Attempts)
	}

	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw); err != nil {
		t.Fatal(err)
	}

	var count int64
	if err := svc.db.Model(&persistence.PaymentWebhookLog{}).Where("event_id = ?", "evt_dup_1").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected 1 webhook log, got %d", count)
	}
	var row persistence.PaymentWebhookLog
	if err := svc.db.Where("event_id = ?", "evt_dup_1").First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.Status != "DELIVERED" {
		t.Fatalf("expected DELIVERED, got %s", row.Status)
	}
	if row.Attempts != 1 {
		t.Fatalf("idempotent success should keep attempts=1, got %d", row.Attempts)
	}
}

func TestHandleCreemWebhook_EmptySecretRejects(t *testing.T) {
	svc, channelID := setupWebhookTest(t, "")
	raw := []byte(`{"id":"evt_unsigned","eventType":"checkout.expired"}`)
	err := svc.HandleCreemWebhook(context.Background(), channelID, "any", raw)
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
	svc, channelID := setupWebhookTest(t, secret)
	ctx := context.Background()

	raw := []byte(`{"id":"evt_retry_1","eventType":"checkout.expired","object":{"id":"ch_1","product":{"id":"prod_1","name":"Test"}}}`)
	sig := signCreemBody(secret, raw)

	if err := svc.db.Create(&persistence.PaymentWebhookLog{
		ID:          uuid.NewString(),
		ChannelID:   channelID,
		EventID:     "evt_retry_1",
		EventType:   "checkout.expired",
		Channel:     "creem",
		Status:      "FAILED",
		Attempts:    1,
		PayloadJSON: string(raw),
	}).Error; err != nil {
		t.Fatal(err)
	}

	if err := svc.HandleCreemWebhook(ctx, channelID, sig, raw); err != nil {
		t.Fatal(err)
	}

	var row persistence.PaymentWebhookLog
	if err := svc.db.Where("event_id = ?", "evt_retry_1").First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.Status != "DELIVERED" {
		t.Fatalf("expected reprocess to DELIVERED, got %s", row.Status)
	}
	if row.Attempts != 2 {
		t.Fatalf("expected attempts=2 after reprocess, got %d", row.Attempts)
	}
}
