import React, { useState } from "react";
import { useViewLoading } from "./ui/useViewLoading";
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
  Zap,
  Globe,
  Coins,
  ArrowRightLeft,
  Sparkles,
  Layers,
} from "lucide-react";
import { ProductConfig, ProductType, Tenant } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface ProductsViewProps {
  products: ProductConfig[];
  currentTenant: Tenant;
  onSaveProduct: (product: ProductConfig) => void;
}

const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", label: "美元 (USD)" },
  { code: "EUR", symbol: "€", flag: "🇪🇺", label: "欧元 (EUR)" },
  { code: "JPY", symbol: "¥", flag: "🇯🇵", label: "日元 (JPY)" },
  { code: "GBP", symbol: "£", flag: "🇬🇧", label: "英镑 (GBP)" },
  { code: "CAD", symbol: "C$", flag: "🇨🇦", label: "加元 (CAD)" },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", label: "澳元 (AUD)" },
];

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  currentTenant,
  onSaveProduct,
}) => {
  const [productList, setProductList] = useState<ProductConfig[]>(products);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
    onSaveProduct(updated);
    showToast(`商品【${p.name}】已${updated.status === "ACTIVE" ? "重新上架激活" : "归档下架"}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const featuresArray = formFeatures
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const numericPrice = Number(formPrice) || 0;

    if (editingProduct) {
      const updated: ProductConfig = {
        ...editingProduct,
        code: formCode.trim(),
        name: formName.trim(),
        currency: formCurrency,
        price: numericPrice,
        prices: { [formCurrency]: numericPrice },
        type: formType,
        billingInterval: formInterval,
        description: formDescription.trim(),
        features: featuresArray,
        trialDays: formTrialDays,
        stripePriceId: formStripePriceId.trim() || undefined,
        paypalPlanId: formPaypalPlanId.trim() || undefined,
      };
      setProductList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveProduct(updated);
      showToast(`商品【${updated.code}】配置已更新！`);
    } else {
      const newProd: ProductConfig = {
        id: `prod_${formCurrency.toLowerCase()}_${Date.now().toString().slice(-6)}`,
        code: formCode.trim(),
        name: formName.trim(),
        currency: formCurrency,
        price: numericPrice,
        prices: { [formCurrency]: numericPrice },
        type: formType,
        tenantId: currentTenant.id === "group_hq" ? "bu_na_ecom" : currentTenant.id,
        description: formDescription.trim(),
        features: featuresArray,
        trialDays: formTrialDays,
        status: "ACTIVE",
        billingInterval: formInterval,
        stripePriceId: formStripePriceId.trim() || `price_stripe_${Date.now().toString().slice(-6)}`,
        paypalPlanId: formPaypalPlanId.trim() || undefined,
        subscriberCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setProductList((prev) => [newProd, ...prev]);
      onSaveProduct(newProd);
      showToast(`新币种商品【${newProd.code}】已成功创建并录入网关！`);
    }
    setIsModalOpen(false);
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
            <h1 className="text-xl font-bold text-fg tracking-tight">
              海外商品与独立币种 SKU 配置 (Products & Multi-Currency SKUs)
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            每个商品的不同货币具有独立的唯一编号 (Code / SKU)，分别对应 USD、EUR、JPY、GBP 等独立清算价格与网关 Plan ID，支持一键派生克隆。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>创建新商品 SKU</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>在售独立 SKU 数</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {activeCount} <span className="text-xs font-normal text-fg-tertiary">/ {productList.length} 款</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">每条对应特定币种与唯一 Code</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>覆盖结算币种</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {uniqueCurrencies.length} <span className="text-xs font-normal text-fg-tertiary">种主要货币</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {uniqueCurrencies.join(" · ")}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>周期性订阅方案 (Recurring)</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {subscriptionCount} <span className="text-xs font-normal text-fg-tertiary">个方案</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">月付/年付海外自动扣款</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>全球活跃订阅用户</span>
            <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {totalSubscribers.toLocaleString()} <span className="text-xs font-normal text-fg-tertiary">位海外客户</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">跨美欧亚多地区收单</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Currency Filter */}
          <span className="text-fg-tertiary text-xs font-medium">货币筛选:</span>
          <div className="flex items-center gap-1 bg-hover p-0.5 rounded-lg">
            <button
              onClick={() => setCurrencyFilter("ALL")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                currencyFilter === "ALL"
                  ? "bg-surface text-fg shadow-card font-bold"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              全部货币 ({productList.length})
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
          <span className="text-fg-tertiary text-xs font-medium">类型:</span>
          {[
            { key: "ALL", label: "全部" },
            { key: "SUBSCRIPTION", label: "订阅型 (SaaS)" },
            { key: "ONE_TIME", label: "单次买断" },
            { key: "ADDON", label: "增值包" },
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
            placeholder="搜索商品名称 / 唯一 Code / 描述..."
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
                <th className="py-2 px-3 w-[240px]">商品唯一编号 (Code / SKU)</th>
                <th className="py-2 px-3 min-w-[200px]">商品方案名称</th>
                <th className="py-2 px-3 w-[140px]">结算货币 & 单价</th>
                <th className="py-2 px-3 w-[140px]">计费模式与周期</th>
                <th className="py-2 px-3 w-[150px]">试用期 / 特性权益</th>
                <th className="py-2 px-3 w-[140px]">Stripe / PayPal 映射</th>
                <th className="py-2 px-3 w-[100px]">海外订阅数</th>
                <th className="py-2 px-3 w-[100px]">状态</th>
                <th className="py-2 px-3 w-[150px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filteredProducts.map((p) => {
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
                          title="复制商品编号 Code"
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
                          ? "周期订阅"
                          : p.type === "ONE_TIME"
                          ? "单次买断"
                          : "增值服务"}
                      </span>
                      <div className="text-[10px] text-fg-tertiary mt-1">
                        {p.billingInterval === "MONTHLY"
                          ? "按月续费 (Monthly)"
                          : p.billingInterval === "YEARLY"
                          ? "按年续费 (Yearly)"
                          : p.billingInterval === "LIFETIME"
                          ? "永久买断 (Lifetime)"
                          : "一次性结算"}
                      </div>
                    </td>

                    {/* Trial / Features */}
                    <td className="py-3.5 px-3 w-[150px] text-[11px] text-fg-secondary">
                      {p.trialDays ? (
                        <div className="font-semibold text-emerald-600">
                          {p.trialDays} 天免费试用
                        </div>
                      ) : (
                        <div className="text-fg-tertiary">无免费试用</div>
                      )}
                      <div className="text-[10px] text-fg-tertiary truncate">
                        {p.features?.length || 0} 项核心权益
                      </div>
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
                        {p.status === "ACTIVE" ? "在售" : "已归档"}
                      </span>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[150px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1">
                        {/* Clone to other currency */}
                        <div className="relative group">
                          <button
                            className="p-1.5 text-fg-secondary hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                            title="以此为蓝本派生其他货币的独立商品编号"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-surface border border-line rounded-xl shadow-lg p-1.5 z-20 w-36 text-left">
                            <div className="text-[10px] text-fg-tertiary font-bold px-2 py-1">
                              派生独立货币 Code:
                            </div>
                            {SUPPORTED_CURRENCIES.filter((c) => c.code !== (p.currency || "USD")).map((c) => (
                              <button
                                key={c.code}
                                onClick={() => handleCloneToNewCurrency(p, c.code)}
                                className="px-2 py-1 hover:bg-subtle rounded text-[11px] text-fg-secondary flex items-center gap-1.5 w-full text-left"
                              >
                                <span>{c.flag}</span>
                                <span>生成 {c.code} SKU</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg transition-colors"
                          title="编辑配置"
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
                          title={p.status === "ACTIVE" ? "归档下架" : "重新上架"}
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
      </div>

      {/* Add / Edit Product SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-product-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? `编辑商品 SKU: ${editingProduct.code}` : "创建新币种商品 / 独立 SKU"}
          description="配置特定币种结算的独立商品包与网关定价映射"
          icon={<Package className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 border border-line text-fg-secondary rounded-lg hover:bg-subtle font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold shadow-card cursor-pointer"
              >
                {editingProduct ? "保存更改" : "确认创建独立 SKU"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Currency & Code */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  指定计费货币 (Currency):
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
                    label: `${c.flag} ${c.label}`,
                  }))}
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  商品唯一编号 (Code / SKU):
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：PROD-COPILOT-USD-M"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg font-mono text-xs focus:bg-surface font-bold text-fg focus:outline-none focus:ring-1 focus:ring-line"
                />
                <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                  不同货币 code 独立互不冲突，便于收银台精准定位
                </span>
              </div>
            </div>

            {/* Name & Price */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="font-semibold text-fg-secondary block mb-1">
                  商品 / 方案名称:
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：Novas AI Copilot Pro (USD)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface font-medium focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  当前货币单价 ({formCurrency}):
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
                  业务类型:
                </label>
                <ShadcnSelect
                  value={formType}
                  onValueChange={(val) => setFormType(val as ProductType)}
                  options={[
                    { value: "SUBSCRIPTION", label: "周期订阅 (Subscription)" },
                    { value: "ONE_TIME", label: "单次购买 / 买断 (One-Time)" },
                    { value: "ADDON", label: "增值补充包 (Add-on)" },
                  ]}
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  计费周期 (Billing Interval):
                </label>
                <ShadcnSelect
                  value={formInterval}
                  onValueChange={(val) => setFormInterval(val as any)}
                  options={[
                    { value: "MONTHLY", label: "按月计费 (Monthly)" },
                    { value: "YEARLY", label: "按年计费 (Yearly)" },
                    { value: "ONE_TIME", label: "单次结算 (One-Time)" },
                    { value: "LIFETIME", label: "永久有效 (Lifetime)" },
                  ]}
                />
              </div>
            </div>

            {/* Trial & Gateway IDs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  免费试用天数 (Trial Days):
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
                  Stripe 价格 ID:
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
                  PayPal 计划 ID:
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
                详细描述:
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="说明该商品针对当前币种客户群体的方案亮点..."
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                包含核心权益清单 (每行一项):
              </label>
              <textarea
                rows={3}
                value={formFeatures}
                onChange={(e) => setFormFeatures(e.target.value)}
                placeholder="无限量代码补全&#10;128k 上下文窗口&#10;7x24 小时 SLA 响应"
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
              />
            </div>
          </form>
        </SideSheet>
      )}
    </div>
  );
};
