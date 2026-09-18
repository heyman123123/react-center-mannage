package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type TimelineStepDTO struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Timestamp   string `json:"timestamp"`
	Status      string `json:"status"`
	Actor       string `json:"actor"`
	LatencyMs   int    `json:"latencyMs,omitempty"`
}

type TransactionDTO struct {
	ID              string            `json:"id"`
	TenantID        string            `json:"tenantId"`
	ChannelID       string            `json:"channelId"`
	Channel         string            `json:"channel"`
	OrderTitle      string            `json:"orderTitle"`
	OrderNumber     string            `json:"orderNumber"`
	OrderAmount     float64           `json:"orderAmount"`
	ChannelFee      float64           `json:"channelFee"`
	NetAmount       float64           `json:"netAmount"`
	Currency        string            `json:"currency"`
	ChannelTradeNo  string            `json:"channelTradeNo"`
	MerchantName    string            `json:"merchantName"`
	CustomerEmail   string            `json:"customerEmail"`
	CustomerName    string            `json:"customerName"`
	CustomerCountry string            `json:"customerCountry"`
	PaymentMethod   string            `json:"paymentMethod"`
	Status          string            `json:"status"`
	EventType       string            `json:"eventType"`
	ProductID       string            `json:"productId"`
	ProductName     string            `json:"productName"`
	SubscriptionID  string            `json:"subscriptionId"`
	CreatedAt       string            `json:"createdAt"`
	Timeline        []TimelineStepDTO `json:"timeline,omitempty"`
}

func (s *Service) ListTransactions(ctx context.Context, page, pageSize int, tenantID, channel, status, keyword string) ([]TransactionDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	filter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL")
		if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
			q = q.Where("tenant_id = ?", tenantID)
		}
		if ch := strings.TrimSpace(channel); ch != "" && ch != "all" {
			q = q.Where("channel = ?", ch)
		}
		if st := strings.TrimSpace(status); st != "" && st != "all" {
			q = q.Where("status = ?", st)
		}
		if kw := strings.TrimSpace(keyword); kw != "" {
			like := "%" + kw + "%"
			q = q.Where(
				"id ILIKE ? OR display_id ILIKE ? OR order_title ILIKE ? OR channel_trade_no ILIKE ? OR order_number ILIKE ? OR customer_email ILIKE ?",
				like, like, like, like, like, like,
			)
		}
		return q
	}
	rows, total, err := s.shards.ListPaymentTransactions(ctx, page, pageSize, filter)
	if err != nil {
		return nil, 0, err
	}
	channelNames := s.loadChannelNames(ctx, rows)
	out := make([]TransactionDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toTransactionDTO(r, channelNames[r.ChannelID], false))
	}
	return out, total, nil
}

func (s *Service) GetTransaction(ctx context.Context, id string) (*TransactionDTO, error) {
	row, _, err := s.shards.GetPaymentTransaction(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	names := s.loadChannelNames(ctx, []persistence.PaymentTransaction{*row})
	dto := toTransactionDTO(*row, names[row.ChannelID], true)
	return &dto, nil
}

func (s *Service) UpsertTransactionFromWebhook(ctx context.Context, channelID string, rawBody []byte, payload map[string]interface{}, eventType string) error {
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return err
	}
	parsed, ok := creem.ParseWebhookTransaction(eventType, payload)
	if !ok {
		return nil
	}
	tenantID := ch.TenantID
	if tenantID == "" || tenantID == "ALL" {
		tenantID = "group_hq"
	}

	existing, err := s.shards.FindPaymentTransactionByChannelEvent(ctx, channelID, parsed.ExternalEventID)
	if err == nil && existing != nil {
		return nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	timeline := buildTimeline(parsed, ch.Name)
	timelineJSON, _ := json.Marshal(timeline)
	netCents := parsed.OrderAmountCents - parsed.OrderAmountCents*3/100
	if netCents < 0 {
		netCents = parsed.OrderAmountCents
	}
	displayID := fmt.Sprintf("TX-%s-%06d", time.Unix(parsed.CreatedAt, 0).UTC().Format("20060102"), rand.Intn(900000)+100000)
	row := persistence.PaymentTransaction{
		ID:               uuid.NewString(),
		DisplayID:        displayID,
		ChannelID:        channelID,
		TenantID:         tenantID,
		Channel:          ch.ChannelKey,
		ExternalEventID:  parsed.ExternalEventID,
		ChannelTradeNo:   parsed.ChannelTradeNo,
		OrderNumber:      parsed.OrderNumber,
		OrderTitle:       parsed.OrderTitle,
		OrderAmountCents: parsed.OrderAmountCents,
		ChannelFeeCents:  parsed.OrderAmountCents * 3 / 100,
		NetAmountCents:   netCents,
		Currency:         parsed.Currency,
		Status:           parsed.Status,
		CustomerEmail:    parsed.CustomerEmail,
		CustomerName:     parsed.CustomerName,
		CustomerCountry:  parsed.CustomerCountry,
		PaymentMethod:    parsed.PaymentMethod,
		ProductID:        parsed.ProductID,
		ProductName:      parsed.ProductName,
		SubscriptionID:   parsed.SubscriptionID,
		EventType:        parsed.EventType,
		TimelineJSON:     string(timelineJSON),
		RawPayloadJSON:   string(rawBody),
	}
	if parsed.CreatedAt > 0 {
		row.CreatedAt = parsed.CreatedAt
	}
	return s.shards.CreatePaymentTransaction(ctx, &row)
}

func (s *Service) loadChannelNames(ctx context.Context, rows []persistence.PaymentTransaction) map[string]string {
	ids := make([]string, 0, len(rows))
	seen := map[string]bool{}
	for _, r := range rows {
		if r.ChannelID != "" && !seen[r.ChannelID] {
			seen[r.ChannelID] = true
			ids = append(ids, r.ChannelID)
		}
	}
	out := map[string]string{}
	if len(ids) == 0 {
		return out
	}
	var channels []persistence.PaymentChannel
	_ = s.db.WithContext(ctx).Where("id IN ?", ids).Find(&channels).Error
	for _, ch := range channels {
		out[ch.ID] = ch.Name
	}
	return out
}

func toTransactionDTO(r persistence.PaymentTransaction, merchantName string, withTimeline bool) TransactionDTO {
	dto := TransactionDTO{
		ID:              r.DisplayID,
		TenantID:        r.TenantID,
		ChannelID:       r.ChannelID,
		Channel:         r.Channel,
		OrderTitle:      r.OrderTitle,
		OrderNumber:     r.OrderNumber,
		OrderAmount:     float64(r.OrderAmountCents) / 100,
		ChannelFee:      float64(r.ChannelFeeCents) / 100,
		NetAmount:       float64(r.NetAmountCents) / 100,
		Currency:        r.Currency,
		ChannelTradeNo:  r.ChannelTradeNo,
		MerchantName:    merchantName,
		CustomerEmail:   r.CustomerEmail,
		CustomerName:    r.CustomerName,
		CustomerCountry: r.CustomerCountry,
		PaymentMethod:   r.PaymentMethod,
		Status:          r.Status,
		EventType:       r.EventType,
		ProductID:       r.ProductID,
		ProductName:     r.ProductName,
		SubscriptionID:  r.SubscriptionID,
		CreatedAt:       timex.FormatUTC(r.CreatedAt),
	}
	if withTimeline {
		var steps []TimelineStepDTO
		_ = json.Unmarshal([]byte(r.TimelineJSON), &steps)
		dto.Timeline = steps
	}
	return dto
}

func buildTimeline(parsed *creem.ParsedTransaction, channelName string) []TimelineStepDTO {
	ts := timex.FormatUTC(parsed.CreatedAt)
	return []TimelineStepDTO{
		{
			ID:          "step_1",
			Title:       "Creem Webhook 事件接收",
			Description: parsed.EventType + " · " + parsed.ChannelTradeNo,
			Timestamp:   ts,
			Status:      "completed",
			Actor:       channelName,
		},
		{
			ID:          "step_2",
			Title:       "交易流水入库",
			Description: parsed.OrderTitle,
			Timestamp:   ts,
			Status:      mapTimelineStatus(parsed.Status),
			Actor:       "NovasPay 聚合中台",
		},
	}
}

func mapTimelineStatus(status string) string {
	if status == "done" {
		return "completed"
	}
	if status == "discrepancy" {
		return "failed"
	}
	return "in_progress"
}
