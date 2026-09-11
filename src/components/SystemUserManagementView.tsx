import React, { useEffect, useState } from "react";
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
  Mail,
  Building,
  Globe,
  UserCheck,
  UserX,
  Sparkles,
} from "lucide-react";
import { SystemUser, PaymentApp, RbacRole, Department } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";
import { ShadcnSelect } from "./ui/select";
import { MultiSelect } from "./ui/MultiSelect";
import { SideSheet } from "./ui/SideSheet";

interface SystemUserManagementViewProps {
  users: SystemUser[];
  roles: RbacRole[];
  apps: PaymentApp[];
  departments: Department[];
  currentUser: SystemUser;
  onSaveUser: (user: SystemUser) => void;
  onDeleteUser?: (id: string) => void;
}

export const SystemUserManagementView: React.FC<SystemUserManagementViewProps> = ({
  users,
  roles,
  apps,
  departments,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const [userList, setUserList] = useState<SystemUser[]>(users);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [appFilter, setAppFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Sheet State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form State（角色多选非必选；部门多选；应用多选）
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoleKeys, setFormRoleKeys] = useState<string[]>([]);
  const [formDepartmentIds, setFormDepartmentIds] = useState<string[]>([]);
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [formAllowedAppIds, setFormAllowedAppIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setUserList(users);
  }, [users]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRoleKeys([]);
    setFormDepartmentIds([]);
    setFormPhone("+1 (555) ");
    setFormStatus("ACTIVE");
    setFormAllowedAppIds([]);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRoleKeys(user.roleKeys?.length ? user.roleKeys : user.roleKey ? [user.roleKey] : []);
    setFormDepartmentIds(user.departmentIds || []);
    setFormPhone(user.phone || "");
    setFormStatus(user.status || "ACTIVE");
    setFormAllowedAppIds(
      (user.allowedAppIds || []).filter((id) => id !== "ALL")
    );
    setIsSheetOpen(true);
  };

  // 所选部门继承的角色（并集）
  const inheritedRoleKeys = Array.from(
    new Set<string>(
      departments
        .filter((d) => formDepartmentIds.includes(d.id))
        .flatMap((d) => d.roleKeys || [])
    )
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast("请填写完整的姓名与企业工作邮箱");
      return;
    }

    const finalRoleKeys = formRoleKeys; // 非必选，可为空数组
    const finalAppIds = formAllowedAppIds; // 多选；"ALL" 由选项单独处理

    const roleNames = finalRoleKeys.map((key) => getRoleName(key));
    const deptNames = formDepartmentIds
      .map((id) => departments.find((d) => d.id === id)?.name)
      .filter(Boolean);

    if (editingUser) {
      const updated: SystemUser = {
        ...editingUser,
        name: formName.trim(),
        email: formEmail.trim(),
        roleKeys: finalRoleKeys,
        role: roleNames.length ? roleNames.join("、") : "未分配角色",
        roleKey: finalRoleKeys[0] || "UNASSIGNED",
        departmentIds: formDepartmentIds,
        department: deptNames.join(" / ") || undefined,
        phone: formPhone.trim(),
        status: formStatus,
        allowedAppIds: finalAppIds,
      };
      setUserList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onSaveUser(updated);
      showToast(`系统用户【${updated.name}】权限与资料已保存！`);
    } else {
      const initials =
        formName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) || "U";
      const newUser: SystemUser = {
        id: `user-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        email: formEmail.trim(),
        roleKeys: finalRoleKeys,
        role: roleNames.length ? roleNames.join("、") : "未分配角色",
        roleKey: finalRoleKeys[0] || "UNASSIGNED",
        avatarText: initials,
        departmentIds: formDepartmentIds,
        department: deptNames.join(" / ") || undefined,
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

    const userRoleKeys = u.roleKeys?.length ? u.roleKeys : u.roleKey ? [u.roleKey] : [];
    const matchesRole = roleFilter === "ALL" || userRoleKeys.includes(roleFilter);

    const matchesDept =
      deptFilter === "ALL" || (u.departmentIds || []).includes(deptFilter);

    const matchesStatus =
      statusFilter === "ALL" || (u.status || "ACTIVE") === statusFilter;

    const matchesApp =
      appFilter === "ALL" ||
      (u.allowedAppIds &&
        (u.allowedAppIds.includes("ALL") || u.allowedAppIds.includes(appFilter)));

    return matchesSearch && matchesRole && matchesStatus && matchesApp && matchesDept;
  });

  const getRoleName = (key: string) => {
    const r =
      roles.find((role) => (role.key || role.id) === key) ||
      RBAC_ROLES[key as keyof typeof RBAC_ROLES];
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

  const getDeptName = (id: string) =>
    departments.find((d) => d.id === id)?.name || id;

  return (
    <div className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-zinc-100 text-zinc-900">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              用户管理 (User & Access Control)
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              管理系统内控账户：角色（多选，非必选）、所属部门（多选，继承部门角色权限）与出海应用授权范围。
            </p>
          </div>
        </div>

        <button
          id="btn-add-system-user"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新增系统用户</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs px-4 py-3 flex flex-col lg:flex-row gap-3 items-center justify-between">
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

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          {/* Dept Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={deptFilter}
              onValueChange={setDeptFilter}
              options={[
                { value: "ALL", label: "全部所属部门" },
                ...departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
              placeholder="按部门筛选"
            />
          </div>

          {/* Role Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "ALL", label: "全部角色权限" },
                ...roles.map((r) => ({
                  value: (r.key || r.id) as string,
                  label: r.name.split(" ")[0],
                })),
              ]}
              placeholder="按角色筛选"
            />
          </div>

          {/* App Access Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={appFilter}
              onValueChange={setAppFilter}
              options={[
                { value: "ALL", label: "全部应用权限范围" },
                ...apps.map((a) => ({
                  value: a.id,
                  label: a.name.split(" ")[0],
                })),
              ]}
              placeholder="按应用权限筛选"
            />
          </div>

          {/* Status Filter */}
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
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
              <tr>
                <th className="px-4 py-3">用户与联系方式</th>
                <th className="px-4 py-3">所属部门（多选）</th>
                <th className="px-4 py-3">角色权限（多选）</th>
                <th className="px-4 py-3">应用授权范围</th>
                <th className="px-4 py-3">账号状态</th>
                <th className="px-4 py-3">最后登录</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    未查找到符合条件的系统用户记录
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const userRoleKeys = u.roleKeys?.length
                    ? u.roleKeys
                    : u.roleKey
                    ? [u.roleKey]
                    : [];
                  const deptIds = u.departmentIds || [];

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
                      {/* Name & Email */}
                      <td className="px-4 py-3">
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
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Departments */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {deptIds.length === 0 ? (
                            <span className="text-[11px] text-zinc-400 italic">
                              未分配部门
                            </span>
                          ) : (
                            deptIds.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded text-[10px] font-medium"
                              >
                                <Building className="w-2.5 h-2.5 text-zinc-500" />
                                {getDeptName(id)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {userRoleKeys.length === 0 ? (
                            <span className="text-[11px] text-zinc-400 italic">
                              未分配角色
                            </span>
                          ) : (
                            userRoleKeys.map((key) => (
                              <span
                                key={key}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${getRoleBadgeStyle(key)}`}
                              >
                                <Shield className="w-2.5 h-2.5" />
                                <span>{getRoleName(key).split(" ")[0]}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* App Permissions */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {isAllApps ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-medium flex items-center gap-1">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-[11px] text-zinc-500">
                        {u.lastLogin || "暂未登录记录"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                            title="配置角色 / 部门 / 应用权限"
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

      {/* SideSheet for Add/Edit User */}
      <SideSheet
        id="side-sheet-system-user"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={editingUser ? `配置用户权限: ${editingUser.name}` : "新增系统用户与权限授权"}
        description="角色可多选且非必选；所属部门可多选，成员将继承部门绑定角色的权限；应用授权范围支持多选。"
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
        <div className="space-y-5 text-xs">
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
                <label className="block text-zinc-600 font-medium mb-1">联系电话</label>
                <input
                  type="text"
                  placeholder="+1 (555) 019-2831"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">账号启用状态</label>
                <div className="w-full">
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
          </div>

          {/* Department Section（多选，继承部门角色权限） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Building className="w-3.5 h-3.5 text-zinc-500" />
              <span>所属部门（多选）</span>
            </h3>
            <MultiSelect
              value={formDepartmentIds}
              onValueChange={setFormDepartmentIds}
              placeholder="选择该用户所属的部门（可多选）..."
              options={departments.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
            />
            <p className="text-[11px] text-zinc-400">
              用户将继承所选部门绑定角色的权限；在部门管理中可配置各部门绑定的角色。
            </p>
            {inheritedRoleKeys.length > 0 && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  所选部门绑定角色：
                  <b>
                    {inheritedRoleKeys
                      .map((key) => getRoleName(key).split(" ")[0])
                      .join("、")}
                  </b>
                  ，用户自动继承这些角色对应的菜单与应用权限。
                </span>
              </div>
            )}
          </div>

          {/* Role Section（多选，非必选） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              <span>角色权限配置（多选，非必选）</span>
            </h3>
            <MultiSelect
              value={formRoleKeys}
              onValueChange={setFormRoleKeys}
              placeholder="选择分配的系统角色（可多选，可留空）..."
              options={roles.map((r) => ({
                value: (r.key || r.id) as string,
                label: r.name,
              }))}
            />
            <p className="text-[11px] text-zinc-400">
              角色决定该用户在系统中可操作的功能模块与读写权限；可不分配角色，仅通过部门继承权限。
            </p>
          </div>

          {/* Application Permission Section（多选下拉） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>出海应用授权范围（多选）</span>
            </h3>
            <MultiSelect
              value={formAllowedAppIds}
              onValueChange={setFormAllowedAppIds}
              placeholder="选择授权访问的出海应用（可多选）..."
              options={[
                ...apps.map((a) => ({
                  value: a.id,
                  label: `${a.name}（${a.code}）`,
                })),
              ]}
              showToolbar
            />
            <p className="text-[11px] text-zinc-400">
              被授权的应用代表该用户仅能查阅和处理这些出海业务线的专属交易流水、商品价格体系与支付网关。
            </p>
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
