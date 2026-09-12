import React, { useState, useEffect } from "react";
import { LayoutDashboard, Receipt, Wallet, RotateCcw, User } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { ReconciliationView } from "./components/ReconciliationView";
import { TransactionsView } from "./components/TransactionsView";
import { PaymentChannelsView } from "./components/PaymentChannelsView";
import { PaymentWebhooksView } from "./components/PaymentWebhooksView";
import { ApplicationManagementView } from "./components/ApplicationManagementView";
import { EmailChannelsView } from "./components/EmailChannelsView";
import { EmailWebhooksView } from "./components/EmailWebhooksView";
import { EmailTemplatesView } from "./components/EmailTemplatesView";
import { UserManagementView } from "./components/UserManagementView";
import { SystemUserManagementView } from "./components/SystemUserManagementView";
import { PermissionsView } from "./components/PermissionsView";
import { FinancialReportsView } from "./components/FinancialReportsView";
import { ProductsView } from "./components/ProductsView";
import { DiscountsView } from "./components/DiscountsView";
import { PromoCampaignsView } from "./components/PromoCampaignsView";
import { DictionaryView } from "./components/DictionaryView";
import { MenusView } from "./components/MenusView";
import { RolesView } from "./components/RolesView";
import { DepartmentManagementView } from "./components/DepartmentManagementView";
import { SettlementsView } from "./components/SettlementsView";
import { RefundsView } from "./components/RefundsView";
import { AuditLogsView } from "./components/AuditLogsView";
import { ExchangeRatesView } from "./components/ExchangeRatesView";
import { FeeRulesView } from "./components/FeeRulesView";
import { RiskRulesView } from "./components/RiskRulesView";
import { MerchantReviewView } from "./components/MerchantReviewView";
import { UserSettingsModal } from "./components/UserSettingsModal";
import { QuickCreateModal } from "./components/QuickCreateModal";
import { DiscrepancyModal } from "./components/DiscrepancyModal";
import {
  Tenant,
  SystemUser,
  Department,
  TransactionRecord,
  AuditLog,
  PaymentChannelConfig,
  EmailChannelConfig,
  PaymentApp,
  EndUser,
  PaymentWebhookLog,
  EmailWebhookLog,
  EmailTemplate,
  ProductConfig,
  DiscountConfig,
  PromoCampaign,
  DictionaryEntry,
  SystemMenuItem,
  UserProfileSettings,
  RbacRole,
  SettlementBatch,
  RefundRecord,
  ChargebackRecord,
  ExchangeRate,
  FeeRule,
  RiskRule,
  BlacklistEntry,
  MerchantApplication,
} from "./types/payment";
import { getStoredTheme, applyTheme } from "./lib/theme";
import {
  INITIAL_TENANTS,
  SYSTEM_USERS,
  DEPARTMENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_PAYMENT_CHANNELS,
  INITIAL_EMAIL_CHANNELS,
  INITIAL_APPS,
  INITIAL_END_USERS,
  INITIAL_PAYMENT_WEBHOOKS,
  INITIAL_EMAIL_WEBHOOKS,
  INITIAL_EMAIL_TEMPLATES,
  INITIAL_PRODUCTS,
  INITIAL_DISCOUNTS,
  INITIAL_PROMO_CAMPAIGNS,
  INITIAL_DICTIONARY,
  INITIAL_MENUS,
  RBAC_ROLES,
  INITIAL_SETTLEMENTS,
  INITIAL_REFUNDS,
  INITIAL_CHARGEBACKS,
  INITIAL_EXCHANGE_RATES,
  INITIAL_FEE_RULES,
  INITIAL_RISK_RULES,
  INITIAL_BLACKLIST,
  INITIAL_MERCHANT_APPLICATIONS,
} from "./data/mockData";

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(INITIAL_TENANTS[0]);
  const [allUsers, setAllUsers] = useState<SystemUser[]>(SYSTEM_USERS);
  const [currentUser, setCurrentUser] = useState<SystemUser>(SYSTEM_USERS[0]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Overseas configurations & entities
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelConfig[]>(INITIAL_PAYMENT_CHANNELS);
  const [emailChannels, setEmailChannels] = useState<EmailChannelConfig[]>(INITIAL_EMAIL_CHANNELS);
  const [paymentApps, setPaymentApps] = useState<PaymentApp[]>(INITIAL_APPS);
  const [endUsers, setEndUsers] = useState<EndUser[]>(INITIAL_END_USERS);
  const [paymentWebhooks, setPaymentWebhooks] = useState<PaymentWebhookLog[]>(INITIAL_PAYMENT_WEBHOOKS);
  const [emailWebhooks, setEmailWebhooks] = useState<EmailWebhookLog[]>(INITIAL_EMAIL_WEBHOOKS);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(INITIAL_EMAIL_TEMPLATES);

  // New modules: Products, Discounts, Campaigns, Dictionary, Menus, Roles
  const [products, setProducts] = useState<ProductConfig[]>(INITIAL_PRODUCTS);
  const [discounts, setDiscounts] = useState<DiscountConfig[]>(INITIAL_DISCOUNTS);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>(INITIAL_PROMO_CAMPAIGNS);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>(INITIAL_DICTIONARY);
  const [menus, setMenus] = useState<SystemMenuItem[]>(INITIAL_MENUS);
  const [rolesList, setRolesList] = useState<RbacRole[]>(Object.values(RBAC_ROLES));
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(SYSTEM_USERS);
  const [departments, setDepartments] = useState<Department[]>(DEPARTMENTS);

  // P0: 结算 / 退款 / 拒付
  const [settlements, setSettlements] = useState<SettlementBatch[]>(INITIAL_SETTLEMENTS);
  const [refunds, setRefunds] = useState<RefundRecord[]>(INITIAL_REFUNDS);
  const [chargebacks, setChargebacks] = useState<ChargebackRecord[]>(INITIAL_CHARGEBACKS);

  // P1: 汇率 / 费率规则 / 风控规则与黑名单 / 商户审核
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>(INITIAL_EXCHANGE_RATES);
  const [feeRules, setFeeRules] = useState<FeeRule[]>(INITIAL_FEE_RULES);
  const [riskRules, setRiskRules] = useState<RiskRule[]>(INITIAL_RISK_RULES);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(INITIAL_BLACKLIST);
  const [merchantApps, setMerchantApps] = useState<MerchantApplication[]>(INITIAL_MERCHANT_APPLICATIONS);

  // Current View & Modals
  const VALID_TABS = [
    "dashboard", "transactions", "reconciliation", "products", "discounts",
    "promo_campaigns", "payment_channels", "payment_webhooks", "apps",
    "email_channels", "email_webhooks", "email_templates", "dictionary",
    "users", "roles", "permissions", "menus", "departments", "system_users",
    "settlements", "refunds", "audit_logs",
    "exchange_rates", "fee_rules", "risk_rules", "merchant_review",
  ];
  const tabFromHash = (): string => {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    return VALID_TABS.includes(raw) ? raw : "dashboard";
  };
  const [currentTab, setCurrentTab] = useState<string>(tabFromHash);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [quickCreateOpen, setQuickCreateOpen] = useState<boolean>(false);
  const [activeDiscrepancyTx, setActiveDiscrepancyTx] = useState<TransactionRecord | null>(null);
  const [userSettingsOpen, setUserSettingsOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // 切换页面：更新 state 并同步 URL hash
  const navigateToTab = (tab: string) => {
    if (!VALID_TABS.includes(tab)) tab = "dashboard";
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    if (window.location.hash !== `#/${tab}`) {
      window.history.replaceState(null, "", `#/${tab}`);
    }
  };

  // 初始化：读取持久化主题并挂载到根节点
  useEffect(() => {
    applyTheme(getStoredTheme());
    // 监听 hash 变化（地址栏改 hash / 前进后退）切换页面
    const onHashChange = () => setCurrentTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K opens Quick Create
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQuickCreateOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Real-time Overseas Transaction Simulator Stream
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const sampleTitles = [
        "Novas AI Copilot 订阅年付",
        "Global VPN Shield 周期自动扣费",
        "PixelMagic Studio 商业版许可证授权",
        "Nordic Living 独立站结账收单",
        "Stripe 国际信用卡定期账单扣款",
        "PayPal 欧洲商户周期订阅结算",
      ];
      const channels = ["stripe", "paypal", "adyen", "apple_pay", "klarna"] as const;
      const targetBUs = ["bu_na_ecom", "bu_eu_saas", "bu_apac_japan"] as const;

      const randomBU = targetBUs[Math.floor(Math.random() * targetBUs.length)];
      const randomChannel = channels[Math.floor(Math.random() * channels.length)];
      const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
      const randomAmount = Math.floor(45 + Math.random() * 650);

      const newTx: TransactionRecord = {
        id: `tx_live_${Date.now().toString().slice(-6)}`,
        tenantId: randomBU,
        channel: randomChannel,
        orderTitle: randomTitle,
        orderNumber: `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        channelTradeNo: `${randomChannel.toUpperCase()}_ch_${Math.random().toString(36).substring(2, 10)}`,
        userIdentifier: `cust_${Math.random().toString(36).substring(2, 7)}@global.io`,
        orderAmount: randomAmount,
        amount: randomAmount,
        currency: "USD",
        channelFee: Number((randomAmount * 0.029 + 0.3).toFixed(2)),
        fee: Number((randomAmount * 0.029 + 0.3).toFixed(2)),
        netAmount: Number((randomAmount - (randomAmount * 0.029 + 0.3)).toFixed(2)),
        status: "done",
        reconStatus: "MATCHED",
        paymentMethod:
          randomChannel === "stripe"
            ? "Visa **** 4242"
            : randomChannel === "paypal"
            ? "PayPal Balance"
            : "Mastercard **** 8899",
        productDescription: randomTitle,
        reviewer: {
          name: "系统自动平账",
          role: "自动清算引擎",
        },
        createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        reconciledAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        lifecycle: [
          {
            stage: "ORDER_CREATED",
            title: "海外收银台下单拉起",
            timestamp: new Date(Date.now() - 3200).toISOString().replace("T", " ").substring(0, 19),
            description: `客户选购 [${randomTitle}]，拉起 ${randomChannel.toUpperCase()} 收银台`,
            operator: "SYSTEM_GATEWAY",
            status: "SUCCESS",
          },
          {
            stage: "PAYMENT_SUBMITTED",
            title: "网关预授权与欺诈风控通过",
            timestamp: new Date(Date.now() - 2100).toISOString().replace("T", " ").substring(0, 19),
            description: `3D Secure 2.0 验证通过，CVV/AVS 匹配成功`,
            operator: randomChannel.toUpperCase(),
            status: "SUCCESS",
          },
          {
            stage: "WEBHOOK_RECEIVED",
            title: "支付网关异步 Webhook 回调接收",
            timestamp: new Date(Date.now() - 1000).toISOString().replace("T", " ").substring(0, 19),
            description: `收到 charge.succeeded 回执，签名校验一致`,
            operator: "WEBHOOK_WORKER",
            status: "SUCCESS",
          },
          {
            stage: "SETTLED",
            title: "交易确认 & 权益即时开通",
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
            description: `出海订单金额已安全归集入账并同步触发 SendGrid 电子收据`,
            operator: "BILLING_CORE",
            status: "SUCCESS",
          },
        ],
      };

      setTransactions((prev) => [newTx, ...prev.slice(0, 75)]);
    }, 9000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Handle Quick Create Transaction
  const handleCreateTransaction = (newTx: TransactionRecord) => {
    setTransactions((prev) => [newTx, ...prev]);

    const newAudit: AuditLog = {
      id: `audit_${Date.now().toString().slice(-6)}`,
      action: "MANUAL_ORDER_SUBMIT",
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role || currentUser.roleKey,
      targetResource: "TRANSACTIONS",
      operator: currentUser.name,
      operatorRole: currentUser.role || currentUser.roleKey,
      tenantId: newTx.tenantId,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      targetId: newTx.orderNumber || newTx.id,
      details: `通过快捷窗口模拟发起一笔 ${newTx.orderAmount || newTx.amount} ${newTx.currency} 交易`,
      ipAddress: "192.168.1.100",
      status: "SUCCESS",
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  // Handle Discrepancy Resolution
  const handleResolveDiscrepancy = (txId: string, resolutionType: string, note: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          const updatedLifecycle = [
            ...(t.lifecycle || []),
            {
              stage: "RECONCILED" as const,
              title: "财务人工平账完成",
              timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
              description: `财务人员执行处理: [${resolutionType}] - ${note}`,
              operator: currentUser.name,
              status: "SUCCESS" as const,
            },
          ];
          return {
            ...t,
            reconStatus: "MANUALLY_ADJUSTED",
            discrepancyReason: undefined,
            lifecycle: updatedLifecycle,
          };
        }
        return t;
      })
    );

    const audit: AuditLog = {
      id: `audit_${Date.now().toString().slice(-6)}`,
      action: "RECONCILIATION_RESOLVE",
      operator: currentUser.name,
      operatorRole: currentUser.role,
      tenantId: currentTenant.id,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      targetId: txId,
      details: `执行人工核销处理: ${resolutionType}. 备注: ${note}`,
      ipAddress: "127.0.0.1",
    };
    setAuditLogs((prev) => [audit, ...prev]);
    setActiveDiscrepancyTx(null);
  };

  // Handle Quick Auto-resolve done
  const handleQuickDone = (tx: TransactionRecord) => {
    handleResolveDiscrepancy(tx.id, "ACCEPT_CHANNEL_REPORT", "仪表盘快捷处置：以网关结算单为准自动平账");
  };

  // Auto reconcile all
  const handleAutoReconcileAll = () => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.reconStatus === "DISCREPANCY") {
          return {
            ...t,
            reconStatus: "MANUALLY_ADJUSTED",
            discrepancyReason: undefined,
          };
        }
        return t;
      })
    );
  };

  // Save User Profile Settings (Avatar, Password, Name, etc.)
  const handleSaveUserProfile = (profile: UserProfileSettings) => {
    const updatedUser: SystemUser = {
      ...currentUser,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    };
    setCurrentUser(updatedUser);
    setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));

    const audit: AuditLog = {
      id: `audit_${Date.now().toString().slice(-6)}`,
      action: "PROFILE_UPDATE",
      userId: updatedUser.id,
      userName: updatedUser.name,
      role: updatedUser.role || updatedUser.roleKey,
      targetResource: "USER_PROFILE",
      operator: updatedUser.name,
      operatorRole: updatedUser.role || updatedUser.roleKey,
      tenantId: updatedUser.tenantId,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      targetId: updatedUser.id,
      details: profile.newPassword
        ? "更新个人基本资料、头像并安全修改登录密码"
        : "更新个人基本资料与头像图片",
      ipAddress: "127.0.0.1",
      status: "SUCCESS",
    };
    setAuditLogs((prev) => [audit, ...prev]);
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "集团出海聚合支付监控看板";
      case "transactions":
        return "全渠道交易流水与订单状态流";
      case "reconciliation":
        return "跨境资金对账与长短款稽核";
      case "products":
        return "海外商品方案与周期订阅配置";
      case "discounts":
        return "折扣策略与全场优惠券配置";
      case "promo_campaigns":
        return "出海促销邮件营销活动派发";
      case "payment_channels":
        return "海外支付渠道配置 (Stripe / PayPal / Adyen)";
      case "payment_webhooks":
        return "支付 Webhook 回调监听与全量接收调度";
      case "apps":
        return "接入应用与密钥管理 (Client Apps)";
      case "email_channels":
        return "海外邮件渠道配置 (SendGrid / SES / Resend)";
      case "email_webhooks":
        return "邮件投递回执与反垃圾邮件信誉审计";
      case "email_templates":
        return "多语言邮件管理 (独立单一邮件与多语种配置)";
      case "dictionary":
        return "字典管理 (全局多语言统一共享字典)";
      case "users":
        return "海外终端客户与全周期行为大盘";
      case "departments":
        return "部门管理 (组织部门树结构、成员与绑定角色)";
      case "roles":
        return "角色管理 (Roles)";
      case "permissions":
        return "权限管理 (基于菜单树的角色与权限配置)";
      case "menus":
        return "系统菜单与导航节点管理";
      case "system_users":
        return "用户管理 (角色权限与应用权限)";
      case "settlements":
        return "结算与出金管理";
      case "refunds":
        return "退款与拒付管理";
      case "audit_logs":
        return "操作审计日志";
      case "exchange_rates":
        return "汇率管理";
      case "fee_rules":
        return "费率规则引擎";
      case "risk_rules":
        return "风控规则与黑名单";
      case "merchant_review":
        return "商户 / KYB 审核";
      default:
        return "海外聚合支付中台";
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page font-sans text-fg antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Left Sidebar (desktop only, md+) */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          menus={menus}
          currentTab={currentTab}
          setCurrentTab={navigateToTab}
          currentUser={currentUser}
          onOpenUserSettings={() => setUserSettingsOpen(true)}
          onOpenQuickCreate={() => setQuickCreateOpen(true)}
        />
      </div>

      {/* Mobile drawer sidebar (off-canvas, <md) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 h-full animate-in slide-in-from-left duration-300 ease-out">
            <Sidebar
              menus={menus}
              currentTab={currentTab}
              setCurrentTab={navigateToTab}
              currentUser={currentUser}
              onOpenUserSettings={() => {
                setUserSettingsOpen(true);
                setMobileMenuOpen(false);
              }}
              onOpenQuickCreate={() => setQuickCreateOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentTenant={currentTenant}
          currentUser={currentUser}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          onRefreshData={() => {
            // 刷新当前页数据：重挂载当前视图以重新触发骨架屏与数据加载，停留当前页
            setRefreshTick((n) => n + 1);
          }}
          onToggleSidebar={() => setMobileMenuOpen((v) => !v)}
          currentViewTitle={getTabTitle()}
        />

        {/* Dynamic View Scroll Container (key 随当前页+刷新计数变化，刷新即重挂载重跑骨架屏) */}
        <main key={`${currentTab}-${refreshTick}`} className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 pb-20 md:pb-4 max-w-7xl w-full mx-auto">
          {currentTab === "dashboard" && (
            <DashboardView
              currentTenant={currentTenant}
              currentUser={currentUser}
              transactions={transactions}
              onOpenDiscrepancy={(tx) => setActiveDiscrepancyTx(tx)}
              onResolveQuickDone={handleQuickDone}
            />
          )}

          {currentTab === "transactions" && (
            <TransactionsView
              currentTenant={currentTenant}
              currentUser={currentUser}
              transactions={transactions}
              onOpenDiscrepancy={(tx) => setActiveDiscrepancyTx(tx)}
            />
          )}

          {currentTab === "reconciliation" && (
            <ReconciliationView
              currentTenant={currentTenant}
              currentUser={currentUser}
              transactions={transactions}
              onOpenDiscrepancy={(tx) => setActiveDiscrepancyTx(tx)}
              onAutoReconcileAll={handleAutoReconcileAll}
            />
          )}

          {currentTab === "products" && (
            <ProductsView
              products={products}
              currentTenant={currentTenant}
              paymentChannels={paymentChannels}
              onSaveProduct={(updated) => {
                setProducts((prev) => {
                  const exists = prev.some((p) => p.id === updated.id);
                  return exists
                    ? prev.map((p) => (p.id === updated.id ? updated : p))
                    : [updated, ...prev];
                });
              }}
            />
          )}

          {currentTab === "discounts" && (
            <DiscountsView
              discounts={discounts}
              currentTenant={currentTenant}
              paymentChannels={paymentChannels}
              onSaveDiscount={(updated) => {
                setDiscounts((prev) => {
                  const exists = prev.some((d) => d.id === updated.id);
                  return exists
                    ? prev.map((d) => (d.id === updated.id ? updated : d))
                    : [updated, ...prev];
                });
              }}
            />
          )}

          {currentTab === "promo_campaigns" && (
            <PromoCampaignsView
              campaigns={campaigns}
              discounts={discounts}
              templates={emailTemplates}
              currentTenant={currentTenant}
              onSaveCampaign={(updated) => {
                setCampaigns((prev) => {
                  const exists = prev.some((c) => c.id === updated.id);
                  return exists
                    ? prev.map((c) => (c.id === updated.id ? updated : c))
                    : [updated, ...prev];
                });
              }}
            />
          )}

          {currentTab === "payment_channels" && (
            <PaymentChannelsView
              channels={paymentChannels}
              apps={paymentApps}
              dictionary={dictionary}
              onSaveChannel={(updated) => {
                setPaymentChannels((prev) =>
                  prev.some((c) => c.id === updated.id)
                    ? prev.map((c) => (c.id === updated.id ? updated : c))
                    : [updated, ...prev]
                );
              }}
              onUpdateChannel={(updated) => {
                setPaymentChannels((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                );
              }}
              onCreateTestTransaction={(newTx) => {
                setTransactions((prev) => [newTx, ...prev]);
              }}
              onNavigateToTransactions={() => navigateToTab("transactions")}
            />
          )}

          {currentTab === "payment_webhooks" && (
            <PaymentWebhooksView logs={paymentWebhooks} />
          )}

          {currentTab === "apps" && (
            <ApplicationManagementView
              apps={paymentApps}
              paymentChannels={paymentChannels}
              emailChannels={emailChannels}
              products={products}
              discounts={discounts}
              emailTemplates={emailTemplates}
              tenants={tenants}
              onUpdateApp={(updated) => {
                setPaymentApps((prev) =>
                  prev.map((a) => (a.id === updated.id ? updated : a))
                );
              }}
              onSaveApp={(newOrUpdated) => {
                setPaymentApps((prev) => {
                  const exists = prev.some((a) => a.id === newOrUpdated.id);
                  return exists
                    ? prev.map((a) => (a.id === newOrUpdated.id ? newOrUpdated : a))
                    : [newOrUpdated, ...prev];
                });
              }}
            />
          )}

          {currentTab === "email_channels" && (
            <EmailChannelsView
              channels={emailChannels}
              onUpdateChannel={(updated) => {
                setEmailChannels((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                );
              }}
              onAddChannel={(channel) => {
                setEmailChannels((prev) => [channel, ...prev]);
              }}
            />
          )}

          {currentTab === "email_webhooks" && (
            <EmailWebhooksView logs={emailWebhooks} />
          )}

          {currentTab === "email_templates" && (
            <EmailTemplatesView
              templates={emailTemplates}
              dictionary={dictionary}
              onSaveTemplate={(updated) => {
                setEmailTemplates((prev) => {
                  const exists = prev.some((t) => t.id === updated.id);
                  return exists
                    ? prev.map((t) => (t.id === updated.id ? updated : t))
                    : [updated, ...prev];
                });
              }}
              onDeleteTemplate={(id) => {
                setEmailTemplates((prev) => prev.filter((t) => t.id !== id));
              }}
            />
          )}

          {currentTab === "dictionary" && (
            <DictionaryView
              dictionary={dictionary}
              currentTenant={currentTenant}
              onSaveEntry={(updated) => {
                setDictionary((prev) => {
                  const exists = prev.some((d) => d.id === updated.id);
                  return exists
                    ? prev.map((d) => (d.id === updated.id ? updated : d))
                    : [updated, ...prev];
                });
              }}
              onDeleteEntry={(id) => {
                setDictionary((prev) => prev.filter((d) => d.id !== id));
              }}
            />
          )}

          {currentTab === "users" && (
            <UserManagementView users={endUsers} />
          )}

          {currentTab === "roles" && (
            <RolesView
              roles={rolesList}
              menus={menus}
              apps={paymentApps}
              onSaveRole={(updated) => {
                setRolesList((prev) => {
                  const exists = prev.some((r) => r.id === updated.id);
                  return exists
                    ? prev.map((r) => (r.id === updated.id ? updated : r))
                    : [...prev, updated];
                });
              }}
              onDeleteRole={(roleId) => {
                setRolesList((prev) => prev.filter((r) => r.id !== roleId && r.key !== roleId));
              }}
            />
          )}

          {currentTab === "permissions" && (
            <PermissionsView
              roles={rolesList}
              menus={menus}
              apps={paymentApps}
              onSaveRole={(updated) => {
                setRolesList((prev) => {
                  const exists = prev.some((r) => r.id === updated.id);
                  return exists
                    ? prev.map((r) => (r.id === updated.id ? updated : r))
                    : [...prev, updated];
                });
              }}
              onDeleteRole={(roleId) => {
                setRolesList((prev) => prev.filter((r) => r.id !== roleId && r.key !== roleId));
              }}
            />
          )}

          {currentTab === "menus" && (
            <MenusView
              menus={menus}
              currentTenant={currentTenant}
              onSaveMenu={(updated) => {
                setMenus((prev) => {
                  const exists = prev.some((m) => m.id === updated.id);
                  return exists
                    ? prev.map((m) => (m.id === updated.id ? updated : m))
                    : [...prev, updated];
                });
              }}
            />
          )}

          {currentTab === "departments" && (
            <DepartmentManagementView
              departments={departments}
              users={systemUsers}
              roles={rolesList}
              onSaveDepartment={(updated) => {
                setDepartments((prev) => {
                  const exists = prev.some((d) => d.id === updated.id);
                  return exists
                    ? prev.map((d) => (d.id === updated.id ? updated : d))
                    : [...prev, updated];
                });
              }}
              onDeleteDepartment={(deptId) => {
                setDepartments((prev) => prev.filter((d) => d.id !== deptId));
              }}
            />
          )}

          {currentTab === "system_users" && (
            <SystemUserManagementView
              users={systemUsers}
              roles={rolesList}
              apps={paymentApps}
              departments={departments}
              currentUser={currentUser}
              onSaveUser={(updatedUser) => {
                setSystemUsers((prev) => {
                  const exists = prev.some((u) => u.id === updatedUser.id);
                  return exists
                    ? prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
                    : [updatedUser, ...prev];
                });
                if (updatedUser.id === currentUser.id) {
                  setCurrentUser(updatedUser);
                }
              }}
              onDeleteUser={(userId) => {
                setSystemUsers((prev) => prev.filter((u) => u.id !== userId));
              }}
            />
          )}

          {currentTab === "settlements" && (
            <SettlementsView
              batches={settlements}
            />
          )}

          {currentTab === "refunds" && (
            <RefundsView
              refunds={refunds}
              chargebacks={chargebacks}
            />
          )}

          {currentTab === "audit_logs" && (
            <AuditLogsView
              logs={auditLogs}
            />
          )}

          {currentTab === "exchange_rates" && (
            <ExchangeRatesView
              rates={exchangeRates}
              dictionary={dictionary}
            />
          )}

          {currentTab === "fee_rules" && (
            <FeeRulesView
              rules={feeRules}
            />
          )}

          {currentTab === "risk_rules" && (
            <RiskRulesView
              rules={riskRules}
              blacklist={blacklist}
            />
          )}

          {currentTab === "merchant_review" && (
            <MerchantReviewView
              applications={merchantApps}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar (<md only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface border-t border-line flex items-stretch h-16 px-1 pb-[env(safe-area-inset-bottom)]">
        {[
          { key: "dashboard", label: "看板", icon: LayoutDashboard, tab: "dashboard" as const },
          { key: "transactions", label: "交易", icon: Receipt, tab: "transactions" as const },
          { key: "settlements", label: "结算", icon: Wallet, tab: "settlements" as const },
          { key: "refunds", label: "退款", icon: RotateCcw, tab: "refunds" as const },
          { key: "me", label: "我的", icon: User, tab: null },
        ].map((item) => {
          const active = item.tab ? currentTab === item.tab : false;
          const IconCmp = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.tab) navigateToTab(item.tab);
                else setUserSettingsOpen(true);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-fg-tertiary"
              }`}
            >
              <IconCmp className={`w-5 h-5 ${active ? "text-primary" : "text-fg-tertiary"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Settings Modal (Avatar, Password, Name) */}
      <UserSettingsModal
        isOpen={userSettingsOpen}
        onClose={() => setUserSettingsOpen(false)}
        currentUser={currentUser}
        onSaveProfile={handleSaveUserProfile}
      />

      {/* Quick Create Modal */}
      {quickCreateOpen && (
        <QuickCreateModal
          tenants={tenants}
          currentTenant={currentTenant}
          currentUser={currentUser}
          onClose={() => setQuickCreateOpen(false)}
          onCreateTransaction={handleCreateTransaction}
        />
      )}

      {/* Discrepancy Resolution Modal */}
      {activeDiscrepancyTx && (
        <DiscrepancyModal
          transaction={activeDiscrepancyTx}
          currentUser={currentUser}
          onClose={() => setActiveDiscrepancyTx(null)}
          onResolve={handleResolveDiscrepancy}
        />
      )}
    </div>
  );
}
