import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as transactionsApi from "../api/modules/transactions";
import { resolveCurrentRole } from "../lib/permissions";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  Search,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  GitCommit,
  ChevronRight,
} from "lucide-react";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
} from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { loadPaymentChannelOptions, type PaymentChannelOption } from "../lib/paymentChannels";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { ShadcnSelect } from "./ui/select";
import { Pagination, paginate, usePagination } from "./ui/Pagination";

interface TransactionsViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  onOpenDiscrepancy?: (tx: TransactionRecord) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  currentTenant,
  currentUser,
  onOpenDiscrepancy,
}) => {
  const { t } = useTranslation(["transactions", "common"]);
  const [transactionList, setTransactionList] = useState<TransactionRecord[]>([]);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await transactionsApi.listTransactions({
        page: 1,
        pageSize: 200,
        tenantId: currentTenant.id === "group_hq" ? undefined : currentTenant.id,
      });
      setTransactionList(res.list);
    } catch {
      setTransactionList([]);
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTxDetail, setActiveTxDetail] = useState<TransactionRecord | null>(null);
  const [channelDict, setChannelDict] = useState<PaymentChannelOption[]>([]);
  const { currentPage, setCurrentPage, reset: resetPage, pageSize, setPageSize } = usePagination(10);
  useEffect(() => { resetPage(); }, [selectedChannel, selectedStatus, searchQuery, resetPage]);
  useEffect(() => {
    void loadPaymentChannelOptions().then(setChannelDict);
  }, []);

  const currentRole = resolveCurrentRole(currentUser, []);

  const channelOptions = useMemo(
    () => [
      { value: "all", label: t("list.channels.all") },
      ...channelDict.map((c) => ({ value: c.value, label: c.label })),
    ],
    [t, channelDict]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("list.status.all") },
      { value: "done", label: t("list.status.done") },
      { value: "in_process", label: t("list.status.inProcess") },
      { value: "discrepancy", label: t("list.status.discrepancy") },
      { value: "pending_check", label: t("list.status.pending") },
    ],
    [t]
  );

  const scopedList = transactionList.filter((tx) => {
    if (currentTenant.id !== "group_hq" && tx.tenantId !== currentTenant.id) {
      return false;
    }
    if (selectedChannel !== "all" && tx.channel !== selectedChannel) {
      return false;
    }
    if (selectedStatus !== "all" && tx.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tx.orderTitle.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        tx.channelTradeNo.toLowerCase().includes(q) ||
        (tx.merchantName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = () => {
    if (!currentRole?.permissions?.canExportFinancialReports) {
      alert(t("list.exportDenied"));
      return;
    }

    const headers = `${t("list.csvHeaders")}\n`;
    const rows = scopedList
      .map(
        (tx) =>
          `${tx.id},${tx.tenantId},"${tx.orderTitle}","${tx.merchantName}",${tx.channel},${tx.channelTradeNo},${tx.orderAmount},${tx.currency},${tx.channelFee},${tx.settleAmount},${tx.status},${tx.createdAt}`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `global_transactions_${currentTenant.code}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line/90 rounded-2xl p-4 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("list.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1">
            {t("list.subtitle", { tenant: currentTenant.name })}
          </p>
        </div>

        <button
          id="export-csv-btn"
          onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors self-start md:self-auto"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>{t("list.exportCsv")}</span>
        </button>
      </div>

      <div className="bg-surface border border-line/90 rounded-xl p-3 shadow-card flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              className="pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs w-56 focus:outline-hidden focus:bg-surface focus:ring-1 focus:ring-line"
            />
          </div>

          <div className="w-52">
            <ShadcnSelect value={selectedChannel} onValueChange={setSelectedChannel} options={channelOptions} />
          </div>

          <div className="w-44">
            <ShadcnSelect value={selectedStatus} onValueChange={setSelectedStatus} options={statusOptions} />
          </div>
        </div>

        <div className="text-xs text-fg-tertiary font-mono">
          {t("list.resultCount", { count: scopedList.length })}
        </div>
      </div>

      <div className="bg-surface border border-line/90 rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs text-fg-secondary border-collapse">
            <thead className="bg-subtle/90 text-fg-secondary font-semibold border-b border-line">
              <tr>
                <th className="px-3 py-2 w-[220px]">{t("list.table.id")}</th>
                <th className="px-3 py-2 min-w-[200px]">{t("list.table.order")}</th>
                <th className="px-3 py-2 w-[160px]">{t("list.table.channel")}</th>
                <th className="px-3 py-2 w-[130px] text-right">{t("list.table.gross")}</th>
                <th className="px-3 py-2 w-[120px] text-right">{t("list.table.fee")}</th>
                <th className="px-3 py-2 w-[120px] text-right">{t("list.table.net")}</th>
                <th className="px-3 py-2 w-[130px] text-center">{t("list.table.status")}</th>
                <th className="px-3 py-2 w-[150px]">{t("list.table.time")}</th>
                <th className="px-3 py-2 w-[140px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("list.drillDown")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {scopedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-fg-tertiary text-sm">
                    {t("list.empty")}
                  </td>
                </tr>
              ) : (
                paginate<TransactionRecord>(scopedList, currentPage, pageSize).map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setActiveTxDetail(tx)}
                    className="hover:bg-subtle/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-3 py-2 w-[220px] font-mono">
                      <div className="font-semibold text-fg group-hover:text-blue-600 flex items-center gap-1">
                        <span>{tx.id}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[11px] text-fg-tertiary truncate max-w-[180px]">
                        {tx.channelTradeNo}
                      </div>
                    </td>

                    <td className="px-3 py-2 min-w-[200px]">
                      <div className="font-semibold text-fg line-clamp-1">{tx.orderTitle}</div>
                      <div className="text-[11px] text-fg-tertiary">{tx.merchantName}</div>
                    </td>

                    <td className="px-3 py-2 w-[160px]">
                      <span className="font-mono text-[11px] font-bold uppercase text-fg bg-hover px-1.5 py-0.5 rounded border border-line">
                        {tx.channel}
                      </span>
                      <div className="text-[11px] text-fg-secondary mt-0.5 truncate">
                        {tx.paymentMethod}
                      </div>
                    </td>

                    <td className="px-3 py-2 w-[130px] text-right font-mono font-bold text-fg">
                      {formatCurrency(tx.orderAmount, tx.currency)}
                    </td>

                    <td className="px-3 py-2 w-[120px] text-right font-mono text-fg-secondary">
                      {formatCurrency(tx.channelFee, tx.currency)}
                    </td>

                    <td className="px-3 py-2 w-[120px] text-right font-mono font-semibold text-emerald-700">
                      {formatCurrency(tx.settleAmount, tx.currency)}
                    </td>

                    <td className="px-3 py-2 w-[130px] text-center whitespace-nowrap">
                      {tx.status === "done" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> {t("list.badge.done")}
                        </span>
                      )}
                      {tx.status === "in_process" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> {t("list.badge.inProcess")}
                        </span>
                      )}
                      {tx.status === "discrepancy" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> {t("list.badge.discrepancy")}
                        </span>
                      )}
                      {tx.status === "pending_check" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-hover text-fg-secondary border border-line">
                          {t("list.badge.pending")}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 w-[150px] text-[11px] text-fg-secondary font-mono whitespace-nowrap">
                      {tx.createdAt}
                    </td>

                    <td className="px-3 py-2 w-[140px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      {tx.status === "discrepancy" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDiscrepancy?.(tx);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                        >
                          {t("list.resolveBtn")}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTxDetail(tx);
                          }}
                          className="px-2.5 py-1 bg-hover hover:bg-hover text-fg rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ml-auto"
                        >
                          <GitCommit className="w-3 h-3 text-blue-600" />
                          <span>{t("list.timelineBtn")}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={scopedList.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
      </div>

      {activeTxDetail && (
        <TransactionDetailModal
          transaction={activeTxDetail}
          onClose={() => setActiveTxDetail(null)}
        />
      )}
    </div>
  );
};
