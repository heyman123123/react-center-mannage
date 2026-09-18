package handler

import (
	"io"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	paymentsvc "github.com/novaspay/admin-api/internal/payment/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *paymentsvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *paymentsvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func (h *Handler) ListChannels(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), c.Query("mode"), c.Query("channelKey"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetChannel(c *gin.Context) {
	item, err := h.svc.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) CreateChannel(c *gin.Context) {
	var req paymentsvc.ChannelInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_CHANNEL_CREATE", "PAYMENT_CHANNEL", item.ID, "创建支付渠道: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateChannel(c *gin.Context) {
	var req paymentsvc.ChannelInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_CHANNEL_UPDATE", "PAYMENT_CHANNEL", item.ID, "更新支付渠道: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_CHANNEL_DELETE", "PAYMENT_CHANNEL", id, "删除支付渠道")
	response.OK(c, gin.H{})
}

func (h *Handler) TestChannel(c *gin.Context) {
	item, err := h.svc.Test(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_CHANNEL_TEST", "PAYMENT_CHANNEL", item.ID, "支付渠道连通性测试")
	response.OK(c, item)
}

func (h *Handler) CheckoutTestChannel(c *gin.Context) {
	var req paymentsvc.CheckoutTestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateCheckoutTest(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_CHANNEL_CHECKOUT_TEST", "PAYMENT_CHANNEL", c.Param("id"), "Sandbox 测试下单")
	response.OK(c, item)
}

func (h *Handler) ListWebhooks(c *gin.Context) {
	page := paymentsvc.ParsePage(c.Query("page"), 1)
	pageSize := paymentsvc.ParsePage(c.Query("pageSize"), 20)
	list, total, err := h.svc.ListWebhooks(c.Request.Context(), page, pageSize, c.Query("channelId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}

func (h *Handler) RedeliverWebhook(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.RedeliverWebhook(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PAYMENT_WEBHOOK_REDELIVER", "PAYMENT_WEBHOOK", id, "重新投递支付 Webhook")
	response.OK(c, gin.H{"ok": true})
}

func (h *Handler) GetDashboardKPI(c *gin.Context) {
	item, err := h.svc.GetDashboardKPI(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) ListTransactions(c *gin.Context) {
	page := paymentsvc.ParsePage(c.Query("page"), 1)
	pageSize := paymentsvc.ParsePage(c.Query("pageSize"), 20)
	list, total, err := h.svc.ListTransactions(
		c.Request.Context(),
		page,
		pageSize,
		c.Query("tenantId"),
		c.Query("channel"),
		c.Query("status"),
		c.Query("keyword"),
	)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}

func (h *Handler) GetTransaction(c *gin.Context) {
	item, err := h.svc.GetTransaction(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) ListRefunds(c *gin.Context) {
	list, err := h.svc.ListRefunds(c.Request.Context(), c.Query("tenantId"), c.Query("channel"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateRefund(c *gin.Context) {
	var req paymentsvc.RefundInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateRefund(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "REFUND_CREATE", "REFUND", item.ID, "创建退款单: "+item.ID)
	response.OK(c, item)
}

func (h *Handler) ProcessRefund(c *gin.Context) {
	item, err := h.svc.ProcessRefund(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) ListChargebacks(c *gin.Context) {
	list, err := h.svc.ListChargebacks(c.Request.Context(), c.Query("tenantId"), c.Query("channel"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) AddChargebackEvidence(c *gin.Context) {
	var req paymentsvc.ChargebackEvidenceInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.AddChargebackEvidence(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) SubmitChargeback(c *gin.Context) {
	item, err := h.svc.SubmitChargeback(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) GetReconciliationSummary(c *gin.Context) {
	item, err := h.svc.GetReconciliationSummary(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) ListReconciliationBatches(c *gin.Context) {
	list, err := h.svc.ListReconciliationBatches(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) RunReconciliation(c *gin.Context) {
	count, err := h.svc.RunReconciliation(c.Request.Context(), c.Query("tenantId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "RECONCILIATION_RUN", "RECONCILIATION", "", "执行对账引擎")
	response.OK(c, gin.H{"matchedCount": count})
}

func (h *Handler) ResolveDiscrepancy(c *gin.Context) {
	var req paymentsvc.ResolveDiscrepancyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.ResolveDiscrepancy(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "RECONCILIATION_RESOLVE", "TRANSACTION", item.ID, "核销差错流水")
	response.OK(c, item)
}

func (h *Handler) CreemWebhook(c *gin.Context) {
	channelID := c.Param("channelId")
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	sig := c.GetHeader("creem-signature")
	inboundPath := c.Request.URL.Path
	if err := h.svc.HandleCreemWebhook(c.Request.Context(), channelID, sig, raw, inboundPath); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"received": true})
}
