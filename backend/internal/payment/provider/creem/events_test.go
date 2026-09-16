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

func TestParseWebhookTransaction_SubscriptionCanceled(t *testing.T) {
	payload := map[string]interface{}{
		"id":        "evt_sub_cancel",
		"eventType": "subscription.canceled",
		"object": map[string]interface{}{
			"id": "sub_test",
			"product": map[string]interface{}{
				"id":       "prod_test",
				"name":     "Pro Monthly",
				"price":    1999,
				"currency": "usd",
			},
			"customer": map[string]interface{}{
				"email": "user@example.com",
			},
		},
	}
	parsed, ok := ParseWebhookTransaction("subscription.canceled", payload)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if parsed.SubscriptionID != "sub_test" {
		t.Fatalf("unexpected subscription id: %s", parsed.SubscriptionID)
	}
	if parsed.Status != "discrepancy" {
		t.Fatalf("unexpected status: %s", parsed.Status)
	}
}

func TestParseWebhookTransaction_PaymentFailed(t *testing.T) {
	payload := map[string]interface{}{
		"id":        "evt_pay_fail",
		"eventType": "payment.failed",
		"object": map[string]interface{}{
			"id":       "tran_fail",
			"amount":   500,
			"currency": "usd",
			"reason":   "card_declined",
		},
	}
	parsed, ok := ParseWebhookTransaction("payment.failed", payload)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if parsed.ChannelTradeNo != "tran_fail" {
		t.Fatalf("unexpected trade no: %s", parsed.ChannelTradeNo)
	}
	if parsed.Status != "discrepancy" {
		t.Fatalf("unexpected status: %s", parsed.Status)
	}
}

func TestParseWebhookTransaction_CheckoutExpired(t *testing.T) {
	payload := map[string]interface{}{
		"id":        "evt_chk_exp",
		"eventType": "checkout.expired",
		"object": map[string]interface{}{
			"id": "ch_expired",
			"product": map[string]interface{}{
				"id":   "prod_test",
				"name": "Pro Monthly",
			},
		},
	}
	parsed, ok := ParseWebhookTransaction("checkout.expired", payload)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if parsed.Status != "pending_check" {
		t.Fatalf("unexpected status: %s", parsed.Status)
	}
}
