import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { RbacRole, SystemMenuItem, PaymentApp } from "../types/payment";
import { MenuPermissionTree } from "./MenuPermissionTree";

interface PermissionsViewProps {
  roles: RbacRole[];
  menus: SystemMenuItem[];
  apps: PaymentApp[];
  onSaveRole: (role: RbacRole) => void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  roles,
  menus,
  apps,
  onSaveRole,
}) => {
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id || roles[0]?.key || ""
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    setToastMessage(`角色【${updated.name}】的菜单树权限与应用权限已保存`);
    setTimeout(() => setToastMessage(null), 3200);
  };

  if (!selectedRole) {
    return (
      <div className="p-12 text-center text-sm text-zinc-400">
        暂无可配置的角色，请先在角色管理中创建角色。
      </div>
    );
  }

  const isAllApps = appCheckedIds.includes("ALL");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-6 md:p-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              权限管理 (Permission Management)
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              权限完全基于「系统菜单管理」中的菜单树进行配置：勾选菜单节点即授予该角色的访问权限，并可进一步限定可访问的出海应用。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* 左侧：角色列表 */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden lg:sticky lg:top-6">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            选择要配置的角色
          </div>
          <div className="divide-y divide-zinc-100 max-h-[480px] overflow-y-auto">
            {roleList.map((role) => {
              const roleId = role.id || role.key || "";
              const isActive = roleId === selectedRoleId;
              const menuCount = (role.permissions?.menuPermissionIds || []).length;
              return (
                <button
                  key={roleId}
                  type="button"
                  onClick={() => switchRole(role)}
                  className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                    isActive ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-amber-400" : "text-zinc-400"
                      }`}
                    />
                    <span className="font-semibold text-xs truncate">
                      {role.name}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 line-clamp-2 ${
                      isActive ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {role.description}
                  </p>
                  <div
                    className={`mt-2 flex items-center justify-between text-[10px] font-mono ${
                      isActive ? "text-zinc-400" : "text-zinc-400"
                    }`}
                  >
                    <span>已授权菜单 {menuCount} 项</span>
                    <span>{role.assignedMembersCount || role.userCount || 0} 人</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：菜单树权限 + 应用权限 */}
        <div className="space-y-5 min-w-0">
          {/* 菜单树权限 */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-zinc-700" />
                  菜单树权限配置
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
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
                  className="text-[11px] text-zinc-500 hover:text-zinc-700 font-semibold cursor-pointer"
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
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-zinc-700" />
                  应用权限配置 (Application Permissions)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
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
              <div className="py-8 text-center text-xs text-zinc-400">
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
                          ? "border-zinc-900 bg-zinc-50/90 shadow-2xs"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "border-zinc-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-900 text-xs truncate">
                            {app.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
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
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-zinc-500">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                当前配置角色：<b className="text-zinc-900">{selectedRole.name}</b>；
                已勾选菜单 {menuCheckedIds.length} 项，应用 {isAllApps ? "全部" : appCheckedIds.length} 项。
              </span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              保存权限配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
