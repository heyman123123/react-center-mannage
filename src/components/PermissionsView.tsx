import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Check,
  Save,
  AlertTriangle,
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Layers,
} from "lucide-react";
import { RbacRole, SystemMenuItem, PaymentApp } from "../types/payment";
import { MenuPermissionTree } from "./MenuPermissionTree";
import { SideSheet } from "./ui/SideSheet";
import { Popconfirm } from "./ui/Popconfirm";

interface PermissionsViewProps {
  roles: RbacRole[];
  menus: SystemMenuItem[];
  apps: PaymentApp[];
  onSaveRole: (role: RbacRole) => void;
  onDeleteRole?: (roleId: string) => void;
}

const roleIdOf = (role: RbacRole) => role.id || role.key || "";

const countMenuPermissions = (role: RbacRole) =>
  (role.permissions?.menuPermissionIds || []).length;

const countAppPermissions = (role: RbacRole, appTotal: number) => {
  const ids = role.permissions?.appPermissionIds || [];
  if (ids.includes("ALL")) return appTotal;
  return ids.length;
};

const memberCountOf = (role: RbacRole) =>
  role.assignedMembersCount ?? role.userCount ?? 0;

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  roles,
  menus,
  apps,
  onSaveRole,
  onDeleteRole,
}) => {
  const { t } = useTranslation(["rbac", "common"]);
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [formRoleName, setFormRoleName] = useState("");
  const [formRoleDesc, setFormRoleDesc] = useState("");

  const [isPermSheetOpen, setIsPermSheetOpen] = useState(false);
  const [permRole, setPermRole] = useState<RbacRole | null>(null);
  const [menuCheckedIds, setMenuCheckedIds] = useState<string[]>([]);
  const [appCheckedIds, setAppCheckedIds] = useState<string[]>([]);

  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roleList;
    return roleList.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }, [roleList, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const openPermissionSheet = (role: RbacRole) => {
    setPermRole(role);
    setMenuCheckedIds((role.permissions?.menuPermissionIds as string[]) || []);
    setAppCheckedIds((role.permissions?.appPermissionIds as string[]) || []);
    setIsPermSheetOpen(true);
  };

  const toggleApp = (appId: string) => {
    setAppCheckedIds((prev) => {
      if (prev.includes("ALL")) {
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

  const handleSavePermissions = () => {
    if (!permRole) return;
    const id = roleIdOf(permRole);
    const updated: RbacRole = {
      ...permRole,
      permissions: {
        ...permRole.permissions,
        menuPermissionIds: menuCheckedIds,
        appPermissionIds: appCheckedIds,
      },
    };
    setRoleList((prev) => prev.map((r) => (roleIdOf(r) === id ? updated : r)));
    setPermRole(updated);
    onSaveRole(updated);
    showToast(t("permissions.toast.menuPermissionsSaved", { name: updated.name }));
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setFormRoleName("");
    setFormRoleDesc("");
    setIsRoleSheetOpen(true);
  };

  const openEditRole = (role: RbacRole) => {
    setEditingRole(role);
    setFormRoleName(role.name);
    setFormRoleDesc(role.description);
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
        prev.map((r) =>
          roleIdOf(r) === roleIdOf(editingRole) ? updated : r
        )
      );
      onSaveRole(updated);
      showToast(t("permissions.toast.updated", { name: updated.name }));
    } else {
      const newRole: RbacRole = {
        id: `role_${Date.now().toString().slice(-6)}`,
        key: `role_${Date.now().toString().slice(-6)}`,
        name,
        description: formRoleDesc.trim(),
        isCustom: true,
        userCount: 0,
        assignedMembersCount: 0,
        permissions: {
          menuPermissionIds: [],
          appPermissionIds: [],
        },
      };
      setRoleList((prev) => [...prev, newRole]);
      onSaveRole(newRole);
      showToast(t("permissions.toast.created", { name: newRole.name }));
      openPermissionSheet(newRole);
    }
    setIsRoleSheetOpen(false);
  };

  const handleDeleteRole = (role: RbacRole) => {
    const id = roleIdOf(role);
    setRoleList((prev) => prev.filter((r) => roleIdOf(r) !== id));
    if (onDeleteRole) onDeleteRole(id);
    if (permRole && roleIdOf(permRole) === id) {
      setIsPermSheetOpen(false);
      setPermRole(null);
    }
    showToast(t("permissions.toast.deleted", { name: role.name }));
  };

  const handleRefresh = () => {
    setRoleList(roles);
    showToast(t("permissions.toast.refreshed"));
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  const isAllApps = appCheckedIds.includes("ALL");
  const appScopeLabel = isAllApps
    ? t("permissions.appCountAll")
    : t("permissions.appCountUnit", { count: appCheckedIds.length });

  if (roleList.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-fg-tertiary space-y-3">
        <div>{t("permissions.empty.noRoles")}</div>
        <button
          type="button"
          onClick={openCreateRole}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("permissions.addRole")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("common:actions.refresh")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("common:actions.refresh")}
          </button>

          <button
            type="button"
            onClick={openCreateRole}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("permissions.addRole")}
          </button>
        </div>

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
      </div>

      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2 flex items-start gap-2 text-xs text-fg-secondary">
        <KeyRound className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>{t("permissions.infoBanner")}</span>
      </div>

      <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-subtle border-b border-line text-left text-fg-secondary">
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                  {t("permissions.table.name")}
                </th>
                <th className="px-3 py-2.5 font-semibold min-w-[160px]">
                  {t("permissions.table.description")}
                </th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-center">
                  {t("permissions.table.menuCount")}
                </th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-center">
                  {t("permissions.table.appCount")}
                </th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-center">
                  {t("permissions.table.memberCount")}
                </th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-right">
                  {t("permissions.table.operations")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-fg-tertiary"
                  >
                    {t("common:status.noMatch")}
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => {
                  const id = roleIdOf(role);
                  const menuCount = countMenuPermissions(role);
                  const appCount = countAppPermissions(role, apps.length);
                  const isAllAppScope = (
                    role.permissions?.appPermissionIds || []
                  ).includes("ALL");
                  const members = memberCountOf(role);

                  return (
                    <tr
                      key={id}
                      onClick={() => openPermissionSheet(role)}
                      className="border-b border-line-subtle last:border-b-0 hover:bg-hover/60 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-3 font-semibold text-fg whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-subtle border border-line-subtle flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-fg-secondary" />
                          </span>
                          {role.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-fg-secondary max-w-xs">
                        <span className="line-clamp-2">{role.description || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-fg-secondary">
                        {t("permissions.menuCountUnit", { count: menuCount })}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-fg-secondary">
                        {isAllAppScope
                          ? t("permissions.appCountAll")
                          : t("permissions.appCountUnit", { count: appCount })}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-fg-secondary">
                        {t("permissions.memberCountUnit", { count: members })}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openPermissionSheet(role)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          >
                            {t("permissions.configurePermissions")}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditRole(role)}
                            className="p-1 text-fg-secondary hover:text-fg hover:bg-hover rounded transition-colors cursor-pointer"
                            title={t("common:actions.edit")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <Popconfirm
                            title={t("permissions.confirm.deleteTitle", {
                              name: role.name,
                            })}
                            description={t("permissions.confirm.deleteDesc")}
                            onConfirm={() => handleDeleteRole(role)}
                          >
                            <button
                              type="button"
                              className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title={t("common:actions.delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Popconfirm>
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

      {/* 权限配置 SideSheet */}
      <SideSheet
        id="side-sheet-role-permissions"
        isOpen={isPermSheetOpen}
        onClose={() => setIsPermSheetOpen(false)}
        title={
          permRole
            ? t("permissions.permissionSheet.title", { name: permRole.name })
            : t("permissions.configurePermissions")
        }
        description={t("permissions.permissionSheet.description")}
        icon={<KeyRound className="w-5 h-5 text-blue-600" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsPermSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer text-xs"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSavePermissions}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer text-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {t("permissions.permissionSheet.save")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  {t("permissions.menuTree")}
                </h3>
                <p className="text-fg-secondary mt-1">
                  {t("permissions.permissionSheet.menuTreeHint")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds(menus.map((m) => m.id))}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  {t("common:actions.selectAll")}
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds([])}
                  className="text-[11px] text-fg-secondary hover:text-fg font-semibold cursor-pointer"
                >
                  {t("common:actions.clear")}
                </button>
              </div>
            </div>
            <MenuPermissionTree
              menus={menus}
              checkedIds={menuCheckedIds}
              onChange={setMenuCheckedIds}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  {t("permissions.appScope")}
                </h3>
                <p className="text-fg-secondary mt-1">
                  {t("permissions.permissionSheet.appScopeHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAllApps}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer shrink-0"
              >
                {isAllApps
                  ? t("permissions.permissionSheet.deselectAllApps")
                  : t("permissions.selectAllApps")}
              </button>
            </div>

            {apps.length === 0 ? (
              <div className="py-8 text-center text-fg-tertiary">
                {t("permissions.empty.noApps")}
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

          <div className="flex items-start gap-2 p-3 rounded border border-line-subtle bg-subtle/50 text-fg-secondary">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {t("permissions.permissionSheet.summary", {
                menuCount: menuCheckedIds.length,
                appScope: appScopeLabel,
              })}
            </span>
          </div>
        </div>
      </SideSheet>

      {/* 新增 / 编辑角色 SideSheet */}
      <SideSheet
        id="side-sheet-role-crud"
        isOpen={isRoleSheetOpen}
        onClose={() => setIsRoleSheetOpen(false)}
        title={
          editingRole
            ? t("permissions.form.editTitle", { name: editingRole.name })
            : t("permissions.form.createTitle")
        }
        description={
          editingRole
            ? t("permissions.form.editDescription")
            : t("permissions.form.createHint")
        }
        icon={<ShieldCheck className="w-5 h-5 text-amber-500" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsRoleSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer text-xs"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmitRole}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer text-xs"
            >
              {editingRole
                ? t("permissions.form.saveRole")
                : t("permissions.form.createRole")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("permissions.form.name")}{" "}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t("permissions.form.namePlaceholder")}
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
              placeholder={t("permissions.form.descPlaceholder")}
              value={formRoleDesc}
              onChange={(e) => setFormRoleDesc(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-line focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
