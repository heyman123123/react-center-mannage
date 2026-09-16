import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText, Search, Eye, RefreshCw, CheckCircle2, ShieldBan, AlertTriangle, User, Download } from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ContextMenu } from "./ui/ContextMenu";
import { MultiSelect } from "./ui/MultiSelect";
import { AuditLog } from "../types/payment";
import { exportToCSV } from "../lib/utils";
import {
  listAuditLogs,
  listDictionaryEntries,
  listUsers,
  type ApiAuditLog,
} from "../api/modules/iam";
import { ApiError } from "../api/types";
import { formatUnix, toUnixSeconds } from "../lib/time";

interface AuditLogsViewProps {
  logs?: AuditLog[];
}

function mapApiLog(row: ApiAuditLog): AuditLog {
  return {
    id: row.id,
    timestamp: formatUnix(row.timestamp),
    userId: row.userId,
    userName: row.userName,
    operator: row.operator || row.userName,
    operatorRole: row.operatorRole || row.role,
    role: row.role,
    tenantId: "group_hq",
    action: row.action,
    targetResource: row.targetResource,
    targetId: row.targetId,
    details: row.details,
    ipAddress: row.ipAddress || "-",
    status: (row.status as AuditLog["status"]) || "SUCCESS",
  };
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const { t } = useTranslation(["system", "common"]);
  const [rows, setRows] = useState<AuditLog[]>(logs ?? []);
  const [dataLoading, setDataLoading] = useState<boolean>(!logs);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [actionOptions, setActionOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [selectedUserIds, selectedActions, timeRange, searchQuery, reset]);

  const actionLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    actionOptions.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [actionOptions]);

  const actionLabel = (code: string) => actionLabelMap.get(code) || code;

  useEffect(() => {
    if (logs) {
      setActionOptions(
        Array.from(new Set(logs.map((l) => l.action)))
          .sort()
          .map((a) => ({ value: a, label: a })),
      );
      return;
    }
    void (async () => {
      try {
        const page = await listDictionaryEntries({ namespace: "audit_action", pageSize: 100 });
        setActionOptions(
          (page.list || []).map((e) => ({
            value: e.entryKey || e.key,
            label: e.label || e.translations?.["zh-CN"] || e.entryKey || e.key,
          })),
        );
      } catch {
        setActionOptions([]);
      }
    })();
  }, [logs]);

  useEffect(() => {
    if (logs) {
      const names = Array.from(new Set(logs.map((l) => l.operator || l.userName || ""))).filter(Boolean);
      setUserOptions(names.map((n) => ({ value: n, label: n })));
      return;
    }
    void (async () => {
      try {
        const page = await listUsers({ page: 1, pageSize: 200 });
        setUserOptions(
          (page.list || []).map((u) => ({
            value: u.id,
            label: u.email ? `${u.name} (${u.email})` : u.name,
          })),
        );
      } catch {
        setUserOptions([]);
      }
    })();
  }, [logs]);

  const loadRows = useCallback(async () => {
    setDataLoading(true);
    try {
      if (logs) {
        setRows(logs);
        return;
      }
      const page = await listAuditLogs({
        page: 1,
        pageSize: 200,
        keyword: searchQuery || undefined,
        actions: selectedActions.length ? selectedActions.join(",") : undefined,
        userIds: selectedUserIds.length ? selectedUserIds.join(",") : undefined,
      });
      setRows((page.list || []).map(mapApiLog));
    } catch (err) {
      setRows([]);
      if (err instanceof ApiError) setToast(err.message);
    } finally {
      setDataLoading(false);
    }
  }, [logs, searchQuery, selectedActions, selectedUserIds]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const STATUS_META = useMemo(
    (): Record<string, { label: string; badge: string; icon: React.ReactNode }> => ({
      SUCCESS: {
        label: t("system:audit.status.success"),
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      BLOCKED_BY_RBAC: {
        label: t("system:audit.status.rbacBlocked"),
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        icon: <ShieldBan className="w-3 h-3" />,
      },
      WARNING: {
        label: t("system:audit.status.warning"),
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <AlertTriangle className="w-3 h-3" />,
      },
    }),
    [t]
  );

  const TIME_RANGES = useMemo(
    () => [
      { key: "today", label: t("system:audit.timeRanges.today") },
      { key: "7d", label: t("system:audit.timeRanges.7d") },
      { key: "30d", label: t("system:audit.timeRanges.30d") },
      { key: "all", label: t("system:audit.timeRanges.all") },
    ],
    [t]
  );

  const operatorName = (l: AuditLog) => l.operator || l.userName || t("system:audit.systemOperator");

  const refNow = useMemo(() => {
    const max = rows.reduce((acc, l) => {
      const sec = toUnixSeconds(l.timestamp) || 0;
      return sec > acc ? sec : acc;
    }, 0);
    return max > 0 ? max * 1000 : Date.now();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((l) => {
      let matchOperator = true;
      let matchAction = true;
      if (logs) {
        if (selectedUserIds.length) {
          matchOperator = selectedUserIds.includes(l.userId || "") || selectedUserIds.includes(operatorName(l));
        }
        if (selectedActions.length) {
          matchAction = selectedActions.includes(l.action);
        }
      }
      const matchSearch =
        !searchQuery ||
        (l.targetResource || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.details || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.action.toLowerCase().includes(searchQuery.toLowerCase());

      let matchTime = true;
      const sec = toUnixSeconds(l.timestamp);
      const ts = sec != null ? sec * 1000 : 0;
      if (timeRange === "today") {
        matchTime = new Date(ts).toDateString() === new Date(refNow).toDateString();
      } else if (timeRange === "7d") {
        matchTime = refNow - ts <= 7 * 86400000;
      } else if (timeRange === "30d") {
        matchTime = refNow - ts <= 30 * 86400000;
      }
      return matchOperator && matchAction && matchSearch && matchTime;
    });
  }, [rows, selectedUserIds, selectedActions, timeRange, searchQuery, refNow, logs, t]);

  const handleExport = () => {
    exportToCSV(
      t("system:audit.exportFilename"),
      [
        t("system:audit.exportHeaders.time"),
        t("system:audit.exportHeaders.operator"),
        t("system:audit.exportHeaders.role"),
        t("system:audit.exportHeaders.action"),
        t("system:audit.exportHeaders.target"),
        t("system:audit.exportHeaders.targetId"),
        t("system:audit.exportHeaders.details"),
        t("system:audit.exportHeaders.ip"),
        t("system:audit.exportHeaders.tenant"),
        t("system:audit.exportHeaders.status"),
      ],
      filtered.map((l) => [
        l.timestamp, operatorName(l), l.operatorRole || l.role || "", actionLabel(l.action),
        l.targetResource || "", l.targetId || "", l.details || "", l.ipAddress, l.tenantId, l.status || "",
      ])
    );
  };

  const viewLoading = useViewLoading();
  const loading = viewLoading || dataLoading;
  if (loading) return <TableSkeleton rows={9} cols={6} />;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-3 py-2 rounded-lg bg-fg text-page text-xs shadow-card">
          {toast}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ScrollText className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("system:audit.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("system:audit.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-line bg-surface hover:bg-hover self-start"
        >
          <Download className="w-3.5 h-3.5" /> {t("common:actions.exportCsv")}
        </button>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card space-y-3 text-xs">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                type="button"
                onClick={() => setTimeRange(tr.key)}
                className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                  timeRange === tr.key ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64 md:ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
            <input
              type="text"
              placeholder={t("system:audit.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-fg-tertiary mb-1">{t("system:audit.operatorLabel")}</label>
            <MultiSelect
              searchable
              value={selectedUserIds}
              onValueChange={setSelectedUserIds}
              options={userOptions}
              placeholder={t("system:audit.allOperators")}
            />
          </div>
          <div>
            <label className="block text-[11px] text-fg-tertiary mb-1">{t("system:audit.actionTypeLabel")}</label>
            <MultiSelect
              searchable
              value={selectedActions}
              onValueChange={setSelectedActions}
              options={actionOptions}
              placeholder={t("system:audit.allTypes")}
            />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("system:audit.table.operator")}</th>
                <th className="py-2 px-3">{t("system:audit.table.action")}</th>
                <th className="py-2 px-3">{t("system:audit.table.target")}</th>
                <th className="py-2 px-3">{t("system:audit.table.ip")}</th>
                <th className="py-2 px-3">{t("system:audit.table.time")}</th>
                <th className="py-2 px-3">{t("system:audit.table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<AuditLog>(filtered, currentPage, pageSize).map((l) => {
                const sm = STATUS_META[l.status || "SUCCESS"] || STATUS_META.SUCCESS;
                return (
                  <ContextMenu
                    key={l.id}
                    items={[
                      { key: "view", label: t("system:audit.menu.viewDetail"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailLog(l) },
                      {
                        key: "refresh",
                        label: t("system:audit.menu.refresh"),
                        icon: <RefreshCw className="w-3.5 h-3.5" />,
                        onClick: () => void loadRows(),
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
                            {actionLabel(l.action)}
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

      <SideSheet
        id="audit-detail"
        isOpen={!!detailLog}
        onClose={() => setDetailLog(null)}
        title={detailLog ? t("system:audit.detail.title", { id: detailLog.id }) : t("system:audit.detail.titleFallback")}
        description={detailLog ? `${actionLabel(detailLog.action)} · ${detailLog.timestamp}` : ""}
        icon={<ScrollText className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <button onClick={() => setDetailLog(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">
            {t("common:actions.close")}
          </button>
        }
      >
        {detailLog && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <span className="text-fg-tertiary">{t("system:audit.detail.operator")}</span>
                <div className="font-semibold text-fg mt-1">{operatorName(detailLog)}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <span className="text-fg-tertiary">{t("system:audit.detail.actionType")}</span>
                <div className="font-semibold text-fg mt-1">{actionLabel(detailLog.action)}</div>
              </div>
            </div>
            <pre className="bg-subtle border border-line rounded-xl p-3 overflow-auto text-[11px] font-mono text-fg-secondary whitespace-pre-wrap">
              {JSON.stringify(detailLog, null, 2)}
            </pre>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
