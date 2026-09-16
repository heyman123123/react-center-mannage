package creem

import (
	"context"
	"net/http"
)

type CreateCheckoutReq struct {
	ProductID     string            `json:"product_id"`
	SuccessURL    string            `json:"success_url,omitempty"`
	RequestID     string            `json:"request_id,omitempty"`
	CustomerEmail string            `json:"customer_email,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type customerEmailReq struct {
	Email string `json:"email"`
}

type checkoutCreateBody struct {
	ProductID   string            `json:"product_id"`
	SuccessURL  string            `json:"success_url,omitempty"`
	RequestID   string            `json:"request_id,omitempty"`
	Customer    *customerEmailReq `json:"customer,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type CheckoutSession struct {
	ID          string `json:"id"`
	CheckoutURL string `json:"checkout_url"`
	ProductID   string `json:"product_id"`
	Status      string `json:"status"`
	ExpiresAt   string `json:"expires_at"`
}

func (c *Client) CreateCheckoutSession(ctx context.Context, in CreateCheckoutReq) (*CheckoutSession, error) {
	body := checkoutCreateBody{
		ProductID:  in.ProductID,
		SuccessURL: in.SuccessURL,
		RequestID:  in.RequestID,
		Metadata:   in.Metadata,
	}
	if in.CustomerEmail != "" {
		body.Customer = &customerEmailReq{Email: in.CustomerEmail}
	}
	var out CheckoutSession
	_, err := c.do(ctx, http.MethodPost, "/checkouts", body, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
