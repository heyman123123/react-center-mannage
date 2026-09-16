package creem

import (
	"context"
	"net/http"
)

type CreateRefundReq struct {
	TransactionID string `json:"transaction_id"`
	Amount        *int64 `json:"amount,omitempty"`
}

type RefundEntity struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func (c *Client) CreateRefund(ctx context.Context, transactionID string, amountCents int64) (*RefundEntity, error) {
	req := CreateRefundReq{TransactionID: transactionID}
	if amountCents > 0 {
		req.Amount = &amountCents
	}
	var out RefundEntity
	_, err := c.do(ctx, http.MethodPost, "/refunds", req, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
