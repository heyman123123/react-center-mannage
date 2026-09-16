package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type RoleHandler struct {
	svc   *syssvc.RoleService
	audit *auditsvc.Service
}

func NewRoleHandler(svc *syssvc.RoleService, auditSvc *auditsvc.Service) *RoleHandler {
	return &RoleHandler{svc: svc, audit: auditSvc}
}

func (h *RoleHandler) List(c *gin.Context) {
	list, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *RoleHandler) Create(c *gin.Context) {
	var req struct {
		Key         string   `json:"key"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		PackIDs     []string `json:"packIds"`
		AppIDs      []string `json:"appIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req.Key, req.Name, req.Description, req.PackIDs, req.AppIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "ROLE_CREATE", "ROLES", item.ID, "创建角色: "+item.Name)
	response.OK(c, item)
}

func (h *RoleHandler) Update(c *gin.Context) {
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
	h.audit.WriteFromContext(c, "ROLE_UPDATE", "ROLES", item.ID, "更新角色: "+item.Name)
	response.OK(c, item)
}

func (h *RoleHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "ROLE_DELETE", "ROLES", id, "删除角色")
	response.OK(c, gin.H{})
}

func (h *RoleHandler) UpdatePermissions(c *gin.Context) {
	var req struct {
		PackIDs []string `json:"packIds"`
		AppIDs  []string `json:"appIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.UpdatePermissions(c.Request.Context(), c.Param("id"), req.PackIDs, req.AppIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "ROLE_UPDATE_PERMISSIONS", "ROLES", item.ID, "更新角色权限: "+item.Name)
	response.OK(c, item)
}
