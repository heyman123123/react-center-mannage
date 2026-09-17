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
import { FinancialReportsView } from "./components/FinancialReportsView";
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
  DictionaryEntry,
  SystemMenuItem,
  UserProfileSettings,
  RbacRole,
  PermissionPack,
} from "./types/payment";
import { getStoredTheme, applyTheme } from "./lib/theme";
import { setAuthenticated, clearAuth, probeSession, logoutSession } from "./lib/auth";
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
import * as tenantsApi from "./api/modules/tenants";
import * as reconciliationApi from "./api/modules/reconciliation";

const EMPTY_TENANT: Tenant = {
  id: "group_hq",
  name: "",
  code: "",
  currency: "USD",
  description: "",
  color: "#0284c7",
  dailyCap: 0,
  usedToday: 0,
  channelsEnabled: [],
  isolationLevel: "LOGICAL_TENANT",
  activeMerchantsCount: 0,
};

const EMPTY_USER: SystemUser = {
  id: "",
  name: "",
  email: "",
  roleKey: "BU_OPERATOR",
  avatarText: "?",
  lastLogin: "-",
  status: "ACTIVE",
};

export default function App() {
  const { t } = useTranslation(["nav", "common"]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(EMPTY_TENANT);
  const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
  const [currentUser, setCurrentUser] = useState<SystemUser>(EMPTY_USER);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [menus, setMenus] = useState<SystemMenuItem[]>([]);
  const [rolesList, setRolesList] = useState<RbacRole[]>([]);
  const [permissionPacks, setPermissionPacks] = useState<PermissionPack[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const VALID_TABS = [
    "dashboard", "transactions", "reconciliation", "products", "discounts",
    "promo_campaigns", "payment_channels", "payment_webhooks", "apps",
    "email_channels", "email_webhooks", "email_templates", "dictionary",
    "users", "roles", "permissions", "permission_packs", "menus", "departments", "system_users",
    "settlements", "financial_reports", "refunds", "audit_logs",
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
    const hash = tabFromHash();
    return hash === "login" ? "dashboard" : hash;
  });
  const [scheduledTaskId, setScheduledTaskId] = useState<string | null>(() => parseHash().taskId);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [quickCreateOpen, setQuickCreateOpen] = useState<boolean>(false);
  const [activeDiscrepancyTx, setActiveDiscrepancyTx] = useState<TransactionRecord | null>(null);
  const [userSettingsOpen, setUserSettingsOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const navMenus = useMemo(
    () => filterMenusForUser(menus, currentUser, rolesList, departments),
    [menus, currentUser, rolesList, departments],
  );

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

  useEffect(() => {
    const raw = (window.location.hash || "").replace(/^#\/?/, "");
    if (raw === "permissions") {
      window.history.replaceState(null, "", "#/permission_packs");
      if (currentTab !== "permission_packs") setCurrentTab("permission_packs");
    }
  }, [currentTab]);

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

  const applyShellData = (data: NonNullable<Awaited<ReturnType<typeof loadShellIamData>>>) => {
    setSystemUsers(data.users);
    setAllUsers(data.users);
    setRolesList(data.roles);
    setPermissionPacks(data.packs);
    setMenus(data.menus);
    setDepartments(data.departments);
    setDictionary(data.dictionary);
    if (data.me) setCurrentUser(data.me);
  };

  const handleLoginSuccess = () => {
    setAuthenticated();
    setLoggedIn(true);
    void loadShellIamData()
      .then((data) => {
        if (!data) {
          enterFirstMenu();
          return;
        }
        applyShellData(data);
        void tenantsApi.listTenants().then((tenantRows) => {
          if (tenantRows.length > 0) {
            setTenants(tenantRows);
            setCurrentTenant(tenantRows[0]);
          }
        }).catch(() => {});
        enterFirstMenu(data.menus, data.me || currentUser, data.roles, data.departments);
      })
      .catch(() => {
        enterFirstMenu();
      });
  };

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
      if (ok) {
        try {
          const data = await loadShellIamData();
          if (cancelled || !data) return;
          applyShellData(data);
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

  const handleResolveDiscrepancy = (txId: string, resolutionType: string, note: string) => {
    void reconciliationApi
      .resolveDiscrepancy(txId, { resolutionType, note })
      .finally(() => {
        setActiveDiscrepancyTx(null);
      });
  };

  const handleQuickDone = (txId: string) => {
    handleResolveDiscrepancy(txId, "ACCEPT_CHANNEL_REPORT", t("audit.quickResolveNote"));
  };

  const handleAutoReconcileAll = () => {
    /* ReconciliationView handles reload internally */
  };

  const handleSaveUserProfile = (profile: UserProfileSettings) => {
    const updatedUser: SystemUser = {
      ...currentUser,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    };
    setCurrentUser(updatedUser);
    setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const getTabTitle = () => {
    if (currentTab === "scheduled_tasks") {
      return t("pageTitle.scheduled_tasks");
    }
    const key = `pageTitle.${currentTab}`;
    const translated = t(key);
    return translated === key ? t("pageTitle.default") : translated;
  };

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-page text-fg-secondary text-sm">
        {t("common:status.loading")}
      </div>
    );
  }

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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentViewTitle={getTabTitle()}
          onToggleSidebar={() => setMobileMenuOpen((v) => !v)}
        />

        <main key={`${currentTab}-${refreshTick}`} className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 pb-20 md:pb-4 max-w-7xl w-full mx-auto">
          {currentTab === "dashboard" && (
            <DashboardView
              currentTenant={currentTenant}
              currentUser={currentUser}
              onOpenDiscrepancy={(tx) => setActiveDiscrepancyTx(tx)}
              onResolveQuickDone={handleQuickDone}
            />
          )}

          {currentTab === "transactions" && (
            <TransactionsView
              currentTenant={currentTenant}
              currentUser={currentUser}
            />
          )}

          {currentTab === "reconciliation" && (
            <ReconciliationView
              currentTenant={currentTenant}
              currentUser={currentUser}
              onOpenDiscrepancy={(tx) => setActiveDiscrepancyTx(tx)}
              onAutoReconcileAll={handleAutoReconcileAll}
            />
          )}

          {currentTab === "products" && (
            <ProductsView
              currentTenant={currentTenant}
              currentUser={currentUser}
            />
          )}

          {currentTab === "discounts" && (
            <DiscountsView
              currentTenant={currentTenant}
              currentUser={currentUser}
            />
          )}

          {currentTab === "promo_campaigns" && (
            <PromoCampaignsView
              currentTenant={currentTenant}
            />
          )}

          {currentTab === "payment_channels" && (
            <PaymentChannelsView
              currentTenant={currentTenant}
              currentUser={currentUser}
              dictionary={dictionary}
            />
          )}

          {currentTab === "payment_webhooks" && (
            <PaymentWebhooksView />
          )}

          {currentTab === "apps" && (
            <ApplicationManagementView
              currentTenant={currentTenant}
            />
          )}

          {currentTab === "email_channels" && (
            <EmailChannelsView />
          )}

          {currentTab === "email_webhooks" && (
            <EmailWebhooksView />
          )}

          {currentTab === "email_templates" && (
            <EmailTemplatesView />
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
            <UserManagementView currentTenant={currentTenant} />
          )}

          {currentTab === "roles" && (
            <PermissionGate menuKey="roles">
              <RolesView
                roles={rolesList}
                packs={permissionPacks}
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

          {currentTab === "financial_reports" && (
            <FinancialReportsView
              currentTenant={currentTenant}
              currentUser={currentUser}
            />
          )}

          {currentTab === "refunds" && (
            <RefundsView />
          )}

          {currentTab === "audit_logs" && (
            <AuditLogsView />
          )}

          {currentTab === "exchange_rates" && (
            <ExchangeRatesView />
          )}

          {currentTab === "fee_rules" && (
            <FeeRulesView />
          )}

          {currentTab === "risk_rules" && (
            <RiskRulesView />
          )}

          {currentTab === "merchant_review" && (
            <MerchantReviewView />
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
            <AlertsView />
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

      <UserSettingsModal
        isOpen={userSettingsOpen}
        onClose={() => setUserSettingsOpen(false)}
        currentUser={currentUser}
        onSaveProfile={handleSaveUserProfile}
        onLogout={handleLogout}
      />

      {quickCreateOpen && (
        <QuickCreateModal
          tenants={tenants}
          currentTenant={currentTenant}
          currentUser={currentUser}
          onClose={() => setQuickCreateOpen(false)}
          onCreateTransaction={() => setQuickCreateOpen(false)}
        />
      )}

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
