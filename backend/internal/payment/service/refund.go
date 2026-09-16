package service

import (
	"context"
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

type RefundDTO struct {
	ID              string  `json:"id"`
	TransactionNo   string  `json:"transactionNo"`
	TenantID        string  `json:"tenantId"`
	Channel         string  `json:"channel"`
	RefundAmount    float64 `json:"refundAmount"`
	OriginalAmount  float64 `json:"originalAmount"`
	Currency        string  `json:"currency"`
	Reason          string  `json:"reason"`
	Status          string  `json:"status"`
	RefundType      string  `json:"refundType"`
	Note            string  `json:"note"`
	CreatedAt       string  `json:"createdAt"`
}

type RefundInput struct {
	TransactionNo string  `json:"transactionNo"`
	RefundAmount  float64 `json:"refundAmount"`
	Reason        string  `json:"reason"`
	RefundType    string  `json:"refundType"`
	Note          string  `json:"note"`
}

func (s *Service) ListRefunds(ctx context.Context, tenantID, channel string) ([]RefundDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.PaymentRefund{})
	if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
		q = q.Where("tenant_id = ?", tenantID)
	}
	if ch := strings.TrimSpace(channel); ch != "" && ch != "all" {
		q = q.Where("channel = ?", ch)
	}
	var rows []persistence.PaymentRefund
	if err := q.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]RefundDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toRefundDTO(r))
	}
	return out, nil
}

func (s *Service) CreateRefund(ctx context.Context, in RefundInput) (*RefundDTO, error) {
	txNo := strings.TrimSpace(in.TransactionNo)
	if txNo == "" {
		return nil, apperr.InvalidArgument
	}
	var tx persistence.PaymentTransaction
	if err := s.db.WithContext(ctx).Where("display_id = ? OR id = ?", txNo, txNo).First(&tx).Error; err != nil {
		return nil, apperr.New(40401, 404, "关联交易流水不存在")
	}
	refundCents := int64(in.RefundAmount * 100)
	if refundCents <= 0 {
		refundCents = tx.OrderAmountCents
	}
	refundType := strings.TrimSpace(in.RefundType)
	if refundType == "" {
		refundType = "FULL"
		if refundCents < tx.OrderAmountCents {
			refundType = "PARTIAL"
		}
	}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" {
		reason = "客户要求"
	}
	now := time.Now().UTC()
	row := persistence.PaymentRefund{
		ID:                  uuid.NewString(),
		DisplayID:           fmt.Sprintf("ref_%s_%06d", now.Format("YYYYMMDD"), rand.Intn(900000)+100000),
		TransactionID:       tx.ID,
		TransactionNo:       tx.DisplayID,
		ChannelID:           tx.ChannelID,
		TenantID:            tx.TenantID,
		Channel:             tx.Channel,
		RefundAmountCents:   refundCents,
		OriginalAmountCents: tx.OrderAmountCents,
		Currency:            tx.Currency,
		Reason:              reason,
		Status:              "PROCESSING",
		RefundType:          refundType,
		Note:                strings.TrimSpace(in.Note),
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) ProcessRefund(ctx context.Context, id string) (*RefundDTO, error) {
	var row persistence.PaymentRefund
	if err := s.db.WithContext(ctx).Where("display_id = ? OR id = ?", id, id).First(&row).Error; err != nil {
		return nil, apperr.NotFound
	}
	if err := s.db.WithContext(ctx).Model(&row).Update("status", "SUCCESS").Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", row.ID)
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) UpsertRefundFromWebhook(ctx context.Context, channelID string, parsed *creem.ParsedTransaction, rawBody []byte) error {
	if parsed == nil || parsed.EventType != "refund.created" {
		return nil
	}
	var existing persistence.PaymentRefund
	if err := s.db.WithContext(ctx).Where("external_event_id = ?", parsed.ExternalEventID).First(&existing).Error; err == nil {
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return err
	}
	ch, err := s.GetRawChannel(ctx, channelID)
	if err != nil {
		return err
	}
	tenantID := ch.TenantID
	if tenantID == "" || tenantID == "ALL" {
		tenantID = "group_hq"
	}
	tx, _ := s.findTransactionByTradeNo(ctx, channelID, parsed.ChannelTradeNo, parsed.OrderNumber)
	txNo := ""
	txID := ""
	origCents := parsed.OrderAmountCents
	if tx != nil {
		txNo = tx.DisplayID
		txID = tx.ID
		origCents = tx.OrderAmountCents
	}
	now := time.Now().UTC()
	row := persistence.PaymentRefund{
		ID:                  uuid.NewString(),
		DisplayID:           fmt.Sprintf("ref_%s_%06d", now.Format("YYYYMMDD"), rand.Intn(900000)+100000),
		TransactionID:       txID,
		TransactionNo:       txNo,
		ChannelID:           channelID,
		TenantID:            tenantID,
		Channel:             ch.ChannelKey,
		ExternalEventID:     parsed.ExternalEventID,
		RefundAmountCents:   parsed.OrderAmountCents,
		OriginalAmountCents: origCents,
		Currency:            parsed.Currency,
		Reason:              "其他",
		Status:              "PROCESSING",
		RefundType:          "FULL",
		Note:                "Creem Webhook: refund.created",
	}
	if parsed.CreatedAt > 0 {
		row.CreatedAt = parsed.CreatedAt
	}
	return s.db.WithContext(ctx).Create(&row).Error
}

func (s *Service) findTransactionByTradeNo(ctx context.Context, channelID, tradeNo, orderNo string) (*persistence.PaymentTransaction, error) {
	var row persistence.PaymentTransaction
	q := s.db.WithContext(ctx).Where("channel_id = ?", channelID)
	if tradeNo != "" {
		q = q.Where("channel_trade_no = ? OR order_number = ?", tradeNo, tradeNo)
	} else if orderNo != "" {
		q = q.Where("order_number = ?", orderNo)
	} else {
		return nil, gorm.ErrRecordNotFound
	}
	if err := q.Order("created_at DESC").First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func toRefundDTO(r persistence.PaymentRefund) RefundDTO {
	return RefundDTO{
		ID:             r.DisplayID,
		TransactionNo:  r.TransactionNo,
		TenantID:       r.TenantID,
		Channel:        r.Channel,
		RefundAmount:   float64(r.RefundAmountCents) / 100,
		OriginalAmount: float64(r.OriginalAmountCents) / 100,
		Currency:       r.Currency,
		Reason:         r.Reason,
		Status:         r.Status,
		RefundType:     r.RefundType,
		Note:           r.Note,
		CreatedAt:      timex.FormatUTC(r.CreatedAt),
	}
}
