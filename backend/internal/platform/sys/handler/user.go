package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
	syssvc "github.com/novaspay/admin-api/internal/platform/sys/service"
)

type UserHandler struct {
	svc   *syssvc.UserService
	audit *auditsvc.Service
}

func NewUserHandler(svc *syssvc.UserService, auditSvc *auditsvc.Service) *UserHandler {
	return &UserHandler{svc: svc, audit: auditSvc}
}

func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	list, total, err := h.svc.List(c.Request.Context(), page, pageSize, c.Query("keyword"), c.Query("status"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}

func (h *UserHandler) Create(c *gin.Context) {
	var req struct {
		Email         string   `json:"email"`
		Name          string   `json:"name"`
		Phone         string   `json:"phone"`
		RoleKeys      []string `json:"roleKeys"`
		DepartmentIDs []string `json:"departmentIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, plain, err := h.svc.Create(c.Request.Context(), req.Email, req.Name, req.Phone, req.RoleKeys, req.DepartmentIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "USER_CREATE", "USERS", item.ID, "创建系统用户: "+item.Email)
	response.OK(c, gin.H{"user": item, "initialPassword": plain})
}

func (h *UserHandler) Update(c *gin.Context) {
	var req struct {
		Name          string   `json:"name"`
		Phone         string   `json:"phone"`
		Status        string   `json:"status"`
		RoleKeys      []string `json:"roleKeys"`
		DepartmentIDs []string `json:"departmentIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req.Name, req.Phone, req.Status, req.RoleKeys, req.DepartmentIDs)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "USER_UPDATE", "USERS", item.ID, "更新系统用户: "+item.Email)
	response.OK(c, item)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "USER_DELETE", "USERS", id, "删除系统用户")
	response.OK(c, gin.H{})
}

func (h *UserHandler) ResetPassword(c *gin.Context) {
	id := c.Param("id")
	plain, err := h.svc.ResetPassword(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "USER_RESET_PASSWORD", "USERS", id, "重置系统用户密码")
	response.OK(c, gin.H{"password": plain})
}
