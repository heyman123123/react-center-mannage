package migrate

import (
	"encoding/json"
	"log"

	"github.com/novaspay/admin-api/internal/infra/persistence"
	"gorm.io/gorm"
)

// BackfillRelationalColumns 将仅存于 data_json 的旧数据回填到列化字段（幂等）。
func BackfillRelationalColumns(db *gorm.DB) {
	backfillPaymentApps(db)
	backfillSettlementBatches(db)
}

func backfillPaymentApps(db *gorm.DB) {
	var rows []persistence.PaymentApp
	if err := db.Find(&rows).Error; err != nil {
		return
	}
	for _, row := range rows {
		if row.Name != "" {
			continue
		}
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(row.DataJSON), &m); err != nil || len(m) == 0 {
			continue
		}
		updates := paymentAppUpdatesFromMap(m)
		if len(updates) == 0 {
			continue
		}
		if err := db.Model(&persistence.PaymentApp{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			log.Printf("biz migrate: payment_app %s: %v", row.ID, err)
		}
	}
}

func paymentAppUpdatesFromMap(m map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	if v, ok := m["name"].(string); ok && v != "" {
		out["name"] = v
	}
	if v, ok := m["description"].(string); ok {
		out["description"] = v
	}
	if v, ok := m["environment"].(string); ok {
		out["environment"] = v
	}
	if v, ok := m["publishableKey"].(string); ok {
		out["publishable_key"] = v
	}
	if v, ok := m["secretKey"].(string); ok {
		out["secret_key"] = v
	}
	if v, ok := m["webhookUrl"].(string); ok {
		out["webhook_url"] = v
	}
	if v, ok := m["defaultCurrency"].(string); ok {
		out["default_currency"] = v
	}
	if v, ok := m["status"].(string); ok {
		out["status"] = v
	}
	if v, ok := m["routingStrategy"].(string); ok {
		out["routing_strategy"] = v
	}
	if v, ok := m["emailChannelId"].(string); ok {
		out["email_channel_id"] = v
	}
	if v, ok := m["senderEmail"].(string); ok {
		out["sender_email"] = v
	}
	if v, ok := m["senderName"].(string); ok {
		out["sender_name"] = v
	}
	if v, ok := m["defaultLanguage"].(string); ok {
		out["default_language"] = v
	}
	if v, ok := m["activeSubscribersCount"].(float64); ok {
		out["active_subscribers_count"] = int(v)
	}
	if v, ok := m["totalGmv"].(float64); ok {
		out["total_gmv"] = v
	}
	if b, err := json.Marshal(m["enabledChannels"]); err == nil && b != nil {
		out["enabled_channels_json"] = string(b)
	}
	if b, err := json.Marshal(m["enabledPaymentMethods"]); err == nil && b != nil {
		out["enabled_payment_methods_json"] = string(b)
	}
	if b, err := json.Marshal(m["associatedProductCodes"]); err == nil && b != nil {
		out["associated_product_codes_json"] = string(b)
	}
	if b, err := json.Marshal(m["associatedDiscountCodes"]); err == nil && b != nil {
		out["associated_discount_codes_json"] = string(b)
	}
	if b, err := json.Marshal(m["enabledEmailEvents"]); err == nil && b != nil {
		out["enabled_email_events_json"] = string(b)
	}
	if b, err := json.Marshal(m["supportedLanguages"]); err == nil && b != nil {
		out["supported_languages_json"] = string(b)
	}
	return out
}

func backfillSettlementBatches(db *gorm.DB) {
	var rows []persistence.SettlementBatch
	if err := db.Find(&rows).Error; err != nil {
		return
	}
	for _, row := range rows {
		if row.ReceivableAmountCents > 0 {
			continue
		}
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(row.DataJSON), &m); err != nil || len(m) == 0 {
			continue
		}
		updates := map[string]interface{}{}
		if v, ok := m["currency"].(string); ok {
			updates["currency"] = v
		}
		if v, ok := m["cycle"].(string); ok {
			updates["cycle"] = v
		}
		if v, ok := m["receivableAmount"].(float64); ok {
			updates["receivable_amount_cents"] = int64(v * 100)
		}
		if v, ok := m["fee"].(float64); ok {
			updates["fee_cents"] = int64(v * 100)
		}
		if v, ok := m["netAmount"].(float64); ok {
			updates["net_amount_cents"] = int64(v * 100)
		}
		if fees, ok := m["fees"]; ok {
			b, _ := json.Marshal(fees)
			updates["fees_json"] = string(b)
		}
		if len(updates) == 0 {
			continue
		}
		if err := db.Model(&persistence.SettlementBatch{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			log.Printf("biz migrate: settlement %s: %v", row.ID, err)
		}
	}
}
