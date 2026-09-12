import React, { useEffect, useMemo, useState } from "react";
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
  FileText,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { RiskRule, BlacklistEntry, RiskRuleType, RiskAction, BlacklistType } from "../types/payment";

interface RiskRulesViewProps {
  rules: RiskRule[];
  blacklist: BlacklistEntry[];
}

const TYPE_LABEL: Record<RiskRuleType, string> = {
  THREE_DS: "3DS 强制", FAILURE_RATE: "失败率阈值", ABNORMAL_AMOUNT: "异常金额", ABNORMAL_FREQ: "异常频次",
};
const ACTION_META: Record<RiskAction, { label: string; badge: string }> = {
  BLOCK: { label: "拦截", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  ALERT: { label: "告警", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  MANUAL_REVIEW: { label: "人工审核", badge: "bg-blue-50 text-blue-700 border-blue-200" },
};
const RULE_STATUS_BADGE: Record<RiskRule["status"], { label: string; badge: string; icon: React.ReactNode }> = {
  ENABLED: { label: "启用", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  DISABLED: { label: "停用", badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
};
const BL_TYPE_LABEL: Record<BlacklistType, string> = { CARD_BIN: "卡 BIN", IP: "IP 地址", EMAIL: "邮箱" };
const BL_STATUS_BADGE: Record<BlacklistEntry["status"], { label: string; badge: string; icon: React.ReactNode }> = {
  ACTIVE: { label: "生效", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  EXPIRED: { label: "已过期", badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
};

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

export const RiskRulesView: React.FC<RiskRulesViewProps> = ({ rules, blacklist }) => {
  const [tab, setTab] = useState<"rules" | "blacklist">("rules");

  // ---- 风控规则 ----
  const [ruleRows, setRuleRows] = useState<RiskRule[]>(rules);
  const [ruleStatus, setRuleStatus] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const rulePg = usePagination(10);
  useEffect(() => { rulePg.reset(); }, [ruleStatus, rulePg.reset]);

  // ---- 黑名单 ----
  const [blRows, setBlRows] = useState<BlacklistEntry[]>(blacklist);
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
    let condition = "";
    const params: Record<string, string | number> = {};
    if (ruleForm.type === "THREE_DS") { condition = `${ruleForm.region} 区域交易强制 3DS 验证`; params.region = ruleForm.region; }
    else if (ruleForm.type === "FAILURE_RATE") { condition = `${ruleForm.paramWindow} 分钟内失败率超过 ${ruleForm.paramPercent}%`; params.percent = Number(ruleForm.paramPercent); params.windowMin = Number(ruleForm.paramWindow); }
    else if (ruleForm.type === "ABNORMAL_AMOUNT") { condition = `单笔交易超过 ${ruleForm.paramAmount} USD`; params.singleLimit = Number(ruleForm.paramAmount); }
    else { condition = `每分钟超过 ${ruleForm.paramPerMin} 笔`; params.perMinute = Number(ruleForm.paramPerMin); }
    const payload = { name: ruleForm.name, type: ruleForm.type, action: ruleForm.action, condition, params, status: (ruleForm.status ? "ENABLED" : "DISABLED") as "ENABLED" | "DISABLED" };
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
      id: `bl_${Date.now().toString().slice(-6)}`, type: blForm.type, value: blForm.value, reason: blForm.reason || "手动添加",
      expiresAt: blForm.expiresAt || "永久", status: "ACTIVE", createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
    }, ...prev]);
    setBlFormOpen(false);
  };
  const removeBL = (b: BlacklistEntry) => setBlRows((prev) => prev.filter((x) => x.id !== b.id));

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
            <h1 className="text-xl font-bold text-fg tracking-tight">风控规则与黑名单</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            3DS 强制、失败率阈值、异常金额与频次规则，以及卡 BIN / IP / 邮箱黑名单管理。
          </p>
        </div>
        {tab === "rules" ? (
          <button onClick={openRuleCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> 新增规则
          </button>
        ) : (
          <button onClick={openBlCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
            <PlusCircle className="w-4 h-4" /> 加入黑名单
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-surface p-1.5 rounded-xl border border-line/80 shadow-card w-fit">
        {([["rules", "风控规则", <Shield key="r" className="w-3.5 h-3.5" />], ["blacklist", "黑名单管理", <Ban key="b" className="w-3.5 h-3.5" />]] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ============ 风控规则 Tab ==== */}
      {tab === "rules" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex items-center gap-2 flex-wrap text-xs">
            <span className="text-fg-tertiary text-xs">状态:</span>
            {(["ALL", "ENABLED", "DISABLED"] as const).map((s) => (
              <button key={s} onClick={() => setRuleStatus(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${ruleStatus === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                {s === "ALL" ? "全部" : RULE_STATUS_BADGE[s].label}
              </button>
            ))}
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">规则名称</th>
                    <th className="py-2 px-3">类型</th>
                    <th className="py-2 px-3">触发条件</th>
                    <th className="py-2 px-3">动作</th>
                    <th className="py-2 px-3">阈值参数</th>
                    <th className="py-2 px-3">状态</th>
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
                          { key: "edit", label: "编辑", icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openRuleEdit(r) },
                          { key: "toggle", label: r.status === "ENABLED" ? "停用" : "启用", icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleRule(r) },
                          { key: "delete", label: "删除", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                          { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRuleRows((prev) => [...prev]) },
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
            <Pagination currentPage={rulePg.currentPage} totalItems={filteredRules.length} pageSize={rulePg.pageSize} onPageChange={rulePg.setCurrentPage} />
          </div>
        </>
      )}

      {/* ============ 黑名单 Tab ============ */}
      {tab === "blacklist" && (
        <>
          <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-fg-tertiary text-xs">类型:</span>
              {(["ALL", "CARD_BIN", "IP", "EMAIL"] as const).map((t) => (
                <button key={t} onClick={() => setBlTypeFilter(t)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${blTypeFilter === t ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
                  {t === "ALL" ? "全部" : BL_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
              <input type="text" placeholder="搜索黑名单值 / 原因..." value={blSearch} onChange={(e) => setBlSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3">类型</th>
                    <th className="py-2 px-3">黑名单值</th>
                    <th className="py-2 px-3">原因</th>
                    <th className="py-2 px-3">有效期</th>
                    <th className="py-2 px-3">添加时间</th>
                    <th className="py-2 px-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {paginate<BlacklistEntry>(filteredBL, blPg.currentPage, blPg.pageSize).map((b) => {
                    const sm = BL_STATUS_BADGE[b.status];
                    return (
                      <ContextMenu
                        key={b.id}
                        items={[
                          { key: "delete", label: "移除黑名单", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeBL(b) },
                          { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setBlRows((prev) => [...prev]) },
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
            <Pagination currentPage={blPg.currentPage} totalItems={filteredBL.length} pageSize={blPg.pageSize} onPageChange={blPg.setCurrentPage} />
          </div>
        </>
      )}

      {/* 风控规则编辑 SideSheet */}
      <SideSheet
        id="risk-form"
        isOpen={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        title={editingRule ? "编辑风控规则" : "新增风控规则"}
        description="根据规则类型动态展示对应阈值参数"
        icon={<Shield className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            {editingRule && (
              <Popconfirm title="确认删除该风控规则？" description={`规则「${editingRule.name}」删除后不再生效。`} confirmText="确认删除" onConfirm={() => { removeRule(editingRule); setRuleFormOpen(false); }}>
                <button className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white mr-auto">删除规则</button>
              </Popconfirm>
            )}
            <button onClick={() => setRuleFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">取消</button>
            <button onClick={handleSaveRule} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">保存</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">规则名称</label>
            <input value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder="如：欧洲强 3DS 验证" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">规则类型</label>
              <ShadcnSelect value={ruleForm.type} onValueChange={(v) => setRuleForm((f) => ({ ...f, type: v as RiskRuleType }))} options={(Object.keys(TYPE_LABEL) as RiskRuleType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">动作</label>
              <ShadcnSelect value={ruleForm.action} onValueChange={(v) => setRuleForm((f) => ({ ...f, action: v as RiskAction }))} options={(Object.keys(ACTION_META) as RiskAction[]).map((a) => ({ value: a, label: ACTION_META[a].label }))} />
            </div>
          </div>

          {/* 动态参数 */}
          {ruleForm.type === "THREE_DS" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">适用区域</label>
              <ShadcnSelect value={ruleForm.region} onValueChange={(v) => setRuleForm((f) => ({ ...f, region: v }))} options={["EEA", "US", "APAC", "GLOBAL"].map((c) => ({ value: c, label: c }))} />
            </div>
          )}
          {ruleForm.type === "FAILURE_RATE" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">失败率阈值 (%)</label>
                <input type="number" value={ruleForm.paramPercent} onChange={(e) => setRuleForm((f) => ({ ...f, paramPercent: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">时间窗口 (分钟)</label>
                <input type="number" value={ruleForm.paramWindow} onChange={(e) => setRuleForm((f) => ({ ...f, paramWindow: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
              </div>
            </div>
          )}
          {ruleForm.type === "ABNORMAL_AMOUNT" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">单笔上限 (USD)</label>
              <input type="number" value={ruleForm.paramAmount} onChange={(e) => setRuleForm((f) => ({ ...f, paramAmount: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          )}
          {ruleForm.type === "ABNORMAL_FREQ" && (
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">每分钟最大笔数</label>
              <input type="number" value={ruleForm.paramPerMin} onChange={(e) => setRuleForm((f) => ({ ...f, paramPerMin: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          )}

          <label className="flex items-center gap-2 text-fg-secondary text-xs">
            <input type="checkbox" checked={ruleForm.status} onChange={(e) => setRuleForm((f) => ({ ...f, status: e.target.checked }))} className="w-4 h-4 accent-primary" />
            启用该规则
          </label>
        </div>
      </SideSheet>

      {/* 黑名单新增 SideSheet */}
      <SideSheet
        id="bl-form"
        isOpen={blFormOpen}
        onClose={() => setBlFormOpen(false)}
        title="加入黑名单"
        description="添加卡 BIN / IP / 邮箱黑名单，命中后交易将被拦截"
        icon={<Ban className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setBlFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">取消</button>
            <button onClick={handleSaveBl} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">添加</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">类型</label>
            <ShadcnSelect value={blForm.type} onValueChange={(v) => setBlForm((f) => ({ ...f, type: v as BlacklistType }))} options={(Object.keys(BL_TYPE_LABEL) as BlacklistType[]).map((t) => ({ value: t, label: BL_TYPE_LABEL[t] }))} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">黑名单值</label>
            <input value={blForm.value} onChange={(e) => setBlForm((f) => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={blForm.type === "CARD_BIN" ? "如 40000027" : blForm.type === "IP" ? "如 185.220.101.45" : "如 bad@tempmail.io"} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">原因</label>
            <input value={blForm.reason} onChange={(e) => setBlForm((f) => ({ ...f, reason: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder="拉黑原因说明" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">有效期</label>
            <input type="date" value={blForm.expiresAt} onChange={(e) => setBlForm((f) => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            <div className="text-[11px] text-fg-tertiary mt-1">留空表示永久拉黑</div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-fg-tertiary bg-subtle p-2 rounded-lg border border-line">
            <EyeOff className="w-3.5 h-3.5" /> 黑名单命中后将在收银台直接拦截交易
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
