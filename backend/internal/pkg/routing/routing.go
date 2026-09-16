package routing

import "github.com/gin-gonic/gin"

// RouteFunc registers routes under /api/v1.
type RouteFunc func(r *gin.RouterGroup)
