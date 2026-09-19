import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as riskApi from "../api/modules/risk";
import { useTranslation } from "react-i18next";
import {
  Shield,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Ban,
  EyeOff,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { RiskRule, BlacklistEntry, RiskRuleType, RiskAction, BlacklistType } from "../types/payment";


const emptyRuleForm = {
  name: "",
  type: "FAILURE_RATE" as RiskRuleType,
  action: "ALERT" as RiskAction,
  paramPercent: "15",
  paramWindow: "60",
  paramAmount: "5000",
  paramPerMin: "10",
  region: "EEA",
  status: true,
};
const emptyBlForm = { type: "CARD_BIN" as BlacklistType, value: "", reason: "", expiresAt: "" };

export const RiskRulesView: React.FC = () => {
  const { t } = useTranslation(["system", "common"]);
  const [tab, setTab] = useState<"rules" | "blacklist">("rules");
  const [ruleRows, setRuleRows] = useState<RiskRule[]>([]);
  const [blRows, setBlRows] = useState<BlacklistEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [ruleRows, blRows] = await Promise.all([
        riskApi.listRiskRules(),
        riskApi.listBlacklist(),
      ]);
      setRuleRows(ruleRows);
      setBlRows(blRows);
    } catch {
      setRuleRows([]);
      setBlRows([]);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const TYPE_LABEL = useMemo(
    (): Record<RiskRuleType, string> => ({
      THREE_DS: t("riskRules.ruleTypes.THREE_DS"),
      FAILURE_RATE: t("riskRules.ruleTypes.FAILURE_RATE"),
      ABNORMAL_AMOUNT: t("riskRules.ruleTypes.ABNORMAL_AMOUNT"),
      ABNORMAL_FREQ: t("riskRules.ruleTypes.ABNORMAL_FREQ"),
    }),
    [t]
  );

  const ACTION_META = useMemo(
    (): Record<RiskAction, { label: string; badge: string }> => ({
      BLOCK: { label: t("riskRules.actions.BLOCK"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
      ALERT: { label: t("riskRules.actions.ALERT"), badge: "bg-amber-50 text-amber-700 border-amber-200" },
      MANUAL_REVIEW: { label: t("riskRules.actions.MANUAL_REVIEW"), badge: "bg-blue-50 text-blue-700 border-blue-200" },
    }),
    [t]
  );

  const RULE_STATUS_BADGE = useMemo(
    (): Record<RiskRule["status"], { label: string; badge: string; icon: React.ReactNode }> => ({
      ENABLED: { label: t("riskRules.ruleStatus.ENABLED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      DISABLED: { label: t("riskRules.ruleStatus.DISABLED"), badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  const BL_TYPE_LABEL = useMemo(
    (): Record<BlacklistType, string> => ({
      CARD_BIN: t("riskRules.blacklistTypes.CARD_BIN"),
      IP: t("riskRules.blacklistTypes.IP"),
      EMAIL: t("riskRules.blacklistTypes.EMAIL"),
    }),
    [t]
  );

  const BL_STATUS_BADGE = useMemo(
    (): Record<BlacklistEntry["status"], { label: string; badge: string; icon: React.ReactNode }> => ({
      ACTIVE: { label: t("riskRules.blacklistStatus.ACTIVE"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      EXPIRED: { label: t("riskRules.blacklistStatus.EXPIRED"), badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  const [ruleStatus, setRuleStatus] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const rulePg = usePagination(10);
  useEffect(() => { rulePg.reset(); }, [ruleStatus, rulePg.reset]);

  const [blTypeFilter, setBlTypeFilter] = useState<"ALL" | BlacklistType>("ALL");
  const [blSearch, setBlSearch] = useState("");
  const [blFormOpen, setBlFormOpen] = useState(false);
  const [blForm, setBlForm] = useState(emptyBlForm);
  const blPg = usePagination(10);
  useEffect(() => { blPg.reset(); }, [blTypeFilter, blSearch, blPg.reset]);

  const loading = useViewLoading();

  const filteredRules = useMemo(() => ruleRows.filter((r) => ruleStatus === "ALL" || r.status === ruleStatus), [ruleRows, ruleStatus]);
  const filteredBL = useMemo(() => blRows.filter((b) => {
    const matchType = blTypeFilter === "ALL" || b.type === blTypeFilter;
    const matchSearch = b.value.toLowerCase().includes(blSearch.toLowerCase()) || b.reason.toLowerCase().includes(blSearch.toLowerCase());
    return matchType && matchSearch;
  }), [blRows, blTypeFilter, blSearch]);

  const buildCondition = (form: typeof emptyRuleForm) => {
    if (form.type === "THREE_DS") return t("riskRules.conditions.threeDs", { region: form.region });
    if (form.type === "FAILURE_RATE") return t("riskRules.conditions.failureRate", { window: form.paramWindow, percent: form.paramPercent });
    if (form.type === "ABNORMAL_AMOUNT") return t("riskRules.conditions.abnormalAmount", { amount: form.paramAmount });
    return t("riskRules.conditions.abnormalFreq", { count: form.paramPerMin });
  };

  const openRuleCreate = () => { setEditingRule(null); setRuleForm(emptyRuleForm); setRuleFormOpen(true); };
  const openRuleEdit = (r: RiskRule) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name, type: r.type, action: r.action,
      paramPercent: String(r.params.percent ?? "15"), paramWindow: String(r.params.windowMin ?? "60"),
      paramAmount: String(r.params.singleLimit ?? "5000"), paramPerMin: String(r.params.perMinute ?? "10"),
      region: String(r.params.region ?? "EEA"), status: r.status === "ENABLED",
    });
    setRuleFormOpen(true);
  };
  const handleSaveRule = () => {
    if (!ruleForm.name.trim()) return;
    const params: Record<string, string | number> = {};
    if (ruleForm.type === "THREE_DS") params.region = ruleForm.region;
    else if (ruleForm.type === "FAILURE_RATE") { params.percent = Number(ruleForm.paramPercent); params.windowMin = Number(ruleForm.paramWindow); }
    else if (ruleForm.type === "ABNORMAL_AMOUNT") params.singleLimit = Number(ruleForm.paramAmount);
    else params.perMinute = Number(ruleForm.paramPerMin);
    const payload = {
      name: ruleForm.name, type: ruleForm.type, action: ruleForm.action,
      condition: buildCondition(ruleForm), params,
      status: (ruleForm.status ? "ENABLED" : "DISABLED") as "ENABLED" | "DISABLED",
    };
    if (editingRule) setRuleRows((prev) => prev.map((r) => (r.id === editingRule.id ? { ...r, ...payload } : r)));
    else setRuleRows((prev) => [{ id: `risk_${Date.now().toString().slice(-6)}`, ...payload, updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16) }, ...prev]);
    setRuleFormOpen(false);
  };
  const toggleRule = (r: RiskRule) => setRuleRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: x.status === "ENABLED" ? "DISABLED" : "ENABLED" } : x)));
  const removeRule = (r: RiskRule) => setRuleRows((prev) => prev.filter((x) => x.id !== r.id));

  const openBlCreate = () => { setBlForm(emptyBlForm); setBlFormOpen(true); };
  const handleSaveBl = () => {
    if (!blForm.value.trim()) return;
    setBlRows((prev) => [{
      id: `bl_${Date.now().toString().slice(-6)}`, type: blForm.type, value: blForm.value,
      reason: blForm.reason || t("riskRules.defaults.manualAdd"),
      expiresAt: blForm.expiresAt || t("riskRules.defaults.permanent"),
      status: "ACTIVE", createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
    }, ...prev]);
    setBlFormOpen(false);
  };
  const removeBL = (b: BlacklistEntry) => setBlRows((prev) => prev.filter((x) => x.id !== b.id));

  const blValuePlaceholder = blForm.type === "CARD_BIN"
    ? t("riskRules.blacklistSheet.valuePlaceholderCardBin")
    : blForm.type === "IP"
    ? t("riskRules.blacklistSheet.valuePlaceholderIp")
    : t("riskRules.blacklistSheet.valuePlaceholderEmail");

  if (loading) return <TableSkeleton rows={9} cols={6} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("riskRules.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("riskRules.subtitle")}</p>
        </div>
        {tab === "rules" ? (
          <button onClick={openRuleCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("riskRules.addRule")}
          </button>
        ) : (
          <button onClick={openBlCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("riskRules.addBlacklist")}
          </button>
        )}
      </div>

      <div className="flex gap-1.5 bg-surface p-1.5 rounded-xl border border-line/80 shadow-card w-fit">
        {([
          ["rules", t("riskRules.tabs.rules"), <Shield key="r" className="w-3.5 h-3.5" />],
          ["blacklist", t("riskRules.tabs.blacklist"), <Ban key="b" className="w-3.5 h-3.5" />],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex items-center gap-2 flex-wrap text-xs">
            <span className="text-fg-tertiary text-xs">{t("riskRules.rulesTab.statusLabel")}</span>
            {(["ALL", "ENABLED", "DISABLED"] as const).map((s) => (
              <button key={s} onClick={() => setRuleStatus(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${ruleStatus === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                {s === "ALL" ? t("riskRules.rulesTab.all") : RULE_STATUS_BADGE[s].label}
              </button>
            ))}
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.name")}</th>
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.type")}</th>
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.condition")}</th>
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.action")}</th>
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.params")}</th>
                    <th className="py-2 px-3">{t("riskRules.rulesTab.table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<RiskRule>(filteredRules, rulePg.currentPage, rulePg.pageSize).map((r) => {
                    const sm = RULE_STATUS_BADGE[r.status];
                    const am = ACTION_META[r.action];
                    return (
                      <ContextMenu
                        key={r.id}
                        items={[
                          { key: "edit", label: t("riskRules.rulesTab.menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openRuleEdit(r) },
                          { key: "toggle", label: r.status === "ENABLED" ? t("riskRules.rulesTab.menu.disable") : t("riskRules.rulesTab.menu.enable"), icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleRule(r) },
                          { key: "delete", label: t("riskRules.rulesTab.menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                          { key: "refresh", label: t("riskRules.rulesTab.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRuleRows((prev) => [...prev]) },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 font-medium text-fg truncate max-w-[160px]" title={r.name}>{r.name}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TYPE_LABEL[r.type]}</td>
                            <td className="py-3 px-3 text-fg-secondary truncate max-w-[220px]" title={r.condition}>{r.condition}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${am.badge}`}>{am.label}</span></td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-tertiary">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(", ")}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span></td>
                          </tr>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={rulePg.currentPage} totalItems={filteredRules.length} pageSize={rulePg.pageSize} onPageChange={rulePg.setCurrentPage} onPageSizeChange={rulePg.setPageSize} />
          </div>
        </>
      )}

      {tab === "blacklist" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-fg-tertiary text-xs">{t("riskRules.blacklistTab.typeLabel")}</span>
              {(["ALL", "CARD_BIN", "IP", "EMAIL"] as const).map((typeKey) => (
                <button key={typeKey} onClick={() => setBlTypeFilter(typeKey)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${blTypeFilter === typeKey ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {typeKey === "ALL" ? t("riskRules.blacklistTab.all") : BL_TYPE_LABEL[typeKey]}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder={t("riskRules.blacklistTab.searchPlaceholder")} value={blSearch} onChange={(e) => setBlSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.type")}</th>
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.value")}</th>
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.reason")}</th>
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.expiresAt")}</th>
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.createdAt")}</th>
                    <th className="py-2 px-3">{t("riskRules.blacklistTab.table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<BlacklistEntry>(filteredBL, blPg.currentPage, blPg.pageSize).map((b) => {
                    const sm = BL_STATUS_BADGE[b.status];
                    return (
                      <ContextMenu
                        key={b.id}
                        items={[
                          { key: "delete", label: t("riskRules.blacklistTab.menu.remove"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeBL(b) },
                          { key: "refresh", label: t("riskRules.blacklistTab.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setBlRows((prev) => [...prev]) },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 whitespace-nowrap"><span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary border border-line">{BL_TYPE_LABEL[b.type]}</span></td>
                            <td className="py-3 px-3 font-mono text-fg truncate max-w-[200px]" title={b.value}>{b.value}</td>
                            <td className="py-3 px-3 text-fg-secondary truncate max-w-[220px]" title={b.reason}>{b.reason}</td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary">{b.expiresAt}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-tertiary whitespace-nowrap">{b.createdAt}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span></td>
                          </tr>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={blPg.currentPage} totalItems={filteredBL.length} pageSize={blPg.pageSize} onPageChange={blPg.setCurrentPage} onPageSizeChange={blPg.setPageSize} />
          </div>
        </>
      )}

      <SideSheet
        id="risk-form"
        isOpen={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        title={editingRule ? t("riskRules.ruleSheet.editTitle") : t("riskRules.ruleSheet.createTitle")}
        description={t("riskRules.ruleSheet.description")}
        icon={<Shield className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            {editingRule && (
              <Popconfirm title={t("riskRules.ruleSheet.deleteTitle")} description={t("riskRules.ruleSheet.deleteDescription", { name: editingRule.name })} confirmText={t("riskRules.ruleSheet.deleteConfirm")} onConfirm={() => { removeRule(editingRule); setRuleFormOpen(false); }}>
                <button className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white mr-auto">{t("riskRules.ruleSheet.deleteButton")}</button>
              </Popconfirm>
            )}
            <button onClick={() => setRuleFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveRule} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.name")}</label>
            <input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("riskRules.ruleSheet.namePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.type")}</label>
              <ShadcnSelect value={ruleForm.type} onValueChange={(v) => setRuleForm((f) => ({ ...f, type: v as RiskRuleType }))} options={(Object.keys(TYPE_LABEL) as RiskRuleType[]).map((typeKey) => ({ value: typeKey, label: TYPE_LABEL[typeKey] }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.action")}</label>
              <ShadcnSelect value={ruleForm.action} onValueChange={(v) => setRuleForm((f) => ({ ...f, action: v as RiskAction }))} options={(Object.keys(ACTION_META) as RiskAction[]).map((a) => ({ value: a, label: ACTION_META[a].label }))} />
            </div>
          </div>
          {ruleForm.type === "THREE_DS" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.region")}</label>
              <ShadcnSelect value={ruleForm.region} onValueChange={(v) => setRuleForm((f) => ({ ...f, region: v }))} options={["EEA", "US", "APAC", "GLOBAL"].map((c) => ({ value: c, label: c }))} />
            </div>
          )}
          {ruleForm.type === "FAILURE_RATE" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.failurePercent")}</label>
                <input type="number" value={ruleForm.paramPercent} onChange={(e) => setRuleForm((f) => ({ ...f, paramPercent: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.failureWindow")}</label>
                <input type="number" value={ruleForm.paramWindow} onChange={(e) => setRuleForm((f) => ({ ...f, paramWindow: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
            </div>
          )}
          {ruleForm.type === "ABNORMAL_AMOUNT" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.amountLimit")}</label>
              <input type="number" value={ruleForm.paramAmount} onChange={(e) => setRuleForm((f) => ({ ...f, paramAmount: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          )}
          {ruleForm.type === "ABNORMAL_FREQ" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.ruleSheet.freqLimit")}</label>
              <input type="number" value={ruleForm.paramPerMin} onChange={(e) => setRuleForm((f) => ({ ...f, paramPerMin: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          )}
          <label className="flex items-center gap-2 text-fg-secondary text-xs">
            <input type="checkbox" checked={ruleForm.status} onChange={(e) => setRuleForm((f) => ({ ...f, status: e.target.checked }))} className="w-4 h-4 accent-primary" />
            {t("riskRules.ruleSheet.enableRule")}
          </label>
        </div>
      </SideSheet>

      <SideSheet
        id="bl-form"
        isOpen={blFormOpen}
        onClose={() => setBlFormOpen(false)}
        title={t("riskRules.blacklistSheet.title")}
        description={t("riskRules.blacklistSheet.description")}
        icon={<Ban className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setBlFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveBl} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("riskRules.blacklistSheet.submit")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.blacklistSheet.type")}</label>
            <ShadcnSelect value={blForm.type} onValueChange={(v) => setBlForm((f) => ({ ...f, type: v as BlacklistType }))} options={(Object.keys(BL_TYPE_LABEL) as BlacklistType[]).map((typeKey) => ({ value: typeKey, label: BL_TYPE_LABEL[typeKey] }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.blacklistSheet.value")}</label>
            <input value={blForm.value} onChange={(e) => setBlForm((f) => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={blValuePlaceholder} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.blacklistSheet.reason")}</label>
            <input value={blForm.reason} onChange={(e) => setBlForm((f) => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("riskRules.blacklistSheet.reasonPlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("riskRules.blacklistSheet.expiresAt")}</label>
            <input type="date" value={blForm.expiresAt} onChange={(e) => setBlForm((f) => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            <div className="text-[11px] text-fg-tertiary mt-1">{t("riskRules.blacklistSheet.expiresHint")}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-fg-tertiary bg-subtle p-2 rounded-lg border border-line">
            <EyeOff className="w-3.5 h-3.5" /> {t("riskRules.blacklistSheet.blockHint")}
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
