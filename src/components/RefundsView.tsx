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

interface RefundsViewProps {
  refunds: RefundRecord[];
  chargebacks: ChargebackRecord[];
}

const TENANT_LABEL: Record<TenantId, string> = {
  group_hq: "全球总部",
  bu_na_ecom: "北美电商",
  bu_eu_saas: "欧洲SaaS",
  bu_apac_japan: "亚太日本",
  bu_latam: "拉美新兴",
};

const CHANNEL_LABEL: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  adyen: "Adyen",
  klarna: "Klarna",
  checkout: "Checkout",
  sepa: "SEPA",
};

const REFUND_STATUS: Record<RefundStatus, { label: string; badge: string }> = {
  PENDING_REVIEW: { label: "待审核", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  PROCESSING: { label: "处理中", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  SUCCESS: { label: "成功", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  FAILED: { label: "失败", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const CB_STATUS: Record<ChargebackStatus, { label: string; badge: string }> = {
  待响应: { label: "待响应", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  已提交证据: { label: "已提交证据", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  胜诉: { label: "胜诉", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  败诉: { label: "败诉", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

const fmt = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REFUND_REASONS: RefundReason[] = ["客户要求", "商品缺陷", "重复扣款", "欺诈疑似", "其他"];

export const RefundsView: React.FC<RefundsViewProps> = ({ refunds, chargebacks }) => {
  const [tab, setTab] = useState<"refund" | "chargeback">("refund");

  // Refund state
  const [refundRows, setRefundRows] = useState<RefundRecord[]>(refunds);
  const [refundSearch, setRefundSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [refundType, setRefundType] = useState<"PARTIAL" | "FULL">("FULL");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("客户要求");
  const [refundNote, setRefundNote] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Chargeback state
  const [cbRows, setCbRows] = useState<ChargebackRecord[]>(chargebacks);
  const [cbSearch, setCbSearch] = useState("");
  const [activeCb, setActiveCb] = useState<ChargebackRecord | null>(null);

  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [tab, refundSearch, cbSearch, reset]);

  const filteredRefunds = useMemo(
    () =>
      refundRows.filter(
        (r) =>
          r.id.toLowerCase().includes(refundSearch.toLowerCase()) ||
          r.transactionNo.toLowerCase().includes(refundSearch.toLowerCase()) ||
          (TENANT_LABEL[r.tenantId] || "").toLowerCase().includes(refundSearch.toLowerCase())
      ),
    [refundRows, refundSearch]
  );

  const filteredCb = useMemo(
    () =>
      cbRows.filter(
        (c) =>
          c.id.toLowerCase().includes(cbSearch.toLowerCase()) ||
          c.transactionNo.toLowerCase().includes(cbSearch.toLowerCase()) ||
          (TENANT_LABEL[c.tenantId] || "").toLowerCase().includes(cbSearch.toLowerCase())
      ),
    [cbRows, cbSearch]
  );

  const handleExportRefunds = () => {
    exportToCSV(
      "退款记录表",
      ["退款单号", "关联交易号", "商户", "渠道", "退款金额", "原金额", "货币", "原因", "类型", "状态", "创建时间"],
      filteredRefunds.map((r) => [
        r.id, r.transactionNo, TENANT_LABEL[r.tenantId], CHANNEL_LABEL[r.channel] || r.channel,
        r.refundAmount, r.originalAmount, r.currency, r.reason, r.refundType, r.status, r.createdAt,
      ])
    );
  };

  const handleCreateRefund = () => {
    const newRefund: RefundRecord = {
      id: `ref_${Date.now().toString().slice(-8)}`,
      transactionNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      tenantId: "bu_na_ecom",
      channel: "stripe",
      refundAmount: refundType === "FULL" ? 99 : Number(refundAmount || 0),
      originalAmount: 99,
      currency: "USD",
      reason: refundReason as RefundReason,
      status: "PROCESSING",
      refundType,
      note: refundNote,
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    setRefundRows((prev) => [newRefund, ...prev]);
    setCreateOpen(false);
    setRefundNote("");
  };

  const handleProcessRefund = (r: RefundRecord) => {
    setProcessingId(r.id);
    setTimeout(() => {
      setRefundRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "SUCCESS" } : x)));
      setProcessingId(null);
    }, 1000);
  };

  const handleUploadEvidence = () => {
    if (!activeCb) return;
    const newEv = {
      id: `ev_${Date.now()}`,
      name: `抗辩材料_${Date.now().toString().slice(-4)}.pdf`,
      size: `${(Math.random() * 2 + 0.3).toFixed(1)} MB`,
      uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    setCbRows((prev) =>
      prev.map((c) => (c.id === activeCb.id ? { ...c, evidence: [...c.evidence, newEv] } : c))
    );
    setActiveCb((prev) => (prev ? { ...prev, evidence: [...prev.evidence, newEv] } : prev));
  };

  const handleSubmitEvidence = () => {
    if (!activeCb) return;
    setCbRows((prev) => prev.map((c) => (c.id === activeCb.id ? { ...c, status: "已提交证据" } : c)));
    setActiveCb((prev) => (prev ? { ...prev, status: "已提交证据" } : prev));
  };

  const handleAcceptCb = (id: string) => {
    setCbRows((prev) => prev.map((c) => (c.id === id ? { ...c, status: "败诉" } : c)));
    setActiveCb(null);
  };

  const loading = useViewLoading();
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
            <h1 className="text-xl font-bold text-fg tracking-tight">退款与拒付管理</h1>
            <p className="text-xs text-fg-secondary mt-0.5">退款审核处理、资金原路退回，以及 Chargeback 争议证据抗辩全流程。</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "refund", label: "退款管理" },
            { key: "chargeback", label: "拒付 / Chargeback" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "refund" | "chargeback")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {t.label}
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
                placeholder="搜索退款单号 / 交易号 / 商户..."
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
                导出 CSV
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card"
              >
                <PlusCircle className="w-4 h-4" />
                发起退款
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">退款单号</th>
                    <th className="py-2 px-3">关联交易号</th>
                    <th className="py-2 px-3">商户</th>
                    <th className="py-2 px-3">渠道</th>
                    <th className="py-2 px-3 text-right">退款金额</th>
                    <th className="py-2 px-3 text-right">原交易金额</th>
                    <th className="py-2 px-3">原因</th>
                    <th className="py-2 px-3">状态</th>
                    <th className="py-2 px-3">申请时间</th>
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
                          { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setSelectedRefund(r) },
                          {
                            key: "process",
                            label: "处理退款",
                            icon: <Send className="w-3.5 h-3.5" />,
                            disabled: r.status === "SUCCESS" || r.status === "FAILED",
                            onClick: () => handleProcessRefund(r),
                          },
                          {
                            key: "refresh",
                            label: "刷新",
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
            title="发起退款"
            description="选择退款方式与原因，提交后进入处理中，约 1 秒完成原路退回"
            icon={<RotateCcw className="w-5 h-5 text-fg" />}
            widthClass="max-w-xl max-md:max-w-none"
            footer={
              <>
                <button onClick={() => setCreateOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">
                  取消
                </button>
                <button onClick={handleCreateRefund} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card">
                  提交退款
                </button>
              </>
            }
          >
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">退款方式</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["FULL", "PARTIAL"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRefundType(t)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        refundType === t ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface text-fg-secondary hover:bg-hover"
                      }`}
                    >
                      {t === "FULL" ? "全额退款" : "部分退款"}
                    </button>
                  ))}
                </div>
              </div>
              {refundType === "PARTIAL" && (
                <div>
                  <label className="block text-fg-secondary mb-1.5 font-medium">退款金额（不超过原交易 $99.00）</label>
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
                <label className="block text-fg-secondary mb-1.5 font-medium">退款原因</label>
                <ShadcnSelect value={refundReason} onValueChange={setRefundReason} options={REFUND_REASONS.map((r) => ({ value: r, label: r }))} />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">备注</label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  placeholder="退款说明..."
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
            title={selectedRefund ? `退款详情 - ${selectedRefund.id}` : "退款详情"}
            description={selectedRefund ? `${selectedRefund.transactionNo} · ${REFUND_STATUS[selectedRefund.status].label}` : ""}
            icon={<RotateCcw className="w-5 h-5 text-fg" />}
            widthClass="max-w-xl max-md:max-w-none"
            footer={
              <button onClick={() => setSelectedRefund(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
                关闭
              </button>
            }
          >
            {selectedRefund && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">退款金额</div>
                    <div className="font-mono font-semibold text-rose-600 mt-1">{fmt(selectedRefund.refundAmount, selectedRefund.currency)}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">原交易金额</div>
                    <div className="font-mono font-semibold text-fg mt-1">{fmt(selectedRefund.originalAmount, selectedRefund.currency)}</div>
                  </div>
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
                  {[
                    { label: "退款单号", value: selectedRefund.id, mono: true },
                    { label: "关联交易号", value: selectedRefund.transactionNo, mono: true },
                    { label: "商户", value: TENANT_LABEL[selectedRefund.tenantId] },
                    { label: "渠道", value: CHANNEL_LABEL[selectedRefund.channel] || selectedRefund.channel },
                    { label: "退款方式", value: selectedRefund.refundType === "FULL" ? "全额退款" : "部分退款" },
                    { label: "退款原因", value: selectedRefund.reason },
                    { label: "状态", value: REFUND_STATUS[selectedRefund.status].label },
                    { label: "申请时间", value: selectedRefund.createdAt, mono: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-fg-secondary">{row.label}</span>
                      <span className={`text-fg font-medium ${row.mono ? "font-mono text-[11px]" : ""}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {selectedRefund.note && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">备注：{selectedRefund.note}</div>
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
                placeholder="搜索拒付单号 / 交易号 / 商户..."
                value={cbSearch}
                onChange={(e) => setCbSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
              />
            </div>
            <span className="text-[11px] text-fg-tertiary">共 {cbRows.filter((c) => c.status === "待响应").length} 笔待响应争议，请及时提交证据</span>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">拒付单号</th>
                    <th className="py-2 px-3">关联交易号</th>
                    <th className="py-2 px-3">商户</th>
                    <th className="py-2 px-3">渠道</th>
                    <th className="py-2 px-3 text-right">争议金额</th>
                    <th className="py-2 px-3">争议原因</th>
                    <th className="py-2 px-3">状态</th>
                    <th className="py-2 px-3">截止时间</th>
                    <th className="py-2 px-3 text-right">剩余天数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<ChargebackRecord>(filteredCb, currentPage, pageSize).map((c) => {
                    const sm = CB_STATUS[c.status];
                    return (
                      <ContextMenu
                        key={c.id}
                        items={[
                          { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setActiveCb(c) },
                          {
                            key: "handle",
                            label: "处理",
                            icon: <ShieldAlert className="w-3.5 h-3.5" />,
                            disabled: c.status === "胜诉" || c.status === "败诉",
                            onClick: () => setActiveCb(c),
                          },
                          {
                            key: "refresh",
                            label: "刷新",
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
                                <span className="font-mono text-rose-600 font-semibold">{c.remainingDays} 天</span>
                              ) : (
                                <span className="font-mono text-fg-tertiary">已到期</span>
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
            title={activeCb ? `拒付争议 - ${activeCb.id}` : "拒付争议详情"}
            description={activeCb ? `${activeCb.reason} · ${CHANNEL_LABEL[activeCb.channel] || activeCb.channel} · ${CB_STATUS[activeCb.status].label}` : ""}
            icon={<ShieldAlert className="w-5 h-5 text-fg" />}
            widthClass="max-w-2xl max-md:max-w-none"
            footer={
              activeCb && activeCb.status === "待响应" ? (
                <div className="flex items-center gap-2">
                  <Popconfirm
                    title="确认接受该笔拒付？"
                    description={`接受后争议金额 ${fmt(activeCb.amount, activeCb.currency)} 将永久从商户账户扣除，不可撤销。`}
                    confirmText="确认接受"
                    onConfirm={() => handleAcceptCb(activeCb.id)}
                  >
                    <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                      <Ban className="w-3.5 h-3.5" /> 接受拒付
                    </button>
                  </Popconfirm>
                  <button
                    onClick={handleSubmitEvidence}
                    disabled={activeCb.evidence.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" /> 提交证据
                  </button>
                </div>
              ) : (
                <button onClick={() => setActiveCb(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
                  关闭
                </button>
              )
            }
          >
            {activeCb && (
              <div className="space-y-4 text-xs">
                {/* Dispute info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">争议金额</div>
                    <div className="font-mono font-semibold text-rose-600 mt-1">{fmt(activeCb.amount, activeCb.currency)}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">响应截止</div>
                    <div className="font-mono font-semibold text-fg mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-fg-tertiary" /> {activeCb.deadline}
                    </div>
                  </div>
                </div>

                {/* Evidence upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-fg flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-fg-tertiary" /> 抗辩证据材料 ({activeCb.evidence.length})
                    </span>
                    <button
                      onClick={handleUploadEvidence}
                      disabled={activeCb.status !== "待响应"}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-line text-fg-secondary hover:bg-hover text-[11px] font-medium disabled:opacity-40"
                    >
                      <Upload className="w-3.5 h-3.5" /> 上传证据
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activeCb.evidence.length === 0 && (
                      <div className="border border-dashed border-line rounded-xl p-4 text-center text-fg-tertiary text-[11px]">
                        暂无证据，请上传物流签收、服务开通或客户沟通记录
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
                  <span className="font-semibold text-fg block mb-2">处理时间线</span>
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
                    <CheckCircle2 className="w-4 h-4" /> 商户胜诉，争议金额已退回账户
                  </div>
                )}
                {activeCb.status === "败诉" && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> 商户败诉，争议金额已扣除
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
