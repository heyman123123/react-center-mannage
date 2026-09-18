package service

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	shards  *sharding.Shards
	dataKey []byte
}

func NewService(db *gorm.DB, cfg *conf.Config, shards *sharding.Shards) *Service {
	key, _ := resolveDataKey(cfg)
	return &Service{db: db, shards: shards, dataKey: key}
}

type ChannelDTO struct {
	ID                string   `json:"id"`
	ChannelKey        string   `json:"channelKey"`
	Name              string   `json:"name"`
	AccountName       string   `json:"accountName"`
	Description       string   `json:"description"`
	Mode              string   `json:"mode"`
	Enabled           bool     `json:"enabled"`
	ApiPublicKey      string   `json:"apiPublicKey"`
	ApiSecretKey      string   `json:"apiSecretKey"`
	WebhookSecret     string   `json:"webhookSecret"`
	SupportedCurrencies []string `json:"supportedCurrencies"`
	FeeRateText       string   `json:"feeRateText"`
	RoutingPriority   int      `json:"routingPriority"`
	FallbackChannelID *string  `json:"fallbackChannelId"`
	TenantID          string   `json:"tenantId"`
	TestStatus        string   `json:"testStatus"`
	HealthStatus      string   `json:"healthStatus"`
	LatencyMs         int      `json:"latencyMs"`
	LastTestedAt      string   `json:"lastTestedAt"`
	LastHealthAt      string   `json:"lastHealthAt"`
}

type ChannelInput struct {
	ChannelKey          string   `json:"channelKey"`
	Name                string   `json:"name"`
	AccountName         string   `json:"accountName"`
	Description         string   `json:"description"`
	Mode                string   `json:"mode"`
	Enabled             *bool    `json:"enabled"`
	ApiSecretKey        string   `json:"apiSecretKey"`
	ApiPublicKey        string   `json:"apiPublicKey"`
	WebhookSecret       string   `json:"webhookSecret"`
	SupportedCurrencies []string `json:"supportedCurrencies"`
	FeeRateText         string   `json:"feeRateText"`
	RoutingPriority     *int     `json:"routingPriority"`
	FallbackChannelID   *string  `json:"fallbackChannelId"`
	TenantID            string   `json:"tenantId"`
}

func (s *Service) List(ctx context.Context, mode, channelKey string) ([]ChannelDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentChannel{})
	if m := normalizeMode(mode); m != "" && m != "all" {
		q = q.Where("environment = ?", m)
	}
	if ck := strings.TrimSpace(channelKey); ck != "" && ck != "all" {
		q = q.Where("channel_key = ?", ck)
	}
	var rows []persistence.PaymentChannel
	if err := q.Order("routing_priority ASC, created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ChannelDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toChannelDTO(r))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id string) (*ChannelDTO, error) {
	var row persistence.PaymentChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	dto := toChannelDTO(row)
	return &dto, nil
}

func (s *Service) Create(ctx context.Context, in ChannelInput) (*ChannelDTO, error) {
	key := strings.TrimSpace(in.ChannelKey)
	if key == "" {
		key = "creem"
	}
	name := strings.TrimSpace(in.Name)
	secret := strings.TrimSpace(in.ApiSecretKey)
	if name == "" || secret == "" {
		return nil, apperr.InvalidArgument
	}
	webhookPlain := strings.TrimSpace(in.WebhookSecret)
	if strings.EqualFold(key, "creem") && webhookPlain == "" {
		return nil, apperr.New(42200, 422, "Creem 渠道必须配置 Webhook Secret")
	}
	currenciesJSON, _ := json.Marshal(defaultCurrencies(in.SupportedCurrencies))
	priority := 1
	if in.RoutingPriority != nil {
		priority = *in.RoutingPriority
	}
	tenantID := strings.TrimSpace(in.TenantID)
	if tenantID == "" {
		tenantID = "ALL"
	}
	webhookSecret := s.sealSecret(webhookPlain)
	sealedSecret := s.sealSecret(secret)
	row := persistence.PaymentChannel{
		ID:                      uuid.NewString(),
		ChannelKey:              key,
		Name:                    name,
		AccountName:             strings.TrimSpace(in.AccountName),
		Description:             strings.TrimSpace(in.Description),
		Environment:             normalizeMode(in.Mode),
		Enabled:                 true,
		ApiKey:                  sealedSecret,
		ApiPublicKey:            strings.TrimSpace(in.ApiPublicKey),
		ApiSecretKey:            sealedSecret,
		WebhookSecret:           webhookSecret,
		SupportedCurrenciesJSON: string(currenciesJSON),
		FeeRateText:             strings.TrimSpace(in.FeeRateText),
		RoutingPriority:         priority,
		FallbackChannelID:       in.FallbackChannelID,
		TenantID:                tenantID,
		TestStatus:              "DOWN",
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := toChannelDTO(row)
	return &dto, nil
}

func (s *Service) Update(ctx context.Context, id string, in ChannelInput) (*ChannelDTO, error) {
	var row persistence.PaymentChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
	}
	if in.AccountName != "" {
		updates["account_name"] = strings.TrimSpace(in.AccountName)
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
	if secret := strings.TrimSpace(in.ApiSecretKey); secret != "" && !strings.Contains(secret, "****") {
		sealed := s.sealSecret(secret)
		updates["api_key"] = sealed
		updates["api_secret_key"] = sealed
	}
	if pub := strings.TrimSpace(in.ApiPublicKey); pub != "" && !strings.Contains(pub, "****") {
		updates["api_public_key"] = pub
	}
	if wh := strings.TrimSpace(in.WebhookSecret); wh != "" && !strings.Contains(wh, "****") {
		updates["webhook_secret"] = s.sealSecret(wh)
	}
	if in.SupportedCurrencies != nil {
		currenciesJSON, _ := json.Marshal(defaultCurrencies(in.SupportedCurrencies))
		updates["supported_currencies_json"] = string(currenciesJSON)
	}
	if in.FeeRateText != "" {
		updates["fee_rate_text"] = in.FeeRateText
	}
	if in.RoutingPriority != nil {
		updates["routing_priority"] = *in.RoutingPriority
	}
	if in.FallbackChannelID != nil {
		updates["fallback_channel_id"] = in.FallbackChannelID
	}
	if in.TenantID != "" {
		updates["tenant_id"] = strings.TrimSpace(in.TenantID)
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}

	// Refuse enabling Creem without a webhook secret (existing or newly provided).
	willEnable := row.Enabled
	if in.Enabled != nil {
		willEnable = *in.Enabled
	}
	if willEnable && strings.EqualFold(row.ChannelKey, "creem") {
		whPlain := s.openSecret(row.WebhookSecret)
		if wh := strings.TrimSpace(in.WebhookSecret); wh != "" && !strings.Contains(wh, "****") {
			whPlain = wh
		}
		if strings.TrimSpace(whPlain) == "" {
			return nil, apperr.New(42200, 422, "启用 Creem 渠道前必须配置 Webhook Secret")
		}
	}

	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := toChannelDTO(row)
	return &dto, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.PaymentChannel{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func (s *Service) Test(ctx context.Context, id string) (*ChannelDTO, error) {
	var row persistence.PaymentChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if row.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	ch := s.decryptChannel(&row)
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	latency, err := client.Ping(ctx)
	now := time.Now().Unix()
	status := "HEALTHY"
	if err != nil {
		status = "DOWN"
	}
	_ = s.db.WithContext(ctx).Model(&row).Updates(map[string]interface{}{
		"test_status":    status,
		"latency_ms":     latency,
		"last_tested_at": now,
	}).Error
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	if err != nil {
		return nil, apperr.Wrap(50210, 502, "渠道连通性测试失败: "+err.Error(), err)
	}
	dto := toChannelDTO(row)
	return &dto, nil
}

func (s *Service) GetRawChannel(ctx context.Context, id string) (*persistence.PaymentChannel, error) {
	var row persistence.PaymentChannel
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	return s.decryptChannel(&row), nil
}

type CheckoutTestInput struct {
	ProductID     string `json:"productId"`
	CustomerEmail string `json:"customerEmail"`
	SuccessURL    string `json:"successUrl"`
}

type CheckoutTestResult struct {
	CheckoutURL string `json:"checkoutUrl"`
	SessionID   string `json:"sessionId"`
	ExpiresAt   string `json:"expiresAt"`
}

func (s *Service) CheckAllChannelsHealth(ctx context.Context) error {
	var rows []persistence.PaymentChannel
	if err := s.db.WithContext(ctx).Where("enabled = ?", true).Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if err := s.pingChannelHealth(ctx, &row); err != nil {
			log.Printf("channel %s health check: %v", row.ID, err)
		}
	}
	return nil
}

func (s *Service) pingChannelHealth(ctx context.Context, row *persistence.PaymentChannel) error {
	now := time.Now().Unix()
	status := "UNKNOWN"
	latency := 0
	if row.ChannelKey == "creem" {
		ch := s.decryptChannel(row)
		client := creem.NewClient(ch.Environment, ch.ApiKey)
		pingLatency, err := client.Ping(ctx)
		latency = pingLatency
		if err == nil {
			status = "HEALTHY"
		} else {
			status = "DOWN"
		}
	}
	return s.db.WithContext(ctx).Model(row).Updates(map[string]interface{}{
		"health_status":  status,
		"last_health_at": now,
		"latency_ms":     latency,
	}).Error
}

func (s *Service) CreateCheckoutTest(ctx context.Context, channelID string, in CheckoutTestInput) (*CheckoutTestResult, error) {
	productID := strings.TrimSpace(in.ProductID)
	if productID == "" {
		return nil, apperr.InvalidArgument
	}
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if ch.ChannelKey != "creem" {
		return nil, apperr.ProviderNotSupported
	}
	if strings.TrimSpace(ch.ApiKey) == "" {
		return nil, apperr.New(42212, 422, "渠道未配置 API Secret")
	}
	client := creem.NewClient(ch.Environment, ch.ApiKey)
	session, err := client.CreateCheckoutSession(ctx, creem.CreateCheckoutReq{
		ProductID:     productID,
		CustomerEmail: strings.TrimSpace(in.CustomerEmail),
		SuccessURL:    strings.TrimSpace(in.SuccessURL),
	})
	if err != nil {
		return nil, apperr.Wrap(50212, 502, "Creem Checkout 创建失败", err)
	}
	return &CheckoutTestResult{
		CheckoutURL: session.CheckoutURL,
		SessionID:   session.ID,
		ExpiresAt:   session.ExpiresAt,
	}, nil
}

func normalizeMode(mode string) string {
	m := strings.ToLower(strings.TrimSpace(mode))
	if m == "sandbox" || m == "test" {
		return "sandbox"
	}
	if m == "all" || m == "" {
		return m
	}
	return "live"
}

func defaultCurrencies(c []string) []string {
	if len(c) == 0 {
		return []string{"USD"}
	}
	return c
}

func maskKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	// Never leak encrypted ciphertext prefixes/suffixes in API responses.
	if strings.HasPrefix(key, "enc:") {
		return "********"
	}
	if len(key) <= 4 {
		return "****"
	}
	return "****" + key[len(key)-4:]
}

func toChannelDTO(r persistence.PaymentChannel) ChannelDTO {
	currencies := []string{}
	_ = json.Unmarshal([]byte(r.SupportedCurrenciesJSON), &currencies)
	lastTested := ""
	if r.LastTestedAt != nil {
		lastTested = timex.FormatUTC(*r.LastTestedAt)
	}
	lastHealth := ""
	if r.LastHealthAt != nil {
		lastHealth = timex.FormatUTC(*r.LastHealthAt)
	}
	healthStatus := r.HealthStatus
	if healthStatus == "" {
		healthStatus = "UNKNOWN"
	}
	return ChannelDTO{
		ID:                  r.ID,
		ChannelKey:          r.ChannelKey,
		Name:                r.Name,
		AccountName:         r.AccountName,
		Description:         r.Description,
		Mode:                r.Environment,
		Enabled:             r.Enabled,
		ApiPublicKey:        r.ApiPublicKey,
		ApiSecretKey:        maskKey(r.ApiSecretKey),
		WebhookSecret:       maskKey(r.WebhookSecret),
		SupportedCurrencies: currencies,
		FeeRateText:         r.FeeRateText,
		RoutingPriority:     r.RoutingPriority,
		FallbackChannelID:   r.FallbackChannelID,
		TenantID:            r.TenantID,
		TestStatus:          r.TestStatus,
		HealthStatus:        healthStatus,
		LatencyMs:           r.LatencyMs,
		LastTestedAt:        lastTested,
		LastHealthAt:        lastHealth,
	}
}
