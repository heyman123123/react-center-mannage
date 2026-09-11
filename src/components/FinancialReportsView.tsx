import React from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building,
  ArrowUpRight,
  PieChart,
  CheckCircle,
} from "lucide-react";
import { Tenant, SystemUser, TransactionRecord } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { RBAC_ROLES } from "../data/mockData";

interface FinancialReportsViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
  transactions: TransactionRecord[];
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  currentTenant,
  currentUser,
  transactions,
}) => {
  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];

  const channelBreakdown = [
    { channel: "支付宝 (Alipay)", totalVolume: 12450800, count: 28410, feeRate: "0.38%", feePaid: 47313.04, status: "T+1 已到账" },
    { channel: "微信支付 (WeChat Pay)", totalVolume: 4980200, count: 14220, feeRate: "0.38%", feePaid: 18924.76, status: "T+1 已到账" },
    { channel: "银联大额清算 (UnionPay)", totalVolume: 820000, count: 180, feeRate: "0.20%", feePaid: 1640.00, status: "D+0 实时到账" },
    { channel: "国际信用卡 (Visa/Master)", totalVolume: 184500, count: 940, feeRate: "2.80%", feePaid: 5166.00, status: "T+2 待回盘" },
    { channel: "数字人民币母子钱包 (e-CNY)", totalVolume: 12500, count: 320, feeRate: "0.00%", feePaid: 0.00, status: "D+0 实时到账" },
  ];

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="bg-surface border border-line/90 rounded-xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-fg" />
            <h1 className="text-lg font-bold text-fg">
              财务结算与渠道通道费率报表 (Financial Settlement & Fee Analytics)
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1">
            租户归属: <span className="font-semibold text-fg">{currentTenant.name}</span> • 结算专户对账凭据与全周期财务扎账报表
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("已生成当前租户的加密审计财务账单包 (ZIP/Excel)")}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出全周期财务清算汇总</span>
          </button>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-surface border border-line/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-line/80">
          <h3 className="text-sm font-semibold text-fg">
            通道清算流水与手续费率明细 (Channel Clearing & Merchant Fees)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-xs text-fg-secondary border-collapse">
            <thead className="bg-subtle/90 text-fg-secondary font-semibold text-[11px] border-b border-line">
              <tr>
                <th className="px-4 py-3 w-[220px]">结算渠道名称</th>
                <th className="px-4 py-3 w-[180px] text-right">总清算流水金额</th>
                <th className="px-4 py-3 w-[140px] text-right">有效交易笔数</th>
                <th className="px-4 py-3 w-[130px] text-center">签约基准费率</th>
                <th className="px-4 py-3 w-[150px] text-right">通道手续费扣减</th>
                <th className="px-4 py-3 w-[140px] text-center">清算到账周期</th>
                <th className="px-4 py-3 w-[130px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {channelBreakdown.map((row, idx) => (
                <tr key={idx} className="hover:bg-subtle/80 transition-colors group">
                  <td className="px-4 py-3 w-[220px] font-semibold text-fg">
                    {row.channel}
                  </td>
                  <td className="px-4 py-3 w-[180px] text-right font-mono font-bold text-fg whitespace-nowrap">
                    {formatCurrency(row.totalVolume)}
                  </td>
                  <td className="px-4 py-3 w-[140px] text-right font-mono text-fg-secondary whitespace-nowrap">
                    {row.count.toLocaleString()} 笔
                  </td>
                  <td className="px-4 py-3 w-[130px] text-center font-mono text-fg-secondary whitespace-nowrap">
                    {row.feeRate}
                  </td>
                  <td className="px-4 py-3 w-[150px] text-right font-mono text-fg-secondary whitespace-nowrap">
                    {formatCurrency(row.feePaid)}
                  </td>
                  <td className="px-4 py-3 w-[140px] text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-[130px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    <button
                      onClick={() => alert(`已导出【${row.channel}】结算回执与费率对账单`)}
                      className="px-2.5 py-1 bg-hover hover:bg-hover text-fg-secondary rounded text-[11px] font-medium transition-colors"
                    >
                      下载回执
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
