package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	msgsvc "github.com/novaspay/admin-api/internal/platform/messaging/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *msgsvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *msgsvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func (h *Handler) ListChannels(c *gin.Context) {
	list, err := h.svc.ListChannels(c.Request.Context(), c.Query("mode"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetChannel(c *gin.Context) {
	item, err := h.svc.GetChannel(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) CreateChannel(c *gin.Context) {
	var req msgsvc.ChannelInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateChannel(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_CHANNEL_CREATE", "EMAIL_CHANNEL", item.ID, "创建邮件渠道: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateChannel(c *gin.Context) {
	var req msgsvc.ChannelInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UpdateChannel(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_CHANNEL_UPDATE", "EMAIL_CHANNEL", item.ID, "更新邮件渠道: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteChannel(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_CHANNEL_DELETE", "EMAIL_CHANNEL", id, "删除邮件渠道")
	response.OK(c, gin.H{})
}

func (h *Handler) SetPrimary(c *gin.Context) {
	item, err := h.svc.SetPrimary(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_CHANNEL_SET_PRIMARY", "EMAIL_CHANNEL", item.ID, "设为主力邮件渠道")
	response.OK(c, item)
}

func (h *Handler) TestChannel(c *gin.Context) {
	var req struct {
		Recipient string `json:"recipient"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	msgID, err := h.svc.SendTestEmail(c.Request.Context(), c.Param("id"), req.Recipient)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_CHANNEL_TEST", "EMAIL_CHANNEL", c.Param("id"), "发送测试邮件至 "+req.Recipient)
	response.OK(c, gin.H{"messageId": msgID})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	list, err := h.svc.ListTemplates(c.Request.Context(), c.Query("keyword"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var req msgsvc.TemplateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateTemplate(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_TEMPLATE_CREATE", "EMAIL_TEMPLATE", item.ID, "创建邮件模板: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	var req msgsvc.TemplateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UpdateTemplate(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_TEMPLATE_UPDATE", "EMAIL_TEMPLATE", item.ID, "更新邮件模板: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteTemplate(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "EMAIL_TEMPLATE_DELETE", "EMAIL_TEMPLATE", id, "删除邮件模板")
	response.OK(c, gin.H{})
}

func (h *Handler) ListWebhooks(c *gin.Context) {
	page := msgsvc.ParsePage(c.Query("page"), 1)
	pageSize := msgsvc.ParsePage(c.Query("pageSize"), 20)
	list, total, err := h.svc.ListWebhooks(c.Request.Context(), page, pageSize, c.Query("keyword"), c.Query("eventType"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}
