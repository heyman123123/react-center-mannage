import React, { useEffect, useMemo, useState } from "react";
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
import { Popconfirm } from "./ui/Popconfirm";
import {
  SystemConfigParam,
  ScheduledTask,
  SystemConfigCategory,
  TaskRunStatus,
} from "../types/payment";

interface SystemConfigViewProps {
  configs: SystemConfigParam[];
  tasks: ScheduledTask[];
}

const CATEGORY_LABEL: Record<SystemConfigCategory, string> = {
  支付: "支付", 邮件: "邮件", 风控: "风控", 结算: "结算", 系统: "系统",
};

const RUN_STATUS_META: Record<TaskRunStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  SUCCESS: { label: "成功", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  FAILED: { label: "失败", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
  RUNNING: { label: "运行中", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
};

const emptyForm = {
  key: "", value: "", description: "", category: "支付" as SystemConfigCategory, remark: "",
};

export const SystemConfigView: React.FC<SystemConfigViewProps> = ({ configs, tasks }) => {
  const [tab, setTab] = useState<"params" | "tasks">("params");

  // ---- 系统参数状态 ----
  const [paramRows, setParamRows] = useState<SystemConfigParam[]>(configs);
  const [paramCategoryFilter, setParamCategoryFilter] = useState<string>("ALL");
  const [paramSearch, setParamSearch] = useState("");
  const [paramFormOpen, setParamFormOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<SystemConfigParam | null>(null);
  const [paramForm, setParamForm] = useState(emptyForm);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [paramCategoryFilter, paramSearch, tab, reset]);

  // ---- 定时任务状态 ----
  const [taskRows, setTaskRows] = useState<ScheduledTask[]>(tasks);
  const [taskSearch, setTaskSearch] = useState("");
  const [detailTask, setDetailTask] = useState<ScheduledTask | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const { currentPage: tPage, setCurrentPage: setTPage, reset: tReset, pageSize: tSize } = usePagination(10);
  useEffect(() => { tReset(); }, [taskSearch, tab, tReset]);

  const filteredParams = useMemo(() => {
    return paramRows.filter((p) => {
      const matchCat = paramCategoryFilter === "ALL" || p.category === paramCategoryFilter;
      const matchSearch = p.key.toLowerCase().includes(paramSearch.toLowerCase()) || p.description.toLowerCase().includes(paramSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [paramRows, paramCategoryFilter, paramSearch]);

  const filteredTasks = useMemo(() => {
    return taskRows.filter((t) => {
      return t.name.toLowerCase().includes(taskSearch.toLowerCase()) || t.type.includes(taskSearch);
    });
  }, [taskRows, taskSearch]);

  // ---- 参数 CRUD ----
  const openCreateParam = () => { setEditingParam(null); setParamForm(emptyForm); setParamFormOpen(true); };
  const openEditParam = (p: SystemConfigParam) => {
    setEditingParam(p);
    setParamForm({ key: p.key, value: p.value, description: p.description, category: p.category, remark: p.remark || "" });
    setParamFormOpen(true);
  };
  const handleSaveParam = () => {
    if (!paramForm.key.trim()) return;
    const payload = {
      key: paramForm.key, value: paramForm.value, description: paramForm.description,
      category: paramForm.category, remark: paramForm.remark,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      updatedBy: "当前用户",
    };
    if (editingParam) {
      setParamRows((prev) => prev.map((p) => (p.id === editingParam.id ? { ...p, ...payload } : p)));
    } else {
      setParamRows((prev) => [{ id: `cfg_${Date.now().toString().slice(-6)}`, ...payload }, ...prev]);
    }
    setParamFormOpen(false);
  };
  const removeParam = (p: SystemConfigParam) => setParamRows((prev) => prev.filter((x) => x.id !== p.id));

  // ---- 任务操作 ----
  const toggleTask = (t: ScheduledTask) =>
    setTaskRows((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: x.status === "ENABLED" ? "DISABLED" : "ENABLED" } : x)));

  const triggerTask = (t: ScheduledTask) => {
    // 状态变运行中 -> 1.5 秒后成功/失败
    setRunningTaskId(t.id);
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    setTaskRows((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, lastRunAt: now, lastRunStatus: "RUNNING" as TaskRunStatus, logs: [{ id: `log_${Date.now()}`, time: now, status: "RUNNING", durationMs: 0, summary: "手动触发执行中..." }, ...x.logs] }
          : x
      )
    );
    setDetailTask((prev) => (prev && prev.id === t.id ? { ...prev, lastRunAt: now, lastRunStatus: "RUNNING" } : prev));

    setTimeout(() => {
      const success = Math.random() > 0.25;
      const endNow = new Date().toISOString().replace("T", " ").substring(0, 19);
      const duration = Math.floor(800 + Math.random() * 8000);
      setTaskRows((prev) =>
        prev.map((x) => {
          if (x.id !== t.id) return x;
          const newLog = {
            id: `log_${Date.now()}_2`, time: endNow, status: (success ? "SUCCESS" : "FAILED") as TaskRunStatus,
            durationMs: duration, summary: success ? "手动触发执行完成，处理正常" : "手动触发执行失败：模拟随机错误",
          };
          return { ...x, lastRunStatus: success ? "SUCCESS" : "FAILED", logs: [newLog, ...x.logs] };
        })
      );
      setDetailTask((prev) => {
        if (!prev || prev.id !== t.id) return prev;
        const newLog = {
          id: `log_${Date.now()}_2`, time: endNow, status: (success ? "SUCCESS" : "FAILED") as TaskRunStatus,
          durationMs: duration, summary: success ? "手动触发执行完成" : "手动触发执行失败",
        };
        return { ...prev, lastRunStatus: success ? "SUCCESS" : "FAILED", logs: [newLog, ...prev.logs] };
      });
      setRunningTaskId(null);
    }, 1500);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={6} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">系统参数与定时任务</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            管理支付/邮件/风控/结算/系统级参数，以及对账、结算、汇率同步等定时任务调度与执行日志。
          </p>
        </div>
        {tab === "params" && (
          <button onClick={openCreateParam} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> 新增参数
          </button>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-line/80 shadow-card w-fit">
        {([
          { key: "params", label: "系统参数", icon: <FileText className="w-3.5 h-3.5" /> },
          { key: "tasks", label: "定时任务", icon: <CalendarClock className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ============ 系统参数 Tab ============ */}
      {tab === "params" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <span className="text-fg-tertiary text-xs">分类:</span>
              {(["ALL", "支付", "邮件", "风控", "结算", "系统"] as const).map((c) => (
                <button key={c} onClick={() => setParamCategoryFilter(c)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${paramCategoryFilter === c ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {c === "ALL" ? "全部" : c}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder="搜索参数键 / 描述..." value={paramSearch}
                onChange={(e) => setParamSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">参数键 (Key)</th>
                    <th className="py-2 px-3">参数值 (Value)</th>
                    <th className="py-2 px-3">描述</th>
                    <th className="py-2 px-3">分类</th>
                    <th className="py-2 px-3">更新时间</th>
                    <th className="py-2 px-3">操作人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<SystemConfigParam>(filteredParams, currentPage, pageSize).map((p) => (
                    <ContextMenu
                      key={p.id}
                      items={[
                        { key: "edit", label: "编辑", icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEditParam(p) },
                        { key: "delete", label: "删除", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeParam(p) },
                        { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setParamRows((prev) => [...prev]) },
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
            <Pagination currentPage={currentPage} totalItems={filteredParams.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============ 定时任务 Tab ============ */}
      {tab === "tasks" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-fg-tertiary text-xs">
              <Clock className="w-3.5 h-3.5" /> 共 {filteredTasks.length} 个任务，双击行查看执行日志
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder="搜索任务名称 / 类型..." value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">任务名称</th>
                    <th className="py-2 px-3">任务类型</th>
                    <th className="py-2 px-3">Cron 表达式</th>
                    <th className="py-2 px-3">上次执行</th>
                    <th className="py-2 px-3">上次状态</th>
                    <th className="py-2 px-3">下次执行</th>
                    <th className="py-2 px-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<ScheduledTask>(filteredTasks, tPage, tSize).map((t) => {
                    const lsm = t.lastRunStatus ? RUN_STATUS_META[t.lastRunStatus] : null;
                    const isRunning = runningTaskId === t.id;
                    return (
                      <ContextMenu
                        key={t.id}
                        items={[
                          { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailTask(t) },
                          { key: "toggle", label: t.status === "ENABLED" ? "停用" : "启用", icon: <RefreshCw className="w-3.5 h-3.5" />, danger: t.status === "ENABLED", onClick: () => toggleTask(t) },
                          { key: "trigger", label: "手动触发", icon: <Play className="w-3.5 h-3.5" />, disabled: isRunning, onClick: () => triggerTask(t) },
                          { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setTaskRows((prev) => [...prev]) },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 font-medium text-fg truncate max-w-[180px]" title={t.name}>{t.name}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{t.type}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary bg-hover px-2 py-0.5 rounded">{t.cron}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{t.lastRunAt || "-"}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {lsm ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${lsm.badge}`}>{lsm.icon}{lsm.label}</span>
                              ) : "-"}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{t.nextRunAt}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${t.status === "ENABLED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-hover text-fg-secondary border-line"}`}>
                                {t.status === "ENABLED" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {t.status === "ENABLED" ? "启用" : "停用"}
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
            <Pagination currentPage={tPage} totalItems={filteredTasks.length} pageSize={tSize} onPageChange={setTPage} />
          </div>
        </>
      )}

      {/* 参数新增/编辑 SideSheet */}
      <SideSheet
        id="param-form"
        isOpen={paramFormOpen}
        onClose={() => setParamFormOpen(false)}
        title={editingParam ? "编辑系统参数" : "新增系统参数"}
        description="键值对形式配置系统级参数，key 全局唯一"
        icon={<Settings className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setParamFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">取消</button>
            <button onClick={handleSaveParam} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">保存</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">参数键 (Key)</label>
            <input value={paramForm.key} onChange={(e) => setParamForm((f) => ({ ...f, key: e.target.value }))}
              disabled={!!editingParam}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder="如 payment.global_timeout_ms" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">参数值 (Value)</label>
            <input value={paramForm.value} onChange={(e) => setParamForm((f) => ({ ...f, value: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder="如 15000" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">分类</label>
            <ShadcnSelect value={paramForm.category} onValueChange={(v) => setParamForm((f) => ({ ...f, category: v as SystemConfigCategory }))}
              options={(["支付", "邮件", "风控", "结算", "系统"] as SystemConfigCategory[]).map((c) => ({ value: c, label: c }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">描述</label>
            <input value={paramForm.description} onChange={(e) => setParamForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder="参数用途说明" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">备注</label>
            <textarea value={paramForm.remark} onChange={(e) => setParamForm((f) => ({ ...f, remark: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" placeholder="可选备注" />
          </div>
        </div>
      </SideSheet>

      {/* 任务详情 SideSheet */}
      <SideSheet
        id="task-detail"
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        title={detailTask ? `任务详情 - ${detailTask.name}` : "任务详情"}
        description={detailTask ? `类型：${detailTask.type} · Cron：${detailTask.cron}` : ""}
        icon={<CalendarClock className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <>
            {detailTask && (
              <Popconfirm title="确认手动触发该任务？" description="将立即执行一次，约 1.5 秒后返回结果。" confirmText="立即触发"
                onConfirm={() => triggerTask(detailTask)}>
                <button disabled={runningTaskId === detailTask.id}
                  className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer">
                  {runningTaskId === detailTask.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {runningTaskId === detailTask.id ? "执行中..." : "手动触发"}
                </button>
              </Popconfirm>
            )}
            <button onClick={() => setDetailTask(null)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">关闭</button>
          </>
        }
      >
        {detailTask && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">Cron 表达式</div>
                <div className="font-mono font-semibold text-fg mt-1">{detailTask.cron}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">下次执行</div>
                <div className="font-mono font-semibold text-fg mt-1">{detailTask.nextRunAt}</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> 执行日志
              </div>
              <div className="border border-line rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-subtle border-b border-line text-fg-secondary text-[11px]">
                      <th className="py-2 px-3">时间</th>
                      <th className="py-2 px-3">状态</th>
                      <th className="py-2 px-3 text-right">耗时</th>
                      <th className="py-2 px-3">输出摘要</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {detailTask.logs.map((log) => {
                      const sm = RUN_STATUS_META[log.status];
                      return (
                        <tr key={log.id}>
                          <td className="py-2 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{log.time}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-fg-secondary">{log.status === "RUNNING" ? "-" : `${log.durationMs}ms`}</td>
                          <td className="py-2 px-3 text-fg-secondary truncate max-w-[260px]" title={log.summary}>{log.summary}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
