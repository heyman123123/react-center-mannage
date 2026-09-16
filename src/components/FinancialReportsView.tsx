import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { Tenant, SystemUser } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { resolveCurrentRole } from "../lib/permissions";
import * as reportsApi from "../api/modules/reports";

interface FinancialReportsViewProps {
  currentTenant: Tenant;
  currentUser: SystemUser;
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  currentTenant,
  currentUser,
}) => {
  const { t } = useTranslation(["system", "common"]);
  const currentRole = resolveCurrentRole(currentUser, []);
  void currentRole;

  const [report, setReport] = useState<reportsApi.RevenueReport | null>(null);

  useEffect(() => {
    void reportsApi
      .getRevenueReport({
        tenantId: currentTenant.id === "group_hq" ? undefined : currentTenant.id,
      })
      .then(setReport)
      .catch(() => setReport(null));
  }, [currentTenant.id]);

  const channelBreakdown = useMemo(() => {
    const breakdown = report?.channelBreakdown || {};
    return Object.entries(breakdown).map(([channel, totalVolume]) => ({
      channel,
      totalVolume,
      count: report?.orderCount || 0,
      feeRate: "—",
      feePaid: 0,
      status: "—",
    }));
  }, [report]);

  const { currentPage, setCurrentPage, pageSize } = usePagination(10);

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="bg-surface border border-line/90 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-fg" />
            <h1 className="text-lg font-bold text-fg">
              {t("system:financialReports.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1">
            {t("system:financialReports.subtitle", { tenant: currentTenant.name })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert(t("system:financialReports.exportAlert"))}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("system:financialReports.exportAll")}</span>
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-line/80">
          <h3 className="text-sm font-semibold text-fg">
            {t("system:financialReports.sectionTitle")}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-xs text-fg-secondary border-collapse">
            <thead className="bg-subtle/90 text-fg-secondary font-semibold text-[11px] border-b border-line">
              <tr>
                <th className="px-3 py-2 w-[220px]">{t("system:financialReports.table.channel")}</th>
                <th className="px-3 py-2 w-[180px] text-right">{t("system:financialReports.table.totalVolume")}</th>
                <th className="px-3 py-2 w-[140px] text-right">{t("system:financialReports.table.count")}</th>
                <th className="px-3 py-2 w-[130px] text-center">{t("system:financialReports.table.feeRate")}</th>
                <th className="px-3 py-2 w-[150px] text-right">{t("system:financialReports.table.feePaid")}</th>
                <th className="px-3 py-2 w-[140px] text-center">{t("system:financialReports.table.settlementCycle")}</th>
                <th className="px-3 py-2 w-[130px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("system:financialReports.table.operations")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate(channelBreakdown, currentPage, pageSize).map((row, idx) => (
                <tr key={idx} className="hover:bg-subtle/80 transition-colors group">
                  <td className="px-3 py-2 w-[220px] font-semibold text-fg">
                    {row.channel}
                  </td>
                  <td className="px-3 py-2 w-[180px] text-right font-mono font-bold text-fg whitespace-nowrap">
                    {formatCurrency(row.totalVolume)}
                  </td>
                  <td className="px-3 py-2 w-[140px] text-right font-mono text-fg-secondary whitespace-nowrap">
                    {t("system:financialReports.countUnit", { count: row.count.toLocaleString() })}
                  </td>
                  <td className="px-3 py-2 w-[130px] text-center font-mono text-fg-secondary whitespace-nowrap">
                    {row.feeRate}
                  </td>
                  <td className="px-3 py-2 w-[150px] text-right font-mono text-fg-secondary whitespace-nowrap">
                    {formatCurrency(row.feePaid)}
                  </td>
                  <td className="px-3 py-2 w-[140px] text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 w-[130px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                    <button
                      onClick={() => alert(t("system:financialReports.exportRowAlert", { channel: row.channel }))}
                      className="px-2.5 py-1 bg-hover hover:bg-hover text-fg-secondary rounded text-[11px] font-medium transition-colors"
                    >
                      {t("system:financialReports.downloadReceipt")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={channelBreakdown.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>
    </div>
  );
};
