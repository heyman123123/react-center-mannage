package persistence

import (
	"fmt"
	"time"

	"github.com/novaspay/admin-api/internal/conf"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDB(cfg *conf.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.PostgresDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&UserRole{},
		&Menu{},
		&Role{},
		&RoleMenu{},
		&Department{},
		&UserDepartment{},
		&DepartmentRole{},
		&Language{},
		&DictionaryEntry{},
		&PermissionPack{},
		&PermissionPackMenu{},
		&RolePack{},
		&RoleApp{},
		&DictionaryCategory{},
		&AuditLog{},
		&SystemConfig{},
		&ScheduledTask{},
		&ScheduledTaskRun{},
	)
}

// 业务时间字段统一存 UTC Unix 秒（int64）；展示/按时区换算留给查询侧。

type User struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	Email        string         `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Name         string         `gorm:"size:128;not null" json:"name"`
	PasswordHash string         `gorm:"column:password_hash;size:255;not null" json:"-"`
	Phone        string         `gorm:"size:64" json:"phone"`
	Status       string         `gorm:"size:16;not null;default:ACTIVE" json:"status"`
	AvatarText   string         `gorm:"size:8" json:"avatarText"`
	LastLoginAt  *int64         `json:"lastLoginAt"`
	CreatedAt    int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type UserRole struct {
	UserID  string `gorm:"type:uuid;primaryKey"`
	RoleKey string `gorm:"size:64;primaryKey"`
}

type Menu struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID  *string        `gorm:"type:uuid;index" json:"parentId"`
	Key       string         `gorm:"size:128;uniqueIndex;not null" json:"key"`
	Title     string         `gorm:"size:128;not null" json:"title"`
	MenuType  string         `gorm:"size:32;not null;default:route" json:"menuType"`
	Path      string         `gorm:"size:255" json:"path"`
	Icon      string         `gorm:"size:64" json:"icon"`
	SortOrder int            `gorm:"not null;default:1" json:"sortOrder"`
	Hidden    bool           `gorm:"not null;default:false" json:"hidden"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Role struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string         `gorm:"size:64;uniqueIndex;not null" json:"key"`
	Name        string         `gorm:"size:128;not null" json:"name"`
	Description string         `gorm:"size:512" json:"description"`
	IsCustom    bool           `gorm:"not null;default:true" json:"isCustom"`
	CreatedAt   int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type RoleMenu struct {
	RoleID string `gorm:"type:uuid;primaryKey"`
	MenuID string `gorm:"type:uuid;primaryKey"`
}

type PermissionPack struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string         `gorm:"size:64;uniqueIndex;not null" json:"key"`
	Name        string         `gorm:"size:128;not null" json:"name"`
	Description string         `gorm:"size:512" json:"description"`
	CreatedAt   int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type PermissionPackMenu struct {
	PackID string `gorm:"type:uuid;primaryKey"`
	MenuID string `gorm:"type:uuid;primaryKey"`
}

type RolePack struct {
	RoleID string `gorm:"type:uuid;primaryKey"`
	PackID string `gorm:"type:uuid;primaryKey"`
}

type RoleApp struct {
	RoleID string `gorm:"type:uuid;primaryKey"`
	AppID  string `gorm:"size:64;primaryKey"` // UUID 或 "ALL"
}

type Department struct {
	ID          string         `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID    *string        `gorm:"type:uuid;index" json:"parentId"`
	Name        string         `gorm:"size:128;not null" json:"name"`
	Code        string         `gorm:"size:64;uniqueIndex;not null" json:"code"`
	SortOrder   int            `gorm:"not null;default:1" json:"sortOrder"`
	Leader      string         `gorm:"size:128" json:"leader"`
	Description string         `gorm:"size:512" json:"description"`
	CreatedAt   int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type UserDepartment struct {
	UserID       string `gorm:"type:uuid;primaryKey"`
	DepartmentID string `gorm:"type:uuid;primaryKey"`
}

type DepartmentRole struct {
	DepartmentID string `gorm:"type:uuid;primaryKey"`
	RoleKey      string `gorm:"size:64;primaryKey"`
}

type Language struct {
	Code      string `gorm:"size:16;primaryKey" json:"code"`
	Name      string `gorm:"size:64;not null" json:"name"`
	Enabled   bool   `gorm:"not null;default:true" json:"enabled"`
	SortOrder int    `gorm:"not null;default:1" json:"sortOrder"`
}

type DictionaryCategory struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID  *string        `gorm:"type:uuid;index" json:"parentId"`
	Key       string         `gorm:"size:64;uniqueIndex;not null" json:"key"`
	Name      string         `gorm:"size:128;not null" json:"name"`
	IsSystem  bool           `gorm:"not null;default:false" json:"isSystem"`
	SortOrder int            `gorm:"not null;default:1" json:"sortOrder"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type DictionaryEntry struct {
	ID           string         `gorm:"type:uuid;primaryKey" json:"id"`
	Namespace    string         `gorm:"size:128;not null;uniqueIndex:ux_dict_ns_key" json:"namespace"`
	EntryKey     string         `gorm:"size:256;not null;uniqueIndex:ux_dict_ns_key" json:"entryKey"`
	Description  string         `gorm:"size:512" json:"description"`
	Translations string         `gorm:"type:jsonb;not null;default:'{}'" json:"translations"`
	Category     string         `gorm:"size:64;default:general" json:"category"`
	CategoryID   *string        `gorm:"type:uuid;index" json:"categoryId"`
	CreatedAt    int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt    int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type AuditLog struct {
	ID             string `gorm:"type:uuid;primaryKey"`
	Action         string `gorm:"size:64"`
	UserID         string `gorm:"type:uuid;index"`
	UserName       string `gorm:"size:128"`
	Role           string `gorm:"size:64"`
	TargetResource string `gorm:"size:128"`
	TargetID       string `gorm:"size:64"`
	Details        string `gorm:"type:text"`
	IPAddress      string `gorm:"size:64"`
	Status         string `gorm:"size:16"`
	CreatedAt      int64  `gorm:"autoCreateTime;index"`
}

type SystemConfig struct {
	ID          string `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string `gorm:"size:128;uniqueIndex;not null" json:"key"`
	Value       string `gorm:"type:text;not null" json:"value"`
	Description string `gorm:"size:512" json:"description"`
	Category    string `gorm:"size:32;not null;index" json:"category"`
	Remark      string `gorm:"size:512" json:"remark"`
	UpdatedBy   string `gorm:"size:128" json:"updatedBy"`
	CreatedAt   int64  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   int64  `gorm:"autoUpdateTime" json:"updatedAt"`
}

type ScheduledTask struct {
	ID            string `gorm:"type:uuid;primaryKey" json:"id"`
	Name          string `gorm:"size:128;not null" json:"name"`
	Type          string `gorm:"size:64;not null" json:"type"`
	JobKey        string `gorm:"size:128;index" json:"jobKey"`
	Cron          string `gorm:"size:64;not null" json:"cron"`
	LastRunAt     *int64 `json:"lastRunAt"`
	LastRunStatus string `gorm:"size:16" json:"lastRunStatus"`
	NextRunAt     *int64 `json:"nextRunAt"`
	Status        string `gorm:"size:16;not null;default:DISABLED" json:"status"`
	LogsJSON      string `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	CreatedAt     int64  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     int64  `gorm:"autoUpdateTime" json:"updatedAt"`
}

type ScheduledTaskRun struct {
	ID            string `gorm:"type:uuid;primaryKey" json:"id"`
	TaskID        string `gorm:"type:uuid;not null;index:idx_task_runs_started,priority:1" json:"taskId"`
	Status        string `gorm:"size:16;not null" json:"status"`
	StartedAt     int64  `gorm:"index:idx_task_runs_started,priority:2" json:"startedAt"`
	FinishedAt    *int64 `json:"finishedAt"`
	DurationMs    int    `json:"durationMs"`
	Summary       string `gorm:"size:512" json:"summary"`
	DetailJSON    string `gorm:"type:jsonb;not null;default:'{}'" json:"detailJson"`
	TriggerSource string `gorm:"size:16;not null;default:MANUAL" json:"triggerSource"`
	CreatedAt     int64  `gorm:"autoCreateTime" json:"createdAt"`
}
