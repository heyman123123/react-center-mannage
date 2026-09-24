package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
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
	filter := func(q *gorm.DB) *gorm.DB {
		if channelID != "" {
			q = q.Where("channel_id = ?", channelID)
		}
		return q
	}
	rows, total, err := s.shards.ListPaymentWebhooks(ctx, page, pageSize, filter)
	if err != nil {
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

func (s *Service) HandleCreemWebhook(ctx context.Context, channelID string, signature string, rawBody []byte, inboundPath string) error {
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return err
	}
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
	targetURL := strings.TrimSpace(inboundPath)
	if targetURL == "" {
		targetURL = "/api/v1/hooks/creem/" + channelID
	}

	existing, tbl, err := s.shards.FindPaymentWebhookByEventID(ctx, eventID)
	if err == nil {
		if webhookProcessingSucceeded(existing.Status) {
			return nil
		}
		return s.finalizeWebhookProcess(ctx, existing, tbl, channelID, rawBody, payload, eventType, true)
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
		TargetURL:   targetURL,
		HTTPStatus:  200,
		Attempts:    1,
		Status:      "PENDING",
		PayloadJSON: string(rawBody),
	}
	if err := s.shards.CreatePaymentWebhookLog(ctx, &row); err != nil {
		if isDuplicateKeyError(err) {
			again, againTbl, e := s.shards.FindPaymentWebhookByEventID(ctx, eventID)
			if e == nil {
				if webhookProcessingSucceeded(again.Status) {
					return nil
				}
				return s.finalizeWebhookProcess(ctx, again, againTbl, channelID, rawBody, payload, eventType, true)
			}
			return nil
		}
		return err
	}
	tbl = sharding.Table(sharding.BasePaymentWebhookLogs, sharding.MonthSuffixFromUnix(row.CreatedAt))
	return s.finalizeWebhookProcess(ctx, &row, tbl, channelID, rawBody, payload, eventType, false)
}

func (s *Service) finalizeWebhookProcess(
	ctx context.Context,
	row *persistence.PaymentWebhookLog,
	tbl string,
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
	if dbErr := s.shards.UpdatePaymentWebhook(ctx, tbl, row.ID, updates); dbErr != nil && err == nil {
		return dbErr
	}
	return err
}

func (s *Service) processCreemWebhookPayload(ctx context.Context, channelID string, rawBody []byte, payload map[string]interface{}, eventType string) error {
	// dispute 生命周期事件（resolved/updated）只驱动拒付状态机，不产生新交易流水。
	if eventType == "dispute.resolved" || eventType == "dispute.updated" {
		disputeID, resolution := parseDisputeResolution(payload)
		if eventType == "dispute.resolved" {
			if err := s.UpdateChargebackFromWebhook(ctx, channelID, disputeID, resolution); err != nil {
				return err
			}
		}
		return nil
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

// parseDisputeResolution 从 dispute.resolved 事件 payload 中提取 dispute id 与裁决结果（won/lost）。
func parseDisputeResolution(payload map[string]interface{}) (disputeID, resolution string) {
	obj, _ := payload["object"].(map[string]interface{})
	if obj == nil {
		return "", ""
	}
	disputeID = creemStringField(obj, "id")
	// 兼容多种裁决字段命名。
	resolution = creemStringField(obj, "resolution")
	if resolution == "" {
		resolution = creemStringField(obj, "outcome")
	}
	if resolution == "" {
		resolution = creemStringField(obj, "status")
	}
	resolution = strings.ToLower(strings.TrimSpace(resolution))
	switch resolution {
	case "won", "merchant_won", "accepted":
		return disputeID, "won"
	case "lost", "merchant_lost", "rejected":
		return disputeID, "lost"
	default:
		// 兜底：status 为 closed/resolved 且无明确字段时按 lost 处理（拒付默认对商户不利）。
		return disputeID, "lost"
	}
}

func creemStringField(m map[string]interface{}, key string) string {
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

func (s *Service) RedeliverWebhook(ctx context.Context, id string) error {
	row, tbl, err := s.shards.GetPaymentWebhookByID(ctx, id)
	if err != nil {
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
	return s.finalizeWebhookProcess(ctx, row, tbl, row.ChannelID, []byte(row.PayloadJSON), payload, eventType, true)
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
