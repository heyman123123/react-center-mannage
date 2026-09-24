import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  Search,
  Eye,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  Hourglass,
  PlusCircle,
  Download,
  Upload,
  FileText,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { SettlementBatch, SettlementStatus, TenantId } from "../types/payment";
import { exportToCSV } from "../lib/utils";
import { settlementsApi } from "../api";

interface SettlementsViewProps {
  batches?: SettlementBatch[];
}

const CHANNEL_LABEL: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  adyen: "Adyen",
  klarna: "Klarna",
  checkout: "Checkout",
  apple_pay: "Apple Pay",
};

const fmt = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SettlementsView: React.FC<SettlementsViewProps> = ({ batches }) => {
  const { t } = useTranslation(["commerce", "common"]);
  const [rows, setRows] = useState<SettlementBatch[]>(batches ?? []);
  const [dataLoading, setDataLoading] = useState<boolean>(!batches);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [detailBatch, setDetailBatch] = useState<SettlementBatch | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutBatchId, setPayoutBatchId] = useState<string>("");
  const [payoutAccount, setPayoutAccount] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutNote, setPayoutNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // M2: 审核 / 出金凭证 / 补单
  const [reviewing, setReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [supplementingId, setSupplementingId] = useState<string | null>(null);
  const payoutProofInputRef = useRef<HTMLInputElement>(null);
  const { currentPage, setCurrentPage, reset, pageSize, setPageSize } = usePagination(10);
  useEffect(() => { reset(); }, [statusFilter, searchQuery, reset]);

  const TENANT_LABEL = useMemo(
    (): Record<TenantId, string> => ({
      group_hq: t("settlements.tenants.group_hq"),
      bu_na_ecom: t("settlements.tenants.bu_na_ecom"),
      bu_eu_saas: t("settlements.tenants.bu_eu_saas"),
      bu_apac_japan: t("settlements.tenants.bu_apac_japan"),
      bu_latam: t("settlements.tenants.bu_latam"),
    }),
    [t]
  );

  const STATUS_META = useMemo(
    (): Record<SettlementStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
      PENDING: { label: t("settlements.status.PENDING"), badge: "bg-amber-50 text-amber-700 border-amber-200", icon: <Hourglass className="w-3 h-3" /> },
      UNDER_REVIEW: { label: t("settlements.status.UNDER_REVIEW"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <ShieldCheck className="w-3 h-3" /> },
      APPROVED: { label: t("settlements.status.APPROVED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      PAYING: { label: t("settlements.status.PAYING"), badge: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      PAID: { label: t("settlements.status.PAID"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: t("settlements.status.REJECTED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
      SETTLING: { label: t("settlements.status.SETTLING"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      FAILED: { label: t("settlements.status.FAILED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  useEffect(() => {
    if (batches) { setRows(batches); setDataLoading(false); return; }
    let cancelled = false;
    settlementsApi.getSettlements().then((data) => {
      if (!cancelled) { setRows(data); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, [batches]);

  const filtered = useMemo(() => {
    return rows.filter((b) => {
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      const matchSearch =
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (TENANT_LABEL[b.tenantId] || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [rows, statusFilter, searchQuery, TENANT_LABEL]);

  const pendingBatches = rows.filter((b) => b.status === "APPROVED");
  const selectedBatch = rows.find((b) => b.id === payoutBatchId) || null;

  const handleExport = () => {
    exportToCSV(
      t("settlements.exportFilename"),
      [
        t("settlements.exportHeaders.batchId"),
        t("settlements.exportHeaders.merchant"),
        t("settlements.exportHeaders.channel"),
        t("settlements.exportHeaders.receivable"),
        t("settlements.exportHeaders.fee"),
        t("settlements.exportHeaders.net"),
        t("settlements.exportHeaders.status"),
        t("settlements.exportHeaders.cycle"),
        t("settlements.exportHeaders.createdAt"),
      ],
      filtered.map((b) => [
        b.id, TENANT_LABEL[b.tenantId], CHANNEL_LABEL[b.channel] || b.channel,
        b.receivableAmount, b.fee, b.netAmount, STATUS_META[b.status].label, b.cycle, b.createdAt,
      ])
    );
  };

  const openPayout = (batchId?: string) => {
    setPayoutOpen(true);
    const id = batchId || pendingBatches[0]?.id || "";
    setPayoutBatchId(id);
    const b = rows.find((x) => x.id === id);
    setPayoutAccount(b?.payoutAccount?.bankName || "");
    setPayoutAmount(b ? String(b.netAmount) : "");
    setPayoutNote("");
  };

  const handleSubmitPayout = async () => {
    if (!payoutBatchId) return;
    setSubmitting(true);
    setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "PAYING" } : r)));
    try {
      const amount = payoutAmount ? Number(payoutAmount) : selectedBatch?.netAmount ?? 0;
      await settlementsApi.createPayout({ batchId: payoutBatchId, amount });
      // 重新拉取该批次状态
      try {
        const updated = await settlementsApi.getSettlementById(payoutBatchId);
        if (updated) {
          setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? updated : r)));
          setDetailBatch((prev) => (prev && prev.id === payoutBatchId ? updated : prev));
        } else {
          setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "PAID" } : r)));
        }
      } catch {
        setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "PAID" } : r)));
      }
      setPayoutOpen(false);
      setToast(t("settlements.toastPayoutSuccess", { id: payoutBatchId }));
      setTimeout(() => setToast(null), 4000);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "FAILED" } : r)));
    } finally {
      setSubmitting(false);
    }
  };

  // M2: 审核通过
  const handleApprove = async (batch: SettlementBatch) => {
    setReviewing(true);
    try {
      const updated = await settlementsApi.approveSettlement(batch.id);
      setRows((prev) => prev.map((r) => (r.id === batch.id ? updated : r)));
      setDetailBatch(updated);
    } catch {
      /* keep sheet open */
    } finally {
      setReviewing(false);
    }
  };

  // M2: 驳回
  const handleReject = async (batch: SettlementBatch) => {
    if (!rejectReason.trim()) return;
    setReviewing(true);
    try {
      const updated = await settlementsApi.rejectSettlement(batch.id, rejectReason.trim());
      setRows((prev) => prev.map((r) => (r.id === batch.id ? updated : r)));
      setDetailBatch(updated);
      setRejectOpen(false);
      setRejectReason("");
    } catch {
      /* keep sheet open */
    } finally {
      setReviewing(false);
    }
  };

  // M2: 上传出金凭证
  const handlePayoutProofFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailBatch) return;
    setUploadingProof(true);
    try {
      const updated = await settlementsApi.uploadPayoutProof(detailBatch.id, file);
      setRows((prev) => prev.map((r) => (r.id === detailBatch.id ? updated : r)));
      setDetailBatch(updated);
    } catch {
      /* ignore */
    } finally {
      setUploadingProof(false);
      if (payoutProofInputRef.current) payoutProofInputRef.current.value = "";
    }
  };

  // M2: 批次补单
  const handleSupplement = async (batch: SettlementBatch) => {
    setSupplementingId(batch.id);
    try {
      const result = await settlementsApi.supplementBatch(batch.id);
      const updated = await settlementsApi.getSettlementById(batch.id);
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === batch.id ? updated : r)));
        setDetailBatch(updated);
      }
      setToast(t("settlements.toastSupplementSuccess", { count: result.addedCount }));
      setTimeout(() => setToast(null), 4000);
    } catch {
      /* ignore */
    } finally {
      setSupplementingId(null);
    }
  };

  const viewLoading = useViewLoading();
  const loading = viewLoading || dataLoading;
  if (loading) return <TableSkeleton rows={9} cols={8} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("settlements.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("settlements.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 border border-line hover:bg-hover text-fg-secondary rounded-lg text-xs font-semibold transition-colors">
            <Download className="w-4 h-4" />
            {t("commerce:common.exportCsv")}
          </button>
          <button onClick={() => openPayout()} disabled={pendingBatches.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40">
            <PlusCircle className="w-4 h-4" />
            {t("settlements.initiatePayout")}
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold">✕</button>
        </div>
      )}

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("commerce:common.statusLabel")}</span>
          {(["ALL", "PENDING", "UNDER_REVIEW", "APPROVED", "PAYING", "PAID", "REJECTED", "FAILED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
              {s === "ALL" ? t("commerce:common.all") : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input type="text" placeholder={t("settlements.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("settlements.table.batchId")}</th>
                <th className="py-2 px-3">{t("settlements.table.merchant")}</th>
                <th className="py-2 px-3">{t("settlements.table.channel")}</th>
                <th className="py-2 px-3 text-right">{t("settlements.table.receivable")}</th>
                <th className="py-2 px-3 text-right">{t("settlements.table.fee")}</th>
                <th className="py-2 px-3 text-right">{t("settlements.table.net")}</th>
                <th className="py-2 px-3">{t("settlements.table.status")}</th>
                <th className="py-2 px-3">{t("settlements.table.cycle")}</th>
                <th className="py-2 px-3">{t("settlements.table.createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<SettlementBatch>(filtered, currentPage, pageSize).map((b) => {
                const sm = STATUS_META[b.status];
                return (
                  <ContextMenu
                    key={b.id}
                    items={[
                      { key: "view", label: t("settlements.menu.viewDetail"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailBatch(b) },
                      { key: "approve", label: t("settlements.menu.approve"), icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: b.status !== "PENDING" && b.status !== "UNDER_REVIEW", onClick: () => handleApprove(b) },
                      { key: "payout", label: t("settlements.menu.initiatePayout"), icon: <ArrowRightLeft className="w-3.5 h-3.5" />, disabled: b.status !== "APPROVED", onClick: () => openPayout(b.id) },
                      { key: "refresh", label: t("settlements.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRows((prev) => [...prev]) },
                    ]}
                    trigger={
                      <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3"><div className="font-mono font-medium text-fg truncate max-w-[180px]" title={b.id}>{b.id}</div></td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TENANT_LABEL[b.tenantId]}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary uppercase">{CHANNEL_LABEL[b.channel] || b.channel}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg">{fmt(b.receivableAmount, b.currency)}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg-secondary">{fmt(b.fee, b.currency)}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">{fmt(b.netAmount, b.currency)}</td>
                        <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span></td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary">{b.cycle}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{b.createdAt}</td>
                      </tr>
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
      </div>

      <SideSheet
        id="settlement-detail"
        isOpen={!!detailBatch}
        onClose={() => setDetailBatch(null)}
        title={detailBatch ? t("settlements.detail.title", { id: detailBatch.id }) : t("settlements.detail.titleFallback")}
        description={detailBatch ? `${CHANNEL_LABEL[detailBatch.channel] || detailBatch.channel} · ${detailBatch.cycle} · ${STATUS_META[detailBatch.status].label}` : ""}
        icon={<FileSpreadsheet className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          detailBatch && (detailBatch.status === "PENDING" || detailBatch.status === "UNDER_REVIEW") ? (
            <div className="flex items-center gap-2">
              {rejectOpen ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("settlements.detail.rejectReasonPlaceholder")}
                    className="flex-1 px-3 py-2 bg-subtle border border-line rounded-lg text-xs"
                    autoFocus
                  />
                  <Popconfirm
                    title={t("settlements.detail.rejectTitle")}
                    description={t("settlements.detail.rejectDesc", { reason: rejectReason || t("settlements.detail.rejectEmpty") })}
                    confirmText={t("settlements.detail.rejectConfirm")}
                    onConfirm={() => handleReject(detailBatch)}
                  >
                    <button
                      disabled={reviewing || !rejectReason.trim()}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      {reviewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {t("settlements.detail.rejectBtn")}
                    </button>
                  </Popconfirm>
                  <button onClick={() => { setRejectOpen(false); setRejectReason(""); }} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">
                    {t("commerce:common.cancel")}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setRejectOpen(true)}
                    disabled={reviewing}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" /> {t("settlements.detail.rejectBtn")}
                  </button>
                  <button
                    onClick={() => handleApprove(detailBatch)}
                    disabled={reviewing}
                    className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {t("settlements.detail.approveBtn")}
                  </button>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => setDetailBatch(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:actions.close")}</button>
          )
        }
      >
        {detailBatch && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("settlements.detail.receivable")}</div>
                <div className="font-mono font-semibold text-fg mt-1">{fmt(detailBatch.receivableAmount, detailBatch.currency)}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("settlements.detail.feeTotal")}</div>
                <div className="font-mono font-semibold text-fg-secondary mt-1">-{fmt(detailBatch.fee, detailBatch.currency)}</div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <div className="text-[11px] text-emerald-700">{t("settlements.detail.net")}</div>
                <div className="font-mono font-semibold text-emerald-700 mt-1">{fmt(detailBatch.netAmount, detailBatch.currency)}</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> {t("settlements.detail.txDetail")}
              </div>
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-subtle border-b border-line text-fg-secondary text-[11px]">
                      <th className="py-2 px-3">{t("settlements.detail.txTable.tradeNo")}</th>
                      <th className="py-2 px-3">{t("settlements.detail.txTable.product")}</th>
                      <th className="py-2 px-3 text-right">{t("settlements.detail.txTable.amount")}</th>
                      <th className="py-2 px-3 text-right">{t("settlements.detail.txTable.fee")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {detailBatch.txItems.map((tx) => (
                      <tr key={tx.tradeNo}>
                        <td className="py-2 px-3 font-mono text-[11px] text-fg truncate max-w-[180px]" title={tx.tradeNo}>{tx.tradeNo}</td>
                        <td className="py-2 px-3 text-fg-secondary truncate max-w-[140px]" title={tx.orderTitle}>{tx.orderTitle || "-"}</td>
                        <td className="py-2 px-3 text-right font-mono text-fg">{fmt(tx.amount, detailBatch.currency)}</td>
                        <td className="py-2 px-3 text-right font-mono text-fg-secondary">{fmt(tx.fee, detailBatch.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="font-semibold text-fg mb-2">{t("settlements.detail.feeBreakdown")}</div>
              <div className="space-y-1.5">
                {[
                  { label: t("settlements.detail.fees.channel"), value: detailBatch.fees.channelFee },
                  { label: t("settlements.detail.fees.fx"), value: detailBatch.fees.fxGainLoss },
                  { label: t("settlements.detail.fees.platform"), value: detailBatch.fees.platformFee },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between bg-subtle px-3 py-2 rounded-lg border border-line">
                    <span className="text-fg-secondary">{f.label}</span>
                    <span className={`font-mono ${f.value < 0 ? "text-rose-600" : "text-fg"}`}>{fmt(f.value, detailBatch.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
            {detailBatch.payoutAccount && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-fg-tertiary" /> {t("settlements.detail.payoutAccount")}
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-fg">{detailBatch.payoutAccount.bankName}</div>
                    <div className="text-[11px] text-fg-tertiary font-mono mt-0.5">{t("settlements.detail.last4", { last4: detailBatch.payoutAccount.accountLast4 })}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary border border-line">{detailBatch.payoutAccount.currency}</span>
                </div>
              </div>
            )}
            {detailBatch.rejectReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                <span className="font-semibold">{t("settlements.detail.rejectReasonPrefix")}</span> {detailBatch.rejectReason}
              </div>
            )}

            {/* M2: 审核信息 */}
            {(detailBatch.reviewer || detailBatch.reviewedAt || detailBatch.approvedAt) && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-fg-tertiary" /> {t("settlements.detail.reviewInfo")}
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5 text-[11px]">
                  {detailBatch.reviewer && (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-secondary">{t("settlements.detail.reviewer")}</span>
                      <span className="text-fg font-medium">{detailBatch.reviewer}</span>
                    </div>
                  )}
                  {detailBatch.reviewedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-secondary">{t("settlements.detail.reviewedAt")}</span>
                      <span className="text-fg font-mono">{detailBatch.reviewedAt}</span>
                    </div>
                  )}
                  {detailBatch.approvedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-secondary">{t("settlements.detail.approvedAt")}</span>
                      <span className="text-fg font-mono">{detailBatch.approvedAt}</span>
                    </div>
                  )}
                  {detailBatch.paidAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-fg-secondary">{t("settlements.detail.paidAt")}</span>
                      <span className="text-fg font-mono">{detailBatch.paidAt}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* M2: 出金凭证上传 (APPROVED / PAYING 状态) */}
            {(detailBatch.status === "APPROVED" || detailBatch.status === "PAYING") && (
              <div>
                <input ref={payoutProofInputRef} type="file" accept=".pdf,.png,.jpg" className="hidden" onChange={handlePayoutProofFile} />
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-fg flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-fg-tertiary" /> {t("settlements.detail.payoutProofTitle")}
                  </span>
                  <button
                    onClick={() => payoutProofInputRef.current?.click()}
                    disabled={uploadingProof}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-line text-fg-secondary hover:bg-hover text-[11px] font-medium disabled:opacity-40"
                  >
                    {uploadingProof ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploadingProof ? t("settlements.detail.uploading") : t("settlements.detail.uploadProof")}
                  </button>
                </div>
                {detailBatch.payoutProof && detailBatch.payoutProof.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailBatch.payoutProof.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-subtle px-3 py-2 rounded-lg border border-line">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-fg-tertiary shrink-0" />
                          <span className="truncate text-fg text-[11px]">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-fg-tertiary font-mono shrink-0 ml-2">{p.uploadedAt}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-line rounded-xl p-3 text-center text-fg-tertiary text-[11px]">
                    {t("settlements.detail.emptyProof")}
                  </div>
                )}
              </div>
            )}

            {/* M2: 批次补单 */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-fg-tertiary">{t("settlements.detail.supplementHint")}</span>
              <button
                onClick={() => handleSupplement(detailBatch)}
                disabled={supplementingId === detailBatch.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-fg-secondary hover:bg-hover text-[11px] font-medium disabled:opacity-40"
              >
                {supplementingId === detailBatch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                {t("settlements.detail.supplement")}
              </button>
            </div>

            {detailBatch.remark && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">{detailBatch.remark}</div>
            )}
          </div>
        )}
      </SideSheet>

      <SideSheet
        id="settlement-payout"
        isOpen={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title={t("settlements.payout.title")}
        description={t("settlements.payout.description")}
        icon={<ArrowRightLeft className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setPayoutOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSubmitPayout} disabled={submitting || !payoutBatchId} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? t("settlements.payout.processing") : t("settlements.payout.confirm")}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("settlements.payout.batch")}</label>
            <ShadcnSelect
              value={payoutBatchId}
              onValueChange={(v) => {
                setPayoutBatchId(v);
                const b = rows.find((x) => x.id === v);
                setPayoutAccount(b?.payoutAccount?.bankName || "");
                setPayoutAmount(b ? String(b.netAmount) : "");
              }}
              options={pendingBatches.map((b) => ({
                value: b.id,
                label: t("settlements.payout.batchOption", { id: b.id, tenant: TENANT_LABEL[b.tenantId], amount: fmt(b.netAmount, b.currency) }),
              }))}
              placeholder={t("settlements.payout.batchPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("settlements.payout.account")}</label>
            <ShadcnSelect
              value={payoutAccount}
              onValueChange={setPayoutAccount}
              options={[
                { value: "JPMorgan Chase *4471", label: "JPMorgan Chase (4471)" },
                { value: "Deutsche Bank *8821", label: "Deutsche Bank (8821)" },
                { value: "Barclays *3305", label: "Barclays (3305)" },
              ]}
              placeholder={t("settlements.payout.accountPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("settlements.payout.amount")}</label>
            <input type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            {selectedBatch && (
              <div className="text-[11px] text-fg-tertiary mt-1">
                {t("settlements.payout.amountHint", { amount: fmt(selectedBatch.netAmount, selectedBatch.currency) })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("settlements.payout.note")}</label>
            <textarea value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} rows={3} placeholder={t("settlements.payout.notePlaceholder")} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
