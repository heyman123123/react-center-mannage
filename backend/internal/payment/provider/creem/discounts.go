package creem

import (
	"context"
	"fmt"
	"net/http"
)

type discountListWrapper struct {
	Result struct {
		Items []DiscountListItem `json:"items"`
	} `json:"result"`
	Items []DiscountListItem `json:"items"`
}

// DiscountListItem is the shape returned by Creem discount search.
type DiscountListItem struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Code               string   `json:"code"`
	Type               string   `json:"type"`
	Amount             *int     `json:"amount"`
	Percentage         *int     `json:"percentage"`
	Currency           string   `json:"currency"`
	ExpiryDate         string   `json:"expiry_date"`
	MaxRedemptions     *int     `json:"max_redemptions"`
	RedeemCount        int      `json:"redeem_count"`
	Duration           string   `json:"duration"`
	DurationInMonths   *int     `json:"duration_in_months"`
	AppliesToProducts  []string `json:"applies_to_products"`
	Status             string   `json:"status"`
}

func (c *Client) ListDiscounts(ctx context.Context, page, pageSize int) ([]DiscountListItem, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	path := fmt.Sprintf("/discounts/search?page_number=%d&page_size=%d", page, pageSize)
	var wrapper discountListWrapper
	_, err := c.do(ctx, http.MethodGet, path, nil, &wrapper)
	if err != nil {
		return nil, err
	}
	if len(wrapper.Items) > 0 {
		return wrapper.Items, nil
	}
	return wrapper.Result.Items, nil
}
