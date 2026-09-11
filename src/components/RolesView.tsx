import React, { useState } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  Search,
  CheckCircle2,
  FolderTree,
  Layers,
  Shield,
  RefreshCw,
  ListFilter,
  KeyRound,
} from "lucide-react";
import { RbacRole, SystemMenuItem, PaymentApp } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { MenuPermissionTree } from "./MenuPermissionTree";
import { Popconfirm } from "./ui/Popconfirm";
import { ContextMenu } from "./ui/ContextMenu";

interface RolesViewProps {
  roles: RbacRole[];
  menus: SystemMenuItem[];
  apps: PaymentApp[];
  onSaveRole: (role: RbacRole) => void;
  onDeleteRole?: (roleId: string) => void;
}

type RoleCategory = "ALL" | "BUILTIN" | "CUSTOM";

export const RolesView: React.FC<RolesViewProps> = ({ roles, menus, apps, onSaveRole, onDeleteRole }) => {
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<RoleCategory>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<RbacRole | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMenuIds, setFormMenuIds] = useState<string[]>([]);
  const [formAppIds, setFormAppIds] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const roleIdentifier = (r: RbacRole) => r.id || r.key || "";

  const handleOpenAdd = () => {
    setSelectedRole(null);
    setFormName("");
    setFormDescription("");
    setFormMenuIds(menus.map((m) => m.id));
    setFormAppIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: RbacRole) => {
    setSelectedRole(r);
    setFormName(r.name);
    setFormDescription(r.description);
    setFormMenuIds((r.permissions?.menuPermissionIds as string[]) || []);
    setFormAppIds((r.permissions?.appPermissionIds as string[]) || []);
    setIsModalOpen(true);
  };

  const handleDuplicateRole = (r: RbacRole) => {
    const generatedId = `role_${Date.now().toString().slice(-6)}`;
    const duplicated: RbacRole = {
      ...r,
      id: generatedId,
      key: generatedId,
      name: `${r.name} (复制角色)`,
      description: `基于【${r.name}】克隆自定义创建的权限策略`,
      isCustom: true,
      assignedMembersCount: 0,
      permissions: { ...r.permissions },
    };
    setRoleList([duplicated, ...roleList]);
    onSaveRole(duplicated);
    showToast(`角色【${duplicated.name}】已成功克隆！`);
  };

  const handleDelete = (r: RbacRole) => {
    const name = r.name;
    setRoleList((prev) => prev.filter((item) => roleIdentifier(item) !== roleIdentifier(r)));
    if (onDeleteRole) onDeleteRole(roleIdentifier(r));
    showToast(`角色【${name}】已删除`);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setRoleList((prev) => prev.filter((item) => !selectedIds.includes(roleIdentifier(item))));
    if (onDeleteRole) selectedIds.forEach((id) => onDeleteRole(id));
    setSelectedIds([]);
    showToast(`已删除 ${selectedIds.length} 个角色`);
  };

  const toggleAppInForm = (appId: string) => {
    setFormAppIds((prev) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast("请填写角色名称");
      return;
    }

    if (selectedRole) {
      const updated: RbacRole = {
        ...selectedRole,
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: {
          ...selectedRole.permissions,
          menuPermissionIds: formMenuIds,
          appPermissionIds: formAppIds,
        } as any,
      };
      const id = roleIdentifier(selectedRole);
      setRoleList((prev) =>
        prev.map((item) => (roleIdentifier(item) === id ? updated : item))
      );
      onSaveRole(updated);
      showToast(`角色【${updated.name}】权限策略已成功更新！`);
    } else {
      const generatedId = `role_${Date.now().toString().slice(-6)}`;
      const newRole: RbacRole = {
        id: generatedId,
        key: generatedId,
        name: formName.trim(),
        description: formDescription.trim(),
        isCustom: true,
        assignedMembersCount: 0,
        permissions: {
          menuPermissionIds: formMenuIds,
          appPermissionIds: formAppIds,
        } as any,
      };
      setRoleList((prev) => [...prev, newRole]);
      onSaveRole(newRole);
      showToast(`新系统角色【${newRole.name}】创建成功！`);
    }
    setIsModalOpen(false);
  };

  const isBuiltin = (r: RbacRole) => !r.isCustom;

  const filteredRoles = roleList.filter((r) => {
    const matchesCategory =
      category === "ALL" ||
      (category === "BUILTIN" && isBuiltin(r)) ||
      (category === "CUSTOM" && r.isCustom);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      roleIdentifier(r).toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const categoryCounts = {
    ALL: roleList.length,
    BUILTIN: roleList.filter((r) => isBuiltin(r)).length,
    CUSTOM: roleList.filter((r) => r.isCustom).length,
  };

  const totalAssignedStaff = roleList.reduce(
    (acc, curr) => acc + (curr.assignedMembersCount || 0),
    0
  );

  const isFormAllApps = formAppIds.includes("ALL");

  const categories: { key: RoleCategory; label: string }[] = [
    { key: "ALL", label: "全部角色" },
    { key: "BUILTIN", label: "内置角色" },
    { key: "CUSTOM", label: "自定义角色" },
  ];

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="flex gap-3 items-start font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 左侧：角色分类 ===== */}
      <div className="w-48 shrink-0 bg-surface border border-line rounded-xl shadow-card overflow-hidden lg:sticky lg:top-4">
        <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-fg-secondary" />
            类型
          </span>
        </div>
        <div className="p-2 space-y-0.5">
          {categories.map((c) => (
            <ContextMenu
              key={c.key}
              items={[
                { key: "add", label: "新增角色", onClick: handleOpenAdd },
                {
                  key: "refresh", label: "刷新列表", onClick: () => {
                    setRoleList(roles);
                    showToast("角色列表已刷新");
                  },
                },
              ]}
              trigger={
            <button
              type="button"
              onClick={() => setCategory(c.key)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                category === c.key
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-fg-secondary hover:bg-hover"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {c.key === "BUILTIN" ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : c.key === "CUSTOM" ? (
                  <KeyRound className="w-3.5 h-3.5" />
                ) : (
                  <ListFilter className="w-3.5 h-3.5" />
                )}
                <span>{c.label}</span>
              </span>
              <span className={`text-[10px] font-mono ${category === c.key ? "text-fg-tertiary" : "text-fg-tertiary"}`}>
                {categoryCounts[c.key]}
              </span>
            </button>
              }
            />
          ))}
        </div>

        <div className="px-3 py-2.5 border-t border-line-subtle">
          <div className="text-[11px] text-fg-secondary leading-relaxed">
            当前共 <b className="text-fg font-mono">{roleList.length}</b> 个角色，
            分配 <b className="text-fg font-mono">{totalAssignedStaff}</b> 位成员
          </div>
        </div>
      </div>

      {/* ===== 右侧：角色列表 ===== */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 标题与工具栏 */}
        <div className="bg-surface border border-line rounded-xl shadow-card px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-fg">
            <span>角色列表</span>
            <span className="text-fg-tertiary font-normal text-xs">
              （{categories.find((c) => c.key === category)?.label}）
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedIds([]);
                showToast("角色数据已刷新");
              }}
              className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="刷新角色数据"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增
            </button>

            {selectedIds.length === 0 ? (
              <button
                type="button"
                disabled
                className="px-2.5 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            ) : (
              <Popconfirm
                title={`删除选中的 ${selectedIds.length} 个角色？`}
                description="删除后这些角色将不再可用，被授权用户将失去对应权限。"
                onConfirm={handleBatchDelete}
              >
                <button
                  type="button"
                  className="px-2.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </Popconfirm>
            )}
          </div>
        </div>

        {/* 表格 */}
        <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line-subtle">
            <span className="text-xs text-fg-secondary">
              共 <b className="text-fg font-mono">{filteredRoles.length}</b> 个角色
            </span>
            <div className="relative w-56">
              <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索名称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && filteredRoles.every((r) => selectedIds.includes(roleIdentifier(r)))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredRoles.map((r) => roleIdentifier(r)) : [])
                      }
                      className="rounded text-fg"
                    />
                  </th>
                  <th className="py-2.5 px-3">角色名称</th>
                  <th className="py-2.5 px-3">标识 (Key)</th>
                  <th className="py-2.5 px-3">权限说明</th>
                  <th className="py-2.5 px-3 text-center">成员数</th>
                  <th className="py-2.5 px-3 text-center">数据范围</th>
                  <th className="py-2.5 px-3 text-center">菜单权限</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-fg-secondary">
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-fg-tertiary">
                      暂无角色数据
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => {
                    const rid = roleIdentifier(role);
                    const menuCount = (role.permissions?.menuPermissionIds || []).length;
                    const appPerms = (role.permissions?.appPermissionIds || []) as string[];
                    const isSuperAdmin = rid.includes("ADMIN") || rid.includes("SUPER");
                    const scopeLabel =
                      role.dataScope === "ALL_TENANTS"
                        ? "全集团"
                        : role.dataScope === "READ_ONLY_MASKED"
                        ? "只读脱敏"
                        : role.dataScope
                        ? "指定范围"
                        : "—";

                    return (
                      <tr key={rid} className="hover:bg-subtle/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(rid)}
                            onChange={(e) =>
                              setSelectedIds((prev) =>
                                e.target.checked ? [...prev, rid] : prev.filter((id) => id !== rid)
                              )
                            }
                            className="rounded text-fg"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg ${
                                isSuperAdmin ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary"
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-semibold text-fg">{role.name}</div>
                              <div className="text-[10px] text-fg-tertiary flex items-center gap-1">
                                {role.isCustom ? (
                                  <span className="px-1 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-medium">
                                    自定义
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-medium">
                                    内置
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-fg-secondary">{rid}</td>
                        <td className="py-2.5 px-3 text-fg-secondary max-w-[260px]">
                          <span className="line-clamp-2">{role.description}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-fg-secondary font-mono">
                            <Users className="w-3 h-3 text-fg-tertiary" />
                            {role.assignedMembersCount || 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-hover text-fg-secondary border border-line">
                            {scopeLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-fg-secondary">
                            <FolderTree className="w-3 h-3 text-indigo-500" />
                            <span className="font-mono">{menuCount}/{menus.length}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRole(role)}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-[11px] font-medium cursor-pointer"
                              title="复制为新角色"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(role)}
                              className="px-2 py-1 text-fg-secondary hover:bg-hover rounded-md text-[11px] font-medium cursor-pointer"
                              title="编辑角色与权限"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <Popconfirm
                              title={`删除角色「${role.name}」？`}
                              description="删除后该角色将不再可用，被该角色授权的用户将失去对应权限。"
                              onConfirm={() => handleDelete(role)}
                            >
                              <button
                                type="button"
                                className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-md text-[11px] font-medium cursor-pointer"
                                title="删除角色"
                              >
                                <Trash2 className="w-3 h-3" />
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
      </div>

      {/* Add / Edit Role SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-role-edit"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRole ? `配置角色权限: ${selectedRole.name}` : "新建系统角色"}
        description="配置角色基本信息，并按菜单树勾选该角色可访问的菜单节点，以及可操作的应用范围。"
        icon={<ShieldCheck className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold shadow-card"
            >
              {selectedRole ? "保存角色权限配置" : "确认创建角色"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="py-1 space-y-5 text-xs">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">角色名称 (中文):</label>
            <input
              type="text"
              required
              placeholder="如：海外合规与风险专员"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-fg-secondary block mb-1">岗位职能与职责描述:</label>
            <textarea
              rows={2}
              required
              placeholder="如：负责审核海外高风险扣款与抗辩拒付，查阅终端用户登录流水..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* 菜单树权限 */}
          <div>
            <div className="font-bold text-fg mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-fg-secondary" />
                菜单树权限分配（基于菜单管理配置）
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFormMenuIds(menus.map((m) => m.id))}
                  className="text-fg-secondary hover:text-fg underline"
                >
                  全选
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setFormMenuIds([])}
                  className="text-fg-secondary hover:text-fg underline"
                >
                  清空
                </button>
              </div>
            </div>
            <MenuPermissionTree
              menus={menus}
              checkedIds={formMenuIds}
              onChange={setFormMenuIds}
            />
          </div>

          {/* 应用权限 */}
          <div>
            <div className="font-bold text-fg mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-fg-secondary" />
                应用权限范围 (Application Permissions)
              </span>
              <button
                type="button"
                onClick={() =>
                  setFormAppIds((prev) =>
                    prev.includes("ALL") ? [] : ["ALL", ...apps.map((a) => a.id)]
                  )
                }
                className="text-fg-secondary hover:text-fg underline text-[11px]"
              >
                {isFormAllApps ? "取消全部应用" : "全选全部应用"}
              </button>
            </div>

            {apps.length === 0 ? (
              <div className="py-6 text-center text-fg-tertiary border border-dashed border-line rounded-xl">
                暂无可授权应用
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {apps.map((app) => {
                  const isChecked = isFormAllApps || formAppIds.includes(app.id);
                  return (
                    <label
                      key={app.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-subtle border-line shadow-card"
                          : "bg-surface border-line opacity-70 hover:opacity-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAppInForm(app.id)}
                        className="mt-0.5 rounded text-fg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-fg truncate">{app.name}</div>
                        <div className="text-[10px] text-fg-tertiary font-mono truncate">
                          {app.code} • {app.defaultCurrency}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </SideSheet>
    </div>
  );
};
