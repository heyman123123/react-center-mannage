import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Play,
  Loader2,
  CalendarClock,
  FileText,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import {
  SystemConfigParam,
  ScheduledTask,
  SystemConfigCategory,
  TaskRunStatus,
} from "../types/payment";
import * as iamApi from "../api/modules/iam";
import { formatUnix } from "../lib/time";

interface SystemConfigViewProps {
  configs?: SystemConfigParam[];
  tasks?: ScheduledTask[];
}

const CATEGORY_KEYS: SystemConfigCategory[] = ["支付", "邮件", "风控", "结算", "系统"];
const CAT_I18N_KEY: Record<SystemConfigCategory, string> = {
  支付: "payment", 邮件: "email", 风控: "risk", 结算: "settlement", 系统: "system",
};

const emptyForm = {
  key: "", value: "", description: "", category: "支付" as SystemConfigCategory, remark: "",
};

function mapConfig(row: iamApi.ApiSystemConfig): SystemConfigParam {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    category: (row.category as SystemConfigCategory) || "系统",
    remark: row.remark,
    updatedAt: formatUnix(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function mapTask(row: iamApi.ApiScheduledTask): ScheduledTask {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ScheduledTask["type"],
    cron: row.cron,
    lastRunAt: row.lastRunAt ? formatUnix(row.lastRunAt) : undefined,
    lastRunStatus: row.lastRunStatus as TaskRunStatus | undefined,
    nextRunAt: row.nextRunAt ? formatUnix(row.nextRunAt) : undefined,
    status: row.status,
    logs: [],
  };
}

export const SystemConfigView: React.FC<SystemConfigViewProps> = ({ configs, tasks }) => {
  const { t } = useTranslation(["system", "common"]);
  const [tab, setTab] = useState<"params" | "tasks">(() => {
    try {
      return sessionStorage.getItem("system_config_tab") === "tasks" ? "tasks" : "params";
    } catch {
      return "params";
    }
  });
  const [dataLoading, setDataLoading] = useState(!configs || !tasks);

  const CATEGORY_LABEL = useMemo(
    (): Record<SystemConfigCategory, string> =>
      Object.fromEntries(CATEGORY_KEYS.map((c) => [c, t(`systemConfig.categories.${CAT_I18N_KEY[c]}`)])) as Record<SystemConfigCategory, string>,
    [t]
  );

  const RUN_STATUS_META = useMemo(
    (): Record<TaskRunStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
      SUCCESS: { label: t("systemConfig.runStatus.SUCCESS"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      FAILED: { label: t("systemConfig.runStatus.FAILED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
      RUNNING: { label: t("systemConfig.runStatus.RUNNING"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    }),
    [t]
  );

  const [paramRows, setParamRows] = useState<SystemConfigParam[]>(configs ?? []);
  const [paramCategoryFilter, setParamCategoryFilter] = useState<string>("ALL");
  const [paramSearch, setParamSearch] = useState("");
  const [paramFormOpen, setParamFormOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<SystemConfigParam | null>(null);
  const [paramForm, setParamForm] = useState(emptyForm);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [paramCategoryFilter, paramSearch, tab, reset]);

  const [taskRows, setTaskRows] = useState<ScheduledTask[]>(tasks ?? []);
  const [taskSearch, setTaskSearch] = useState("");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { currentPage: tPage, setCurrentPage: setTPage, reset: tReset, pageSize: tSize } = usePagination(10);
  useEffect(() => { tReset(); }, [taskSearch, tab, tReset]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const openTaskDetail = (task: ScheduledTask) => {
    try {
      sessionStorage.setItem("system_config_tab", "tasks");
    } catch {
      /* ignore */
    }
    window.history.replaceState(null, "", `#/scheduled_tasks/${task.id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [cfgList, taskList] = await Promise.all([
        iamApi.listSystemConfigs(),
        iamApi.listScheduledTasks(),
      ]);
      setParamRows((cfgList || []).map(mapConfig));
      setTaskRows((taskList || []).map(mapTask));
    } catch {
      setParamRows([]);
      setTaskRows([]);
    } finally {
      setDataLoading(false);
    }
  }, [configs, tasks]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredParams = useMemo(() => {
    return paramRows.filter((p) => {
      const matchCat = paramCategoryFilter === "ALL" || p.category === paramCategoryFilter;
      const matchSearch = p.key.toLowerCase().includes(paramSearch.toLowerCase()) || p.description.toLowerCase().includes(paramSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [paramRows, paramCategoryFilter, paramSearch]);

  const filteredTasks = useMemo(() => {
    return taskRows.filter((task) =>
      task.name.toLowerCase().includes(taskSearch.toLowerCase()) || task.type.includes(taskSearch)
    );
  }, [taskRows, taskSearch]);

  const openCreateParam = () => { setEditingParam(null); setParamForm(emptyForm); setParamFormOpen(true); };
  const openEditParam = (p: SystemConfigParam) => {
    setEditingParam(p);
    setParamForm({ key: p.key, value: p.value, description: p.description, category: p.category, remark: p.remark || "" });
    setParamFormOpen(true);
  };
  const handleSaveParam = async () => {
    if (!paramForm.key.trim()) return;
    try {
      if (editingParam) {
        const saved = await iamApi.updateSystemConfig(editingParam.id, {
          value: paramForm.value,
          description: paramForm.description,
          category: paramForm.category,
          remark: paramForm.remark,
        });
        setParamRows((prev) => prev.map((p) => (p.id === saved.id ? mapConfig(saved) : p)));
      } else {
        const saved = await iamApi.createSystemConfig({
          key: paramForm.key,
          value: paramForm.value,
          description: paramForm.description,
          category: paramForm.category,
          remark: paramForm.remark,
        });
        setParamRows((prev) => [mapConfig(saved), ...prev]);
      }
      setParamFormOpen(false);
    } catch {
      /* toast optional */
    }
  };
  const removeParam = async (p: SystemConfigParam) => {
    try {
      await iamApi.deleteSystemConfig(p.id);
      setParamRows((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      /* ignore */
    }
  };

  const toggleTask = async (task: ScheduledTask) => {
    const next = task.status === "ENABLED" ? "DISABLED" : "ENABLED";
    try {
      const saved = await iamApi.updateScheduledTaskStatus(task.id, next);
      setTaskRows((prev) => prev.map((x) => (x.id === saved.id ? mapTask(saved) : x)));
    } catch {
      /* ignore */
    }
  };

  const triggerTask = async (task: ScheduledTask) => {
    setRunningTaskId(task.id);
    try {
      await iamApi.triggerScheduledTask(task.id);
      setToast(t("systemConfig.executorDisabled"));
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("systemConfig.executorDisabled"));
    } finally {
      setRunningTaskId(null);
    }
  };

  const loading = useViewLoading() || dataLoading;
  if (loading) return <TableSkeleton rows={9} cols={6} />;

  const categoryFilterLabel = (c: string) =>
    c === "ALL" ? t("systemConfig.categories.all") : CATEGORY_LABEL[c as SystemConfigCategory];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-3 py-2 rounded-lg bg-fg text-page text-xs shadow-card">{toast}</div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("systemConfig.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("systemConfig.subtitle")}</p>
        </div>
        {tab === "params" && (
          <button onClick={openCreateParam} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("systemConfig.addParam")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-line/80 shadow-card w-fit">
        {([
          { key: "params" as const, label: t("systemConfig.tabs.params"), icon: <FileText className="w-3.5 h-3.5" /> },
          { key: "tasks" as const, label: t("systemConfig.tabs.tasks"), icon: <CalendarClock className="w-3.5 h-3.5" /> },
        ]).map((tabItem) => (
          <button key={tabItem.key} onClick={() => {
            setTab(tabItem.key);
            try { sessionStorage.setItem("system_config_tab", tabItem.key); } catch { /* ignore */ }
          }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === tabItem.key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}>
            {tabItem.icon}{tabItem.label}
          </button>
        ))}
      </div>

      {tab === "params" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <span className="text-fg-tertiary text-xs">{t("systemConfig.params.categoryLabel")}</span>
              {(["ALL", ...CATEGORY_KEYS] as const).map((c) => (
                <button key={c} onClick={() => setParamCategoryFilter(c)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${paramCategoryFilter === c ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {categoryFilterLabel(c)}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder={t("systemConfig.params.searchPlaceholder")} value={paramSearch}
                onChange={(e) => setParamSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("systemConfig.params.table.key")}</th>
                    <th className="py-2 px-3">{t("systemConfig.params.table.value")}</th>
                    <th className="py-2 px-3">{t("systemConfig.params.table.description")}</th>
                    <th className="py-2 px-3">{t("systemConfig.params.table.category")}</th>
                    <th className="py-2 px-3">{t("systemConfig.params.table.updatedAt")}</th>
                    <th className="py-2 px-3">{t("systemConfig.params.table.updatedBy")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<SystemConfigParam>(filteredParams, currentPage, pageSize).map((p) => (
                    <ContextMenu
                      key={p.id}
                      items={[
                        { key: "edit", label: t("systemConfig.params.menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEditParam(p) },
                        { key: "delete", label: t("systemConfig.params.menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeParam(p) },
                        { key: "refresh", label: t("systemConfig.params.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setParamRows((prev) => [...prev]) },
                      ]}
                      trigger={
                        <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                          <td className="py-3 px-3 font-mono text-[11px] text-fg truncate max-w-[220px]" title={p.key}>{p.key}</td>
                          <td className="py-3 px-3 font-mono text-fg truncate max-w-[160px]" title={p.value}>{p.value}</td>
                          <td className="py-3 px-3 text-fg-secondary truncate max-w-[240px]" title={p.description}>{p.description}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[11px] bg-hover text-fg-secondary font-medium">{CATEGORY_LABEL[p.category]}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{p.updatedAt}</td>
                          <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{p.updatedBy}</td>
                        </tr>
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {filteredParams.length === 0 ? (
              <div className="p-8 text-center text-xs text-fg-tertiary">{t("systemConfig.params.empty")}</div>
            ) : null}
            <Pagination currentPage={currentPage} totalItems={filteredParams.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {tab === "tasks" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-fg-tertiary text-xs">
              <Clock className="w-3.5 h-3.5" /> {t("systemConfig.tasks.summary", { count: filteredTasks.length })}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder={t("systemConfig.tasks.searchPlaceholder")} value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.name")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.type")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.cron")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.lastRun")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.lastStatus")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.nextRun")}</th>
                    <th className="py-2 px-3">{t("systemConfig.tasks.table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<ScheduledTask>(filteredTasks, tPage, tSize).map((task) => {
                    const lsm = task.lastRunStatus ? RUN_STATUS_META[task.lastRunStatus] : null;
                    const isRunning = runningTaskId === task.id;
                    return (
                      <ContextMenu
                        key={task.id}
                        items={[
                          { key: "view", label: t("systemConfig.tasks.menu.view"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openTaskDetail(task) },
                          { key: "toggle", label: task.status === "ENABLED" ? t("systemConfig.tasks.menu.disable") : t("systemConfig.tasks.menu.enable"), icon: <RefreshCw className="w-3.5 h-3.5" />, danger: task.status === "ENABLED", onClick: () => void toggleTask(task) },
                          { key: "trigger", label: t("systemConfig.tasks.menu.trigger"), icon: <Play className="w-3.5 h-3.5" />, disabled: isRunning, onClick: () => void triggerTask(task) },
                          { key: "refresh", label: t("systemConfig.tasks.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => void loadData() },
                        ]}
                        trigger={
                          <tr onClick={() => openTaskDetail(task)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 font-medium text-fg truncate max-w-[180px]" title={task.name}>{task.name}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{task.type}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary bg-hover px-2 py-0.5 rounded">{task.cron}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{task.lastRunAt || "-"}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {lsm ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${lsm.badge}`}>{lsm.icon}{lsm.label}</span>
                              ) : "-"}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{task.nextRunAt}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${task.status === "ENABLED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-hover text-fg-secondary border-line"}`}>
                                {task.status === "ENABLED" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {task.status === "ENABLED" ? t("systemConfig.tasks.enabled") : t("systemConfig.tasks.disabled")}
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
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-fg-tertiary">{t("systemConfig.tasks.empty")}</div>
            ) : null}
            <Pagination currentPage={tPage} totalItems={filteredTasks.length} pageSize={tSize} onPageChange={setTPage} />
          </div>
        </>
      )}

      <SideSheet
        id="param-form"
        isOpen={paramFormOpen}
        onClose={() => setParamFormOpen(false)}
        title={editingParam ? t("systemConfig.paramSheet.editTitle") : t("systemConfig.paramSheet.createTitle")}
        description={t("systemConfig.paramSheet.description")}
        icon={<Settings className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setParamFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveParam} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("systemConfig.paramSheet.key")}</label>
            <input value={paramForm.key} onChange={(e) => setParamForm((f) => ({ ...f, key: e.target.value }))}
              disabled={!!editingParam}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={t("systemConfig.paramSheet.keyPlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("systemConfig.paramSheet.value")}</label>
            <input value={paramForm.value} onChange={(e) => setParamForm((f) => ({ ...f, value: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={t("systemConfig.paramSheet.valuePlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("systemConfig.paramSheet.category")}</label>
            <ShadcnSelect value={paramForm.category} onValueChange={(v) => setParamForm((f) => ({ ...f, category: v as SystemConfigCategory }))}
              options={CATEGORY_KEYS.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("systemConfig.paramSheet.descriptionLabel")}</label>
            <input value={paramForm.description} onChange={(e) => setParamForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("systemConfig.paramSheet.descriptionPlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("systemConfig.paramSheet.remark")}</label>
            <textarea value={paramForm.remark} onChange={(e) => setParamForm((f) => ({ ...f, remark: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" placeholder={t("systemConfig.paramSheet.remarkPlaceholder")} />
          </div>
        </div>
      </SideSheet>

    </div>
  );
};
