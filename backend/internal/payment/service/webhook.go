package service

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

type WebhookDTO struct {
	ID           string                 `json:"id"`
	EventID      string                 `json:"eventId"`
	EventType    string                 `json:"eventType"`
	Channel      string                 `json:"channel"`
	AppID        string                 `json:"appId"`
	AppName      string                 `json:"appName"`
	TargetURL    string                 `json:"targetUrl"`
	HTTPStatus   int                    `json:"httpStatus"`
	LatencyMs    int                    `json:"latencyMs"`
	Attempts     int                    `json:"attempts"`
	Timestamp    string                 `json:"timestamp"`
	Status       string                 `json:"status"`
	Payload      map[string]interface{} `json:"payload"`
	ResponseBody string                 `json:"responseBody"`
}

func (s *Service) ListWebhooks(ctx context.Context, page, pageSize int, channelID string) ([]WebhookDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := s.db.WithContext(ctx).Model(&persistence.PaymentWebhookLog{})
	if channelID != "" {
		q = q.Where("channel_id = ?", channelID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []persistence.PaymentWebhookLog
	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]WebhookDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toWebhookDTO(r))
	}
	return out, total, nil
}

func (s *Service) HandleCreemWebhook(ctx context.Context, channelID string, signature string, rawBody []byte) error {
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return err
	}
	if ch.WebhookSecret != "" && !creem.VerifySignature(ch.WebhookSecret, rawBody, signature) {
		return apperr.New(40102, 401, "Webhook 签名校验失败")
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return apperr.InvalidArgument
	}
	eventType, _ := payload["eventType"].(string)
	if eventType == "" {
		eventType, _ = payload["event"].(string)
	}
	if eventType == "" {
		eventType, _ = payload["type"].(string)
	}
	eventID, _ := payload["id"].(string)
	status := "DELIVERED"
	if eventType == "subscription.past_due" || eventType == "dispute.created" {
		status = "FAILED"
	}
	row := persistence.PaymentWebhookLog{
		ID:          uuid.NewString(),
		ChannelID:   channelID,
		EventID:     eventID,
		EventType:   eventType,
		Channel:     ch.ChannelKey,
		AppName:     ch.Name,
		TargetURL:   "/hooks/creem/" + channelID,
		HTTPStatus:  200,
		Status:      status,
		PayloadJSON: string(rawBody),
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return err
	}
	if err := s.UpsertTransactionFromWebhook(ctx, channelID, rawBody, payload, eventType); err != nil {
		return err
	}
	parsed, ok := creem.ParseWebhookTransaction(eventType, payload)
	if !ok {
		return nil
	}
	if err := s.UpsertRefundFromWebhook(ctx, channelID, parsed, rawBody); err != nil {
		return err
	}
	return s.UpsertChargebackFromWebhook(ctx, channelID, parsed)
}

func toWebhookDTO(r persistence.PaymentWebhookLog) WebhookDTO {
	payload := map[string]interface{}{}
	_ = json.Unmarshal([]byte(r.PayloadJSON), &payload)
	return WebhookDTO{
		ID:           r.ID,
		EventID:      r.EventID,
		EventType:    r.EventType,
		Channel:      r.Channel,
		AppID:        r.AppID,
		AppName:      r.AppName,
		TargetURL:    r.TargetURL,
		HTTPStatus:   r.HTTPStatus,
		LatencyMs:    r.LatencyMs,
		Attempts:     r.Attempts,
		Timestamp:    timex.FormatUTC(r.CreatedAt),
		Status:       r.Status,
		Payload:      payload,
		ResponseBody: r.ResponseBody,
	}
}

func ParsePage(c string, def int) int {
	n, err := strconv.Atoi(c)
	if err != nil || n < 1 {
		return def
	}
	return n
}
