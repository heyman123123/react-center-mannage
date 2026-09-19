import React, { useState, useEffect, useCallback } from "react";
import * as endUsersApi from "../api/modules/endUsers";
import type { Tenant } from "../types/payment";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Users,
  Search,
  Filter,
  Shield,
  Key,
  CreditCard,
  Clock,
  MapPin,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Download,
  Calendar,
  Sparkles,
  ChevronRight,
  Eye,
  Mail,
  Plus,
  FileSpreadsheet,
  Globe,
  Tag,
  DollarSign,
  Lock,
} from "lucide-react";
import { EndUser, UserActionLog, UserActionType } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface UserManagementViewProps {
  currentTenant: Tenant;
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  GB: "🇬🇧",
  UK: "🇬🇧",
  DE: "🇩🇪",
  JP: "🇯🇵",
  FR: "🇫🇷",
  CA: "🇨🇦",
  AU: "🇦🇺",
  SG: "🇸🇬",
  ES: "🇪🇸",
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentTenant }) => {
  const { t } = useTranslation(["rbac", "common"]);
  const [userList, setUserList] = useState<EndUser[]>([]);

  const loadUsers = useCallback(async () => {
    const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
    try {
      const list = await endUsersApi.listEndUsers(tenantId);
      setUserList(list);
    } catch {
      setUserList([]);
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  const [selectedUser, setSelectedUser] = useState<EndUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>("ALL");
  const { currentPage, setCurrentPage, reset: resetPage, pageSize, setPageSize } = usePagination(10);
  useEffect(() => { resetPage(); }, [searchQuery, statusFilter, countryFilter, resetPage]);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCountry, setFormCountry] = useState("🇺🇸 United States (US)");
  const [formPlan, setFormPlan] = useState("Novas AI 商业专业版 (年付)");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formPrice, setFormPrice] = useState(290);
  const [formCardBrand, setFormCardBrand] = useState("Visa");
  const [formCardLast4, setFormCardLast4] = useState("4242");

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3800);
  };

  const countriesList = Array.from(new Set(userList.map((u) => u.country.split(" ")[0])));

  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.currentSubscription?.planName || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || u.currentSubscription.status === statusFilter;

    const matchesCountry =
      countryFilter === "ALL" || u.country.includes(countryFilter);

    return matchesSearch && matchesStatus && matchesCountry;
  });

  const getActionBadge = (type: UserActionType) => {
    const badgeClass =
      "px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1";
    const label = t(`endUsers.actionBadge.${type}`, { defaultValue: type });
    switch (type) {
      case "LOGIN":
        return (
          <span className={`${badgeClass} bg-blue-50 text-blue-700 border border-blue-200`}>
            <Clock className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "CHANGE_PASSWORD":
        return (
          <span className={`${badgeClass} bg-amber-50 text-amber-700 border border-amber-200`}>
            <Key className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "SUBSCRIBE":
        return (
          <span className={`${badgeClass} bg-emerald-50 text-emerald-700 border border-emerald-200`}>
            <CreditCard className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "UPGRADE_PLAN":
        return (
          <span className={`${badgeClass} bg-purple-50 text-purple-700 border border-purple-200`}>
            <Sparkles className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "CANCEL_SUBSCRIPTION":
        return (
          <span className={`${badgeClass} bg-rose-50 text-rose-700 border border-rose-200`}>
            <XCircle className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "UPDATE_PAYMENT_METHOD":
        return (
          <span className={`${badgeClass} bg-indigo-50 text-indigo-700 border border-indigo-200`}>
            <CreditCard className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "DOWNLOAD_INVOICE":
        return (
          <span className={`${badgeClass} bg-hover text-fg-secondary border border-line`}>
            <Download className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      case "REGISTER":
        return (
          <span className={`${badgeClass} bg-emerald-50 text-emerald-700 border border-emerald-200`}>
            <Users className="w-2.5 h-2.5" />
            {label}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-hover text-fg-secondary">
            {type}
          </span>
        );
    }
  };

  const filteredActions = selectedUser?.actions.filter((action) => {
    if (actionCategoryFilter === "ALL") return true;
    if (actionCategoryFilter === "BILLING") {
      return [
        "SUBSCRIBE",
        "UPGRADE_PLAN",
        "CANCEL_SUBSCRIPTION",
        "UPDATE_PAYMENT_METHOD",
        "DOWNLOAD_INVOICE",
      ].includes(action.actionType);
    }
    if (actionCategoryFilter === "SECURITY") {
      return ["LOGIN", "CHANGE_PASSWORD", "REGISTER"].includes(action.actionType);
    }
    return true;
  });

  const handleAdminResetPassword = (user: EndUser) => {
    showToast(t("endUsers.toast.resetPassword", { email: user.email }));
  };

  const handleAdminResendReceipt = (user: EndUser) => {
    showToast(t("endUsers.toast.resendReceipt", { email: user.email }));
  };

  const handleToggleSubscriptionStatus = (user: EndUser) => {
    const isCurrentlyActive = user.currentSubscription.status === "ACTIVE";
    const nextStatus = isCurrentlyActive ? "CANCELED" : "ACTIVE";
    const updated: EndUser = {
      ...user,
      currentSubscription: {
        ...user.currentSubscription,
        status: nextStatus,
      },
      actions: [
        {
          id: `act_${Date.now()}`,
          actionType: isCurrentlyActive ? "CANCEL_SUBSCRIPTION" : "SUBSCRIBE",
          title: isCurrentlyActive ? "后台管理调整：取消订阅续订" : "后台管理调整：恢复自动续订",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          ip: "10.0.4.12 (Admin HQ)",
          device: "Admin Portal Console",
          location: "Global Gateway Center",
          description: `管理员手动将客户订阅状态变更为: ${nextStatus}`,
        },
        ...user.actions,
      ],
    };

    setUserList((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    setSelectedUser(updated);
    showToast(
      t("endUsers.toast.subscriptionUpdated", {
        name: user.name,
        status: t(`endUsers.subscriptionStatus.${nextStatus}`),
      })
    );
  };

  const handleExportCsv = () => {
    const headers = [
      t("endUsers.csvHeaders.id"),
      t("endUsers.csvHeaders.name"),
      t("endUsers.csvHeaders.email"),
      t("endUsers.csvHeaders.country"),
      t("endUsers.csvHeaders.plan"),
      t("endUsers.csvHeaders.status"),
      t("endUsers.csvHeaders.currency"),
      t("endUsers.csvHeaders.ltv"),
      t("endUsers.csvHeaders.orderCount"),
      t("endUsers.csvHeaders.lastLogin"),
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      u.name,
      u.email,
      u.country,
      u.currentSubscription.planName,
      u.currentSubscription.status,
      u.currentSubscription.currency,
      u.totalSpend,
      u.totalOrdersCount,
      u.lastLoginAt,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `novas_end_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(t("endUsers.toast.exportSuccess", { count: filteredUsers.length }));
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast(t("endUsers.toast.nameEmailRequired"));
      return;
    }

    const randId = `cust_${Math.random().toString(36).substring(2, 8)}`;
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const newUser: EndUser = {
      id: randId,
      name: formName.trim(),
      email: formEmail.trim(),
      country: formCountry,
      registeredAt: nowStr.slice(0, 10),
      lastLoginAt: nowStr,
      lastLoginIp: "74.125.210.12 (Direct IP)",
      currentSubscription: {
        planName: formPlan,
        status: "ACTIVE",
        nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        amount: Number(formPrice),
        currency: formCurrency,
      },
      defaultPaymentMethod: {
        type: (formCardBrand.toLowerCase() === "mastercard" ? "mastercard" : "visa") as "visa" | "mastercard",
        brand: formCardBrand,
        last4: formCardLast4,
        expiry: "09/29",
      },
      totalSpend: Number(formPrice),
      totalOrdersCount: 1,
      actions: [
        {
          id: `act_${Date.now()}`,
          actionType: "REGISTER",
          title: "海外收银台独立站首次注册建档",
          timestamp: nowStr,
          ip: "74.125.210.12",
          device: "Chrome / macOS",
          location: formCountry,
          description: `客户成功注册，并选购 [${formPlan}]`,
        },
        {
          id: `act_${Date.now() + 1}`,
          actionType: "SUBSCRIBE",
          title: "首次首月订阅扣款成功",
          timestamp: nowStr,
          ip: "74.125.210.12",
          device: "Chrome / macOS",
          location: formCountry,
          description: `绑定 ${formCardBrand} 末尾 ${formCardLast4}，成功扣费 ${formCurrency} ${formPrice}`,
        },
      ],
    };

    setUserList([newUser, ...userList]);
    showToast(t("endUsers.toast.userCreated", { name: newUser.name, email: newUser.email }));
    setIsAddModalOpen(false);
  };

  const totalSpendSum = userList.reduce((acc, u) => acc + (u.totalSpend || 0), 0);
  const totalSubscribersActive = userList.filter((u) => u.currentSubscription.status === "ACTIVE").length;

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-6 font-sans">
      {/* Action Toast */}
      {actionToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionToast}</span>
          </div>
          <button onClick={() => setActionToast(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("endUsers.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("endUsers.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-fg-secondary" />
            <span>{t("endUsers.exportCsv")}</span>
          </button>

          <button
            onClick={() => {
              setFormName("");
              setFormEmail("");
              setFormCountry("🇺🇸 United States (US)");
              setFormPlan("Novas AI 商业专业版 (年付)");
              setFormCurrency("USD");
              setFormPrice(290);
              setFormCardBrand("Visa");
              setFormCardLast4("4242");
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("endUsers.addUser")}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("endUsers.metrics.totalCustomers")}</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {userList.length}{" "}
            <span className="text-xs font-normal text-fg-tertiary">
              {t("endUsers.metrics.uniqueUsers")}
            </span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {t("endUsers.metrics.globalAudience")}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("endUsers.metrics.activeSubscriptionRate")}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {Math.round((totalSubscribersActive / (userList.length || 1)) * 100)}%
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {t("endUsers.metrics.activeSubscribers", { count: totalSubscribersActive })}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("endUsers.metrics.totalLtv")}</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {formatCurrency(totalSpendSum, "USD")}
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {t("endUsers.metrics.avgOrderValue", {
              amount: (totalSpendSum / (userList.length || 1)).toFixed(0),
            })}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("endUsers.metrics.actionEvents")}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {userList.reduce((acc, u) => acc + u.actions.length, 0)}{" "}
            <span className="text-xs font-normal text-fg-tertiary">
              {t("endUsers.metrics.records")}
            </span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {t("endUsers.metrics.actionCoverage")}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-nowrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-nowrap overflow-x-auto">
          <span className="text-fg-tertiary text-xs">{t("endUsers.filter.subscriptionStatus")}</span>
          {["ALL", "ACTIVE", "CANCELED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {status === "ALL"
                ? t("endUsers.filter.allCustomers")
                : status === "ACTIVE"
                  ? t("endUsers.filter.activeSubscription")
                  : t("endUsers.filter.canceledSubscription")}
            </button>
          ))}

          <span className="text-zinc-300 ml-2">|</span>

          <span className="text-fg-tertiary text-xs ml-1 whitespace-nowrap">
            {t("endUsers.filter.region")}
          </span>
          <div className="w-40">
            <ShadcnSelect
              value={countryFilter}
              onValueChange={(val) => setCountryFilter(val)}
              options={[
                { value: "ALL", label: t("endUsers.filter.allCountries") },
                ...countriesList.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
        </div>

        <div className="relative w-56 min-w-0 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder={t("endUsers.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3 min-w-[220px]">{t("endUsers.table.idAndName")}</th>
                <th className="py-2 px-3 w-[130px]">{t("endUsers.table.country")}</th>
                <th className="py-2 px-3 w-[200px]">{t("endUsers.table.subscription")}</th>
                <th className="py-2 px-3 w-[200px]">{t("endUsers.table.paymentMethod")}</th>
                <th className="py-2 px-3 w-[140px]">{t("endUsers.table.ltv")}</th>
                <th className="py-2 px-3 w-[180px]">{t("endUsers.table.lastLogin")}</th>
                <th className="py-2 px-3 w-[150px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("endUsers.table.operations")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<EndUser>(filteredUsers, currentPage, pageSize).map((user) => {
                const isSubActive = user.currentSubscription.status === "ACTIVE";

                return (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-subtle/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-3 min-w-[220px]">
                      <div className="font-semibold text-fg group-hover:text-blue-600 flex items-center gap-1.5 line-clamp-1">
                        <span>{user.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[11px] text-fg-tertiary font-mono mt-0.5 truncate" title={`${user.id} • ${user.email}`}>
                        {user.id} • {user.email}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[130px] font-medium text-fg-secondary whitespace-nowrap">
                      {user.country}
                    </td>

                    <td className="py-3.5 px-3 w-[200px]">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold w-fit ${
                            isSubActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isSubActive ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {user.currentSubscription.planName}
                        </span>
                        <span className="text-[10px] text-fg-tertiary font-mono whitespace-nowrap">
                          {t("endUsers.table.nextBilling", {
                            date: user.currentSubscription.nextBillingDate,
                          })}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[200px] font-mono text-fg-secondary whitespace-nowrap">
                      <span
                        className="inline-block max-w-full truncate px-1.5 py-0.5 bg-hover rounded text-[11px] border border-line"
                        title={`${user.defaultPaymentMethod.brand} •••• ${user.defaultPaymentMethod.last4}`}
                      >
                        {user.defaultPaymentMethod.brand} •••• {user.defaultPaymentMethod.last4}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 w-[140px] font-mono font-bold text-fg whitespace-nowrap">
                      {formatCurrency(user.totalSpend, user.currentSubscription.currency)}
                      <span className="text-[10px] text-fg-tertiary font-normal block">
                        {t("endUsers.table.orderCount", { count: user.totalOrdersCount })}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 w-[180px]">
                      <div className="font-mono text-fg-secondary whitespace-nowrap">{user.lastLoginAt}</div>
                      <div className="font-mono text-[10px] text-fg-tertiary truncate max-w-[160px]" title={user.lastLoginIp}>
                        {user.lastLoginIp}
                      </div>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[150px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                        }}
                        className="px-2.5 py-1.5 bg-hover hover:bg-hover text-fg-secondary rounded-lg font-medium text-xs flex items-center gap-1 ml-auto transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {t("endUsers.table.viewTimeline", { count: user.actions.length })}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredUsers.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
      </div>

      {/* User Actions Full Detail SideSheet (右侧滑入) */}
      {selectedUser && (
        <SideSheet
          id="side-sheet-user-detail"
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`${selectedUser.name || t("endUsers.profileFallback")} (${selectedUser.country})`}
          description={`${selectedUser.id} • ${selectedUser.email}`}
          icon={<Users className="w-5 h-5 text-fg" />}
          widthClass="max-w-3xl"
          footer={
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer"
            >
              {t("endUsers.detail.closePanel")}
            </button>
          }
        >
          <div className="text-xs space-y-4">
            {/* Subscription Toggle */}
            <div className="flex items-center justify-end pb-2 border-b border-line-subtle">
              <button
                onClick={() => handleToggleSubscriptionStatus(selectedUser)}
                className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                  selectedUser.currentSubscription.status === "ACTIVE"
                    ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {selectedUser.currentSubscription.status === "ACTIVE"
                  ? t("endUsers.detail.cancelSubscription")
                  : t("endUsers.detail.resumeSubscription")}
              </button>
            </div>

            {/* Overview Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">
                  {t("endUsers.detail.currentPlan")}
                </span>
                <span className="font-bold text-xs text-fg block truncate mt-0.5">
                  {selectedUser.currentSubscription.planName}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {selectedUser.currentSubscription.status}
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">
                  {t("endUsers.detail.defaultCard")}
                </span>
                <span className="font-bold text-xs text-fg block mt-0.5">
                  {selectedUser.defaultPaymentMethod.brand} •••• {selectedUser.defaultPaymentMethod.last4}
                </span>
                <span className="text-[10px] text-fg-tertiary font-mono">
                  {t("endUsers.detail.cardExpiry", {
                    expiry: selectedUser.defaultPaymentMethod.expiry || "09/28",
                  })}
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">
                  {t("endUsers.detail.lifetimeSpend")}
                </span>
                <span className="font-bold text-xs font-mono text-fg block mt-0.5">
                  {formatCurrency(selectedUser.totalSpend, selectedUser.currentSubscription.currency)}
                </span>
                <span className="text-[10px] text-fg-tertiary font-mono">
                  {t("endUsers.detail.billingOrderCount", {
                    count: selectedUser.totalOrdersCount,
                  })}
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">
                  {t("endUsers.detail.quickActions")}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => handleAdminResetPassword(selectedUser)}
                    className="p-1 bg-surface border border-line hover:bg-hover rounded text-fg-secondary text-[10px] flex items-center gap-1 font-medium"
                    title={t("endUsers.detail.resetPasswordTitle")}
                  >
                    <Key className="w-2.5 h-2.5" /> {t("endUsers.detail.resetPassword")}
                  </button>
                  <button
                    onClick={() => handleAdminResendReceipt(selectedUser)}
                    className="p-1 bg-surface border border-line hover:bg-hover rounded text-fg-secondary text-[10px] flex items-center gap-1 font-medium"
                    title={t("endUsers.detail.resendInvoiceTitle")}
                  >
                    <Send className="w-2.5 h-2.5" /> {t("endUsers.detail.resendInvoice")}
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Tabs for Actions */}
            <div className="flex items-center justify-between border-b border-line-subtle pb-2 pt-2">
              <span className="font-bold text-fg text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {t("endUsers.detail.actionTimeline", {
                    count: filteredActions?.length || 0,
                  })}
                </span>
              </span>

              <div className="flex items-center gap-1.5">
                {["ALL", "BILLING", "SECURITY"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActionCategoryFilter(cat)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      actionCategoryFilter === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-hover text-fg-secondary hover:bg-hover"
                    }`}
                  >
                    {cat === "ALL"
                      ? t("endUsers.detail.allActions")
                      : cat === "BILLING"
                        ? t("endUsers.detail.billingActions")
                        : t("endUsers.detail.securityActions")}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Timeline List */}
            <div className="space-y-4 text-xs">
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-hover">
                {filteredActions && filteredActions.length > 0 ? (
                  filteredActions.map((action) => (
                    <div key={action.id} className="relative group">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-600 shadow-card" />

                      <div className="bg-subtle border border-line/80 rounded-xl p-3.5 space-y-2 hover:bg-surface transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-fg text-xs">
                              {action.title}
                            </span>
                            {getActionBadge(action.actionType)}
                          </div>
                          <span className="font-mono text-[11px] text-fg-tertiary">
                            {action.timestamp}
                          </span>
                        </div>

                        <p className="text-fg-secondary text-xs leading-relaxed">
                          {action.description}
                        </p>

                        <div className="pt-2 border-t border-line/60 flex flex-wrap items-center gap-2 text-[10px] text-fg-secondary font-mono">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-fg-tertiary" />
                            {action.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Laptop className="w-3 h-3 text-fg-tertiary" />
                            {action.device}
                          </span>
                          <span>IP: {action.ip}</span>

                          {action.metadata && (
                            <div className="w-full mt-1 bg-surface p-2 rounded border border-line text-fg-secondary">
                              {Object.entries(action.metadata).map(([k, v]) => (
                                <div key={k}>
                                  <strong>{k}:</strong> {String(v)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-fg-tertiary">
                    {t("endUsers.detail.noActionsInCategory")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SideSheet>
      )}

      {/* Manual Add User SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-add-user"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t("endUsers.addUser")}
        description={t("endUsers.addUserDesc")}
        icon={<Users className="w-5 h-5 text-fg" />}
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="submit"
              form="form-add-end-user"
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold cursor-pointer"
            >
              {t("endUsers.form.confirmCreate")}
            </button>
          </>
        }
      >
        {isAddModalOpen && (
          <form id="form-add-end-user" onSubmit={handleCreateNewUser} className="space-y-3 text-xs">
              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">
                  {t("endUsers.form.fullName")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("endUsers.form.fullNamePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">
                  {t("endUsers.form.email")}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t("endUsers.form.emailPlaceholder")}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">
                    {t("endUsers.form.country")}
                  </label>
                  <ShadcnSelect
                    value={formCountry}
                    onValueChange={setFormCountry}
                    options={[
                      { value: "🇺🇸 United States (US)", label: t("endUsers.form.countries.US") },
                      { value: "🇬🇧 United Kingdom (UK)", label: t("endUsers.form.countries.UK") },
                      { value: "🇩🇪 Germany (DE)", label: t("endUsers.form.countries.DE") },
                      { value: "🇯🇵 Japan (JP)", label: t("endUsers.form.countries.JP") },
                      { value: "🇫🇷 France (FR)", label: t("endUsers.form.countries.FR") },
                      { value: "🇨🇦 Canada (CA)", label: t("endUsers.form.countries.CA") },
                      { value: "🇦🇺 Australia (AU)", label: t("endUsers.form.countries.AU") },
                      { value: "🇸🇬 Singapore (SG)", label: t("endUsers.form.countries.SG") },
                    ]}
                    placeholder={t("endUsers.form.countryPlaceholder")}
                  />
                </div>

                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">
                    {t("endUsers.form.currency")}
                  </label>
                  <ShadcnSelect
                    value={formCurrency}
                    onValueChange={setFormCurrency}
                    options={[
                      { value: "USD", label: t("endUsers.form.currencies.USD") },
                      { value: "EUR", label: t("endUsers.form.currencies.EUR") },
                      { value: "JPY", label: t("endUsers.form.currencies.JPY") },
                      { value: "GBP", label: t("endUsers.form.currencies.GBP") },
                    ]}
                    placeholder={t("endUsers.form.currencyPlaceholder")}
                  />
                </div>
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">
                  {t("endUsers.form.plan")}
                </label>
                <input
                  type="text"
                  placeholder={t("endUsers.form.planPlaceholder")}
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">
                    {t("endUsers.form.initialAmount")}
                  </label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">
                    {t("endUsers.form.cardBrand")}
                  </label>
                  <ShadcnSelect
                    value={formCardBrand}
                    onValueChange={setFormCardBrand}
                    options={[
                      { value: "Visa", label: "Visa" },
                      { value: "Mastercard", label: "Mastercard" },
                      { value: "American Express", label: "Amex" },
                      { value: "JCB", label: "JCB" },
                    ]}
                    placeholder={t("endUsers.form.cardBrandPlaceholder")}
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">
                    {t("endUsers.form.cardLast4")}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formCardLast4}
                    onChange={(e) => setFormCardLast4(e.target.value)}
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  />
                </div>
              </div>

            </form>
        )}
      </SideSheet>
    </div>
  );
};
