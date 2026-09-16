package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

type TaskDTO struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	JobKey        string `json:"jobKey"`
	Cron          string `json:"cron"`
	LastRunAt     *int64 `json:"lastRunAt,omitempty"`
	LastRunStatus string `json:"lastRunStatus,omitempty"`
	NextRunAt     *int64 `json:"nextRunAt,omitempty"`
	Status        string `json:"status"`
}

type RunDTO struct {
	ID            string `json:"id"`
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	StartedAt     int64  `json:"startedAt"`
	FinishedAt    int64  `json:"finishedAt,omitempty"`
	DurationMs    int    `json:"durationMs"`
	Summary       string `json:"summary"`
	TriggerSource string `json:"triggerSource"`
}

func (s *Service) ListTasks(ctx context.Context, keyword string) ([]TaskDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.ScheduledTask{})
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("(name ILIKE ? OR type ILIKE ? OR job_key ILIKE ?)", like, like, like)
	}
	var rows []persistence.ScheduledTask
	if err := q.Order("name ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]TaskDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, taskDTO(r))
	}
	return out, nil
}

func (s *Service) GetTask(ctx context.Context, id string) (*TaskDTO, error) {
	var row persistence.ScheduledTask
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	dto := taskDTO(row)
	return &dto, nil
}

func (s *Service) CreateTask(ctx context.Context, name, typ, cron, jobKey string) (*TaskDTO, error) {
	if name == "" || typ == "" || cron == "" {
		return nil, apperr.InvalidArgument
	}
	if jobKey == "" {
		jobKey = typ
	}
	row := persistence.ScheduledTask{
		ID: uuid.NewString(), Name: name, Type: typ, JobKey: jobKey,
		Cron: cron, Status: "DISABLED", LogsJSON: "[]",
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, err
	}
	dto := taskDTO(row)
	return &dto, nil
}

func (s *Service) SetTaskStatus(ctx context.Context, id, status string) (*TaskDTO, error) {
	if status != "ENABLED" && status != "DISABLED" {
		return nil, apperr.InvalidArgument
	}
	var row persistence.ScheduledTask
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	if err := s.db.WithContext(ctx).Model(&row).Update("status", status).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := taskDTO(row)
	return &dto, nil
}

func (s *Service) ListRuns(ctx context.Context, taskID string, page, pageSize int) ([]RunDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	var task persistence.ScheduledTask
	if err := s.db.WithContext(ctx).First(&task, "id = ?", taskID).Error; err != nil {
		return nil, 0, apperr.NotFound
	}
	q := s.db.WithContext(ctx).Model(&persistence.ScheduledTaskRun{}).Where("task_id = ?", taskID)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []persistence.ScheduledTaskRun
	if err := q.Order("started_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]RunDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, runDTO(r))
	}
	return out, total, nil
}

func (s *Service) TriggerTask(ctx context.Context, id string) (*TaskDTO, error) {
	var row persistence.ScheduledTask
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	return nil, apperr.ExecutorDisabled
}

func taskDTO(r persistence.ScheduledTask) TaskDTO {
	return TaskDTO{
		ID: r.ID, Name: r.Name, Type: r.Type, JobKey: r.JobKey, Cron: r.Cron,
		LastRunAt: r.LastRunAt, LastRunStatus: r.LastRunStatus, NextRunAt: r.NextRunAt,
		Status: r.Status,
	}
}

func runDTO(r persistence.ScheduledTaskRun) RunDTO {
	return RunDTO{
		ID: r.ID, TaskID: r.TaskID, Status: r.Status,
		StartedAt: r.StartedAt, FinishedAt: timex.Val(r.FinishedAt),
		DurationMs: r.DurationMs, Summary: r.Summary, TriggerSource: r.TriggerSource,
	}
}
