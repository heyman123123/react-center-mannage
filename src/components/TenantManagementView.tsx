import React, { useState } from "react";
import {
  Building2,
  Lock,
  Key,
  Shield,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  CheckCircle2,
  Settings,
  Percent,
  TrendingUp,
} from "lucide-react";
import { Tenant, SystemUser, PaymentChannel } from "../types/payment";
import { formatCurrency } from "../lib/utils";

interface TenantManagementViewProps {
  tenants: Tenant[];
  currentTenant: Tenant;
  setCurrentTenant: (t: Tenant) => void;
  currentUser: SystemUser;
}

export const TenantManagementView: React.FC<TenantManagementViewProps> = ({
  tenants,
  currentTenant,
  setCurrentTenant,
  currentUser,
}) => {
  const [selectedTenantDetails, setSelectedTenantDetails] = useState<Tenant>(currentTenant);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Banner */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-900" />
            <h1 className="text-lg font-bold text-zinc-900">
              多租户财务数据隔离与业务单元管控 (Multi-Tenant Data Isolation)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            集团内各事业部（BU）资金账务物理/逻辑严密隔离，专属支付密钥、私有清算流水、额度配额防线与独立费率路由。
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>数据隔离防御机制:</span>
          <span className="font-semibold text-zinc-900">RLS行级安全策略 + 租户密钥沙箱</span>
        </div>
      </div>

      {/* Tenant Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => {
          const isSelected = currentTenant.id === t.id;
          const usagePercent = Math.min(100, Math.round((t.usedToday / t.dailyCap) * 100));

          return (
            <div
              key={t.id}
              className={`bg-white border rounded-xl p-5 shadow-2xs transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-zinc-900 ring-1 ring-zinc-900"
                  : "border-zinc-200/90 hover:border-zinc-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <h3 className="font-semibold text-sm text-zinc-900">
                      {t.name}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">
                    {t.code}
                  </span>
                </div>

                <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                  {t.description}
                </p>

                {/* Quota Usage Bar */}
                <div className="mt-4 pt-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-500">今日结算限额使用率</span>
                    <span className="font-mono font-medium text-zinc-900">
                      {usagePercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${usagePercent}%`,
                        backgroundColor:
                          usagePercent > 80 ? "#ef4444" : usagePercent > 50 ? "#f59e0b" : "#10b981",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1 font-mono">
                    <span>已用: {formatCurrency(t.usedToday, t.currency)}</span>
                    <span>限额: {formatCurrency(t.dailyCap, t.currency)}</span>
                  </div>
                </div>

                {/* Channels Badge list */}
                <div className="mt-4">
                  <span className="text-[11px] text-zinc-400">已授权支付渠道:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.channelsEnabled.map((ch) => (
                      <span
                        key={ch}
                        className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-zinc-100 text-zinc-700 rounded"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer action */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  接入商户: <strong className="text-zinc-800">{t.activeMerchantsCount}</strong> 家
                </span>

                {isSelected ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    当前激活视图
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentTenant(t);
                      setSelectedTenantDetails(t);
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-md transition-colors"
                  >
                    <span>切换至该BU</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Tenant Security & Technical Isolation Architecture */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span>财务数据隔离防御体系 (Security Isolation Architecture)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-lg space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <Lock className="w-3.5 h-3.5 text-zinc-700" />
              <span>1. 存储层物理/逻辑分区 (RLS)</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              底层数据库通过全局唯一的 <code className="font-mono bg-zinc-200/80 px-1 py-0.2 rounded text-[11px]">tenant_id</code> 进行行级安全策略（Row-Level Security）硬隔离，任一业务单元代码执行均受限于数据库上下文，无法穿透查询其他BU流水。
            </p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-lg space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <Key className="w-3.5 h-3.5 text-zinc-700" />
              <span>2. 支付网关密钥独立沙箱 (HSM)</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              每个事业群拥有专属加密机硬件存储的微信商户号（MchId）、支付宝应用私钥及SWIFT公私钥对，禁止跨BU混用收款账号，防止资金池污染与混淆记账。
            </p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-lg space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <Cpu className="w-3.5 h-3.5 text-zinc-700" />
              <span>3. 智能渠道费率与限额路由</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              支持针对新零售（高频小额千分之三）、智能云（大额低费万分之五）及跨境出海（外汇实时锁汇结算）配置差异化路由策略，清算资金自动分账直入各BU银行专户。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
