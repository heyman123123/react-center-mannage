package creem

import (
	"fmt"
	"strings"
	"time"
)

type ParsedTransaction struct {
	ExternalEventID  string
	ChannelTradeNo   string
	OrderNumber      string
	OrderTitle       string
	OrderAmountCents int64
	Currency         string
	CustomerEmail    string
	CustomerName     string
	CustomerCountry  string
	ProductID        string
	ProductName      string
	SubscriptionID   string
	PaymentMethod    string
	Status           string
	EventType        string
	CreatedAt        int64
}

func ParseWebhookTransaction(eventType string, payload map[string]interface{}) (*ParsedTransaction, bool) {
	if eventType == "" {
		eventType = stringField(payload, "eventType")
	}
	if eventType == "" {
		eventType = stringField(payload, "event")
	}
	if eventType == "" {
		eventType = stringField(payload, "type")
	}
	switch eventType {
	case "checkout.completed", "checkout.expired",
		"subscription.paid", "subscription.past_due", "subscription.canceled",
		"payment.failed",
		"dispute.created", "refund.created":
	default:
		return nil, false
	}

	eventID := stringField(payload, "id")
	if eventID == "" {
		return nil, false
	}
	createdAt := int64Field(payload, "created_at")
	if createdAt == 0 {
		createdAt = time.Now().UTC().Unix()
	} else if createdAt > 1_000_000_000_000 {
		createdAt = createdAt / 1000
	}

	obj, _ := payload["object"].(map[string]interface{})
	if obj == nil {
		return nil, false
	}

	parsed := &ParsedTransaction{
		ExternalEventID: eventID,
		EventType:       eventType,
		CreatedAt:       createdAt,
		Status:          mapEventStatus(eventType),
		PaymentMethod:   "Creem Checkout",
	}

	switch eventType {
	case "checkout.completed", "checkout.expired":
		parseCheckoutObject(obj, parsed)
	case "subscription.paid", "subscription.past_due", "subscription.canceled":
		parseSubscriptionObject(obj, parsed)
	case "payment.failed", "dispute.created", "refund.created":
		parseGenericPaymentObject(obj, parsed)
	}

	if parsed.ChannelTradeNo == "" {
		parsed.ChannelTradeNo = eventID
	}
	if parsed.OrderTitle == "" {
		parsed.OrderTitle = eventType
	}
	if parsed.Currency == "" {
		parsed.Currency = "USD"
	}
	return parsed, true
}

func mapEventStatus(eventType string) string {
	switch eventType {
	case "checkout.completed", "subscription.paid":
		return "done"
	case "subscription.past_due", "subscription.canceled", "dispute.created", "payment.failed":
		return "discrepancy"
	case "checkout.expired":
		return "pending_check"
	case "refund.created":
		return "in_process"
	default:
		return "pending_check"
	}
}

func parseCheckoutObject(obj map[string]interface{}, out *ParsedTransaction) {
	out.ChannelTradeNo = firstNonEmpty(
		stringField(nestedMap(obj, "order"), "id"),
		stringField(obj, "id"),
	)
	out.OrderNumber = stringField(nestedMap(obj, "order"), "id")
	out.OrderAmountCents = int64Field(nestedMap(obj, "order"), "amount")
	if out.OrderAmountCents == 0 {
		out.OrderAmountCents = int64Field(nestedMap(obj, "product"), "price")
	}
	out.Currency = strings.ToUpper(firstNonEmpty(
		stringField(nestedMap(obj, "order"), "currency"),
		stringField(nestedMap(obj, "product"), "currency"),
	))
	product := nestedMap(obj, "product")
	out.ProductID = stringField(product, "id")
	out.ProductName = stringField(product, "name")
	out.OrderTitle = firstNonEmpty(out.ProductName, "Creem Checkout")
	customer := nestedMap(obj, "customer")
	out.CustomerEmail = stringField(customer, "email")
	out.CustomerName = stringField(customer, "name")
	out.CustomerCountry = stringField(customer, "country")
	sub := nestedMap(obj, "subscription")
	out.SubscriptionID = stringField(sub, "id")
}

func parseSubscriptionObject(obj map[string]interface{}, out *ParsedTransaction) {
	out.SubscriptionID = stringField(obj, "id")
	out.ChannelTradeNo = firstNonEmpty(
		stringField(obj, "last_transaction_id"),
		out.SubscriptionID,
	)
	product := nestedMap(obj, "product")
	if product == nil {
		productID := stringField(obj, "product")
		if productID != "" {
			out.ProductID = productID
		}
	} else {
		out.ProductID = stringField(product, "id")
		out.ProductName = stringField(product, "name")
		out.OrderAmountCents = int64Field(product, "price")
		out.Currency = strings.ToUpper(stringField(product, "currency"))
	}
	out.OrderTitle = firstNonEmpty(out.ProductName, "Creem Subscription")
	customer := nestedMap(obj, "customer")
	out.CustomerEmail = stringField(customer, "email")
	out.CustomerName = stringField(customer, "name")
	out.CustomerCountry = stringField(customer, "country")
	out.PaymentMethod = "Creem Subscription"
}

func parseGenericPaymentObject(obj map[string]interface{}, out *ParsedTransaction) {
	out.ChannelTradeNo = firstNonEmpty(stringField(obj, "id"), stringField(obj, "transaction_id"))
	out.OrderAmountCents = int64Field(obj, "amount")
	out.Currency = strings.ToUpper(stringField(obj, "currency"))
	out.OrderTitle = firstNonEmpty(stringField(obj, "reason"), out.EventType)
}

func nestedMap(m map[string]interface{}, key string) map[string]interface{} {
	if m == nil {
		return nil
	}
	v, ok := m[key].(map[string]interface{})
	if !ok {
		return nil
	}
	return v
}

func stringField(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func int64Field(m map[string]interface{}, key string) int64 {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int:
		return int64(t)
	case int64:
		return t
	case string:
		var n int64
		_, _ = fmt.Sscan(t, &n)
		return n
	default:
		return 0
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
