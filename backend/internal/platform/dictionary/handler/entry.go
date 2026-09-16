package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	auditsvc "github.com/novaspay/admin-api/internal/platform/audit/service"
	dictsvc "github.com/novaspay/admin-api/internal/platform/dictionary/service"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/response"
)

type Handler struct {
	svc   *dictsvc.Service
	audit *auditsvc.Service
}

func NewHandler(svc *dictsvc.Service, auditSvc *auditsvc.Service) *Handler {
	return &Handler{svc: svc, audit: auditSvc}
}

func (h *Handler) ListLanguages(c *gin.Context) {
	list, err := h.svc.ListLanguages(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) ListEntries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	list, total, err := h.svc.ListEntries(
		c.Request.Context(), page, pageSize,
		c.Query("keyword"), c.Query("namespace"), c.Query("categoryId"),
	)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, pageSize)
}

func (h *Handler) CreateEntry(c *gin.Context) {
	var req struct {
		Namespace    string            `json:"namespace"`
		EntryKey     string            `json:"entryKey"`
		Key          string            `json:"key"`
		Description  string            `json:"description"`
		Category     string            `json:"category"`
		CategoryID   string            `json:"categoryId"`
		Translations map[string]string `json:"translations"`
		Label        string            `json:"label"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	key := req.EntryKey
	if key == "" {
		key = req.Key
	}
	tr := req.Translations
	if tr == nil {
		tr = map[string]string{}
	}
	if req.Label != "" && tr["zh-CN"] == "" {
		tr["zh-CN"] = req.Label
	}
	item, err := h.svc.Create(c.Request.Context(), req.Namespace, key, req.Description, req.Category, req.CategoryID, tr)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_CREATE", "DICTIONARY", item.ID, "创建字典: "+item.Key)
	response.OK(c, item)
}

func (h *Handler) UpdateEntry(c *gin.Context) {
	var req struct {
		Description  string            `json:"description"`
		Category     string            `json:"category"`
		CategoryID   string            `json:"categoryId"`
		Translations map[string]string `json:"translations"`
		Label        string            `json:"label"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, apperr.InvalidArgument)
		return
	}
	tr := req.Translations
	if req.Label != "" {
		if tr == nil {
			tr = map[string]string{}
		}
		tr["zh-CN"] = req.Label
	}
	item, err := h.svc.Update(c.Request.Context(), c.Param("id"), req.Description, req.Category, req.CategoryID, tr)
	if err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_UPDATE", "DICTIONARY", item.ID, "更新字典: "+item.Key)
	response.OK(c, item)
}

func (h *Handler) DeleteEntry(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	h.audit.WriteFromContext(c, "DICTIONARY_DELETE", "DICTIONARY", id, "删除字典词条")
	response.OK(c, gin.H{})
}
