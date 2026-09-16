package migrations

import (
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 稳定菜单 ID（SHA1 命名空间），便于幂等种子与跨环境一致。
func menuID(logical string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/menu/"+logical)).String()
}

func roleID(logical string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/role/"+logical)).String()
}

func seedDemoEnabled() bool {
	v := strings.TrimSpace(os.Getenv("SEED_DEMO"))
	if v == "" {
		return true
	}
	switch strings.ToLower(v) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func seedDefaults(db *gorm.DB) {
	seedLanguages(db)
	seedMenus(db)
	seedSuperAdmin(db)
	if !seedDemoEnabled() {
		log.Printf("migrations: SEED_DEMO=false, skipping demo business data")
		seedAuditActionDict(db)
		seedDictionaryCategories(db)
		return
	}
	seedTenants(db)
	seedPaymentApps(db)
	seedExchangeRates(db)
	seedFeeRules(db)
	seedRiskRules(db)
	seedBlacklistEntries(db)
	seedAlertRules(db)
	seedPromoCampaigns(db)
	seedAuditActionDict(db)
	seedDictionaryCategories(db)
}

func dictCategoryID(key string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/dict_category/"+key)).String()
}

func packID(key string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/pack/"+key)).String()
}

func seedLanguages(db *gorm.DB) {
	var n int64
	db.Model(&persistence.Language{}).Count(&n)
	if n > 0 {
		return
	}
	_ = db.Create(&[]persistence.Language{
		{Code: "zh-CN", Name: "简体中文", Enabled: true, SortOrder: 1},
		{Code: "en-US", Name: "English", Enabled: true, SortOrder: 2},
	}).Error
}

type menuSeed struct {
	Logical  string // 稳定逻辑 ID，用于生成 UUID / 父子关系
	Key      string // 权限码 / routeKey（目录用 logical，叶子用 tab key）
	Title    string
	MenuType string
	Path     string
	Icon     string
	Sort     int
	Parent   string // 父级 Logical，空为根
}

func allMenuSeeds() []menuSeed {
	return []menuSeed{
		// 核心运营
		{Logical: "root_core", Key: "root_core", Title: "核心运营", MenuType: "directory", Path: "/core", Icon: "Folder", Sort: 1},
		{Logical: "menu_dashboard", Key: "dashboard", Title: "概览看板", MenuType: "route", Path: "/dashboard", Icon: "LayoutDashboard", Sort: 1, Parent: "root_core"},
		{Logical: "menu_transactions", Key: "transactions", Title: "交易流水与时间轴", MenuType: "route", Path: "/transactions", Icon: "Receipt", Sort: 2, Parent: "root_core"},
		{Logical: "menu_reconciliation", Key: "reconciliation", Title: "跨境对账中心", MenuType: "route", Path: "/reconciliation", Icon: "Scale", Sort: 3, Parent: "root_core"},
		{Logical: "menu_settlements", Key: "settlements", Title: "结算与出金管理", MenuType: "route", Path: "/settlements", Icon: "BarChart3", Sort: 4, Parent: "root_core"},
		{Logical: "menu_financial_reports", Key: "financial_reports", Title: "财务结算与渠道费率报表", MenuType: "route", Path: "/financial-reports", Icon: "FileSpreadsheet", Sort: 5, Parent: "root_core"},
		{Logical: "menu_refunds", Key: "refunds", Title: "退款与拒付", MenuType: "route", Path: "/refunds", Icon: "RefreshCw", Sort: 6, Parent: "root_core"},
		{Logical: "menu_users", Key: "users", Title: "终端客户管理", MenuType: "route", Path: "/users", Icon: "Users", Sort: 7, Parent: "root_core"},
		{Logical: "menu_merchant_review", Key: "merchant_review", Title: "商户/KYB 审核", MenuType: "route", Path: "/merchant-review", Icon: "FileText", Sort: 8, Parent: "root_core"},
		{Logical: "menu_tenants", Key: "tenants", Title: "租户管理", MenuType: "route", Path: "/tenants", Icon: "Building", Sort: 9, Parent: "root_core"},

		// 商品与促销
		{Logical: "root_commerce", Key: "root_commerce", Title: "商品与促销", MenuType: "directory", Path: "/commerce", Icon: "Folder", Sort: 2},
		{Logical: "menu_products", Key: "products", Title: "商品配置", MenuType: "route", Path: "/products", Icon: "Package", Sort: 1, Parent: "root_commerce"},
		{Logical: "menu_discounts", Key: "discounts", Title: "折扣配置", MenuType: "route", Path: "/discounts", Icon: "Tag", Sort: 2, Parent: "root_commerce"},
		{Logical: "menu_promo_campaigns", Key: "promo_campaigns", Title: "促销邮件配置", MenuType: "route", Path: "/promo-campaigns", Icon: "Megaphone", Sort: 3, Parent: "root_commerce"},

		// 支付与网关
		{Logical: "root_gateway", Key: "root_gateway", Title: "支付与网关", MenuType: "directory", Path: "/gateway", Icon: "Folder", Sort: 3},
		{Logical: "menu_payment_channels", Key: "payment_channels", Title: "支付渠道配置", MenuType: "route", Path: "/payment-channels", Icon: "CreditCard", Sort: 1, Parent: "root_gateway"},
		{Logical: "menu_payment_webhooks", Key: "payment_webhooks", Title: "支付 Webhook", MenuType: "route", Path: "/payment-webhooks", Icon: "Webhook", Sort: 2, Parent: "root_gateway"},
		{Logical: "menu_apps", Key: "apps", Title: "接入应用管理", MenuType: "route", Path: "/apps", Icon: "Layers", Sort: 3, Parent: "root_gateway"},
		{Logical: "menu_exchange_rates", Key: "exchange_rates", Title: "汇率管理", MenuType: "route", Path: "/exchange-rates", Icon: "Globe", Sort: 4, Parent: "root_gateway"},
		{Logical: "menu_fee_rules", Key: "fee_rules", Title: "费率规则引擎", MenuType: "route", Path: "/fee-rules", Icon: "SlidersHorizontal", Sort: 5, Parent: "root_gateway"},
		{Logical: "menu_risk_rules", Key: "risk_rules", Title: "风控规则与黑名单", MenuType: "route", Path: "/risk-rules", Icon: "Shield", Sort: 6, Parent: "root_gateway"},

		// 国际化与邮件
		{Logical: "root_i18n", Key: "root_i18n", Title: "国际化与邮件", MenuType: "directory", Path: "/i18n", Icon: "Folder", Sort: 4},
		{Logical: "menu_email_templates", Key: "email_templates", Title: "多语言邮件管理", MenuType: "route", Path: "/email-templates", Icon: "Languages", Sort: 2, Parent: "root_i18n"},
		{Logical: "menu_email_channels", Key: "email_channels", Title: "邮件渠道配置", MenuType: "route", Path: "/email-channels", Icon: "Mail", Sort: 3, Parent: "root_i18n"},
		{Logical: "menu_email_webhooks", Key: "email_webhooks", Title: "邮件 Webhook", MenuType: "route", Path: "/email-webhooks", Icon: "MailCheck", Sort: 4, Parent: "root_i18n"},

		// 系统与权限
		{Logical: "root_system", Key: "root_system", Title: "系统与权限", MenuType: "directory", Path: "/system", Icon: "Folder", Sort: 5},
		{Logical: "menu_departments", Key: "departments", Title: "部门管理", MenuType: "route", Path: "/departments", Icon: "Building2", Sort: 1, Parent: "root_system"},
		{Logical: "menu_roles", Key: "roles", Title: "角色管理", MenuType: "route", Path: "/roles", Icon: "ShieldCheck", Sort: 2, Parent: "root_system"},
		{Logical: "menu_permission_packs", Key: "permission_packs", Title: "权限管理", MenuType: "route", Path: "/permission_packs", Icon: "KeyRound", Sort: 3, Parent: "root_system"},
		{Logical: "menu_menus", Key: "menus", Title: "菜单管理", MenuType: "route", Path: "/menus", Icon: "FolderTree", Sort: 4, Parent: "root_system"},
		{Logical: "menu_system_users", Key: "system_users", Title: "用户管理", MenuType: "route", Path: "/system-users", Icon: "UserCog", Sort: 5, Parent: "root_system"},
		{Logical: "menu_dictionary", Key: "dictionary", Title: "字典管理", MenuType: "route", Path: "/dictionary", Icon: "BookOpen", Sort: 6, Parent: "root_system"},
		{Logical: "menu_audit_logs", Key: "audit_logs", Title: "操作审计日志", MenuType: "route", Path: "/audit-logs", Icon: "List", Sort: 7, Parent: "root_system"},
		{Logical: "menu_system_config", Key: "system_config", Title: "系统参数与定时任务", MenuType: "route", Path: "/system-config", Icon: "Settings", Sort: 8, Parent: "root_system"},

		// 运维与监控
		{Logical: "root_ops", Key: "root_ops", Title: "运维与监控", MenuType: "directory", Path: "/ops", Icon: "Folder", Sort: 6},
		{Logical: "menu_alerts", Key: "alerts", Title: "告警与通知", MenuType: "route", Path: "/alerts", Icon: "BellRing", Sort: 1, Parent: "root_ops"},
	}
}

func seedMenus(db *gorm.DB) {
	seeds := allMenuSeeds()
	for _, s := range seeds {
		id := menuID(s.Logical)
		var parentID *string
		if s.Parent != "" {
			pid := menuID(s.Parent)
			parentID = &pid
		}
		m := persistence.Menu{
			ID: id, ParentID: parentID, Key: s.Key, Title: s.Title,
			MenuType: s.MenuType, Path: s.Path, Icon: s.Icon, SortOrder: s.Sort, Hidden: false,
		}
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"parent_id", "key", "title", "menu_type", "path", "icon", "sort_order", "hidden", "updated_at"}),
		}).Create(&m).Error; err != nil {
			log.Printf("seed menu %s: %v", s.Key, err)
		}
	}
	log.Printf("seed: menus upserted (%d)", len(seeds))
}

func seedSuperAdmin(db *gorm.DB) {
	rid := roleID("SUPER_ADMIN")
	role := persistence.Role{
		ID: rid, Key: "SUPER_ADMIN", Name: "超级管理员",
		Description: "系统内置超级管理员，拥有全部菜单权限", IsCustom: false,
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "description", "is_custom", "updated_at"}),
	}).Create(&role).Error

	// 确保拿到角色 ID（可能已存在不同 id）
	var existingRole persistence.Role
	if err := db.Where("key = ?", "SUPER_ADMIN").First(&existingRole).Error; err != nil {
		log.Printf("seed SUPER_ADMIN role: %v", err)
		return
	}
	rid = existingRole.ID

	const packKey = "PACK_SUPER_ADMIN"
	pid := packID(packKey)
	pack := persistence.PermissionPack{
		ID: pid, Key: packKey, Name: "超级管理员权限包",
		Description: "系统内置，包含全部菜单权限",
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "description", "updated_at"}),
	}).Create(&pack).Error

	var existingPack persistence.PermissionPack
	if err := db.Where("key = ?", packKey).First(&existingPack).Error; err != nil {
		log.Printf("seed SUPER_ADMIN pack: %v", err)
		return
	}
	pid = existingPack.ID

	var menus []persistence.Menu
	if err := db.Find(&menus).Error; err != nil {
		log.Printf("seed load menus: %v", err)
		return
	}
	for _, m := range menus {
		_ = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&persistence.PermissionPackMenu{
			PackID: pid, MenuID: m.ID,
		}).Error
	}

	_ = db.Clauses(clause.OnConflict{DoNothing: true}).Create(&persistence.RolePack{
		RoleID: rid, PackID: pid,
	}).Error
	log.Printf("seed: SUPER_ADMIN pack bound to %d menus", len(menus))

	// 默认管理员账号
	const adminEmail = "admin@novaspay.global"
	var user persistence.User
	err := db.Where("email = ?", adminEmail).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		hash, herr := bcrypt.GenerateFromPassword([]byte("Admin@123456"), 12)
		if herr != nil {
			log.Printf("seed admin password: %v", herr)
			return
		}
		user = persistence.User{
			ID: uuid.NewString(), Email: adminEmail, Name: "Admin",
			PasswordHash: string(hash), Status: "ACTIVE", AvatarText: "A",
		}
		if cerr := db.Create(&user).Error; cerr != nil {
			log.Printf("seed admin user: %v", cerr)
			return
		}
		log.Printf("seeded default admin: %s / Admin@123456", adminEmail)
	} else if err != nil {
		log.Printf("seed admin lookup: %v", err)
		return
	}

	_ = db.Where("user_id = ? AND role_key = ?", user.ID, "SUPER_ADMIN").Delete(&persistence.UserRole{}).Error
	_ = db.Create(&persistence.UserRole{UserID: user.ID, RoleKey: "SUPER_ADMIN"}).Error
	log.Printf("seed: admin user %s assigned SUPER_ADMIN", adminEmail)
}

func seedAuditActionDict(db *gorm.DB) {
	var n int64
	db.Model(&persistence.DictionaryEntry{}).Where("namespace = ?", "audit_action").Count(&n)
	if n > 0 {
		return
	}
	type pair struct{ Key, Zh, Desc string }
	items := []pair{
		{"AUTH_LOGIN", "登录", "用户登录"},
		{"AUTH_LOGOUT", "退出登录", "用户退出登录"},
		{"USER_CREATE", "创建用户", "创建系统用户"},
		{"USER_UPDATE", "更新用户", "更新系统用户"},
		{"USER_DELETE", "删除用户", "删除系统用户"},
		{"USER_RESET_PASSWORD", "重置密码", "重置系统用户密码"},
		{"ROLE_CREATE", "创建角色", "创建角色"},
		{"ROLE_UPDATE", "更新角色", "更新角色"},
		{"ROLE_DELETE", "删除角色", "删除角色"},
		{"ROLE_UPDATE_PERMISSIONS", "更新角色权限", "更新角色菜单权限"},
		{"MENU_REPLACE_TREE", "替换菜单树", "替换菜单树"},
		{"MENU_CREATE", "创建菜单", "创建菜单"},
		{"MENU_UPDATE", "更新菜单", "更新菜单"},
		{"MENU_DELETE", "删除菜单", "删除菜单"},
		{"DEPARTMENT_CREATE", "创建部门", "创建部门"},
		{"DEPARTMENT_UPDATE", "更新部门", "更新部门"},
		{"DEPARTMENT_DELETE", "删除部门", "删除部门"},
		{"DEPARTMENT_TRANSFER", "部门转移", "部门/成员转移"},
		{"DICTIONARY_CREATE", "创建字典", "创建字典词条"},
		{"DICTIONARY_UPDATE", "更新字典", "更新字典词条"},
		{"DICTIONARY_DELETE", "删除字典", "删除字典词条"},
		{"SYSTEM_CONFIG_CREATE", "创建系统参数", "创建系统参数"},
		{"SYSTEM_CONFIG_UPDATE", "更新系统参数", "更新系统参数"},
		{"SYSTEM_CONFIG_DELETE", "删除系统参数", "删除系统参数"},
		{"SCHEDULED_TASK_STATUS", "定时任务状态变更", "定时任务启停或创建"},
		{"SCHEDULED_TASK_TRIGGER", "手动触发定时任务", "手动触发定时任务"},
	}
	rows := make([]persistence.DictionaryEntry, 0, len(items))
	for _, it := range items {
		rows = append(rows, persistence.DictionaryEntry{
			ID: uuid.NewString(), Namespace: "audit_action", EntryKey: it.Key,
			Description: it.Desc, Category: "audit",
			Translations: `{"zh-CN":"` + it.Zh + `","en-US":"` + it.Key + `"}`,
		})
	}
	if err := db.Create(&rows).Error; err != nil {
		log.Printf("seed audit_action dict: %v", err)
	}
}

func seedDictionaryCategories(db *gorm.DB) {
	backendID := dictCategoryID("backend")
	auditID := dictCategoryID("audit_action")

	backend := persistence.DictionaryCategory{
		ID: backendID, Key: "backend", Name: "后端字典", IsSystem: true, SortOrder: 1,
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "is_system", "sort_order", "updated_at"}),
	}).Create(&backend).Error

	// Resolve real backend id (may pre-exist with different UUID)
	var existingBackend persistence.DictionaryCategory
	if err := db.Where("key = ?", "backend").First(&existingBackend).Error; err != nil {
		log.Printf("seed dictionary backend category: %v", err)
		return
	}
	backendID = existingBackend.ID
	parentID := backendID

	audit := persistence.DictionaryCategory{
		ID: auditID, ParentID: &parentID, Key: "audit_action", Name: "审计操作", IsSystem: true, SortOrder: 1,
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"parent_id", "name", "is_system", "sort_order", "updated_at"}),
	}).Create(&audit).Error

	var existingAudit persistence.DictionaryCategory
	if err := db.Where("key = ?", "audit_action").First(&existingAudit).Error; err != nil {
		log.Printf("seed dictionary audit_action category: %v", err)
		return
	}
	auditID = existingAudit.ID

	res := db.Model(&persistence.DictionaryEntry{}).
		Where("namespace = ? AND category_id IS NULL", "audit_action").
		Update("category_id", auditID)
	if res.Error != nil {
		log.Printf("seed backfill audit_action category_id: %v", res.Error)
		return
	}
	log.Printf("seed: dictionary categories backend/audit_action; backfilled %d entries", res.RowsAffected)
}

func seedTenants(db *gorm.DB) {
	var n int64
	db.Model(&persistence.Tenant{}).Count(&n)
	if n > 0 {
		return
	}
	tenants := []persistence.Tenant{
		{ID: "group_hq", Name: "全球海外总部 (Global HQ)", Code: "GLOBAL-HQ", Currency: "USD", Description: "集团中央外汇清结算、全球收单通道聚合与财务统一监管视图", Color: "#0f172a", DailyCap: 5000000, UsedToday: 1845200, ChannelsEnabledJSON: `["stripe","paypal","adyen","checkout","apple_pay","google_pay","klarna","sepa"]`, IsolationLevel: "GROUP_CONSOLIDATED", ActiveMerchantsCount: 86},
		{ID: "bu_na_ecom", Name: "北美电商出海 BU (NA E-Commerce)", Code: "BU-NA-ECOM", Currency: "USD", Description: "北美独立站、Shopify 矩阵店、DTC 品牌出海信用卡与分期收单", Color: "#0284c7", DailyCap: 2000000, UsedToday: 892400, ChannelsEnabledJSON: `["stripe","paypal","apple_pay","google_pay","klarna"]`, IsolationLevel: "STRICT_ISOLATED", ActiveMerchantsCount: 42},
		{ID: "bu_eu_saas", Name: "欧洲 SaaS 订阅平台 BU (EU Cloud & SaaS)", Code: "BU-EU-SAAS", Currency: "EUR", Description: "欧洲企业级 SaaS 工具套件、GDPR 合规多币种定期扣费与 SEPA 借记", Color: "#4f46e5", DailyCap: 1500000, UsedToday: 512000, ChannelsEnabledJSON: `["stripe","adyen","sepa","paypal"]`, IsolationLevel: "STRICT_ISOLATED", ActiveMerchantsCount: 28},
		{ID: "bu_apac_japan", Name: "亚太及日本跨境 BU (APAC & Japan)", Code: "BU-APAC-JP", Currency: "JPY", Description: "日韩及东南亚移动端应用内购、Konbini 便利店支付与信用卡直连", Color: "#059669", DailyCap: 1200000, UsedToday: 341000, ChannelsEnabledJSON: `["stripe","adyen","paypal","apple_pay"]`, IsolationLevel: "STRICT_ISOLATED", ActiveMerchantsCount: 16},
		{ID: "bu_latam", Name: "拉美新兴市场 BU (LATAM Emerging)", Code: "BU-LATAM", Currency: "USD", Description: "巴西 PIX、墨西哥 OXXO 结汇直通与跨境本地化聚合收单", Color: "#d97706", DailyCap: 800000, UsedToday: 99800, ChannelsEnabledJSON: `["checkout","stripe","paypal"]`, IsolationLevel: "STRICT_ISOLATED", ActiveMerchantsCount: 10},
	}
	for _, t := range tenants {
		if err := db.Create(&t).Error; err != nil {
			log.Printf("seed tenant %s: %v", t.ID, err)
		}
	}
	log.Printf("seed: tenants created (%d)", len(tenants))
}

func mustSeedJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		log.Printf("seed json marshal: %v", err)
		return "{}"
	}
	return string(b)
}

func seedPaymentApps(db *gorm.DB) {
	var n int64
	db.Model(&persistence.PaymentApp{}).Count(&n)
	if n > 0 {
		return
	}
	apps := []persistence.PaymentApp{
		{
			ID: "app_vpn_shield", TenantID: "bu_na_ecom", Code: "APP-VPN-SHIELD",
			DataJSON: mustSeedJSON(map[string]interface{}{
				"id": "app_vpn_shield", "name": "Global VPN Shield Pro", "code": "APP-VPN-SHIELD",
				"description": "全球高速隐私网络与数据安全防护客户端，跨 80+ 节点自动连线",
				"environment": "Production",
				"publishableKey": "np_pub_live_551029381029",
				"secretKey":      "np_sec_live_551029381029381029381029",
				"webhookUrl":     "https://billing.globalvpn.net/webhooks/payment",
				"defaultCurrency": "USD", "tenantId": "bu_na_ecom",
				"enabledChannels":       []string{"stripe", "paypal", "klarna"},
				"enabledPaymentMethods": []string{"credit_card", "paypal_wallet", "klarna_pay_later"},
				"routingStrategy":       "LOWEST_FEE",
				"associatedProductCodes":  []string{"PROD-VPN-YEAR-USD", "PROD-VPN-YEAR-EUR"},
				"associatedDiscountCodes": []string{"WELCOME20", "EARLYBIRD50"},
				"emailChannelId": "ech_ses_backup",
				"senderEmail":    "support@globalvpn.net",
				"senderName":     "Global VPN Security Team",
				"enabledEmailEvents": []string{
					"subscription_welcome_receipt", "recurring_renewal_success", "payment_failed_dunning",
				},
				"supportedLanguages": []string{"en-US", "zh-CN", "de-DE", "es-ES"},
				"defaultLanguage":          "en-US",
				"activeSubscribersCount":     42100,
				"totalGmv":                 685400.0,
				"status":                   "ACTIVE",
				"createdAt":                "2025-01-20",
			}),
		},
		{
			ID: "app_shopify_store", TenantID: "bu_na_ecom", Code: "APP-NORDIC-STORE",
			DataJSON: mustSeedJSON(map[string]interface{}{
				"id": "app_shopify_store", "name": "Nordic Living Shopify DTC", "code": "APP-NORDIC-STORE",
				"description": "北欧极简智能家居独立站矩阵，主打北美及欧洲中产消费群体",
				"environment": "Production",
				"publishableKey": "np_pub_live_331029381029",
				"secretKey":      "np_sec_live_331029381029381029381029",
				"webhookUrl":     "https://shop.nordicliving.store/apps/gateway/webhook",
				"defaultCurrency": "EUR", "tenantId": "bu_na_ecom",
				"enabledChannels":       []string{"stripe", "adyen", "klarna", "sepa"},
				"enabledPaymentMethods": []string{"credit_card", "klarna_pay_later", "sepa_debit"},
				"routingStrategy":       "LOWEST_FEE",
				"associatedProductCodes":  []string{"PROD-NORDIC-LAMP-USD"},
				"associatedDiscountCodes": []string{"WELCOME20", "BLACKFRIDAY30"},
				"emailChannelId": "ech_sendgrid_live",
				"senderEmail":    "orders@nordicliving.store",
				"senderName":     "Nordic Living Dispatch",
				"enabledEmailEvents": []string{
					"subscription_welcome_receipt", "subscription_canceled_notice",
				},
				"supportedLanguages": []string{"en-US", "de-DE", "fr-FR", "es-ES"},
				"defaultLanguage":          "en-US",
				"activeSubscribersCount":     3120,
				"totalGmv":                 890400.0,
				"status":                   "ACTIVE",
				"createdAt":                "2025-08-18",
			}),
		},
	}
	for _, app := range apps {
		if err := db.Create(&app).Error; err != nil {
			log.Printf("seed payment app %s: %v", app.ID, err)
		}
	}
	log.Printf("seed: payment apps created (%d)", len(apps))
}

func seedExchangeRates(db *gorm.DB) {
	var n int64
	db.Model(&persistence.ExchangeRate{}).Count(&n)
	if n > 0 {
		return
	}
	rates := []persistence.ExchangeRate{
		{
			ID: "fx_usd_eur",
			DataJSON: mustSeedJSON(map[string]interface{}{
				"id": "fx_usd_eur", "baseCurrency": "USD", "targetCurrency": "EUR",
				"bid": 0.9215, "ask": 0.9245,
				"effectiveFrom": "2026-09-12 00:00", "status": "ENABLED",
				"remark": "欧美主力结算对", "updatedAt": "2026-09-12 08:30",
			}),
		},
		{
			ID: "fx_usd_jpy",
			DataJSON: mustSeedJSON(map[string]interface{}{
				"id": "fx_usd_jpy", "baseCurrency": "USD", "targetCurrency": "JPY",
				"bid": 147.32, "ask": 147.68,
				"effectiveFrom": "2026-09-12 00:00", "status": "ENABLED",
				"remark": "日元高频波动对", "updatedAt": "2026-09-12 08:30",
			}),
		},
	}
	for _, rate := range rates {
		if err := db.Create(&rate).Error; err != nil {
			log.Printf("seed exchange rate %s: %v", rate.ID, err)
		}
	}
	log.Printf("seed: exchange rates created (%d)", len(rates))
}

func seedFeeRules(db *gorm.DB) {
	var n int64
	db.Model(&persistence.FeeRule{}).Count(&n)
	if n > 0 {
		return
	}
	rule := persistence.FeeRule{
		ID: "fee_creem_std",
		DataJSON: mustSeedJSON(map[string]interface{}{
			"id": "fee_creem_std", "name": "Creem 标准收单费率",
			"channels": []string{"creem"}, "currency": "USD",
			"minAmount": 0, "maxAmount": 999999,
			"merchantTier": "NORMAL", "fixedFee": 0.25, "percentFee": 3.5,
			"priority": 10, "status": "ENABLED", "createdAt": "2026-08-01 10:00",
		}),
	}
	if err := db.Create(&rule).Error; err != nil {
		log.Printf("seed fee rule %s: %v", rule.ID, err)
		return
	}
	log.Printf("seed: fee rules created (1)")
}

func seedRiskRules(db *gorm.DB) {
	var n int64
	db.Model(&persistence.RiskRule{}).Count(&n)
	if n > 0 {
		return
	}
	rule := persistence.RiskRule{
		ID: "risk01",
		DataJSON: mustSeedJSON(map[string]interface{}{
			"id": "risk01", "name": "欧洲强 3DS 验证", "type": "THREE_DS",
			"condition": "欧洲 EEA 交易强制 3DS 2.0 验证", "action": "BLOCK",
			"params": map[string]interface{}{"region": "EEA", "channel": "all"},
			"status": "ENABLED", "updatedAt": "2026-09-01 10:00",
		}),
	}
	if err := db.Create(&rule).Error; err != nil {
		log.Printf("seed risk rule %s: %v", rule.ID, err)
		return
	}
	log.Printf("seed: risk rules created (1)")
}

func seedBlacklistEntries(db *gorm.DB) {
	var n int64
	db.Model(&persistence.BlacklistEntry{}).Count(&n)
	if n > 0 {
		return
	}
	entry := persistence.BlacklistEntry{
		ID: "bl03",
		DataJSON: mustSeedJSON(map[string]interface{}{
			"id": "bl03", "type": "IP", "value": "185.220.101.45",
			"reason": "代理/VPN 出口，关联多笔拒付", "expiresAt": "永久",
			"status": "ACTIVE", "createdAt": "2026-08-22 10:00",
		}),
	}
	if err := db.Create(&entry).Error; err != nil {
		log.Printf("seed blacklist entry %s: %v", entry.ID, err)
		return
	}
	log.Printf("seed: blacklist entries created (1)")
}

func seedAlertRules(db *gorm.DB) {
	var n int64
	db.Model(&persistence.AlertRule{}).Count(&n)
	if n > 0 {
		return
	}
	rule := persistence.AlertRule{
		ID: "alr01",
		DataJSON: mustSeedJSON(map[string]interface{}{
			"id": "alr01", "name": "Stripe 渠道健康度异常",
			"monitorObject": "CHANNEL_ABNORMAL",
			"triggerCondition": "渠道健康检查失败或延迟 > 2000ms 持续 3 分钟",
			"severity": "P0", "notifyChannels": []string{"IN_APP", "EMAIL", "WEBHOOK"},
			"status": "ENABLED",
			"thresholdParams": map[string]interface{}{"latencyMs": 2000, "windowMin": 3},
			"updatedAt": "2026-09-01 09:00", "updatedBy": "系统管理员",
		}),
	}
	if err := db.Create(&rule).Error; err != nil {
		log.Printf("seed alert rule %s: %v", rule.ID, err)
		return
	}
	log.Printf("seed: alert rules created (1)")
}

func seedPromoCampaigns(db *gorm.DB) {
	var n int64
	db.Model(&persistence.PromoCampaign{}).Count(&n)
	if n > 0 {
		return
	}
	campaign := persistence.PromoCampaign{
		ID: "camp_03_churn_winback", TenantID: "bu_na_ecom",
		DataJSON: mustSeedJSON(map[string]interface{}{
			"id": "camp_03_churn_winback", "name": "90天未登录高价值客户返场礼遇邮件",
			"targetAudience": "CHURNED_90D", "discountCode": "ANNUAL_SAVE50",
			"emailTemplateId": "promo_discount_offer",
			"emailSubject": "We miss you! Here is $50 toward your next year of Novas",
			"status": "DRAFT", "totalRecipients": 890,
			"deliveredCount": 0, "openRate": 0, "clickRate": 0, "conversionRate": 0,
			"createdAt": "2026-09-05",
		}),
	}
	if err := db.Create(&campaign).Error; err != nil {
		log.Printf("seed promo campaign %s: %v", campaign.ID, err)
		return
	}
	log.Printf("seed: promo campaigns created (1)")
}
