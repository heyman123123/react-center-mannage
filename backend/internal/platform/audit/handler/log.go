package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct{ svc *auditsvc.Service }

func NewHandler(svc *auditsvc.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	actions := auditsvc.SplitCSV(c.Query("actions"))
	if a := c.Query("action"); a != "" {
		actions = append(actions, auditsvc.SplitCSV(a)...)
	}
	userIds := auditsvc.SplitCSV(c.Query("userIds"))
	list, total, err := h.svc.List(
		c.Request.Context(), page, pageSize,
		c.Query("keyword"), actions, userIds, c.Query("operator"),
	)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}
