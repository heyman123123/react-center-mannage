package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
)

type Body struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type PageData struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Body{Code: 0, Message: "ok", Data: data})
}

func OKPage(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	OK(c, PageData{List: list, Total: total, Page: page, PageSize: pageSize})
}

func Fail(c *gin.Context, err error) {
	if ae, ok := err.(*apperr.Error); ok {
		c.JSON(ae.HTTP, Body{Code: ae.Code, Message: ae.Message, Data: nil})
		return
	}
	c.JSON(http.StatusInternalServerError, Body{Code: 50000, Message: err.Error(), Data: nil})
}
