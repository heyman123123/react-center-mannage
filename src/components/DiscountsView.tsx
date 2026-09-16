import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as discountsApi from "../api/modules/discounts";
import * as productsApi from "../api/modules/products";
import * as channelsApi from "../api/modules/channels";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Tag,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Calendar,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { DiscountConfig, DiscountType, Tenant, PaymentChannelConfig, ProductConfig } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { MultiSelect } from "./ui/MultiSelect";

interface DiscountsViewProps {
  currentTenant: Tenant;
  currentUser?: import("../types/payment").SystemUser;
}

export const DiscountsView: React.FC<DiscountsViewProps> = ({
  currentTenant,
}) => {
  const { t } = useTranslation(["products", "common"]);
  const typeFilters = useMemo(
    () => [
      { key: "ALL", label: t("discounts.filters.typeAll") },
      { key: "PERCENTAGE", label: t("discounts.filters.typePercentage") },
      { key: "FIXED_AMOUNT", label: t("discounts.filters.typeFixed") },
    ],
    [t]
  );
  const statusFilters = useMemo(
    () => [
      { key: "ALL", label: t("discounts.filters.statusAll") },
      { key: "ACTIVE", label: t("discounts.filters.statusActive") },
      { key: "EXPIRED", label: t("discounts.filters.statusExpired") },
      { key: "DISABLED", label: t("discounts.filters.statusDisabled") },
    ],
    [t]
  );
  const formScopeOptions = useMemo(
    () => [
      { value: "ALL", label: t("discounts.sheet.scopeAll") },
      { value: "SUBSCRIPTION_ONLY", label: t("discounts.sheet.scopeSubscription") },
      { value: "BU_SPECIFIC", label: t("discounts.sheet.scopeBu") },
    ],
    [t]
  );
  const formTypeOptions = useMemo(
    () => [
      { value: "PERCENTAGE", label: t("discounts.sheet.typePercentage") },
      { value: "FIXED_AMOUNT", label: t("discounts.sheet.typeFixed") },
    ],
    [t]
  );
  const [discountList, setDiscountList] = useState<DiscountConfig[]>([]);
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelConfig[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const creemChannels = paymentChannels.filter((c) => c.channelKey === "creem");
  const channelOptions = creemChannels.map((c) => ({
    value: c.id,
    label: `${c.name}${c.accountName ? ` · ${c.accountName}` : ""}`,
  }));

  const loadDiscounts = useCallback(async () => {
    try {
      const list = await discountsApi.listDiscounts({
        tenantId: currentTenant.id === "group_hq" ? undefined : currentTenant.id,
      });
      setDiscountList(list);
    } catch {
      showToast(t("discounts.toast.loadFailed"));
    }
  }, [currentTenant.id, t]);

  const loadCatalog = useCallback(async () => {
    const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
    try {
      const [productRows, channelRows] = await Promise.all([
        productsApi.listProducts({ tenantId }),
        channelsApi.listPaymentChannels(),
      ]);
      setProducts(productRows);
      setPaymentChannels(channelRows);
    } catch {
      setProducts([]);
      setPaymentChannels([]);
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void loadDiscounts();
    void loadCatalog();
  }, [loadDiscounts, loadCatalog]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [searchQuery, typeFilter, statusFilter, reset]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountConfig | null>(null);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<DiscountType>("PERCENTAGE");
  const [formValue, setFormValue] = useState<number>(20);
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formMaxUsage, setFormMaxUsage] = useState<number>(1000);
  const [formStartDate, setFormStartDate] = useState("2026-01-01");
  const [formEndDate, setFormEndDate] = useState("2026-12-31");
  const [formScope, setFormScope] = useState<"ALL" | "SUBSCRIPTION_ONLY" | "BU_SPECIFIC">("ALL");
  const [formBoundChannels, setFormBoundChannels] = useState<string[]>([]);
  const [formAppliesToProducts, setFormAppliesToProducts] = useState<string[]>([]);

  const selectedChannelId = formBoundChannels[0] || editingDiscount?.channelId;
  const productOptions = products
    .filter((p) => !selectedChannelId || p.channelId === selectedChannelId || p.boundChannelIds?.includes(selectedChannelId))
    .filter((p) => p.syncStatus === "SYNCED" || p.creemProductId)
    .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingDiscount(null);
    setFormCode(`SAVE${Math.floor(10 + Math.random() * 80)}`);
    setFormName("");
    setFormType("PERCENTAGE");
    setFormValue(20);
    setFormCurrency("USD");
    setFormMinOrder(0);
    setFormMaxUsage(500);
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate("2026-12-31");
    setFormScope("ALL");
    setFormBoundChannels([]);
    setFormAppliesToProducts([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: DiscountConfig) => {
    setEditingDiscount(d);
    setFormCode(d.code);
    setFormName(d.name);
    setFormType(d.type);
    setFormValue(d.value);
    setFormCurrency(d.currency || "USD");
    setFormMinOrder(d.minOrderAmount);
    setFormMaxUsage(d.maxUsageLimit);
    setFormStartDate(d.startDate);
    setFormEndDate(d.endDate);
    setFormScope(d.applicableScope);
    setFormBoundChannels(d.boundChannelIds || (d.channelId ? [d.channelId] : []));
    setFormAppliesToProducts(d.appliesToProductIds || []);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (d: DiscountConfig) => {
    const nextStatus = d.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const updated: DiscountConfig = { ...d, status: nextStatus };
    setDiscountList((prev) => prev.map((item) => (item.id === d.id ? updated : item)));
    showToast(t("discounts.toast.toggled", {
      code: d.code,
      status: nextStatus === "ACTIVE" ? t("discounts.toast.enabled") : t("discounts.toast.disabled"),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const channelId = formBoundChannels[0];

    if (!channelId) {
      showToast(t("discounts.sheet.channelRequired"));
      return;
    }
    if (!editingDiscount && formAppliesToProducts.length === 0) {
      showToast(t("discounts.toast.productsRequired"));
      return;
    }

    const tenantId = currentTenant.id === "group_hq" ? "bu_na_ecom" : currentTenant.id;
    const payload = {
      channelId: channelId || editingDiscount?.channelId || "",
      tenantId,
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      type: formType,
      value: Number(formValue) || 0,
      currency: formCurrency,
      minOrderAmount: Number(formMinOrder) || 0,
      maxUsageLimit: Number(formMaxUsage) || 0,
      startDate: formStartDate,
      endDate: formEndDate,
      applicableScope: formScope,
      appliesToProductIds: formAppliesToProducts,
    };

    try {
      if (editingDiscount) {
        const updated = await discountsApi.updateDiscount(editingDiscount.id, payload);
        setDiscountList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast(t("discounts.toast.updated", { code: updated.code }));
      } else {
        const newDiscount = await discountsApi.createDiscount(payload);
        setDiscountList((prev) => [newDiscount, ...prev]);
        showToast(t("discounts.toast.created", { code: newDiscount.code }));
      }
      setIsModalOpen(false);
    } catch {
      showToast(t("discounts.toast.saveFailed"));
    }
  };

  const filteredDiscounts = discountList.filter((d) => {
    const matchesSearch =
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || d.type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeCount = discountList.filter((d) => d.status === "ACTIVE").length;
  const totalRedeemed = discountList.reduce((acc, curr) => acc + curr.usedCount, 0);

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
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Tag className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("discounts.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("discounts.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("discounts.addDiscount")}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("discounts.metrics.activePlans")}</span>
            <Tag className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {t("discounts.metrics.activeCount", { active: activeCount, total: discountList.length })}
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("discounts.metrics.activeHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("discounts.metrics.redeemed")}</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {totalRedeemed.toLocaleString()} <span className="text-xs font-normal text-fg-tertiary">{t("discounts.metrics.redeemedCount")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("discounts.metrics.redeemedHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("discounts.metrics.promoLink")}</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            100% <span className="text-xs font-normal text-fg-tertiary">{t("discounts.metrics.emailBind")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("discounts.metrics.promoHint")}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("discounts.filters.typeLabel")}</span>
          {typeFilters.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                typeFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span className="text-zinc-300 mx-1">|</span>

          <span className="text-fg-tertiary text-xs">{t("discounts.filters.statusLabel")}</span>
          {statusFilters.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-primary-hover text-white font-bold"
                  : "bg-hover text-fg-secondary hover:bg-hover"
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
            placeholder={t("discounts.filters.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Discounts Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3 w-[220px]">{t("discounts.table.code")}</th>
                <th className="py-2 px-3 min-w-[200px]">{t("discounts.table.nameScope")}</th>
                <th className="py-2 px-3 w-[130px]">{t("discounts.table.value")}</th>
                <th className="py-2 px-3 w-[120px]">{t("discounts.table.threshold")}</th>
                <th className="py-2 px-3 w-[160px]">{t("discounts.table.usage")}</th>
                <th className="py-2 px-3 w-[170px]">{t("discounts.table.validity")}</th>
                <th className="py-2 px-3 w-[100px]">{t("discounts.table.status")}</th>
                <th className="py-2 px-3 w-[140px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("discounts.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<DiscountConfig>(filteredDiscounts, currentPage, pageSize).map((d) => {
                const percentUsed = Math.min(100, Math.round((d.usedCount / d.maxUsageLimit) * 100));
                const isCopied = copiedCode === d.code;
                return (
                  <tr key={d.id} className="hover:bg-subtle/80 transition-colors group">
                    <td className="py-3.5 px-3 w-[220px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-fg bg-hover px-2 py-0.5 rounded border border-line">
                          {d.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(d.code)}
                          className="p-1 text-fg-tertiary hover:text-fg-secondary rounded transition-colors"
                          title={t("discounts.table.copyCode")}
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 min-w-[200px]">
                      <div className="font-semibold text-fg line-clamp-1">{d.name}</div>
                      <div className="text-[10px] text-fg-tertiary mt-0.5 line-clamp-1">
                        {d.applicableScope === "ALL"
                          ? t("discounts.table.scopeAll")
                          : d.applicableScope === "SUBSCRIPTION_ONLY"
                          ? t("discounts.table.scopeSubscription")
                          : t("discounts.table.scopeBu")}
                      </div>
                      {d.boundChannelIds && d.boundChannelIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.boundChannelIds.slice(0, 2).map((cid) => {
                            const ch = paymentChannels.find((c) => c.id === cid);
                            return ch ? (
                              <span key={cid} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                {ch.name}
                              </span>
                            ) : null;
                          })}
                          {d.boundChannelIds.length > 2 && (
                            <span className="text-[9px] text-fg-tertiary">+{d.boundChannelIds.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 w-[130px] whitespace-nowrap">
                      <div className="font-bold font-mono text-fg">
                        {d.type === "PERCENTAGE" ? (
                          <span className="text-rose-600">{t("discounts.table.percentOff", { value: d.value })}</span>
                        ) : (
                          <span className="text-emerald-600">
                            {t("discounts.table.fixedOff", {
                              currency: d.currency === "USD" ? "$" : d.currency,
                              value: d.value,
                            })}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[120px] whitespace-nowrap text-fg-secondary">
                      {d.minOrderAmount > 0 ? (
                        <span>
                          {t("discounts.table.minOrder", { amount: d.minOrderAmount })}
                        </span>
                      ) : (
                        <span className="text-fg-tertiary">{t("discounts.table.noThreshold")}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 w-[160px]">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold text-fg">{d.usedCount}</span>
                        <span className="text-fg-tertiary">/ {d.maxUsageLimit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-hover rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percentUsed >= 90
                              ? "bg-rose-500"
                              : percentUsed >= 50
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[170px] whitespace-nowrap text-[11px] font-mono text-fg-secondary">
                      <div>{t("discounts.table.dateRange", { start: d.startDate })}</div>
                      <div>{d.endDate}</div>
                    </td>

                    <td className="py-3.5 px-3 w-[100px] whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : d.status === "EXPIRED"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-hover text-fg-secondary border-line"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.status === "ACTIVE"
                              ? "bg-emerald-500"
                              : d.status === "EXPIRED"
                              ? "bg-amber-500"
                              : "bg-hover"
                          }`}
                        />
                        {d.status === "ACTIVE"
                          ? t("discounts.table.statusActive")
                          : d.status === "EXPIRED"
                          ? t("discounts.table.statusExpired")
                          : t("discounts.table.statusDisabled")}
                      </span>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[140px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg transition-colors"
                          title={t("discounts.table.editTitle")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(d)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            d.status === "ACTIVE"
                              ? "text-fg-tertiary hover:text-rose-600 hover:bg-rose-50"
                              : "text-fg-tertiary hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={d.status === "ACTIVE" ? t("discounts.table.disableTitle") : t("discounts.table.enableTitle")}
                        >
                          {d.status === "ACTIVE" ? t("discounts.table.disable") : t("discounts.table.enable")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredDiscounts.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* Add / Edit Discount SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-discount-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingDiscount ? t("discounts.sheet.editTitle", { code: editingDiscount.code }) : t("discounts.sheet.createTitle")}
          description={t("discounts.sheet.description")}
          icon={<Tag className="w-5 h-5 text-rose-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 border border-line text-fg-secondary rounded-lg hover:bg-subtle font-medium cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-semibold shadow-card cursor-pointer"
              >
                {editingDiscount ? t("discounts.sheet.save") : t("discounts.sheet.confirm")}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.codeLabel")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("discounts.sheet.codePlaceholder")}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full p-2 bg-subtle border border-line rounded-lg font-mono font-bold text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.typeLabel")}
                </label>
                <ShadcnSelect
                  value={formType}
                  onValueChange={(val) => setFormType(val as DiscountType)}
                  options={formTypeOptions}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("discounts.sheet.nameLabel")}
              </label>
              <input
                type="text"
                required
                placeholder={t("discounts.sheet.namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {formType === "PERCENTAGE" ? t("discounts.sheet.percentValue") : t("discounts.sheet.fixedValue")}
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={formValue}
                  onChange={(e) => setFormValue(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono font-bold focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.minOrderLabel")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMinOrder}
                  onChange={(e) => setFormMinOrder(parseFloat(e.target.value) || 0)}
                  placeholder={t("discounts.sheet.minOrderPlaceholder")}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.maxUsageLabel")}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formMaxUsage}
                  onChange={(e) => setFormMaxUsage(parseInt(e.target.value) || 100)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.scopeLabel")}
                </label>
                <ShadcnSelect
                  value={formScope}
                  onValueChange={(val) => setFormScope(val as any)}
                  options={formScopeOptions}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.startDateLabel")}
                </label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.endDateLabel")}
                </label>
                <input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("discounts.sheet.channelsLabel")}
              </label>
              <MultiSelect
                value={formBoundChannels}
                onValueChange={setFormBoundChannels}
                options={channelOptions}
                placeholder={t("discounts.sheet.channelsPlaceholder")}
              />
            </div>

            {!editingDiscount && (
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  {t("discounts.sheet.productsLabel")}
                </label>
                <MultiSelect
                  value={formAppliesToProducts}
                  onValueChange={setFormAppliesToProducts}
                  options={productOptions}
                  placeholder={t("discounts.sheet.productsPlaceholder")}
                />
              </div>
            )}
          </form>
        </SideSheet>
      )}
    </div>
  );
};
