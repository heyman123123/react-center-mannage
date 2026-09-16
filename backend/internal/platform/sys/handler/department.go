package handler

import (
	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type DepartmentHandler struct {
	svc   *syssvc.DepartmentService
	audit *auditsvc.Service
}

func NewDepartmentHandler(svc *syssvc.DepartmentService, auditSvc *auditsvc.Service) *DepartmentHandler {
	return &DepartmentHandler{svc: svc, audit: auditSvc}
}

func (h *DepartmentHandler) Tree(c *gin.Context) {
	tree, err := h.svc.Tree(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, tree)
}

func (h *DepartmentHandler) Create(c *gin.Context) {
	var req syssvc.DeptInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DEPARTMENT_CREATE", "DEPARTMENTS", item.ID, "创建部门: "+item.Name)
	response.OK(c, item)
}

func (h *DepartmentHandler) Update(c *gin.Context) {
	var req syssvc.DeptInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DEPARTMENT_UPDATE", "DEPARTMENTS", item.ID, "更新部门: "+item.Name)
	response.OK(c, item)
}

func (h *DepartmentHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DEPARTMENT_DELETE", "DEPARTMENTS", id, "删除部门")
	response.OK(c, gin.H{})
}

func (h *DepartmentHandler) Transfer(c *gin.Context) {
	var req struct {
		DepartmentID string `json:"departmentId"`
		NewParentID  string `json:"newParentId"`
		UserID       string `json:"userId"`
		TargetDeptID string `json:"targetDepartmentId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	if err := h.svc.Transfer(c.Request.Context(), req.DepartmentID, req.NewParentID, req.UserID, req.TargetDeptID); err != nil {
		response.Fail(c, err)
		return
	}
	target := req.DepartmentID
	if req.UserID != "" {
		target = req.UserID
	}
	h.audit.WriteFromContext(c, "DEPARTMENT_TRANSFER", "DEPARTMENTS", target, "部门/成员转移")
	response.OK(c, gin.H{})
}
