import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { TenantManagementView } from "./components/TenantManagementView";
import { EmailWebhooksView } from "./components/EmailWebhooksView";
import { EmailTemplatesView } from "./components/EmailTemplatesView";
import { UserManagementView } from "./components/UserManagementView";
import { SystemUserManagementView } from "./components/SystemUserManagementView";
import { PermissionPacksView } from "./components/PermissionPacksView";
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
import { AlertsView } from "./components/AlertsView";
import { SystemConfigView } from "./components/SystemConfigView";
import { ScheduledTaskDetailView } from "./components/ScheduledTaskDetailView";
import { UserSettingsModal } from "./components/UserSettingsModal";
import { QuickCreateModal } from "./components/QuickCreateModal";
import { DiscrepancyModal } from "./components/DiscrepancyModal";
import LoginPage from "./components/LoginPage";
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
  PermissionPack,
  SettlementBatch,
  RefundRecord,
  ChargebackRecord,
  ExchangeRate,
  FeeRule,
  RiskRule,
  BlacklistEntry,
  MerchantApplication,
  AlertRule,
  AlertHistory,
} from "./types/payment";
import { getStoredTheme, applyTheme } from "./lib/theme";
import { isAuthenticated, setAuthenticated, clearAuth, probeSession, logoutSession } from "./lib/auth";
import { loadShellIamData } from "./lib/iamBootstrap";
import {
  persistUser,
  removeUser,
  resetUserPassword,
  persistRole,
  removeRole,
  persistPermissionPack,
  persistPermissionPackMenus,
  removePermissionPack,
  persistMenu,
  removeMenu,
  persistDepartment,
  removeDepartment,
  persistDictionaryEntry,
  removeDictionaryEntry,
} from "./lib/iamActions";
import { filterMenusForUser, canAccessTab, firstAccessibleTab } from "./lib/menuAccess";
import { PermissionGate, PermissionProvider } from "./lib/permission";
import { USE_MOCK } from "./api/config";
import * as tenantsApi from "./api/modules/tenants";
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
  INITIAL_PERMISSION_PACKS,
  INITIAL_SETTLEMENTS,
  INITIAL_REFUNDS,
  INITIAL_CHARGEBACKS,
  INITIAL_EXCHANGE_RATES,
  INITIAL_FEE_RULES,
  INITIAL_RISK_RULES,
  INITIAL_BLACKLIST,
  INITIAL_MERCHANT_APPLICATIONS,
  INITIAL_ALERT_RULES,
  INITIAL_ALERT_HISTORY,
} from "./data/mockData";

export default function App() {
  const { t } = useTranslation(["nav", "common"]);
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
  const [permissionPacks, setPermissionPacks] = useState<PermissionPack[]>(INITIAL_PERMISSION_PACKS);
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

  // P2: 告警与通知 / 系统参数与定时任务（系统参数页自拉 API）
  const [alertRules, setAlertRules] = useState<AlertRule[]>(INITIAL_ALERT_RULES);
  const [alertHistories, setAlertHistories] = useState<AlertHistory[]>(INITIAL_ALERT_HISTORY);

  // Current View & Modals
  const VALID_TABS = [
    "dashboard", "transactions", "reconciliation", "products", "discounts",
    "promo_campaigns", "payment_channels", "payment_webhooks", "apps",
    "email_channels", "email_webhooks", "email_templates", "dictionary",
    "users", "roles", "permissions", "permission_packs", "menus", "departments", "system_users",
    "settlements", "refunds", "audit_logs",
    "exchange_rates", "fee_rules", "risk_rules", "merchant_review", "tenants",
    "alerts", "system_config", "scheduled_tasks",
  ];
  const normalizeTab = (raw: string): string =>
    raw === "permissions" ? "permission_packs" : raw;
  const parseHash = (): { tab: string; taskId: string | null } => {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    if (raw === "login") return { tab: "login", taskId: null };
    const detail = raw.match(/^scheduled_tasks\/([^/?#]+)/);
    if (detail) return { tab: "scheduled_tasks", taskId: detail[1] };
    if (raw === "scheduled_tasks") return { tab: "scheduled_tasks", taskId: null };
    const tab = normalizeTab(raw);
    return { tab: VALID_TABS.includes(tab) || VALID_TABS.includes(raw) ? tab : "dashboard", taskId: null };
  };
  const tabFromHash = (): string => parseHash().tab;
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (USE_MOCK) return isAuthenticated() ? tabFromHash() : "login";
    // 真实环境：会话需异步探测，初始先按 hash 占位，避免误渲染登录页
    const hash = tabFromHash();
    return hash === "login" ? "dashboard" : hash;
  });
  const [scheduledTaskId, setScheduledTaskId] = useState<string | null>(() => parseHash().taskId);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [quickCreateOpen, setQuickCreateOpen] = useState<boolean>(false);
  const [activeDiscrepancyTx, setActiveDiscrepancyTx] = useState<TransactionRecord | null>(null);
  const [userSettingsOpen, setUserSettingsOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(() => (USE_MOCK ? isAuthenticated() : false));
  /** 真实环境刷新时先探测 Cookie 会话，完成前不展示登录页 */
  const [authReady, setAuthReady] = useState<boolean>(() => USE_MOCK);

  /** 侧栏仅展示当前用户有权限的菜单 */
  const navMenus = useMemo(
    () => filterMenusForUser(menus, currentUser, rolesList, departments),
    [menus, currentUser, rolesList, departments],
  );

  // 权限变更后，若当前页不可访问则跳到首个可访问页
  useEffect(() => {
    if (!loggedIn || currentTab === "login") return;
    const accessKey = currentTab === "scheduled_tasks" ? "system_config" : currentTab;
    if (!canAccessTab(accessKey, menus, currentUser, rolesList, departments)) {
      const next = firstAccessibleTab(menus, currentUser, rolesList, departments);
      setCurrentTab(next);
      setScheduledTaskId(null);
      window.history.replaceState(null, "", `#/${next}`);
    }
  }, [loggedIn, currentTab, menus, currentUser, rolesList, departments]);

  // 旧 hash #/permissions → #/permission_packs
  useEffect(() => {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    if (raw === "permissions") {
      window.history.replaceState(null, "", "#/permission_packs");
      if (currentTab !== "permission_packs") setCurrentTab("permission_packs");
    }
  }, [currentTab]);

  // 切换页面：更新 state 并同步 URL hash
  const navigateToTab = (tab: string) => {
    if (tab === "login") {
      setCurrentTab("login");
      setScheduledTaskId(null);
      setMobileMenuOpen(false);
      if (window.location.hash !== `#/login`) {
        window.history.replaceState(null, "", `#/login`);
      }
      return;
    }
    if (!loggedIn) {
      setCurrentTab("login");
      setScheduledTaskId(null);
      setMobileMenuOpen(false);
      if (window.location.hash !== `#/login`) {
        window.history.replaceState(null, "", `#/login`);
      }
      return;
    }
    if (!VALID_TABS.includes(tab) && tab !== "permissions") tab = "dashboard";
    tab = normalizeTab(tab);
    const accessKey = tab === "scheduled_tasks" ? "system_config" : tab;
    if (!canAccessTab(accessKey, menus, currentUser, rolesList, departments)) {
      tab = firstAccessibleTab(menus, currentUser, rolesList, departments);
    }
    setCurrentTab(tab);
    if (tab !== "scheduled_tasks") setScheduledTaskId(null);
    setMobileMenuOpen(false);
    if (window.location.hash !== `#/${tab}`) {
      window.history.replaceState(null, "", `#/${tab}`);
    }
  };

  const enterFirstMenu = (
    nextMenus = menus,
    nextUser = currentUser,
    nextRoles = rolesList,
    nextDepartments = departments,
  ) => {
    const tab = firstAccessibleTab(nextMenus, nextUser, nextRoles, nextDepartments);
    setCurrentTab(tab);
    window.history.replaceState(null, "", `#/${tab}`);
  };

  // 登录成功 → 选中并展开侧栏第一个可访问菜单（凭证由 Cookie 下发；Mock 仅翻内存门禁）
  const handleLoginSuccess = () => {
    setAuthenticated();
    setLoggedIn(true);
    if (!USE_MOCK) {
      void loadShellIamData()
        .then((data) => {
          if (!data) {
            enterFirstMenu();
            return;
          }
          setSystemUsers(data.users);
          setAllUsers(data.users);
          setRolesList(data.roles);
          setPermissionPacks(data.packs);
          setMenus(data.menus);
          setDepartments(data.departments);
          setDictionary(data.dictionary);
          if (data.me) setCurrentUser(data.me);
          enterFirstMenu(
            data.menus,
            data.me || currentUser,
            data.roles,
            data.departments,
          );
        })
        .catch(() => {
          /* 壳层数据拉取失败时用当前态进首个菜单，避免白屏 */
          enterFirstMenu();
        });
      return;
    }
    enterFirstMenu();
  };

  // 退出登录 → 清 Cookie（真实）/ 清门禁（Mock）并回到登录页
  const handleLogout = () => {
    void (async () => {
      try {
        await logoutSession();
      } catch {
        clearAuth();
      }
      setLoggedIn(false);
      setUserSettingsOpen(false);
      setMobileMenuOpen(false);
      setQuickCreateOpen(false);
      setActiveDiscrepancyTx(null);
      setCurrentTab("login");
      window.history.replaceState(null, "", `#/login`);
    })();
  };

  // 初始化：主题 + 会话探测 + hash 路由
  useEffect(() => {
    applyTheme(getStoredTheme());
    let cancelled = false;

    const syncFromHash = (authed: boolean) => {
      if (!authed) {
        setLoggedIn(false);
        setCurrentTab("login");
        setScheduledTaskId(null);
        if (window.location.hash !== `#/login`) {
          window.history.replaceState(null, "", `#/login`);
        }
        return;
      }
      setLoggedIn(true);
      const parsed = parseHash();
      // hash 仍是 login 时先落到 dashboard，菜单加载后由权限 effect / 下方逻辑纠正为首个菜单
      if (parsed.tab === "login") {
        setCurrentTab("dashboard");
        setScheduledTaskId(null);
      } else {
        setCurrentTab(parsed.tab);
        setScheduledTaskId(parsed.taskId);
      }
    };

    void (async () => {
      const ok = await probeSession();
      if (cancelled) return;
      syncFromHash(ok);
      setAuthReady(true);
      if (ok && !USE_MOCK) {
        try {
          const data = await loadShellIamData();
          if (cancelled || !data) return;
          setSystemUsers(data.users);
          setAllUsers(data.users);
          setRolesList(data.roles);
          setPermissionPacks(data.packs);
          setMenus(data.menus);
          setDepartments(data.departments);
          setDictionary(data.dictionary);
          if (data.me) setCurrentUser(data.me);
          try {
            const tenantRows = await tenantsApi.listTenants();
            if (!cancelled && tenantRows.length > 0) {
              setTenants(tenantRows);
              setCurrentTenant(tenantRows[0]);
            }
          } catch {
            /* tenants optional on bootstrap */
          }
          const hashTab = tabFromHash();
          const accessKey = hashTab === "scheduled_tasks" ? "system_config" : hashTab;
          if (hashTab === "login" || !canAccessTab(accessKey, data.menus, data.me || currentUser, data.roles, data.departments)) {
            const tab = firstAccessibleTab(data.menus, data.me || currentUser, data.roles, data.departments);
            setCurrentTab(tab);
            setScheduledTaskId(null);
            window.history.replaceState(null, "", `#/${tab}`);
          } else {
            const parsed = parseHash();
            setCurrentTab(parsed.tab);
            setScheduledTaskId(parsed.taskId);
          }
        } catch {
          /* ignore bootstrap errors */
        }
      } else if (ok && USE_MOCK && tabFromHash() === "login") {
        const tab = firstAccessibleTab(menus, currentUser, rolesList, departments);
        setCurrentTab(tab);
        window.history.replaceState(null, "", `#/${tab}`);
      }
    })();

    const onHashChange = () => {
      void (async () => {
        const ok = await probeSession();
        if (cancelled) return;
        syncFromHash(ok);
      })();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
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
  const handleQuickDone = (txId: string) => {
    handleResolveDiscrepancy(txId, "ACCEPT_CHANNEL_REPORT", "仪表盘快捷处置：以网关结算单为准自动平账");
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
        ? t("audit.profileWithPassword")
        : t("audit.profileBasic"),
      ipAddress: "127.0.0.1",
      status: "SUCCESS",
    };
    setAuditLogs((prev) => [audit, ...prev]);
  };

  const getTabTitle = () => {
    if (currentTab === "scheduled_tasks") {
      return t("pageTitle.scheduled_tasks");
    }
    const key = `pageTitle.${currentTab}`;
    const translated = t(key);
    return translated === key ? t("pageTitle.default") : translated;
  };

  // 会话探测完成前：不闪登录页
  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-page text-fg-secondary text-sm">
        {t("common:status.loading")}
      </div>
    );
  }

  // 登录路由 / 未登录：直接渲染登录页（绕过主框架）
  if (!loggedIn || currentTab === "login") {
    return (
      <LoginPage
        onLogin={handleLoginSuccess}
      />
    );
  }

  return (
    <PermissionProvider value={{ user: currentUser, ready: authReady }}>
    <div className="flex h-screen w-screen overflow-hidden bg-page font-sans text-fg antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Left Sidebar (desktop only, md+) */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          menus={navMenus}
          currentTab={currentTab}
          setCurrentTab={navigateToTab}
          currentUser={currentUser}
          onOpenUserSettings={() => setUserSettingsOpen(true)}
          onOpenQuickCreate={() => setQuickCreateOpen(true)}
          onLogout={handleLogout}
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
              menus={navMenus}
              currentTab={currentTab}
              setCurrentTab={navigateToTab}
              currentUser={currentUser}
              onOpenUserSettings={() => {
                setUserSettingsOpen(true);
                setMobileMenuOpen(false);
              }}
              onOpenQuickCreate={() => setQuickCreateOpen(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentViewTitle={getTabTitle()}
          onToggleSidebar={() => setMobileMenuOpen((v) => !v)}
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
            <PermissionGate menuKey="dictionary">
              <DictionaryView
                dictionary={dictionary}
                currentTenant={currentTenant}
                onSaveEntry={(updated) => {
                  void (async () => {
                    const exists = dictionary.some((d) => d.id === updated.id);
                    try {
                      const saved = await persistDictionaryEntry(updated, !exists);
                      setDictionary((prev) => {
                        const hit = prev.some((d) => d.id === saved.id);
                        return hit
                          ? prev.map((d) => (d.id === saved.id ? saved : d))
                          : [saved, ...prev];
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
                onDeleteEntry={(id) => {
                  void (async () => {
                    try {
                      await removeDictionaryEntry(id);
                      setDictionary((prev) => prev.filter((d) => d.id !== id));
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
              />
            </PermissionGate>
          )}

          {currentTab === "users" && (
            <UserManagementView users={endUsers} />
          )}

          {currentTab === "roles" && (
            <PermissionGate menuKey="roles">
              <RolesView
                roles={rolesList}
                packs={permissionPacks}
                apps={paymentApps}
                onSaveRole={(updated) => {
                  void (async () => {
                    const exists = rolesList.some((r) => r.id === updated.id);
                    try {
                      const saved = await persistRole(updated, !exists);
                      setRolesList((prev) => {
                        const hit = prev.some((r) => r.id === saved.id);
                        return hit
                          ? prev.map((r) => (r.id === saved.id ? saved : r))
                          : [...prev, saved];
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
                onDeleteRole={(roleId) => {
                  void (async () => {
                    try {
                      await removeRole(roleId);
                      setRolesList((prev) => prev.filter((r) => r.id !== roleId && r.key !== roleId));
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
              />
            </PermissionGate>
          )}

          {currentTab === "permission_packs" && (
            <PermissionGate menuKey="permission_packs">
              <PermissionPacksView
                packs={permissionPacks}
                menus={menus}
                onSavePack={async (pack, isNew) => {
                  const saved = await persistPermissionPack(pack, isNew);
                  setPermissionPacks((prev) => {
                    const hit = prev.some((p) => p.id === saved.id);
                    return hit
                      ? prev.map((p) => (p.id === saved.id ? saved : p))
                      : [...prev, saved];
                  });
                  return saved;
                }}
                onSavePackMenus={async (packId, menuIds) => {
                  const saved = await persistPermissionPackMenus(packId, menuIds);
                  setPermissionPacks((prev) =>
                    prev.map((p) =>
                      p.id === packId ? { ...p, menuIds: saved.menuIds ?? menuIds } : p,
                    ),
                  );
                  return { ...saved, id: packId, menuIds: saved.menuIds ?? menuIds };
                }}
                onDeletePack={async (packId) => {
                  await removePermissionPack(packId);
                  setPermissionPacks((prev) => prev.filter((p) => p.id !== packId));
                }}
              />
            </PermissionGate>
          )}

          {currentTab === "menus" && (
            <PermissionGate menuKey="menus">
              <MenusView
                menus={menus}
                onSaveMenu={async (updated) => {
                  const exists = menus.some((m) => m.id === updated.id);
                  const saved = await persistMenu(updated, !exists);
                  setMenus((prev) => {
                    const hit = prev.some((m) => m.id === saved.id);
                    return hit
                      ? prev.map((m) => (m.id === saved.id ? saved : m))
                      : [...prev, saved];
                  });
                }}
                onDeleteMenu={async (id) => {
                  await removeMenu(id);
                  setMenus((prev) => prev.filter((m) => m.id !== id));
                }}
              />
            </PermissionGate>
          )}

          {currentTab === "departments" && (
            <PermissionGate menuKey="departments">
              <DepartmentManagementView
                departments={departments}
                users={systemUsers}
                roles={rolesList}
                onSaveDepartment={(updated) => {
                  void (async () => {
                    const exists = departments.some((d) => d.id === updated.id);
                    try {
                      const saved = await persistDepartment(updated, !exists);
                      setDepartments((prev) => {
                        const hit = prev.some((d) => d.id === saved.id);
                        return hit
                          ? prev.map((d) => (d.id === saved.id ? saved : d))
                          : [...prev, saved];
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
                onDeleteDepartment={(deptId) => {
                  void (async () => {
                    try {
                      await removeDepartment(deptId);
                      setDepartments((prev) => prev.filter((d) => d.id !== deptId));
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
                onSaveUser={(updatedUser) => {
                  void (async () => {
                    try {
                      const { user: saved } = await persistUser(updatedUser, false);
                      setSystemUsers((prev) => {
                        const exists = prev.some((u) => u.id === saved.id);
                        return exists
                          ? prev.map((u) => (u.id === saved.id ? saved : u))
                          : [saved, ...prev];
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  })();
                }}
              />
            </PermissionGate>
          )}

          {currentTab === "system_users" && (
            <PermissionGate menuKey="system_users">
              <SystemUserManagementView
                users={systemUsers}
                roles={rolesList}
                apps={paymentApps}
                departments={departments}
                currentUser={currentUser}
                onSaveUser={async (updatedUser, opts) => {
                  const isNew = opts?.isNew ?? !systemUsers.some((u) => u.id === updatedUser.id);
                  const { user: saved, initialPassword } = await persistUser(updatedUser, isNew);
                  setSystemUsers((prev) => {
                    const exists = prev.some((u) => u.id === saved.id);
                    return exists
                      ? prev.map((u) => (u.id === saved.id ? saved : u))
                      : [saved, ...prev];
                  });
                  if (saved.id === currentUser.id) {
                    setCurrentUser(saved);
                  }
                  return { user: saved, initialPassword };
                }}
                onDeleteUser={async (userId) => {
                  await removeUser(userId);
                  setSystemUsers((prev) => prev.filter((u) => u.id !== userId));
                }}
                onResetPassword={async (userId) => resetUserPassword(userId)}
              />
            </PermissionGate>
          )}

          {currentTab === "settlements" && (
            <SettlementsView />
          )}

          {currentTab === "refunds" && (
            <RefundsView />
          )}

          {currentTab === "audit_logs" && (
            <AuditLogsView />
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

          {currentTab === "tenants" && (
            <TenantManagementView
              tenants={tenants}
              onTenantsChange={(list) => {
                setTenants(list);
                if (!list.find((x) => x.id === currentTenant.id)) {
                  setCurrentTenant(list[0] || currentTenant);
                }
              }}
            />
          )}

          {currentTab === "alerts" && (
            <AlertsView
              rules={alertRules}
              histories={alertHistories}
            />
          )}

          {currentTab === "system_config" && (
            <SystemConfigView />
          )}
          {currentTab === "scheduled_tasks" && scheduledTaskId && (
            <ScheduledTaskDetailView
              taskId={scheduledTaskId}
              onBack={() => {
                try { sessionStorage.setItem("system_config_tab", "tasks"); } catch { /* ignore */ }
                navigateToTab("system_config");
              }}
            />
          )}
          {currentTab === "scheduled_tasks" && !scheduledTaskId && (
            <SystemConfigView />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar (<md only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface border-t border-line flex items-stretch h-16 px-1 pb-[env(safe-area-inset-bottom)]">
        {[
          { key: "dashboard", labelKey: "mobile.dashboard", icon: LayoutDashboard, tab: "dashboard" as const },
          { key: "transactions", labelKey: "mobile.transactions", icon: Receipt, tab: "transactions" as const },
          { key: "settlements", labelKey: "mobile.settlements", icon: Wallet, tab: "settlements" as const },
          { key: "refunds", labelKey: "mobile.refunds", icon: RotateCcw, tab: "refunds" as const },
          { key: "me", labelKey: "mobile.me", icon: User, tab: null },
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
              <span>{t(item.labelKey)}</span>
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
        onLogout={handleLogout}
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
    </PermissionProvider>
  );
}
