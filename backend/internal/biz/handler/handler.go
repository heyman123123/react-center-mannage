package handler

import (
	"fmt"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	bizsvc "github.com/novaspay/admin-api/internal/biz/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *bizsvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *bizsvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func bindMap(c *gin.Context) (map[string]interface{}, bool) {
	var m map[string]interface{}
	if err := c.ShouldBindJSON(&m); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return nil, false
	}
	return m, true
}

// bindMapWithPathID makes path :id authoritative for PUT updates.
func bindMapWithPathID(c *gin.Context) (map[string]interface{}, bool) {
	m, ok := bindMap(c)
	if !ok {
		return nil, false
	}
	if id := c.Param("id"); id != "" {
		m["id"] = id
	}
	return m, true
}

// Apps
func (h *Handler) ListApps(c *gin.Context) {
	list, err := h.svc.ListApps(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetApp(c *gin.Context) {
	item, err := h.svc.GetApp(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) CreateApp(c *gin.Context) {
	m, ok := bindMap(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveApp(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) UpdateApp(c *gin.Context) {
	m, ok := bindMap(c)
	if !ok {
		return
	}
	m["id"] = c.Param("id")
	item, err := h.svc.SaveApp(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteApp(c *gin.Context) {
	if err := h.svc.DeleteApp(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

// Settlements
func (h *Handler) ListSettlements(c *gin.Context) {
	list, err := h.svc.ListSettlements(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetSettlement(c *gin.Context) {
	item, err := h.svc.GetSettlement(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) GenerateSettlements(c *gin.Context) {
	n, err := h.svc.GenerateSettlements(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"created": n})
}

func (h *Handler) CreatePayout(c *gin.Context) {
	var req struct {
		BatchID string  `json:"batchId"`
		Amount  float64 `json:"amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	if err := h.svc.CreatePayout(c.Request.Context(), req.BatchID, req.Amount); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *Handler) ApproveSettlement(c *gin.Context) {
	item, err := h.svc.ApproveSettlement(c.Request.Context(), c.Param("id"), "")
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SETTLEMENT_APPROVE", "SETTLEMENT", c.Param("id"), "审核通过结算批次")
	response.OK(c, item)
}

func (h *Handler) RejectSettlement(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	item, err := h.svc.RejectSettlement(c.Request.Context(), c.Param("id"), req.Reason, "")
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SETTLEMENT_REJECT", "SETTLEMENT", c.Param("id"), "驳回结算批次: "+req.Reason)
	response.OK(c, item)
}

func (h *Handler) UploadPayoutProof(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UploadPayoutProof(c.Request.Context(), c.Param("id"), file.Filename, fmt.Sprintf("%d", file.Size))
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SETTLEMENT_PAYOUT_PROOF", "SETTLEMENT", c.Param("id"), "上传打款凭证: "+file.Filename)
	response.OK(c, item)
}

func (h *Handler) SupplementBatch(c *gin.Context) {
	n, err := h.svc.SupplementBatch(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SETTLEMENT_SUPPLEMENT", "SETTLEMENT", c.Param("id"), "批次补单")
	response.OK(c, gin.H{"added": n})
}

// Promo
func (h *Handler) ListPromo(c *gin.Context) {
	list, err := h.svc.ListPromoCampaigns(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SavePromo(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SavePromoCampaign(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeletePromo(c *gin.Context) {
	if err := h.svc.DeletePromoCampaign(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

// End users
func (h *Handler) ListEndUsers(c *gin.Context) {
	list, err := h.svc.ListEndUsers(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveEndUser(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveEndUser(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteEndUser(c *gin.Context) {
	if err := h.svc.DeleteEndUser(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

// Exchange rates
func (h *Handler) ListExchangeRates(c *gin.Context) {
	list, err := h.svc.ListExchangeRates(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveExchangeRate(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveExchangeRate(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteExchangeRate(c *gin.Context) {
	if err := h.svc.DeleteExchangeRate(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

func (h *Handler) ExchangeRateHistory(c *gin.Context) {
	list, err := h.svc.GetExchangeRateHistory(c.Request.Context(), c.Param("id"), 30)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// Fee rules
func (h *Handler) ListFeeRules(c *gin.Context) {
	list, err := h.svc.ListFeeRules(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveFeeRule(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveFeeRule(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteFeeRule(c *gin.Context) {
	if err := h.svc.DeleteFeeRule(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

// Risk
func (h *Handler) ListRiskRules(c *gin.Context) {
	list, err := h.svc.ListRiskRules(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveRiskRule(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveRiskRule(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteRiskRule(c *gin.Context) {
	if err := h.svc.DeleteRiskRule(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

func (h *Handler) ListBlacklist(c *gin.Context) {
	list, err := h.svc.ListBlacklist(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveBlacklist(c *gin.Context) {
	m, ok := bindMap(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveBlacklist(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteBlacklist(c *gin.Context) {
	if err := h.svc.DeleteBlacklist(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

// Merchant
func (h *Handler) ListMerchants(c *gin.Context) {
	list, err := h.svc.ListMerchantApplications(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) ApproveMerchant(c *gin.Context) {
	item, err := h.svc.ApproveMerchant(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) RejectMerchant(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	item, err := h.svc.RejectMerchant(c.Request.Context(), c.Param("id"), req.Reason)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

// Alerts
func (h *Handler) ListAlertRules(c *gin.Context) {
	list, err := h.svc.ListAlertRules(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) SaveAlertRule(c *gin.Context) {
	m, ok := bindMapWithPathID(c)
	if !ok {
		return
	}
	item, err := h.svc.SaveAlertRule(c.Request.Context(), m)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	if err := h.svc.DeleteAlertRule(c.Request.Context(), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{})
}

func (h *Handler) ToggleAlertRule(c *gin.Context) {
	item, err := h.svc.ToggleAlertRule(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) ListAlertHistory(c *gin.Context) {
	list, err := h.svc.ListAlertHistory(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// Reports
func (h *Handler) RevenueReport(c *gin.Context) {
	item, err := h.svc.RevenueReport(c.Request.Context(), c.Query("tenantId"), c.Query("from"), c.Query("to"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

