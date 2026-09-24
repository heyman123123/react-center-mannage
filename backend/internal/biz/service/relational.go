package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

func applyPaymentAppPayload(row *persistence.PaymentApp, payload map[string]interface{}) {
	row.Name = stringField(payload, "name")
	row.Description = stringField(payload, "description")
	row.Environment = stringField(payload, "environment")
	row.PublishableKey = stringField(payload, "publishableKey")
	row.SecretKey = stringField(payload, "secretKey")
	row.WebhookURL = stringField(payload, "webhookUrl")
	row.DefaultCurrency = strings.ToUpper(stringField(payload, "defaultCurrency"))
	row.Status = strings.ToUpper(stringField(payload, "status"))
	if row.Status == "" {
		row.Status = "ACTIVE"
	}
	row.RoutingStrategy = stringField(payload, "routingStrategy")
	row.EmailChannelID = stringField(payload, "emailChannelId")
	row.SenderEmail = stringField(payload, "senderEmail")
	row.SenderName = stringField(payload, "senderName")
	row.DefaultLanguage = stringField(payload, "defaultLanguage")
	row.ActiveSubscribersCount = intField(payload, "activeSubscribersCount")
	row.TotalGmv = floatField(payload, "totalGmv")
	row.EnabledChannelsJSON = marshalJSONArray(payload, "enabledChannels")
	row.EnabledPaymentMethodsJSON = marshalJSONArray(payload, "enabledPaymentMethods")
	row.AssociatedProductCodesJSON = marshalJSONArray(payload, "associatedProductCodes")
	row.AssociatedDiscountCodesJSON = marshalJSONArray(payload, "associatedDiscountCodes")
	row.EnabledEmailEventsJSON = marshalJSONArray(payload, "enabledEmailEvents")
	row.SupportedLanguagesJSON = marshalJSONArray(payload, "supportedLanguages")
	data, _ := json.Marshal(payload)
	row.DataJSON = string(data)
}

func paymentAppToMap(row persistence.PaymentApp) (map[string]interface{}, error) {
	return persistence.PaymentAppToMap(row)
}

func applySettlementFromPayload(row *persistence.SettlementBatch, payload map[string]interface{}) {
	row.Currency = strings.ToUpper(stringField(payload, "currency"))
	row.Cycle = stringField(payload, "cycle")
	if row.Cycle == "" {
		row.Cycle = "T+1"
	}
	row.ReceivableAmountCents = dollarsToCents(floatField(payload, "receivableAmount"))
	row.FeeCents = dollarsToCents(floatField(payload, "fee"))
	if row.FeeCents == 0 {
		if fees, ok := payload["fees"].(map[string]interface{}); ok {
			row.FeeCents = dollarsToCents(floatField(fees, "channelFee"))
		}
	}
	row.NetAmountCents = dollarsToCents(floatField(payload, "netAmount"))
	if row.NetAmountCents == 0 && row.ReceivableAmountCents > 0 {
		row.NetAmountCents = row.ReceivableAmountCents - row.FeeCents
	}
	row.Remark = stringField(payload, "remark")
	if fees, ok := payload["fees"]; ok {
		b, _ := json.Marshal(fees)
		row.FeesJSON = string(b)
	}
	data, _ := json.Marshal(payload)
	row.DataJSON = string(data)
}

func settlementToMap(row persistence.SettlementBatch, items []persistence.SettlementBatchItem) (map[string]interface{}, error) {
	base, err := unmarshalMap(row.DataJSON)
	if err != nil || base == nil {
		base = map[string]interface{}{}
	}
	base["id"] = row.ID
	base["tenantId"] = row.TenantID
	base["channel"] = row.Channel
	if row.BatchDate != "" {
		base["batchDate"] = row.BatchDate
	}
	base["status"] = row.Status
	if row.Currency != "" {
		base["currency"] = row.Currency
	}
	if row.ReceivableAmountCents > 0 {
		base["receivableAmount"] = float64(row.ReceivableAmountCents) / 100
	}
	if row.FeeCents > 0 {
		base["fee"] = float64(row.FeeCents) / 100
	}
	if row.NetAmountCents > 0 {
		base["netAmount"] = float64(row.NetAmountCents) / 100
	}
	if row.Cycle != "" {
		base["cycle"] = row.Cycle
	}
	if row.Remark != "" {
		base["remark"] = row.Remark
	}
	if row.FeesJSON != "" && row.FeesJSON != "{}" {
		var fees map[string]interface{}
		if json.Unmarshal([]byte(row.FeesJSON), &fees) == nil {
			base["fees"] = fees
		}
	}
	// 审核 / 打款流程字段
	if row.ReviewedAt != nil {
		base["reviewedAt"] = timex.FormatUTC(*row.ReviewedAt)
	}
	if row.ApprovedAt != nil {
		base["approvedAt"] = timex.FormatUTC(*row.ApprovedAt)
	}
	if row.PaidAt != nil {
		base["paidAt"] = timex.FormatUTC(*row.PaidAt)
	}
	if row.Reviewer != "" {
		base["reviewer"] = row.Reviewer
	}
	if row.RejectReason != "" {
		base["rejectReason"] = row.RejectReason
	}
	if row.PayoutProofJSON != "" && row.PayoutProofJSON != "[]" {
		var proofs []interface{}
		if json.Unmarshal([]byte(row.PayoutProofJSON), &proofs) == nil && len(proofs) > 0 {
			base["payoutProof"] = proofs
		}
	}
	if len(items) > 0 {
		txItems := make([]interface{}, 0, len(items))
		for _, it := range items {
			txItems = append(txItems, map[string]interface{}{
				"transactionId":        it.TransactionID,
				"transactionDisplayId": it.TransactionDisplayID,
				"orderAmount":          float64(it.OrderAmountCents) / 100,
				"channelFee":           float64(it.ChannelFeeCents) / 100,
				"currency":             it.Currency,
			})
		}
		base["txItems"] = txItems
	}
	return base, nil
}

func stringField(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(fmt.Sprint(t))
	}
}

func floatField(m map[string]interface{}, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}

func intField(m map[string]interface{}, key string) int {
	return int(floatField(m, key))
}

func dollarsToCents(amount float64) int64 {
	if amount <= 0 {
		return 0
	}
	return int64(amount * 100)
}

func marshalJSONArray(payload map[string]interface{}, key string) string {
	v, ok := payload[key]
	if !ok || v == nil {
		return "[]"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func mergeIfEmpty(m map[string]interface{}, key string, val string) {
	if val == "" {
		return
	}
	if cur, ok := m[key]; !ok || cur == nil || cur == "" {
		m[key] = val
	}
}

func mergeJSONArray(m map[string]interface{}, key, raw string) {
	if raw == "" || raw == "[]" {
		return
	}
	var arr []interface{}
	if json.Unmarshal([]byte(raw), &arr) != nil || len(arr) == 0 {
		return
	}
	m[key] = arr
}
