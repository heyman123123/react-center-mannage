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
  ClipboardCheck,
  History,
  Upload,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import {
  RiskRule,
  BlacklistEntry,
  BlacklistType,
  RiskRuleType,
  RiskAction,
  RiskRuleStatus,
  RiskDecision,
  RiskReview,
} from "../types/payment";

const emptyRuleForm = {
  name: "",
  ruleType: "AMOUNT" as RiskRuleType,
  action: "ALERT" as RiskAction,
  scoreWeight: "50",
  status: "DRAFT" as RiskRuleStatus,
  description: "",
  amountThreshold: "5000",
  countries: "",
  timeWindow: "60",
  maxCount: "10",
  behaviorDesc: "",
};

const emptyBlForm = {
  type: "EMAIL" as BlacklistType,
  value: "",
  reason: "",
  expiresAt: "",
};

export const RiskRulesView: React.FC = () => {
  const { t } = useTranslation(["risk", "common"]);
  const [tab, setTab] = useState<"rules" | "blacklist" | "reviews" | "decisions">("rules");
  const [ruleRows, setRuleRows] = useState<RiskRule[]>([]);
  const [blRows, setBlRows] = useState<BlacklistEntry[]>([]);
  const [reviewRows, setReviewRows] = useState<RiskReview[]>([]);
  const [decisionRows, setDecisionRows] = useState<RiskDecision[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [rules, bl, reviews, decisions] = await Promise.all([
        riskApi.listRiskRules(),
        riskApi.listBlacklist(),
        riskApi.listRiskReviews("PENDING"),
        riskApi.listRiskDecisions(),
      ]);
      setRuleRows(rules);
      setBlRows(bl);
      setReviewRows(reviews);
      setDecisionRows(decisions);
    } catch {
      setRuleRows([]);
      setBlRows([]);
      setReviewRows([]);
      setDecisionRows([]);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const TYPE_LABEL = useMemo((): Record<RiskRuleType, string> => ({
    FREQUENCY: t("ruleTypes.FREQUENCY"),
    AMOUNT: t("ruleTypes.AMOUNT"),
    REGION: t("ruleTypes.REGION"),
    BEHAVIOR: t("ruleTypes.BEHAVIOR"),
  }), [t]);

  const ACTION_META = useMemo((): Record<RiskAction, { label: string; badge: string }> => ({
    BLOCK: { label: t("actions.BLOCK"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
    ALERT: { label: t("actions.ALERT"), badge: "bg-amber-50 text-amber-700 border-amber-200" },
    MANUAL_REVIEW: { label: t("actions.MANUAL_REVIEW"), badge: "bg-blue-50 text-blue-700 border-blue-200" },
  }), [t]);

  const RULE_STATUS_BADGE = useMemo(
    (): Record<RiskRuleStatus, { label: string; badge: string }> => ({
      DRAFT: { label: t("ruleStatus.DRAFT"), badge: "bg-gray-100 text-gray-600 border-gray-300" },
      OBSERVE: { label: t("ruleStatus.OBSERVE"), badge: "bg-blue-50 text-blue-700 border-blue-200" },
      ENABLED: { label: t("ruleStatus.ENABLED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      DISABLED: { label: t("ruleStatus.DISABLED"), badge: "bg-hover text-fg-secondary border-line" },
    }),
    [t]
  );

  const BL_TYPE_LABEL = useMemo((): Record<BlacklistType, string> => ({
    EMAIL: t("blacklistTypes.EMAIL"),
    IP: t("blacklistTypes.IP"),
    COUNTRY: t("blacklistTypes.COUNTRY"),
    CARD_BIN: t("blacklistTypes.CARD_BIN"),
    DEVICE_FINGERPRINT: t("blacklistTypes.DEVICE_FINGERPRINT"),
  }), [t]);

  const BL_STATUS_BADGE = useMemo(
    (): Record<BlacklistEntry["status"], { label: string; badge: string }> => ({
      ACTIVE: { label: t("blacklistStatus.ACTIVE"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      EXPIRED: { label: t("blacklistStatus.EXPIRED"), badge: "bg-hover text-fg-secondary border-line" },
    }),
    [t]
  );

  const DECISION_META = useMemo(
    (): Record<RiskDecision["decision"], { label: string; badge: string }> => ({
      PASS: { label: t("decisions.PASS"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      REVIEW: { label: t("decisions.REVIEW"), badge: "bg-amber-50 text-amber-700 border-amber-200" },
      BLOCK: { label: t("decisions.BLOCK"), badge: "bg-rose-50 text-rose-700 border-rose-200" },
    }),
    [t]
  );

  // ---- Rules tab state ----
  const [ruleStatus, setRuleStatus] = useState<"ALL" | RiskRuleStatus>("ALL");
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const rulePg = usePagination(10);
  useEffect(() => { rulePg.reset(); }, [ruleStatus, rulePg.reset]);

  // ---- Blacklist tab state ----
  const [blTypeFilter, setBlTypeFilter] = useState<"ALL" | BlacklistType>("ALL");
  const [blSearch, setBlSearch] = useState("");
  const [blFormOpen, setBlFormOpen] = useState(false);
  const [blForm, setBlForm] = useState(emptyBlForm);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchType, setBatchType] = useState<BlacklistType>("EMAIL");
  const [batchReason, setBatchReason] = useState("");
  const blPg = usePagination(10);
  useEffect(() => { blPg.reset(); }, [blTypeFilter, blSearch, blPg.reset]);

  // ---- Reviews tab state ----
  const reviewPg = usePagination(10);
  const [reviewRejectReason, setReviewRejectReason] = useState<Record<string, string>>({});

  // ---- Decisions tab state ----
  const decisionPg = usePagination(10);

  const loading = useViewLoading();

  const filteredRules = useMemo(
    () => ruleRows.filter((r) => ruleStatus === "ALL" || r.status === ruleStatus),
    [ruleRows, ruleStatus]
  );

  const filteredBL = useMemo(
    () =>
      blRows.filter((b) => {
        const matchType = blTypeFilter === "ALL" || b.type === blTypeFilter;
        const matchSearch =
          b.value.toLowerCase().includes(blSearch.toLowerCase()) ||
          b.reason.toLowerCase().includes(blSearch.toLowerCase());
        return matchType && matchSearch;
      }),
    [blRows, blTypeFilter, blSearch]
  );

  // ---- Rule CRUD ----
  const openRuleCreate = () => {
    setEditingRule(null);
    setRuleForm(emptyRuleForm);
    setRuleFormOpen(true);
  };

  const openRuleEdit = (r: RiskRule) => {
    setEditingRule(r);
    const cond = (r.condition || {}) as Record<string, unknown>;
    setRuleForm({
      name: r.name,
      ruleType: r.ruleType,
      action: r.action,
      scoreWeight: String(r.scoreWeight ?? 50),
      status: r.status,
      description: r.description ?? "",
      amountThreshold: String(cond.amountThreshold ?? "5000"),
      countries: String(cond.countries ?? ""),
      timeWindow: String(cond.timeWindow ?? "60"),
      maxCount: String(cond.maxCount ?? "10"),
      behaviorDesc: String(cond.behaviorDesc ?? ""),
    });
    setRuleFormOpen(true);
  };

  const buildCondition = (form: typeof emptyRuleForm): Record<string, unknown> => {
    const cond: Record<string, unknown> = {};
    if (form.ruleType === "AMOUNT") cond.amountThreshold = Number(form.amountThreshold);
    if (form.ruleType === "REGION") cond.countries = form.countries.split(",").map((s) => s.trim()).filter(Boolean);
    if (form.ruleType === "FREQUENCY") {
      cond.timeWindow = Number(form.timeWindow);
      cond.maxCount = Number(form.maxCount);
    }
    if (form.ruleType === "BEHAVIOR") cond.behaviorDesc = form.behaviorDesc;
    return cond;
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) return;
    const payload: Partial<RiskRule> = {
      name: ruleForm.name,
      ruleType: ruleForm.ruleType,
      action: ruleForm.action,
      scoreWeight: Number(ruleForm.scoreWeight),
      status: ruleForm.status,
      description: ruleForm.description,
      condition: buildCondition(ruleForm),
    };
    try {
      const saved = await riskApi.saveRiskRule(payload);
      if (editingRule) {
        setRuleRows((prev) => prev.map((r) => (r.id === editingRule.id ? saved : r)));
      } else {
        setRuleRows((prev) => [saved, ...prev]);
      }
      setRuleFormOpen(false);
    } catch (err) {
      console.error("save rule failed", err);
    }
  };

  const toggleRule = async (r: RiskRule) => {
    try {
      const updated = await riskApi.toggleRiskRule(r.id);
      setRuleRows((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch (err) {
      console.error("toggle rule failed", err);
    }
  };

  const removeRule = async (r: RiskRule) => {
    try {
      await riskApi.deleteRiskRule(r.id);
      setRuleRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      console.error("delete rule failed", err);
    }
  };

  // ---- Blacklist CRUD ----
  const openBlCreate = () => {
    setBlForm(emptyBlForm);
    setBlFormOpen(true);
  };

  const handleSaveBl = async () => {
    if (!blForm.value.trim()) return;
    try {
      const saved = await riskApi.saveBlacklistEntry({
        type: blForm.type,
        value: blForm.value,
        reason: blForm.reason || t("blacklistSheet.reason"),
        expiresAt: blForm.expiresAt,
      });
      setBlRows((prev) => [saved, ...prev]);
      setBlFormOpen(false);
    } catch (err) {
      console.error("add blacklist failed", err);
    }
  };

  const removeBL = async (b: BlacklistEntry) => {
    try {
      await riskApi.deleteBlacklistEntry(b.id);
      setBlRows((prev) => prev.filter((x) => x.id !== b.id));
    } catch (err) {
      console.error("delete blacklist failed", err);
    }
  };

  const handleBatchImport = async () => {
    const values = batchText.split("\n").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    try {
      const result = await riskApi.batchImportBlacklist(
        values.map((v) => ({ type: batchType, value: v, reason: batchReason || undefined }))
      );
      alert(t("toast.batchImported") + `: ${result.imported}, skipped: ${result.skipped}`);
      setBatchOpen(false);
      setBatchText("");
      void loadData();
    } catch (err) {
      console.error("batch import failed", err);
    }
  };

  // ---- Reviews ----
  const approveReview = async (id: string) => {
    try {
      await riskApi.approveRiskReview(id);
      setReviewRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("approve review failed", err);
    }
  };

  const rejectReview = async (id: string) => {
    const reason = reviewRejectReason[id]?.trim();
    if (!reason) return;
    try {
      await riskApi.rejectRiskReview(id, reason);
      setReviewRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("reject review failed", err);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-rose-100 text-rose-700";
    if (score >= 50) return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  if (loading) return <TableSkeleton rows={9} cols={6} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("subtitle")}</p>
        </div>
        {tab === "rules" && (
          <button onClick={openRuleCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> {t("addRule")}
          </button>
        )}
        {tab === "blacklist" && (
          <div className="flex gap-2">
            <button onClick={() => setBatchOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-line hover:bg-hover text-fg-secondary rounded-lg text-xs font-semibold transition-colors">
              <Upload className="w-4 h-4" /> {t("batchImport")}
            </button>
            <button onClick={openBlCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors">
              <PlusCircle className="w-4 h-4" /> {t("addBlacklist")}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-surface p-1.5 rounded-xl border border-line/80 shadow-card w-fit">
        {([
          ["rules", t("tabs.rules"), <Shield key="r" className="w-3.5 h-3.5" />],
          ["blacklist", t("tabs.blacklist"), <Ban key="b" className="w-3.5 h-3.5" />],
          ["reviews", t("tabs.reviews"), <ClipboardCheck key="rev" className="w-3.5 h-3.5" />],
          ["decisions", t("tabs.decisions"), <History key="d" className="w-3.5 h-3.5" />],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}>
            {icon}{label}
            {key === "reviews" && reviewRows.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">{reviewRows.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ============ Rules Tab ============ */}
      {tab === "rules" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex items-center gap-2 flex-wrap text-xs">
            <span className="text-fg-tertiary text-xs">{t("rulesTab.statusLabel")}</span>
            {(["ALL", "DRAFT", "OBSERVE", "ENABLED", "DISABLED"] as const).map((s) => (
              <button key={s} onClick={() => setRuleStatus(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${ruleStatus === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                {s === "ALL" ? t("rulesTab.all") : RULE_STATUS_BADGE[s].label}
              </button>
            ))}
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("rulesTab.table.name")}</th>
                    <th className="py-2 px-3">{t("rulesTab.table.ruleType")}</th>
                    <th className="py-2 px-3">{t("rulesTab.table.action")}</th>
                    <th className="py-2 px-3">{t("rulesTab.table.scoreWeight")}</th>
                    <th className="py-2 px-3">{t("rulesTab.table.status")}</th>
                    <th className="py-2 px-3">{t("rulesTab.table.updatedAt")}</th>
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
                          { key: "edit", label: t("rulesTab.menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openRuleEdit(r) },
                          { key: "toggle", label: r.status === "ENABLED" ? t("rulesTab.menu.disable") : t("rulesTab.menu.enable"), icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleRule(r) },
                          { key: "delete", label: t("rulesTab.menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 font-medium text-fg truncate max-w-[160px]" title={r.name}>{r.name}</td>
                            <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{TYPE_LABEL[r.ruleType]}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${am.badge}`}>{am.label}</span></td>
                            <td className="py-3 px-3 font-mono text-xs text-fg-secondary">{r.scoreWeight}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.label}</span></td>
                            <td className="py-3 px-3 font-mono text-[11px] text-fg-tertiary whitespace-nowrap">{r.updatedAt}</td>
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

      {/* ============ Blacklist Tab ============ */}
      {tab === "blacklist" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-fg-tertiary text-xs">{t("blacklistTab.typeLabel")}</span>
              {(["ALL", "EMAIL", "IP", "COUNTRY", "CARD_BIN", "DEVICE_FINGERPRINT"] as const).map((typeKey) => (
                <button key={typeKey} onClick={() => setBlTypeFilter(typeKey)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${blTypeFilter === typeKey ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {typeKey === "ALL" ? t("blacklistTab.all") : BL_TYPE_LABEL[typeKey]}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder={t("blacklistTab.searchPlaceholder")} value={blSearch} onChange={(e) => setBlSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">{t("blacklistTab.table.type")}</th>
                    <th className="py-2 px-3">{t("blacklistTab.table.value")}</th>
                    <th className="py-2 px-3">{t("blacklistTab.table.reason")}</th>
                    <th className="py-2 px-3">{t("blacklistTab.table.source")}</th>
                    <th className="py-2 px-3">{t("blacklistTab.table.expiresAt")}</th>
                    <th className="py-2 px-3">{t("blacklistTab.table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<BlacklistEntry>(filteredBL, blPg.currentPage, blPg.pageSize).map((b) => {
                    const sm = BL_STATUS_BADGE[b.status];
                    return (
                      <ContextMenu
                        key={b.id}
                        items={[
                          { key: "delete", label: t("blacklistTab.menu.remove"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeBL(b) },
                          { key: "refresh", label: t("blacklistTab.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => void loadData() },
                        ]}
                        trigger={
                          <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                            <td className="py-3 px-3 whitespace-nowrap"><span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary border border-line">{BL_TYPE_LABEL[b.type]}</span></td>
                            <td className="py-3 px-3 font-mono text-fg truncate max-w-[200px]" title={b.value}>{b.value}</td>
                            <td className="py-3 px-3 text-fg-secondary truncate max-w-[220px]" title={b.reason}>{b.reason}</td>
                            <td className="py-3 px-3 text-fg-tertiary whitespace-nowrap">{b.source || "-"}</td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary">{b.expiresAt || "-"}</td>
                            <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.label}</span></td>
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

      {/* ============ Reviews Tab ============ */}
      {tab === "reviews" && (
        <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2 px-3">{t("reviewTab.table.transactionId")}</th>
                  <th className="py-2 px-3">{t("reviewTab.table.riskScore")}</th>
                  <th className="py-2 px-3">{t("reviewTab.table.matchedRules")}</th>
                  <th className="py-2 px-3">{t("reviewTab.table.createdAt")}</th>
                  <th className="py-2 px-3">{t("reviewTab.table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginate<RiskReview>(reviewRows, reviewPg.currentPage, reviewPg.pageSize).map((r) => (
                  <tr key={r.id} className="hover:bg-subtle/80 transition-colors">
                    <td className="py-3 px-3 font-mono text-fg">{r.transactionId}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${scoreColor(r.riskScore)}`}>{r.riskScore}</span>
                    </td>
                    <td className="py-3 px-3 text-fg-secondary">{r.decisionId}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-fg-tertiary whitespace-nowrap">{r.createdAt}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Popconfirm
                          title={t("reviewTab.approve")}
                          description={`通过交易 ${r.transactionId}?`}
                          confirmText={t("reviewTab.approve")}
                          okClassName="bg-emerald-600 hover:bg-emerald-700"
                          onConfirm={() => approveReview(r.id)}
                        >
                          <button className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle2 className="w-3 h-3" /> {t("reviewTab.approve")}
                          </button>
                        </Popconfirm>
                        <button
                          onClick={() => rejectReview(r.id)}
                          disabled={!reviewRejectReason[r.id]?.trim()}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40"
                        >
                          <XCircle className="w-3 h-3" /> {t("reviewTab.reject")}
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder={t("reviewTab.rejectReasonPlaceholder")}
                        value={reviewRejectReason[r.id] || ""}
                        onChange={(e) => setReviewRejectReason((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="mt-1 w-full px-2 py-1 bg-subtle border border-line rounded text-[11px]"
                      />
                    </td>
                  </tr>
                ))}
                {reviewRows.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-fg-tertiary text-xs">{t("reviewTab.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={reviewPg.currentPage} totalItems={reviewRows.length} pageSize={reviewPg.pageSize} onPageChange={reviewPg.setCurrentPage} onPageSizeChange={reviewPg.setPageSize} />
        </div>
      )}

      {/* ============ Decisions Tab ============ */}
      {tab === "decisions" && (
        <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2 px-3">{t("decisionTab.table.transactionId")}</th>
                  <th className="py-2 px-3">{t("decisionTab.table.riskScore")}</th>
                  <th className="py-2 px-3">{t("decisionTab.table.decision")}</th>
                  <th className="py-2 px-3">{t("decisionTab.table.matchedRules")}</th>
                  <th className="py-2 px-3">{t("decisionTab.table.blacklistHits")}</th>
                  <th className="py-2 px-3">{t("decisionTab.table.evaluatedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginate<RiskDecision>(decisionRows, decisionPg.currentPage, decisionPg.pageSize).map((d) => {
                  const dm = DECISION_META[d.decision];
                  return (
                    <tr key={d.id} className="hover:bg-subtle/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-fg">{d.transactionId}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${scoreColor(d.riskScore)}`}>{d.riskScore}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${dm.badge}`}>{dm.label}</span></td>
                      <td className="py-3 px-3 text-fg-secondary text-[11px]">{d.matchedRules.join(", ") || "-"}</td>
                      <td className="py-3 px-3 text-fg-secondary text-[11px]">{d.blacklistHits.join(", ") || "-"}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-fg-tertiary whitespace-nowrap">{d.evaluatedAt}</td>
                    </tr>
                  );
                })}
                {decisionRows.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-fg-tertiary text-xs">{t("decisionTab.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={decisionPg.currentPage} totalItems={decisionRows.length} pageSize={decisionPg.pageSize} onPageChange={decisionPg.setCurrentPage} onPageSizeChange={decisionPg.setPageSize} />
        </div>
      )}

      {/* Rule Form SideSheet */}
      <SideSheet
        id="risk-rule-form"
        isOpen={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        title={editingRule ? t("ruleSheet.editTitle") : t("ruleSheet.createTitle")}
        description={t("ruleSheet.description")}
        icon={<Shield className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            {editingRule && (
              <Popconfirm title={t("ruleSheet.deleteTitle")} description={t("ruleSheet.deleteDescription", { name: editingRule.name })} confirmText={t("ruleSheet.deleteConfirm")} onConfirm={() => { removeRule(editingRule); setRuleFormOpen(false); }}>
                <button className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white mr-auto">{t("ruleSheet.deleteButton")}</button>
              </Popconfirm>
            )}
            <button onClick={() => setRuleFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveRule} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.name")}</label>
            <input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("ruleSheet.namePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.ruleType")}</label>
              <ShadcnSelect value={ruleForm.ruleType} onValueChange={(v) => setRuleForm((f) => ({ ...f, ruleType: v as RiskRuleType }))} options={(Object.keys(TYPE_LABEL) as RiskRuleType[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.action")}</label>
              <ShadcnSelect value={ruleForm.action} onValueChange={(v) => setRuleForm((f) => ({ ...f, action: v as RiskAction }))} options={(Object.keys(ACTION_META) as RiskAction[]).map((a) => ({ value: a, label: ACTION_META[a].label }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.scoreWeight")}</label>
              <input type="number" min={0} max={100} value={ruleForm.scoreWeight} onChange={(e) => setRuleForm((f) => ({ ...f, scoreWeight: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.status")}</label>
              <ShadcnSelect value={ruleForm.status} onValueChange={(v) => setRuleForm((f) => ({ ...f, status: v as RiskRuleStatus }))} options={(Object.keys(RULE_STATUS_BADGE) as RiskRuleStatus[]).map((s) => ({ value: s, label: RULE_STATUS_BADGE[s].label }))} />
            </div>
          </div>

          {ruleForm.ruleType === "AMOUNT" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.condition.amountThreshold")}</label>
              <input type="number" value={ruleForm.amountThreshold} onChange={(e) => setRuleForm((f) => ({ ...f, amountThreshold: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          )}
          {ruleForm.ruleType === "REGION" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.condition.countries")}</label>
              <input value={ruleForm.countries} onChange={(e) => setRuleForm((f) => ({ ...f, countries: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder="US, UK, JP" />
            </div>
          )}
          {ruleForm.ruleType === "FREQUENCY" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.condition.timeWindow")}</label>
                <input type="number" value={ruleForm.timeWindow} onChange={(e) => setRuleForm((f) => ({ ...f, timeWindow: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.condition.maxCount")}</label>
                <input type="number" value={ruleForm.maxCount} onChange={(e) => setRuleForm((f) => ({ ...f, maxCount: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
            </div>
          )}
          {ruleForm.ruleType === "BEHAVIOR" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.condition.behaviorDesc")}</label>
              <textarea value={ruleForm.behaviorDesc} onChange={(e) => setRuleForm((f) => ({ ...f, behaviorDesc: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
            </div>
          )}

          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("ruleSheet.description")}</label>
            <input value={ruleForm.description} onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("ruleSheet.descriptionPlaceholder")} />
          </div>
        </div>
      </SideSheet>

      {/* Blacklist Form SideSheet */}
      <SideSheet
        id="risk-bl-form"
        isOpen={blFormOpen}
        onClose={() => setBlFormOpen(false)}
        title={t("blacklistSheet.title")}
        description={t("blacklistSheet.description")}
        icon={<Ban className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setBlFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSaveBl} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("blacklistSheet.submit")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("blacklistSheet.type")}</label>
            <ShadcnSelect value={blForm.type} onValueChange={(v) => setBlForm((f) => ({ ...f, type: v as BlacklistType }))} options={(Object.keys(BL_TYPE_LABEL) as BlacklistType[]).map((k) => ({ value: k, label: BL_TYPE_LABEL[k] }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("blacklistSheet.value")}</label>
            <input value={blForm.value} onChange={(e) => setBlForm((f) => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={t("blacklistSheet.valuePlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("blacklistSheet.reason")}</label>
            <input value={blForm.reason} onChange={(e) => setBlForm((f) => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("blacklistSheet.reasonPlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("blacklistSheet.expiresAt")}</label>
            <input type="date" value={blForm.expiresAt} onChange={(e) => setBlForm((f) => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            <div className="text-[11px] text-fg-tertiary mt-1">{t("blacklistSheet.expiresHint")}</div>
          </div>
        </div>
      </SideSheet>

      {/* Batch Import SideSheet */}
      <SideSheet
        id="risk-batch"
        isOpen={batchOpen}
        onClose={() => setBatchOpen(false)}
        title={t("batchSheet.title")}
        description={t("batchSheet.description")}
        icon={<Upload className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setBatchOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleBatchImport} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("batchSheet.submit")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("batchSheet.type")}</label>
            <ShadcnSelect value={batchType} onValueChange={(v) => setBatchType(v as BlacklistType)} options={(Object.keys(BL_TYPE_LABEL) as BlacklistType[]).map((k) => ({ value: k, label: BL_TYPE_LABEL[k] }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("batchSheet.values")}</label>
            <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)} rows={8} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono resize-none" placeholder={t("batchSheet.valuesPlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("batchSheet.reason")}</label>
            <input value={batchReason} onChange={(e) => setBatchReason(e.target.value)} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
