package handler

import (
	"github.com/gin-gonic/gin"
	dictsvc "github.com/novaspay/admin-api/internal/platform/dictionary/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

func (h *Handler) ListCategories(c *gin.Context) {
	tree, err := h.svc.ListCategories(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, tree)
}

func (h *Handler) CreateCategory(c *gin.Context) {
	var req dictsvc.CategoryInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateCategory(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_CATEGORY_CREATE", "DICTIONARY", item.ID, "创建字典分类: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateCategory(c *gin.Context) {
	var req dictsvc.CategoryInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UpdateCategory(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_CATEGORY_UPDATE", "DICTIONARY", item.ID, "更新字典分类: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteCategory(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_CATEGORY_DELETE", "DICTIONARY", id, "删除字典分类")
	response.OK(c, gin.H{})
}
