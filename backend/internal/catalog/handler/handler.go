package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	catalogsvc "github.com/novaspay/admin-api/internal/catalog/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *catalogsvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *catalogsvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func (h *Handler) ListProducts(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context(), c.Query("tenantId"), c.Query("channelId"), c.Query("keyword"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req catalogsvc.ProductInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PRODUCT_CREATE", "PRODUCT", item.ID, "创建商品: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	var req catalogsvc.ProductInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PRODUCT_UPDATE", "PRODUCT", item.ID, "更新商品: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PRODUCT_DELETE", "PRODUCT", id, "删除商品")
	response.OK(c, gin.H{})
}

func (h *Handler) SyncProduct(c *gin.Context) {
	item, err := h.svc.SyncFromProvider(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) SyncFromCreem(c *gin.Context) {
	channelID := c.Query("channelId")
	result, err := h.svc.SyncFromCreem(c.Request.Context(), channelID)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PRODUCT_SYNC_FROM_CREEM", "PAYMENT_CHANNEL", channelID, "从 Creem 同步商品")
	response.OK(c, result)
}

func (h *Handler) ListDiscounts(c *gin.Context) {
	list, err := h.svc.ListDiscounts(c.Request.Context(), c.Query("tenantId"), c.Query("channelId"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateDiscount(c *gin.Context) {
	var req catalogsvc.DiscountInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateDiscount(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DISCOUNT_CREATE", "DISCOUNT", item.ID, "创建折扣: "+item.Code)
	response.OK(c, item)
}

func (h *Handler) UpdateDiscount(c *gin.Context) {
	var req catalogsvc.DiscountInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UpdateDiscount(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DISCOUNT_UPDATE", "DISCOUNT", item.ID, "更新折扣: "+item.Code)
	response.OK(c, item)
}

func (h *Handler) DeleteDiscount(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteDiscount(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DISCOUNT_DELETE", "DISCOUNT", id, "删除折扣")
	response.OK(c, gin.H{})
}
