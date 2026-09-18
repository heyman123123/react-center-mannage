package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/platform/messaging/provider"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

// Payment email event → template category.
var eventCategory = map[string]string{
	"subscription_welcome_receipt": "BILLING",
	"recurring_renewal_success":    "BILLING",
	"payment_failed_dunning":       "RISK",
	"subscription_canceled_notice": "LIFECYCLE",
	"security_password_reset":      "SECURITY",
}

var allPaymentEmailEvents = []string{
	"subscription_welcome_receipt",
	"recurring_renewal_success",
	"payment_failed_dunning",
	"subscription_canceled_notice",
	"security_password_reset",
}

type DispatchInput struct {
	Event     string            `json:"event"`
	To        string            `json:"to"`
	Language  string            `json:"language"`
	Variables map[string]string `json:"variables"`
}

type DispatchResult struct {
	MessageID    string `json:"messageId"`
	TemplateCode string `json:"templateCode"`
	ChannelID    string `json:"channelId"`
}

// FindAppIDBySecret resolves payment_apps.data_json.secretKey → app id.
func (s *Service) FindAppIDBySecret(ctx context.Context, secretKey string) (string, error) {
	secretKey = strings.TrimSpace(secretKey)
	if secretKey == "" {
		return "", apperr.Unauthorized
	}
	var row persistence.PaymentApp
	err := s.db.WithContext(ctx).
		Where("data_json->>'secretKey' = ?", secretKey).
		First(&row).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", apperr.Unauthorized
		}
		return "", err
	}
	return row.ID, nil
}

func (s *Service) Dispatch(ctx context.Context, appID string, in DispatchInput) (*DispatchResult, error) {
	event := strings.TrimSpace(in.Event)
	to := strings.TrimSpace(in.To)
	if event == "" || to == "" {
		return nil, apperr.InvalidArgument
	}
	category, ok := eventCategory[event]
	if !ok {
		return nil, apperr.InvalidArgument
	}

	var appRow persistence.PaymentApp
	if err := s.db.WithContext(ctx).First(&appRow, "id = ?", appID).Error; err != nil {
		return nil, apperr.Unauthorized
	}
	var app map[string]interface{}
	if err := json.Unmarshal([]byte(appRow.DataJSON), &app); err != nil {
		return nil, apperr.Internal
	}

	if !eventEnabled(app, event) {
		return nil, apperr.EventNotEnabled
	}

	lang := strings.TrimSpace(in.Language)
	if lang == "" {
		lang = stringField(app, "defaultLanguage")
	}
	if lang == "" {
		lang = "en-US"
	}

	tpl, err := s.resolveTemplate(ctx, event, category, lang)
	if err != nil {
		return nil, err
	}

	channelID := stringField(app, "emailChannelId")
	if channelID == "" {
		return nil, apperr.EmailChannelMissing
	}
	var channel persistence.EmailChannel
	if err := s.db.WithContext(ctx).First(&channel, "id = ?", channelID).Error; err != nil {
		return nil, apperr.EmailChannelMissing
	}
	if !channel.Enabled {
		return nil, apperr.EmailChannelMissing
	}
	if channel.ProviderKey != "resend" {
		return nil, apperr.ProviderNotSupported
	}

	vars := in.Variables
	if vars == nil {
		vars = map[string]string{}
	}
	if _, ok := vars["app_name"]; !ok {
		if name := stringField(app, "name"); name != "" {
			vars["app_name"] = name
		}
	}

	subject := interpolate(tpl.Subject, vars)
	html := interpolate(tpl.ContentMarkdown, vars)
	preview := interpolate(tpl.PreviewText, vars)

	fromName := stringField(app, "senderName")
	fromEmail := stringField(app, "senderEmail")
	if fromName == "" {
		fromName = channel.SenderName
	}
	if fromEmail == "" {
		fromEmail = channel.SenderEmail
	}
	if fromName == "" && tpl.SenderName != "" {
		fromName = tpl.SenderName
	}
	if fromEmail == "" && tpl.SenderEmail != "" {
		fromEmail = tpl.SenderEmail
	}

	msgID, sendErr := s.resend.Send(ctx, provider.SendEmailInput{
		ApiKey:    s.upgradeSecretIfPlain(channel.ID, channel.ApiKey),
		FromName:  fromName,
		FromEmail: fromEmail,
		To:        to,
		Subject:   subject,
		HTML:      html,
		Text:      preview,
	})

	status := "SUCCESS"
	details := fmt.Sprintf("dispatch event=%s app=%s", event, appID)
	eventType := "email.delivered"
	if sendErr != nil {
		status = "FAILED"
		eventType = "email.failed"
		details = "dispatch failed: " + sendErr.Error()
		_ = s.shards.CreateEmailWebhookLog(ctx, &persistence.EmailWebhookLog{
			ID:           uuid.NewString(),
			MessageID:    "",
			EventType:    eventType,
			Provider:     channel.ProviderKey,
			Recipient:    to,
			Subject:      subject,
			TemplateCode: tpl.Code,
			Status:       status,
			Details:      details,
		}).Error
		return nil, apperr.Wrap(50210, 502, "邮件发送失败: "+sendErr.Error(), sendErr)
	}

	_ = s.db.WithContext(ctx).Model(&channel).Updates(map[string]interface{}{
		"sent_today": gorm.Expr("sent_today + 1"),
	}).Error
	_ = s.shards.CreateEmailWebhookLog(ctx, &persistence.EmailWebhookLog{
		ID:           uuid.NewString(),
		MessageID:    msgID,
		EventType:    eventType,
		Provider:     channel.ProviderKey,
		Recipient:    to,
		Subject:      subject,
		TemplateCode: tpl.Code,
		Status:       status,
		Details:      details,
	}).Error

	return &DispatchResult{
		MessageID:    msgID,
		TemplateCode: tpl.Code,
		ChannelID:    channel.ID,
	}, nil
}

func (s *Service) resolveTemplate(ctx context.Context, event, category, lang string) (*persistence.EmailTemplate, error) {
	var tpl persistence.EmailTemplate
	err := s.db.WithContext(ctx).
		Where("status = ? AND trigger_event = ? AND language = ?", "ACTIVE", event, lang).
		Order("updated_at DESC").
		First(&tpl).Error
	if err == nil {
		return &tpl, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	code := "DEFAULT_" + category + "_EN"
	err = s.db.WithContext(ctx).
		Where("code = ? AND status = ?", code, "ACTIVE").
		First(&tpl).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperr.TemplateMissing
		}
		return nil, err
	}
	return &tpl, nil
}

func eventEnabled(app map[string]interface{}, event string) bool {
	raw, ok := app["enabledEmailEvents"]
	if !ok || raw == nil {
		return true // missing → all enabled
	}
	list, ok := raw.([]interface{})
	if !ok {
		if strs, ok2 := raw.([]string); ok2 {
			if len(strs) == 0 {
				return true
			}
			for _, e := range strs {
				if e == event {
					return true
				}
			}
			return false
		}
		return true
	}
	if len(list) == 0 {
		return true
	}
	for _, item := range list {
		if s, ok := item.(string); ok && s == event {
			return true
		}
	}
	return false
}

func stringField(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func interpolate(text string, vars map[string]string) string {
	if text == "" || len(vars) == 0 {
		return text
	}
	out := text
	for k, v := range vars {
		out = strings.ReplaceAll(out, "{{"+k+"}}", v)
	}
	return out
}

// AllPaymentEmailEvents exposes the canonical event list for seeds/tests.
func AllPaymentEmailEvents() []string {
	out := make([]string, len(allPaymentEmailEvents))
	copy(out, allPaymentEmailEvents)
	return out
}
