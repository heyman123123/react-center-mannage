import React, { useState } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
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
  users: EndUser[];
  onSaveUser?: (user: EndUser) => void;
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

export const UserManagementView: React.FC<UserManagementViewProps> = ({ users, onSaveUser }) => {
  const [userList, setUserList] = useState<EndUser[]>(users);
  const [selectedUser, setSelectedUser] = useState<EndUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>("ALL");
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
    switch (type) {
      case "LOGIN":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            终端登录 (Login)
          </span>
        );
      case "CHANGE_PASSWORD":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Key className="w-2.5 h-2.5" />
            修改密码 (Password)
          </span>
        );
      case "SUBSCRIBE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CreditCard className="w-2.5 h-2.5" />
            开通订阅 (Subscribe)
          </span>
        );
      case "UPGRADE_PLAN":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            套餐升级 (Upgrade)
          </span>
        );
      case "CANCEL_SUBSCRIPTION":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5" />
            取消续订 (Cancel)
          </span>
        );
      case "UPDATE_PAYMENT_METHOD":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
            <CreditCard className="w-2.5 h-2.5" />
            更新支付卡 (Card)
          </span>
        );
      case "DOWNLOAD_INVOICE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-hover text-fg-secondary border border-line flex items-center gap-1">
            <Download className="w-2.5 h-2.5" />
            下载发票 (Invoice)
          </span>
        );
      case "REGISTER":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            注册建档 (Register)
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
    showToast(`已向 ${user.email} 自动触发海外安全验证码及密码重置链接！`);
  };

  const handleAdminResendReceipt = (user: EndUser) => {
    showToast(`已向 ${user.email} 投递最新账单发票收据 (PDF) 并抄送财务！`);
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
    if (onSaveUser) onSaveUser(updated);
    showToast(`客户【${user.name}】订阅状态已成功更新为: ${nextStatus === "ACTIVE" ? "生效中 (Active)" : "已取消 (Canceled)"}`);
  };

  const handleExportCsv = () => {
    const headers = ["客户ID", "姓名", "邮箱", "国家地区", "订阅方案", "订阅状态", "币种", "终生价值(LTV)", "订单总数", "最后登录时间"];
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
    showToast(`已成功导出 ${filteredUsers.length} 位海外终端客户数据档案为 CSV 表格！`);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast("请填写客户姓名与有效邮箱！");
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
    if (onSaveUser) onSaveUser(newUser);
    showToast(`新客户【${newUser.name}】(${newUser.email}) 档案建立成功！`);
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              海外终端客户与行为大盘 (End Users & Lifecycle)
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            跨出海应用实时跟踪海外终端付费客户，深度穿透所有行为轨迹（登录时间与设备、密码重置变更、订阅流转、支付卡绑定与发票下载等）。
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-fg-secondary" />
            <span>导出客户列表 (CSV)</span>
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
            <span>录入新出海客户档案</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>海外客户建档总数</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {userList.length} <span className="text-xs font-normal text-fg-tertiary">位独立用户</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">跨北美、西欧及亚太全球受众</div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>有效订阅率 (Active)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {Math.round((totalSubscribersActive / (userList.length || 1)) * 100)}%
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {totalSubscribersActive} 位订户自动续费运转中
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>累计客户贡献总值 (LTV)</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {formatCurrency(totalSpendSum, "USD")}
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">平均客单值: ${(totalSpendSum / (userList.length || 1)).toFixed(0)}</div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>行为事件穿透采集</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {userList.reduce((acc, u) => acc + u.actions.length, 0)} <span className="text-xs font-normal text-fg-tertiary">条记录</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">端到端涵盖登录/改密/扣费/升级</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-fg-tertiary text-xs">订阅状态:</span>
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
              {status === "ALL" ? "全部客户" : status === "ACTIVE" ? "生效中订阅 (Active)" : "已取消订阅 (Canceled)"}
            </button>
          ))}

          <span className="text-zinc-300 ml-2">|</span>

          <span className="text-fg-tertiary text-xs ml-1 whitespace-nowrap">地区:</span>
          <div className="w-40">
            <ShadcnSelect
              value={countryFilter}
              onValueChange={(val) => setCountryFilter(val)}
              options={[
                { value: "ALL", label: "全部国家/地区" },
                ...countriesList.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder="按客户姓名 / 邮箱 / ID / 方案搜索..."
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
                <th className="py-3 px-4 min-w-[220px]">客户 ID & 姓名</th>
                <th className="py-3 px-4 w-[130px]">国家 / 地区</th>
                <th className="py-3 px-4 w-[200px]">当前订阅方案 & 状态</th>
                <th className="py-3 px-4 w-[160px]">绑定扣款方式</th>
                <th className="py-3 px-4 w-[140px]">终生价值 (LTV)</th>
                <th className="py-3 px-4 w-[180px]">最近登录时间 & IP</th>
                <th className="py-3 px-4 w-[150px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filteredUsers.map((user) => {
                const isSubActive = user.currentSubscription.status === "ACTIVE";

                return (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-subtle/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="font-semibold text-fg group-hover:text-blue-600 flex items-center gap-1.5 line-clamp-1">
                        <span>{user.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[11px] text-fg-tertiary font-mono mt-0.5 truncate" title={`${user.id} • ${user.email}`}>
                        {user.id} • {user.email}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[130px] font-medium text-fg-secondary whitespace-nowrap">
                      {user.country}
                    </td>

                    <td className="py-3.5 px-4 w-[200px]">
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
                        <span className="text-[10px] text-fg-tertiary font-mono">
                          下次到期: {user.currentSubscription.nextBillingDate}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[160px] font-mono text-fg-secondary whitespace-nowrap">
                      <span className="px-1.5 py-0.5 bg-hover rounded text-[11px] border border-line">
                        {user.defaultPaymentMethod.brand} •••• {user.defaultPaymentMethod.last4}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 w-[140px] font-mono font-bold text-fg whitespace-nowrap">
                      {formatCurrency(user.totalSpend, user.currentSubscription.currency)}
                      <span className="text-[10px] text-fg-tertiary font-normal block">
                        共 {user.totalOrdersCount} 笔交易
                      </span>
                    </td>

                    <td className="py-3.5 px-4 w-[180px]">
                      <div className="font-mono text-fg-secondary whitespace-nowrap">{user.lastLoginAt}</div>
                      <div className="font-mono text-[10px] text-fg-tertiary truncate max-w-[160px]" title={user.lastLoginIp}>
                        {user.lastLoginIp}
                      </div>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-4 w-[150px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                        }}
                        className="px-2.5 py-1.5 bg-hover hover:bg-hover text-fg-secondary rounded-lg font-medium text-xs flex items-center gap-1 ml-auto transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>查看轨迹 ({user.actions.length})</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Actions Full Detail SideSheet (右侧滑入) */}
      {selectedUser && (
        <SideSheet
          id="side-sheet-user-detail"
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`${selectedUser.name || "客户档案"} (${selectedUser.country})`}
          description={`${selectedUser.id} • ${selectedUser.email}`}
          icon={<Users className="w-5 h-5 text-fg" />}
          widthClass="max-w-3xl"
          footer={
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer"
            >
              关闭面板
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
                  ? "暂停/取消订阅续订"
                  : "恢复自动续订"}
              </button>
            </div>

            {/* Overview Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">当前订阅套餐</span>
                <span className="font-bold text-xs text-fg block truncate mt-0.5">
                  {selectedUser.currentSubscription.planName}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {selectedUser.currentSubscription.status}
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">默认扣款卡</span>
                <span className="font-bold text-xs text-fg block mt-0.5">
                  {selectedUser.defaultPaymentMethod.brand} •••• {selectedUser.defaultPaymentMethod.last4}
                </span>
                <span className="text-[10px] text-fg-tertiary font-mono">
                  有效期: {selectedUser.defaultPaymentMethod.expiry || "09/28"}
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">累计终生消费 (LTV)</span>
                <span className="font-bold text-xs font-mono text-fg block mt-0.5">
                  {formatCurrency(selectedUser.totalSpend, selectedUser.currentSubscription.currency)}
                </span>
                <span className="text-[10px] text-fg-tertiary font-mono">
                  共 {selectedUser.totalOrdersCount} 笔扣费订单
                </span>
              </div>

              <div className="bg-subtle rounded-xl p-3 border border-line-subtle">
                <span className="text-[10px] text-fg-tertiary block font-medium">快捷操作</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => handleAdminResetPassword(selectedUser)}
                    className="p-1 bg-surface border border-line hover:bg-hover rounded text-fg-secondary text-[10px] flex items-center gap-1 font-medium"
                    title="发送重置密码邮件"
                  >
                    <Key className="w-2.5 h-2.5" /> 密码重置
                  </button>
                  <button
                    onClick={() => handleAdminResendReceipt(selectedUser)}
                    className="p-1 bg-surface border border-line hover:bg-hover rounded text-fg-secondary text-[10px] flex items-center gap-1 font-medium"
                    title="重新发送电子发票"
                  >
                    <Send className="w-2.5 h-2.5" /> 补发发票
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Tabs for Actions */}
            <div className="flex items-center justify-between border-b border-line-subtle pb-2 pt-2">
              <span className="font-bold text-fg text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>用户全生命周期动作流水 ({filteredActions?.length || 0})</span>
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
                    {cat === "ALL" ? "全部动作" : cat === "BILLING" ? "订阅与扣费" : "安全与登录"}
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

                        <div className="pt-2 border-t border-line/60 flex flex-wrap items-center gap-3 text-[10px] text-fg-secondary font-mono">
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
                  <div className="text-center py-8 text-fg-tertiary">暂无该分类的动作记录</div>
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
        title="录入新出海客户档案"
        description="手动建档并将客户直接纳入全流程生命周期审计流"
        icon={<Users className="w-5 h-5 text-fg" />}
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              form="form-add-end-user"
              className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold cursor-pointer"
            >
              确认建档
            </button>
          </>
        }
      >
        {isAddModalOpen && (
          <form id="form-add-end-user" onSubmit={handleCreateNewUser} className="space-y-3 text-xs">
              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">客户全名 / 姓名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如: Jonathan Vance"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">客户邮箱 (Email) *</label>
                <input
                  type="email"
                  required
                  placeholder="例如: j.vance@techventures.io"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">所在国家/地区</label>
                  <ShadcnSelect
                    value={formCountry}
                    onValueChange={setFormCountry}
                    options={[
                      { value: "🇺🇸 United States (US)", label: "🇺🇸 美国 (United States)" },
                      { value: "🇬🇧 United Kingdom (UK)", label: "🇬🇧 英国 (United Kingdom)" },
                      { value: "🇩🇪 Germany (DE)", label: "🇩🇪 德国 (Germany)" },
                      { value: "🇯🇵 Japan (JP)", label: "🇯🇵 日本 (Japan)" },
                      { value: "🇫🇷 France (FR)", label: "🇫🇷 法国 (France)" },
                      { value: "🇨🇦 Canada (CA)", label: "🇨🇦 加拿大 (Canada)" },
                      { value: "🇦🇺 Australia (AU)", label: "🇦🇺 澳大利亚 (Australia)" },
                      { value: "🇸🇬 Singapore (SG)", label: "🇸🇬 新加坡 (Singapore)" },
                    ]}
                    placeholder="选择国家/地区"
                  />
                </div>

                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">结算货币</label>
                  <ShadcnSelect
                    value={formCurrency}
                    onValueChange={setFormCurrency}
                    options={[
                      { value: "USD", label: "USD ($ 美元)" },
                      { value: "EUR", label: "EUR (€ 欧元)" },
                      { value: "JPY", label: "JPY (¥ 日元)" },
                      { value: "GBP", label: "GBP (£ 英镑)" },
                    ]}
                    placeholder="选择结算货币"
                  />
                </div>
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-semibold">开通订阅方案</label>
                <input
                  type="text"
                  placeholder="例如: Novas AI 商业专业版 (年付)"
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">首期金额</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">支付卡品牌</label>
                  <ShadcnSelect
                    value={formCardBrand}
                    onValueChange={setFormCardBrand}
                    options={[
                      { value: "Visa", label: "Visa" },
                      { value: "Mastercard", label: "Mastercard" },
                      { value: "American Express", label: "Amex" },
                      { value: "JCB", label: "JCB" },
                    ]}
                    placeholder="选择卡品牌"
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-semibold">卡号后4位</label>
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
