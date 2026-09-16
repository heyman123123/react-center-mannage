package creem

import (
	"testing"
)

func TestParseWebhookTransaction_CheckoutCompleted(t *testing.T) {
	payload := map[string]interface{}{
		"id":        "evt_test_1",
		"eventType": "checkout.completed",
		"created_at": 1728734325,
		"object": map[string]interface{}{
			"id": "ch_test",
			"order": map[string]interface{}{
				"id":       "ord_test",
				"amount":   1999,
				"currency": "usd",
			},
			"product": map[string]interface{}{
				"id":    "prod_test",
				"name":  "Pro Monthly",
				"price": 1999,
			},
			"customer": map[string]interface{}{
				"email":   "user@example.com",
				"name":    "Test User",
				"country": "US",
			},
		},
	}
	parsed, ok := ParseWebhookTransaction("checkout.completed", payload)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if parsed.ChannelTradeNo != "ord_test" {
		t.Fatalf("unexpected trade no: %s", parsed.ChannelTradeNo)
	}
	if parsed.OrderAmountCents != 1999 {
		t.Fatalf("unexpected amount: %d", parsed.OrderAmountCents)
	}
	if parsed.Status != "done" {
		t.Fatalf("unexpected status: %s", parsed.Status)
	}
}
