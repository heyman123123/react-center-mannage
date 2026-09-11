import React, { useMemo, useState } from "react";
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
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id || roles[0]?.key || ""
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 角色表单（新增 / 编辑）
  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [formRoleName, setFormRoleName] = useState("");
  const [formRoleDesc, setFormRoleDesc] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState<string>("");
  // 待删除角色（右键 → 二次确认）
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RbacRole | null>(null);

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
    showToast(`角色【${updated.name}】的菜单树权限与应用权限已保存`);
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
      showToast("角色名称不能为空");
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

  if (roleList.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-fg-tertiary space-y-3">
        <div>暂无可配置的角色，请先创建角色。</div>
        <button
          type="button"
          onClick={openCreateRole}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-6 md:p-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-fg">
              权限管理 (Permission Management)
            </h1>
            <p className="text-xs text-fg-secondary mt-0.5">
              权限完全基于「系统菜单管理」中的菜单树进行配置：勾选菜单节点即授予该角色的访问权限，并可进一步限定可访问的出海应用。在左侧角色上<strong>右键</strong>可新增 / 编辑 / 删除角色。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* 左侧：角色列表（右键增删改查） */}
        <div className="bg-surface border border-line rounded-2xl shadow-2xs overflow-hidden lg:sticky lg:top-6">
          <div className="px-4 py-3 bg-subtle border-b border-line text-xs font-semibold text-fg-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              选择要配置的角色
            </span>
            <button
              type="button"
              onClick={openCreateRole}
              className="flex items-center gap-0.5 px-2 py-1 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
              title="新增角色（也可右键角色列表空白处）"
            >
              <Plus className="w-3 h-3" />
              新增角色
            </button>
          </div>
          <div className="divide-y divide-line-subtle max-h-[480px] overflow-y-auto">
            {roleList.map((role) => {
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
                  ]}
                  trigger={
                    <button
                      type="button"
                      onClick={() => switchRole(role)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-subtle"
                      }`}
                      title="右键可新增 / 编辑 / 删除角色"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-amber-400" : "text-fg-tertiary"
                          }`}
                        />
                        <span className="font-semibold text-xs truncate">
                          {role.name}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-1 line-clamp-2 ${
                          isActive ? "text-fg-tertiary" : "text-fg-secondary"
                        }`}
                      >
                        {role.description}
                      </p>
                      <div
                        className={`mt-2 flex items-center justify-between text-[10px] font-mono ${
                          isActive ? "text-fg-tertiary" : "text-fg-tertiary"
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
          <div className="px-4 py-2 border-t border-line-subtle bg-subtle/60 text-[10px] text-fg-tertiary flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            右键角色可新增 / 编辑 / 删除
          </div>
        </div>

        {/* 右侧：菜单树权限 + 应用权限 */}
        <div className="space-y-5 min-w-0">
          {/* 菜单树权限 */}
          <div className="bg-surface border border-line rounded-2xl shadow-2xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-fg-secondary" />
                  菜单树权限配置
                </h3>
                <p className="text-xs text-fg-secondary mt-0.5">
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
          <div className="bg-surface border border-line rounded-2xl shadow-2xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-fg-secondary" />
                  应用权限配置 (Application Permissions)
                </h3>
                <p className="text-xs text-fg-secondary mt-0.5">
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
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                        isChecked
                          ? "border-primary bg-subtle/90 shadow-2xs"
                          : "border-line bg-surface hover:border-line"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground"
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
          <div className="bg-surface border border-line rounded-2xl shadow-2xs p-4 flex items-center justify-between gap-3">
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
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer shrink-0"
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
            className="w-80 rounded-2xl border border-line bg-surface p-4 shadow-2xl animate-in zoom-in-95"
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
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-fg-secondary hover:bg-hover transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteRole(pendingDeleteRole);
                  setPendingDeleteRole(null);
                }}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-card transition-colors cursor-pointer"
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
            : "创建后可立即在右侧为该角色配置菜单树权限与应用权限；可复制现有角色权限作为起点。"
        }
        icon={<ShieldCheck className="w-5 h-5 text-amber-500" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsRoleSheetOpen(false)}
              className="px-4 py-2 border border-line text-fg-secondary rounded-xl hover:bg-hover font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitRole}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer"
            >
              {editingRole ? "保存角色" : "创建角色"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              角色名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="如：海外运营专员"
              value={formRoleName}
              onChange={(e) => setFormRoleName(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded-xl text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              角色描述
            </label>
            <textarea
              rows={3}
              placeholder="说明该角色的职责与权限范围..."
              value={formRoleDesc}
              onChange={(e) => setFormRoleDesc(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded-xl text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
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
                className="w-full p-2 bg-surface border border-line rounded-xl text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line cursor-pointer"
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
