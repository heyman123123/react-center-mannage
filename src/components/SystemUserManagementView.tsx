import React, { useState } from "react";
import {
  Users,
  Shield,
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Key,
  Smartphone,
  Mail,
  Building,
  Check,
  Globe,
  Lock,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  UserX,
} from "lucide-react";
import { SystemUser, PaymentApp, RbacRole } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";
import { ShadcnSelect } from "./ui/select";
import { SideSheet } from "./ui/SideSheet";

interface SystemUserManagementViewProps {
  users: SystemUser[];
  roles: RbacRole[];
  apps: PaymentApp[];
  currentUser: SystemUser;
  onSaveUser: (user: SystemUser) => void;
  onDeleteUser?: (id: string) => void;
}

export const SystemUserManagementView: React.FC<SystemUserManagementViewProps> = ({
  users,
  roles,
  apps,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const [userList, setUserList] = useState<SystemUser[]>(users);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [appFilter, setAppFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Sheet State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoleKey, setFormRoleKey] = useState("BU_OPERATOR");
  const [formDepartment, setFormDepartment] = useState("全球出海运营中心");
  const [formPhone, setFormPhone] = useState("+1 (555) 019-2831");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [formAllowedAllApps, setFormAllowedAllApps] = useState(false);
  const [formAllowedAppIds, setFormAllowedAppIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRoleKey("BU_OPERATOR");
    setFormDepartment("全球出海运营中心");
    setFormPhone("+1 (555) ");
    setFormStatus("ACTIVE");
    setFormAllowedAllApps(false);
    setFormAllowedAppIds(apps.length > 0 ? [apps[0].id] : []);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRoleKey(user.roleKey);
    setFormDepartment(user.department || "全球技术研发中心");
    setFormPhone(user.phone || "+1 (555) 019-2831");
    setFormStatus(user.status || "ACTIVE");

    const userApps = user.allowedAppIds || [];
    if (userApps.includes("ALL") || userApps.length === apps.length) {
      setFormAllowedAllApps(true);
      setFormAllowedAppIds(apps.map((a) => a.id));
    } else {
      setFormAllowedAllApps(false);
      setFormAllowedAppIds(userApps);
    }
    setIsSheetOpen(true);
  };

  const handleToggleAppSelection = (appId: string) => {
    if (formAllowedAllApps) {
      setFormAllowedAllApps(false);
      setFormAllowedAppIds(apps.map((a) => a.id).filter((id) => id !== appId));
      return;
    }

    if (formAllowedAppIds.includes(appId)) {
      setFormAllowedAppIds(formAllowedAppIds.filter((id) => id !== appId));
    } else {
      const next = [...formAllowedAppIds, appId];
      setFormAllowedAppIds(next);
      if (next.length === apps.length) {
        setFormAllowedAllApps(true);
      }
    }
  };

  const handleToggleSelectAllApps = () => {
    if (formAllowedAllApps) {
      setFormAllowedAllApps(false);
      setFormAllowedAppIds([]);
    } else {
      setFormAllowedAllApps(true);
      setFormAllowedAppIds(apps.map((a) => a.id));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast("请填写完整的姓名与企业工作邮箱");
      return;
    }

    const finalAppIds = formAllowedAllApps
      ? ["ALL", ...apps.map((a) => a.id)]
      : formAllowedAppIds.length > 0
      ? formAllowedAppIds
      : [];

    const roleObj = roles.find((r) => (r.key || r.id) === formRoleKey) || RBAC_ROLES[formRoleKey as keyof typeof RBAC_ROLES];
    const roleName = roleObj?.name || formRoleKey;

    if (editingUser) {
      const updated: SystemUser = {
        ...editingUser,
        name: formName.trim(),
        email: formEmail.trim(),
        role: roleName,
        roleKey: formRoleKey,
        department: formDepartment.trim(),
        phone: formPhone.trim(),
        status: formStatus,
        allowedAppIds: finalAppIds,
      };
      setUserList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onSaveUser(updated);
      showToast(`系统用户【${updated.name}】权限与资料已保存！`);
    } else {
      const initials = formName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";
      const newUser: SystemUser = {
        id: `user-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        email: formEmail.trim(),
        role: roleName,
        roleKey: formRoleKey,
        avatarText: initials,
        department: formDepartment.trim(),
        phone: formPhone.trim(),
        status: formStatus,
        allowedAppIds: finalAppIds,
        lastLogin: "刚刚创建 (尚未登录)",
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUserList((prev) => [newUser, ...prev]);
      onSaveUser(newUser);
      showToast(`新系统用户【${newUser.name}】已成功创建并分配权限！`);
    }
    setIsSheetOpen(false);
  };

  const handleToggleStatus = (user: SystemUser) => {
    const nextStatus = user.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    const updated: SystemUser = { ...user, status: nextStatus };
    setUserList((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    onSaveUser(updated);
    showToast(
      `用户【${user.name}】已${nextStatus === "ACTIVE" ? "成功启用" : "已停用账号访问权限"}`
    );
  };

  // Filtered Users
  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === "ALL" || u.roleKey === roleFilter;

    const matchesStatus =
      statusFilter === "ALL" || (u.status || "ACTIVE") === statusFilter;

    const matchesApp =
      appFilter === "ALL" ||
      (u.allowedAppIds &&
        (u.allowedAppIds.includes("ALL") || u.allowedAppIds.includes(appFilter)));

    return matchesSearch && matchesRole && matchesStatus && matchesApp;
  });

  const getRoleDisplayName = (key: string) => {
    const r = roles.find((role) => (role.key || role.id) === key) || RBAC_ROLES[key as keyof typeof RBAC_ROLES];
    return r?.name || key;
  };

  const getRoleBadgeStyle = (key: string) => {
    switch (key) {
      case "SUPER_ADMIN":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "FINANCE_DIRECTOR":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "RECON_SPECIALIST":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "RISK_AUDITOR":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-6 md:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900">
                用户管理与权限分配 (User & Access Control)
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                管理系统内控账户，细粒度配置角色职能（RBAC）与出海业务应用访问权限（Application Scope）。
              </p>
            </div>
          </div>
        </div>

        <button
          id="btn-add-system-user"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新增系统用户</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索用户名、企业邮箱、部门..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-50/80 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
          {/* Role Filter (ShadcnSelect) */}
          <div className="w-full sm:w-44">
            <ShadcnSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "ALL", label: "全部角色权限" },
                { value: "SUPER_ADMIN", label: "超级管理员" },
                { value: "FINANCE_DIRECTOR", label: "财务合规总监" },
                { value: "RECON_SPECIALIST", label: "跨境对账专家" },
                { value: "RISK_AUDITOR", label: "欺诈风控审计师" },
                { value: "BU_OPERATOR", label: "出海业务运维" },
              ]}
              placeholder="按角色筛选"
            />
          </div>

          {/* App Access Filter (ShadcnSelect) */}
          <div className="w-full sm:w-48">
            <ShadcnSelect
              value={appFilter}
              onValueChange={setAppFilter}
              options={[
                { value: "ALL", label: "全部应用权限范围" },
                ...apps.map((a) => ({
                  value: a.id,
                  label: a.name,
                })),
              ]}
              placeholder="按应用权限筛选"
            />
          </div>

          {/* Status Filter (ShadcnSelect) */}
          <div className="w-full sm:w-36">
            <ShadcnSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "ALL", label: "全部账号状态" },
                { value: "ACTIVE", label: "已启用 (正常)" },
                { value: "DISABLED", label: "已停用 (锁定)" },
              ]}
              placeholder="按状态筛选"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
              <tr>
                <th className="px-5 py-3">用户与所属部门</th>
                <th className="px-5 py-3">角色权限 (RBAC)</th>
                <th className="px-5 py-3">已授权出海应用 (App Scope)</th>
                <th className="px-5 py-3">账号状态</th>
                <th className="px-5 py-3">最后登录与设备</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    未查找到符合条件的系统用户记录
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isSuper = u.roleKey === "SUPER_ADMIN";
                  const roleLabel = getRoleDisplayName(u.roleKey);
                  const roleStyle = getRoleBadgeStyle(u.roleKey);

                  const userAppIds = u.allowedAppIds || [];
                  const isAllApps =
                    userAppIds.includes("ALL") || userAppIds.length >= apps.length;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-zinc-50/80 transition-colors ${
                        u.status === "DISABLED" ? "opacity-60 bg-zinc-50/40" : ""
                      }`}
                    >
                      {/* Name & Dept */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold flex items-center justify-center shrink-0 text-xs">
                            {u.avatarText || u.name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full font-medium">
                                  当前操作者
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-zinc-400" />
                              <span>{u.email}</span>
                              {u.department && (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span>{u.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${roleStyle}`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{roleLabel}</span>
                        </span>
                      </td>

                      {/* App Permissions */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {isAllApps ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3 text-blue-500" />
                              全部出海应用 ({apps.length} 款)
                            </span>
                          ) : userAppIds.length === 0 ? (
                            <span className="text-[11px] text-zinc-400 italic">
                              未分配任何应用
                            </span>
                          ) : (
                            userAppIds.map((appId) => {
                              const found = apps.find((a) => a.id === appId);
                              return (
                                <span
                                  key={appId}
                                  className="px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded text-[10px] font-medium flex items-center gap-1"
                                >
                                  <Layers className="w-2.5 h-2.5 text-zinc-500" />
                                  <span>{found ? found.name.split(" ")[0] : appId}</span>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {u.status === "DISABLED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                            <UserX className="w-3 h-3 text-zinc-400" />
                            已停用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            正常在职
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-3.5 text-[11px] text-zinc-500">
                        {u.lastLogin || "暂未登录记录"}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                            title="配置角色与应用权限"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrent}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              u.status === "DISABLED"
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-amber-600 hover:bg-amber-50"
                            } ${isCurrent ? "opacity-30 cursor-not-allowed" : ""}`}
                            title={u.status === "DISABLED" ? "启用该用户" : "停用该用户"}
                          >
                            {u.status === "DISABLED" ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {onDeleteUser && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(u.id)}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="删除用户"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SideSheet for Add/Edit User (From Left to Right) */}
      <SideSheet
        id="side-sheet-system-user"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={editingUser ? `配置用户权限: ${editingUser.name}` : "新增系统用户与权限授权"}
        description="设置该员工的基础信息、分配 RBAC 业务职能角色，并指定其有权访问和管理的出海应用范围。"
        icon={<Shield className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="px-4 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {editingUser ? "保存用户权限" : "创建并授权用户"}
            </button>
          </>
        }
      >
        <div className="space-y-6 text-xs">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>基本信息与员工档案</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">
                  员工姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如: Eddie Lake"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">
                  企业工作邮箱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="name@novaspay.global"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">所属部门 / 业务线</label>
                <input
                  type="text"
                  placeholder="例如: 全球出海运营中心"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">联系电话</label>
                <input
                  type="text"
                  placeholder="+1 (555) 019-2831"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-600 font-medium mb-1">账号启用状态</label>
              <div className="w-48">
                <ShadcnSelect
                  value={formStatus}
                  onValueChange={(val) => setFormStatus(val as "ACTIVE" | "DISABLED")}
                  options={[
                    { value: "ACTIVE", label: "已启用 (正常访问系统)" },
                    { value: "DISABLED", label: "已停用 (禁止登录授权)" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Role Permission Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span>角色权限配置 (RBAC Role Permission)</span>
            </h3>

            <div>
              <label className="block text-zinc-600 font-medium mb-1">
                分配系统角色 <span className="text-rose-500">*</span>
              </label>
              <ShadcnSelect
                value={formRoleKey}
                onValueChange={setFormRoleKey}
                options={[
                  {
                    value: "SUPER_ADMIN",
                    label: "超级管理员 (全集团最高系统权限，含退款与密钥调度)",
                  },
                  {
                    value: "FINANCE_DIRECTOR",
                    label: "财务合规总监 (结算对账、资金调账、财务审计报表)",
                  },
                  {
                    value: "RECON_SPECIALIST",
                    label: "跨境对账专家 (通道对账、差错处理、流水追踪)",
                  },
                  {
                    value: "RISK_AUDITOR",
                    label: "欺诈风控审计师 (拒付仲裁、风控规则、只读敏感数据)",
                  },
                  {
                    value: "BU_OPERATOR",
                    label: "出海业务运维 (商品方案配置、促销邮件与普通流水巡检)",
                  },
                ]}
              />
              <p className="text-[11px] text-zinc-400 mt-1.5">
                角色决定该用户在系统中可操作的功能模块与读写权限，可在“RBAC 角色管理”中进一步微调。
              </p>
            </div>
          </div>

          {/* Application Permission Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                <span>出海应用授权范围 (Application Permissions)</span>
              </h3>

              <button
                type="button"
                onClick={handleToggleSelectAllApps}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                {formAllowedAllApps ? "取消全选" : "全选全部应用"}
              </button>
            </div>

            <div className="bg-zinc-50/80 border border-zinc-200 rounded-xl p-3 text-[11px] text-zinc-600 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
              <span>
                被授权的应用代表该用户仅能查阅和处理这些出海业务线的专属交易流水、商品价格体系与支付网关。
              </span>
            </div>

            {/* Apps Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {apps.map((app) => {
                const isChecked =
                  formAllowedAllApps || formAllowedAppIds.includes(app.id);

                return (
                  <div
                    key={app.id}
                    onClick={() => handleToggleAppSelection(app.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                      isChecked
                        ? "border-zinc-900 bg-zinc-50/90 shadow-2xs"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                          isChecked
                            ? "bg-zinc-900 border-zinc-900 text-white"
                            : "border-zinc-300 bg-white"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900 text-xs">
                          {app.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {app.code} • 币种 {app.defaultCurrency}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                          {app.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
