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
	"github.com/novaspay/admin-api/internal/pkg/tenant"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
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
	filter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL")
		q = tenant.Apply(q, tenantID)
		if ch := strings.TrimSpace(channel); ch != "" && ch != "all" {
			q = q.Where("channel = ?", ch)
		}
		return q
	}
	rows, err := s.shards.ListPaymentRefunds(ctx, filter)
	if err != nil {
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

	payTx, _, err := s.shards.GetPaymentTransaction(ctx, txNo)
	if err != nil {
		return nil, apperr.New(40401, 404, "关联交易流水不存在")
	}
	if !isRefundableTxStatus(payTx.Status) {
		return nil, apperr.New(42213, 422, "仅成功交易可退款")
	}
	if refundCents > payTx.OrderAmountCents {
		return nil, apperr.New(42214, 422, "退款金额不能超过原交易金额")
	}
	usedCents, err := s.shards.SumRefundsForTransaction(ctx, payTx.ID, []string{"SUCCESS", "PENDING", "PROCESSING"})
	if err != nil {
		return nil, err
	}
	if usedCents+refundCents > payTx.OrderAmountCents {
		return nil, apperr.New(42215, 422, "累计退款金额不能超过原交易金额")
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
	row := persistence.PaymentRefund{
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
	if err := s.shards.CreatePaymentRefund(ctx, &row); err != nil {
		return nil, err
	}
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) ProcessRefund(ctx context.Context, id string) (*RefundDTO, error) {
	found, tbl, err := s.shards.GetPaymentRefund(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	switch strings.ToUpper(strings.TrimSpace(row.Status)) {
	case "SUCCESS":
		err = errRefundAlreadyDone
	case "PROCESSING":
		err = apperr.Conflict
	case "PENDING":
		res := s.shards.UpdatePaymentRefund(ctx, tbl, row.ID, map[string]interface{}{"status": "PROCESSING"})
		if res != nil {
			err = res
		} else {
			row.Status = "PROCESSING"
		}
	default:
		err = apperr.Conflict
	}
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
				if payTx, _, e := s.shards.GetPaymentTransaction(ctx, row.TransactionID); e == nil {
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

	if err := s.shards.UpdatePaymentRefund(ctx, tbl, row.ID, map[string]interface{}{"status": "SUCCESS"}); err != nil {
		return nil, err
	}
	row.Status = "SUCCESS"
	dto := toRefundDTO(row)
	return &dto, nil
}

func (s *Service) revertRefundToPending(ctx context.Context, id string) {
	row, tbl, err := s.shards.GetPaymentRefund(ctx, id)
	if err != nil {
		return
	}
	if strings.EqualFold(row.Status, "PROCESSING") {
		_ = s.shards.UpdatePaymentRefund(ctx, tbl, id, map[string]interface{}{"status": "PENDING"})
	}
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
	if existing, err := s.shards.FindPaymentRefundByExternalEvent(ctx, parsed.ExternalEventID); err == nil && existing != nil {
		return nil
	} else if err != nil && err != gorm.ErrRecordNotFound {
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
	return s.shards.CreatePaymentRefund(ctx, &row)
}

func (s *Service) findTransactionByTradeNo(ctx context.Context, channelID, tradeNo, orderNo string) (*persistence.PaymentTransaction, error) {
	return s.shards.FindPaymentTransactionByTradeNo(ctx, channelID, tradeNo, orderNo)
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
