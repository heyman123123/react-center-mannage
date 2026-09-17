import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as feeRulesApi from "../api/modules/feeRules";
import { useTranslation } from "react-i18next";
import {
  SlidersHorizontal,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Calculator,
  Zap,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { FeeRule, PaymentChannel, MerchantTier } from "../types/payment";
import { loadPaymentChannelOptions, type PaymentChannelOption } from "../lib/paymentChannels";

const emptyForm = {
  name: "",
  channels: [] as PaymentChannel[],
  currency: "USD",
  minAmount: "",
  maxAmount: "",
  merchantTier: "ALL" as MerchantTier,
  fixedFee: "",
  percentFee: "",
  priority: "10",
  status: true,
};

export const FeeRulesView: React.FC = () => {
  const { t } = useTranslation(["commerce", "common"]);
  const [rows, setRows] = useState<FeeRule[]>([]);

  const loadRules = useCallback(async () => {
    try {
      const list = await feeRulesApi.listFeeRules();
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeRule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [statusFilter, searchQuery, reset]);

  const TIER_LABEL = useMemo(
    (): Record<MerchantTier, string> => ({
      ALL: t("feeRules.tier.ALL"),
      NORMAL: t("feeRules.tier.NORMAL"),
      VIP: t("feeRules.tier.VIP"),
      STRATEGIC: t("feeRules.tier.STRATEGIC"),
    }),
    [t]
  );

  const STATUS_BADGE = useMemo(
    (): Record<FeeRule["status"], { label: string; badge: string; icon: React.ReactNode }> => ({
      ENABLED: { label: t("commerce:common.enabled"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      DISABLED: { label: t("commerce:common.disabled"), badge: "bg-hover text-fg-secondary border-line", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  const [channelOptions, setChannelOptions] = useState<PaymentChannelOption[]>([]);
  const [calcChannel, setCalcChannel] = useState<string>("");
  const [calcCurrency, setCalcCurrency] = useState<string>("USD");
  const [calcAmount, setCalcAmount] = useState<string>("100");
  const [calcTier, setCalcTier] = useState<string>("NORMAL");
  const [calcResult, setCalcResult] = useState<{ rule: FeeRule; fee: number; percent: number; fixed: number; net: number } | null>(null);

  useEffect(() => {
    void loadPaymentChannelOptions().then((opts) => {
      setChannelOptions(opts);
      if (opts.length > 0) {
        setCalcChannel((prev) => prev || opts[0].value);
      }
    });
  }, []);

  const channelLabel = useCallback(
    (code: string) => channelOptions.find((o) => o.value === code)?.label || code,
    [channelOptions]
  );

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
        const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.currency.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStatus && matchSearch;
      })
      .sort((a, b) => a.priority - b.priority);
  }, [rows, statusFilter, searchQuery]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (r: FeeRule) => {
    setEditing(r);
    setForm({
      name: r.name, channels: r.channels, currency: r.currency,
      minAmount: String(r.minAmount), maxAmount: r.maxAmount === 999999 ? "" : String(r.maxAmount),
      merchantTier: r.merchantTier, fixedFee: String(r.fixedFee), percentFee: String(r.percentFee),
      priority: String(r.priority), status: r.status === "ENABLED",
    });
    setFormOpen(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name, channels: form.channels, currency: form.currency,
      minAmount: Number(form.minAmount) || 0, maxAmount: form.maxAmount === "" ? 999999 : Number(form.maxAmount),
      merchantTier: form.merchantTier, fixedFee: Number(form.fixedFee) || 0, percentFee: Number(form.percentFee) || 0,
      priority: Number(form.priority) || 10, status: (form.status ? "ENABLED" : "DISABLED") as "ENABLED" | "DISABLED",
    };
    if (editing) {
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)));
    } else {
      setRows((prev) => [{ id: `fee_${Date.now().toString().slice(-6)}`, ...payload, createdAt: new Date().toISOString().replace("T", " ").substring(0, 16) }, ...prev]);
    }
    setFormOpen(false);
  };
  const toggleStatus = (r: FeeRule) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: x.status === "ENABLED" ? "DISABLED" : "ENABLED" } : x)));
  const removeRule = (r: FeeRule) => setRows((prev) => prev.filter((x) => x.id !== r.id));

  const runCalc = () => {
    const amount = Number(calcAmount);
    if (!amount || amount <= 0) { setCalcResult(null); return; }
    const matched = rows
      .filter((r) => r.status === "ENABLED")
      .filter((r) => r.channels.includes(calcChannel as PaymentChannel))
      .filter((r) => r.currency === calcCurrency)
      .filter((r) => amount >= r.minAmount && amount <= r.maxAmount)
      .filter((r) => r.merchantTier === "ALL" || r.merchantTier === calcTier)
      .sort((a, b) => a.priority - b.priority)[0];
    if (!matched) { setCalcResult(null); return; }
    const fixed = matched.fixedFee;
    const percent = amount * (matched.percentFee / 100);
    const fee = Number((fixed + percent).toFixed(2));
    setCalcResult({ rule: matched, fee, percent: Number(percent.toFixed(2)), fixed, net: Number((amount - fee).toFixed(2)) });
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={9} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("feeRules.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("feeRules.subtitle")}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto">
          <PlusCircle className="w-4 h-4" /> {t("feeRules.addRule")}
        </button>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg mb-2">
          <Calculator className="w-3.5 h-3.5 text-fg-tertiary" /> {t("feeRules.calculator")}
        </div>
        <div className="flex flex-col md:flex-row md:items-end gap-2 flex-wrap">
          <div className="w-full md:w-32"><label className="block text-[11px] text-fg-tertiary mb-1">{t("feeRules.calcChannel")}</label>
            <ShadcnSelect value={calcChannel} onValueChange={setCalcChannel} options={channelOptions.map((c) => ({ value: c.value, label: c.label }))} />
          </div>
          <div className="w-full md:w-28"><label className="block text-[11px] text-fg-tertiary mb-1">{t("feeRules.calcCurrency")}</label>
            <ShadcnSelect value={calcCurrency} onValueChange={setCalcCurrency} options={["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "HKD", "SGD"].map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="w-full md:w-28"><label className="block text-[11px] text-fg-tertiary mb-1">{t("feeRules.calcAmount")}</label>
            <input type="number" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
          </div>
          <div className="w-full md:w-32"><label className="block text-[11px] text-fg-tertiary mb-1">{t("feeRules.calcTier")}</label>
            <ShadcnSelect value={calcTier} onValueChange={setCalcTier} options={(["ALL", "NORMAL", "VIP", "STRATEGIC"] as MerchantTier[]).map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))} />
          </div>
          <button onClick={runCalc} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors">
            <Zap className="w-3.5 h-3.5" /> {t("feeRules.calculate")}
          </button>
        </div>
        {calcResult && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <div className="font-semibold text-emerald-800 mb-1.5">{t("feeRules.matchedRule", { name: calcResult.rule.name, priority: calcResult.rule.priority })}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-fg-secondary">
              <div>{t("feeRules.fixedFee")} <span className="font-mono font-semibold text-fg float-right">{calcResult.fixed.toFixed(2)}</span></div>
              <div>{t("feeRules.percentFee")} <span className="font-mono font-semibold text-fg float-right">{calcResult.percent.toFixed(2)}</span></div>
              <div>{t("feeRules.totalFee")} <span className="font-mono font-semibold text-rose-600 float-right">{calcResult.fee.toFixed(2)}</span></div>
              <div>{t("feeRules.netAmount")} <span className="font-mono font-semibold text-emerald-700 float-right">{calcResult.net.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("commerce:common.statusLabel")}</span>
          {(["ALL", "ENABLED", "DISABLED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
              {s === "ALL" ? t("commerce:common.all") : STATUS_BADGE[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input type="text" placeholder={t("feeRules.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("feeRules.table.name")}</th>
                <th className="py-2 px-3">{t("feeRules.table.channels")}</th>
                <th className="py-2 px-3">{t("feeRules.table.currency")}</th>
                <th className="py-2 px-3">{t("feeRules.table.amountRange")}</th>
                <th className="py-2 px-3">{t("feeRules.table.tier")}</th>
                <th className="py-2 px-3 text-right">{t("feeRules.table.fixed")}</th>
                <th className="py-2 px-3 text-right">{t("feeRules.table.percent")}</th>
                <th className="py-2 px-3 text-center">{t("feeRules.table.priority")}</th>
                <th className="py-2 px-3">{t("feeRules.table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<FeeRule>(filtered, currentPage, pageSize).map((r) => {
                const sm = STATUS_BADGE[r.status];
                return (
                  <ContextMenu
                    key={r.id}
                    items={[
                      { key: "edit", label: t("feeRules.menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEdit(r) },
                      { key: "toggle", label: r.status === "ENABLED" ? t("feeRules.menu.disable") : t("feeRules.menu.enable"), icon: <RefreshCw className="w-3.5 h-3.5" />, danger: r.status === "ENABLED", onClick: () => toggleStatus(r) },
                      { key: "delete", label: t("feeRules.menu.delete"), icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => removeRule(r) },
                      { key: "refresh", label: t("feeRules.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRows((prev) => [...prev]) },
                    ]}
                    trigger={
                      <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3 font-medium text-fg truncate max-w-[180px]" title={r.name}>{r.name}</td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {r.channels.slice(0, 3).map((c) => <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-hover text-fg-secondary font-mono">{channelLabel(c)}</span>)}
                            {r.channels.length > 3 && <span className="text-[10px] text-fg-tertiary">+{r.channels.length - 3}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-fg-secondary">{r.currency}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary">{r.minAmount} ~ {r.maxAmount >= 999999 ? "∞" : r.maxAmount}</td>
                        <td className="py-3 px-3 text-fg-secondary">{TIER_LABEL[r.merchantTier]}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg">{r.fixedFee.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg-secondary">{r.percentFee}%</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700">{r.priority}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span>
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
        id="fee-form"
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("feeRules.form.editTitle") : t("feeRules.form.createTitle")}
        description={t("feeRules.form.description")}
        icon={<SlidersHorizontal className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={
          <>
            {editing && (
              <Popconfirm title={t("feeRules.form.deleteConfirm")} description={t("feeRules.form.deleteDesc", { name: editing.name })} confirmText={t("common:actions.confirm")} onConfirm={() => { removeRule(editing); setFormOpen(false); }}>
                <button className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white mr-auto">{t("feeRules.form.deleteRule")}</button>
              </Popconfirm>
            )}
            <button onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSave} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.name")}</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs" placeholder={t("feeRules.form.namePlaceholder")} />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.channels")}</label>
            <div className="flex flex-wrap gap-1.5">
              {channelOptions.map((c) => {
                const code = c.value as PaymentChannel;
                const on = form.channels.includes(code);
                return (
                  <button key={c.value} type="button" onClick={() => setForm((f) => ({ ...f, channels: on ? f.channels.filter((x) => x !== code) : [...f.channels, code] }))}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-subtle text-fg-secondary border-line hover:bg-hover"}`}>
                    {c.label || c.value}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.currency")}</label>
              <ShadcnSelect value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))} options={["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "HKD", "SGD"].map((c) => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.tier")}</label>
              <ShadcnSelect value={form.merchantTier} onValueChange={(v) => setForm((f) => ({ ...f, merchantTier: v as MerchantTier }))} options={(["ALL", "NORMAL", "VIP", "STRATEGIC"] as MerchantTier[]).map((tier) => ({ value: tier, label: TIER_LABEL[tier] }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.minAmount")}</label>
              <input type="number" value={form.minAmount} onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.maxAmount")}</label>
              <input type="number" value={form.maxAmount} onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.fixedFee")}</label>
              <input type="number" step="0.01" value={form.fixedFee} onChange={(e) => setForm((f) => ({ ...f, fixedFee: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.percentFee")}</label>
              <input type="number" step="0.1" value={form.percentFee} onChange={(e) => setForm((f) => ({ ...f, percentFee: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" placeholder={t("feeRules.form.percentPlaceholder")} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("feeRules.form.priority")}</label>
              <input type="number" min="1" max="99" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-fg-secondary text-xs">
            <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} className="w-4 h-4 accent-primary" />
            {t("feeRules.form.enable")}
          </label>
        </div>
      </SideSheet>
    </div>
  );
};
