package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/platform/messaging/provider"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/crypto"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	shards  *sharding.Shards
	dataKey []byte
	resend  *provider.ResendClient
}

func NewService(db *gorm.DB, cfg *conf.Config, shards *sharding.Shards) *Service {
	key, _ := resolveDataKey(cfg)
	return &Service{db: db, shards: shards, dataKey: key, resend: provider.NewResendClient()}
}

type ChannelDTO struct {
	ID             string `json:"id"`
	ProviderKey    string `json:"providerKey"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Mode           string `json:"mode"`
	Enabled        bool   `json:"enabled"`
	IsPrimary      bool   `json:"isPrimary"`
	SenderEmail    string `json:"senderEmail"`
	SenderName     string `json:"senderName"`
	ApiKey         string `json:"apiKey"`
	SmtpHost       string `json:"smtpHost"`
	SmtpPort       int    `json:"smtpPort"`
	DailyQuota     int    `json:"dailyQuota"`
	SentToday      int    `json:"sentToday"`
	VerifiedDomain string `json:"verifiedDomain"`
	SpfDkimStatus  string `json:"spfDkimStatus"`
	LastTestedAt   string `json:"lastTestedAt"`
}

type ChannelInput struct {
	ProviderKey    string `json:"providerKey"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Mode           string `json:"mode"`
	Enabled        *bool  `json:"enabled"`
	SenderEmail    string `json:"senderEmail"`
	SenderName     string `json:"senderName"`
	ApiKey         string `json:"apiKey"`
	SmtpHost       string `json:"smtpHost"`
	SmtpPort       int    `json:"smtpPort"`
	DailyQuota     int    `json:"dailyQuota"`
	VerifiedDomain string `json:"verifiedDomain"`
	SpfDkimStatus  string `json:"spfDkimStatus"`
}

func (s *Service) ListChannels(ctx context.Context, mode string) ([]ChannelDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.EmailChannel{})
	if mode != "" && mode != "all" {
		q = q.Where("environment = ?", normalizeMode(mode))
	}
	var rows []persistence.EmailChannel
	if err := q.Order("is_primary DESC, created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ChannelDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, s.toChannelDTO(r))
	}
	return out, nil
}

func (s *Service) GetChannel(ctx context.Context, id string) (*ChannelDTO, error) {
	var row persistence.EmailChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	dto := s.toChannelDTO(row)
	return &dto, nil
}

func (s *Service) CreateChannel(ctx context.Context, in ChannelInput) (*ChannelDTO, error) {
	name := strings.TrimSpace(in.Name)
	email := strings.TrimSpace(in.SenderEmail)
	if name == "" || email == "" {
		return nil, apperr.InvalidArgument
	}
	providerKey := strings.TrimSpace(in.ProviderKey)
	if providerKey == "" {
		providerKey = "resend"
	}
	env := normalizeMode(in.Mode)
	apiKey := strings.TrimSpace(in.ApiKey)
	if apiKey == "" || isMaskedSecret(apiKey) {
		return nil, apperr.InvalidArgument
	}
	domain := strings.TrimSpace(in.VerifiedDomain)
	if domain == "" {
		parts := strings.Split(email, "@")
		if len(parts) == 2 {
			domain = parts[1]
		}
	}
	row := persistence.EmailChannel{
		ID:             uuid.NewString(),
		ProviderKey:    providerKey,
		Name:           name,
		Description:    strings.TrimSpace(in.Description),
		Environment:    env,
		Enabled:        true,
		SenderEmail:    email,
		SenderName:     strings.TrimSpace(in.SenderName),
		ApiKey:         s.sealSecret(apiKey),
		SmtpHost:       strings.TrimSpace(in.SmtpHost),
		SmtpPort:       defaultPort(in.SmtpPort, providerKey),
		DailyQuota:     defaultQuota(in.DailyQuota),
		VerifiedDomain: domain,
		SpfDkimStatus:  defaultStatus(in.SpfDkimStatus),
	}
	var count int64
	s.db.WithContext(ctx).Model(&persistence.EmailChannel{}).Where("environment = ?", env).Count(&count)
	if count == 0 {
		row.IsPrimary = true
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := s.toChannelDTO(row)
	return &dto, nil
}

func (s *Service) UpdateChannel(ctx context.Context, id string, in ChannelInput) (*ChannelDTO, error) {
	var row persistence.EmailChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
	}
	if in.Description != "" {
		updates["description"] = strings.TrimSpace(in.Description)
	}
	if in.Mode != "" {
		updates["environment"] = normalizeMode(in.Mode)
	}
	if in.Enabled != nil {
		updates["enabled"] = *in.Enabled
	}
	if email := strings.TrimSpace(in.SenderEmail); email != "" {
		updates["sender_email"] = email
	}
	if in.SenderName != "" {
		updates["sender_name"] = strings.TrimSpace(in.SenderName)
	}
	if key := strings.TrimSpace(in.ApiKey); key != "" && !isMaskedSecret(key) && !crypto.IsEncrypted(key) {
		updates["api_key"] = s.sealSecret(key)
	}
	if in.SmtpHost != "" {
		updates["smtp_host"] = strings.TrimSpace(in.SmtpHost)
	}
	if in.SmtpPort > 0 {
		updates["smtp_port"] = in.SmtpPort
	}
	if in.DailyQuota > 0 {
		updates["daily_quota"] = in.DailyQuota
	}
	if in.VerifiedDomain != "" {
		updates["verified_domain"] = strings.TrimSpace(in.VerifiedDomain)
	}
	if in.SpfDkimStatus != "" {
		updates["spf_dkim_status"] = in.SpfDkimStatus
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := s.toChannelDTO(row)
	return &dto, nil
}

func (s *Service) SetPrimary(ctx context.Context, id string) (*ChannelDTO, error) {
	var row persistence.EmailChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&persistence.EmailChannel{}).
			Where("environment = ?", row.Environment).
			Update("is_primary", false).Error; err != nil {
			return err
		}
		return tx.Model(&row).Update("is_primary", true).Error
	})
	if err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := s.toChannelDTO(row)
	return &dto, nil
}

func (s *Service) DeleteChannel(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.EmailChannel{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func (s *Service) SendTestEmail(ctx context.Context, id string, recipient string) (string, error) {
	recipient = strings.TrimSpace(recipient)
	if recipient == "" {
		return "", apperr.InvalidArgument
	}
	var row persistence.EmailChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return "", apperr.NotFound
	}
	if row.ProviderKey != "resend" {
		return "", apperr.ProviderNotSupported
	}
	subject := fmt.Sprintf("[NovasPay] 邮件渠道连通性测试 - %s", row.Name)
	html := fmt.Sprintf(`<p>这是一封来自 NovasPay 管理端的邮件渠道连通性测试。</p>
<p><strong>渠道：</strong>%s</p>
<p><strong>环境：</strong>%s</p>
<p><strong>发件人：</strong>%s &lt;%s&gt;</p>`, row.Name, row.Environment, row.SenderName, row.SenderEmail)
	msgID, err := s.resend.Send(ctx, provider.SendEmailInput{
		ApiKey:    s.openSecret(row.ApiKey),
		FromName:  row.SenderName,
		FromEmail: row.SenderEmail,
		To:        recipient,
		Subject:   subject,
		HTML:      html,
		Text:      "NovasPay 邮件渠道连通性测试",
	})
	if err != nil {
		return "", apperr.Wrap(50210, 502, "邮件发送失败: "+err.Error(), err)
	}
	now := time.Now().Unix()
	_ = s.db.WithContext(ctx).Model(&row).Updates(map[string]interface{}{
		"last_tested_at": now,
		"sent_today":     gorm.Expr("sent_today + 1"),
	})
	_ = s.shards.CreateEmailWebhookLog(ctx, &persistence.EmailWebhookLog{
		ID:           uuid.NewString(),
		MessageID:    msgID,
		EventType:    "email.accepted",
		Provider:     "resend",
		Recipient:    recipient,
		Subject:      subject,
		TemplateCode: "CHANNEL_TEST",
		Status:       "SUCCESS",
		Details:      "Resend 已接受发送请求（连通性测试，非投递确认）",
	}).Error
	return msgID, nil
}

func normalizeMode(mode string) string {
	m := strings.ToLower(strings.TrimSpace(mode))
	if m == "sandbox" || m == "test" {
		return "sandbox"
	}
	return "live"
}

func defaultPort(port int, providerKey string) int {
	if port > 0 {
		return port
	}
	switch providerKey {
	case "resend":
		return 465
	case "aws_ses":
		return 587
	default:
		return 587
	}
}

func defaultQuota(q int) int {
	if q > 0 {
		return q
	}
	return 50000
}

func defaultStatus(s string) string {
	if s != "" {
		return s
	}
	return "PENDING"
}

func (s *Service) maskApiKey(stored string) string {
	stored = strings.TrimSpace(stored)
	if stored == "" {
		return ""
	}
	plain := s.openSecret(stored)
	if crypto.IsEncrypted(plain) {
		// Decrypt failed / still ciphertext — never leak suffix.
		return "********"
	}
	if strings.HasPrefix(plain, "re_") {
		return "re_****"
	}
	if len(plain) >= 4 {
		return "****" + plain[len(plain)-4:]
	}
	return "****"
}

func (s *Service) toChannelDTO(r persistence.EmailChannel) ChannelDTO {
	lastTested := ""
	if r.LastTestedAt != nil {
		lastTested = timex.FormatUTC(*r.LastTestedAt)
	}
	return ChannelDTO{
		ID:             r.ID,
		ProviderKey:    r.ProviderKey,
		Name:           r.Name,
		Description:    r.Description,
		Mode:           r.Environment,
		Enabled:        r.Enabled,
		IsPrimary:      r.IsPrimary,
		SenderEmail:    r.SenderEmail,
		SenderName:     r.SenderName,
		ApiKey:         s.maskApiKey(r.ApiKey),
		SmtpHost:       r.SmtpHost,
		SmtpPort:       r.SmtpPort,
		DailyQuota:     r.DailyQuota,
		SentToday:      r.SentToday,
		VerifiedDomain: r.VerifiedDomain,
		SpfDkimStatus:  r.SpfDkimStatus,
		LastTestedAt:   lastTested,
	}
}
