import React, { useState } from "react";
import {
  Scale,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  FileUp,
  Check,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
  ReconciliationBatch,
} from "../types/payment";
import { RBAC_ROLES, INITIAL_RECON_BATCHES } from "../data/mockData";
import { formatCurrency } from "../lib/utils";

interface ReconciliationViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  transactions: TransactionRecord[];
  onOpenDiscrepancy: (tx: TransactionRecord) => void;
  onAutoReconcileAll: () => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  currentTenant,
  currentUser,
  transactions,
  onOpenDiscrepancy,
  onAutoReconcileAll,
}) => {
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];
  const canReconcile = currentRole?.permissions?.canTriggerReconciliation ?? true;
  const canResolve = currentRole?.permissions?.canResolveDiscrepancy ?? true;

  // Filter discrepancy transactions
  const discrepancies = transactions.filter(
    (t) =>
      t.status === "discrepancy" &&
      (currentTenant.id === "group_hq" || t.tenantId === currentTenant.id)
  );

  const pendingRecon = transactions.filter(
    (t) =>
      (t.status === "in_process" || t.status === "pending_check") &&
      (currentTenant.id === "group_hq" || t.tenantId === currentTenant.id)
  );

  const handleRunReconciliation = () => {
    if (!canReconcile) {
      alert("权限不足：当前登录角色无权发起跨租户或自动化对账任务！");
      return;
    }

    setIsRunningEngine(true);
    setProgress(15);

    setTimeout(() => setProgress(45), 400);
    setTimeout(() => setProgress(75), 800);
    setTimeout(() => {
      setProgress(100);
      setIsRunningEngine(false);
      onAutoReconcileAll();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      setSuccessToast("自动化三方对账引擎运行完毕，已匹配平账全部合格流水！");
      setTimeout(() => setSuccessToast(null), 4000);
    }, 1200);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Toast Alert */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-100 hover:text-white text-xs font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner with Action */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-zinc-900" />
            <h1 className="text-lg font-bold text-zinc-900">
              企业级实时交易对账中心 (Automated Reconciliation Engine)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            支持业务订单流、聚合支付路由流水与银行/渠道清算账单（三方对账模型），实现T+0差错拦截与T+1自动扎帐。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="run-recon-engine-btn"
            disabled={isRunningEngine || !canReconcile}
            onClick={handleRunReconciliation}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all ${
              !canReconcile
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
                : isRunningEngine
                ? "bg-zinc-800 text-white"
                : "bg-black hover:bg-zinc-800 text-white active:scale-95"
            }`}
            title={!canReconcile ? "RBAC权限受限：需要对账专员或财务总监角色" : ""}
          >
            {isRunningEngine ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>正在执行三方对账 ({progress}%)...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>运行自动化对账引擎</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Three-Way Reconciliation Architecture Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Node 1: Business Order Side */}
        <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              1. 业务订单侧 (Internal Orders)
            </span>
            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              实时接入
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(18420650, currentTenant.currency)}
          </div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
            <span>已接入业务单数:</span>
            <span className="font-mono text-zinc-800 font-medium">45,678 笔</span>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] text-zinc-400">
            涵盖连锁零售门店、SaaS订阅、跨境订单与医院挂号
          </div>
        </div>

        {/* Node 2: Payment Gateway Stream */}
        <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              2. 聚合支付网关 (Gateway Stream)
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              双轨监听
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(18420650, currentTenant.currency)}
          </div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
            <span>网关路由回执:</span>
            <span className="font-mono text-zinc-800 font-medium">45,678 笔</span>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] text-zinc-400">
            智能路由至微信、支付宝、银联、数字人民币与SWIFT
          </div>
        </div>

        {/* Node 3: Bank & Channel Clearing Files */}
        <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              3. 银行与渠道对账单 (Channel Bills)
            </span>
            <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              T+1 自动回盘
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(18410200, currentTenant.currency)}
          </div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
            <span>平账率 (Match Rate):</span>
            <span className="font-mono text-emerald-600 font-semibold">99.85%</span>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>差错待调账: {discrepancies.length} 笔 (差异 ¥10,450.00)</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Workbench (差错账工作台) */}
      <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-zinc-900">
              差错账协同工作台 (Discrepancy Resolution Workbench)
            </h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.2 rounded-full font-semibold">
              {discrepancies.length} 笔待处理
            </span>
          </div>

          <div className="text-xs text-zinc-500">
            RBAC审核人: <span className="font-medium text-zinc-800">{currentUser.name}</span>
          </div>
        </div>

        {discrepancies.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-zinc-800">
              全渠道流水平账完毕，无待决差错！
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              所有业务订单与银行清算账单金额、手续费及到账状态均 100% 吻合。
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/80">
            {discrepancies.map((tx) => (
              <div
                key={tx.id}
                className="p-4 hover:bg-zinc-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900">
                      {tx.orderTitle}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      [{tx.id}]
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                      {tx.discrepancyType === "amount_mismatch"
                        ? "金额不符"
                        : "状态不一致"}
                    </span>
                  </div>
                  <div className="text-xs text-red-600 bg-red-50/60 border border-red-100 rounded-lg p-2 mt-1">
                    ⚠️ {tx.discrepancyNote}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1 font-mono">
                    <span>商户: {tx.merchantName}</span>
                    <span>渠道单号: {tx.channelTradeNo}</span>
                    <span>发生时间: {tx.createdAt}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-sm text-zinc-900 font-mono">
                      {formatCurrency(tx.orderAmount, tx.currency)}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      手续费: {formatCurrency(tx.channelFee, tx.currency)}
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenDiscrepancy(tx)}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    处理调账
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Reconciliation Batches Table */}
      <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            近期对账批次记录 (Recent Reconciliation Batches)
          </h3>
          <span className="text-xs text-zinc-400">自动对账任务每日 02:00 定时归集</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-xs text-zinc-600 border-collapse">
            <thead className="bg-zinc-50/90 text-zinc-500 font-semibold text-[11px] border-b border-zinc-200">
              <tr>
                <th className="px-3 py-2.5 w-[180px]">批次编号</th>
                <th className="px-3 py-2.5 w-[160px]">归属业务单元</th>
                <th className="px-3 py-2.5 w-[120px]">结算渠道</th>
                <th className="px-3 py-2.5 w-[110px]">总流水笔数</th>
                <th className="px-3 py-2.5 w-[110px]">平账笔数</th>
                <th className="px-3 py-2.5 w-[100px]">差错笔数</th>
                <th className="px-3 py-2.5 w-[140px]">总清算金额</th>
                <th className="px-3 py-2.5 w-[110px]">状态</th>
                <th className="px-3 py-2.5 w-[110px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {INITIAL_RECON_BATCHES.map((batch) => (
                <tr key={batch.batchNo} className="hover:bg-zinc-50/80 transition-colors group">
                  <td className="px-3 py-2.5 w-[180px] font-mono font-medium text-zinc-900">
                    {batch.batchNo}
                  </td>
                  <td className="px-3 py-2.5 w-[160px] text-zinc-700">
                    {batch.tenantId === "group_hq" ? "集团全渠道汇总" : batch.tenantId}
                  </td>
                  <td className="px-3 py-2.5 w-[120px] uppercase font-mono">{batch.channel}</td>
                  <td className="px-3 py-2.5 w-[110px] font-mono">
                    {batch.totalCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 w-[110px] font-mono text-emerald-600">
                    {batch.matchedCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 w-[100px] font-mono text-red-600">
                    {batch.discrepancyCount}
                  </td>
                  <td className="px-3 py-2.5 w-[140px] font-mono font-semibold text-zinc-900">
                    {formatCurrency(batch.totalAmount)}
                  </td>
                  <td className="px-3 py-2.5 w-[110px]">
                    {batch.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        全部平账
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        差异待核
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 w-[110px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    <button
                      onClick={() => alert(`批次 [${batch.batchNo}] 对账凭证核验通过，轧差吻合！`)}
                      className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-[11px] font-medium transition-colors"
                    >
                      核验凭证
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
