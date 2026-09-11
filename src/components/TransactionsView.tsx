import React, { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowDownLeft,
  ExternalLink,
  Shield,
  FileSpreadsheet,
  GitCommit,
  ChevronRight,
} from "lucide-react";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
  PaymentChannel,
} from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { RBAC_ROLES } from "../data/mockData";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { ShadcnSelect } from "./ui/select";

interface TransactionsViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  transactions: TransactionRecord[];
  onOpenDiscrepancy: (tx: TransactionRecord) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  currentTenant,
  currentUser,
  transactions,
  onOpenDiscrepancy,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTxDetail, setActiveTxDetail] = useState<TransactionRecord | null>(null);

  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];

  // Scope transactions by tenant unless Super Admin / Finance Director
  const scopedList = transactions.filter((tx) => {
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
        tx.merchantName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = () => {
    if (!currentRole?.permissions?.canExportFinancialReports) {
      alert("权限不足：当前角色无权导出含有敏感商户资金信息的财务流水账单！");
      return;
    }

    const headers = "流水号,归属租户,交易描述,商户名称,渠道,渠道单号,交易金额,货币,手续费,净额,状态,时间\n";
    const rows = scopedList
      .map(
        (t) =>
          `${t.id},${t.tenantId},"${t.orderTitle}","${t.merchantName}",${t.channel},${t.channelTradeNo},${t.orderAmount},${t.currency},${t.channelFee},${t.settleAmount},${t.status},${t.createdAt}`
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              海外全渠道实时交易流水监控 (Global Transactions)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            当前业务单元: <span className="font-semibold text-zinc-800">{currentTenant.name}</span> • 聚合全球支付网关（Stripe、PayPal、Adyen、Klarna）毫秒级资金流水与对账审计，点击任意行可穿透查看完整流程节点与时间轴。
          </p>
        </div>

        <button
          id="export-csv-btn"
          onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start md:self-auto"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>导出加密财务对账单 (CSV)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索流水号/渠道交易单号..."
              className="pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs w-56 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {/* Overseas Channel selector */}
          <div className="w-52">
            <ShadcnSelect
              value={selectedChannel}
              onValueChange={setSelectedChannel}
              options={[
                { value: "all", label: "全部海外支付渠道" },
                { value: "stripe", label: "Stripe (信用卡 / 周期订阅)" },
                { value: "paypal", label: "PayPal (全球钱包 / 订阅扣款)" },
                { value: "adyen", label: "Adyen (欧洲多币种清算)" },
                { value: "apple_pay", label: "Apple Pay / Google Pay" },
                { value: "klarna", label: "Klarna (欧洲先买后付 BNPL)" },
              ]}
            />
          </div>

          {/* Status selector */}
          <div className="w-44">
            <ShadcnSelect
              value={selectedStatus}
              onValueChange={setSelectedStatus}
              options={[
                { value: "all", label: "全部平账状态" },
                { value: "done", label: "已平账 (Done)" },
                { value: "in_process", label: "网关清算中 (In Process)" },
                { value: "discrepancy", label: "存在资金差错 (Discrepancy)" },
                { value: "pending_check", label: "待复核 (Pending)" },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          检索到 <strong className="text-zinc-800">{scopedList.length}</strong> 笔海外流水
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs text-zinc-600 border-collapse">
            <thead className="bg-zinc-50/90 text-zinc-500 font-semibold border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 w-[220px]">流水号 / 渠道单号</th>
                <th className="px-4 py-3 min-w-[200px]">订单描述 & 签约商户</th>
                <th className="px-4 py-3 w-[160px]">海外网关 & 支付方式</th>
                <th className="px-4 py-3 w-[130px] text-right">交易金额 (Gross)</th>
                <th className="px-4 py-3 w-[120px] text-right">网关手续费 (Fee)</th>
                <th className="px-4 py-3 w-[120px] text-right">实际净结 (Net)</th>
                <th className="px-4 py-3 w-[130px] text-center">对账平账状态</th>
                <th className="px-4 py-3 w-[150px]">交易发生时间</th>
                <th className="px-4 py-3 w-[140px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  流程穿透
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {scopedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400 text-sm">
                    暂无符合条件的海外交易记录
                  </td>
                </tr>
              ) : (
                scopedList.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setActiveTxDetail(tx)}
                    className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 w-[220px] font-mono">
                      <div className="font-semibold text-zinc-900 group-hover:text-blue-600 flex items-center gap-1">
                        <span>{tx.id}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                        {tx.channelTradeNo}
                      </div>
                    </td>

                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="font-semibold text-zinc-900 line-clamp-1">{tx.orderTitle}</div>
                      <div className="text-[11px] text-zinc-400">{tx.merchantName}</div>
                    </td>

                    <td className="px-4 py-3 w-[160px]">
                      <span className="font-mono text-[11px] font-bold uppercase text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                        {tx.channel}
                      </span>
                      <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                        {tx.paymentMethod}
                      </div>
                    </td>

                    <td className="px-4 py-3 w-[130px] text-right font-mono font-bold text-zinc-900">
                      {formatCurrency(tx.orderAmount, tx.currency)}
                    </td>

                    <td className="px-4 py-3 w-[120px] text-right font-mono text-zinc-500">
                      {formatCurrency(tx.channelFee, tx.currency)}
                    </td>

                    <td className="px-4 py-3 w-[120px] text-right font-mono font-semibold text-emerald-700">
                      {formatCurrency(tx.settleAmount, tx.currency)}
                    </td>

                    <td className="px-4 py-3 w-[130px] text-center whitespace-nowrap">
                      {tx.status === "done" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> 平账成功
                        </span>
                      )}
                      {tx.status === "in_process" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> 网关结算中
                        </span>
                      )}
                      {tx.status === "discrepancy" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> 存在差错
                        </span>
                      )}
                      {tx.status === "pending_check" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                          待大额复核
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 w-[150px] text-[11px] text-zinc-500 font-mono whitespace-nowrap">
                      {tx.createdAt}
                    </td>

                    <td className="px-4 py-3 w-[140px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      {tx.status === "discrepancy" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDiscrepancy(tx);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                        >
                          差错调账
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTxDetail(tx);
                          }}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ml-auto"
                        >
                          <GitCommit className="w-3 h-3 text-blue-600" />
                          <span>全流程时间轴</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
