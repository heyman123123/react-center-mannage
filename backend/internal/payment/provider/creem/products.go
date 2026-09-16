package creem

import (
	"context"
	"fmt"
	"net/http"
)

func (c *Client) ListProducts(ctx context.Context, page, pageSize int) ([]ProductEntity, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	path := fmt.Sprintf("/products/search?page=%d&page_size=%d", page, pageSize)
	var wrapper productListWrapper
	_, err := c.do(ctx, http.MethodGet, path, nil, &wrapper)
	if err != nil {
		return nil, err
	}
	if len(wrapper.Items) > 0 {
		return wrapper.Items, nil
	}
	return wrapper.Result.Items, nil
}
