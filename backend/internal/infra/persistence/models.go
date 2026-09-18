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
		&Tenant{},
		&EmailChannel{},
		&EmailTemplate{},
		&PaymentChannel{},
		&CatalogProduct{},
		&CatalogDiscount{},
		// 订单 / Webhook / 退款 / 拒付 / 审计 / 邮件 Webhook 日志按月分表，见 internal/infra/sharding
		&PaymentApp{},
		&SettlementBatch{},
		&PromoCampaign{},
		&EndUser{},
		&ExchangeRate{},
		&ExchangeRateHistory{},
		&FeeRule{},
		&RiskRule{},
		&BlacklistEntry{},
		&MerchantApplication{},
		&AlertRule{},
		&AlertHistory{},
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

// Tenant 业务单元 / 租户（M2）
type Tenant struct {
	ID                   string         `gorm:"size:64;primaryKey" json:"id"`
	Name                 string         `gorm:"size:256;not null" json:"name"`
	Code                 string         `gorm:"size:64;uniqueIndex;not null" json:"code"`
	Currency             string         `gorm:"size:8;not null;default:USD" json:"currency"`
	Description          string         `gorm:"size:512" json:"description"`
	Color                string         `gorm:"size:32" json:"color"`
	DailyCap             int64          `gorm:"not null;default:0" json:"dailyCap"`
	UsedToday            int64          `gorm:"not null;default:0" json:"usedToday"`
	ChannelsEnabledJSON  string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	IsolationLevel       string         `gorm:"size:32;not null;default:LOGICAL_TENANT" json:"isolationLevel"`
	ActiveMerchantsCount int            `gorm:"not null;default:0" json:"activeMerchantsCount"`
	CreatedAt            int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt            int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

// EmailChannel 邮件发信渠道
type EmailChannel struct {
	ID             string         `gorm:"type:uuid;primaryKey" json:"id"`
	ProviderKey    string         `gorm:"size:32;not null;index" json:"providerKey"`
	Name           string         `gorm:"size:128;not null" json:"name"`
	Description    string         `gorm:"size:512" json:"description"`
	Environment    string         `gorm:"size:16;not null;default:live;index" json:"environment"`
	Enabled        bool           `gorm:"not null;default:true" json:"enabled"`
	IsPrimary      bool           `gorm:"not null;default:false" json:"isPrimary"`
	SenderEmail    string         `gorm:"size:255;not null" json:"senderEmail"`
	SenderName     string         `gorm:"size:128" json:"senderName"`
	ApiKey         string         `gorm:"size:512;not null" json:"-"`
	SmtpHost       string         `gorm:"size:255" json:"smtpHost"`
	SmtpPort       int            `gorm:"not null;default:587" json:"smtpPort"`
	DailyQuota     int            `gorm:"not null;default:50000" json:"dailyQuota"`
	SentToday      int            `gorm:"not null;default:0" json:"sentToday"`
	VerifiedDomain string         `gorm:"size:255" json:"verifiedDomain"`
	SpfDkimStatus  string         `gorm:"size:16;not null;default:PENDING" json:"spfDkimStatus"`
	LastTestedAt   *int64         `json:"lastTestedAt"`
	CreatedAt      int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt      int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// EmailTemplate 多语言邮件模板
type EmailTemplate struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	Code                 string         `gorm:"size:128;uniqueIndex;not null" json:"code"`
	Name                 string         `gorm:"size:256;not null" json:"name"`
	Language             string         `gorm:"size:16;not null" json:"language"`
	Category             string         `gorm:"size:32;not null;default:SYSTEM" json:"category"`
	Description          string         `gorm:"size:512" json:"description"`
	TriggerEvent         string         `gorm:"size:128" json:"triggerEvent"`
	Subject              string         `gorm:"size:512;not null" json:"subject"`
	SenderName           string         `gorm:"size:128" json:"senderName"`
	SenderEmail          string         `gorm:"size:255" json:"senderEmail"`
	PreviewText          string         `gorm:"size:512" json:"previewText"`
	ContentMarkdown      string         `gorm:"type:text" json:"contentMarkdown"`
	Status               string         `gorm:"size:16;not null;default:DRAFT" json:"status"`
	AssociatedTenantID   string         `gorm:"size:64;default:ALL" json:"associatedTenantId"`
	VariablesJSON        string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	DictReferencesJSON   string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	CreatedAt            int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt            int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

// EmailWebhookLog 邮件投递回执
type EmailWebhookLog struct {
	ID           string `gorm:"type:uuid;primaryKey" json:"id"`
	MessageID    string `gorm:"size:128;index" json:"messageId"`
	EventType    string `gorm:"size:64;index" json:"eventType"`
	Provider     string `gorm:"size:32" json:"provider"`
	Recipient    string `gorm:"size:255;index" json:"recipient"`
	Subject      string `gorm:"size:512" json:"subject"`
	TemplateCode string `gorm:"size:128" json:"templateCode"`
	Status       string `gorm:"size:16" json:"status"`
	IP           string `gorm:"size:64" json:"ip"`
	UserAgent    string `gorm:"size:512" json:"userAgent"`
	Details      string `gorm:"type:text" json:"details"`
	CreatedAt    int64  `gorm:"autoCreateTime;index" json:"createdAt"`
}

// PaymentChannel 支付渠道账号（支持多 Creem 账号，后期智能路由）
type PaymentChannel struct {
	ID                      string         `gorm:"type:uuid;primaryKey" json:"id"`
	ChannelKey              string         `gorm:"size:32;not null;index" json:"channelKey"`
	Name                    string         `gorm:"size:128;not null" json:"name"`
	AccountName             string         `gorm:"size:128" json:"accountName"`
	Description             string         `gorm:"size:512" json:"description"`
	Environment             string         `gorm:"size:16;not null;default:live;index" json:"environment"`
	Enabled                 bool           `gorm:"not null;default:true" json:"enabled"`
	ApiKey                  string         `gorm:"size:512;not null" json:"-"`
	WebhookSecret           string         `gorm:"size:512" json:"-"`
	ApiPublicKey            string         `gorm:"size:512" json:"apiPublicKey"`
	ApiSecretKey            string         `gorm:"size:512" json:"-"`
	WebhookSecretDisplay    string         `gorm:"size:512" json:"-"`
	SupportedCurrenciesJSON string         `gorm:"type:jsonb;not null;default:'[\"USD\"]'" json:"-"`
	FeeRateText             string         `gorm:"size:64" json:"feeRateText"`
	RoutingPriority         int            `gorm:"not null;default:1" json:"routingPriority"`
	FallbackChannelID       *string        `gorm:"type:uuid" json:"fallbackChannelId"`
	TenantID                string         `gorm:"size:64;index;default:ALL" json:"tenantId"`
	TestStatus              string         `gorm:"size:16;not null;default:DOWN" json:"testStatus"`
	HealthStatus            string         `gorm:"size:16;not null;default:UNKNOWN" json:"healthStatus"`
	LatencyMs               int            `gorm:"not null;default:0" json:"latencyMs"`
	LastTestedAt            *int64         `json:"lastTestedAt"`
	LastHealthAt            *int64         `json:"lastHealthAt"`
	CreatedAt               int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt               int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"-"`
}

// CatalogProduct 商品（Creem 单向同步）
type CatalogProduct struct {
	ID                string         `gorm:"type:uuid;primaryKey" json:"id"`
	ChannelID         string         `gorm:"type:uuid;not null;index" json:"channelId"`
	TenantID          string         `gorm:"size:64;not null;index" json:"tenantId"`
	Code              string         `gorm:"size:128;not null;index" json:"code"`
	Name              string         `gorm:"size:256;not null" json:"name"`
	Description       string         `gorm:"type:text" json:"description"`
	ProductType       string         `gorm:"size:32;not null" json:"productType"`
	Currency          string         `gorm:"size:8;not null" json:"currency"`
	PriceCents        int64          `gorm:"not null" json:"priceCents"`
	BillingInterval   string         `gorm:"size:32" json:"billingInterval"`
	TrialDays         int            `gorm:"not null;default:0" json:"trialDays"`
	Status            string         `gorm:"size:16;not null;default:ACTIVE" json:"status"`
	ExternalProductID string         `gorm:"size:128;index" json:"externalProductId"`
	SyncStatus        string         `gorm:"size:16;not null;default:PENDING" json:"syncStatus"`
	SyncError         string         `gorm:"size:512" json:"syncError"`
	FeaturesJSON      string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	LastSyncedAt      *int64         `json:"lastSyncedAt"`
	CreatedAt         int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt         int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// CatalogDiscount 折扣/优惠券（Creem 单向同步）
type CatalogDiscount struct {
	ID                    string         `gorm:"type:uuid;primaryKey" json:"id"`
	ChannelID             string         `gorm:"type:uuid;not null;index" json:"channelId"`
	TenantID              string         `gorm:"size:64;not null;index" json:"tenantId"`
	Code                  string         `gorm:"size:64;not null;index" json:"code"`
	Name                  string         `gorm:"size:256;not null" json:"name"`
	DiscountType          string         `gorm:"size:32;not null" json:"discountType"`
	Value                 int            `gorm:"not null" json:"value"`
	Currency              string         `gorm:"size:8" json:"currency"`
	MinOrderAmountCents   int64          `gorm:"not null;default:0" json:"minOrderAmountCents"`
	MaxUsageLimit         int            `gorm:"not null;default:0" json:"maxUsageLimit"`
	UsedCount             int            `gorm:"not null;default:0" json:"usedCount"`
	StartDate             string         `gorm:"size:32" json:"startDate"`
	EndDate               string         `gorm:"size:32" json:"endDate"`
	ApplicableScope       string         `gorm:"size:32;not null;default:ALL" json:"applicableScope"`
	TargetTenantID        string         `gorm:"size:64" json:"targetTenantId"`
	Status                string         `gorm:"size:16;not null;default:ACTIVE" json:"status"`
	Duration              string         `gorm:"size:16;not null;default:once" json:"duration"`
	DurationInMonths      int            `gorm:"not null;default:0" json:"durationInMonths"`
	AppliesToProductsJSON string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	ExternalDiscountID    string         `gorm:"size:128;index" json:"externalDiscountId"`
	SyncStatus            string         `gorm:"size:16;not null;default:PENDING" json:"syncStatus"`
	SyncError             string         `gorm:"size:512" json:"syncError"`
	CreatedAt             int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt             int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
}

// PaymentTransaction 支付交易流水（由 Creem Webhook 落库）
type PaymentTransaction struct {
	ID                 string         `gorm:"type:uuid;primaryKey" json:"id"`
	DisplayID          string         `gorm:"size:64;not null;index" json:"displayId"`
	ChannelID          string         `gorm:"type:uuid;not null;index" json:"channelId"`
	TenantID           string         `gorm:"size:64;not null;index" json:"tenantId"`
	Channel            string         `gorm:"size:32;not null;index" json:"channel"`
	ExternalEventID    string         `gorm:"size:128;not null;index" json:"externalEventId"`
	ChannelTradeNo     string         `gorm:"size:128;index" json:"channelTradeNo"`
	OrderNumber        string         `gorm:"size:128;index" json:"orderNumber"`
	OrderTitle         string         `gorm:"size:512" json:"orderTitle"`
	OrderAmountCents   int64          `gorm:"not null;default:0" json:"orderAmountCents"`
	ChannelFeeCents    int64          `gorm:"not null;default:0" json:"channelFeeCents"`
	NetAmountCents     int64          `gorm:"not null;default:0" json:"netAmountCents"`
	Currency           string         `gorm:"size:8;not null" json:"currency"`
	Status             string         `gorm:"size:32;not null;index" json:"status"`
	CustomerEmail      string         `gorm:"size:255" json:"customerEmail"`
	CustomerName       string         `gorm:"size:128" json:"customerName"`
	CustomerCountry    string         `gorm:"size:16" json:"customerCountry"`
	PaymentMethod      string         `gorm:"size:128" json:"paymentMethod"`
	ProductID          string         `gorm:"size:128" json:"productId"`
	ProductName        string         `gorm:"size:256" json:"productName"`
	SubscriptionID     string         `gorm:"size:128;index" json:"subscriptionId"`
	EventType          string         `gorm:"size:64;index" json:"eventType"`
	TimelineJSON       string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	RawPayloadJSON     string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt          int64          `gorm:"autoCreateTime;index" json:"createdAt"`
	UpdatedAt          int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

// PaymentRefund 退款单（Creem refund.created / 管理端发起）
type PaymentRefund struct {
	ID                  string         `gorm:"type:uuid;primaryKey" json:"id"`
	DisplayID           string         `gorm:"size:64;not null;index" json:"displayId"`
	TransactionID       string         `gorm:"type:uuid;index" json:"transactionId"`
	TransactionNo       string         `gorm:"size:64;index" json:"transactionNo"`
	ChannelID           string         `gorm:"type:uuid;index" json:"channelId"`
	TenantID            string         `gorm:"size:64;not null;index" json:"tenantId"`
	Channel             string         `gorm:"size:32;not null;index" json:"channel"`
	ExternalEventID     string         `gorm:"size:128;index" json:"externalEventId"`
	RefundAmountCents   int64          `gorm:"not null;default:0" json:"refundAmountCents"`
	OriginalAmountCents int64          `gorm:"not null;default:0" json:"originalAmountCents"`
	Currency            string         `gorm:"size:8;not null" json:"currency"`
	Reason              string         `gorm:"size:64" json:"reason"`
	Status              string         `gorm:"size:32;not null;index" json:"status"`
	RefundType          string         `gorm:"size:16;not null;default:FULL" json:"refundType"`
	Note                string         `gorm:"type:text" json:"note"`
	CreatedAt           int64          `gorm:"autoCreateTime;index" json:"createdAt"`
	UpdatedAt           int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

// PaymentChargeback 拒付/争议单（Creem dispute.created）
type PaymentChargeback struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	DisplayID       string         `gorm:"size:64;not null;index" json:"displayId"`
	TransactionID   string         `gorm:"type:uuid;index" json:"transactionId"`
	TransactionNo   string         `gorm:"size:64;index" json:"transactionNo"`
	ChannelID       string         `gorm:"type:uuid;index" json:"channelId"`
	TenantID        string         `gorm:"size:64;not null;index" json:"tenantId"`
	Channel         string         `gorm:"size:32;not null;index" json:"channel"`
	ExternalEventID string         `gorm:"size:128;index" json:"externalEventId"`
	AmountCents     int64          `gorm:"not null;default:0" json:"amountCents"`
	Currency        string         `gorm:"size:8;not null" json:"currency"`
	Reason          string         `gorm:"size:64" json:"reason"`
	Status          string         `gorm:"size:32;not null;index" json:"status"`
	DeadlineAt      int64          `gorm:"index" json:"deadlineAt"`
	EvidenceJSON    string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	TimelineJSON    string         `gorm:"type:jsonb;not null;default:'[]'" json:"-"`
	Note            string         `gorm:"type:text" json:"note"`
	CreatedAt       int64          `gorm:"autoCreateTime;index" json:"createdAt"`
	UpdatedAt       int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// PaymentApp 接入应用（JSON 存完整前端结构）
type PaymentApp struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID  string         `gorm:"size:64;index" json:"tenantId"`
	Code      string         `gorm:"size:128;uniqueIndex" json:"code"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// SettlementBatch 结算批次
type SettlementBatch struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID  string         `gorm:"size:64;index" json:"tenantId"`
	Channel   string         `gorm:"size:32;index" json:"channel"`
	BatchDate string         `gorm:"size:16;index" json:"batchDate"`
	Status    string         `gorm:"size:32;index" json:"status"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// PromoCampaign 促销邮件活动
type PromoCampaign struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	TenantID  string         `gorm:"size:64;index;default:ALL" json:"tenantId"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// EndUser 终端客户
type EndUser struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	TenantID  string         `gorm:"size:64;index" json:"tenantId"`
	Email     string         `gorm:"size:255;index" json:"email"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ExchangeRate 汇率
type ExchangeRate struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ExchangeRateHistory 汇率历史
type ExchangeRateHistory struct {
	ID        string `gorm:"type:uuid;primaryKey" json:"id"`
	RateID    string `gorm:"size:64;index" json:"rateId"`
	Rate      float64 `json:"rate"`
	RecordedAt int64 `gorm:"index" json:"recordedAt"`
}

// FeeRule 费率规则
type FeeRule struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// RiskRule 风控规则
type RiskRule struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BlacklistEntry 黑名单
type BlacklistEntry struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// MerchantApplication 商户 KYB 申请
type MerchantApplication struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// AlertRule 告警规则
type AlertRule struct {
	ID        string         `gorm:"size:64;primaryKey" json:"id"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt int64          `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// AlertHistory 告警历史
type AlertHistory struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	RuleID    string         `gorm:"size:64;index" json:"ruleId"`
	DataJSON  string         `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime;index" json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// PaymentWebhookLog 支付 Webhook 入站记录
type PaymentWebhookLog struct {
	ID           string `gorm:"type:uuid;primaryKey" json:"id"`
	ChannelID    string `gorm:"type:uuid;index" json:"channelId"`
	EventID      string `gorm:"size:128;index" json:"eventId"`
	EventType    string `gorm:"size:64;index" json:"eventType"`
	Channel      string `gorm:"size:32" json:"channel"`
	AppID        string `gorm:"size:64" json:"appId"`
	AppName      string `gorm:"size:128" json:"appName"`
	TargetURL    string `gorm:"size:512" json:"targetUrl"`
	HTTPStatus   int    `gorm:"not null;default:200" json:"httpStatus"`
	LatencyMs    int    `gorm:"not null;default:0" json:"latencyMs"`
	Attempts     int    `gorm:"not null;default:1" json:"attempts"`
	Status       string `gorm:"size:16" json:"status"`
	PayloadJSON  string `gorm:"type:jsonb;not null;default:'{}'" json:"-"`
	ResponseBody string `gorm:"type:text" json:"responseBody"`
	CreatedAt    int64  `gorm:"autoCreateTime;index" json:"createdAt"`
}
