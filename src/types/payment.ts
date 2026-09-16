/** 租户标识；种子数据含固定 BU 键，API 亦支持自定义字符串 ID */
export type TenantId = string;

export interface Tenant {
  id: TenantId;
  name: string;
  code: string;
  currency: string;
  description: string;
  color: string;
  dailyCap: number; // in USD
  usedToday: number;
  channelsEnabled: PaymentChannel[];
  isolationLevel: "STRICT_ISOLATED" | "LOGICAL_TENANT" | "GROUP_CONSOLIDATED";
  activeMerchantsCount: number;
}

// 海外主流支付渠道
export type PaymentChannel =
  | "stripe"
  | "paypal"
  | "adyen"
  | "checkout"
  | "apple_pay"
  | "google_pay"
  | "klarna"
  | "sepa"
  | "creem";

export type ReconciliationStatus = "done" | "in_process" | "discrepancy" | "pending_check";

export type DiscrepancyType =
  | "amount_mismatch"
  | "channel_missing"
  | "internal_missing"
  | "fee_discrepancy"
  | "status_mismatch";

// 交易全流程节点定义（带精确时间戳与处理阶段）
export interface TransactionTimelineStep {
  id: string;
  title: string;
  description: string;
  timestamp: string; // 精确时间戳，如 2026-09-05 14:22:01.120
  status: "completed" | "in_progress" | "failed" | "pending";
  actor: string; // 如 "客户端应用 (Novas AI)", "Stripe 3DS网关", "发卡行 (JPMorgan Chase)", "SendGrid 邮件服务"
  latencyMs?: number;
  metadata?: Record<string, string | number>;
}

export interface TransactionRecord {
  id: string; // 如 TX-20260905-8901
  tenantId: TenantId;
  appId?: string; // 关联应用
  appName?: string;
  orderTitle: string;
  orderNumber?: string;
  amount?: number;
  fee?: number;
  reconStatus?: string;
  discrepancyReason?: string;
  productDescription?: string;
  userIdentifier?: string;
  reconciledAt?: string;
  customerEmail?: string;
  customerName?: string;
  customerCountry?: string; // 🇺🇸 US, 🇬🇧 UK, etc.
  merchantName?: string;
  channel: PaymentChannel;
  channelTradeNo: string; // 外部渠道单号 (pi_3Nxxxxxx)
  orderAmount: number;
  channelFee: number;
  netAmount?: number;
  settleAmount?: number;
  currency: string; // USD, EUR, GBP, JPY
  createdAt: string;
  status: ReconciliationStatus;
  discrepancyType?: DiscrepancyType;
  discrepancyNote?: string;
  reviewer?: {
    name: string;
    avatarUrl?: string;
    role: string;
  };
  targetQuotaRatio?: number;
  limitRatio?: number;
  paymentMethod: string; // 如 "Visa Credit (4242)", "PayPal Balance", "Klarna 3期免息"
  riskScore?: number; // Radar 风控评分 0-100
  timeline?: TransactionTimelineStep[]; // 全流程时间线节点 (带精确时间戳与处理阶段)
  lifecycle?: any[];
  flowSteps?: Array<{
    stepId: string;
    stepName: string;
    timestamp: string;
    status: "SUCCESS" | "FAILED" | "PENDING";
    details: string;
  }>;
}

// 支付渠道配置
export interface PaymentChannelConfig {
  id: string;
  channelKey: PaymentChannel;
  name: string;
  accountName?: string; // 渠道账号名称（接入渠道账号时填写）
  description: string;
  enabled: boolean;
  mode: string;
  apiPublicKey: string;
  apiSecretKey: string;
  webhookSecret: string;
  supportedCurrencies: string[];
  feeRateText: string; // 如 "2.9% + $0.30"
  routingPriority: number; // 优先级 1, 2, 3
  fallbackChannel?: PaymentChannel;
  lastTestedAt: string;
  testStatus: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
}

// 邮件渠道配置
export interface EmailChannelConfig {
  id: string;
  providerKey: "sendgrid" | "aws_ses" | "resend" | "postmark" | "mailgun";
  name: string;
  description: string;
  mode: string;
  enabled: boolean;
  isPrimary: boolean;
  senderEmail: string;
  senderName: string;
  apiKey: string;
  smtpHost: string;
  smtpPort: number;
  dailyQuota: number;
  sentToday: number;
  verifiedDomain: string;
  spfDkimStatus: "VERIFIED" | "PENDING" | "WARNING";
  lastTestedAt: string;
}

// 支付 Webhook 记录
export interface PaymentWebhookLog {
  id: string;
  eventId: string;
  eventType:
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed"
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted"
    | "invoice.payment_failed"
    | "charge.refunded"
    | "charge.dispute.created"
    | "checkout.completed"
    | "subscription.created"
    | "subscription.past_due"
    | "dispute.created"
    | string;
  channel: PaymentChannel;
  appId: string;
  appName: string;
  targetUrl: string;
  httpStatus: number;
  latencyMs: number;
  attempts: number;
  timestamp: string;
  status: "DELIVERED" | "FAILED" | "RETRYING";
  payload: Record<string, any>;
  responseBody?: string;
}

// 邮件 Webhook 记录
export interface EmailWebhookLog {
  id: string;
  messageId: string;
  eventType:
    | "email.delivered"
    | "email.opened"
    | "email.clicked"
    | "email.bounced"
    | "email.spam_report"
    | "email.unsubscribed";
  provider: "sendgrid" | "aws_ses" | "resend" | "postmark" | "mailgun";
  recipient: string;
  subject: string;
  templateCode: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  status: "SUCCESS" | "BOUNCED" | "OPENED" | "CLICKED" | "FLAGGED";
  details?: string;
}

// 用户动作事件类型
export type UserActionType =
  | "REGISTER"
  | "LOGIN"
  | "CHANGE_PASSWORD"
  | "SUBSCRIBE"
  | "UPGRADE_PLAN"
  | "CANCEL_SUBSCRIPTION"
  | "UPDATE_PAYMENT_METHOD"
  | "REFUND_REQUEST"
  | "DOWNLOAD_INVOICE";

export interface UserActionLog {
  id: string;
  actionType: UserActionType;
  title: string;
  description: string;
  timestamp: string;
  ip: string;
  location: string;
  device: string;
  metadata?: Record<string, any>;
}

// 海外终端用户
export interface EndUser {
  id: string; // cus_us_10281
  name: string;
  email: string;
  country: string; // 🇺🇸 美国, 🇬🇧 英国, etc.
  avatarUrl?: string;
  registeredAt: string;
  lastLoginAt: string;
  lastLoginIp: string;
  currentSubscription: {
    planName: string; // 如 "Pro Monthly ($29.00/mo)", "Ultra Annual ($199.00/yr)"
    status: "ACTIVE" | "CANCELED" | "PAST_DUE" | "TRIAL";
    amount: number;
    currency: string;
    nextBillingDate: string;
    cancelAtPeriodEnd?: boolean;
  };
  defaultPaymentMethod: {
    type: "visa" | "mastercard" | "paypal" | "apple_pay";
    last4?: string;
    brand?: string;
    expiry?: string;
  };
  totalSpend: number;
  totalOrdersCount: number;
  actions: UserActionLog[];
}

// 接入应用 (App)
export interface PaymentApp {
  id: string; // app_live_novas_ai
  name: string;
  code: string;
  description: string;
  environment: "Production" | "Staging";
  publishableKey: string;
  secretKey: string;
  webhookUrl: string;
  defaultCurrency: string;
  tenantId?: TenantId;
  enabledChannels: PaymentChannel[];
  enabledPaymentMethods?: string[]; // ["credit_card", "paypal_wallet", "apple_pay", "google_pay", "klarna_pay_later", "sepa_debit"]
  routingStrategy?: "LOWEST_FEE" | "HIGHEST_SUCCESS_RATE" | "PRIORITY_LIST";
  associatedProductCodes?: string[]; // 关联的商品编号列表
  associatedDiscountCodes?: string[]; // 关联的折扣优惠码列表
  emailChannelId?: string; // 发信邮件渠道
  senderEmail?: string;
  senderName?: string;
  enabledEmailEvents?: string[]; // 开启的邮件通知事件
  supportedLanguages?: SupportedLanguage[]; // 支持的语言列表
  defaultLanguage?: SupportedLanguage; // 默认语言
  activeSubscribersCount: number;
  totalGmv: number;
  status: "ACTIVE" | "PAUSED";
  createdAt: string;
}

// 多语言邮件管理 - 独立单一邮件结构
export type SupportedLanguage = "en-US" | "zh-CN" | "ja-JP" | "de-DE" | "es-ES" | "fr-FR";
export type EmailCategory = "BILLING" | "SECURITY" | "LIFECYCLE" | "RISK" | "PROMOTION" | "SYSTEM";

export interface EmailTranslation {
  language: SupportedLanguage;
  languageLabel: string;
  subject: string;
  previewText: string;
  senderName: string;
  contentMarkdown: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string; // 唯一邮件ID，如 mail_receipt_en
  code: string; // 唯一邮件代码，如 PAYMENT_RECEIPT_EN
  name: string; // 邮件名称，如 "首次订阅支付成功收据 (English)"
  language: SupportedLanguage; // 单一独立语言！每封邮件归属一个固定语言
  languageLabel?: string; // 语言标签显示，如 "English (US)"
  category: EmailCategory; // 业务场景分类
  description: string; // 邮件用途说明
  triggerEvent: string; // 触发事件，如 "charge.succeeded"
  subject: string; // 邮件主题
  senderName: string; // 发件人显示名称
  senderEmail: string; // 发信地址
  previewText: string; // 邮件摘要预热文本
  contentMarkdown: string; // 独立邮件正文内容 (Markdown / HTML)
  status: "ACTIVE" | "DRAFT" | "DISABLED"; // 邮件状态
  updatedAt: string; // 更新时间
  associatedTenantId?: TenantId | "ALL"; // 适用租户范围
  variables?: string[]; // 可用动态插槽
  dictReferences?: string[]; // 引用的统一字典 Key 列表
  translations?: Record<SupportedLanguage, Partial<EmailTranslation>>; // 兼容旧属性
}

// RBAC 权限与系统用户
export type RbacRoleKey =
  | "SUPER_ADMIN"
  | "FINANCE_DIRECTOR"
  | "RECON_SPECIALIST"
  | "RISK_AUDITOR"
  | "BU_OPERATOR";

/** 权限包：挂菜单树；角色通过 packIds 引用 */
export interface PermissionPack {
  id: string;
  key: string;
  name: string;
  description: string;
  menuIds: string[];
  createdAt?: number | string;
}

export interface RbacRole {
  id?: string;
  key?: string;
  name: string;
  description: string;
  isCustom?: boolean;
  userCount?: number;
  assignedMembersCount?: number;
  dataScope?: "ALL_TENANTS" | "ASSIGNED_TENANT" | "READ_ONLY_MASKED";
  /** 绑定的权限包 ID 列表 */
  packIds?: string[];
  permissions: {
    canViewExecutiveDashboard?: boolean;
    canViewAllTenants?: boolean;
    canTriggerReconciliation?: boolean;
    canResolveDiscrepancy?: boolean;
    canManualAdjustFund?: boolean;
    canExportFinancialReports?: boolean;
    canManageRbac?: boolean;
    canManageTenantSettings?: boolean;
    canManageChannels?: boolean;
    canManageWebhooks?: boolean;
    canManageUsers?: boolean;
    canManageApps?: boolean;
    canManageEmailTemplates?: boolean;
    canManageProducts?: boolean;
    canManageDiscounts?: boolean;
    canManagePromoCampaigns?: boolean;
    canManageDictionary?: boolean;
    canManageMenus?: boolean;
    canCrossTenant?: boolean;
    canRefund?: boolean;
    canDispute?: boolean;
    canConfigGateways?: boolean;
    canManageEmails?: boolean;
    canManageRoles?: boolean;
    /** @deprecated 菜单权限已迁至权限包；保留作 Mock/旧数据兼容 */
    menuPermissionIds?: string[];
    /** 可访问的应用 ID 列表（"ALL" 表示全部） */
    appPermissionIds?: string[];
    [key: string]: any;
  };
}

// 商品配置
export type ProductType = "SUBSCRIPTION" | "ONE_TIME" | "ADDON";
export interface ProductConfig {
  id: string;
  code: string; // 唯一商品代码，不同币种拥有独立code，如 NOVAS-PRO-USD, NOVAS-PRO-EUR
  name: string;
  type: ProductType;
  tenantId: TenantId;
  currency: string; // 单一货币代码 (USD, EUR, JPY, GBP, CAD 等)
  price: number; // 当前货币单价
  description: string;
  features: string[];
  trialDays?: number;
  status: "ACTIVE" | "ARCHIVED";
  billingInterval: "MONTHLY" | "YEARLY" | "ONE_TIME" | "LIFETIME";
  prices?: {
    [key: string]: number;
  };
  stripePriceId?: string;
  paypalPlanId?: string;
  subscriberCount?: number;
  boundChannelIds?: string[]; // 绑定的渠道账号 id（来自 paymentChannels）
  channelId?: string;
  providerChannelId?: string;
  creemProductId?: string;
  externalProductId?: string;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
  syncError?: string;
  createdAt: string;
}

// 折扣配置
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export interface DiscountConfig {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  value: number;
  currency?: string;
  minOrderAmount: number;
  maxUsageLimit: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  applicableScope: "ALL" | "SUBSCRIPTION_ONLY" | "BU_SPECIFIC";
  targetTenantId?: TenantId;
  status: "ACTIVE" | "EXPIRED" | "DISABLED";
  boundChannelIds?: string[]; // 绑定的渠道账号 id（来自 paymentChannels）
  channelId?: string;
  providerChannelId?: string;
  creemDiscountId?: string;
  externalDiscountId?: string;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
  duration?: "once" | "repeating" | "forever";
  durationInMonths?: number;
  appliesToProductIds?: string[];
  createdAt: string;
}

// 促销邮件配置
export interface PromoCampaign {
  id: string;
  name: string;
  targetAudience: "ALL_USERS" | "TRIAL_USERS" | "CHURNED_90D" | "VIP_ENTERPRISE";
  discountCode?: string;
  emailTemplateId: string;
  emailSubject: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";
  scheduledTime?: string;
  sentTime?: string;
  totalRecipients: number;
  deliveredCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  createdAt: string;
}

// 全局多语言统一共享字典 (全项目通用：收银台、商户平台、网关API、移动端SDK、邮件与通知)
export type DictionaryCategory =
  | "COMMON"
  | "BILLING"
  | "LIFECYCLE"
  | "PROMOTION"
  | "SECURITY"
  | "CHECKOUT"
  | "PORTAL"
  | "GATEWAY_ERRORS"
  | "CURRENCY" // 结算货币配置（含多语言币种名称与符号）
  | "PAYMENT_CHANNEL"; // 支付渠道字典（channel.* 词条定义可接入的渠道）

export type ProjectPlatform =
  | "CHECKOUT" // 海外收银台 (Web Checkout / Paywall)
  | "PORTAL" // 商户管理后台 (Merchant Portal)
  | "GATEWAY_API" // 支付网关响应与错误码 (API / Webhook)
  | "MOBILE_SDK" // 移动端原生应用与SDK (iOS / Android)
  | "EMAIL_NOTIFY"; // 交易与合规通知邮件 (Email / SMS)

export interface DictionaryEntry {
  id: string;
  key: string;
  category: DictionaryCategory;
  categoryId?: string;
  description: string;
  platforms?: ProjectPlatform[];
  referencedTemplatesCount: number;
  translations: Record<SupportedLanguage, string>;
  updatedAt: string;
}

export type SystemMenuType = "directory" | "route" | "button";

// 菜单配置 (纯菜单管理，与角色权限解耦)
export interface SystemMenuItem {
  id: string;
  title: string;
  path: string;
  icon: string;
  parentId?: string | null;
  order?: number;
  sortOrder?: number;
  /** 菜单类型：目录 | 路由 | 按钮权限 */
  menuType?: SystemMenuType;
  /** 对应前端渲染的 Tab 路由键（仅叶子菜单需要） */
  routeKey?: string;
  visible: boolean;
  status?: "ENABLED" | "DISABLED";
  description?: string;
  children?: SystemMenuItem[];
}

export interface UserProfileSettings {
  name: string;
  email: string;
  jobTitle?: string;
  avatar?: string;
  avatarText?: string;
  avatarColor?: string;
  timezone?: string;
  locale?: string;
  twoFactorEnabled?: boolean;
  newPassword?: string;
  notificationPreferences?: {
    emailAlerts: boolean;
    securityAlerts: boolean;
    reconciliationDiscrepancy: boolean;
  };
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  roleKey: RbacRoleKey | string;
  /** 多选角色（新逻辑），角色非必选 */
  roleKeys?: string[];
  tenantId?: TenantId;
  avatar?: string;
  avatarText: string;
  lastLogin: string;
  status?: "ACTIVE" | "DISABLED";
  allowedAppIds?: string[]; // 允许访问的出海应用ID列表
  department?: string;
  /** 多选所属部门（新逻辑，继承部门绑定角色的权限） */
  departmentIds?: string[];
  phone?: string;
  createdAt?: string;
  /** 有效菜单权限码（routeKey / menu.key），来自 /me */
  menuKeys?: string[];
}

// 组织部门（树结构）：部门可绑定多个角色，成员继承部门角色的权限
export interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  sortOrder?: number;
  description?: string;
  leader?: string;
  /** 绑定的角色（多选）：该部门成员继承这些角色的权限 */
  roleKeys: string[];
  memberCount?: number;
  createdAt?: string;
}

export interface ReconciliationBatch {
  batchNo: string;
  date: string;
  tenantId: TenantId;
  totalCount: number;
  matchedCount: number;
  discrepancyCount: number;
  pendingCount: number;
  totalAmount: number;
  matchedAmount: number;
  discrepancyAmount: number;
  channel: PaymentChannel;
  status: "COMPLETED" | "RUNNING" | "DISCREPANCY_FOUND";
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  operator?: string;
  operatorRole?: string;
  role?: string;
  tenantId: TenantId;
  action: string;
  targetResource?: string;
  targetId?: string;
  details?: string;
  ipAddress: string;
  status?: "SUCCESS" | "BLOCKED_BY_RBAC" | "WARNING";
}

// ============================================================
// P0: 结算单 / 出金管理
// ============================================================
export type SettlementStatus = "PENDING" | "SETTLING" | "PAID" | "FAILED";

/** 结算批次内的单笔交易明细 */
export interface SettlementTxItem {
  tradeNo: string; // 关联交易号
  orderTitle?: string;
  amount: number; // 该笔交易金额
  fee: number; // 该笔手续费
}

/** 结算批次费用明细 */
export interface SettlementFeeBreakdown {
  channelFee: number; // 渠道费
  fxGainLoss: number; // 汇兑损溢（负数为损失）
  platformFee: number; // 平台服务费
}

/** 出金账户 */
export interface PayoutAccount {
  bankName: string;
  accountLast4: string;
  currency: string;
}

export interface SettlementBatch {
  id: string; // 批次号
  tenantId: TenantId;
  channel: PaymentChannel;
  currency: string;
  receivableAmount: number; // 应收金额
  fee: number; // 总手续费
  netAmount: number; // 净结金额
  status: SettlementStatus;
  cycle: string; // 结算周期，如 T+1 / Daily / Weekly
  createdAt: string;
  txItems: SettlementTxItem[]; // 交易明细
  fees: SettlementFeeBreakdown; // 费用明细
  payoutAccount?: PayoutAccount; // 出金账户
  remark?: string;
}

// ============================================================
// P0: 退款与拒付管理
// ============================================================
export type RefundReason = "客户要求" | "商品缺陷" | "重复扣款" | "欺诈疑似" | "其他";
export type RefundStatus = "PENDING_REVIEW" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface RefundRecord {
  id: string; // 退款单号
  transactionNo: string; // 关联交易号
  tenantId: TenantId;
  channel: PaymentChannel;
  refundAmount: number; // 退款金额
  originalAmount: number; // 原交易金额
  currency: string;
  reason: RefundReason;
  status: RefundStatus;
  refundType: "PARTIAL" | "FULL"; // 部分 / 全额退款
  note?: string;
  createdAt: string;
}

export type ChargebackReason = "欺诈" | "未收到商品" | "商品不符" | "其他";
export type ChargebackStatus = "待响应" | "已提交证据" | "胜诉" | "败诉";

export interface ChargebackEvidence {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
}

export interface ChargebackTimelineStep {
  title: string;
  timestamp: string;
  status: "completed" | "current" | "pending";
  description?: string;
}

export interface ChargebackRecord {
  id: string; // 拒付单号
  transactionNo: string; // 关联交易号
  tenantId: TenantId;
  channel: PaymentChannel;
  amount: number; // 争议金额
  currency: string;
  reason: ChargebackReason;
  status: ChargebackStatus;
  deadline: string; // 响应截止时间
  remainingDays: number; // 剩余天数
  evidence: ChargebackEvidence[]; // 证据文件列表
  timeline: ChargebackTimelineStep[];
  note?: string;
}

// ============================================================
// P1: 汇率管理
// ============================================================
export interface ExchangeRate {
  id: string;
  baseCurrency: string; // 基础币种，如 USD
  targetCurrency: string; // 目标币种，如 EUR
  bid: number; // 买入价（1 基础币兑换目标币）
  ask: number; // 卖出价
  effectiveFrom: string; // 生效时间
  status: "ENABLED" | "DISABLED";
  remark?: string;
  updatedAt: string;
}

// ============================================================
// P1: 费率规则引擎
// ============================================================
export type MerchantTier = "ALL" | "NORMAL" | "VIP" | "STRATEGIC";

export interface FeeRule {
  id: string;
  name: string; // 规则名称
  channels: PaymentChannel[]; // 适用渠道
  currency: string; // 适用币种
  minAmount: number; // 金额区间下限
  maxAmount: number; // 金额区间上限（Infinity 用 -1 表示无上限）
  merchantTier: MerchantTier; // 商户分级
  fixedFee: number; // 固定费
  percentFee: number; // 百分比费率，如 2.9 表示 2.9%
  priority: number; // 优先级，数字越小越高
  status: "ENABLED" | "DISABLED";
  createdAt: string;
}

// ============================================================
// P1: 风控规则配置 & 黑名单管理
// ============================================================
export type RiskRuleType = "THREE_DS" | "FAILURE_RATE" | "ABNORMAL_AMOUNT" | "ABNORMAL_FREQ";
export type RiskAction = "BLOCK" | "ALERT" | "MANUAL_REVIEW";

export interface RiskRule {
  id: string;
  name: string; // 规则名称
  type: RiskRuleType; // 规则类型
  condition: string; // 触发条件描述
  action: RiskAction; // 动作
  params: Record<string, string | number>; // 阈值参数
  status: "ENABLED" | "DISABLED";
  updatedAt: string;
}

export type BlacklistType = "CARD_BIN" | "IP" | "EMAIL";

export interface BlacklistEntry {
  id: string;
  type: BlacklistType; // 类型：卡BIN / IP / 邮箱
  value: string; // 黑名单值
  reason: string; // 原因
  expiresAt: string; // 添加/过期时间
  status: "ACTIVE" | "EXPIRED";
  createdAt: string;
}

// ============================================================
// P1: 商户 / KYB 审核
// ============================================================
export type MerchantApplyType = "NEW" | "CHANGE";
export type MerchantReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface MerchantDocument {
  name: string; // 文件名
  type: string; // 文件类型（营业执照 / 法人身份证 / 银行流水等）
  size: string; // 文件大小
  uploadedAt: string; // 上传时间
}

export interface MerchantApplication {
  id: string;
  companyName: string; // 公司名称
  country: string; // 国家代码 US/UK/JP/DE/SG/HK/CA/AU
  applyType: MerchantApplyType; // 申请类型
  contactPerson: string; // 联系人
  contactEmail: string; // 联系邮箱
  documents: MerchantDocument[]; // 资质文件
  status: MerchantReviewStatus;
  submittedAt: string; // 申请时间
  rejectReason?: string; // 驳回原因
}

// ============================================================
// P2: 告警与通知
// ============================================================
export type AlertMonitorObject = "CHANNEL_ABNORMAL" | "RECON_DIFF" | "FAIL_RATE" | "PAYOUT_FAIL";
export type AlertSeverity = "P0" | "P1" | "P2";
export type NotifyChannel = "IN_APP" | "EMAIL" | "WEBHOOK";
export type AlertRuleStatus = "ENABLED" | "DISABLED";

export interface AlertRule {
  id: string;
  name: string; // 规则名称
  monitorObject: AlertMonitorObject; // 监控对象
  triggerCondition: string; // 触发条件描述
  severity: AlertSeverity; // 严重级别
  notifyChannels: NotifyChannel[]; // 通知渠道
  status: AlertRuleStatus;
  thresholdParams: Record<string, string | number>; // 阈值参数
  updatedAt: string;
  updatedBy: string;
}

export type AlertHistoryStatus = "UNHANDLED" | "PROCESSING" | "RESOLVED" | "IGNORED";

export interface AlertTimelineStep {
  title: string;
  timestamp: string;
  description?: string;
}

export interface AlertHandlingRecord {
  operator: string;
  action: string;
  note?: string;
  time: string;
}

export interface AlertHistory {
  id: string;
  title: string; // 告警标题
  ruleName: string; // 规则名称
  severity: AlertSeverity;
  status: AlertHistoryStatus;
  triggerTime: string;
  assignee?: string; // 处理人
  message?: string;
  timeline: AlertTimelineStep[];
  handlingRecords: AlertHandlingRecord[];
}

// ============================================================
// P2: 系统参数与定时任务
// ============================================================
export type SystemConfigCategory = "支付" | "邮件" | "风控" | "结算" | "系统";

export interface SystemConfigParam {
  id: string;
  key: string; // 参数键
  value: string; // 参数值
  description: string; // 描述
  category: SystemConfigCategory;
  updatedAt: string;
  updatedBy: string; // 操作人
  remark?: string;
}

export type ScheduledTaskType = "对账任务" | "结算任务" | "汇率同步" | "邮件重试" | "数据归档";
export type TaskRunStatus = "SUCCESS" | "FAILED" | "RUNNING";

export interface TaskExecutionLog {
  id: string;
  time: string;
  status: TaskRunStatus;
  durationMs: number; // 耗时（毫秒）
  summary: string; // 输出摘要
}

export interface ScheduledTask {
  id: string;
  name: string; // 任务名称
  type: ScheduledTaskType;
  cron: string; // Cron 表达式
  lastRunAt?: string;
  lastRunStatus?: TaskRunStatus;
  nextRunAt?: string;
  status: "ENABLED" | "DISABLED";
  logs?: TaskExecutionLog[];
}
