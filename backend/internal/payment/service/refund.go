package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RefundDTO struct {
	ID             string  `json:"id"`
	TransactionNo  string  `json:"transactionNo"`
	TenantID       string  `json:"tenantId"`
	Channel        string  `json:"channel"`
	RefundAmount   float64 `json:"refundAmount"`
	OriginalAmount float64 `json:"originalAmount"`
	Currency       string  `json:"currency"`
	Reason         string  `json:"reason"`
	Status         string  `json:"status"`
	RefundType     string  `json:"refundType"`
	Note           string  `json:"note"`
	CreatedAt      string  `json:"createdAt"`
}

type RefundInput struct {
	TransactionNo string  `json:"transactionNo"`
	RefundAmount  float64 `json:"refundAmount"`
	Reason        string  `json:"reason"`
	RefundType    string  `json:"refundType"`
	Note          string  `json:"note"`
}

var errRefundAlreadyDone = errors.New("refund already success")

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
	if math.IsNaN(in.RefundAmount) || math.IsInf(in.RefundAmount, 0) || in.RefundAmount <= 0 {
		return nil, apperr.New(42212, 422, "退款金额无效")
	}
	refundCents := int64(math.Round(in.RefundAmount * 100))
	if refundCents <= 0 {
		return nil, apperr.New(42212, 422, "退款金额无效")
	}

	var row persistence.PaymentRefund
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payTx persistence.PaymentTransaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("display_id = ? OR id = ?", txNo, txNo).First(&payTx).Error; err != nil {
			return apperr.New(40401, 404, "关联交易流水不存在")
		}
		if !isRefundableTxStatus(payTx.Status) {
			return apperr.New(42213, 422, "仅成功交易可退款")
		}
		if refundCents > payTx.OrderAmountCents {
			return apperr.New(42214, 422, "退款金额不能超过原交易金额")
		}

		var usedCents int64
		if err := tx.Model(&persistence.PaymentRefund{}).
			Where("transaction_id = ? AND status IN ?", payTx.ID, []string{"SUCCESS", "PENDING", "PROCESSING"}).
			Select("COALESCE(SUM(refund_amount_cents), 0)").
			Scan(&usedCents).Error; err != nil {
			return err
		}
		if usedCents+refundCents > payTx.OrderAmountCents {
			return apperr.New(42215, 422, "累计退款金额不能超过原交易金额")
		}

		refundType := strings.TrimSpace(in.RefundType)
		if refundType == "" {
			refundType = "FULL"
			if refundCents < payTx.OrderAmountCents {
				refundType = "PARTIAL"
			}
		}
		reason := strings.TrimSpace(in.Reason)
		if reason == "" {
			reason = "客户要求"
		}
		now := time.Now().UTC()
		row = persistence.PaymentRefund{
			ID:                  uuid.NewString(),
			DisplayID:           fmt.Sprintf("ref_%s_%06d", now.Format("20060102"), rand.Intn(900000)+100000),
			TransactionID:       payTx.ID,
			TransactionNo:       payTx.DisplayID,
			ChannelID:           payTx.ChannelID,
			TenantID:            payTx.TenantID,
			Channel:             payTx.Channel,
			RefundAmountCents:   refundCents,
			OriginalAmountCents: payTx.OrderAmountCents,
			Currency:            payTx.Currency,
			Reason:              reason,
			Status:              "PENDING",
			RefundType:          refundType,
			Note:                strings.TrimSpace(in.Note),
		}
		return tx.Create(&row).Error
	})
	if err != nil {
		return nil, err
	}
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) ProcessRefund(ctx context.Context, id string) (*RefundDTO, error) {
	var row persistence.PaymentRefund
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("display_id = ? OR id = ?", id, id).First(&row).Error; err != nil {
			return apperr.NotFound
		}
		switch strings.ToUpper(strings.TrimSpace(row.Status)) {
		case "SUCCESS":
			return errRefundAlreadyDone
		case "PROCESSING":
			return apperr.Conflict
		case "PENDING":
			res := tx.Model(&persistence.PaymentRefund{}).
				Where("id = ? AND status = ?", row.ID, "PENDING").
				Update("status", "PROCESSING")
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return apperr.Conflict
			}
			row.Status = "PROCESSING"
			return nil
		default:
			return apperr.Conflict
		}
	})
	if errors.Is(err, errRefundAlreadyDone) {
		dto := toRefundDTO(row)
		return &dto, nil
	}
	if err != nil {
		return nil, err
	}

	if row.ChannelID != "" {
		ch, err := s.GetRawChannel(ctx, row.ChannelID)
		if err != nil {
			s.revertRefundToPending(ctx, row.ID)
			return nil, err
		}
		if ch.ChannelKey == "creem" && strings.TrimSpace(ch.ApiKey) != "" {
			extID := ""
			if row.TransactionID != "" {
				var payTx persistence.PaymentTransaction
				if err := s.db.WithContext(ctx).First(&payTx, "id = ?", row.TransactionID).Error; err == nil {
					extID = firstNonEmpty(payTx.ChannelTradeNo, payTx.OrderNumber)
				}
			}
			if extID == "" {
				s.revertRefundToPending(ctx, row.ID)
				return nil, apperr.New(42211, 422, "无法确定 Creem 交易 ID")
			}
			client := newCreemClient(ch.Environment, ch.ApiKey)
			entity, creemErr := client.CreateRefund(ctx, extID, row.RefundAmountCents)
			if creemErr != nil {
				s.revertRefundToPending(ctx, row.ID)
				return nil, apperr.Wrap(50211, 502, "Creem 退款失败", creemErr)
			}
			if entity != nil && strings.TrimSpace(entity.Status) != "" && !isCreemRefundSuccessStatus(entity.Status) {
				s.revertRefundToPending(ctx, row.ID)
				return nil, apperr.New(50211, 502, "Creem 退款未成功: "+entity.Status)
			}
		}
	}

	if err := s.db.WithContext(ctx).Model(&persistence.PaymentRefund{}).
		Where("id = ?", row.ID).Update("status", "SUCCESS").Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", row.ID)
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) revertRefundToPending(ctx context.Context, id string) {
	_ = s.db.WithContext(ctx).Model(&persistence.PaymentRefund{}).
		Where("id = ? AND status = ?", id, "PROCESSING").
		Update("status", "PENDING").Error
}

func isRefundableTxStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "done", "success", "successful", "succeeded":
		return true
	default:
		return false
	}
}

func isCreemRefundSuccessStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "succeeded", "success", "completed", "done", "refunded":
		return true
	default:
		return false
	}
}

var newCreemClient = func(environment, apiKey string) *creem.Client {
	return creem.NewClient(environment, apiKey)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
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
	payTx, _ := s.findTransactionByTradeNo(ctx, channelID, parsed.ChannelTradeNo, parsed.OrderNumber)
	txNo := ""
	txID := ""
	origCents := parsed.OrderAmountCents
	if payTx != nil {
		txNo = payTx.DisplayID
		txID = payTx.ID
		origCents = payTx.OrderAmountCents
	}
	now := time.Now().UTC()
	row := persistence.PaymentRefund{
		ID:                  uuid.NewString(),
		DisplayID:           fmt.Sprintf("ref_%s_%06d", now.Format("20060102"), rand.Intn(900000)+100000),
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
		Status:              "SUCCESS",
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
