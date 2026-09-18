import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as productsApi from "../api/modules/products";
import * as channelsApi from "../api/modules/channels";
import { useViewLoading } from "./ui/useViewLoading";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { TableSkeleton } from "./ui/Skeletons";
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Archive,
  RotateCcw,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Globe,
  Coins,
  ArrowRightLeft,
  Sparkles,
  Layers,
} from "lucide-react";
import { ProductConfig, ProductType, Tenant, PaymentChannelConfig, SystemUser } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { MultiSelect } from "./ui/MultiSelect";

interface ProductsViewProps {
  currentTenant: Tenant;
  currentUser?: SystemUser;
}

const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", labelKey: "USD" },
  { code: "EUR", symbol: "€", flag: "🇪🇺", labelKey: "EUR" },
  { code: "JPY", symbol: "¥", flag: "🇯🇵", labelKey: "JPY" },
  { code: "GBP", symbol: "£", flag: "🇬🇧", labelKey: "GBP" },
  { code: "CAD", symbol: "C$", flag: "🇨🇦", labelKey: "CAD" },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", labelKey: "AUD" },
];

export const ProductsView: React.FC<ProductsViewProps> = ({
  currentTenant,
}) => {
  const { t } = useTranslation(["products", "common"]);
  const [productList, setProductList] = useState<ProductConfig[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelConfig[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterChannelId, setFilterChannelId] = useState("");
  const [syncChannelId, setSyncChannelId] = useState("");
  const [copyTargetChannelId, setCopyTargetChannelId] = useState("");
  const [copySheetOpen, setCopySheetOpen] = useState(false);
  const [isSyncingFromCreem, setIsSyncingFromCreem] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const creemChannels = paymentChannels.filter((c) => c.channelKey === "creem");
  const channelOptions = creemChannels.map((c) => ({
    value: c.id,
    label: `${c.name}${c.accountName ? ` · ${c.accountName}` : ""}`,
  }));

  const loadProducts = useCallback(async () => {
    try {
      const list = await productsApi.listProducts({
        tenantId: currentTenant.id === "group_hq" ? undefined : currentTenant.id,
        channelId: filterChannelId || undefined,
      });
      setProductList(list);
    } catch {
      showToast(t("products.toast.loadFailed"));
    }
  }, [currentTenant.id, filterChannelId, t]);

  const loadChannels = useCallback(async () => {
    try {
      const list = await channelsApi.listPaymentChannels();
      setPaymentChannels(list);
    } catch {
      setPaymentChannels([]);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadChannels();
  }, [loadProducts, loadChannels]);

  useEffect(() => {
    if (!syncChannelId && creemChannels.length > 0) {
      setSyncChannelId(creemChannels[0].id);
    }
  }, [creemChannels, syncChannelId]);

  const handleCopyToChannel = async () => {
    const sourceChannelId = filterChannelId || syncChannelId;
    if (!sourceChannelId || !copyTargetChannelId) {
      showToast(t("products.copyChannel.selectBoth"));
      return;
    }
    setIsCopying(true);
    try {
      const result = await productsApi.copyProductsToChannel(sourceChannelId, copyTargetChannelId);
      await loadProducts();
      setCopySheetOpen(false);
      showToast(
        t("products.toast.copyToChannelSuccess", {
          total: result.total,
          created: result.created,
          skipped: result.skipped,
        })
      );
    } catch {
      showToast(t("products.toast.copyToChannelFailed"));
    } finally {
      setIsCopying(false);
    }
  };

  const handleSyncFromCreem = async () => {
    if (!syncChannelId) {
      showToast(t("products.selectChannelToSync"));
      return;
    }
    setIsSyncingFromCreem(true);
    try {
      const result = await productsApi.syncFromCreem(syncChannelId);
      await loadProducts();
      showToast(
        t("products.toast.syncFromCreemSuccess", {
          total: result.total,
          created: result.created,
          updated: result.updated,
        })
      );
    } catch {
      showToast(t("products.toast.syncFromCreemFailed"));
    } finally {
      setIsSyncingFromCreem(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [searchQuery, typeFilter, statusFilter, currencyFilter, reset]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductConfig | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State - dedicated to ONE currency per product code
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formPrice, setFormPrice] = useState<number>(29.0);
  const [formType, setFormType] = useState<ProductType>("SUBSCRIPTION");
  const [formInterval, setFormInterval] = useState<"MONTHLY" | "YEARLY" | "ONE_TIME" | "LIFETIME">("MONTHLY");
  const [formDescription, setFormDescription] = useState("");
  const [formFeatures, setFormFeatures] = useState("");
  const [formTrialDays, setFormTrialDays] = useState<number>(14);
  const [formStripePriceId, setFormStripePriceId] = useState("");
  const [formPaypalPlanId, setFormPaypalPlanId] = useState("");
  const [formBoundChannels, setFormBoundChannels] = useState<string[]>([]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFormCode(`PROD-PLAN-USD-${randomSuffix}`);
    setFormName("");
    setFormCurrency("USD");
    setFormPrice(29.0);
    setFormType("SUBSCRIPTION");
    setFormInterval("MONTHLY");
    setFormDescription("");
    setFormFeatures("无限量云端计算资源\n全球 128k 上下文大模型调用\n企业级多租户数据隔离安全合规");
    setFormTrialDays(14);
    setFormStripePriceId(`price_stripe_live_${Date.now().toString().slice(-6)}`);
    setFormPaypalPlanId("");
    setFormBoundChannels([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ProductConfig) => {
    setEditingProduct(p);
    setFormCode(p.code);
    setFormName(p.name);
    setFormCurrency(p.currency || "USD");
    setFormPrice(p.price || (p.prices && (p.prices as any)[p.currency || "USD"]) || 0);
    setFormType(p.type);
    setFormInterval(p.billingInterval);
    setFormDescription(p.description);
    setFormFeatures(p.features?.join("\n") || "");
    setFormTrialDays(p.trialDays || 0);
    setFormStripePriceId(p.stripePriceId || "");
    setFormPaypalPlanId(p.paypalPlanId || "");
    setFormBoundChannels(p.boundChannelIds || []);
    setIsModalOpen(true);
  };

  // Quick clone to another currency with a dedicated new code
  const handleCloneToNewCurrency = (p: ProductConfig, targetCurr: string) => {
    setEditingProduct(null);
    const baseCode = p.code.replace(new RegExp(`-${p.currency || "USD"}.*$`, "i"), "");
    const intervalCode = p.billingInterval === "MONTHLY" ? "M" : p.billingInterval === "YEARLY" ? "Y" : "ONE";
    setFormCode(`${baseCode}-${targetCurr}-${intervalCode}`);
    setFormName(`${p.name.replace(/\([A-Z]{3}\)/i, "").trim()} (${targetCurr})`);
    setFormCurrency(targetCurr);
    // Estimate exchange rate ratio for pre-filling
    let estimatedPrice = p.price;
    if (targetCurr === "EUR") estimatedPrice = Math.round(p.price * 0.92);
    else if (targetCurr === "JPY") estimatedPrice = Math.round(p.price * 150);
    else if (targetCurr === "GBP") estimatedPrice = Math.round(p.price * 0.79);
    else if (targetCurr === "CAD" || targetCurr === "AUD") estimatedPrice = Math.round(p.price * 1.35);

    setFormPrice(estimatedPrice);
    setFormType(p.type);
    setFormInterval(p.billingInterval);
    setFormDescription(p.description);
    setFormFeatures(p.features.join("\n"));
    setFormTrialDays(p.trialDays || 0);
    setFormStripePriceId(`price_stripe_${targetCurr.toLowerCase()}_${Date.now().toString().slice(-4)}`);
    setFormPaypalPlanId("");
    setIsModalOpen(true);
  };

  const handleToggleStatus = (p: ProductConfig) => {
    const updated: ProductConfig = {
      ...p,
      status: p.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
    };
    setProductList((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
    showToast(
      t("products.toast.toggled", {
        name: p.name,
        status: updated.status === "ACTIVE" ? t("products.toast.reactivated") : t("products.toast.archivedAction"),
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const featuresArray = formFeatures
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const numericPrice = Number(formPrice) || 0;
    const channelId = formBoundChannels[0] || editingProduct?.channelId;

    if (!channelId) {
      showToast(t("products.sheet.channelRequired"));
      return;
    }

    const tenantId = currentTenant.id === "group_hq" ? "bu_na_ecom" : currentTenant.id;
    const payload = {
      channelId: channelId!,
      tenantId,
      code: formCode.trim(),
      name: formName.trim(),
      currency: formCurrency,
      price: numericPrice,
      type: formType,
      billingInterval: formInterval,
      description: formDescription.trim(),
      features: featuresArray,
      trialDays: formTrialDays,
      status: editingProduct?.status || "ACTIVE",
    };

    try {
      if (editingProduct) {
        const updated = await productsApi.updateProduct(editingProduct.id, payload);
        setProductList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast(t("products.toast.updated", { code: updated.code }));
      } else {
        const newProd = await productsApi.createProduct(payload);
        setProductList((prev) => [newProd, ...prev]);
        showToast(t("products.toast.created", { code: newProd.code }));
      }
      setIsModalOpen(false);
    } catch {
      showToast(t("products.toast.saveFailed"));
    }
  };

  const filteredProducts = productList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || p.type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchesCurrency = currencyFilter === "ALL" || (p.currency || "USD") === currencyFilter;
    return matchesSearch && matchesType && matchesStatus && matchesCurrency;
  });

  const activeCount = productList.filter((p) => p.status === "ACTIVE").length;
  const subscriptionCount = productList.filter((p) => p.type === "SUBSCRIPTION").length;
  const uniqueCurrencies = Array.from(new Set(productList.map((p) => p.currency || "USD")));
  const totalSubscribers = productList.reduce((acc, curr) => acc + (curr.subscriberCount || 0), 0);

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("products.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("products.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {creemChannels.length > 0 && (
            <>
              <ShadcnSelect
                value={filterChannelId}
                onValueChange={(v) => {
                  setFilterChannelId(v);
                  if (!syncChannelId) setSyncChannelId(v);
                }}
                options={[{ value: "", label: t("products.filterChannelAll") }, ...channelOptions]}
                placeholder={t("products.filterByChannel")}
                className="w-[220px]"
              />
              {creemChannels.length > 1 && (
                <ShadcnSelect
                  value={syncChannelId}
                  onValueChange={setSyncChannelId}
                  options={channelOptions}
                  placeholder={t("products.selectChannelToSync")}
                  className="w-[200px]"
                />
              )}
              {creemChannels.length > 1 && (filterChannelId || syncChannelId) && (
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetChannelId("");
                    setCopySheetOpen(true);
                  }}
                  className="px-3.5 py-2 border border-line hover:bg-subtle text-fg rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{t("products.copyToChannel")}</span>
                </button>
              )}
              <button
                onClick={() => void handleSyncFromCreem()}
                disabled={isSyncingFromCreem || !syncChannelId}
                className="px-3.5 py-2 border border-line hover:bg-subtle text-fg rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFromCreem ? "animate-spin" : ""}`} />
                <span>{isSyncingFromCreem ? t("products.syncingFromCreem") : t("products.syncFromCreem")}</span>
              </button>
            </>
          )}
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("products.addProduct")}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("products.metrics.activeSkus")}</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {activeCount}{" "}
            <span className="text-xs font-normal text-fg-tertiary">
              {t("products.metrics.skuRatio", { total: productList.length })}
            </span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("products.metrics.skuHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("products.metrics.currencies")}</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {uniqueCurrencies.length}{" "}
            <span className="text-xs font-normal text-fg-tertiary">{t("products.metrics.currencySuffix")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {uniqueCurrencies.join(" · ")}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("products.metrics.recurring")}</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {subscriptionCount}{" "}
            <span className="text-xs font-normal text-fg-tertiary">{t("products.metrics.recurringSuffix")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("products.metrics.recurringHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("products.metrics.subscribers")}</span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {totalSubscribers.toLocaleString()}{" "}
            <span className="text-xs font-normal text-fg-tertiary">{t("products.metrics.subscriberSuffix")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("products.metrics.subscriberHint")}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Currency Filter */}
          <span className="text-fg-tertiary text-xs font-medium">{t("products.filters.currencyLabel")}</span>
          <div className="flex items-center gap-1 bg-hover p-0.5 rounded-lg">
            <button
              onClick={() => setCurrencyFilter("ALL")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                currencyFilter === "ALL"
                  ? "bg-surface text-fg shadow-card font-bold"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              {t("products.filters.allCurrencies", { count: productList.length })}
            </button>
            {SUPPORTED_CURRENCIES.map((curr) => {
              const count = productList.filter((p) => (p.currency || "USD") === curr.code).length;
              if (count === 0 && curr.code !== "USD" && curr.code !== "EUR" && curr.code !== "JPY") return null;
              return (
                <button
                  key={curr.code}
                  onClick={() => setCurrencyFilter(curr.code)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors flex items-center gap-1 ${
                    currencyFilter === curr.code
                      ? "bg-surface text-fg shadow-card font-bold"
                      : "text-fg-secondary hover:text-fg"
                  }`}
                >
                  <span>{curr.flag}</span>
                  <span>{curr.code}</span>
                  <span className="text-[10px] text-fg-tertiary">({count})</span>
                </button>
              );
            })}
          </div>

          <span className="text-zinc-300 mx-1">|</span>

          {/* Type Filter */}
          <span className="text-fg-tertiary text-xs font-medium">{t("products.filters.typeLabel")}</span>
          {[
            { key: "ALL", label: t("products.filters.typeAll") },
            { key: "SUBSCRIPTION", label: t("products.filters.typeSubscription") },
            { key: "ONE_TIME", label: t("products.filters.typeOneTime") },
            { key: "ADDON", label: t("products.filters.typeAddon") },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                typeFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-subtle text-fg-secondary hover:bg-hover border border-line"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder={t("products.filters.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3 w-[240px]">{t("products.table.code")}</th>
                <th className="py-2 px-3 min-w-[200px]">{t("products.table.name")}</th>
                <th className="py-2 px-3 w-[140px]">{t("products.table.price")}</th>
                <th className="py-2 px-3 w-[140px]">{t("products.table.billing")}</th>
                <th className="py-2 px-3 w-[150px]">{t("products.table.trial")}</th>
                <th className="py-2 px-3 w-[140px]">{t("products.table.mapping")}</th>
                <th className="py-2 px-3 w-[100px]">{t("products.table.subscribers")}</th>
                <th className="py-2 px-3 w-[100px]">{t("products.table.status")}</th>
                <th className="py-2 px-3 w-[150px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("products.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<ProductConfig>(filteredProducts, currentPage, pageSize).map((p) => {
                const currInfo = SUPPORTED_CURRENCIES.find((c) => c.code === (p.currency || "USD"));
                const currSymbol = currInfo ? currInfo.symbol : "$";
                const isCopied = copiedCode === p.code;

                return (
                  <tr key={p.id} className="hover:bg-subtle/80 transition-colors group">
                    {/* Code */}
                    <td className="py-3.5 px-3 w-[240px] whitespace-nowrap font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-fg bg-hover px-2 py-0.5 rounded border border-line text-[11px] truncate max-w-[170px]" title={p.code}>
                          {p.code}
                        </span>
                        <button
                          onClick={() => copyCode(p.code)}
                          className="text-fg-tertiary hover:text-fg-secondary p-1 rounded"
                          title={t("products.table.copyCodeTitle")}
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Name & Desc */}
                    <td className="py-3.5 px-3 min-w-[200px]">
                      <div className="font-semibold text-fg text-xs line-clamp-1">{p.name}</div>
                      <div className="text-[11px] text-fg-tertiary line-clamp-1 mt-0.5">
                        {p.description}
                      </div>
                    </td>

                    {/* Currency & Price */}
                    <td className="py-3.5 px-3 w-[140px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold rounded">
                          {currInfo?.flag} {p.currency || "USD"}
                        </span>
                        <div className="font-mono font-bold text-sm text-fg">
                          {formatCurrency(p.price, p.currency || "USD")}
                        </div>
                      </div>
                    </td>

                    {/* Type & Interval */}
                    <td className="py-3.5 px-3 w-[140px] whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.type === "SUBSCRIPTION"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : p.type === "ONE_TIME"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {p.type === "SUBSCRIPTION"
                          ? t("products.types.SUBSCRIPTION")
                          : p.type === "ONE_TIME"
                          ? t("products.types.ONE_TIME")
                          : t("products.types.ADDON")}
                      </span>
                      <div className="text-[10px] text-fg-tertiary mt-1">
                        {p.billingInterval === "MONTHLY"
                          ? t("products.billing.MONTHLY")
                          : p.billingInterval === "YEARLY"
                          ? t("products.billing.YEARLY")
                          : p.billingInterval === "LIFETIME"
                          ? t("products.billing.LIFETIME")
                          : t("products.billing.ONE_TIME")}
                      </div>
                    </td>

                    {/* Trial / Features */}
                    <td className="py-3.5 px-3 w-[150px] text-[11px] text-fg-secondary">
                      {p.trialDays ? (
                        <div className="font-semibold text-emerald-600">
                          {t("products.trial.days", { days: p.trialDays })}
                        </div>
                      ) : (
                        <div className="text-fg-tertiary">{t("products.trial.none")}</div>
                      )}
                      <div className="text-[10px] text-fg-tertiary truncate">
                        {t("products.trial.features", { count: p.features?.length || 0 })}
                      </div>
                      {p.boundChannelIds && p.boundChannelIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.boundChannelIds.slice(0, 2).map((cid) => {
                            const ch = paymentChannels.find((c) => c.id === cid);
                            return ch ? (
                              <span key={cid} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                {ch.name}
                              </span>
                            ) : null;
                          })}
                          {p.boundChannelIds.length > 2 && (
                            <span className="text-[9px] text-fg-tertiary">+{p.boundChannelIds.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Gateway ID */}
                    <td className="py-3.5 px-3 w-[140px] whitespace-nowrap font-mono text-[11px] text-fg-secondary">
                      {p.stripePriceId ? (
                        <span className="bg-subtle border border-line px-1.5 py-0.5 rounded text-[10px] block max-w-[120px] truncate" title={p.stripePriceId}>
                          {p.stripePriceId}
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>

                    {/* Subscribers */}
                    <td className="py-3.5 px-3 w-[100px] whitespace-nowrap font-mono text-fg">
                      {p.subscriberCount?.toLocaleString() || 0}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 w-[100px] whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-hover text-fg-secondary border-line"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.status === "ACTIVE" ? "bg-emerald-500" : "bg-hover"
                          }`}
                        />
                        {p.status === "ACTIVE" ? t("products.statusLabels.ACTIVE") : t("products.statusLabels.ARCHIVED")}
                      </span>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[150px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1">
                        {/* Clone to other currency */}
                        <div className="relative group">
                          <button
                            className="p-1.5 text-fg-secondary hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                            title={t("products.derive.title")}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-surface border border-line rounded-xl shadow-lg p-1.5 z-20 w-36 text-left">
                            <div className="text-[10px] text-fg-tertiary font-bold px-2 py-1">
                              {t("products.derive.label")}
                            </div>
                            {SUPPORTED_CURRENCIES.filter((c) => c.code !== (p.currency || "USD")).map((c) => (
                              <button
                                key={c.code}
                                onClick={() => handleCloneToNewCurrency(p, c.code)}
                                className="px-2 py-1 hover:bg-subtle rounded text-[11px] text-fg-secondary flex items-center gap-1.5 w-full text-left"
                              >
                                <span>{c.flag}</span>
                                <span>{t("products.derive.generate", { code: c.code })}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg transition-colors"
                          title={t("products.actions.editTitle")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            p.status === "ACTIVE"
                              ? "text-fg-tertiary hover:text-rose-600 hover:bg-rose-50"
                              : "text-fg-tertiary hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={p.status === "ACTIVE" ? t("products.actions.archiveTitle") : t("products.actions.restoreTitle")}
                        >
                          {p.status === "ACTIVE" ? (
                            <Archive className="w-3.5 h-3.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredProducts.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* Add / Edit Product SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-product-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={
            editingProduct
              ? t("products.sheet.editTitle", { code: editingProduct.code })
              : t("products.sheet.createTitle")
          }
          description={t("products.sheet.description")}
          icon={<Package className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 border border-line text-fg-secondary rounded-lg hover:bg-subtle font-medium cursor-pointer"
              >
                {t("products.sheet.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold shadow-card cursor-pointer"
              >
                {editingProduct ? t("products.sheet.saveEdit") : t("products.sheet.confirmCreate")}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Currency & Code */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.currencyLabel")}
                </label>
                <ShadcnSelect
                  value={formCurrency}
                  onValueChange={(newCurr) => {
                    setFormCurrency(newCurr);
                    if (!editingProduct) {
                      setFormCode((prev) => {
                        const parts = prev.split("-");
                        if (parts.length >= 3) {
                          parts[parts.length - 2] = newCurr;
                          return parts.join("-");
                        }
                        return `${prev}-${newCurr}`;
                      });
                    }
                  }}
                  options={SUPPORTED_CURRENCIES.map((c) => ({
                    value: c.code,
                    label: `${c.flag} ${t(`products.currencies.${c.labelKey}`)}`,
                  }))}
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.codeLabel")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("products.sheet.codePlaceholder")}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg font-mono text-xs focus:bg-surface font-bold text-fg focus:outline-none focus:ring-1 focus:ring-line"
                />
                <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                  {t("products.sheet.codeHint")}
                </span>
              </div>
            </div>

            {/* Name & Price */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.nameLabel")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("products.sheet.namePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface font-medium focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.priceLabel", { currency: formCurrency })}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 font-mono text-fg-tertiary font-bold">
                    {SUPPORTED_CURRENCIES.find((c) => c.code === formCurrency)?.symbol || "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 bg-subtle border border-line rounded-lg text-xs font-mono font-bold focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                  />
                </div>
              </div>
            </div>

            {/* Type & Interval */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.typeLabel")}
                </label>
                <ShadcnSelect
                  value={formType}
                  onValueChange={(val) => setFormType(val as ProductType)}
                  options={[
                    { value: "SUBSCRIPTION", label: t("products.sheet.typeSubscription") },
                    { value: "ONE_TIME", label: t("products.sheet.typeOneTime") },
                    { value: "ADDON", label: t("products.sheet.typeAddon") },
                  ]}
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.intervalLabel")}
                </label>
                <ShadcnSelect
                  value={formInterval}
                  onValueChange={(val) => setFormInterval(val as any)}
                  options={[
                    { value: "MONTHLY", label: t("products.sheet.intervalMonthly") },
                    { value: "YEARLY", label: t("products.sheet.intervalYearly") },
                    { value: "ONE_TIME", label: t("products.sheet.intervalOneTime") },
                    { value: "LIFETIME", label: t("products.sheet.intervalLifetime") },
                  ]}
                />
              </div>
            </div>

            {/* Trial & Gateway IDs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.trialLabel")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formTrialDays}
                  onChange={(e) => setFormTrialDays(parseInt(e.target.value) || 0)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.stripeLabel")}
                </label>
                <input
                  type="text"
                  value={formStripePriceId}
                  onChange={(e) => setFormStripePriceId(e.target.value)}
                  placeholder="price_1Nxxx"
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("products.sheet.paypalLabel")}
                </label>
                <input
                  type="text"
                  value={formPaypalPlanId}
                  onChange={(e) => setFormPaypalPlanId(e.target.value)}
                  placeholder="P-123456"
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("products.sheet.descLabel")}
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("products.sheet.descPlaceholder")}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("products.sheet.featuresLabel")}
              </label>
              <textarea
                rows={3}
                value={formFeatures}
                onChange={(e) => setFormFeatures(e.target.value)}
                placeholder={t("products.sheet.featuresPlaceholder")}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("products.sheet.channelsLabel")}
              </label>
              <MultiSelect
                value={formBoundChannels}
                onValueChange={setFormBoundChannels}
                options={channelOptions}
                placeholder={t("products.sheet.channelsPlaceholder")}
              />
            </div>
          </form>
        </SideSheet>
      )}

      <SideSheet
        isOpen={copySheetOpen}
        onClose={() => setCopySheetOpen(false)}
        title={t("products.copyChannel.title")}
        description={t("products.copyChannel.description")}
        footer={
          <button
            type="button"
            disabled={isCopying || !copyTargetChannelId}
            onClick={() => void handleCopyToChannel()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {isCopying ? t("common:status.loading") : t("products.copyChannel.confirm")}
          </button>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("products.copyChannel.sourceLabel")}
            </label>
            <p className="font-mono text-fg">
              {channelOptions.find((o) => o.value === (filterChannelId || syncChannelId))?.label ||
                t("products.selectChannelToSync")}
            </p>
          </div>
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("products.copyChannel.targetLabel")}
            </label>
            <ShadcnSelect
              value={copyTargetChannelId}
              onValueChange={setCopyTargetChannelId}
              options={channelOptions.filter(
                (o) => o.value !== (filterChannelId || syncChannelId)
              )}
              placeholder={t("products.copyChannel.targetPlaceholder")}
              className="w-full"
            />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
