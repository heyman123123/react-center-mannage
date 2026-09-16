package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/middleware"
	opssvc "github.com/novaspay/admin-api/internal/platform/ops/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *opssvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *opssvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func (h *Handler) ListConfigs(c *gin.Context) {
	list, err := h.svc.ListConfigs(c.Request.Context(), c.Query("category"), c.Query("keyword"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	var req struct {
		Key         string `json:"key"`
		Value       string `json:"value"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Remark      string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	updatedBy, _ := c.Get(middleware.CtxUserName)
	name, _ := updatedBy.(string)
	item, err := h.svc.CreateConfig(c.Request.Context(), req.Key, req.Value, req.Description, req.Category, req.Remark, name)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SYSTEM_CONFIG_CREATE", "SYSTEM_CONFIG", item.ID, "创建系统参数: "+item.Key)
	response.OK(c, item)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	var req struct {
		Value       string `json:"value"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Remark      string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	updatedBy, _ := c.Get(middleware.CtxUserName)
	name, _ := updatedBy.(string)
	item, err := h.svc.UpdateConfig(c.Request.Context(), c.Param("id"), req.Value, req.Description, req.Category, req.Remark, name)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SYSTEM_CONFIG_UPDATE", "SYSTEM_CONFIG", item.ID, "更新系统参数: "+item.Key)
	response.OK(c, item)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.DeleteConfig(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SYSTEM_CONFIG_DELETE", "SYSTEM_CONFIG", id, "删除系统参数")
	response.OK(c, gin.H{})
}
