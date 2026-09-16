package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type MenuHandler struct {
	svc   *syssvc.MenuService
	audit *auditsvc.Service
}

func NewMenuHandler(svc *syssvc.MenuService, auditSvc *auditsvc.Service) *MenuHandler {
	return &MenuHandler{svc: svc, audit: auditSvc}
}

func (h *MenuHandler) Tree(c *gin.Context) {
	tree, err := h.svc.Tree(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, tree)
}

func (h *MenuHandler) ReplaceTree(c *gin.Context) {
	var req []syssvc.MenuInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	tree, err := h.svc.ReplaceTree(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "MENU_REPLACE_TREE", "MENUS", "", "替换菜单树")
	response.OK(c, tree)
}

func (h *MenuHandler) Create(c *gin.Context) {
	var req syssvc.MenuInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "MENU_CREATE", "MENUS", item.ID, "创建菜单: "+item.Title)
	response.OK(c, item)
}

func (h *MenuHandler) Update(c *gin.Context) {
	var req syssvc.MenuInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "MENU_UPDATE", "MENUS", item.ID, "更新菜单: "+item.Title)
	response.OK(c, item)
}

func (h *MenuHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "MENU_DELETE", "MENUS", id, "删除菜单")
	response.OK(c, gin.H{})
}
