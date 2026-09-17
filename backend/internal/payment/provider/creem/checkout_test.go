package creem

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateCheckoutSession(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/checkouts" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("x-api-key") != "test_key" {
			t.Fatalf("missing api key")
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["product_id"] != "prod_test" {
			t.Fatalf("unexpected product_id: %v", body["product_id"])
		}
		if body["success_url"] != "https://example.com/success" {
			t.Fatalf("unexpected success_url: %v", body["success_url"])
		}
		customer, _ := body["customer"].(map[string]interface{})
		if customer == nil || customer["email"] != "user@example.com" {
			t.Fatalf("unexpected customer: %v", body["customer"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":           "ch_test_1",
			"checkout_url": "https://checkout.creem.io/ch_test_1",
			"product_id":   "prod_test",
			"status":       "pending",
			"expires_at":   "2026-09-16T12:00:00Z",
		})
	}))
	defer srv.Close()

	client := NewClient("sandbox", "test_key")
	client.baseURL = strings.TrimRight(srv.URL, "/") + "/v1"

	session, err := client.CreateCheckoutSession(context.Background(), CreateCheckoutReq{
		ProductID:     "prod_test",
		SuccessURL:    "https://example.com/success",
		CustomerEmail: "user@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.CheckoutURL != "https://checkout.creem.io/ch_test_1" {
		t.Fatalf("unexpected checkout url: %s", session.CheckoutURL)
	}
	if session.ID != "ch_test_1" {
		t.Fatalf("unexpected id: %s", session.ID)
	}
}

func TestCreateRefund(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/refunds" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["transaction_id"] != "tran_test" {
			t.Fatalf("unexpected transaction_id: %v", body["transaction_id"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":     "ref_test",
			"status": "succeeded",
		})
	}))
	defer srv.Close()

	client := NewClient("sandbox", "test_key")
	client.baseURL = strings.TrimRight(srv.URL, "/") + "/v1"

	refund, err := client.CreateRefund(context.Background(), "tran_test", 1999)
	if err != nil {
		t.Fatal(err)
	}
	if refund.Status != "succeeded" {
		t.Fatalf("unexpected status: %s", refund.Status)
	}
}

func TestListProducts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || !strings.HasPrefix(r.URL.Path, "/v1/products/search") {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		q := r.URL.Query()
		if q.Get("page") != "" {
			t.Fatalf("legacy query param page must not be sent: %s", r.URL.RawQuery)
		}
		if q.Get("page_number") != "1" || q.Get("page_size") != "10" {
			t.Fatalf("unexpected query: %s", r.URL.RawQuery)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"items": []map[string]interface{}{
				{"id": "prod_1", "name": "Pro", "price": 999, "currency": "USD", "status": "active"},
			},
		})
	}))
	defer srv.Close()

	client := NewClient("sandbox", "test_key")
	client.baseURL = strings.TrimRight(srv.URL, "/") + "/v1"

	items, err := client.ListProducts(context.Background(), 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "prod_1" {
		t.Fatalf("unexpected items: %+v", items)
	}
}
