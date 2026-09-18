package service

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
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

func webhookProcessingSucceeded(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "DELIVERED", "SUCCESS":
		return true
	default:
		return false
	}
}

func (s *Service) HandleCreemWebhook(ctx context.Context, channelID string, signature string, rawBody []byte) error {
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return err
	}
	// Empty webhook secret must reject — never accept unsigned callbacks.
	if strings.TrimSpace(ch.WebhookSecret) == "" || !creem.VerifySignature(ch.WebhookSecret, rawBody, signature) {
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
	if eventID == "" {
		eventID = uuid.NewString()
	}

	var existing persistence.PaymentWebhookLog
	err = s.db.WithContext(ctx).Where("event_id = ?", eventID).First(&existing).Error
	if err == nil {
		// Only short-circuit successful processing; FAILED/PENDING may be redelivered.
		if webhookProcessingSucceeded(existing.Status) {
			return nil
		}
		return s.finalizeWebhookProcess(ctx, &existing, channelID, rawBody, payload, eventType, true)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
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
		Attempts:    1,
		Status:      "PENDING",
		PayloadJSON: string(rawBody),
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		if isDuplicateKeyError(err) {
			var again persistence.PaymentWebhookLog
			if e := s.db.WithContext(ctx).Where("event_id = ?", eventID).First(&again).Error; e == nil {
				if webhookProcessingSucceeded(again.Status) {
					return nil
				}
				return s.finalizeWebhookProcess(ctx, &again, channelID, rawBody, payload, eventType, true)
			}
			return nil
		}
		return err
	}
	// First attempt already counted on insert; only bump on redelivery.
	return s.finalizeWebhookProcess(ctx, &row, channelID, rawBody, payload, eventType, false)
}

func (s *Service) finalizeWebhookProcess(
	ctx context.Context,
	row *persistence.PaymentWebhookLog,
	channelID string,
	rawBody []byte,
	payload map[string]interface{},
	eventType string,
	bumpAttempt bool,
) error {
	start := time.Now()
	err := s.processCreemWebhookPayload(ctx, channelID, rawBody, payload, eventType)
	latency := int(time.Since(start).Milliseconds())
	status := "DELIVERED"
	if err != nil {
		status = "FAILED"
	}
	updates := map[string]interface{}{
		"status":      status,
		"latency_ms":  latency,
		"http_status": 200,
	}
	if bumpAttempt {
		updates["attempts"] = row.Attempts + 1
	}
	if eventType != "" {
		updates["event_type"] = eventType
	}
	if len(rawBody) > 0 {
		updates["payload_json"] = string(rawBody)
	}
	if dbErr := s.db.WithContext(ctx).Model(row).Updates(updates).Error; dbErr != nil && err == nil {
		return dbErr
	}
	return err
}

func (s *Service) processCreemWebhookPayload(ctx context.Context, channelID string, rawBody []byte, payload map[string]interface{}, eventType string) error {
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

func (s *Service) RedeliverWebhook(ctx context.Context, id string) error {
	var row persistence.PaymentWebhookLog
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	payload := map[string]interface{}{}
	if err := json.Unmarshal([]byte(row.PayloadJSON), &payload); err != nil {
		return apperr.InvalidArgument
	}
	eventType := row.EventType
	if eventType == "" {
		eventType, _ = payload["eventType"].(string)
	}
	if eventType == "" {
		eventType, _ = payload["event"].(string)
	}
	if eventType == "" {
		eventType, _ = payload["type"].(string)
	}
	return s.finalizeWebhookProcess(ctx, &row, row.ChannelID, []byte(row.PayloadJSON), payload, eventType, true)
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

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unique constraint")
}

func ParsePage(c string, def int) int {
	n, err := strconv.Atoi(c)
	if err != nil || n < 1 {
		return def
	}
	return n
}
