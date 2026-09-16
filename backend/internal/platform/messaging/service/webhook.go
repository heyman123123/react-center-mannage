package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

type WebhookDTO struct {
	ID           string `json:"id"`
	MessageID    string `json:"messageId"`
	EventType    string `json:"eventType"`
	Provider     string `json:"provider"`
	Recipient    string `json:"recipient"`
	Subject      string `json:"subject"`
	TemplateCode string `json:"templateCode"`
	Timestamp    string `json:"timestamp"`
	IP           string `json:"ip"`
	UserAgent    string `json:"userAgent"`
	Status       string `json:"status"`
	Details      string `json:"details"`
}

func (s *Service) ListWebhooks(ctx context.Context, page, pageSize int, keyword, eventType string) ([]WebhookDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := s.db.WithContext(ctx).Model(&persistence.EmailWebhookLog{})
	if kw := strings.TrimSpace(keyword); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("recipient ILIKE ? OR subject ILIKE ? OR message_id ILIKE ?", like, like, like)
	}
	if et := strings.TrimSpace(eventType); et != "" && et != "ALL" {
		q = q.Where("event_type = ?", et)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []persistence.EmailWebhookLog
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

func toWebhookDTO(r persistence.EmailWebhookLog) WebhookDTO {
	return WebhookDTO{
		ID:           r.ID,
		MessageID:    r.MessageID,
		EventType:    r.EventType,
		Provider:     r.Provider,
		Recipient:    r.Recipient,
		Subject:      r.Subject,
		TemplateCode: r.TemplateCode,
		Timestamp:    timex.FormatUTC(r.CreatedAt),
		IP:           r.IP,
		UserAgent:    r.UserAgent,
		Status:       r.Status,
		Details:      r.Details,
	}
}

func ParsePage(c string, def int) int {
	n, err := strconv.Atoi(c)
	if err != nil || n < 1 {
		return def
	}
	return n
}
