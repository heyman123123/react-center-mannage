package migrations

import (
	"log"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 与前端 src/data/mockData.ts INITIAL_MENUS 对齐的稳定菜单 ID（SHA1 命名空间）
func menuID(logical string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/menu/"+logical)).String()
}

func roleID(logical string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("novaspay/role/"+logical)).String()
}

func seedDefaults(db *gorm.DB) {
	seedLanguages(db)
	seedMenus(db)
	migrateLegacyPermissionsMenu(db)
	seedSuperAdmin(db)
	seedAuditActionDict(db)
	seedDictionaryCategories(db)
	MigrateRoleMenusToPacks(db)
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

// 对齐前端 INITIAL_MENUS
func allMenuSeeds() []menuSeed {
	return []menuSeed{
		// 核心运营
		{Logical: "root_core", Key: "root_core", Title: "核心运营", MenuType: "directory", Path: "/core", Icon: "Folder", Sort: 1},
		{Logical: "menu_dashboard", Key: "dashboard", Title: "概览看板", MenuType: "route", Path: "/dashboard", Icon: "LayoutDashboard", Sort: 1, Parent: "root_core"},
		{Logical: "menu_transactions", Key: "transactions", Title: "交易流水与时间轴", MenuType: "route", Path: "/transactions", Icon: "Receipt", Sort: 2, Parent: "root_core"},
		{Logical: "menu_reconciliation", Key: "reconciliation", Title: "跨境对账中心", MenuType: "route", Path: "/reconciliation", Icon: "Scale", Sort: 3, Parent: "root_core"},
		{Logical: "menu_settlements", Key: "settlements", Title: "结算与出金管理", MenuType: "route", Path: "/settlements", Icon: "BarChart3", Sort: 4, Parent: "root_core"},
		{Logical: "menu_refunds", Key: "refunds", Title: "退款与拒付", MenuType: "route", Path: "/refunds", Icon: "RefreshCw", Sort: 5, Parent: "root_core"},
		{Logical: "menu_users", Key: "users", Title: "终端客户管理", MenuType: "route", Path: "/users", Icon: "Users", Sort: 6, Parent: "root_core"},
		{Logical: "menu_merchant_review", Key: "merchant_review", Title: "商户/KYB 审核", MenuType: "route", Path: "/merchant-review", Icon: "FileText", Sort: 7, Parent: "root_core"},

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
	var existing int64
	db.Model(&persistence.Menu{}).Count(&existing)
	var hasDashboard int64
	db.Model(&persistence.Menu{}).Where("key = ?", "dashboard").Count(&hasDashboard)

	// 旧种子 / 不完整时清空后全量重建
	if existing == 0 || hasDashboard == 0 || existing < int64(len(seeds)) {
		if existing > 0 {
			log.Printf("seed: rebuilding menus (existing=%d, expected=%d)", existing, len(seeds))
			_ = db.Exec("DELETE FROM role_menus").Error
			_ = db.Unscoped().Where("1 = 1").Delete(&persistence.Menu{}).Error
		}
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
			if err := db.Create(&m).Error; err != nil {
				log.Printf("seed menu %s: %v", s.Key, err)
			}
		}
		log.Printf("seed: menus created (%d)", len(seeds))
		return
	}

	// 已完整：按稳定 ID upsert 标题/图标等
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
		_ = db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"parent_id", "key", "title", "menu_type", "path", "icon", "sort_order", "hidden", "updated_at"}),
		}).Create(&m).Error
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

	var menus []persistence.Menu
	if err := db.Find(&menus).Error; err != nil {
		log.Printf("seed load menus: %v", err)
		return
	}

	// 绑定全部菜单权限
	_ = db.Where("role_id = ?", rid).Delete(&persistence.RoleMenu{}).Error
	for _, m := range menus {
		_ = db.Create(&persistence.RoleMenu{RoleID: rid, MenuID: m.ID}).Error
	}
	log.Printf("seed: SUPER_ADMIN bound to %d menus", len(menus))

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

// migrateLegacyPermissionsMenu remaps old key=permissions menu to permission_packs (stable new logical ID).
func migrateLegacyPermissionsMenu(db *gorm.DB) {
	oldID := menuID("menu_permissions")
	newID := menuID("menu_permission_packs")
	if oldID == newID {
		return
	}

	var oldMenu persistence.Menu
	err := db.Where("id = ? OR key = ?", oldID, "permissions").First(&oldMenu).Error
	if err != nil {
		return
	}
	if oldMenu.ID == newID || oldMenu.Key == "permission_packs" {
		return
	}

	parentID := oldMenu.ParentID
	newMenu := persistence.Menu{
		ID: newID, ParentID: parentID, Key: "permission_packs", Title: oldMenu.Title,
		MenuType: oldMenu.MenuType, Path: "/permission_packs", Icon: oldMenu.Icon,
		SortOrder: oldMenu.SortOrder, Hidden: oldMenu.Hidden,
	}
	_ = db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"parent_id", "key", "title", "menu_type", "path", "icon", "sort_order", "hidden", "updated_at"}),
	}).Create(&newMenu).Error

	_ = db.Exec(`
		UPDATE role_menus AS rm SET menu_id = ?
		WHERE rm.menu_id = ?
		  AND NOT EXISTS (
			SELECT 1 FROM role_menus x WHERE x.role_id = rm.role_id AND x.menu_id = ?
		)`, newID, oldMenu.ID, newID).Error
	_ = db.Where("menu_id = ?", oldMenu.ID).Delete(&persistence.RoleMenu{}).Error

	_ = db.Exec(`
		UPDATE permission_pack_menus AS ppm SET menu_id = ?
		WHERE ppm.menu_id = ?
		  AND NOT EXISTS (
			SELECT 1 FROM permission_pack_menus x WHERE x.pack_id = ppm.pack_id AND x.menu_id = ?
		)`, newID, oldMenu.ID, newID).Error
	_ = db.Where("menu_id = ?", oldMenu.ID).Delete(&persistence.PermissionPackMenu{}).Error

	_ = db.Unscoped().Delete(&persistence.Menu{}, "id = ?", oldMenu.ID).Error
	log.Printf("seed: migrated legacy permissions menu %s → %s", oldMenu.ID, newID)
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

