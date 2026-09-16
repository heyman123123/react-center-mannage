package service

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/middleware"
	"github.com/novaspay/admin-api/internal/pkg/timex"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type Entry struct {
	Action         string
	UserID         string
	UserName       string
	Role           string
	TargetResource string
	TargetID       string
	Details        string
	IPAddress      string
	Status         string
}

type DTO struct {
	ID             string `json:"id"`
	Action         string `json:"action"`
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	Operator       string `json:"operator"`
	OperatorRole   string `json:"operatorRole"`
	Role           string `json:"role"`
	TargetResource string `json:"targetResource"`
	TargetID       string `json:"targetId"`
	Details        string `json:"details"`
	IPAddress      string `json:"ipAddress"`
	Status         string `json:"status"`
	Timestamp      int64  `json:"timestamp"`
	TenantID       string `json:"tenantId"`
}

func (s *Service) Write(ctx context.Context, e Entry) {
	if e.Status == "" {
		e.Status = "SUCCESS"
	}
	_ = s.db.WithContext(ctx).Create(&persistence.AuditLog{
		ID:             uuid.NewString(),
		Action:         e.Action,
		UserID:         e.UserID,
		UserName:       e.UserName,
		Role:           e.Role,
		TargetResource: e.TargetResource,
		TargetID:       e.TargetID,
		Details:        e.Details,
		IPAddress:      e.IPAddress,
		Status:         e.Status,
		CreatedAt:      timex.Now(),
	}).Error
}

func (s *Service) WriteFromContext(c *gin.Context, action, resource, targetID, details string) {
	uid, _ := c.Get(middleware.CtxUserID)
	uname, _ := c.Get(middleware.CtxUserName)
	userID, _ := uid.(string)
	userName, _ := uname.(string)
	s.Write(c.Request.Context(), Entry{
		Action:         action,
		UserID:         userID,
		UserName:       userName,
		TargetResource: resource,
		TargetID:       targetID,
		Details:        details,
		IPAddress:      c.ClientIP(),
		Status:         "SUCCESS",
	})
}

func SplitCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" && !strings.EqualFold(p, "ALL") {
			out = append(out, p)
		}
	}
	return out
}

func (s *Service) List(ctx context.Context, page, pageSize int, keyword string, actions, userIds []string, legacyOperator string) ([]DTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}
	q := s.db.WithContext(ctx).Model(&persistence.AuditLog{})
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("(action ILIKE ? OR details ILIKE ? OR target_resource ILIKE ? OR target_id ILIKE ? OR user_name ILIKE ?)",
			like, like, like, like, like)
	}
	if len(actions) > 0 {
		q = q.Where("action IN ?", actions)
	}
	if len(userIds) > 0 {
		q = q.Where("user_id IN ?", userIds)
	} else if legacyOperator != "" && !strings.EqualFold(legacyOperator, "ALL") {
		q = q.Where("user_name = ?", legacyOperator)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []persistence.AuditLog
	if err := q.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]DTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDTO(r))
	}
	return out, total, nil
}

func toDTO(r persistence.AuditLog) DTO {
	name := r.UserName
	return DTO{
		ID: r.ID, Action: r.Action, UserID: r.UserID, UserName: name,
		Operator: name, OperatorRole: r.Role, Role: r.Role,
		TargetResource: r.TargetResource, TargetID: r.TargetID, Details: r.Details,
		IPAddress: r.IPAddress, Status: r.Status,
		Timestamp: r.CreatedAt,
		TenantID:  "group_hq",
	}
}

