import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Users,
  Shield,
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Mail,
  Building,
  Globe,
  UserCheck,
  UserX,
  Sparkles,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { SystemUser, PaymentApp, RbacRole, Department } from "../types/payment";
import * as appsApi from "../api/modules/apps";
import { ShadcnSelect } from "./ui/select";
import { MultiSelect } from "./ui/MultiSelect";
import { AppScopeMultiSelect } from "./AppScopeMultiSelect";
import { SideSheet } from "./ui/SideSheet";
import { Popconfirm } from "./ui/Popconfirm";

function generateRandomPassword(length = 14): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;
  const chars: string[] = [
    letters[Math.floor(Math.random() * letters.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  for (let i = chars.length; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

interface SystemUserManagementViewProps {
  users: SystemUser[];
  roles: RbacRole[];
  departments: Department[];
  currentUser: SystemUser;
  onSaveUser: (user: SystemUser, opts?: { isNew?: boolean }) => void | Promise<SaveUserResult | void>;
  onDeleteUser?: (id: string) => void | Promise<void>;
  onResetPassword?: (id: string) => void | Promise<string>;
}

type SaveUserResult = { user?: SystemUser; initialPassword?: string };

export const SystemUserManagementView: React.FC<SystemUserManagementViewProps> = ({
  users,
  roles,
  departments,
  currentUser,
  onSaveUser,
  onDeleteUser,
  onResetPassword,
}) => {
  const { t } = useTranslation(["rbac", "common"]);
  const [apps, setApps] = useState<PaymentApp[]>([]);
  const [userList, setUserList] = useState<SystemUser[]>(users);

  useEffect(() => {
    void appsApi.getApps().then(setApps).catch(() => setApps([]));
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentPage, setCurrentPage, reset, pageSize, setPageSize } = usePagination(10);
  useEffect(() => { reset(); }, [searchQuery, reset]);
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
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    password: string;
    titleKey: "created" | "reset";
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleResetPassword = async (user: SystemUser) => {
    try {
      const password = onResetPassword
        ? (await onResetPassword(user.id)) || generateRandomPassword()
        : generateRandomPassword();
      setCredentialsModal({
        email: user.email,
        password,
        titleKey: "reset",
      });
      setCopied(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("systemUsers.toast.actionFailed"));
    }
  };

  const closeCredentialsModal = () => {
    setCredentialsModal(null);
    setCopied(false);
  };

  const handleCopyCredentials = async () => {
    if (!credentialsModal) return;
    const text = t("systemUsers.credentials.copyText", {
      email: credentialsModal.email,
      password: credentialsModal.password,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast(t("systemUsers.toast.credentialsCopied"));
      window.setTimeout(() => {
        closeCredentialsModal();
      }, 400);
    } catch {
      showToast(t("systemUsers.toast.copyFailed"));
    }
  };

  // 所选部门继承的角色（并集）
  const inheritedRoleKeys = Array.from(
    new Set<string>(
      departments
        .filter((d) => formDepartmentIds.includes(d.id))
        .flatMap((d) => d.roleKeys || [])
    )
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast(t("systemUsers.toast.nameEmailRequired"));
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
        role: roleNames.length ? roleNames.join("、") : t("systemUsers.unassignedRole"),
        roleKey: finalRoleKeys[0] || "UNASSIGNED",
        departmentIds: formDepartmentIds,
        department: deptNames.join(" / ") || undefined,
        phone: formPhone.trim(),
        status: formStatus,
        allowedAppIds: finalAppIds,
      };
      try {
        const result = await onSaveUser(updated, { isNew: false });
        const saved = result && "user" in result && result.user ? result.user : updated;
        setUserList((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
        showToast(t("systemUsers.toast.updated", { name: saved.name }));
        setIsSheetOpen(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("systemUsers.toast.saveFailed"));
      }
      return;
    }

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
      role: roleNames.length ? roleNames.join("、") : t("systemUsers.unassignedRole"),
      roleKey: finalRoleKeys[0] || "UNASSIGNED",
      avatarText: initials,
      departmentIds: formDepartmentIds,
      department: deptNames.join(" / ") || undefined,
      phone: formPhone.trim(),
      status: formStatus,
      allowedAppIds: finalAppIds,
      lastLogin: t("systemUsers.justCreated"),
      createdAt: new Date().toISOString().split("T")[0],
    };
    try {
      const result = await onSaveUser(newUser, { isNew: true });
      const saved = result && "user" in result && result.user ? result.user : newUser;
      const initialPassword =
        (result && "initialPassword" in result && result.initialPassword) ||
        generateRandomPassword();
      setUserList((prev) => [saved, ...prev]);
      setIsSheetOpen(false);
      setCredentialsModal({
        email: saved.email,
        password: initialPassword,
        titleKey: "created",
      });
      setCopied(false);
      showToast(t("systemUsers.toast.created", { name: saved.name }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("systemUsers.toast.saveFailed"));
    }
  };

  const handleToggleStatus = async (user: SystemUser) => {
    const nextStatus = user.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    const updated: SystemUser = { ...user, status: nextStatus };
    try {
      const result = await onSaveUser(updated, { isNew: false });
      const saved = result && "user" in result && result.user ? result.user : updated;
      setUserList((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      showToast(
        nextStatus === "ACTIVE"
          ? t("systemUsers.toast.enabled", { name: user.name })
          : t("systemUsers.toast.disabled", { name: user.name })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("systemUsers.toast.saveFailed"));
    }
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
    const r = roles.find((role) => (role.key || role.id) === key);
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

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-surface border border-line rounded-xl shadow-card px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-hover text-fg">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">{t("systemUsers.title")}</h1>
            <p className="text-xs text-fg-secondary mt-0.5">{t("systemUsers.subtitle")}</p>
          </div>
        </div>

        <button
          id="btn-add-system-user"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t("systemUsers.addUser")}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-line rounded-xl shadow-card px-3 py-2 flex flex-col lg:flex-row gap-2 items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("systemUsers.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-subtle/80 border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
          {/* Dept Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={deptFilter}
              onValueChange={setDeptFilter}
              options={[
                { value: "ALL", label: t("systemUsers.filter.allDepartments") },
                ...departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
              placeholder={t("systemUsers.filter.filterByDept")}
            />
          </div>

          {/* Role Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: "ALL", label: t("systemUsers.filter.allRoles") },
                ...roles.map((r) => ({
                  value: (r.key || r.id) as string,
                  label: r.name.split(" ")[0],
                })),
              ]}
              placeholder={t("systemUsers.filter.filterByRole")}
            />
          </div>

          {/* App Access Filter */}
          <div className="w-full sm:w-40">
            <ShadcnSelect
              value={appFilter}
              onValueChange={setAppFilter}
              options={[
                { value: "ALL", label: t("systemUsers.filter.allApps") },
                ...apps.map((a) => ({
                  value: a.id,
                  label: a.name.split(" ")[0],
                })),
              ]}
              placeholder={t("systemUsers.filter.filterByApp")}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-36">
            <ShadcnSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "ALL", label: t("systemUsers.filter.allStatus") },
                { value: "ACTIVE", label: t("systemUsers.status.ACTIVE_FORM") },
                { value: "DISABLED", label: t("systemUsers.status.DISABLED_FORM") },
              ]}
              placeholder={t("systemUsers.filter.filterByStatus")}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle border-b border-line text-fg-secondary font-medium">
              <tr>
                <th className="px-3 py-2">{t("systemUsers.table.userContact")}</th>
                <th className="px-3 py-2">{t("systemUsers.table.departments")}</th>
                <th className="px-3 py-2">{t("systemUsers.table.roles")}</th>
                <th className="px-3 py-2">{t("systemUsers.table.appScope")}</th>
                <th className="px-3 py-2">{t("systemUsers.table.status")}</th>
                <th className="px-3 py-2">{t("systemUsers.table.lastLogin")}</th>
                <th className="px-3 py-2 text-right">{t("systemUsers.table.operations")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle text-fg-secondary">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-fg-tertiary">
                    {t("systemUsers.table.empty")}
                  </td>
                </tr>
              ) : (
                paginate<SystemUser>(filteredUsers, currentPage, pageSize).map((u) => {
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
                      className={`hover:bg-subtle/80 transition-colors ${
                        u.status === "DISABLED" ? "opacity-60 bg-subtle/40" : ""
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-hover border border-line text-fg font-bold flex items-center justify-center shrink-0 text-xs">
                            {u.avatarText || u.name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-fg flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full font-medium">
                                  {t("systemUsers.table.currentOperator")}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-fg-tertiary flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-fg-tertiary" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Departments */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {deptIds.length === 0 ? (
                            <span className="text-[11px] text-fg-tertiary italic">
                              {t("systemUsers.table.noDepartment")}
                            </span>
                          ) : (
                            deptIds.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-hover text-fg-secondary border border-line rounded text-[10px] font-medium"
                              >
                                <Building className="w-2.5 h-2.5 text-fg-secondary" />
                                {getDeptName(id)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {userRoleKeys.length === 0 ? (
                            <span className="text-[11px] text-fg-tertiary italic">
                              {t("systemUsers.table.noRole")}
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
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {isAllApps ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3 text-blue-500" />
                              {t("systemUsers.table.allApps", { count: apps.length })}
                            </span>
                          ) : userAppIds.length === 0 ? (
                            <span className="text-[11px] text-fg-tertiary italic">
                              {t("systemUsers.table.noApps")}
                            </span>
                          ) : (
                            userAppIds.map((appId) => {
                              const found = apps.find((a) => a.id === appId);
                              return (
                                <span
                                  key={appId}
                                  className="px-1.5 py-0.5 bg-hover text-fg-secondary border border-line rounded text-[10px] font-medium flex items-center gap-1"
                                >
                                  <Layers className="w-2.5 h-2.5 text-fg-secondary" />
                                  <span>{found ? found.name.split(" ")[0] : appId}</span>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Status（点击切换账号状态，Popconfirm 二次确认） */}
                      <td className="px-3 py-2">
                        <Popconfirm
                          title={
                            u.status === "DISABLED"
                              ? t("systemUsers.confirm.enableTitle", { name: u.name })
                              : t("systemUsers.confirm.disableTitle", { name: u.name })
                          }
                          description={
                            u.status === "DISABLED"
                              ? t("systemUsers.confirm.enableDesc")
                              : t("systemUsers.confirm.disableDesc")
                          }
                          confirmText={
                            u.status === "DISABLED"
                              ? t("systemUsers.confirm.confirmEnable")
                              : t("systemUsers.confirm.confirmDisable")
                          }
                          onConfirm={() => handleToggleStatus(u)}
                        >
                          <button
                            type="button"
                            disabled={isCurrent}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer ${
                              u.status === "DISABLED"
                                ? "bg-hover text-fg-secondary border-line hover:bg-hover"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            } ${isCurrent ? "opacity-40 cursor-not-allowed" : ""}`}
                            title={
                              u.status === "DISABLED"
                                ? t("systemUsers.confirm.enableHint")
                                : t("systemUsers.confirm.disableHint")
                            }
                          >
                            {u.status === "DISABLED" ? (
                              <UserX className="w-3 h-3 text-fg-tertiary" />
                            ) : (
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                            )}
                            {u.status === "DISABLED"
                              ? t("systemUsers.status.DISABLED")
                              : t("systemUsers.status.ACTIVE")}
                          </button>
                        </Popconfirm>
                      </td>

                      {/* Last Login */}
                      <td className="px-3 py-2 text-[11px] text-fg-secondary">
                        {u.lastLogin || t("systemUsers.table.noLoginRecord")}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1 text-fg-secondary hover:text-fg hover:bg-hover rounded-md transition-colors cursor-pointer"
                            title={t("systemUsers.sheet.editRolesTitle")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <Popconfirm
                            title={t("systemUsers.resetPasswordTitle", { name: u.name })}
                            description={t("systemUsers.resetPasswordDesc")}
                            confirmText={t("systemUsers.confirmResetPassword")}
                            onConfirm={() => handleResetPassword(u)}
                          >
                            <button
                              type="button"
                              className="p-1 text-fg-secondary hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                              title={t("systemUsers.resetPassword")}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </Popconfirm>

                          {onDeleteUser && !isCurrent && (
                            <Popconfirm
                              title={t("systemUsers.confirm.deleteTitle", { name: u.name })}
                              description={t("systemUsers.confirm.deleteDesc")}
                              onConfirm={() => onDeleteUser(u.id)}
                            >
                              <button
                                type="button"
                                className="p-1 text-fg-tertiary hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title={t("systemUsers.sheet.deleteUserTitle")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Popconfirm>
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
        <Pagination currentPage={currentPage} totalItems={filteredUsers.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
      </div>

      {/* SideSheet for Add/Edit User */}
      <SideSheet
        id="side-sheet-system-user"
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
        }}
        title={
          editingUser
            ? t("systemUsers.sheet.editTitle", { name: editingUser.name })
            : t("systemUsers.sheet.createTitle")
        }
        description={t("systemUsers.sheet.description")}
        icon={<Shield className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
            >
              {editingUser
                ? t("systemUsers.sheet.savePermissions")
                : t("systemUsers.sheet.createAndAuthorize")}
            </button>
          </>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5 border-b border-line-subtle pb-2">
              <Users className="w-3.5 h-3.5 text-fg-secondary" />
              <span>{t("systemUsers.sheet.basicInfo")}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-secondary font-medium mb-1">
                  {t("systemUsers.sheet.nameLabel")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t("systemUsers.sheet.namePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-fg-secondary font-medium mb-1">
                  {t("systemUsers.sheet.emailLabel")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder={t("systemUsers.sheet.emailPlaceholder")}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-fg-secondary font-medium mb-1">
                  {t("systemUsers.sheet.phoneLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t("systemUsers.sheet.phonePlaceholder")}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-fg-secondary font-medium mb-1">
                  {t("systemUsers.sheet.statusLabel")}
                </label>
                <div className="w-full">
                  <ShadcnSelect
                    value={formStatus}
                    onValueChange={(val) => setFormStatus(val as "ACTIVE" | "DISABLED")}
                    options={[
                      { value: "ACTIVE", label: t("systemUsers.status.ACTIVE_FORM") },
                      { value: "DISABLED", label: t("systemUsers.status.DISABLED_FORM") },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Department Section（多选，继承部门角色权限） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5 border-b border-line-subtle pb-2">
              <Building className="w-3.5 h-3.5 text-fg-secondary" />
              <span>{t("systemUsers.sheet.departmentsTitle")}</span>
            </h3>
            <MultiSelect
              value={formDepartmentIds}
              onValueChange={setFormDepartmentIds}
              placeholder={t("systemUsers.sheet.departmentsPlaceholder")}
              options={departments.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
            />
            <p className="text-[11px] text-fg-tertiary">{t("systemUsers.sheet.departmentsHint")}</p>
            {inheritedRoleKeys.length > 0 && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  {t("systemUsers.sheet.inheritedRoles")}
                  <b>
                    {inheritedRoleKeys
                      .map((key) => getRoleName(key).split(" ")[0])
                      .join("、")}
                  </b>
                  {t("systemUsers.sheet.inheritedRolesSuffix")}
                </span>
              </div>
            )}
          </div>

          {/* Role Section（多选，非必选） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5 border-b border-line-subtle pb-2">
              <Shield className="w-3.5 h-3.5 text-fg-secondary" />
              <span>{t("systemUsers.sheet.rolesTitle")}</span>
            </h3>
            <MultiSelect
              value={formRoleKeys}
              onValueChange={setFormRoleKeys}
              placeholder={t("systemUsers.sheet.rolesPlaceholder")}
              options={roles.map((r) => ({
                value: (r.key || r.id) as string,
                label: r.name,
              }))}
            />
            <p className="text-[11px] text-fg-tertiary">{t("systemUsers.sheet.rolesHint")}</p>
          </div>

          {/* Application Permission Section（多选下拉） */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5 border-b border-line-subtle pb-2">
              <Layers className="w-3.5 h-3.5 text-fg-secondary" />
              <span>{t("systemUsers.sheet.appsTitle")}</span>
            </h3>
            <AppScopeMultiSelect
              apps={apps}
              value={formAllowedAppIds}
              onChange={setFormAllowedAppIds}
              placeholder={t("systemUsers.sheet.appsPlaceholder")}
              hint={t("systemUsers.sheet.appsHint")}
            />
          </div>
        </div>
      </SideSheet>

      {credentialsModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credentials-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line-subtle">
              <h2 id="credentials-modal-title" className="text-sm font-bold text-fg">
                {credentialsModal.titleKey === "reset"
                  ? t("systemUsers.credentials.resetTitle")
                  : t("systemUsers.credentials.createdTitle")}
              </h2>
              <p className="mt-1 text-xs text-fg-secondary">
                {t("systemUsers.credentials.hint")}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3 text-xs">
              <div>
                <div className="text-fg-tertiary font-medium mb-1">
                  {t("systemUsers.credentials.accountLabel")}
                </div>
                <div className="px-3 py-2 rounded-lg bg-subtle border border-line font-mono text-fg select-all">
                  {credentialsModal.email}
                </div>
              </div>
              <div>
                <div className="text-fg-tertiary font-medium mb-1">
                  {t("systemUsers.credentials.passwordLabel")}
                </div>
                <div className="px-3 py-2 rounded-lg bg-subtle border border-line font-mono text-fg select-all break-all">
                  {credentialsModal.password}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-line-subtle flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCredentialsModal}
                className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {t("common:actions.close")}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyCredentials()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied
                  ? t("systemUsers.credentials.copied")
                  : t("systemUsers.credentials.copyButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
