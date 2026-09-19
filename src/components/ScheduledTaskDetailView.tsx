import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, usePagination } from "./ui/Pagination";
import { Popconfirm } from "./ui/Popconfirm";
import * as iamApi from "../api/modules/iam";
import { ApiError } from "../api/types";
import type { TaskRunStatus } from "../types/payment";
import { formatUnix } from "../lib/time";

interface ScheduledTaskDetailViewProps {
  taskId: string;
  onBack: () => void;
}

export const ScheduledTaskDetailView: React.FC<ScheduledTaskDetailViewProps> = ({
  taskId,
  onBack,
}) => {
  const { t } = useTranslation(["system", "common"]);
  const [task, setTask] = useState<iamApi.ApiScheduledTask | null>(null);
  const [runs, setRuns] = useState<iamApi.ApiScheduledTaskRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { currentPage, setCurrentPage, pageSize, setPageSize } = usePagination(10);
  const viewLoading = useViewLoading();

  const RUN_STATUS_META = useMemo(
    (): Record<TaskRunStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
      SUCCESS: { label: t("systemConfig.runStatus.SUCCESS"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      FAILED: { label: t("systemConfig.runStatus.FAILED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
      RUNNING: { label: t("systemConfig.runStatus.RUNNING"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    }),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, page] = await Promise.all([
        iamApi.getScheduledTask(taskId),
        iamApi.listScheduledTaskRuns(taskId, { page: currentPage, pageSize }),
      ]);
      setTask(detail);
      setRuns(page.list || []);
      setTotal(page.total || 0);
    } catch (err) {
      setTask(null);
      setRuns([]);
      setTotal(0);
      if (err instanceof ApiError) setToast(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, currentPage, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const trigger = async () => {
    setTriggering(true);
    try {
      await iamApi.triggerScheduledTask(taskId);
      setToast(t("systemConfig.executorDisabled"));
      await load();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : t("systemConfig.executorDisabled"));
    } finally {
      setTriggering(false);
    }
  };

  if (viewLoading || loading) return <TableSkeleton rows={8} cols={4} />;

  if (!task) {
    return (
      <div className="space-y-4">
        {toast && (
          <div className="fixed top-4 right-4 z-[100] px-3 py-2 rounded-lg bg-fg text-page text-xs shadow-card">{toast}</div>
        )}
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> {t("systemConfig.taskDetail.back")}
        </button>
        <div className="bg-surface rounded-2xl border border-line/80 shadow-card p-8 text-center text-xs text-fg-tertiary">
          {t("systemConfig.taskDetail.notFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-3 py-2 rounded-lg bg-fg text-page text-xs shadow-card">{toast}</div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg cursor-pointer mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("systemConfig.taskDetail.back")}
          </button>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <CalendarClock className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{task.name}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1">
            {t("systemConfig.taskSheet.description", { type: task.type, cron: task.cron })}
          </p>
        </div>
        <Popconfirm
          title={t("systemConfig.taskSheet.triggerTitle")}
          description={t("systemConfig.taskSheet.triggerDescription")}
          confirmText={t("systemConfig.taskSheet.triggerConfirm")}
          onConfirm={() => void trigger()}
        >
          <button
            type="button"
            disabled={triggering}
            className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer self-start"
          >
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {triggering ? t("systemConfig.taskSheet.triggering") : t("systemConfig.taskSheet.trigger")}
          </button>
        </Popconfirm>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-surface p-3 rounded-xl border border-line">
          <div className="text-[11px] text-fg-tertiary">{t("systemConfig.taskSheet.cron")}</div>
          <div className="font-mono font-semibold text-fg mt-1">{task.cron}</div>
        </div>
        <div className="bg-surface p-3 rounded-xl border border-line">
          <div className="text-[11px] text-fg-tertiary">{t("systemConfig.taskSheet.nextRun")}</div>
          <div className="font-mono font-semibold text-fg mt-1">{formatUnix(task.nextRunAt)}</div>
        </div>
        <div className="bg-surface p-3 rounded-xl border border-line">
          <div className="text-[11px] text-fg-tertiary">{t("systemConfig.tasks.table.lastRun")}</div>
          <div className="font-mono font-semibold text-fg mt-1">{formatUnix(task.lastRunAt)}</div>
        </div>
        <div className="bg-surface p-3 rounded-xl border border-line">
          <div className="text-[11px] text-fg-tertiary">{t("systemConfig.tasks.table.status")}</div>
          <div className="font-semibold text-fg mt-1">
            {task.status === "ENABLED" ? t("systemConfig.tasks.enabled") : t("systemConfig.tasks.disabled")}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-1.5 text-xs font-semibold text-fg">
          <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> {t("systemConfig.taskSheet.logs")}
          <button type="button" onClick={() => void load()} className="ml-auto inline-flex items-center gap-1 text-fg-secondary hover:text-fg cursor-pointer font-medium">
            <RefreshCw className="w-3.5 h-3.5" /> {t("common:actions.refresh")}
          </button>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-fg-tertiary">{t("systemConfig.taskDetail.runsEmpty")}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-subtle border-b border-line text-fg-secondary text-[11px]">
                    <th className="py-2 px-3">{t("systemConfig.taskSheet.logTable.time")}</th>
                    <th className="py-2 px-3">{t("systemConfig.taskSheet.logTable.status")}</th>
                    <th className="py-2 px-3 text-right">{t("systemConfig.taskSheet.logTable.duration")}</th>
                    <th className="py-2 px-3">{t("systemConfig.taskSheet.logTable.summary")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {runs.map((r) => {
                    const sm = RUN_STATUS_META[r.status as TaskRunStatus];
                    return (
                      <tr key={r.id} className="hover:bg-subtle/80">
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{formatUnix(r.startedAt)}</td>
                        <td className="py-2.5 px-3">
                          {sm ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>
                              {sm.icon}{sm.label}
                            </span>
                          ) : r.status}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px]">{r.durationMs ? `${r.durationMs}ms` : "-"}</td>
                        <td className="py-2.5 px-3 text-fg-secondary truncate max-w-[360px]" title={r.summary}>{r.summary || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalItems={total} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </div>
    </div>
  );
};
