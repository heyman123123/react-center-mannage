import React, { useEffect, useMemo, useState } from "react";
import { ScrollText, Search, Eye, RefreshCw, CheckCircle2, ShieldBan, AlertTriangle, User, Download } from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { AuditLog } from "../types/payment";
import { exportToCSV } from "../lib/utils";

interface AuditLogsViewProps {
  logs: AuditLog[];
}

const STATUS_META: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  SUCCESS: { label: "成功", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  BLOCKED_BY_RBAC: { label: "RBAC 拦截", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <ShieldBan className="w-3 h-3" /> },
  WARNING: { label: "告警", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: <AlertTriangle className="w-3 h-3" /> },
};

const TIME_RANGES = [
  { key: "today", label: "今天" },
  { key: "7d", label: "近7天" },
  { key: "30d", label: "近30天" },
  { key: "all", label: "全部" },
];

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [rows, setRows] = useState<AuditLog[]>(logs);
  const [operatorFilter, setOperatorFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [timeRange, setTimeRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [operatorFilter, actionFilter, timeRange, searchQuery, reset]);

  const operatorName = (l: AuditLog) => l.operator || l.userName || "系统";

  const operators = useMemo(
    () => Array.from(new Set(rows.map(operatorName))).sort(),
    [rows]
  );
  const actions = useMemo(
    () => Array.from(new Set(rows.map((l) => l.action))).sort(),
    [rows]
  );

  // 以数据集中最新时间为“现在”参考点，使 mock 时间范围筛选可演示
  const refNow = useMemo(() => {
    const max = rows.reduce((acc, l) => (l.timestamp > acc ? l.timestamp : acc), "");
    return max ? new Date(max.replace(" ", "T")).getTime() : Date.now();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((l) => {
      const matchOperator = operatorFilter === "ALL" || operatorName(l) === operatorFilter;
      const matchAction = actionFilter === "ALL" || l.action === actionFilter;
      const matchSearch =
        (l.targetResource || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.details || "").toLowerCase().includes(searchQuery.toLowerCase());

      let matchTime = true;
      const t = new Date(l.timestamp.replace(" ", "T")).getTime();
      if (timeRange === "today") {
        matchTime = new Date(t).toDateString() === new Date(refNow).toDateString();
      } else if (timeRange === "7d") {
        matchTime = refNow - t <= 7 * 86400000;
      } else if (timeRange === "30d") {
        matchTime = refNow - t <= 30 * 86400000;
      }
      return matchOperator && matchAction && matchSearch && matchTime;
    });
  }, [rows, operatorFilter, actionFilter, timeRange, searchQuery, refNow]);

  const handleExport = () => {
    exportToCSV(
      "操作审计日志",
      ["时间", "操作人", "角色", "动作", "操作对象", "目标ID", "详情", "来源IP", "租户", "状态"],
      filtered.map((l) => [
        l.timestamp, operatorName(l), l.operatorRole || l.role || "", l.action,
        l.targetResource || "", l.targetId || "", l.details || "", l.ipAddress, l.tenantId, l.status || "",
      ])
    );
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={6} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ScrollText className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">操作审计日志</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            全量记录后台操作人、动作类型、操作对象与来源 IP，含 RBAC 拦截与安全告警，支持完整 JSON 追溯。
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-line hover:bg-hover text-fg-secondary rounded-lg text-xs font-semibold self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-fg-tertiary text-xs">时间范围:</span>
            {TIME_RANGES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTimeRange(t.key)}
                className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                  timeRange === t.key ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64 md:ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
            <input
              type="text"
              placeholder="搜索操作对象 / 详情关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-fg-tertiary mb-1">操作人</label>
            <ShadcnSelect
              value={operatorFilter}
              onValueChange={setOperatorFilter}
              options={[{ value: "ALL", label: "全部操作人" }, ...operators.map((o) => ({ value: o, label: o }))]}
            />
          </div>
          <div>
            <label className="block text-[11px] text-fg-tertiary mb-1">操作类型</label>
            <ShadcnSelect
              value={actionFilter}
              onValueChange={setActionFilter}
              options={[{ value: "ALL", label: "全部类型" }, ...actions.map((a) => ({ value: a, label: a }))]}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">操作人</th>
                <th className="py-2 px-3">操作类型 (Action)</th>
                <th className="py-2 px-3">操作对象</th>
                <th className="py-2 px-3">IP 地址</th>
                <th className="py-2 px-3">时间</th>
                <th className="py-2 px-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<AuditLog>(filtered, currentPage, pageSize).map((l) => {
                const sm = STATUS_META[l.status || "SUCCESS"] || STATUS_META.SUCCESS;
                return (
                  <ContextMenu
                    key={l.id}
                    items={[
                      { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailLog(l) },
                      {
                        key: "refresh",
                        label: "刷新",
                        icon: <RefreshCw className="w-3.5 h-3.5" />,
                        onClick: () => setRows((prev) => [...prev]),
                      },
                    ]}
                    trigger={
                      <tr onClick={() => setDetailLog(l)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-hover text-fg-secondary flex items-center justify-center shrink-0">
                              <User className="w-3 h-3" />
                            </span>
                            <div>
                              <div className="font-semibold text-fg">{operatorName(l)}</div>
                              <div className="text-[10px] text-fg-tertiary">{l.operatorRole || l.role || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-subtle text-fg border border-line">
                            {l.action}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-[11px] text-fg-secondary truncate max-w-[220px]" title={l.targetResource || ""}>
                            {l.targetResource || "-"}
                          </div>
                          {l.details && <div className="text-[10px] text-fg-tertiary truncate max-w-[220px]" title={l.details}>{l.details}</div>}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{l.ipAddress}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{l.timestamp}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>
                            {sm.icon}
                            {sm.label}
                          </span>
                        </td>
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

      {/* Detail SideSheet - full JSON */}
      <SideSheet
        id="audit-detail"
        isOpen={!!detailLog}
        onClose={() => setDetailLog(null)}
        title={detailLog ? `审计详情 - ${detailLog.id}` : "审计详情"}
        description={detailLog ? `${detailLog.action} · ${detailLog.timestamp}` : ""}
        icon={<ScrollText className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <button onClick={() => setDetailLog(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
            关闭
          </button>
        }
      >
        {detailLog && (
          <div className="space-y-3 text-xs">
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-fg-tertiary">操作人</span>
                <span className="font-semibold text-fg">{operatorName(detailLog)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-tertiary">操作类型</span>
                <span className="font-mono text-fg">{detailLog.action}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-tertiary">状态</span>
                {(() => {
                  const sm = STATUS_META[detailLog.status || "SUCCESS"] || STATUS_META.SUCCESS;
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>
                      {sm.icon}
                      {sm.label}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div>
              <div className="font-semibold text-fg-secondary mb-1.5">完整记录 JSON</div>
              <pre className="p-3 bg-primary text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[420px] overflow-y-auto">
                {JSON.stringify(detailLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
