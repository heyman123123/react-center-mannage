package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type PackHandler struct {
	svc   *syssvc.PackService
	audit *auditsvc.Service
}

func NewPackHandler(svc *syssvc.PackService, auditSvc *auditsvc.Service) *PackHandler {
	return &PackHandler{svc: svc, audit: auditSvc}
}

func (h *PackHandler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *PackHandler) Create(c *gin.Context) {
	var req struct {
		Key         string   `json:"key"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		MenuIDs     []string `json:"menuIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req.Key, req.Name, req.Description, req.MenuIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PACK_CREATE", "PERMISSION_PACKS", item.ID, "创建权限包: "+item.Name)
	response.OK(c, item)
}

func (h *PackHandler) Update(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req.Name, req.Description)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PACK_UPDATE", "PERMISSION_PACKS", item.ID, "更新权限包: "+item.Name)
	response.OK(c, item)
}

func (h *PackHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PACK_DELETE", "PERMISSION_PACKS", id, "删除权限包")
	response.OK(c, gin.H{})
}

func (h *PackHandler) ReplaceMenus(c *gin.Context) {
	var req struct {
		MenuIDs []string `json:"menuIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.ReplaceMenus(c.Request.Context(), c.Param("id"), req.MenuIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "PACK_UPDATE_MENUS", "PERMISSION_PACKS", item.ID, "更新权限包菜单: "+item.Name)
	response.OK(c, item)
}
