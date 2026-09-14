import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Info,
  Mail,
  Webhook,
  MessageSquare,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import {
  AlertRule,
  AlertHistory,
  AlertMonitorObject,
  AlertSeverity,
  NotifyChannel,
  AlertHistoryStatus,
} from "../types/payment";

interface AlertsViewProps {
  rules: AlertRule[];
  histories: AlertHistory[];
}

// MONITOR_LABEL moved inside component

const SEVERITY_META: Record<AlertSeverity, { label: string; badge: string }> = {
  P0: { label: "P0", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  P1: { label: "P1", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  P2: { label: "P2", badge: "bg-blue-50 text-blue-700 border-blue-200" },
};

// CHANNEL_META moved inside component

// HISTORY_STATUS_META moved inside component

const emptyForm = {
  name: "",
  monitorObject: "CHANNEL_ABNORMAL" as AlertMonitorObject,
  triggerCondition: "",
  severity: "P1" as AlertSeverity,
  notifyChannels: ["IN_APP"] as NotifyChannel[],
  enabled: true,
  thresholdValue: "",
};

export const AlertsView: React.FC<AlertsViewProps> = ({ rules, histories }) => {
  const { t } = useTranslation(["alerts", "common"]);
  const MONITOR_LABEL = useMemo((): Record<AlertMonitorObject, string> => ({
    CHANNEL_ABNORMAL: t("monitor.CHANNEL_ABNORMAL"),
    RECON_DIFF: t("monitor.RECON_DIFF"),
    FAIL_RATE: t("monitor.FAIL_RATE"),
    PAYOUT_FAIL: t("monitor.PAYOUT_FAIL"),
  }), [t]);
  const CHANNEL_META = useMemo((): Record<NotifyChannel, { label: string; icon: React.ReactNode }> => ({
    IN_APP: { label: t("notifyChannel.IN_APP"), icon: <MessageSquare className="w-3 h-3" /> },
    EMAIL: { label: t("notifyChannel.EMAIL"), icon: <Mail className="w-3 h-3" /> },
    WEBHOOK: { label: t("notifyChannel.WEBHOOK"), icon: <Webhook className="w-3 h-3" /> },
  }), [t]);
  const HISTORY_STATUS_META = useMemo((): Record<AlertHistoryStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
    UNHANDLED: { label: t("historyStatus.UNHANDLED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <AlertTriangle className="w-3 h-3" /> },
    PROCESSING: { label: t("historyStatus.PROCESSING"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    RESOLVED: { label: t("historyStatus.RESOLVED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    IGNORED: { label: t("historyStatus.IGNORED"), badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
  }), [t]);
  const [tab, setTab] = useState<"rules" | "histories">("rules");

  // ---- {t("notifyConfig")}状态 ----
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState("ops@payments.io, finance@payments.io");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://hooks.slack.com/services/T000/B000/xxx");

  // ---- 规则列表状态 ----
  const [ruleRows, setRuleRows] = useState<AlertRule[]>(rules);
  const [ruleFilter, setRuleFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [ruleSearch, setRuleSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [ruleFilter, ruleSearch, tab, reset]);

  // ---- 历史列表状态 ----
  const [historyRows, setHistoryRows] = useState<AlertHistory[]>(histories);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [detailHistory, setDetailHistory] = useState<AlertHistory | null>(null);
  const { currentPage: hPage, setCurrentPage: setHPage, reset: hReset, pageSize: hSize } = usePagination(10);
  useEffect(() => { hReset(); }, [historyStatusFilter, historySearch, tab, hReset]);

  // ---- 规则过滤 ----
  const filteredRules = useMemo(() => {
    return ruleRows.filter((r) => {
      const matchStatus = ruleFilter === "ALL" || r.status === ruleFilter;
      const matchSearch =
        r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
        MONITOR_LABEL[r.monitorObject].toLowerCase().includes(ruleSearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [ruleRows, ruleFilter, ruleSearch]);

  // ---- 历史过滤 ----
  const filteredHistories = useMemo(() => {
    return historyRows.filter((h) => {
      const matchStatus = historyStatusFilter === "ALL" || h.status === historyStatusFilter;
      const matchSearch =
        h.title.toLowerCase().includes(historySearch.toLowerCase()) ||
        h.ruleName.toLowerCase().includes(historySearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [historyRows, historyStatusFilter, historySearch]);

  // ---- 规则 CRUD ----
  const openCreate = () => { setEditingRule(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (r: AlertRule) => {
    setEditingRule(r);
    setForm({
      name: r.name, monitorObject: r.monitorObject, triggerCondition: r.triggerCondition,
      severity: r.severity, notifyChannels: r.notifyChannels, enabled: r.status === "ENABLED",
      thresholdValue: String(Object.values(r.thresholdParams)[0] ?? ""),
    });
    setFormOpen(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      monitorObject: form.monitorObject,
      triggerCondition: form.triggerCondition || t("defaultCondition"),
      severity: form.severity,
      notifyChannels: form.notifyChannels,
      status: (form.enabled ? "ENABLED" : "DISABLED") as "ENABLED" | "DISABLED",
      thresholdParams: form.thresholdValue ? { value: form.thresholdValue } : {},
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      updatedBy: t("currentUser"),
    };
    if (editingRule) {
      setRuleRows((prev) => prev.map((r) => (r.id === editingRule.id ? { ...r, ...payload } : r)));
    } else {
      setRuleRows((prev) => [{ id: `alr_${Date.now().toString().slice(-6)}`, ...payload }, ...prev]);
    }
    setFormOpen(false);
  };
  const toggleRule = (r: AlertRule) =>
    setRuleRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: x.status === "ENABLED" ? "DISABLED" : "ENABLED" } : x)));
  const removeRule = (r: AlertRule) => setRuleRows((prev) => prev.filter((x) => x.id !== r.id));

  // ---- 历史处理 ----
  const updateHistoryStatus = (id: string, status: AlertHistoryStatus, actionLabel: string) => {
    setHistoryRows((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const record = {
          operator: t("currentUser"),
          action: actionLabel,
          time: new Date().toISOString().replace("T", " ").substring(0, 19),
        };
        return {
          ...h,
          status,
          assignee: status === "PROCESSING" ? t("currentUser") : h.assignee,
          handlingRecords: [...h.handlingRecords, record],
        };
      })
    );
    setDetailHistory((prev) => {
      if (!prev || prev.id !== id) return prev;
      const record = {
        operator: t("currentUser"),
        action: actionLabel,
        time: new Date().toISOString().replace("T", " ").substring(0, 19),
      };
      return {
        ...prev,
        status,
        assignee: status === "PROCESSING" ? t("currentUser") : prev.assignee,
        handlingRecords: [...prev.handlingRecords, record],
      };
    });
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={7} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <BellRing className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("subtitle")}
          </p>
        </div>
        {tab === "rules" && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("addRule")}
          </button>
        )}
      </div>

      {/* {t("notifyConfig")}卡片 */}
      <div className="bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg mb-3">
          <Webhook className="w-3.5 h-3.5 text-fg-tertiary" /> {t("notifyConfig")}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-xs text-fg-secondary">
            <input type="checkbox" checked={inAppEnabled} onChange={(e) => setInAppEnabled(e.target.checked)} className="w-4 h-4 accent-primary" />
            <MessageSquare className="w-3.5 h-3.5" /> {t("inAppAlways")}
          </label>
          <div>
            <label className="flex items-center gap-2 text-xs text-fg-secondary mb-1.5">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="w-4 h-4 accent-primary" />
              <Mail className="w-3.5 h-3.5" /> 邮件通知
            </label>
            {emailEnabled && (
              <input value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} placeholder="收件人，逗号分隔"
                className="w-full px-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-fg-secondary mb-1.5">
              <input type="checkbox" checked={webhookEnabled} onChange={(e) => setWebhookEnabled(e.target.checked)} className="w-4 h-4 accent-primary" />
              <Webhook className="w-3.5 h-3.5" /> Webhook 回调
            </label>
            {webhookEnabled && (
              <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..."
                className="w-full px-3 py-1.5 bg-subtle border border-line rounded-lg text-xs font-mono" />
            )}
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-line/80 shadow-card w-fit">
        {([
          { key: "rules" as const, label: t("tabs.rules"), icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
          { key: "histories" as const, label: t("tabs.histories"), icon: <AlertTriangle className="w-3.5 h-3.5" /> },
        ]).map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === tabItem.key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"
            }`}
          >
            {tabItem.icon}
            {tabItem.label}
            {tabItem.key === "histories" && filteredHistories.filter((h) => h.status === "UNHANDLED").length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {filteredHistories.filter((h) => h.status === "UNHANDLED").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============ {t("tabs.rules")} Tab ============ */}
      {tab === "rules" && (
        <>
          {/* Filter bar */}
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <span className="text-fg-tertiary text-xs">{t("statusFilter")}</span>
              {(["ALL", "ENABLED", "DISABLED"] as const).map((s) => (
                <button key={s} onClick={() => setRuleFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${ruleFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {s === "ALL" ? t("status.all") : s === "ENABLED" ? t("status.enabled") : t("status.disabled")}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder={t("searchRules")} value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">规则名称</th>
                    <th className="py-2 px-3">监控对象</th>
                    <th className="py-2 px-3">触发条件</th>
                    <th className="py-2 px-3">严重级别</th>
                    <th className="py-2 px-3">通知渠道</th>
                    <th className="py-2 px-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<AlertRule>(filteredRules, currentPage, pageSize).map((r) => (
                    <ContextMenu
                      key={r.id}
                      items={[
                        { key: "edit", label: "编辑", icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEdit(r) },
                        { key: "toggle", label: r.status === "ENABLED" ? "停用" : "启用", icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleRule(r) },
                        { key: "delete", label: "删除", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                        { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRuleRows((prev) => [...prev]) },
                      ]}
                      trigger={
                        <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                          <td className="py-3 px-3 font-medium text-fg truncate max-w-[180px]" title={r.name}>{r.name}</td>
                          <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{MONITOR_LABEL[r.monitorObject]}</td>
                          <td className="py-3 px-3 text-fg-secondary truncate max-w-[240px]" title={r.triggerCondition}>{r.triggerCondition}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${SEVERITY_META[r.severity].badge}`}>{SEVERITY_META[r.severity].label}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {r.notifyChannels.map((c) => (
                                <span key={c} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-hover text-fg-secondary">
                                  {CHANNEL_META[c].icon}{CHANNEL_META[c].label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${r.status === "ENABLED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-hover text-fg-secondary border-line"}`}>
                              {r.status === "ENABLED" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {r.status === "ENABLED" ? t("status.enabled") : t("status.disabled")}
                            </span>
                          </td>
                        </tr>
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalItems={filteredRules.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        </>
      )}

      {/* ============ {t("tabs.histories")} Tab ============ */}
      {tab === "histories" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <span className="text-fg-tertiary text-xs">{t("statusFilter")}</span>
              {(["ALL", "UNHANDLED", "PROCESSING", "RESOLVED", "IGNORED"] as const).map((s) => (
                <button key={s} onClick={() => setHistoryStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${historyStatusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {s === "ALL" ? t("status.all") : HISTORY_STATUS_META[s].label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder="搜索告警标题 / 规则..." value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">告警标题</th>
                    <th className="py-2 px-3">规则名称</th>
                    <th className="py-2 px-3">严重级别</th>
                    <th className="py-2 px-3">状态</th>
                    <th className="py-2 px-3">触发时间</th>
                    <th className="py-2 px-3">处理人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<AlertHistory>(filteredHistories, hPage, hSize).map((h) => {
                    const sm = HISTORY_STATUS_META[h.status];
                    return (
                      <ContextMenu
                        key={h.id}
                        items={[
                          { key: "view", label: "查看详情", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailHistory(h) },
                          { key: "processing", label: "标记处理中", icon: <Loader2 className="w-3.5 h-3.5" />, disabled: h.status !== "UNHANDLED", onClick: () => updateHistoryStatus(h.id, "PROCESSING", "认领处理") },
                          { key: "resolve", label: "标记已解决", icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: h.status === "RESOLVED" || h.status === "IGNORED", onClick: () => updateHistoryStatus(h.id, "RESOLVED", "标记已解决") },
                          { key: "ignore", label: "忽略", icon: <XCircle className="w-3.5 h-3.5" />, disabled: h.status === "RESOLVED" || h.status === "IGNORED", onClick: () => updateHistoryStatus(h.id, "IGNORED", "忽略告警") },
                          { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setHistoryRows((prev) => [...prev]) },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 font-medium text-fg truncate max-w-[260px]" title={h.title}>{h.title}</td>
                            <td className="py-3 px-3 text-fg-secondary whitespace-nowrap">{h.ruleName}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${SEVERITY_META[h.severity].badge}`}>{h.severity}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{h.triggerTime}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{h.assignee || "-"}</td>
                          </tr>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={hPage} totalItems={filteredHistories.length} pageSize={hSize} onPageChange={setHPage} />
          </div>
        </>
      )}

      {/* 规则新增/编辑 SideSheet */}
      <SideSheet
        id="alert-rule-form"
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingRule ? t("form.editTitle") : t("form.createTitle")}
        description={t("form.description")}
        icon={<BellRing className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSave} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">规则名称</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder="如：Stripe 渠道健康度异常" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">监控对象</label>
              <ShadcnSelect value={form.monitorObject} onValueChange={(v) => setForm((f) => ({ ...f, monitorObject: v as AlertMonitorObject }))}
                options={(Object.keys(MONITOR_LABEL) as AlertMonitorObject[]).map((k) => ({ value: k, label: MONITOR_LABEL[k] }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">严重级别</label>
              <ShadcnSelect value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as AlertSeverity }))}
                options={(["P0", "P1", "P2"] as AlertSeverity[]).map((s) => ({ value: s, label: s }))} />
            </div>
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">阈值参数（如延迟 ms / 失败率 % / 金额）</label>
            <input value={form.thresholdValue} onChange={(e) => setForm((f) => ({ ...f, thresholdValue: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder="如 2000 / 15 / 500" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">触发条件描述</label>
            <textarea value={form.triggerCondition} onChange={(e) => setForm((f) => ({ ...f, triggerCondition: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" placeholder="如：延迟 > 2000ms 持续 3 分钟" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">通知渠道（多选）</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CHANNEL_META) as NotifyChannel[]).map((c) => {
                const on = form.notifyChannels.includes(c);
                return (
                  <button key={c} type="button"
                    onClick={() => setForm((f) => ({ ...f, notifyChannels: on ? f.notifyChannels.filter((x) => x !== c) : [...f.notifyChannels, c] }))}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-subtle text-fg-secondary border-line hover:bg-hover"}`}>
                    {CHANNEL_META[c].icon}{CHANNEL_META[c].label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-fg-secondary text-xs">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 accent-primary" />
            启用该规则
          </label>
        </div>
      </SideSheet>

      {/* 告警详情 SideSheet */}
      <SideSheet
        id="alert-detail"
        isOpen={!!detailHistory}
        onClose={() => setDetailHistory(null)}
        title={detailHistory ? detailHistory.title : "告警详情"}
        description={detailHistory ? `规则：${detailHistory.ruleName} · ${detailHistory.severity}` : ""}
        icon={<BellRing className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          detailHistory && detailHistory.status !== "RESOLVED" && detailHistory.status !== "IGNORED" ? (
            <>
              {detailHistory.status === "UNHANDLED" && (
                <button onClick={() => updateHistoryStatus(detailHistory.id, "PROCESSING", "认领处理")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer">标记处理中</button>
              )}
              <Popconfirm title="确认标记为已解决？" description="标记后该告警将进入已解决状态。" confirmText="确认解决"
                onConfirm={() => updateHistoryStatus(detailHistory.id, "RESOLVED", "标记已解决")}>
                <button className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer">标记已解决</button>
              </Popconfirm>
              <Popconfirm title="确认忽略该告警？" description="忽略后将不再提醒。" confirmText="确认忽略"
                onConfirm={() => updateHistoryStatus(detailHistory.id, "IGNORED", "忽略告警")}>
                <button className="px-3 py-2 rounded-lg text-xs font-semibold bg-hover text-fg-secondary hover:bg-hover cursor-pointer">忽略</button>
              </Popconfirm>
            </>
          ) : (
            <button onClick={() => setDetailHistory(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">关闭</button>
          )
        }
      >
        {detailHistory && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">严重级别</div>
                <div className="font-semibold mt-1"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${SEVERITY_META[detailHistory.severity].badge}`}>{detailHistory.severity}</span></div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">当前状态</div>
                <div className="font-semibold mt-1"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${HISTORY_STATUS_META[detailHistory.status].badge}`}>{HISTORY_STATUS_META[detailHistory.status].icon}{HISTORY_STATUS_META[detailHistory.status].label}</span></div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">处理人</div>
                <div className="font-semibold mt-1 text-fg">{detailHistory.assignee || "未分配"}</div>
              </div>
            </div>

            {detailHistory.message && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">{detailHistory.message}</div>
            )}

            <div>
              <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-fg-tertiary" /> 触发时间线
              </div>
              <div className="space-y-2">
                {detailHistory.timeline.map((s, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      {i < detailHistory.timeline.length - 1 && <span className="w-px flex-1 bg-line my-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="font-medium text-fg">{s.title}</div>
                      <div className="font-mono text-[11px] text-fg-tertiary mt-0.5">{s.timestamp}</div>
                      {s.description && <div className="text-[11px] text-fg-secondary mt-0.5">{s.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-semibold text-fg mb-2">处理记录</div>
              {detailHistory.handlingRecords.length === 0 ? (
                <div className="text-fg-tertiary text-[11px] bg-subtle p-3 rounded-xl border border-line">暂无处理记录</div>
              ) : (
                <div className="space-y-1.5">
                  {detailHistory.handlingRecords.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-subtle px-3 py-2 rounded-lg border border-line">
                      <div>
                        <span className="font-medium text-fg">{r.operator}</span>
                        <span className="text-fg-secondary mx-1.5">{r.action}</span>
                        {r.note && <span className="text-fg-tertiary">— {r.note}</span>}
                      </div>
                      <span className="font-mono text-[11px] text-fg-tertiary">{r.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
