import React, { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  Search,
  Eye,
  RefreshCw,
  ShieldAlert,
  Clock,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  XCircle,
  Hourglass,
  PlusCircle,
  AlertTriangle,
  Send,
  Ban,
  Paperclip,
  Download,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { exportToCSV } from "../lib/utils";
import {
  RefundRecord,
  ChargebackRecord,
  RefundStatus,
  ChargebackStatus,
  RefundReason,
  TenantId,
} from "../types/payment";
import * as refundsApi from "../api/modules/refunds";
import { useTranslation } from "react-i18next";

interface RefundsViewProps {
  /** 兼容旧 props 接口；传入时直接使用，未传入时走 API 层获取 */
  refunds?: RefundRecord[];
  chargebacks?: ChargebackRecord[];
}

const CHANNEL_LABEL: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  adyen: "Adyen",
  klarna: "Klarna",
  checkout: "Checkout",
  sepa: "SEPA",
  creem: "Creem",
};

const fmt = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REFUND_REASONS: RefundReason[] = ["客户要求", "商品缺陷", "重复扣款", "欺诈疑似", "其他"];

export const RefundsView: React.FC<RefundsViewProps> = ({ refunds, chargebacks }) => {
  const { t } = useTranslation(["products", "common"]);

  const TENANT_LABEL = useMemo(
    (): Record<TenantId, string> => ({
      group_hq: t("refunds.tenants.group_hq"),
      bu_na_ecom: t("refunds.tenants.bu_na_ecom"),
      bu_eu_saas: t("refunds.tenants.bu_eu_saas"),
      bu_apac_japan: t("refunds.tenants.bu_apac_japan"),
      bu_latam: t("refunds.tenants.bu_latam"),
    }),
    [t]
  );

  const REFUND_STATUS = useMemo(
    (): Record<RefundStatus, { label: string; badge: string }> => ({
      PENDING_REVIEW: { label: t("refunds.refundStatus.PENDING_REVIEW"), badge: "bg-amber-50 text-amber-700 border-amber-200" },
      PROCESSING: { label: t("refunds.refundStatus.PROCESSING"), badge: "bg-blue-50 text-blue-700 border-blue-200" },
      SUCCESS: { label: t("refunds.refundStatus.SUCCESS"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      FAILED: { label: t("refunds.refundStatus.FAILED"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
    }),
    [t]
  );

  const CB_STATUS = useMemo(
    (): Record<ChargebackStatus, { label: string; badge: string }> => ({
      待响应: { label: t("refunds.cbStatus.待响应"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
      已提交证据: { label: t("refunds.cbStatus.已提交证据"), badge: "bg-blue-50 text-blue-700 border-blue-200" },
      胜诉: { label: t("refunds.cbStatus.胜诉"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      败诉: { label: t("refunds.cbStatus.败诉"), badge: "bg-zinc-100 text-zinc-600 border-zinc-200" },
    }),
    [t]
  );

  const REASON_LABEL_KEY: Record<RefundReason, string> = {
    "客户要求": "customerRequest",
    "商品缺陷": "defect",
    "重复扣款": "duplicate",
    "欺诈疑似": "fraud",
    "其他": "other",
  };

  const refundReasonOptions = useMemo(
    () => REFUND_REASONS.map((r) => ({ value: r, label: t(`refunds.reasons.${REASON_LABEL_KEY[r]}`) })),
    [t]
  );

  const [tab, setTab] = useState<"refund" | "chargeback">("refund");

  // Refund state
  const [refundRows, setRefundRows] = useState<RefundRecord[]>(refunds ?? []);
  const [refundSearch, setRefundSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [refundType, setRefundType] = useState<"PARTIAL" | "FULL">("FULL");
  const [formTransactionNo, setFormTransactionNo] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("客户要求");
  const [refundNote, setRefundNote] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Chargeback state
  const [cbRows, setCbRows] = useState<ChargebackRecord[]>(chargebacks ?? []);
  const [cbSearch, setCbSearch] = useState("");
  const [activeCb, setActiveCb] = useState<ChargebackRecord | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(!refunds || !chargebacks);

  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [tab, refundSearch, cbSearch, reset]);

  // P2: 未传入 props 时通过 API 层取数（按当前环境分桶，带模拟延迟）
  useEffect(() => {
    if (refunds && chargebacks) { setRefundRows(refunds); setCbRows(chargebacks); setDataLoading(false); return; }
    let cancelled = false;
    Promise.all([refundsApi.getRefunds(), refundsApi.getChargebacks()]).then(([r, cb]) => {
      if (cancelled) return;
      setRefundRows(r);
      setCbRows(cb);
      setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, [refunds, chargebacks]);

  const filteredRefunds = useMemo(
    () =>
      refundRows.filter(
        (r) =>
          r.id.toLowerCase().includes(refundSearch.toLowerCase()) ||
          r.transactionNo.toLowerCase().includes(refundSearch.toLowerCase()) ||
          (TENANT_LABEL[r.tenantId] || "").toLowerCase().includes(refundSearch.toLowerCase())
      ),
    [refundRows, refundSearch, TENANT_LABEL]
  );

  const filteredCb = useMemo(
    () =>
      cbRows.filter(
        (c) =>
          c.id.toLowerCase().includes(cbSearch.toLowerCase()) ||
          c.transactionNo.toLowerCase().includes(cbSearch.toLowerCase()) ||
          (TENANT_LABEL[c.tenantId] || "").toLowerCase().includes(cbSearch.toLowerCase())
      ),
    [cbRows, cbSearch, TENANT_LABEL]
  );

  const handleExportRefunds = () => {
    exportToCSV(
      t("refunds.exportFilename"),
      [t("refunds.table.refundId"), t("refunds.table.transactionNo"), t("refunds.table.merchant"), t("refunds.table.channel"), t("refunds.table.refundAmount"), t("refunds.table.originalAmount"), t("refunds.table.reason"), t("refunds.table.reason"), t("refunds.table.status"), t("refunds.table.createdAt")],
      filteredRefunds.map((r) => [
        r.id, r.transactionNo, TENANT_LABEL[r.tenantId], CHANNEL_LABEL[r.channel] || r.channel,
        r.refundAmount, r.originalAmount, r.currency, r.reason, r.refundType, r.status, r.createdAt,
      ])
    );
  };

  const handleCreateRefund = async () => {
    if (!formTransactionNo.trim()) return;
    try {
      const saved = await refundsApi.createRefund({
        transactionNo: formTransactionNo.trim(),
        refundAmount: refundType === "PARTIAL" ? Number(refundAmount || 0) : undefined,
        reason: refundReason,
        refundType,
        note: refundNote,
      });
      setRefundRows((prev) => [saved, ...prev]);
      setCreateOpen(false);
      setFormTransactionNo("");
      setRefundNote("");
    } catch {
      /* keep sheet open */
    }
  };

  const handleProcessRefund = async (r: RefundRecord) => {
    setProcessingId(r.id);
    try {
      const updated = await refundsApi.processRefund(r.id);
      setRefundRows((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } finally {
      setProcessingId(null);
    }
  };

  const handleUploadEvidence = async () => {
    if (!activeCb) return;
    const fileName = `${t("refunds.evidenceFilePrefix")}_${Date.now().toString().slice(-4)}.pdf`;
    const fileSize = `${(Math.random() * 2 + 0.3).toFixed(1)} MB`;
    try {
      const updated = await refundsApi.addChargebackEvidence(activeCb.id, { name: fileName, size: fileSize });
      setCbRows((prev) => prev.map((c) => (c.id === activeCb.id ? updated : c)));
      setActiveCb(updated);
    } catch {
      /* ignore */
    }
  };

  const handleSubmitEvidence = async () => {
    if (!activeCb) return;
    try {
      const updated = await refundsApi.submitChargeback(activeCb.id);
      setCbRows((prev) => prev.map((c) => (c.id === activeCb.id ? updated : c)));
      setActiveCb(updated);
    } catch {
      /* ignore */
    }
  };

  const handleAcceptCb = (id: string) => {
    setCbRows((prev) => prev.map((c) => (c.id === id ? { ...c, status: "败诉" } : c)));
    setActiveCb(null);
  };

  const viewLoading = useViewLoading();
  const loading = viewLoading || dataLoading;
  if (loading) return <TableSkeleton rows={9} cols={7} />;

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
            <RotateCcw className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("refunds.title")}</h1>
            <p className="text-xs text-fg-secondary mt-0.5">{t("refunds.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "refund", label: t("refunds.tabs.refund") },
            { key: "chargeback", label: t("refunds.tabs.chargeback") },
          ].map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as "refund" | "chargeback")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === tabItem.key ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== REFUND TAB ==================== */}
      {tab === "refund" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input
                type="text"
                placeholder={t("refunds.searchRefund")}
                value={refundSearch}
                onChange={(e) => setRefundSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportRefunds}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-line hover:bg-hover text-fg-secondary rounded-lg text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                {t("refunds.exportCsv")}
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card"
              >
                <PlusCircle className="w-4 h-4" />
                {t("refunds.createRefund")}
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("refunds.table.refundId")}</th>
                    <th className="py-2 px-3">{t("refunds.table.transactionNo")}</th>
                    <th className="py-2 px-3">{t("refunds.table.merchant")}</th>
                    <th className="py-2 px-3">{t("refunds.table.channel")}</th>
                    <th className="py-2 px-3 text-right">{t("refunds.table.refundAmount")}</th>
                    <th className="py-2 px-3 text-right">{t("refunds.table.originalAmount")}</th>
                    <th className="py-2 px-3">{t("refunds.table.reason")}</th>
                    <th className="py-2 px-3">{t("refunds.table.status")}</th>
                    <th className="py-2 px-3">{t("refunds.table.createdAt")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<RefundRecord>(filteredRefunds, currentPage, pageSize).map((r) => {
                    const sm = REFUND_STATUS[r.status];
                    const processing = processingId === r.id;
                    return (
                      <ContextMenu
                        key={r.id}
                        items={[
                          { key: "view", label: t("refunds.menu.view"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setSelectedRefund(r) },
                          {
                            key: "process",
                            label: t("refunds.menu.process"),
                            icon: <Send className="w-3.5 h-3.5" />,
                            disabled: r.status === "SUCCESS" || r.status === "FAILED",
                            onClick: () => handleProcessRefund(r),
                          },
                          {
                            key: "refresh",
                            label: t("refunds.menu.refresh"),
                            icon: <RefreshCw className="w-3.5 h-3.5" />,
                            onClick: () => setRefundRows((prev) => [...prev]),
                          },
                        ]}
                        trigger={
                          <tr onClick={() => setSelectedRefund(r)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3">
                              <div className="font-mono font-medium text-fg truncate max-w-[150px]" title={r.id}>{r.id}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary truncate max-w-[150px]" title={r.transactionNo}>
                              {r.transactionNo}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TENANT_LABEL[r.tenantId]}</td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary uppercase">
                              {CHANNEL_LABEL[r.channel] || r.channel}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600">{fmt(r.refundAmount, r.currency)}</td>
                            <td className="py-3 px-3 text-right font-mono text-fg-secondary">{fmt(r.originalAmount, r.currency)}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{r.reason}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>
                                {r.status === "PROCESSING" ? <Loader2 className="w-3 h-3 animate-spin" /> : r.status === "SUCCESS" ? <CheckCircle2 className="w-3 h-3" /> : r.status === "FAILED" ? <XCircle className="w-3 h-3" /> : <Hourglass className="w-3 h-3" />}
                                {sm.label}{processing ? "..." : ""}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{r.createdAt}</td>
                          </tr>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalItems={filteredRefunds.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>

          {/* Create Refund SideSheet */}
          <SideSheet
            id="refund-create"
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            title={t("refunds.create.title")}
            description={t("refunds.create.description")}
            icon={<RotateCcw className="w-5 h-5 text-fg" />}
            widthClass="max-w-xl max-md:max-w-none"
            footer={
              <>
                <button onClick={() => setCreateOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">
                  {t("refunds.create.cancel")}
                </button>
                <button onClick={handleCreateRefund} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card">
                  {t("refunds.create.submit")}
                </button>
              </>
            }
          >
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("refunds.create.transactionNoLabel")}</label>
                <input
                  value={formTransactionNo}
                  onChange={(e) => setFormTransactionNo(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono"
                  placeholder={t("refunds.create.transactionNoPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("refunds.create.methodLabel")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["FULL", "PARTIAL"] as const).map((rt) => (
                    <button
                      key={rt}
                      onClick={() => setRefundType(rt)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        refundType === rt ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface text-fg-secondary hover:bg-hover"
                      }`}
                    >
                      {rt === "FULL" ? t("refunds.create.full") : t("refunds.create.partial")}
                    </button>
                  ))}
                </div>
              </div>
              {refundType === "PARTIAL" && (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">{t("refunds.create.amountLabel")}</label>
                  <input
                    type="number"
                    max={99}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono"
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("refunds.create.reasonLabel")}</label>
                <ShadcnSelect value={refundReason} onValueChange={setRefundReason} options={refundReasonOptions} />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("refunds.create.noteLabel")}</label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  placeholder={t("refunds.create.notePlaceholder")}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none"
                />
              </div>
            </div>
          </SideSheet>

          {/* Refund Detail SideSheet */}
          <SideSheet
            id="refund-detail"
            isOpen={!!selectedRefund}
            onClose={() => setSelectedRefund(null)}
            title={selectedRefund ? t("refunds.detail.titleWithId", { id: selectedRefund.id }) : t("refunds.detail.title")}
            description={selectedRefund ? `${selectedRefund.transactionNo} · ${REFUND_STATUS[selectedRefund.status].label}` : ""}
            icon={<RotateCcw className="w-5 h-5 text-fg" />}
            widthClass="max-w-xl max-md:max-w-none"
            footer={
              <button onClick={() => setSelectedRefund(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
                {t("refunds.detail.close")}
              </button>
            }
          >
            {selectedRefund && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("refunds.detail.refundAmount")}</div>
                    <div className="font-mono font-semibold text-rose-600 mt-1">{fmt(selectedRefund.refundAmount, selectedRefund.currency)}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("refunds.detail.originalAmount")}</div>
                    <div className="font-mono font-semibold text-fg mt-1">{fmt(selectedRefund.originalAmount, selectedRefund.currency)}</div>
                  </div>
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
                  {[
                    { label: t("refunds.detail.refundId"), value: selectedRefund.id, mono: true },
                    { label: t("refunds.detail.transactionNo"), value: selectedRefund.transactionNo, mono: true },
                    { label: t("refunds.detail.merchant"), value: TENANT_LABEL[selectedRefund.tenantId] },
                    { label: t("refunds.detail.channel"), value: CHANNEL_LABEL[selectedRefund.channel] || selectedRefund.channel },
                    { label: t("refunds.detail.method"), value: selectedRefund.refundType === "FULL" ? t("refunds.create.full") : t("refunds.create.partial") },
                    { label: t("refunds.detail.reason"), value: selectedRefund.reason },
                    { label: t("refunds.detail.status"), value: REFUND_STATUS[selectedRefund.status].label },
                    { label: t("refunds.detail.createdAt"), value: selectedRefund.createdAt, mono: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-fg-secondary">{row.label}</span>
                      <span className={`text-fg font-medium ${row.mono ? "font-mono text-[11px]" : ""}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {selectedRefund.note && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">{t("refunds.detail.notePrefix")}{selectedRefund.note}</div>
                )}
              </div>
            )}
          </SideSheet>
        </>
      )}

      {/* ==================== CHARGEBACK TAB ==================== */}
      {tab === "chargeback" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input
                type="text"
                placeholder={t("refunds.searchChargeback")}
                value={cbSearch}
                onChange={(e) => setCbSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
              />
            </div>
            <span className="text-[11px] text-fg-tertiary">{t("refunds.pendingDisputes", { count: cbRows.filter((c) => c.status === "待响应").length })}</span>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("refunds.table.chargebackId")}</th>
                    <th className="py-2 px-3">{t("refunds.table.transactionNo")}</th>
                    <th className="py-2 px-3">{t("refunds.table.merchant")}</th>
                    <th className="py-2 px-3">{t("refunds.table.channel")}</th>
                    <th className="py-2 px-3 text-right">{t("refunds.table.disputeAmount")}</th>
                    <th className="py-2 px-3">{t("refunds.table.disputeReason")}</th>
                    <th className="py-2 px-3">{t("refunds.table.status")}</th>
                    <th className="py-2 px-3">{t("refunds.table.deadline")}</th>
                    <th className="py-2 px-3 text-right">{t("refunds.table.remainingDays")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<ChargebackRecord>(filteredCb, currentPage, pageSize).map((c) => {
                    const sm = CB_STATUS[c.status];
                    return (
                      <ContextMenu
                        key={c.id}
                        items={[
                          { key: "view", label: t("refunds.menu.view"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setActiveCb(c) },
                          {
                            key: "handle",
                            label: t("refunds.menu.handle"),
                            icon: <ShieldAlert className="w-3.5 h-3.5" />,
                            disabled: c.status === "胜诉" || c.status === "败诉",
                            onClick: () => setActiveCb(c),
                          },
                          {
                            key: "refresh",
                            label: t("refunds.menu.refresh"),
                            icon: <RefreshCw className="w-3.5 h-3.5" />,
                            onClick: () => setCbRows((prev) => [...prev]),
                          },
                        ]}
                        trigger={
                          <tr onClick={() => setActiveCb(c)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3">
                              <div className="font-mono font-medium text-fg truncate max-w-[150px]" title={c.id}>{c.id}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary truncate max-w-[150px]" title={c.transactionNo}>
                              {c.transactionNo}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TENANT_LABEL[c.tenantId]}</td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary uppercase">
                              {CHANNEL_LABEL[c.channel] || c.channel}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600">{fmt(c.amount, c.currency)}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{c.reason}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.label}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{c.deadline}</td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {c.remainingDays > 0 ? (
                                <span className="font-mono text-rose-600 font-semibold">{t("refunds.chargeback.daysLeft", { count: c.remainingDays })}</span>
                              ) : (
                                <span className="font-mono text-fg-tertiary">{t("refunds.chargeback.expired")}</span>
                              )}
                            </td>
                          </tr>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalItems={filteredCb.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>

          {/* Chargeback Detail SideSheet */}
          <SideSheet
            id="cb-detail"
            isOpen={!!activeCb}
            onClose={() => setActiveCb(null)}
            title={activeCb ? t("refunds.chargeback.titleWithId", { id: activeCb.id }) : t("refunds.chargeback.title")}
            description={activeCb ? `${activeCb.reason} · ${CHANNEL_LABEL[activeCb.channel] || activeCb.channel} · ${CB_STATUS[activeCb.status].label}` : ""}
            icon={<ShieldAlert className="w-5 h-5 text-fg" />}
            widthClass="max-w-2xl max-md:max-w-none"
            footer={
              activeCb && activeCb.status === "待响应" ? (
                <div className="flex items-center gap-2">
                  <Popconfirm
                    title={t("refunds.chargeback.acceptTitle")}
                    description={t("refunds.chargeback.acceptDesc", { amount: fmt(activeCb.amount, activeCb.currency) })}
                    confirmText={t("refunds.chargeback.acceptConfirm")}
                    onConfirm={() => handleAcceptCb(activeCb.id)}
                  >
                    <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                      <Ban className="w-3.5 h-3.5" /> {t("refunds.chargeback.accept")}
                    </button>
                  </Popconfirm>
                  <button
                    onClick={handleSubmitEvidence}
                    disabled={activeCb.evidence.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" /> {t("refunds.chargeback.submitEvidence")}
                  </button>
                </div>
              ) : (
                <button onClick={() => setActiveCb(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
                  {t("refunds.detail.close")}
                </button>
              )
            }
          >
            {activeCb && (
              <div className="space-y-4 text-xs">
                {/* Dispute info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("refunds.chargeback.disputeAmount")}</div>
                    <div className="font-mono font-semibold text-rose-600 mt-1">{fmt(activeCb.amount, activeCb.currency)}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("refunds.chargeback.responseDeadline")}</div>
                    <div className="font-mono font-semibold text-fg mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-fg-tertiary" /> {activeCb.deadline}
                    </div>
                  </div>
                </div>

                {/* Evidence upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-fg flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-fg-tertiary" /> {t("refunds.chargeback.evidenceTitle", { count: activeCb.evidence.length })}
                    </span>
                    <button
                      onClick={handleUploadEvidence}
                      disabled={activeCb.status !== "待响应"}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-line text-fg-secondary hover:bg-hover text-[11px] font-medium disabled:opacity-40"
                    >
                      <Upload className="w-3.5 h-3.5" /> {t("refunds.chargeback.upload")}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activeCb.evidence.length === 0 && (
                      <div className="border border-dashed border-line rounded-xl p-4 text-center text-fg-tertiary text-[11px]">
{t("refunds.chargeback.emptyEvidence")}
                      </div>
                    )}
                    {activeCb.evidence.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between bg-subtle px-3 py-2 rounded-lg border border-line">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-fg-tertiary shrink-0" />
                          <span className="truncate text-fg" title={ev.name}>{ev.name}</span>
                        </div>
                        <span className="text-[10px] text-fg-tertiary font-mono shrink-0 ml-2">{ev.size}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <span className="font-semibold text-fg block mb-2">{t("refunds.chargeback.timeline")}</span>
                  <div className="space-y-0 relative">
                    {activeCb.timeline.map((step, i) => (
                      <div key={i} className="flex gap-3 pb-3 relative">
                        {i < activeCb.timeline.length - 1 && <div className="absolute left-[5px] top-3 w-px h-full bg-line" />}
                        <span
                          className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                            step.status === "completed" ? "bg-emerald-500" : step.status === "current" ? "bg-blue-500 animate-pulse" : "bg-zinc-300"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className={`font-semibold ${step.status === "pending" ? "text-fg-tertiary" : "text-fg"}`}>{step.title}</div>
                          {step.description && <div className="text-[11px] text-fg-secondary mt-0.5">{step.description}</div>}
                          <div className="text-[10px] text-fg-tertiary font-mono mt-0.5">{step.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {activeCb.status === "胜诉" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {t("refunds.chargeback.won")}
                  </div>
                )}
                {activeCb.status === "败诉" && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {t("refunds.chargeback.lost")}
                  </div>
                )}
              </div>
            )}
          </SideSheet>
        </>
      )}
    </div>
  );
};
