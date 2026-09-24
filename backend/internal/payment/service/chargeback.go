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
	"github.com/novaspay/admin-api/internal/infra/sharding"
	"github.com/novaspay/admin-api/internal/payment/provider/creem"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/tenant"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

// 拒付状态机（保持中文状态字符串以兼容现有前端）：
//
//	待响应(PENDING_RESPONSE)
//	  → 已提交证据(EVIDENCE_SUBMITTED)
//	    → 渠道审核中(UNDER_REVIEW)
//	      → 商户胜诉(WON) / 商户败诉(LOST)
//
// 商户也可在待响应/已提交证据阶段直接「接受拒付」，状态置为「败诉」。
const (
	ChargebackStatusPendingResponse = "待响应"
	ChargebackStatusEvidenceSubmitted = "已提交证据"
	ChargebackStatusUnderReview      = "渠道审核中"
	ChargebackStatusWon              = "胜诉"
	ChargebackStatusLost             = "败诉"
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

// ChargebackEvidenceInput 已废弃：保留以兼容旧 JSON 调用，新接口走 multipart 文件上传。
type ChargebackEvidenceInput struct {
	Name string `json:"name"`
	Size string `json:"size"`
}

func (s *Service) ListChargebacks(ctx context.Context, tenantID, channel string) ([]ChargebackDTO, error) {
	filter := func(q *gorm.DB) *gorm.DB {
		q = q.Where("deleted_at IS NULL")
		q = tenant.Apply(q, tenantID)
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

// AddChargebackEvidence 上传拒付抗辩证据（真实 multipart 文件），状态推进为「已提交证据」。
func (s *Service) AddChargebackEvidence(ctx context.Context, id string, fileName string, fileBytes []byte) (*ChargebackDTO, error) {
	found, tbl, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	if row.Status == ChargebackStatusWon || row.Status == ChargebackStatusLost {
		return nil, apperr.New(42221, 422, "拒付已结案，不能再补充证据")
	}
	name := strings.TrimSpace(fileName)
	if name == "" {
		name = "evidence.pdf"
	}
	evidence := []ChargebackEvidenceDTO{}
	_ = json.Unmarshal([]byte(row.EvidenceJSON), &evidence)
	uploadedAt := time.Now().UTC().Unix()
	evidence = append(evidence, ChargebackEvidenceDTO{
		ID:         uuid.NewString()[:8],
		Name:       name,
		Size:       fmt.Sprintf("%d bytes", len(fileBytes)),
		UploadedAt: timex.FormatUTC(uploadedAt),
	})
	evidenceJSON, _ := json.Marshal(evidence)

	timeline := appendChargebackTimeline(row.TimelineJSON, ChargebackTimelineDTO{
		Title:       "提交抗辩证据",
		Timestamp:   timex.FormatUTC(uploadedAt),
		Status:      "completed",
		Description: "上传证据文件: " + name,
	})
	timelineJSON, _ := json.Marshal(timeline)

	updates := map[string]interface{}{
		"evidence_json": string(evidenceJSON),
		"timeline_json": string(timelineJSON),
		"status":        ChargebackStatusEvidenceSubmitted,
	}
	if err := s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, updates); err != nil {
		return nil, err
	}
	row.EvidenceJSON = string(evidenceJSON)
	row.TimelineJSON = string(timelineJSON)
	row.Status = ChargebackStatusEvidenceSubmitted
	dto := toChargebackDTO(row)
	return &dto, nil
}

// SubmitChargeback 向渠道提交拒付抗辩。状态推进为「渠道审核中」。
// 若渠道 provider 调用失败（端点尚未实现），仍推进状态并在 note 中记录失败原因。
func (s *Service) SubmitChargeback(ctx context.Context, id string) (*ChargebackDTO, error) {
	found, tbl, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	if row.Status == ChargebackStatusWon || row.Status == ChargebackStatusLost {
		return nil, apperr.New(42221, 422, "拒付已结案，不能再提交")
	}

	// 通过渠道调用 Creem 提交抗辩（TODO: 端点待确认，失败不阻断状态机）。
	note := ""
	if row.ChannelID != "" {
		if ch, chErr := s.GetRawChannel(ctx, row.ChannelID); chErr == nil && ch.ChannelKey == "creem" && strings.TrimSpace(ch.ApiKey) != "" {
			client := newCreemClient(ch.Environment, ch.ApiKey)
			if submitErr := client.SubmitDispute(ctx, row.ExternalEventID); submitErr != nil {
				note = "渠道提交抗辩失败: " + submitErr.Error()
			}
		}
	}

	now := time.Now().UTC().Unix()
	timeline := appendChargebackTimeline(row.TimelineJSON, ChargebackTimelineDTO{
		Title:       "提交渠道审核",
		Timestamp:   timex.FormatUTC(now),
		Status:      "current",
		Description: "抗辩材料已提交渠道，等待裁决",
	})
	timelineJSON, _ := json.Marshal(timeline)

	updates := map[string]interface{}{
		"timeline_json": string(timelineJSON),
		"status":        ChargebackStatusUnderReview,
	}
	if note != "" {
		updates["note"] = note
	}
	if err := s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, updates); err != nil {
		return nil, err
	}
	row.TimelineJSON = string(timelineJSON)
	row.Status = ChargebackStatusUnderReview
	if note != "" {
		row.Note = note
	}
	dto := toChargebackDTO(row)
	return &dto, nil
}

// AcceptChargeback 商户接受拒付（放弃抗辩），状态置为「败诉」。
func (s *Service) AcceptChargeback(ctx context.Context, id string) (*ChargebackDTO, error) {
	found, tbl, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	row := *found
	if row.Status == ChargebackStatusWon || row.Status == ChargebackStatusLost {
		return nil, apperr.New(42221, 422, "拒付已结案")
	}
	now := time.Now().UTC().Unix()
	timeline := appendChargebackTimeline(row.TimelineJSON, ChargebackTimelineDTO{
		Title:       "商户接受拒付",
		Timestamp:   timex.FormatUTC(now),
		Status:      "completed",
		Description: "商户放弃抗辩，确认败诉",
	})
	timelineJSON, _ := json.Marshal(timeline)
	if err := s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, map[string]interface{}{
		"timeline_json": string(timelineJSON),
		"status":        ChargebackStatusLost,
	}); err != nil {
		return nil, err
	}
	row.TimelineJSON = string(timelineJSON)
	row.Status = ChargebackStatusLost
	dto := toChargebackDTO(row)
	return &dto, nil
}

// GetChargeback 返回单个拒付详情。
func (s *Service) GetChargeback(ctx context.Context, id string) (*ChargebackDTO, error) {
	found, _, err := s.shards.GetPaymentChargeback(ctx, id)
	if err != nil {
		return nil, apperr.NotFound
	}
	dto := toChargebackDTO(*found)
	return &dto, nil
}

// UpdateChargebackFromWebhook 处理 dispute.resolved 事件：根据渠道裁决结果更新拒付状态。
// resultStatus 取 "won"（商户胜诉）或 "lost"（商户败诉）。
func (s *Service) UpdateChargebackFromWebhook(ctx context.Context, channelID, disputeID, resultStatus string) error {
	row, tbl, err := s.findActiveChargeback(ctx, channelID, disputeID)
	if err != nil {
		// 未匹配到活动拒付单：幂等忽略（可能已结案或非本系统单据）。
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	resultStatus = strings.ToLower(strings.TrimSpace(resultStatus))
	status := ChargebackStatusLost
	title := "渠道裁决: 商户败诉"
	if resultStatus == "won" {
		status = ChargebackStatusWon
		title = "渠道裁决: 商户胜诉"
	}
	now := time.Now().UTC().Unix()
	timeline := appendChargebackTimeline(row.TimelineJSON, ChargebackTimelineDTO{
		Title:       title,
		Timestamp:   timex.FormatUTC(now),
		Status:      "completed",
		Description: "dispute.resolved Webhook 入站",
	})
	timelineJSON, _ := json.Marshal(timeline)
	return s.shards.UpdatePaymentChargeback(ctx, tbl, row.ID, map[string]interface{}{
		"timeline_json": string(timelineJSON),
		"status":        status,
	})
}

// findActiveChargeback 查找待结案（非胜诉/败诉）的拒付单。
// TODO: 精确匹配 dispute 对象 id 需要在拒付表持久化 dispute_id 列；当前回退为渠道下最新的活动拒付单。
func (s *Service) findActiveChargeback(ctx context.Context, channelID, disputeID string) (*persistence.PaymentChargeback, string, error) {
	if disputeID != "" {
		if existing, err := s.shards.FindPaymentChargebackByExternalEvent(ctx, disputeID); err == nil && existing != nil {
			// 仍需拿到表名：用创建月份定位。
			tbl := sharding.Table(sharding.BasePaymentChargebacks, sharding.MonthSuffixFromUnix(existing.CreatedAt))
			return existing, tbl, nil
		}
	}
	months := sharding.RecentMonthsNewestFirst(sharding.DefaultListMonths)
	for _, ym := range months {
		tbl := sharding.Table(sharding.BasePaymentChargebacks, ym)
		if !s.shards.DB().Migrator().HasTable(tbl) {
			continue
		}
		var rows []persistence.PaymentChargeback
		q := s.shards.DB().WithContext(ctx).Table(tbl).
			Where("channel_id = ? AND deleted_at IS NULL", channelID).
			Where("status NOT IN ?", []string{ChargebackStatusWon, ChargebackStatusLost}).
			Order("created_at DESC")
		if err := q.Find(&rows).Error; err != nil {
			return nil, "", err
		}
		if len(rows) > 0 {
			r := rows[0]
			return &r, tbl, nil
		}
	}
	return nil, "", gorm.ErrRecordNotFound
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
		Status:          ChargebackStatusPendingResponse,
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

// appendChargebackTimeline 解析既有 timeline，追加一个新节点并返回切片。
func appendChargebackTimeline(timelineJSON string, node ChargebackTimelineDTO) []ChargebackTimelineDTO {
	timeline := []ChargebackTimelineDTO{}
	_ = json.Unmarshal([]byte(timelineJSON), &timeline)
	// 旧的 current 节点标记为 completed（不再当前）。
	for i := range timeline {
		if timeline[i].Status == "current" {
			timeline[i].Status = "completed"
		}
	}
	timeline = append(timeline, node)
	return timeline
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
