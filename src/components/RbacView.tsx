import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  UserCheck,
  Lock,
  Unlock,
  Key,
  Eye,
  AlertOctagon,
  FileCheck,
  Check,
  X,
  Users,
  Building,
  RefreshCw,
} from "lucide-react";
import { RbacRoleKey, SystemUser, AuditLog, Tenant, RbacRole } from "../types/payment";
import { RBAC_ROLES, INITIAL_AUDIT_LOGS } from "../data/mockData";

interface RbacViewProps {
  currentUser: SystemUser;
  setCurrentUser: (user: SystemUser) => void;
  allUsers: SystemUser[];
  tenants: Tenant[];
}

export const RbacView: React.FC<RbacViewProps> = ({
  currentUser,
  setCurrentUser,
  allUsers,
  tenants,
}) => {
  const [selectedRoleKey, setSelectedRoleKey] = useState<RbacRoleKey>(currentUser.roleKey);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [activeTab, setActiveTab] = useState<"matrix" | "users" | "audit">("matrix");

  const activeRole: RbacRole = (selectedRoleKey && RBAC_ROLES[selectedRoleKey]) || RBAC_ROLES["SUPER_ADMIN"] || {
    key: "SUPER_ADMIN",
    name: "超级管理员",
    description: "具备集团全部权限",
    dataScope: "ALL_TENANTS",
    permissions: {} as any,
  };

  const permissionItems: { key: keyof RbacRole["permissions"]; label: string; desc: string }[] = [
    { key: "canViewExecutiveDashboard", label: "企业级看板访问", desc: "查看集团和BU的综合交易数据、走势与KPI" },
    { key: "canViewAllTenants", label: "跨租户数据穿透", desc: "穿透查看所有BU的财务流水，否则仅限本业务单元" },
    { key: "canTriggerReconciliation", label: "发起自动对账", desc: "运行T+1三方自动对账引擎与回盘扎帐" },
    { key: "canResolveDiscrepancy", label: "处理差错账调账", desc: "确认差错单、自动抹平入账或挂账" },
    { key: "canManualAdjustFund", label: "大额资金冲正与划拨", desc: "执行渠道退款冲正、补账或资金调拨等高危财务操作" },
    { key: "canExportFinancialReports", label: "导出财务审计账单", desc: "下载含有敏感财务凭证与交易流水加密Excel/CSV" },
    { key: "canManageRbac", label: "RBAC权限策略管理", desc: "增删改角色定义、分配权限与账号授权" },
    { key: "canManageTenantSettings", label: "租户与网关路由配置", desc: "配置支付渠道密钥、费率规则与清算限额" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-zinc-900" />
            <h1 className="text-lg font-bold text-zinc-900">
              精细化 RBAC 角色访问控制与数据安全中心
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            采用基于角色的访问控制（RBAC）模型，实施最小权限原则（PoLP），确保各业务单元财务数据逻辑/物理隔离，防范资金越权风险。
          </p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-medium self-start md:self-auto">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "matrix"
                ? "bg-white text-zinc-900 shadow-xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            权限矩阵网格
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "users"
                ? "bg-white text-zinc-900 shadow-xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            用户与租户绑定
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "audit"
                ? "bg-white text-zinc-900 shadow-xs font-semibold"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            安全审计日志
          </button>
        </div>
      </div>

      {/* Role Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.values(RBAC_ROLES).map((role) => {
          const isSelected = selectedRoleKey === role.key;
          const isCurrentActive = currentUser.roleKey === role.key;

          return (
            <div
              key={role.key}
              onClick={() => setSelectedRoleKey(role.key)}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative ${
                isSelected
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-1 ring-zinc-900"
                  : "bg-white text-zinc-900 border-zinc-200/90 hover:border-zinc-300 shadow-2xs"
              }`}
            >
              {isCurrentActive && (
                <span
                  className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  当前角色
                </span>
              )}
              <div className="font-semibold text-xs tracking-tight truncate">
                {role.name.split(" ")[0]}
              </div>
              <div
                className={`text-[11px] mt-1 line-clamp-2 ${
                  isSelected ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                {role.description}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-200/40 flex items-center justify-between text-[10px]">
                <span
                  className={`font-medium ${
                    isSelected ? "text-zinc-300" : "text-blue-600"
                  }`}
                >
                  {role.dataScope === "ALL_TENANTS" ? "全局数据" : "租户隔离"}
                </span>
                <span className={isSelected ? "text-zinc-400" : "text-zinc-400"}>
                  {Object.values(role.permissions).filter(Boolean).length} / 8 项特权
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Tab Content */}
      {activeTab === "matrix" && (
        <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-zinc-200/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                权限矩阵明细表 (RBAC Matrix Table)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                实时生效中。切换上方角色卡片可审查该角色的授权范围与防护边界。
              </p>
            </div>
            <div className="text-xs text-zinc-600">
              当前审查角色:{" "}
              <span className="font-bold text-zinc-950">{activeRole.name}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-left text-xs text-zinc-600 border-collapse">
              <thead className="bg-zinc-50/90 text-zinc-500 font-semibold text-[11px] border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 w-[180px]">功能权限项</th>
                  <th className="px-4 py-3 min-w-[220px]">安全说明与业务边界</th>
                  <th className="px-4 py-3 w-[100px] text-center">超级管理员</th>
                  <th className="px-4 py-3 w-[100px] text-center">财务总监</th>
                  <th className="px-4 py-3 w-[100px] text-center">对账专员</th>
                  <th className="px-4 py-3 w-[100px] text-center">合规审计</th>
                  <th className="px-4 py-3 w-[100px] text-center">业务操作员</th>
                  <th className="px-4 py-3 w-[120px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    当前角色授权
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {permissionItems.map((item) => {
                  const isGranted = activeRole.permissions[item.key];

                  return (
                    <tr key={item.key} className="hover:bg-zinc-50/80 transition-colors group">
                      <td className="px-4 py-3 w-[180px] font-semibold text-zinc-900">
                        {item.label}
                      </td>
                      <td className="px-4 py-3 min-w-[220px] text-zinc-500">{item.desc}</td>
                      {/* Comparison Columns */}
                      <td className="px-4 py-3 w-[100px] text-center">
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      </td>
                      <td className="px-4 py-3 w-[100px] text-center">
                        {RBAC_ROLES.FINANCE_DIRECTOR.permissions[item.key] ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 w-[100px] text-center">
                        {RBAC_ROLES.RECON_SPECIALIST.permissions[item.key] ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 w-[100px] text-center">
                        {RBAC_ROLES.RISK_AUDITOR.permissions[item.key] ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 w-[100px] text-center">
                        {RBAC_ROLES.BU_OPERATOR.permissions[item.key] ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-300 mx-auto" />
                        )}
                      </td>
                      {/* Sticky Right Current Role Status */}
                      <td className="px-4 py-3 w-[120px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" /> 已授权
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-400 border border-zinc-200">
                            <X className="w-3 h-3" /> 禁止
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                用户账号与业务单元绑定列表
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                每个账号严格绑定租户与RBAC角色。点击“切换为此身份”可即时在系统内以该身份操作。
              </p>
            </div>
          </div>

          <div className="divide-y divide-zinc-200/80">
            {allUsers.map((u) => {
              const role = RBAC_ROLES[u.roleKey];
              const tenant = tenants.find((t) => t.id === u.tenantId);
              const isCurrent = currentUser.id === u.id;

              return (
                <div
                  key={u.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
                      {u.avatarText}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.2 rounded-full border border-emerald-200">
                            当前登录
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">
                        {u.email} • 最后活动: {u.lastLogin}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-blue-600">
                        {role?.name || u.role || "系统角色"}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        所属租户: {tenant?.name || u.tenantId}
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => setCurrentUser(u)}
                        className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-xs font-medium transition-colors"
                      >
                        模拟以此身份登录
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                安全与合规审计留痕 (Immutable Audit Trails)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                记录每一次跨租户访问、资金冲正、调账审批和RBAC拦截事件，不可伪造或篡改。
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-xs text-zinc-600 border-collapse">
              <thead className="bg-zinc-50/90 text-zinc-500 font-semibold text-[11px] border-b border-zinc-200">
                <tr>
                  <th className="px-3 py-2.5 w-[140px]">审计编号</th>
                  <th className="px-3 py-2.5 w-[160px]">时间戳</th>
                  <th className="px-3 py-2.5 w-[110px]">操作人</th>
                  <th className="px-3 py-2.5 w-[120px]">所属角色</th>
                  <th className="px-3 py-2.5 w-[160px]">执行操作</th>
                  <th className="px-3 py-2.5 min-w-[200px]">目标资源</th>
                  <th className="px-3 py-2.5 w-[130px]">客户端IP</th>
                  <th className="px-3 py-2.5 w-[110px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    审计结果
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors group font-mono">
                    <td className="px-3 py-2.5 w-[140px] font-semibold text-zinc-900">
                      {log.id}
                    </td>
                    <td className="px-3 py-2.5 w-[160px] text-zinc-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-3 py-2.5 w-[110px] font-sans font-medium text-zinc-800">
                      {log.userName}
                    </td>
                    <td className="px-3 py-2.5 w-[120px] text-zinc-500">{log.role}</td>
                    <td className="px-3 py-2.5 w-[160px] font-sans text-zinc-900 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-3 py-2.5 min-w-[200px] text-zinc-600 truncate max-w-xs" title={log.targetResource}>
                      {log.targetResource}
                    </td>
                    <td className="px-3 py-2.5 w-[130px] text-zinc-400 whitespace-nowrap">{log.ipAddress}</td>
                    <td className="px-3 py-2.5 w-[110px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] font-sans">
                      {log.status === "SUCCESS" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          放行允许
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          RBAC拦截
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
