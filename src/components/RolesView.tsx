import React, { useState } from "react";
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Users,
  Search,
  CheckCircle2,
  Shield,
  Copy,
  FolderTree,
  Layers,
} from "lucide-react";
import { RbacRole, SystemMenuItem, PaymentApp } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { MenuPermissionTree } from "./MenuPermissionTree";

interface RolesViewProps {
  roles: RbacRole[];
  menus: SystemMenuItem[];
  apps: PaymentApp[];
  onSaveRole: (role: RbacRole) => void;
}

export const RolesView: React.FC<RolesViewProps> = ({ roles, menus, apps, onSaveRole }) => {
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [searchQuery, setSearchQuery] = useState("");
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
      assignedMembersCount: 0,
      permissions: { ...r.permissions },
    };
    setRoleList([duplicated, ...roleList]);
    onSaveRole(duplicated);
    showToast(`角色【${duplicated.name}】已成功克隆！`);
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
      const roleIdentifier = selectedRole.id || selectedRole.key;
      setRoleList((prev) =>
        prev.map((item) => ((item.id || item.key) === roleIdentifier ? updated : item))
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

  const filteredRoles = roleList.filter((r) => {
    const roleId = r.id || r.key || "";
    return (
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roleId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalAssignedStaff = roleList.reduce(
    (acc, curr) => acc + (curr.assignedMembersCount || 0),
    0
  );

  const isFormAllApps = formAppIds.includes("ALL");

  return (
    <div className="space-y-6 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-zinc-100 text-zinc-900 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              角色管理 (Roles & Permissions)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            管理系统角色方案；角色的访问权限在「权限管理」或此处基于菜单树进行配置。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增角色</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>活跃系统角色</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {roleList.length} <span className="text-xs font-normal text-zinc-400">个角色方案</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">涵盖全链路职责精细授权</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>分配内部团队成员</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {totalAssignedStaff} <span className="text-xs font-normal text-zinc-400">位员工</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">支持按角色独立分发</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>菜单树权限覆盖</span>
            <FolderTree className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {menus.length} <span className="text-xs font-normal text-zinc-400">个菜单节点</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">权限完全由菜单管理驱动</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-zinc-500 font-medium">
          当前共定义 <span className="font-bold font-mono text-zinc-900">{roleList.length}</span>{" "}
          个系统角色
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索角色名称 / 权限说明..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoles.map((role) => {
          const roleId = role.id || role.key || "";
          const menuCount = (role.permissions?.menuPermissionIds || []).length;
          const appPerms = (role.permissions?.appPermissionIds || []) as string[];
          const isSuperAdmin = roleId.includes("ADMIN") || roleId.includes("SUPER");

          return (
            <div
              key={roleId}
              className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-5 flex flex-col justify-between hover:border-zinc-300 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-2 rounded-xl ${
                        isSuperAdmin
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-zinc-900 text-sm">{role.name}</h3>
                      <span className="font-mono text-[10px] text-zinc-400 block">{roleId}</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-lg">
                    <Users className="w-3 h-3 text-zinc-400" />
                    <span>{role.assignedMembersCount || 0} 人</span>
                  </span>
                </div>

                <p className="text-xs text-zinc-500 mt-3 line-clamp-2 leading-relaxed">
                  {role.description}
                </p>

                {/* Key Permissions Badges */}
                <div className="mt-4 pt-3 border-t border-zinc-100 space-y-1.5 text-xs">
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                      <FolderTree className="w-2.5 h-2.5" />
                      菜单权限 {menuCount}/{menus.length}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      <Layers className="w-2.5 h-2.5" />
                      应用权限 {appPerms.includes("ALL") ? "全部" : appPerms.length}
                    </span>
                    {isSuperAdmin && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                        内置超管
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  {appPerms.includes("ALL") ? "全部应用可见" : "限定应用范围"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDuplicateRole(role)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="克隆角色"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(role)}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>配置权限</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Role SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-role-edit"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRole ? `配置角色权限: ${selectedRole.name}` : "新建系统角色"}
        description="配置角色基本信息，并按菜单树勾选该角色可访问的菜单节点，以及可操作的应用范围。"
        icon={<ShieldCheck className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold shadow-xs"
            >
              {selectedRole ? "保存角色权限配置" : "确认创建角色"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="py-1 space-y-5 text-xs">
          <div>
            <label className="font-semibold text-zinc-700 block mb-1">角色名称 (中文):</label>
            <input
              type="text"
              required
              placeholder="如：海外合规与风险专员"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-zinc-700 block mb-1">岗位职能与职责描述:</label>
            <textarea
              rows={2}
              required
              placeholder="如：负责审核海外高风险扣款与抗辩拒付，查阅终端用户登录流水..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
            />
          </div>

          {/* 菜单树权限 */}
          <div>
            <div className="font-bold text-zinc-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-zinc-500" />
                菜单树权限分配（基于菜单管理配置）
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFormMenuIds(menus.map((m) => m.id))}
                  className="text-zinc-600 hover:text-zinc-900 underline"
                >
                  全选
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setFormMenuIds([])}
                  className="text-zinc-600 hover:text-zinc-900 underline"
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
            <div className="font-bold text-zinc-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                应用权限范围 (Application Permissions)
              </span>
              <button
                type="button"
                onClick={() =>
                  setFormAppIds((prev) =>
                    prev.includes("ALL") ? [] : ["ALL", ...apps.map((a) => a.id)]
                  )
                }
                className="text-zinc-600 hover:text-zinc-900 underline text-[11px]"
              >
                {isFormAllApps ? "取消全部应用" : "全选全部应用"}
              </button>
            </div>

            {apps.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
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
                          ? "bg-zinc-50 border-zinc-300 shadow-xs"
                          : "bg-white border-zinc-200 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAppInForm(app.id)}
                        className="mt-0.5 rounded text-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-zinc-900 truncate">{app.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate">
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
