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

func (h *Handler) CreemWebhook(c *gin.Context) {
	channelID := c.Param("channelId")
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	sig := c.GetHeader("creem-signature")
	if err := h.svc.HandleCreemWebhook(c.Request.Context(), channelID, sig, raw); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"received": true})
}
