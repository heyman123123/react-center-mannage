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
  Key,
  Copy,
  FolderTree,
  Filter,
  Sparkles,
} from "lucide-react";
import { RbacRole, Tenant } from "../types/payment";

interface RolesViewProps {
  roles: RbacRole[];
  currentTenant: Tenant;
  onSaveRole: (role: RbacRole) => void;
}

const PERMISSION_DEFINITIONS: { key: string; label: string; desc: string; category: string }[] = [
  {
    key: "canRefund",
    label: "主动发起退款与取消授权",
    desc: "允许在海外网关直接发起整单退款或局部冲正",
    category: "资金安全",
  },
  {
    key: "canDispute",
    label: "争议调单抗辩处理 (Disputes)",
    desc: "提交反欺诈凭证、签收单驳回海外拒付",
    category: "资金安全",
  },
  {
    key: "canConfigGateways",
    label: "海外网关与邮件凭证配置",
    desc: "管理 Stripe/PayPal/SendGrid API 密钥与端点",
    category: "渠道接入",
  },
  {
    key: "canManageEmails",
    label: "多语言邮件模版与字典维护",
    desc: "编辑 6 国语言模版内容、正文与统一字典",
    category: "营销与触达",
  },
  {
    key: "canManageProducts",
    label: "商品方案与订阅计划管理",
    desc: "创建上架新海外定价、试用期及月/季/年费周期",
    category: "商品与折扣",
  },
  {
    key: "canManagePromos",
    label: "促销折扣码与营销活动派发",
    desc: "生成优惠券、制定折扣规则及批量发送邮件",
    category: "商品与折扣",
  },
  {
    key: "canViewUsers",
    label: "终端客户行为轨迹审计",
    desc: "查阅海外终端用户登录、订阅流转、改密等日志",
    category: "客户与运维",
  },
  {
    key: "canManageUsers",
    label: "终端客户封禁与密码重置",
    desc: "执行冻结海外违规账号、强制踢下线",
    category: "客户与运维",
  },
  {
    key: "canManageRoles",
    label: "RBAC 角色与系统菜单配置",
    desc: "增删权限分配、定义侧边栏导航展示规则",
    category: "权限体系",
  },
  {
    key: "canCrossTenant",
    label: "跨多业务单元 (Tenant) 访问",
    desc: "支持无缝切换并审计集团旗下所有 BU 账目",
    category: "数据隔离",
  },
];

export const RolesView: React.FC<RolesViewProps> = ({ roles, currentTenant, onSaveRole }) => {
  const [roleList, setRoleList] = useState<RbacRole[]>(roles);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<RbacRole | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setSelectedRole(null);
    setFormName("");
    setFormDescription("");
    const initialPerms: Record<string, boolean> = {};
    PERMISSION_DEFINITIONS.forEach((p) => {
      initialPerms[p.key] = false;
    });
    initialPerms.canViewUsers = true;
    setFormPermissions(initialPerms);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: RbacRole) => {
    setSelectedRole(r);
    setFormName(r.name);
    setFormDescription(r.description);
    const initialPerms: Record<string, boolean> = {};
    PERMISSION_DEFINITIONS.forEach((p) => {
      initialPerms[p.key] = (r.permissions as any)[p.key] ?? false;
    });
    setFormPermissions(initialPerms);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole) {
      const updated: RbacRole = {
        ...selectedRole,
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: {
          ...selectedRole.permissions,
          ...formPermissions,
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
        assignedMembersCount: 1,
        permissions: formPermissions as any,
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

  return (
    <div className="space-y-6 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold">
            ✕
          </button>
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
              RBAC 角色访问控制与权限分配 (Roles & Permissions)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            基于多租户数据隔离机制，精细化管理不同岗位（超管、财务、运营、开发者、风控）的资金操作、渠道秘钥与客户信息查阅权限。
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
          <div className="text-[11px] text-zinc-500 mt-0.5">支持按业务单元独立分发</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>数据边界控制</span>
            <Shield className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            租户级隔离
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">支持跨业务单元超管审计模式</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-zinc-500 font-medium">
          当前共定义 <span className="font-bold font-mono text-zinc-900">{roleList.length}</span>{" "}
          个企业级系统角色
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
          const permCount = Object.values(role.permissions).filter(Boolean).length;
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
                    <span>{role.assignedMembersCount} 人</span>
                  </span>
                </div>

                <p className="text-xs text-zinc-500 mt-3 line-clamp-2 leading-relaxed">
                  {role.description}
                </p>

                {/* Key Permissions Badges */}
                <div className="mt-4 pt-3 border-t border-zinc-100 space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                    <span>权限覆盖率</span>
                    <span className="font-mono text-zinc-700">
                      {permCount} / {PERMISSION_DEFINITIONS.length} 项
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {PERMISSION_DEFINITIONS.slice(0, 4).map((p) => {
                      const has = (role.permissions as any)[p.key];
                      return (
                        <span
                          key={p.key}
                          className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${
                            has
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          {has ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <X className="w-2.5 h-2.5 text-zinc-300" />
                          )}
                          <span className="truncate max-w-[120px]">{p.label.slice(0, 8)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  {role.permissions.canCrossTenant ? "允许跨多租户" : "限定所属业务单元"}
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
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
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

      {/* Add / Edit Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-zinc-900" />
                <h3 className="font-bold text-sm text-zinc-900">
                  {selectedRole ? `配置角色权限: ${selectedRole.name}` : "新建系统角色"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">角色名称 (中文):</label>
                <input
                  type="text"
                  required
                  placeholder="如：海外合规与风险专员"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:bg-white"
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
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:bg-white"
                />
              </div>

              <div>
                <div className="font-bold text-zinc-900 mb-2 flex items-center justify-between">
                  <span>细粒度功能权限分配:</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn: Record<string, boolean> = {};
                        PERMISSION_DEFINITIONS.forEach((p) => (allOn[p.key] = true));
                        setFormPermissions(allOn);
                      }}
                      className="text-zinc-600 hover:text-zinc-900 underline"
                    >
                      全选
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff: Record<string, boolean> = {};
                        PERMISSION_DEFINITIONS.forEach((p) => (allOff[p.key] = false));
                        setFormPermissions(allOff);
                      }}
                      className="text-zinc-600 hover:text-zinc-900 underline"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const isChecked = formPermissions[perm.key] ?? false;
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-zinc-50 border-zinc-300 shadow-xs"
                            : "bg-white border-zinc-200 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setFormPermissions({
                              ...formPermissions,
                              [perm.key]: e.target.checked,
                            })
                          }
                          className="mt-0.5 rounded text-zinc-900"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900">{perm.label}</span>
                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.2 rounded font-medium">
                              {perm.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                            {perm.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  {selectedRole ? "保存角色权限配置" : "确认创建角色"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
