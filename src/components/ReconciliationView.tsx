import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as reconciliationApi from "../api/modules/reconciliation";
import { resolveCurrentRole } from "../lib/permissions";
import * as transactionsApi from "../api/modules/transactions";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { Popconfirm } from "./ui/Popconfirm";
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
  Download,
  Upload,
  Loader2,
  Eye,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
  ReconciliationBatch,
  DiscrepancyRecord,
} from "../types/payment";
import { formatCurrency, exportToCSV } from "../lib/utils";

interface ReconciliationViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  onOpenDiscrepancy: (tx: TransactionRecord) => void;
  onAutoReconcileAll?: () => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  currentTenant,
  currentUser,
  onOpenDiscrepancy,
  onAutoReconcileAll,
}) => {
  const { t } = useTranslation(["reconciliation", "common"]);
  const [transactionList, setTransactionList] = useState<TransactionRecord[]>([]);
  const [reconBatches, setReconBatches] = useState<ReconciliationBatch[]>([]);
  const [summary, setSummary] = useState<reconciliationApi.ReconciliationSummary | null>(null);
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // M2: 真实差异列表 & 账单导入
  const [discrepancyList, setDiscrepancyList] = useState<DiscrepancyRecord[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importChannelId, setImportChannelId] = useState<string>("creem");
  const [importDate, setImportDate] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUploading, setImportUploading] = useState(false);
  const [importResult, setImportResult] = useState<{ importedCount: number; matchedCount: number; discrepancyCount: number } | null>(null);
  const [handlingId, setHandlingId] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
    try {
      const [txRes, batches, sum, disc] = await Promise.all([
        transactionsApi.listTransactions({ page: 1, pageSize: 200, tenantId }),
        reconciliationApi.listReconciliationBatches(tenantId),
        reconciliationApi.getReconciliationSummary(tenantId),
        reconciliationApi.listDiscrepancies(tenantId).catch(() => [] as DiscrepancyRecord[]),
      ]);
      setTransactionList(txRes.list);
      setReconBatches(batches);
      setSummary(sum);
      setDiscrepancyList(disc);
    } catch {
      setTransactionList([]);
      setReconBatches([]);
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentRole = resolveCurrentRole(currentUser, []);
  const canReconcile = currentRole?.permissions?.canTriggerReconciliation ?? true;
  const canResolve = currentRole?.permissions?.canResolveDiscrepancy ?? true;

  // Filter discrepancy transactions
  const discrepancies = transactionList.filter(
    (t) =>
      t.status === "discrepancy" &&
      (currentTenant.id === "group_hq" || t.tenantId === currentTenant.id)
  );

  const discrepancyDiffAmount = discrepancies.reduce((sum, d) => {
    if (d.settleAmount == null) return sum + (d.orderAmount || 0);
    return sum + Math.abs(d.orderAmount - d.settleAmount);
  }, 0);

  const pendingRecon = transactionList.filter(
    (t) =>
      (t.status === "in_process" || t.status === "pending_check") &&
      (currentTenant.id === "group_hq" || t.tenantId === currentTenant.id)
  );

  const handleRunReconciliation = () => {
    if (!canReconcile) {
      alert(t("errors.permissionDenied"));
      return;
    }

    setIsRunningEngine(true);
    setProgress(15);
    const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
    void (async () => {
      try {
        setProgress(45);
        await reconciliationApi.runReconciliation(tenantId);
        setProgress(75);
        onAutoReconcileAll?.();
        await loadData();
        setProgress(100);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        setSuccessToast(t("toast.engineComplete"));
        setTimeout(() => setSuccessToast(null), 4000);
      } catch {
        setSuccessToast(t("errors.engineFailed"));
      } finally {
        setIsRunningEngine(false);
      }
    })();
  };

  const handleExport = () => {
    exportToCSV(
      t("export.filename"),
      [
        t("export.headers.id"),
        t("export.headers.tenant"),
        t("export.headers.channel"),
        t("export.headers.channelNo"),
        t("export.headers.amount"),
        t("export.headers.currency"),
        t("export.headers.status"),
        t("export.headers.reason"),
        t("export.headers.time"),
      ],
      discrepancyList.length > 0
        ? discrepancyList.map((d) => [
            d.id, d.tenantId, d.channel, d.channelTradeNo, d.orderAmount, d.currency,
            d.status, d.discrepancyNote, d.createdAt,
          ])
        : discrepancies.map((t) => [
            t.id, t.tenantId, t.channel, t.channelTradeNo, t.orderAmount, t.currency,
            t.reconStatus || t.status, t.discrepancyReason || t.discrepancyType || "", t.createdAt,
          ])
    );
  };

  // M2: 导入渠道账单
  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setImportFile(f);
  };

  const handleImportSubmit = async () => {
    if (!importFile || !importDate) return;
    setImportUploading(true);
    try {
      const result = await reconciliationApi.importStatement(importFile, importChannelId, importDate);
      setImportResult(result);
      setImportFile(null);
      if (importFileInputRef.current) importFileInputRef.current.value = "";
      await loadData();
    } catch {
      setImportResult(null);
    } finally {
      setImportUploading(false);
    }
  };

  // M2: 处理差异
  const handleDiscrepancyAction = async (d: DiscrepancyRecord, action: string) => {
    setHandlingId(d.id);
    try {
      await reconciliationApi.handleDiscrepancy(d.id, action, "");
      const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
      const disc = await reconciliationApi.listDiscrepancies(tenantId);
      setDiscrepancyList(disc);
      setSuccessToast(t("toast.discrepancyHandled"));
      setTimeout(() => setSuccessToast(null), 4000);
    } catch {
      /* ignore */
    } finally {
      setHandlingId(null);
    }
  };

  const DISCREPANCY_TYPE_META: Record<string, { label: string; badge: string }> = {
    overpayment: { label: t("workbench.types.overpayment"), badge: "bg-amber-50 text-amber-700 border-amber-200" },
    underpayment: { label: t("workbench.types.underpayment"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
    amount_mismatch: { label: t("workbench.types.amountMismatch"), badge: "bg-orange-50 text-orange-700 border-orange-200" },
    channel_missing: { label: t("workbench.types.channelMissing"), badge: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  };

  const { currentPage, setCurrentPage, reset: _reset, pageSize, setPageSize } = usePagination(10);
  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="p-2 md:p-2 space-y-2 max-w-7xl mx-auto font-sans">
      {/* Toast Alert */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-3 py-2 rounded-xl shadow-lg flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-2">
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
      <div className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-fg" />
            <h1 className="text-lg font-bold text-fg">
              {t("title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-semibold transition-colors"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>{t("import.button")}</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("exportCsv")}</span>
          </button>
          <button
            id="run-recon-engine-btn"
            disabled={isRunningEngine || !canReconcile}
            onClick={handleRunReconciliation}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shadow-card transition-all ${
              !canReconcile
                ? "bg-hover text-fg-tertiary cursor-not-allowed border border-line"
                : isRunningEngine
                ? "bg-primary-hover text-white"
                : "bg-black hover:bg-primary-hover text-primary-foreground active:scale-95"
            }`}
            title={!canReconcile ? t("rbacDenied") : ""}
          >
            {isRunningEngine ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{t("running", { progress })}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>{t("runEngine")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Three-Way Reconciliation Architecture Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Node 1: Business Order Side */}
        <div className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider whitespace-nowrap">
              {t("nodes.orders")}
            </span>
            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {t("nodes.realtime")}
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-fg font-mono">
            {formatCurrency(summary?.orderTotalAmount ?? 0, currentTenant.currency)}
          </div>
          <div className="text-xs text-fg-secondary mt-1 flex items-center justify-between">
            <span>{t("nodes.orderCount")}</span>
            <span className="font-mono text-fg font-medium">{summary?.orderCount ?? 0} {t("units.count")}</span>
          </div>
          <div className="mt-2 pt-3 border-t border-line-subtle text-[11px] text-fg-tertiary">
            {t("nodes.orderHint")}
          </div>
        </div>

        {/* Node 2: Payment Gateway Stream */}
        <div className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider whitespace-nowrap">
              {t("nodes.gateway")}
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {t("nodes.dualTrack")}
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-fg font-mono">
            {formatCurrency(summary?.gatewayTotalAmount ?? 0, currentTenant.currency)}
          </div>
          <div className="text-xs text-fg-secondary mt-1 flex items-center justify-between">
            <span>{t("nodes.gatewayCount")}</span>
            <span className="font-mono text-fg font-medium">{summary?.orderCount ?? 0} {t("units.count")}</span>
          </div>
          <div className="mt-2 pt-3 border-t border-line-subtle text-[11px] text-fg-tertiary">
            {t("nodes.gatewayHint")}
          </div>
        </div>

        {/* Node 3: Bank & Channel Clearing Files */}
        <div className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider whitespace-nowrap">
              {t("nodes.bills")}
            </span>
            <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {t("nodes.t1")}
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-fg font-mono">
            {formatCurrency(summary?.bankTotalAmount ?? 0, currentTenant.currency)}
          </div>
          <div className="text-xs text-fg-secondary mt-1 flex items-center justify-between">
            <span>{t("nodes.matchRate")}</span>
            <span className="font-mono text-emerald-600 font-semibold">{(summary?.matchedRate ?? 0).toFixed(2)}%</span>
          </div>
          <div className="mt-2 pt-3 border-t border-line-subtle text-[11px] text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>{t("nodes.discrepancyPending", { count: discrepancies.length, amount: formatCurrency(discrepancyDiffAmount, currentTenant.currency) })}</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Workbench (差错账工作台) */}
      <div className="bg-surface border border-line/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-2 border-b border-line/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-fg">
              {t("workbench.title")}
            </h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.2 rounded-full font-semibold">
              {t("workbench.pending", { count: discrepancyList.length || discrepancies.length })}
            </span>
          </div>

          <div className="text-xs text-fg-secondary">
            {t("workbench.reviewer")} <span className="font-medium text-fg">{currentUser.name}</span>
          </div>
        </div>

        {(discrepancyList.length === 0 && discrepancies.length === 0) ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-fg">
              {t("workbench.emptyTitle")}
            </div>
            <div className="text-xs text-fg-tertiary mt-1">
              {t("workbench.emptyDesc")}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-line/80">
            {discrepancyList.length > 0
              ? discrepancyList.map((d) => {
                  const typeMeta = DISCREPANCY_TYPE_META[d.discrepancyType] || DISCREPANCY_TYPE_META.amount_mismatch;
                  const handling = handlingId === d.id;
                  return (
                    <div
                      key={d.id}
                      className="p-2 hover:bg-subtle transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-fg font-mono">[{d.channelTradeNo || d.id}]</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${typeMeta.badge}`}>
                            {typeMeta.label}
                          </span>
                        </div>
                        <div className="text-xs text-red-600 bg-red-50/60 border border-red-100 rounded-lg p-2 mt-1">
                          ⚠️ {d.discrepancyNote}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-fg-secondary pt-1 font-mono flex-wrap">
                          <span>{t("workbench.channelNo")} {d.channelTradeNo}</span>
                          <span>{t("workbench.occurredAt")} {d.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-sm text-fg font-mono">
                            {formatCurrency(d.orderAmount, d.currency)}
                          </div>
                          {d.channelAmount != null && (
                            <div className="text-[11px] text-fg-tertiary font-mono">
                              {t("workbench.channelAmount")}: {formatCurrency(d.channelAmount, d.currency)}
                            </div>
                          )}
                        </div>
                        <Popconfirm
                          title={t("workbench.actions.acceptTitle")}
                          description={t("workbench.actions.acceptDesc")}
                          confirmText={t("workbench.actions.confirm")}
                          onConfirm={() => handleDiscrepancyAction(d, "accept")}
                        >
                          <button
                            disabled={handling}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40 inline-flex items-center gap-1"
                          >
                            {handling && <Loader2 className="w-3 h-3 animate-spin" />}
                            {t("workbench.actions.accept")}
                          </button>
                        </Popconfirm>
                        <Popconfirm
                          title={t("workbench.actions.investigateTitle")}
                          description={t("workbench.actions.investigateDesc")}
                          confirmText={t("workbench.actions.confirm")}
                          onConfirm={() => handleDiscrepancyAction(d, "investigate")}
                        >
                          <button
                            disabled={handling}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                          >
                            {t("workbench.actions.investigate")}
                          </button>
                        </Popconfirm>
                        <Popconfirm
                          title={t("workbench.actions.escalateTitle")}
                          description={t("workbench.actions.escalateDesc")}
                          confirmText={t("workbench.actions.confirm")}
                          onConfirm={() => handleDiscrepancyAction(d, "escalate")}
                        >
                          <button
                            disabled={handling}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                          >
                            {t("workbench.actions.escalate")}
                          </button>
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })
              : discrepancies.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2 hover:bg-subtle transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-fg">
                          {tx.orderTitle}
                        </span>
                        <span className="text-xs font-mono text-fg-tertiary">
                          [{tx.id}]
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                          {tx.discrepancyType === "amount_mismatch"
                            ? t("workbench.amountMismatch")
                            : t("workbench.statusMismatch")}
                        </span>
                      </div>
                      <div className="text-xs text-red-600 bg-red-50/60 border border-red-100 rounded-lg p-2 mt-1">
                        ⚠️ {tx.discrepancyNote}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-fg-secondary pt-1 font-mono">
                        <span>{t("workbench.merchant")} {tx.merchantName}</span>
                        <span>{t("workbench.channelNo")} {tx.channelTradeNo}</span>
                        <span>{t("workbench.occurredAt")} {tx.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-bold text-sm text-fg font-mono">
                          {formatCurrency(tx.orderAmount, tx.currency)}
                        </div>
                        <div className="text-[11px] text-fg-tertiary">
                          {t("workbench.fee")} {formatCurrency(tx.channelFee, tx.currency)}
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenDiscrepancy(tx)}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-card"
                      >
                        {t("workbench.resolve")}
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>

      {/* Historical Reconciliation Batches Table */}
      <div className="bg-surface border border-line/90 rounded-xl shadow-2xs p-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-fg">
            {t("batches.title")}
          </h3>
          <span className="text-xs text-fg-tertiary">{t("batches.cronHint")}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-xs text-fg-secondary border-collapse">
            <thead className="bg-subtle/90 text-fg-secondary font-semibold text-[11px] border-b border-line">
              <tr>
                <th className="px-3 py-2.5 w-[180px]">{t("batches.batchId")}</th>
                <th className="px-3 py-2.5 w-[160px]">{t("batches.tenant")}</th>
                <th className="px-3 py-2.5 w-[120px]">{t("batches.channel")}</th>
                <th className="px-3 py-2.5 w-[110px]">{t("batches.totalCount")}</th>
                <th className="px-3 py-2.5 w-[110px]">{t("batches.matchedCount")}</th>
                <th className="px-3 py-2.5 w-[100px]">{t("batches.discrepancyCount")}</th>
                <th className="px-3 py-2.5 w-[140px]">{t("batches.totalAmount")}</th>
                <th className="px-3 py-2.5 w-[110px]">{t("batches.status")}</th>
                <th className="px-3 py-2.5 w-[110px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("batches.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate(reconBatches, currentPage, pageSize).map((batch) => (
                <tr key={batch.batchNo} className="hover:bg-subtle/80 transition-colors group">
                  <td className="px-3 py-2.5 w-[180px] font-mono font-medium text-fg">
                    {batch.batchNo}
                  </td>
                  <td className="px-3 py-2.5 w-[160px] text-fg-secondary">
                    {batch.tenantId === "group_hq" ? t("batches.groupSummary") : batch.tenantId}
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
                  <td className="px-3 py-2.5 w-[140px] font-mono font-semibold text-fg">
                    {formatCurrency(batch.totalAmount)}
                  </td>
                  <td className="px-3 py-2.5 w-[110px]">
                    {batch.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t("batches.statusCompleted")}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {t("batches.statusPending")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 w-[110px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    <button
                      onClick={() => alert(t("batches.verifyAlert", { batchNo: batch.batchNo }))}
                      className="px-2 py-1 bg-hover hover:bg-hover text-fg-secondary rounded text-[11px] font-medium transition-colors"
                    >
                      {t("batches.verify")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={reconBatches.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
      </div>

      {/* M2: 导入渠道账单 SideSheet */}
      <SideSheet
        id="recon-import"
        isOpen={importOpen}
        onClose={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
        title={t("import.title")}
        description={t("import.description")}
        icon={<FileUp className="w-5 h-5 text-fg" />}
        widthClass="max-w-lg max-md:max-w-none"
        footer={
          <>
            <button
              onClick={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
              className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer"
            >
              {t("import.cancel")}
            </button>
            <button
              onClick={handleImportSubmit}
              disabled={!importFile || !importDate || importUploading}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {importUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {importUploading ? t("import.uploading") : t("import.submit")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {importResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {t("import.resultTitle")}
              </div>
              <div className="font-mono text-[11px]">
                {t("import.imported")}: {importResult.importedCount} · {t("import.matched")}: {importResult.matchedCount} · {t("import.discrepancy")}: {importResult.discrepancyCount}
              </div>
            </div>
          )}
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("import.channelLabel")}</label>
            <ShadcnSelect
              value={importChannelId}
              onValueChange={setImportChannelId}
              options={[
                { value: "creem", label: "Creem" },
                { value: "stripe", label: "Stripe" },
                { value: "paypal", label: "PayPal" },
                { value: "adyen", label: "Adyen" },
              ]}
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("import.dateLabel")}</label>
            <input
              type="date"
              value={importDate}
              onChange={(e) => setImportDate(e.target.value)}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("import.fileLabel")}</label>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFileSelected}
            />
            <button
              onClick={() => importFileInputRef.current?.click()}
              className="w-full border border-dashed border-line rounded-xl p-4 text-center text-fg-tertiary hover:bg-hover transition-colors"
            >
              {importFile ? (
                <span className="text-fg font-medium flex items-center justify-center gap-1.5">
                  <FileUp className="w-4 h-4" /> {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Upload className="w-4 h-4" /> {t("import.filePlaceholder")}
                </span>
              )}
            </button>
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
