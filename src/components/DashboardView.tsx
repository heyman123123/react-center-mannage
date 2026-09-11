import React, { useState, useMemo } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { DashboardSkeleton } from "./ui/Skeletons";
import {
  TrendingUp,
  TrendingDown,
  Columns3,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GripVertical,
  Search,
  Filter,
  ArrowUpRight,
  Shield,
  FileCheck2,
  Download,
  Check,
} from "lucide-react";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
  ReconciliationStatus,
} from "../types/payment";
import { TransactionAreaChart } from "./TransactionAreaChart";
import { RBAC_ROLES } from "../data/mockData";
import { formatCurrency } from "../lib/utils";
import { TransactionDetailModal } from "./TransactionDetailModal";

interface DashboardViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  transactions: TransactionRecord[];
  onOpenDiscrepancy: (tx: TransactionRecord) => void;
  onResolveQuickDone: (txId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentTenant,
  currentUser,
  transactions,
  onOpenDiscrepancy,
  onResolveQuickDone,
}) => {
  const [timeRange, setTimeRange] = useState<"3m" | "30d" | "7d">("3m");
  const [activeTableTab, setActiveTableTab] = useState<
    "all" | "in_process" | "discrepancy" | "done"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [activeTxDetail, setActiveTxDetail] = useState<TransactionRecord | null>(null);
  const [customColsOpen, setCustomColsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    header: true,
    sectionType: true,
    status: true,
    target: true,
    limit: true,
    reviewer: true,
    actions: true,
  });

  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];

  // Filter transactions based on active tenant (unless Group HQ with ALL_TENANTS permissions)
  const tenantScopedTransactions = useMemo(() => {
    if (
      currentTenant?.id === "group_hq" &&
      currentRole?.dataScope === "ALL_TENANTS"
    ) {
      return transactions;
    }
    return transactions.filter((t) => t.tenantId === currentTenant.id);
  }, [transactions, currentTenant, currentRole]);

  // Counts for tabs
  const pendingCount = tenantScopedTransactions.filter(
    (t) => t.status === "in_process" || t.status === "pending_check"
  ).length;
  const discrepancyCount = tenantScopedTransactions.filter(
    (t) => t.status === "discrepancy"
  ).length;

  // Tab filter
  const filteredTransactions = useMemo(() => {
    return tenantScopedTransactions.filter((tx) => {
      // Tab filter
      if (
        activeTableTab === "in_process" &&
        tx.status !== "in_process" &&
        tx.status !== "pending_check"
      )
        return false;
      if (activeTableTab === "discrepancy" && tx.status !== "discrepancy")
        return false;
      if (activeTableTab === "done" && tx.status !== "done") return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = tx.orderTitle.toLowerCase().includes(query);
        const matchesId = tx.id.toLowerCase().includes(query);
        const matchesMerchant = tx.merchantName.toLowerCase().includes(query);
        const matchesChannel = tx.channel.toLowerCase().includes(query);
        return matchesTitle || matchesId || matchesMerchant || matchesChannel;
      }
      return true;
    });
  }, [tenantScopedTransactions, activeTableTab, searchQuery]);

  // Checkbox select all
  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTxIds.includes(tx.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map((tx) => tx.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(selectedTxIds.filter((item) => item !== id));
    } else {
      setSelectedTxIds([...selectedTxIds, id]);
    }
  };

  // KPI calculations based on filtered dataset
  const totalRevenue = useMemo(() => {
    const sum = tenantScopedTransactions.reduce(
      (acc, curr) => acc + curr.orderAmount,
      0
    );
    return sum || 1250.0;
  }, [tenantScopedTransactions]);

  const channelBadges: Record<string, { label: string; bg: string }> = {
    stripe: { label: "Stripe 国际卡", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    paypal: { label: "PayPal 钱包", bg: "bg-blue-50 text-blue-700 border-blue-200" },
    adyen: { label: "Adyen 欧洲清算", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    checkout: { label: "Checkout.com", bg: "bg-purple-50 text-purple-700 border-purple-200" },
    apple_pay: { label: "Apple Pay", bg: "bg-hover text-fg border-line" },
    google_pay: { label: "Google Pay", bg: "bg-amber-50 text-amber-800 border-amber-200" },
    klarna: { label: "Klarna 先买后付", bg: "bg-pink-50 text-pink-700 border-pink-200" },
    sepa: { label: "SEPA 欧洲借记", bg: "bg-sky-50 text-sky-700 border-sky-200" },
  };

  const loading = useViewLoading();
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-2 md:p-4 space-y-2 max-w-7xl mx-auto font-sans">
      {/* 4 Top KPI Cards (matching the screenshot's exact visual layout and metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Card 1: Total Revenue */}
        <div
          id="kpi-card-total-revenue"
          className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-between text-fg-secondary text-xs font-medium">
            <span>Total Revenue</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-hover text-fg border border-line">
              <TrendingUp className="w-3 h-3" />
              <span>+12.5%</span>
            </span>
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-fg font-mono">
            {formatCurrency(totalRevenue, currentTenant.currency)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg font-medium">
            <span>Trending up this month</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-fg-secondary" />
          </div>
          <div className="text-[11px] text-fg-tertiary mt-0.5">
            Visitors & transactions for the last 6 months
          </div>
        </div>

        {/* Card 2: New Customers / 接入商户 */}
        <div
          id="kpi-card-new-customers"
          className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-between text-fg-secondary text-xs font-medium">
            <span>New Customers</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-hover text-fg border border-line">
              <TrendingDown className="w-3 h-3" />
              <span>-20%</span>
            </span>
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-fg font-mono">
            1,234
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg font-medium">
            <span>Down 20% this period</span>
            <TrendingDown className="w-3.5 h-3.5 text-fg-secondary" />
          </div>
          <div className="text-[11px] text-fg-tertiary mt-0.5">
            Acquisition needs attention
          </div>
        </div>

        {/* Card 3: Active Accounts / 结算账户 */}
        <div
          id="kpi-card-active-accounts"
          className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-between text-fg-secondary text-xs font-medium">
            <span>Active Accounts</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-hover text-fg border border-line">
              <TrendingUp className="w-3 h-3" />
              <span>+12.5%</span>
            </span>
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-fg font-mono">
            45,678
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg font-medium">
            <span>Strong user retention</span>
            <TrendingUp className="w-3.5 h-3.5 text-fg-secondary" />
          </div>
          <div className="text-[11px] text-fg-tertiary mt-0.5">
            Engagement exceed targets
          </div>
        </div>

        {/* Card 4: Growth Rate / 对账平账率 */}
        <div
          id="kpi-card-growth-rate"
          className="bg-surface border border-line/90 rounded-xl p-2 shadow-2xs hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-between text-fg-secondary text-xs font-medium">
            <span>Growth Rate</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-hover text-fg border border-line">
              <TrendingUp className="w-3 h-3" />
              <span>+4.5%</span>
            </span>
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-fg font-mono">
            4.5%
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-fg font-medium">
            <span>Steady performance increase</span>
            <TrendingUp className="w-3.5 h-3.5 text-fg-secondary" />
          </div>
          <div className="text-[11px] text-fg-tertiary mt-0.5">
            Meets growth projections
          </div>
        </div>
      </div>

      {/* Large Area Chart matching screenshot */}
      <TransactionAreaChart
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        currency={currentTenant.currency}
      />

      {/* Table Section (matching screenshot's tabbed toolbar, filters, and row design) */}
      <div
        id="dashboard-table-container"
        className="bg-surface border border-line/90 rounded-xl shadow-2xs overflow-hidden"
      >
        {/* Table Toolbar Header */}
        <div className="p-2 border-b border-line/80 flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Filter Tabs (mirrors Outline, Past Performance 3, Key Personnel 2, Focus Documents) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              id="table-tab-outline"
              onClick={() => setActiveTableTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTableTab === "all"
                  ? "bg-hover text-fg font-semibold"
                  : "text-fg-secondary hover:text-fg hover:bg-subtle"
              }`}
            >
              Outline
            </button>
            <button
              id="table-tab-past-perf"
              onClick={() => setActiveTableTab("in_process")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTableTab === "in_process"
                  ? "bg-hover text-fg font-semibold"
                  : "text-fg-secondary hover:text-fg hover:bg-subtle"
              }`}
            >
              <span>Past Performance</span>
              <span className="w-4 h-4 rounded-full bg-hover text-fg text-[10px] font-semibold flex items-center justify-center">
                {pendingCount || 3}
              </span>
            </button>
            <button
              id="table-tab-key-personnel"
              onClick={() => setActiveTableTab("discrepancy")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTableTab === "discrepancy"
                  ? "bg-red-50 text-red-900 font-semibold border border-red-200"
                  : "text-fg-secondary hover:text-fg hover:bg-subtle"
              }`}
            >
              <span>Key Personnel</span>
              <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold flex items-center justify-center">
                {discrepancyCount || 2}
              </span>
            </button>
            <button
              id="table-tab-focus-docs"
              onClick={() => setActiveTableTab("done")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTableTab === "done"
                  ? "bg-hover text-fg font-semibold"
                  : "text-fg-secondary hover:text-fg hover:bg-subtle"
              }`}
            >
              Focus Documents
            </button>
          </div>

          {/* Right Action buttons: Search, Customize Columns, Add Section */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary" />
              <input
                id="search-transactions-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索单号/商户..."
                className="pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs w-36 sm:w-44 focus:outline-hidden focus:bg-surface focus:ring-1 focus:ring-line transition-all"
              />
            </div>

            {/* Customize Columns Dropdown */}
            <div className="relative">
              <button
                id="customize-columns-btn"
                onClick={() => setCustomColsOpen(!customColsOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-fg-secondary hover:text-fg bg-surface hover:bg-subtle border border-line rounded-lg transition-colors"
              >
                <Columns3 className="w-3.5 h-3.5 text-fg-secondary" />
                <span>Customize Columns</span>
              </button>

              {customColsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setCustomColsOpen(false)}
                  />
                  <div
                    id="customize-columns-popover"
                    className="absolute right-0 mt-1.5 w-48 bg-surface border border-line rounded-xl shadow-lg p-2 z-40 text-xs text-fg-secondary animate-in fade-in zoom-in-95"
                  >
                    <div className="font-semibold text-fg pb-1.5 border-b border-line-subtle mb-1">
                      选择显示字段
                    </div>
                    {Object.entries(visibleColumns).map(([col, isVisible]) => (
                      <label
                        key={col}
                        className="flex items-center justify-between p-1.5 hover:bg-subtle rounded cursor-pointer"
                      >
                        <span className="capitalize">{col}</span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [col as keyof typeof visibleColumns]: !isVisible,
                            }))
                          }
                          className="rounded text-fg focus:ring-line"
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Data Table (mirrors screenshot's Header, Section Type, Status, Target, Limit, Reviewer) */}
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-xs text-fg-secondary border-collapse">
            <thead className="bg-subtle/90 text-fg-secondary font-medium border-b border-line/80 select-none text-[11px]">
              <tr>
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-line text-fg focus:ring-line"
                  />
                </th>
                <th className="w-8 px-1 py-2 text-center"></th>
                {visibleColumns.header && (
                  <th className="px-3 py-2 min-w-[200px] font-semibold text-fg-secondary">Header</th>
                )}
                {visibleColumns.sectionType && (
                  <th className="px-3 py-2 w-[140px] font-semibold text-fg-secondary">Section Type</th>
                )}
                {visibleColumns.status && (
                  <th className="px-3 py-2 w-[130px] font-semibold text-fg-secondary">Status</th>
                )}
                {visibleColumns.target && (
                  <th className="px-3 py-2 w-[100px] font-semibold text-fg-secondary">Target</th>
                )}
                {visibleColumns.limit && (
                  <th className="px-3 py-2 w-[100px] font-semibold text-fg-secondary">Limit</th>
                )}
                {visibleColumns.reviewer && (
                  <th className="px-3 py-2 w-[150px] font-semibold text-fg-secondary">Reviewer</th>
                )}
                {visibleColumns.actions && (
                  <th className="w-[90px] px-3 py-2 sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70 bg-surface">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-fg-tertiary text-sm">
                    未找到匹配的流水记录
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isSelected = selectedTxIds.includes(tx.id);
                  const channelInfo =
                    channelBadges[tx.channel] || {
                      label: tx.channel,
                      bg: "bg-hover text-fg-secondary",
                    };

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setActiveTxDetail(tx)}
                      className={`hover:bg-subtle/80 transition-colors group cursor-pointer ${
                        isSelected ? "bg-subtle" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="w-10 px-3 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(tx.id)}
                          className="rounded border-line text-fg focus:ring-line"
                        />
                      </td>

                      {/* Drag Grip Handle */}
                      <td className="w-8 px-1 py-2 text-center text-zinc-300 group-hover:text-fg-secondary cursor-grab">
                        <GripVertical className="w-3.5 h-3.5 mx-auto" />
                      </td>

                      {/* Header (Title & Code) */}
                      {visibleColumns.header && (
                        <td className="px-3 py-2 min-w-[200px]">
                          <div className="font-semibold text-fg line-clamp-1">
                            {tx.orderTitle}
                          </div>
                          <div className="text-[11px] text-fg-tertiary font-mono mt-0.5 flex items-center gap-2 truncate">
                            <span>{tx.id}</span>
                            <span>•</span>
                            <span>{tx.merchantName}</span>
                          </div>
                        </td>
                      )}

                      {/* Section Type (Channel tag) */}
                      {visibleColumns.sectionType && (
                        <td className="px-3 py-2 w-[140px] whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${channelInfo.bg}`}
                          >
                            {channelInfo.label}
                          </span>
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className="px-3 py-2 w-[130px] whitespace-nowrap">
                          {tx.status === "done" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Done</span>
                            </span>
                          )}
                          {tx.status === "in_process" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              <span>In Process</span>
                            </span>
                          )}
                          {tx.status === "discrepancy" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDiscrepancy(tx);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                              title="点击查看并处理差错"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Discrepancy</span>
                            </button>
                          )}
                          {tx.status === "pending_check" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-hover text-fg-secondary border border-line">
                              <Clock className="w-3 h-3 text-fg-secondary" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      )}

                      {/* Target (Amount / Target Ratio) */}
                      {visibleColumns.target && (
                        <td className="px-3 py-2 w-[100px] font-mono font-medium text-fg whitespace-nowrap">
                          {tx.targetQuotaRatio ?? (tx.orderAmount > 1000 ? Math.round(tx.orderAmount / 100) : 18)}
                        </td>
                      )}

                      {/* Limit (Channel Fee / Limit Ratio) */}
                      {visibleColumns.limit && (
                        <td className="px-3 py-2 w-[100px] font-mono text-fg-secondary whitespace-nowrap">
                          {tx.limitRatio ?? (tx.channelFee > 0 ? Math.round(tx.channelFee * 2) : 5)}
                        </td>
                      )}

                      {/* Reviewer */}
                      {visibleColumns.reviewer && (
                        <td className="px-3 py-2 w-[150px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-hover text-fg-secondary flex items-center justify-center text-[10px] font-bold">
                              {tx.reviewer?.name ? tx.reviewer.name.slice(0, 1) : "平"}
                            </div>
                            <span className="text-fg font-medium truncate max-w-[100px]">
                              {tx.reviewer?.name || "系统自动平账"}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Actions: Sticky Right */}
                      {visibleColumns.actions && (
                        <td className="w-[90px] px-3 py-2 sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center justify-end gap-1">
                            {tx.status === "discrepancy" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDiscrepancy(tx);
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium transition-colors"
                              >
                                调账
                              </button>
                            ) : tx.status === "in_process" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onResolveQuickDone(tx.id);
                                }}
                                className="px-2 py-1 bg-primary hover:bg-primary-hover text-primary-foreground rounded text-[11px] font-medium transition-colors"
                              >
                                平账
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDiscrepancy(tx);
                                }}
                                className="p-1 text-fg-tertiary hover:text-fg-secondary rounded hover:bg-hover transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Footer Pagination Info */}
        <div className="px-3 py-2 border-t border-line/80 bg-subtle/50 flex items-center justify-between text-xs text-fg-secondary">
          <div>
            已选 <span className="font-semibold text-fg">{selectedTxIds.length}</span> 条流水 / 共{" "}
            <span className="font-semibold text-fg">
              {filteredTransactions.length}
            </span>{" "}
            条记录 (租户: {currentTenant?.name || "当前业务单元"})
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-fg-tertiary">
              RBAC数据保护已开启 • T+1三方自动对账
            </span>
          </div>
        </div>
      </div>

      {/* Full Transaction Lifecycle Process and Timestamp Modal */}
      {activeTxDetail && (
        <TransactionDetailModal
          transaction={activeTxDetail}
          onClose={() => setActiveTxDetail(null)}
        />
      )}
    </div>
  );
};
