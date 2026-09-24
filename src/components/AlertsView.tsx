import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as alertsApi from "../api/modules/alerts";
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
  SlidersHorizontal,
  Zap,
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
  AlertChannel,
  AlertChannelType,
} from "../types/payment";

const SEVERITY_META: Record<AlertSeverity, { label: string; badge: string }> = {
  P0: { label: "P0", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  P1: { label: "P1", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  P2: { label: "P2", badge: "bg-blue-50 text-blue-700 border-blue-200" },
};

const emptyRuleForm = {
  name: "",
  monitorObject: "CHANNEL_ABNORMAL" as AlertMonitorObject,
  triggerCondition: "",
  severity: "P1" as AlertSeverity,
  notifyChannels: ["IN_APP"] as NotifyChannel[],
  enabled: true,
  thresholdValue: "",
};

const emptyChannelForm = {
  name: "",
  channelType: "EMAIL" as AlertChannelType,
  enabled: true,
  emailRecipients: "",
  emailChannelId: "",
  webhookUrl: "",
  webhookMethod: "POST",
  webhookHeaders: "",
};

export const AlertsView: React.FC = () => {
  const { t } = useTranslation(["alerts", "common"]);
  const [ruleRows, setRuleRows] = useState<AlertRule[]>([]);
  const [historyRows, setHistoryRows] = useState<AlertHistory[]>([]);
  const [channelRows, setChannelRows] = useState<AlertChannel[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [rules, histories, channels] = await Promise.all([
        alertsApi.listAlertRules(),
        alertsApi.listAlertHistory(),
        alertsApi.listAlertChannels(),
      ]);
      setRuleRows(rules);
      setHistoryRows(histories);
      setChannelRows(channels);
    } catch {
      setRuleRows([]);
      setHistoryRows([]);
      setChannelRows([]);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    PROCESSING: { label: t("historyStatus.PROCESSING"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    RESOLVED: { label: t("historyStatus.RESOLVED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    IGNORED: { label: t("historyStatus.IGNORED"), badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
  }), [t]);

  const CHANNEL_TYPE_META = useMemo((): Record<AlertChannelType, { label: string; icon: React.ReactNode }> => ({
    EMAIL: { label: t("notifyChannel.EMAIL"), icon: <Mail className="w-3.5 h-3.5" /> },
    WEBHOOK: { label: t("notifyChannel.WEBHOOK"), icon: <Webhook className="w-3.5 h-3.5" /> },
    IN_APP: { label: t("notifyChannel.IN_APP"), icon: <MessageSquare className="w-3.5 h-3.5" /> },
  }), [t]);

  const [tab, setTab] = useState<"rules" | "histories" | "channels">("rules");

  // ---- Rules tab state ----
  const [ruleFilter, setRuleFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [ruleSearch, setRuleSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const rulePg = usePagination(10);
  useEffect(() => { rulePg.reset(); }, [ruleFilter, ruleSearch, tab, rulePg.reset]);

  // ---- Histories tab state ----
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [detailHistory, setDetailHistory] = useState<AlertHistory | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const histPg = usePagination(10);
  useEffect(() => { histPg.reset(); }, [historyStatusFilter, historySearch, tab, histPg.reset]);

  // ---- Channels tab state ----
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null);
  const [channelForm, setChannelForm] = useState(emptyChannelForm);
  const channelPg = usePagination(10);

  // ---- Filters ----
  const filteredRules = useMemo(() => {
    return ruleRows.filter((r) => {
      const matchStatus = ruleFilter === "ALL" || r.status === ruleFilter;
      const matchSearch =
        r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
        MONITOR_LABEL[r.monitorObject].toLowerCase().includes(ruleSearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [ruleRows, ruleFilter, ruleSearch, MONITOR_LABEL]);

  const filteredHistories = useMemo(() => {
    return historyRows.filter((h) => {
      const matchStatus = historyStatusFilter === "ALL" || h.status === historyStatusFilter;
      const matchSearch =
        h.title.toLowerCase().includes(historySearch.toLowerCase()) ||
        h.ruleName.toLowerCase().includes(historySearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [historyRows, historyStatusFilter, historySearch]);

  // ---- Rule CRUD ----
  const openCreate = () => { setEditingRule(null); setForm(emptyRuleForm); setFormOpen(true); };
  const openEdit = (r: AlertRule) => {
    setEditingRule(r);
    setForm({
      name: r.name, monitorObject: r.monitorObject, triggerCondition: r.triggerCondition,
      severity: r.severity, notifyChannels: r.notifyChannels, enabled: r.status === "ENABLED",
      thresholdValue: String(Object.values(r.thresholdParams)[0] ?? ""),
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload: Partial<AlertRule> = {
      name: form.name,
      monitorObject: form.monitorObject,
      triggerCondition: form.triggerCondition || t("defaultCondition"),
      severity: form.severity,
      notifyChannels: form.notifyChannels,
      status: (form.enabled ? "ENABLED" : "DISABLED") as "ENABLED" | "DISABLED",
      thresholdParams: form.thresholdValue ? { value: Number(form.thresholdValue) } : {},
    };
    try {
      const saved = await alertsApi.saveAlertRule(payload);
      if (editingRule) {
        setRuleRows((prev) => prev.map((r) => (r.id === editingRule.id ? saved : r)));
      } else {
        setRuleRows((prev) => [saved, ...prev]);
      }
      setFormOpen(false);
    } catch (err) {
      console.error("save alert rule failed", err);
    }
  };

  const toggleRule = async (r: AlertRule) => {
    try {
      const updated = await alertsApi.toggleAlertRule(r.id);
      setRuleRows((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch (err) {
      console.error("toggle alert rule failed", err);
    }
  };

  const removeRule = async (r: AlertRule) => {
    try {
      await alertsApi.deleteAlertRule(r.id);
      setRuleRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      console.error("delete alert rule failed", err);
    }
  };

  const handleTrigger = async (r: AlertRule) => {
    try {
      const result = await alertsApi.triggerAlertRule(r.id);
      alert(`${r.name}: ${result.message}`);
    } catch (err) {
      console.error("trigger alert rule failed", err);
    }
  };

  // ---- History handling ----
  const handleAck = async (h: AlertHistory) => {
    try {
      const updated = await alertsApi.ackAlertHistory(h.id);
      setHistoryRows((prev) => prev.map((x) => (x.id === h.id ? updated : x)));
      setDetailHistory((prev) => (prev && prev.id === h.id ? updated : prev));
    } catch (err) {
      console.error("ack alert failed", err);
    }
  };

  const handleResolve = async (h: AlertHistory) => {
    const note = resolveNote.trim();
    try {
      const updated = await alertsApi.resolveAlertHistory(h.id, note);
      setHistoryRows((prev) => prev.map((x) => (x.id === h.id ? updated : x)));
      setDetailHistory(null);
      setResolveNote("");
    } catch (err) {
      console.error("resolve alert failed", err);
    }
  };

  // ---- Channel CRUD ----
  const openChannelCreate = () => {
    setEditingChannel(null);
    setChannelForm(emptyChannelForm);
    setChannelFormOpen(true);
  };

  const openChannelEdit = (c: AlertChannel) => {
    setEditingChannel(c);
    const cfg = (c.config || {}) as Record<string, string>;
    setChannelForm({
      name: c.name,
      channelType: c.channelType,
      enabled: c.enabled,
      emailRecipients: cfg.recipients ?? "",
      emailChannelId: cfg.emailChannelId ?? "",
      webhookUrl: cfg.url ?? "",
      webhookMethod: cfg.method ?? "POST",
      webhookHeaders: cfg.headers ? JSON.stringify(cfg.headers, null, 2) : "",
    });
    setChannelFormOpen(true);
  };

  const handleSaveChannel = async () => {
    if (!channelForm.name.trim()) return;
    const config: Record<string, unknown> = {};
    if (channelForm.channelType === "EMAIL") {
      config.recipients = channelForm.emailRecipients;
      config.emailChannelId = channelForm.emailChannelId;
    } else if (channelForm.channelType === "WEBHOOK") {
      config.url = channelForm.webhookUrl;
      config.method = channelForm.webhookMethod;
      try { config.headers = channelForm.webhookHeaders ? JSON.parse(channelForm.webhookHeaders) : {}; } catch { config.headers = {}; }
    }
    const payload: Partial<AlertChannel> = {
      name: channelForm.name,
      channelType: channelForm.channelType,
      enabled: channelForm.enabled,
      config,
    };
    try {
      const saved = await alertsApi.saveAlertChannel(payload);
      if (editingChannel) {
        setChannelRows((prev) => prev.map((c) => (c.id === editingChannel.id ? saved : c)));
      } else {
        setChannelRows((prev) => [saved, ...prev]);
      }
      setChannelFormOpen(false);
    } catch (err) {
      console.error("save channel failed", err);
    }
  };

  const removeChannel = async (c: AlertChannel) => {
    try {
      await alertsApi.deleteAlertChannel(c.id);
      setChannelRows((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      console.error("delete channel failed", err);
    }
  };

  const channelConfigSummary = (c: AlertChannel): string => {
    const cfg = (c.config || {}) as Record<string, string>;
    if (c.channelType === "EMAIL") return cfg.recipients || "-";
    if (c.channelType === "WEBHOOK") return cfg.url || "-";
    return "-";
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
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("subtitle")}</p>
        </div>
        {tab === "rules" && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("addRule")}
          </button>
        )}
        {tab === "channels" && (
          <button onClick={openChannelCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("addChannel")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-line/80 shadow-card w-fit">
        {([
          { key: "rules" as const, label: t("tabs.rules"), icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
          { key: "histories" as const, label: t("tabs.histories"), icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          { key: "channels" as const, label: t("tabs.channels"), icon: <Webhook className="w-3.5 h-3.5" /> },
        ]).map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === tabItem.key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}
          >
            {tabItem.icon}
            {tabItem.label}
            {tabItem.key === "histories" && historyRows.filter((h) => h.status === "UNHANDLED").length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {historyRows.filter((h) => h.status === "UNHANDLED").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============ Rules Tab ============ */}
      {tab === "rules" && (
        <>
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

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("table.ruleName")}</th>
                    <th className="py-2 px-3">{t("table.monitorObject")}</th>
                    <th className="py-2 px-3">{t("table.condition")}</th>
                    <th className="py-2 px-3">{t("table.severity")}</th>
                    <th className="py-2 px-3">{t("table.channels")}</th>
                    <th className="py-2 px-3">{t("table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<AlertRule>(filteredRules, rulePg.currentPage, rulePg.pageSize).map((r) => (
                    <ContextMenu
                      key={r.id}
                      items={[
                        { key: "edit", label: t("menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEdit(r) },
                        { key: "toggle", label: r.status === "ENABLED" ? t("menu.toggle") : t("menu.toggle"), icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleRule(r) },
                        { key: "trigger", label: t("menu.trigger"), icon: <Zap className="w-3.5 h-3.5" />, onClick: () => handleTrigger(r) },
                        { key: "delete", label: t("menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                      ]}
                      trigger={
                        <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                          <td className="py-3 px-3 font-medium text-fg truncate max-w-[180px]" title={r.name}>{r.name}</td>
                          <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{MONITOR_LABEL[r.monitorObject]}</td>
                          <td className="py-3 px-3 text-fg-secondary truncate max-w-[200px]" title={r.triggerCondition}>{r.triggerCondition}</td>
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
            <Pagination currentPage={rulePg.currentPage} totalItems={filteredRules.length} pageSize={rulePg.pageSize} onPageChange={rulePg.setCurrentPage} onPageSizeChange={rulePg.setPageSize} />
          </div>
        </>
      )}

      {/* ============ Histories Tab ============ */}
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
              <input type="text" placeholder={t("searchHistory")} value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("table.title")}</th>
                    <th className="py-2 px-3">{t("table.ruleName")}</th>
                    <th className="py-2 px-3">{t("table.severity")}</th>
                    <th className="py-2 px-3">{t("table.status")}</th>
                    <th className="py-2 px-3">{t("table.triggeredAt")}</th>
                    <th className="py-2 px-3">{t("table.handler")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<AlertHistory>(filteredHistories, histPg.currentPage, histPg.pageSize).map((h) => {
                    const sm = HISTORY_STATUS_META[h.status];
                    return (
                      <ContextMenu
                        key={h.id}
                        items={[
                          { key: "view", label: t("menu.view"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailHistory(h) },
                          { key: "ack", label: t("menu.ack"), icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: h.status !== "UNHANDLED", onClick: () => handleAck(h) },
                          { key: "resolve", label: t("menu.resolve"), icon: <CheckCircle2 className="w-3.5 h-3.5" />, disabled: h.status === "RESOLVED" || h.status === "IGNORED", onClick: () => setDetailHistory(h) },
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
            <Pagination currentPage={histPg.currentPage} totalItems={filteredHistories.length} pageSize={histPg.pageSize} onPageChange={histPg.setCurrentPage} onPageSizeChange={histPg.setPageSize} />
          </div>
        </>
      )}

      {/* ============ Channels Tab ============ */}
      {tab === "channels" && (
        <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2 px-3">{t("channelTable.name")}</th>
                  <th className="py-2 px-3">{t("channelTable.channelType")}</th>
                  <th className="py-2 px-3">{t("channelTable.configSummary")}</th>
                  <th className="py-2 px-3">{t("channelTable.enabled")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginate<AlertChannel>(channelRows, channelPg.currentPage, channelPg.pageSize).map((c) => (
                  <ContextMenu
                    key={c.id}
                    items={[
                      { key: "edit", label: t("menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openChannelEdit(c) },
                      { key: "delete", label: t("menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeChannel(c) },
                    ]}
                    trigger={
                      <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3 font-medium text-fg">{c.name}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary">
                            {CHANNEL_TYPE_META[c.channelType].icon}{CHANNEL_TYPE_META[c.channelType].label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-fg-secondary truncate max-w-[300px]" title={channelConfigSummary(c)}>{channelConfigSummary(c)}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${c.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-hover text-fg-secondary border-line"}`}>
                            {c.enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {c.enabled ? t("status.enabled") : t("status.disabled")}
                          </span>
                        </td>
                      </tr>
                    }
                  />
                ))}
                {channelRows.length === 0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-fg-tertiary text-xs">-</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={channelPg.currentPage} totalItems={channelRows.length} pageSize={channelPg.pageSize} onPageChange={channelPg.setCurrentPage} onPageSizeChange={channelPg.setPageSize} />
        </div>
      )}

      {/* Rule Form SideSheet */}
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
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.name")}</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.monitorObject")}</label>
              <ShadcnSelect value={form.monitorObject} onValueChange={(v) => setForm((f) => ({ ...f, monitorObject: v as AlertMonitorObject }))}
                options={(Object.keys(MONITOR_LABEL) as AlertMonitorObject[]).map((k) => ({ value: k, label: MONITOR_LABEL[k] }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.severity")}</label>
              <ShadcnSelect value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as AlertSeverity }))}
                options={(["P0", "P1", "P2"] as AlertSeverity[]).map((s) => ({ value: s, label: s }))} />
            </div>
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.threshold")}</label>
            <input value={form.thresholdValue} onChange={(e) => setForm((f) => ({ ...f, thresholdValue: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.condition")}</label>
            <textarea value={form.triggerCondition} onChange={(e) => setForm((f) => ({ ...f, triggerCondition: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("form.notifyChannels")}</label>
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
            {t("form.enabled")}
          </label>
        </div>
      </SideSheet>

      {/* History Detail SideSheet */}
      <SideSheet
        id="alert-detail"
        isOpen={!!detailHistory}
        onClose={() => { setDetailHistory(null); setResolveNote(""); }}
        title={detailHistory ? detailHistory.title : t("detail.titleFallback")}
        description={detailHistory ? `${detailHistory.ruleName} · ${detailHistory.severity}` : ""}
        icon={<BellRing className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          detailHistory && detailHistory.status !== "RESOLVED" && detailHistory.status !== "IGNORED" ? (
            <>
              {detailHistory.status === "UNHANDLED" && (
                <button onClick={() => handleAck(detailHistory)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer">{t("menu.ack")}</button>
              )}
              <button
                onClick={() => handleResolve(detailHistory)}
                disabled={!resolveNote.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
              >
                {t("menu.resolve")}
              </button>
              <button onClick={() => { setDetailHistory(null); setResolveNote(""); }} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.close")}</button>
            </>
          ) : (
            <button onClick={() => setDetailHistory(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:actions.close")}</button>
          )
        }
      >
        {detailHistory && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("table.severity")}</div>
                <div className="font-semibold mt-1"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${SEVERITY_META[detailHistory.severity].badge}`}>{detailHistory.severity}</span></div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("table.status")}</div>
                <div className="font-semibold mt-1"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${HISTORY_STATUS_META[detailHistory.status].badge}`}>{HISTORY_STATUS_META[detailHistory.status].icon}{HISTORY_STATUS_META[detailHistory.status].label}</span></div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("table.handler")}</div>
                <div className="font-semibold mt-1 text-fg">{detailHistory.assignee || "-"}</div>
              </div>
            </div>

            {detailHistory.message && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px]">{detailHistory.message}</div>
            )}

            {detailHistory.status !== "RESOLVED" && detailHistory.status !== "IGNORED" && (
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("resolveNote")}</label>
                <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={3}
                  placeholder={t("resolveNotePlaceholder")}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
              </div>
            )}

            {detailHistory.resolutionNote && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-[11px]">
                {t("resolveNote")}: {detailHistory.resolutionNote}
              </div>
            )}
          </div>
        )}
      </SideSheet>

      {/* Channel Form SideSheet */}
      <SideSheet
        id="alert-channel-form"
        isOpen={channelFormOpen}
        onClose={() => setChannelFormOpen(false)}
        title={editingChannel ? t("channelForm.editTitle") : t("channelForm.createTitle")}
        description={t("channelForm.description")}
        icon={<Webhook className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setChannelFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveChannel} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.name")}</label>
            <input value={channelForm.name} onChange={(e) => setChannelForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.channelType")}</label>
            <ShadcnSelect value={channelForm.channelType} onValueChange={(v) => setChannelForm((f) => ({ ...f, channelType: v as AlertChannelType }))}
              options={(Object.keys(CHANNEL_TYPE_META) as AlertChannelType[]).map((k) => ({ value: k, label: CHANNEL_TYPE_META[k].label }))} />
          </div>

          {channelForm.channelType === "EMAIL" && (
            <>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.emailRecipients")}</label>
                <input value={channelForm.emailRecipients} onChange={(e) => setChannelForm((f) => ({ ...f, emailRecipients: e.target.value }))}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.emailChannelId")}</label>
                <input value={channelForm.emailChannelId} onChange={(e) => setChannelForm((f) => ({ ...f, emailChannelId: e.target.value }))}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
            </>
          )}

          {channelForm.channelType === "WEBHOOK" && (
            <>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.webhookUrl")}</label>
                <input value={channelForm.webhookUrl} onChange={(e) => setChannelForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.webhookMethod")}</label>
                <ShadcnSelect value={channelForm.webhookMethod} onValueChange={(v) => setChannelForm((f) => ({ ...f, webhookMethod: v }))}
                  options={["POST", "PUT", "GET"].map((m) => ({ value: m, label: m }))} />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("channelForm.webhookHeaders")}</label>
                <textarea value={channelForm.webhookHeaders} onChange={(e) => setChannelForm((f) => ({ ...f, webhookHeaders: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono resize-none" placeholder='{"Authorization": "Bearer ..."}' />
              </div>
            </>
          )}

          {channelForm.channelType === "IN_APP" && (
            <div className="text-fg-tertiary text-[11px] bg-subtle p-3 rounded-xl border border-line">
              {t("channelForm.inAppConfig")}
            </div>
          )}

          <label className="flex items-center gap-2 text-fg-secondary text-xs">
            <input type="checkbox" checked={channelForm.enabled} onChange={(e) => setChannelForm((f) => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 accent-primary" />
            {t("channelForm.enabled")}
          </label>
        </div>
      </SideSheet>
    </div>
  );
};
