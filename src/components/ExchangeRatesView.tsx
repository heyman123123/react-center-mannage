import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as exchangeRatesApi from "../api/modules/exchangeRates";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  Eye,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { ContextMenu } from "./ui/ContextMenu";
import { ExchangeRate, DictionaryEntry } from "../types/payment";


const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "HKD", "SGD", "CNY"];

const emptyForm = {
  baseCurrency: "USD",
  targetCurrency: "EUR",
  bid: "",
  ask: "",
  effectiveFrom: "",
  remark: "",
};

export const ExchangeRatesView: React.FC = () => {
  const { t } = useTranslation(["system", "common"]);
  const [rows, setRows] = useState<ExchangeRate[]>([]);
  const [dictionary] = useState<DictionaryEntry[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [pairSearch, setPairSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");
  const [detailRate, setDetailRate] = useState<ExchangeRate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExchangeRate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);

  const loadRates = useCallback(async () => {
    try {
      const list = await exchangeRatesApi.listExchangeRates();
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (!detailRate) {
      setHistory([]);
      return;
    }
    void exchangeRatesApi.getExchangeRateHistory(detailRate.id).then((points) => {
      setHistory(points.map((p) => p.rate));
    }).catch(() => setHistory([]));
  }, [detailRate?.id]);

  useEffect(() => { reset(); }, [pairSearch, statusFilter, reset]);

  const STATUS_BADGE = useMemo(
    (): Record<ExchangeRate["status"], { label: string; badge: string; icon: React.ReactNode }> => ({
      ENABLED: {
        label: t("system:exchangeRates.status.enabled"),
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      DISABLED: {
        label: t("system:exchangeRates.status.disabled"),
        badge: "bg-hover text-fg-secondary border-line",
        icon: <XCircle className="w-3 h-3" />,
      },
    }),
    [t]
  );

  // 从字典读取结算货币配置（category=CURRENCY），无则默认 USD
  const settleCurrency = useMemo(() => {
    const entry = dictionary.find((d) => d.category === "CURRENCY");
    return entry?.key?.replace(/^currency_/i, "").toUpperCase() || "USD";
  }, [dictionary]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const pair = `${r.baseCurrency}${r.targetCurrency}`.toLowerCase();
      const matchSearch = pair.includes(pairSearch.toLowerCase()) ||
        `${r.baseCurrency}/${r.targetCurrency}`.toLowerCase().includes(pairSearch.toLowerCase());
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, pairSearch, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (r: ExchangeRate) => {
    setEditing(r);
    setForm({
      baseCurrency: r.baseCurrency,
      targetCurrency: r.targetCurrency,
      bid: String(r.bid),
      ask: String(r.ask),
      effectiveFrom: r.effectiveFrom,
      remark: r.remark || "",
    });
    setFormOpen(true);
  };
  const handleSave = () => {
    const bid = Number(form.bid);
    const ask = Number(form.ask);
    if (!form.baseCurrency || !form.targetCurrency || isNaN(bid) || isNaN(ask)) return;
    if (editing) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, baseCurrency: form.baseCurrency, targetCurrency: form.targetCurrency, bid, ask, effectiveFrom: form.effectiveFrom || r.effectiveFrom, remark: form.remark || undefined }
            : r
        )
      );
    } else {
      const newRow: ExchangeRate = {
        id: `fx_${Date.now().toString().slice(-6)}`,
        baseCurrency: form.baseCurrency,
        targetCurrency: form.targetCurrency,
        bid,
        ask,
        effectiveFrom: form.effectiveFrom || new Date().toISOString().replace("T", " ").substring(0, 16),
        status: "ENABLED",
        remark: form.remark || undefined,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      };
      setRows((prev) => [newRow, ...prev]);
    }
    setFormOpen(false);
  };
  const toggleStatus = (r: ExchangeRate) => {
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: x.status === "ENABLED" ? "DISABLED" : "ENABLED" } : x))
    );
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={8} />;

  const hMin = history.length ? Math.min(...history) : 0;
  const hMax = history.length ? Math.max(...history) : 1;
  const W = 520, H = 180, PAD = 8;
  const points = history.map((v, i) => {
    const x = PAD + (i / Math.max(history.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - hMin) / (hMax - hMin || 1)) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Globe className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("system:exchangeRates.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("system:exchangeRates.subtitle")}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          {t("system:exchangeRates.addRate")}
        </button>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex items-center gap-2 text-xs flex-wrap">
        <Star className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-fg-secondary">{t("system:exchangeRates.settleCurrency")}</span>
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-primary-foreground">{settleCurrency}</span>
        <span className="text-fg-tertiary">{t("system:exchangeRates.settleCurrencyHint")}</span>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("system:exchangeRates.statusLabel")}</span>
          {(["ALL", "ENABLED", "DISABLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {s === "ALL" ? t("common:labels.all") : STATUS_BADGE[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder={t("system:exchangeRates.searchPlaceholder")}
            value={pairSearch}
            onChange={(e) => setPairSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("system:exchangeRates.table.pair")}</th>
                <th className="py-2 px-3 text-right">{t("system:exchangeRates.table.bid")}</th>
                <th className="py-2 px-3 text-right">{t("system:exchangeRates.table.ask")}</th>
                <th className="py-2 px-3 text-right">{t("system:exchangeRates.table.mid")}</th>
                <th className="py-2 px-3">{t("system:exchangeRates.table.effectiveFrom")}</th>
                <th className="py-2 px-3">{t("system:exchangeRates.table.status")}</th>
                <th className="py-2 px-3">{t("system:exchangeRates.table.remark")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<ExchangeRate>(filtered, currentPage, pageSize).map((r) => {
                const sm = STATUS_BADGE[r.status];
                const mid = ((r.bid + r.ask) / 2).toFixed(4);
                return (
                  <ContextMenu
                    key={r.id}
                    items={[
                      { key: "edit", label: t("system:exchangeRates.menu.edit"), icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openEdit(r) },
                      { key: "view", label: t("system:exchangeRates.menu.viewTrend"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setDetailRate(r) },
                      {
                        key: "toggle",
                        label: r.status === "ENABLED" ? t("system:exchangeRates.menu.disable") : t("system:exchangeRates.menu.enable"),
                        icon: <RefreshCw className="w-3.5 h-3.5" />,
                        danger: r.status === "ENABLED",
                        onClick: () => toggleStatus(r),
                      },
                      { key: "refresh", label: t("system:exchangeRates.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRows((prev) => [...prev]) },
                    ]}
                    trigger={
                      <tr className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3">
                          <div className="font-mono font-semibold text-fg">{r.baseCurrency} <span className="text-fg-tertiary">/</span> {r.targetCurrency}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-fg">{r.bid.toFixed(4)}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg-secondary">{r.ask.toFixed(4)}</td>
                        <td className="py-3 px-3 text-right font-mono text-fg-secondary">{mid}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary">{r.effectiveFrom}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span>
                        </td>
                        <td className="py-3 px-3 text-fg-secondary truncate max-w-[160px]" title={r.remark}>{r.remark || "-"}</td>
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
        id="fx-detail"
        isOpen={!!detailRate}
        onClose={() => setDetailRate(null)}
        title={detailRate ? t("system:exchangeRates.detail.title", { base: detailRate.baseCurrency, target: detailRate.targetCurrency }) : t("system:exchangeRates.detail.titleFallback")}
        description={detailRate ? t("system:exchangeRates.detail.description", { bid: detailRate.bid, ask: detailRate.ask }) : ""}
        icon={<TrendingUp className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={<button onClick={() => setDetailRate(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:actions.close")}</button>}
      >
        {detailRate && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("system:exchangeRates.detail.bid")}</div>
                <div className="font-mono font-semibold text-fg mt-1">{detailRate.bid.toFixed(4)}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("system:exchangeRates.detail.ask")}</div>
                <div className="font-mono font-semibold text-fg mt-1">{detailRate.ask.toFixed(4)}</div>
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line">
                <div className="text-[11px] text-fg-tertiary">{t("system:exchangeRates.detail.range")}</div>
                <div className="font-mono font-semibold text-fg mt-1">{hMin.toFixed(4)} / {hMax.toFixed(4)}</div>
              </div>
            </div>

            <div className="border border-line rounded-xl p-3">
              <div className="font-semibold text-fg mb-2">{t("system:exchangeRates.detail.chartTitle")}</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
                <polyline
                  fill="none"
                  stroke="var(--color-primary, #3b82f6)"
                  strokeWidth="2"
                  points={points}
                />
                {history.map((v, i) => {
                  const x = PAD + (i / Math.max(history.length - 1, 1)) * (W - PAD * 2);
                  const y = H - PAD - ((v - hMin) / (hMax - hMin || 1)) * (H - PAD * 2);
                  if (i % 5 !== 0) return null;
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--color-primary, #3b82f6)" />;
                })}
              </svg>
              <div className="flex justify-between text-[11px] text-fg-tertiary font-mono mt-1">
                <span>{t("system:exchangeRates.detail.day30")}</span><span>{t("system:exchangeRates.detail.day15")}</span><span>{t("system:exchangeRates.detail.today")}</span>
              </div>
            </div>

            <div className="bg-subtle p-3 rounded-xl border border-line">
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("system:exchangeRates.detail.effectiveFrom")}</span><span className="font-mono">{detailRate.effectiveFrom}</span></div>
              <div className="flex justify-between mt-1.5"><span className="text-fg-tertiary">{t("system:exchangeRates.detail.updatedAt")}</span><span className="font-mono">{detailRate.updatedAt}</span></div>
              {detailRate.remark && <div className="flex justify-between mt-1.5"><span className="text-fg-tertiary">{t("system:exchangeRates.detail.remark")}</span><span>{detailRate.remark}</span></div>}
            </div>
          </div>
        )}
      </SideSheet>

      <SideSheet
        id="fx-form"
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("system:exchangeRates.form.editTitle") : t("system:exchangeRates.form.createTitle")}
        description={t("system:exchangeRates.form.description")}
        icon={<Globe className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl max-md:max-w-none"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover cursor-pointer">{t("common:actions.cancel")}</button>
            <button onClick={handleSave} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-card transition-colors cursor-pointer">{t("common:actions.save")}</button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.baseCurrency")}</label>
              <ShadcnSelect value={form.baseCurrency} onValueChange={(v) => setForm((f) => ({ ...f, baseCurrency: v }))} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.targetCurrency")}</label>
              <ShadcnSelect value={form.targetCurrency} onValueChange={(v) => setForm((f) => ({ ...f, targetCurrency: v }))} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.bid")}</label>
              <input type="number" step="0.0001" value={form.bid} onChange={(e) => setForm((f) => ({ ...f, bid: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
            <div>
              <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.ask")}</label>
              <input type="number" step="0.0001" value={form.ask} onChange={(e) => setForm((f) => ({ ...f, ask: e.target.value }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.effectiveFrom")}</label>
            <input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value.replace("T", " ") }))} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label className="block text-fg-secondary mb-1.5 font-medium">{t("system:exchangeRates.form.remark")}</label>
            <textarea value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" placeholder={t("system:exchangeRates.form.remarkPlaceholder")} />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
