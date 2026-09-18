package persistence

import (
	"encoding/json"
	"strings"

	"github.com/novaspay/admin-api/internal/pkg/timex"
)

// PaymentAppToMap 合并列化字段与 data_json，供 API / 邮件派发使用。
func PaymentAppToMap(row PaymentApp) (map[string]interface{}, error) {
	base := map[string]interface{}{}
	if row.DataJSON != "" && row.DataJSON != "{}" {
		if err := json.Unmarshal([]byte(row.DataJSON), &base); err != nil {
			base = map[string]interface{}{}
		}
	}
	if row.ID != "" {
		base["id"] = row.ID
	}
	if row.TenantID != "" {
		base["tenantId"] = row.TenantID
	}
	if row.Code != "" {
		base["code"] = row.Code
	}
	if row.Name != "" {
		base["name"] = row.Name
	}
	if row.Description != "" {
		base["description"] = row.Description
	}
	if row.Environment != "" {
		base["environment"] = row.Environment
	}
	if row.PublishableKey != "" {
		base["publishableKey"] = row.PublishableKey
	}
	if row.SecretKey != "" {
		base["secretKey"] = row.SecretKey
	}
	if row.WebhookURL != "" {
		base["webhookUrl"] = row.WebhookURL
	}
	if row.DefaultCurrency != "" {
		base["defaultCurrency"] = row.DefaultCurrency
	}
	if row.Status != "" {
		base["status"] = row.Status
	}
	if row.RoutingStrategy != "" {
		base["routingStrategy"] = row.RoutingStrategy
	}
	if row.EmailChannelID != "" {
		base["emailChannelId"] = row.EmailChannelID
	}
	if row.SenderEmail != "" {
		base["senderEmail"] = row.SenderEmail
	}
	if row.SenderName != "" {
		base["senderName"] = row.SenderName
	}
	if row.DefaultLanguage != "" {
		base["defaultLanguage"] = row.DefaultLanguage
	}
	if row.ActiveSubscribersCount > 0 {
		base["activeSubscribersCount"] = row.ActiveSubscribersCount
	}
	if row.TotalGmv > 0 {
		base["totalGmv"] = row.TotalGmv
	}
	mergeJSONArr(base, "enabledChannels", row.EnabledChannelsJSON)
	mergeJSONArr(base, "enabledPaymentMethods", row.EnabledPaymentMethodsJSON)
	mergeJSONArr(base, "associatedProductCodes", row.AssociatedProductCodesJSON)
	mergeJSONArr(base, "associatedDiscountCodes", row.AssociatedDiscountCodesJSON)
	mergeJSONArr(base, "enabledEmailEvents", row.EnabledEmailEventsJSON)
	mergeJSONArr(base, "supportedLanguages", row.SupportedLanguagesJSON)
	if row.CreatedAt > 0 && base["createdAt"] == nil {
		base["createdAt"] = timex.FormatDate(row.CreatedAt)
	}
	return base, nil
}

func mergeJSONArr(m map[string]interface{}, key, raw string) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "[]" {
		return
	}
	var arr []interface{}
	if json.Unmarshal([]byte(raw), &arr) != nil || len(arr) == 0 {
		return
	}
	m[key] = arr
}
