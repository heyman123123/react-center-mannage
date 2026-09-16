package service

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"gorm.io/gorm"
)

func TestHandleCreemWebhook_Idempotent(t *testing.T) {
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
	if err := db.Create(&persistence.PaymentChannel{
		ID:           channelID,
		ChannelKey:   "creem",
		Name:         "Creem Sandbox",
		Environment:  "sandbox",
		Enabled:      true,
		ApiKey:       svc.sealSecret("api_key"),
		ApiSecretKey: svc.sealSecret("api_key"),
	}).Error; err != nil {
		t.Fatal(err)
	}

	raw := []byte(`{"id":"evt_dup_1","eventType":"checkout.expired","object":{"id":"ch_1","product":{"id":"prod_1","name":"Test"}}}`)
	ctx := context.Background()
	if err := svc.HandleCreemWebhook(ctx, channelID, "", raw); err != nil {
		t.Fatal(err)
	}
	if err := svc.HandleCreemWebhook(ctx, channelID, "", raw); err != nil {
		t.Fatal(err)
	}

	var count int64
	if err := db.Model(&persistence.PaymentWebhookLog{}).Where("event_id = ?", "evt_dup_1").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected 1 webhook log, got %d", count)
	}
}
