package creem

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	ProdBase = "https://api.creem.io/v1"
	TestBase = "https://test-api.creem.io/v1"
)

type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

func (c *Client) WithBaseURL(url string) *Client {
	nc := *c
	nc.baseURL = strings.TrimRight(url, "/")
	return &nc
}

func NewClient(environment, apiKey string) *Client {
	base := ProdBase
	if strings.ToLower(environment) == "sandbox" {
		base = TestBase
	}
	return &Client{
		baseURL: strings.TrimRight(base, "/"),
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

type CreateProductReq struct {
	Name          string `json:"name"`
	Description   string `json:"description,omitempty"`
	Price         int64  `json:"price"`
	Currency      string `json:"currency"`
	BillingType   string `json:"billing_type"`
	BillingPeriod string `json:"billing_period,omitempty"`
	TaxMode       string `json:"tax_mode,omitempty"`
	TaxCategory   string `json:"tax_category,omitempty"`
}

type ProductEntity struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Price         int64  `json:"price"`
	Currency      string `json:"currency"`
	BillingType   string `json:"billing_type"`
	BillingPeriod string `json:"billing_period"`
	Status        string `json:"status"`
}

type CreateDiscountReq struct {
	Name              string   `json:"name"`
	Code              string   `json:"code,omitempty"`
	Type              string   `json:"type"`
	Amount            *int     `json:"amount,omitempty"`
	Percentage        *int     `json:"percentage,omitempty"`
	Currency          string   `json:"currency,omitempty"`
	ExpiryDate        string   `json:"expiry_date,omitempty"`
	MaxRedemptions    *int     `json:"max_redemptions,omitempty"`
	Duration          string   `json:"duration"`
	DurationInMonths  *int     `json:"duration_in_months,omitempty"`
	AppliesToProducts []string `json:"applies_to_products"`
}

type DiscountEntity struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Code         string `json:"code"`
	Type         string `json:"type"`
	RedeemCount  int    `json:"redeem_count"`
}

type productSearchResp struct {
	Items []ProductEntity `json:"items"`
}

type productListWrapper struct {
	Result struct {
		Items []ProductEntity `json:"items"`
	} `json:"result"`
	Items []ProductEntity `json:"items"`
}

func (c *Client) do(ctx context.Context, method, path string, body interface{}, out interface{}) (int, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return 0, err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	start := time.Now()
	resp, err := c.http.Do(req)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		return latency, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return latency, fmt.Errorf("creem %s %s: %d %s", method, path, resp.StatusCode, string(respBody))
	}
	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return latency, err
		}
	}
	return latency, nil
}

func (c *Client) Ping(ctx context.Context) (int, error) {
	var wrapper productListWrapper
	latency, err := c.do(ctx, http.MethodGet, "/products/search?page_size=1", nil, &wrapper)
	return latency, err
}

func (c *Client) CreateProduct(ctx context.Context, in CreateProductReq) (*ProductEntity, error) {
	var out ProductEntity
	_, err := c.do(ctx, http.MethodPost, "/products", in, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UpdateProduct(ctx context.Context, id string, in map[string]interface{}) (*ProductEntity, error) {
	var out ProductEntity
	_, err := c.do(ctx, http.MethodPatch, "/products/"+id, in, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ArchiveProduct(ctx context.Context, id string) error {
	_, err := c.do(ctx, http.MethodDelete, "/products/"+id, nil, nil)
	return err
}

func (c *Client) GetProduct(ctx context.Context, id string) (*ProductEntity, error) {
	var out ProductEntity
	_, err := c.do(ctx, http.MethodGet, "/products/"+id, nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) CreateDiscount(ctx context.Context, in CreateDiscountReq) (*DiscountEntity, error) {
	var out DiscountEntity
	_, err := c.do(ctx, http.MethodPost, "/discounts", in, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) DeleteDiscount(ctx context.Context, id string) error {
	_, err := c.do(ctx, http.MethodDelete, "/discounts/"+id+"/delete", nil, nil)
	return err
}
