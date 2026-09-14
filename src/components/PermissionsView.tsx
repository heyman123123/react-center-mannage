import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  KeyRound,
  ShieldCheck,
  Users,
  Layers,
  CheckCircle2,
  Check,
  Save,
  AlertTriangle,
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  RefreshCw,
  ArrowRightLeft,
  Search,
  X,
} from "lucide-react";
import { RbacRole, SystemMenuItem, PaymentApp } from "../types/payment";
import { MenuPermissionTree } from "./MenuPermissionTree";
import { ContextMenu } from "./ui/ContextMenu";
import { SideSheet } from "./ui/SideSheet";
import { Popconfirm } from "./ui/Popconfirm";

interface PermissionsViewProps {
  roles: RbacRole[];
  menus: SystemMenuItem[];
  apps: PaymentApp[];
  onSaveRole: (role: RbacRole) => void;
  onDeleteRole?: (roleId: string) => void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  roles,
  menus,
  apps,
  onSaveRole,
  onDeleteRole,
}) => {
  const { t } = useTranslation(["rbac", "common"]);
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id || roles[0]?.key || ""
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 角色表单（新增 / 编辑）
  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [formRoleName, setFormRoleName] = useState("");
  const [formRoleDesc, setFormRoleDesc] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState<string>("");
  // 待删除角色（右键 → 二次确认）
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RbacRole | null>(null);

  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roleList;
    return roleList.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)
    );
  }, [roleList, searchQuery]);

  const selectedRole = useMemo(
    () => roleList.find((r) => (r.id || r.key) === selectedRoleId) || roleList[0],
    [roleList, selectedRoleId]
  );

  const [menuCheckedIds, setMenuCheckedIds] = useState<string[]>(
    () => (selectedRole?.permissions?.menuPermissionIds as string[]) || []
  );
  const [appCheckedIds, setAppCheckedIds] = useState<string[]>(
    () => (selectedRole?.permissions?.appPermissionIds as string[]) || []
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const switchRole = (role: RbacRole) => {
    setSelectedRoleId(role.id || role.key || "");
    setMenuCheckedIds((role.permissions?.menuPermissionIds as string[]) || []);
    setAppCheckedIds((role.permissions?.appPermissionIds as string[]) || []);
    setToastMessage(null);
  };

  const toggleApp = (appId: string) => {
    setAppCheckedIds((prev) => {
      if (prev.includes("ALL")) {
        // 从全选降级为除该应用外的其他应用
        return apps.map((a) => a.id).filter((id) => id !== appId);
      }
      const next = prev.includes(appId)
        ? prev.filter((id) => id !== appId)
        : [...prev, appId];
      if (next.length === apps.length) return ["ALL", ...apps.map((a) => a.id)];
      return next;
    });
  };

  const toggleAllApps = () => {
    setAppCheckedIds((prev) =>
      prev.includes("ALL") ? [] : ["ALL", ...apps.map((a) => a.id)]
    );
  };

  const handleSave = () => {
    if (!selectedRole) return;
    const updated: RbacRole = {
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        menuPermissionIds: menuCheckedIds,
        appPermissionIds: appCheckedIds,
      },
    };
    setRoleList((prev) =>
      prev.map((r) => ((r.id || r.key) === selectedRoleId ? updated : r))
    );
    onSaveRole(updated);
    showToast(t("permissions.toast.menuPermissionsSaved", { name: updated.name }));
  };

  // ===== 角色 CRUD（右键菜单触发）=====

  const openCreateRole = () => {
    setEditingRole(null);
    setFormRoleName("");
    setFormRoleDesc("");
    setCopyFromRoleId(selectedRole?.id || selectedRole?.key || "");
    setIsRoleSheetOpen(true);
  };

  const openEditRole = (role: RbacRole) => {
    setEditingRole(role);
    setFormRoleName(role.name);
    setFormRoleDesc(role.description);
    setCopyFromRoleId("");
    setIsRoleSheetOpen(true);
  };

  const handleSubmitRole = () => {
    const name = formRoleName.trim();
    if (!name) {
      showToast(t("permissions.toast.nameRequired"));
      return;
    }

    if (editingRole) {
      const updated: RbacRole = {
        ...editingRole,
        name,
        description: formRoleDesc.trim(),
      };
      setRoleList((prev) =>
        prev.map((r) => ((r.id || r.key) === (editingRole.id || editingRole.key) ? updated : r))
      );
      onSaveRole(updated);
      showToast(`角色【${updated.name}】已更新`);
    } else {
      const copyFrom = roleList.find((r) => (r.id || r.key) === copyFromRoleId);
      const newRole: RbacRole = {
        id: `role_${Date.now().toString().slice(-6)}`,
        key: `role_${Date.now().toString().slice(-6)}`,
        name,
        description: formRoleDesc.trim() || "自定义权限角色",
        isCustom: true,
        userCount: 0,
        assignedMembersCount: 0,
        permissions: {
          ...(copyFrom?.permissions || {}),
          menuPermissionIds: copyFrom ? [...(copyFrom.permissions?.menuPermissionIds || [])] : [],
          appPermissionIds: copyFrom ? [...(copyFrom.permissions?.appPermissionIds || [])] : [],
        },
      };
      setRoleList((prev) => [...prev, newRole]);
      onSaveRole(newRole);
      // 切换到新角色
      setSelectedRoleId(newRole.id || newRole.key || "");
      setMenuCheckedIds((newRole.permissions?.menuPermissionIds as string[]) || []);
      setAppCheckedIds((newRole.permissions?.appPermissionIds as string[]) || []);
      showToast(`角色【${newRole.name}】已创建，可在右侧配置菜单与应用权限`);
    }
    setIsRoleSheetOpen(false);
  };

  const handleDeleteRole = (role: RbacRole) => {
    const roleId = role.id || role.key || "";
    setRoleList((prev) => prev.filter((r) => (r.id || r.key) !== roleId));
    if (onDeleteRole) onDeleteRole(roleId);
    if (selectedRoleId === roleId) {
      const next = roleList.filter((r) => (r.id || r.key) !== roleId)[0];
      if (next) {
        setSelectedRoleId(next.id || next.key || "");
        setMenuCheckedIds((next.permissions?.menuPermissionIds as string[]) || []);
        setAppCheckedIds((next.permissions?.appPermissionIds as string[]) || []);
      } else {
        setSelectedRoleId("");
        setMenuCheckedIds([]);
        setAppCheckedIds([]);
      }
    }
    showToast(`角色【${role.name}】已删除`);
  };

  const handleRefresh = () => {
    setRoleList(roles);
    setToastMessage(t("permissions.toast.refreshed"));
  };

  if (roleList.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-fg-tertiary space-y-3">
        <div>暂无可配置的角色，请先创建角色。</div>
        <button
          type="button"
          onClick={openCreateRole}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          新增角色
        </button>
      </div>
    );
  }

  if (!selectedRole) {
    return (
      <div className="p-12 text-center text-sm text-fg-tertiary">
        暂无可配置的角色，请先在角色管理中创建角色。
      </div>
    );
  }

  const isAllApps = appCheckedIds.includes("ALL");

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-3 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 顶部操作栏（截图风格） ===== */}
      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("common:actions.refresh")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>

          <button
            type="button"
            onClick={openCreateRole}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增角色
          </button>

          <button
            type="button"
            disabled
            className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="先在右侧列表中选择要删除的角色"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>

          <button
            type="button"
            disabled
            className="px-3 py-1.5 border border-emerald-200 text-emerald-600 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="转移角色权限"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            转移
          </button>

          <div className="w-px h-5 bg-hover mx-1" />

          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            保存权限配置
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative w-56">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("permissions.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            搜索
          </button>
        </div>
      </div>

      {/* ===== 说明卡片（精简） ===== */}
      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2 flex items-start gap-2 text-xs text-fg-secondary">
        <KeyRound className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          <strong className="text-fg">权限管理 (Permission Management)</strong>
          ：权限完全基于「系统菜单管理」中的菜单树进行配置 — 勾选菜单节点即授予该角色的访问权限，并可进一步限定可访问的出海应用。在右侧角色上<strong>右键</strong>可新增 / 编辑 / 删除角色。
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 items-start">
        {/* 左侧：{t("permissions.roleList")}（右键增删改查） */}
        <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden lg:sticky lg:top-4">
          <div className="px-3 py-2 bg-subtle border-b border-line text-xs font-semibold text-fg-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              选择要配置的角色
            </span>
            <button
              type="button"
              onClick={openCreateRole}
              className="flex items-center gap-0.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold transition-colors cursor-pointer"
              title={t("permissions.addRole")}
            >
              <Plus className="w-3 h-3" />
              新增角色
            </button>
          </div>
          <div className="p-2.5 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
            {filteredRoles.map((role) => {
              const roleId = role.id || role.key || "";
              const isActive = roleId === selectedRoleId;
              const menuCount = (role.permissions?.menuPermissionIds || []).length;
              return (
                <ContextMenu
                  key={roleId}
                  items={[
                    {
                      key: "add",
                      label: "新增角色",
                      icon: <UserPlus className="w-3.5 h-3.5" />,
                      onClick: openCreateRole,
                    },
                    {
                      key: "edit",
                      label: "编辑角色",
                      icon: <Edit2 className="w-3.5 h-3.5" />,
                      onClick: () => openEditRole(role),
                    },
                    {
                      key: "delete",
                      label: "删除角色",
                      icon: <Trash2 className="w-3.5 h-3.5" />,
                      danger: true,
                      onClick: () => setPendingDeleteRole(role),
                    },
                    {
                      key: "refresh",
                      label: "刷新列表",
                      icon: <RefreshCw className="w-3.5 h-3.5" />,
                      onClick: () => {
                        setRoleList(roles);
                        setToastMessage(t("permissions.toast.refreshed"));
                      },
                    },
                  ]}
                  trigger={
                    <button
                      type="button"
                      onClick={() => switchRole(role)}
                      className={`relative w-full text-left px-3.5 py-3 rounded border transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-50/90 border-blue-200 shadow-sm"
                          : "bg-surface border-line hover:border-blue-300/60 hover:shadow-card"
                      }`}
                      title="右键可新增 / 编辑 / 删除角色"
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full" />
                      )}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? "bg-blue-500" : "bg-subtle border border-line-subtle"
                          }`}
                        >
                          <ShieldCheck
                            className={`w-4 h-4 ${
                              isActive ? "text-white" : "text-fg-secondary"
                            }`}
                          />
                        </span>
                        <span className="font-semibold text-xs truncate">
                          {role.name}
                        </span>
                        {isActive && (
                          <span className="ml-auto text-[9px] font-bold bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                            当前
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] mt-1.5 line-clamp-2 leading-relaxed text-fg-secondary`}
                      >
                        {role.description}
                      </p>
                      <div
                        className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
                          isActive
                            ? "border-blue-100 text-blue-700"
                            : "border-line-subtle text-fg-tertiary"
                        }`}
                      >
                        <span>已授权菜单 {menuCount} 项</span>
                        <span>{role.assignedMembersCount || role.userCount || 0} 人</span>
                      </div>
                    </button>
                  }
                />
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-line-subtle bg-subtle/60 text-[10px] text-fg-tertiary flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            右键角色可新增 / 编辑 / 删除
          </div>
        </div>

        {/* 右侧：{t("permissions.menuTree")} + 应用权限 */}
        <div className="space-y-3 min-w-0">
          {/* {t("permissions.menuTree")} */}
          <div className="bg-surface border border-line rounded-md shadow-card p-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  {t("permissions.menuTree")}配置
                </h3>
                <p className="text-xs text-fg-secondary mt-1">
                  勾选该角色可访问的菜单节点（与左侧侧边栏 / 菜单管理数据一致，父子联动）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds(menus.map((m) => m.id))}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  全选
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds([])}
                  className="text-[11px] text-fg-secondary hover:text-fg-secondary font-semibold cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>

            <MenuPermissionTree
              menus={menus}
              checkedIds={menuCheckedIds}
              onChange={setMenuCheckedIds}
            />
          </div>

          {/* 应用权限 */}
          <div className="bg-surface border border-line rounded-md shadow-card p-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  应用权限配置 (Application Permissions)
                </h3>
                <p className="text-xs text-fg-secondary mt-1">
                  限定该角色可管理/查看的接入应用范围
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAllApps}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                {isAllApps ? "取消全部应用" : "授权全部应用"}
              </button>
            </div>

            {apps.length === 0 ? (
              <div className="py-8 text-center text-xs text-fg-tertiary">
                暂无可授权应用，请先在「接入应用管理」中创建应用
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {apps.map((app) => {
                  const isChecked = isAllApps || appCheckedIds.includes(app.id);
                  return (
                    <div
                      key={app.id}
                      onClick={() => toggleApp(app.id)}
                      className={`p-3 rounded border transition-all cursor-pointer flex items-start justify-between ${
                        isChecked
                          ? "border-blue-200 bg-blue-50/70 shadow-sm"
                          : "border-line bg-surface hover:border-blue-300/60"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "border-line bg-surface"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-fg text-xs truncate">
                            {app.name}
                          </div>
                          <div className="text-[10px] text-fg-tertiary font-mono mt-0.5">
                            {app.code} • {app.defaultCurrency}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-300 shrink-0">
                        {app.environment}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 保存区 */}
          <div className="bg-surface border border-line rounded-md shadow-card p-3 flex items-center justify-between gap-2">
            <div className="flex items-start gap-2 text-xs text-fg-secondary">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                当前配置角色：<b className="text-fg">{selectedRole.name}</b>；
                已勾选菜单 {menuCheckedIds.length} 项，应用 {isAllApps ? "全部" : appCheckedIds.length} 项。
              </span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              保存权限配置
            </button>
          </div>
        </div>
      </div>

      {/* 右键删除角色的二次确认弹层 */}
      {pendingDeleteRole && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-primary/30 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPendingDeleteRole(null)}
        >
          <div
            className="w-80 rounded border border-line bg-surface p-3 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <div className="text-sm font-bold text-fg">
                  删除角色「{pendingDeleteRole.name}」？
                </div>
                <div className="text-[11px] text-fg-secondary mt-1 leading-relaxed">
                  删除后该角色将不再可用，被该角色授权的用户将失去对应权限，该操作不可恢复。
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setPendingDeleteRole(null)}
                className="px-3 py-1.5 rounded text-[11px] font-medium text-fg-secondary hover:bg-hover transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteRole(pendingDeleteRole);
                  setPendingDeleteRole(null);
                }}
                className="px-3.5 py-1.5 rounded text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增 / 编辑角色 SideSheet */}
      <SideSheet
        id="side-sheet-role-crud"
        isOpen={isRoleSheetOpen}
        onClose={() => setIsRoleSheetOpen(false)}
        title={editingRole ? `编辑角色: ${editingRole.name}` : "新增权限角色"}
        description={
          editingRole
            ? "修改角色基础信息，权限配置请在右侧菜单树 / 应用权限中调整。"
            : t("permissions.form.createHint")
        }
        icon={<ShieldCheck className="w-5 h-5 text-amber-500" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsRoleSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitRole}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
            >
              {editingRole ? "保存角色" : "创建角色"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("permissions.form.name")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="如：海外运营专员"
              value={formRoleName}
              onChange={(e) => setFormRoleName(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("permissions.form.description")}
            </label>
            <textarea
              rows={3}
              placeholder="说明该角色的职责与权限范围..."
              value={formRoleDesc}
              onChange={(e) => setFormRoleDesc(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
          {!editingRole && (
            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                复制现有角色权限（可选）
              </label>
              <select
                value={copyFromRoleId}
                onChange={(e) => setCopyFromRoleId(e.target.value)}
                className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line cursor-pointer"
              >
                <option value="">不复制（从空权限开始）</option>
                {roleList.map((r) => (
                  <option key={r.id || r.key} value={r.id || r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </SideSheet>
    </div>
  );
};
