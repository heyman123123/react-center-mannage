import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { SettlementBatch, SettlementStatus, TenantId } from "../types/payment";

interface SettlementsViewProps {
  batches: SettlementBatch[];
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
  apple_pay: "Apple Pay",
};

const STATUS_META: Record<SettlementStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  PENDING: {
    label: "待结算",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Hourglass className="w-3 h-3" />,
  },
  SETTLING: {
    label: "结算中",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  PAID: {
    label: "已出金",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  FAILED: {
    label: "失败",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const fmt = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SettlementsView: React.FC<SettlementsViewProps> = ({ batches }) => {
  const [rows, setRows] = useState<SettlementBatch[]>(batches);
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
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [statusFilter, searchQuery, reset]);

  const filtered = useMemo(() => {
    return rows.filter((b) => {
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      const matchSearch =
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (TENANT_LABEL[b.tenantId] || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [rows, statusFilter, searchQuery]);

  const pendingBatches = rows.filter((b) => b.status === "PENDING");
  const selectedBatch = rows.find((b) => b.id === payoutBatchId) || null;

  const openPayout = (batchId?: string) => {
    setPayoutOpen(true);
    const id = batchId || pendingBatches[0]?.id || "";
    setPayoutBatchId(id);
    const b = rows.find((x) => x.id === id);
    setPayoutAccount(b?.payoutAccount?.bankName || "");
    setPayoutAmount(b ? String(b.netAmount) : "");
    setPayoutNote("");
  };

  const handleSubmitPayout = () => {
    if (!payoutBatchId) return;
    setSubmitting(true);
    // 提交后状态 -> 结算中
    setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "SETTLING" } : r)));
    setTimeout(() => {
      // 模拟 1.5s 后 -> 已出金
      setRows((prev) => prev.map((r) => (r.id === payoutBatchId ? { ...r, status: "PAID" } : r)));
      setSubmitting(false);
      setPayoutOpen(false);
      setToast(`批次 ${payoutBatchId} 出金已成功到账`);
      setTimeout(() => setToast(null), 4000);
    }, 1500);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={8} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">结算与出金管理</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            多币种结算批次归集、渠道费/汇兑损溢/平台服务费明细核算，并支持跨境银行出金申请与状态跟踪。
          </p>
        </div>
        <button
          onClick={() => openPayout()}
          disabled={pendingBatches.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40"
        >
          <PlusCircle className="w-4 h-4" />
          发起出金
        </button>
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

      {/* Filter bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">状态:</span>
          {(["ALL", "PENDING", "SETTLING", "PAID", "FAILED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {s === "ALL" ? "全部" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder="搜索批次号 / 商户..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">批次号</th>
                <th className="py-2 px-3">商户</th>
                <th className="py-2 px-3">渠道</th>
                <th className="py-2 px-3 text-right">应收金额</th>
                <th className="py-2 px-3 text-right">手续费</th>
                <th className="py-2 px-3 text-right">净结金额</th>
                <th className="py-2 px-3">状态</th>
                <th className="py-2 px-3">结算周期</th>
                <th className="py-2 px-3">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<SettlementBatch>(filtered, currentPage, pageSize).map((b) => {
                const sm = STATUS_META[b.status];
                return (
                  <ContextMenu
                    key={b.id}
                    items={[
                      { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailBatch(b) },
                      {
                        key: "payout",
                        label: "发起出金",
                        icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
                        disabled: b.status !== "PENDING",
                        onClick: () => openPayout(b.id),
                      },
                      {
                        key: "refresh",
                        label: "刷新",
                        icon: <RefreshCw className="w-3.5 h-3.5" />,
                        onClick: () => setRows((prev) => [...prev]),
                      },
                    ]}
                    trigger={
                      <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3">
                          <div className="font-mono font-medium text-fg truncate max-w-[180px]" title={b.id}>{b.id}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TENANT_LABEL[b.tenantId]}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary uppercase">
                          {CHANNEL_LABEL[b.channel] || b.channel}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-fg">{fmt(b.receivableAmount, b.currency)}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg-secondary">{fmt(b.fee, b.currency)}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">{fmt(b.netAmount, b.currency)}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>
                            {sm.icon}
                            {sm.label}
                          </span>
                        </td>
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
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* Detail SideSheet */}
      <SideSheet
        id="settlement-detail"
        isOpen={!!detailBatch}
        onClose={() => setDetailBatch(null)}
        title={detailBatch ? `结算批次详情 - ${detailBatch.id}` : "结算批次详情"}
        description={detailBatch ? `${CHANNEL_LABEL[detailBatch.channel] || detailBatch.channel} · ${detailBatch.cycle} · ${STATUS_META[detailBatch.status].label}` : ""}
        icon={<FileSpreadsheet className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <button onClick={() => setDetailBatch(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
            关闭
          </button>
        }
      >
        {detailBatch && (
          <div className="space-y-4 text-xs">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">应收金额</div>
                <div className="font-mono font-semibold text-fg mt-1">{fmt(detailBatch.receivableAmount, detailBatch.currency)}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">手续费合计</div>
                <div className="font-mono font-semibold text-fg-secondary mt-1">-{fmt(detailBatch.fee, detailBatch.currency)}</div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <div className="text-[11px] text-emerald-700">净结金额</div>
                <div className="font-mono font-semibold text-emerald-700 mt-1">{fmt(detailBatch.netAmount, detailBatch.currency)}</div>
              </div>
            </div>

            {/* Transaction detail */}
            <div>
              <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> 交易明细
              </div>
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-subtle border-b border-line text-fg-secondary text-[11px]">
                      <th className="py-2 px-3">关联交易号</th>
                      <th className="py-2 px-3">商品</th>
                      <th className="py-2 px-3 text-right">金额</th>
                      <th className="py-2 px-3 text-right">手续费</th>
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

            {/* Fee breakdown */}
            <div>
              <div className="font-semibold text-fg mb-2">费用明细</div>
              <div className="space-y-1.5">
                {[
                  { label: "渠道费", value: detailBatch.fees.channelFee },
                  { label: "汇兑损溢", value: detailBatch.fees.fxGainLoss },
                  { label: "平台服务费", value: detailBatch.fees.platformFee },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between bg-subtle px-3 py-2 rounded-lg border border-line">
                    <span className="text-fg-secondary">{f.label}</span>
                    <span className={`font-mono ${f.value < 0 ? "text-rose-600" : "text-fg"}`}>{fmt(f.value, detailBatch.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payout account */}
            {detailBatch.payoutAccount && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-fg-tertiary" /> 出金账户
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-fg">{detailBatch.payoutAccount.bankName}</div>
                    <div className="text-[11px] text-fg-tertiary font-mono mt-0.5">尾号 {detailBatch.payoutAccount.accountLast4}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary border border-line">{detailBatch.payoutAccount.currency}</span>
                </div>
              </div>
            )}
            {detailBatch.remark && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">{detailBatch.remark}</div>
            )}
          </div>
        )}
      </SideSheet>

      {/* Payout SideSheet */}
      <SideSheet
        id="settlement-payout"
        isOpen={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title="发起出金申请"
        description="选择待结算批次与出金账户，提交后进入结算中，约 1.5 秒后完成出金"
        icon={<ArrowRightLeft className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setPayoutOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">
              取消
            </button>
            <button
              onClick={handleSubmitPayout}
              disabled={submitting || !payoutBatchId}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "出金处理中..." : "确认出金"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">结算批次</label>
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
                label: `${b.id} · ${TENANT_LABEL[b.tenantId]} · 净结 ${fmt(b.netAmount, b.currency)}`,
              }))}
              placeholder="选择待结算批次"
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">出金账户</label>
            <ShadcnSelect
              value={payoutAccount}
              onValueChange={setPayoutAccount}
              options={[
                { value: "JPMorgan Chase *4471", label: "JPMorgan Chase (尾号 4471)" },
                { value: "Deutsche Bank *8821", label: "Deutsche Bank (尾号 8821)" },
                { value: "Barclays *3305", label: "Barclays (尾号 3305)" },
                { value: "三菱 UFJ 銀行 *7720", label: "三菱 UFJ 銀行 (尾号 7720)" },
              ]}
              placeholder="选择出金银行账户"
            />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">出金金额</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono"
            />
            {selectedBatch && (
              <div className="text-[11px] text-fg-tertiary mt-1">
                默认净结金额 {fmt(selectedBatch.netAmount, selectedBatch.currency)}，不可超过此值
              </div>
            )}
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">备注</label>
            <textarea
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              rows={3}
              placeholder="出金用途 / 备注信息..."
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none"
            />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
