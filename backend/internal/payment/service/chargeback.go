package service

import (
	"context"
	"encoding/json"
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

type ChargebackEvidenceDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Size       string `json:"size"`
	UploadedAt string `json:"uploadedAt"`
}

type ChargebackTimelineDTO struct {
	Title       string `json:"title"`
	Timestamp   string `json:"timestamp"`
	Status      string `json:"status"`
	Description string `json:"description,omitempty"`
}

type ChargebackDTO struct {
	ID            string                  `json:"id"`
	TransactionNo string                  `json:"transactionNo"`
	TenantID      string                  `json:"tenantId"`
	Channel       string                  `json:"channel"`
	Amount        float64                 `json:"amount"`
	Currency      string                  `json:"currency"`
	Reason        string                  `json:"reason"`
	Status        string                  `json:"status"`
	Deadline      string                  `json:"deadline"`
	RemainingDays int                     `json:"remainingDays"`
	Evidence      []ChargebackEvidenceDTO `json:"evidence"`
	Timeline      []ChargebackTimelineDTO `json:"timeline"`
	Note          string                  `json:"note"`
}

type ChargebackEvidenceInput struct {
	Name string `json:"name"`
	Size string `json:"size"`
}

func (s *Service) ListChargebacks(ctx context.Context, tenantID, channel string) ([]ChargebackDTO, error) {
	filter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL")
		if tenantID != "" && tenantID != "ALL" && tenantID != "group_hq" {
			q = q.Where("tenant_id = ?", tenantID)
		}
		if ch := strings.TrimSpace(channel); ch != "" && ch != "all" {
			q = q.Where("channel = ?", ch)
		}
		return q
	}
	rows, err := s.shards.ListPaymentChargebacks(ctx, filter)
	if err != nil {
		return nil, err
	}
	out := make([]ChargebackDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toChargebackDTO(r))
	}
	return out, nil
}

func (s *Service) AddChargebackEvidence(ctx context.Context, id string, in ChargebackEvidenceInput) (*ChargebackDTO, error) {
	found, tbl, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	evidence := []ChargebackEvidenceDTO{}
	_ = json.Unmarshal([]byte(row.EvidenceJSON), &evidence)
	evidence = append(evidence, ChargebackEvidenceDTO{
		ID:         uuid.NewString()[:8],
		Name:       strings.TrimSpace(in.Name),
		Size:       strings.TrimSpace(in.Size),
		UploadedAt: timex.FormatUTC(time.Now().UTC().Unix()),
	})
	evidenceJSON, _ := json.Marshal(evidence)
	updates := map[string]interface{}{
		"evidence_json": string(evidenceJSON),
		"status":        "已提交证据",
	}
	if err := s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, updates); err != nil {
		return nil, err
	}
	row.EvidenceJSON = string(evidenceJSON)
	row.Status = "已提交证据"
	dto := toChargebackDTO(row)
	return &dto, nil
}

func (s *Service) SubmitChargeback(ctx context.Context, id string) (*ChargebackDTO, error) {
	found, tbl, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	if err := s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, map[string]interface{}{"status": "已提交证据"}); err != nil {
		return nil, err
	}
	row.Status = "已提交证据"
	dto := toChargebackDTO(row)
	return &dto, nil
}

func (s *Service) UpsertChargebackFromWebhook(ctx context.Context, channelID string, parsed *creem.ParsedTransaction) error {
	if parsed == nil || parsed.EventType != "dispute.created" {
		return nil
	}
	if existing, err := s.shards.FindPaymentChargebackByExternalEvent(ctx, parsed.ExternalEventID); err == nil && existing != nil {
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
	tx, _ := s.findTransactionByTradeNo(ctx, channelID, parsed.ChannelTradeNo, parsed.OrderNumber)
	txNo := ""
	txID := ""
	if tx != nil {
		txNo = tx.DisplayID
		txID = tx.ID
	}
	deadline := time.Now().UTC().AddDate(0, 0, 14).Unix()
	timeline := []ChargebackTimelineDTO{
		{
			Title:       "拒付发起",
			Timestamp:   timex.FormatUTC(parsed.CreatedAt),
			Status:      "completed",
			Description: "Creem dispute.created Webhook 入站",
		},
		{
			Title:     "等待响应",
			Timestamp: timex.FormatUTC(deadline),
			Status:    "current",
		},
	}
	timelineJSON, _ := json.Marshal(timeline)
	now := time.Now().UTC()
	row := persistence.PaymentChargeback{
		ID:              uuid.NewString(),
		DisplayID:       fmt.Sprintf("cb_%s_%06d", now.Format("YYYYMMDD"), rand.Intn(900000)+100000),
		TransactionID:   txID,
		TransactionNo:   txNo,
		ChannelID:       channelID,
		TenantID:        tenantID,
		Channel:         ch.ChannelKey,
		ExternalEventID: parsed.ExternalEventID,
		AmountCents:     parsed.OrderAmountCents,
		Currency:        parsed.Currency,
		Reason:          "欺诈",
		Status:          "待响应",
		DeadlineAt:      deadline,
		TimelineJSON:    string(timelineJSON),
		EvidenceJSON:    "[]",
		Note:            "Creem Webhook: dispute.created",
	}
	if parsed.CreatedAt > 0 {
		row.CreatedAt = parsed.CreatedAt
	}
	return s.shards.CreatePaymentChargeback(ctx, &row)
}

func toChargebackDTO(r persistence.PaymentChargeback) ChargebackDTO {
	evidence := []ChargebackEvidenceDTO{}
	_ = json.Unmarshal([]byte(r.EvidenceJSON), &evidence)
	timeline := []ChargebackTimelineDTO{}
	_ = json.Unmarshal([]byte(r.TimelineJSON), &timeline)
	remaining := int((r.DeadlineAt - time.Now().UTC().Unix()) / 86400)
	if remaining < 0 {
		remaining = 0
	}
	return ChargebackDTO{
		ID:            r.DisplayID,
		TransactionNo: r.TransactionNo,
		TenantID:      r.TenantID,
		Channel:       r.Channel,
		Amount:        float64(r.AmountCents) / 100,
		Currency:      r.Currency,
		Reason:        r.Reason,
		Status:        r.Status,
		Deadline:      timex.FormatUTC(r.DeadlineAt),
		RemainingDays: remaining,
		Evidence:      evidence,
		Timeline:      timeline,
		Note:          r.Note,
	}
}
