package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

func (h *Handler) ListTasks(c *gin.Context) {
	list, err := h.svc.ListTasks(c.Request.Context(), c.Query("keyword"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetTask(c *gin.Context) {
	item, err := h.svc.GetTask(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, item)
}

func (h *Handler) CreateTask(c *gin.Context) {
	var req struct {
		Name   string `json:"name"`
		Type   string `json:"type"`
		Cron   string `json:"cron"`
		JobKey string `json:"jobKey"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.CreateTask(c.Request.Context(), req.Name, req.Type, req.Cron, req.JobKey)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SCHEDULED_TASK_STATUS", "SCHEDULED_TASK", item.ID, "创建定时任务: "+item.Name)
	response.OK(c, item)
}

func (h *Handler) UpdateTaskStatus(c *gin.Context) {
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	item, err := h.svc.SetTaskStatus(c.Request.Context(), c.Param("id"), req.Status)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "SCHEDULED_TASK_STATUS", "SCHEDULED_TASK", item.ID, "任务状态变更为 "+item.Status)
	response.OK(c, item)
}

func (h *Handler) ListRuns(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	list, total, err := h.svc.ListRuns(c.Request.Context(), c.Param("id"), page, pageSize)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}

func (h *Handler) TriggerTask(c *gin.Context) {
	_, err := h.svc.TriggerTask(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
}
