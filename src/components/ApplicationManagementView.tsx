import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as appsApi from "../api/modules/apps";
import * as channelsApi from "../api/modules/channels";
import * as productsApi from "../api/modules/products";
import * as discountsApi from "../api/modules/discounts";
import * as messagingApi from "../api/modules/messaging";
import * as tenantsApi from "../api/modules/tenants";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Layers,
  Plus,
  Key,
  Globe,
  Webhook,
  CreditCard,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit2,
  Power,
  TrendingUp,
  Users,
  Sliders,
  Package,
  Tag,
  Mail,
  Languages,
  ArrowRight,
  ArrowLeft,
  Settings,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  AlertCircle,
  RotateCcw,
  Download,
} from "lucide-react";
import {
  PaymentApp,
  PaymentChannel,
  PaymentChannelConfig,
  EmailChannelConfig,
  ProductConfig,
  DiscountConfig,
  EmailTemplate,
  Tenant,
  SupportedLanguage,
} from "../types/payment";
import { formatCurrency, exportToCSV } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface ApplicationManagementViewProps {
  currentTenant: Tenant;
}

const AVAILABLE_PAYMENT_CHANNELS: { key: PaymentChannel; label: string; desc: string; icon: string }[] = [
  { key: "stripe", label: "Stripe", desc: "全球主要卡收单、Apple Pay、SEPA、Klarna", icon: "💳" },
  { key: "paypal", label: "PayPal", desc: "PayPal 钱包、Pay Later、欧美主流电子钱包", icon: "🅿️" },
  { key: "adyen", label: "Adyen", desc: "欧洲本土多币种本地清算与多国本地借记卡", icon: "🌐" },
  { key: "apple_pay", label: "Apple Pay", desc: "iOS / Safari 终端生物识别一键免密结算", icon: "🍎" },
  { key: "google_pay", label: "Google Pay", desc: "Android / Chrome 终端快捷支付通道", icon: "🇬" },
  { key: "klarna", label: "Klarna", desc: "欧美主流先买后付 (BNPL) 分期与延迟结算", icon: "🛍️" },
  { key: "sepa", label: "SEPA Direct Debit", desc: "欧洲单一欧元区银行直接借记与代扣", icon: "🏦" },
];

const AVAILABLE_PAYMENT_METHODS: { id: string; name: string; channelCategory: string }[] = [
  { id: "credit_card", name: "国际信用卡 / 借记卡 (Visa/Mastercard/Amex)", channelCategory: "Stripe / Adyen" },
  { id: "paypal_wallet", name: "PayPal 钱包余额 (PayPal Balance)", channelCategory: "PayPal" },
  { id: "apple_pay", name: "Apple Pay 原生快捷支付", channelCategory: "Apple Pay / Stripe" },
  { id: "google_pay", name: "Google Pay 快速结账", channelCategory: "Google Pay / Stripe" },
  { id: "klarna_pay_later", name: "Klarna 分期付 (Pay Later / 3期免息)", channelCategory: "Klarna" },
  { id: "sepa_debit", name: "SEPA 银行自动直接借记", channelCategory: "SEPA / Stripe" },
  { id: "ideal_bank", name: "iDEAL 荷兰本土银行直连", channelCategory: "Adyen" },
  { id: "jcb_card", name: "JCB 日本本地卡网络", channelCategory: "Stripe / Adyen" },
];

const AVAILABLE_LANGUAGES: { code: SupportedLanguage; flag: string; label: string }[] = [
  { code: "en-US", flag: "🇺🇸", label: "English (US)" },
  { code: "zh-CN", flag: "🇨🇳", label: "简体中文" },
  { code: "ja-JP", flag: "🇯🇵", label: "日本語 (Japanese)" },
  { code: "de-DE", flag: "🇩🇪", label: "Deutsch (German)" },
  { code: "es-ES", flag: "🇪🇸", label: "Español (Spanish)" },
  { code: "fr-FR", flag: "🇫🇷", label: "Français (French)" },
];

const EMAIL_TRIGGER_EVENT_IDS = [
  "subscription_welcome_receipt",
  "recurring_renewal_success",
  "payment_failed_dunning",
  "subscription_canceled_notice",
  "security_password_reset",
] as const;

export const ApplicationManagementView: React.FC<ApplicationManagementViewProps> = ({
  currentTenant,
}) => {
  const { t } = useTranslation(["apps", "common"]);
  const [appList, setAppList] = useState<PaymentApp[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelConfig[]>([]);
  const [emailChannels, setEmailChannels] = useState<EmailChannelConfig[]>([]);
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [discounts, setDiscounts] = useState<DiscountConfig[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const loadData = useCallback(async () => {
    const tenantId = currentTenant.id === "group_hq" ? undefined : currentTenant.id;
    try {
      const [apps, channels, emailCh, productRows, discountRows, templates, tenantRows] =
        await Promise.all([
          appsApi.getApps(),
          channelsApi.listPaymentChannels(),
          messagingApi.listEmailChannels(),
          productsApi.listProducts({ tenantId }),
          discountsApi.listDiscounts({ tenantId }),
          messagingApi.listEmailTemplates(),
          tenantsApi.listTenants(),
        ]);
      setAppList(apps);
      setPaymentChannels(channels);
      setEmailChannels(emailCh);
      setProducts(productRows);
      setDiscounts(discountRows);
      setEmailTemplates(templates);
      setTenants(tenantRows);
    } catch {
      /* keep partial state */
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const routingStrategies = useMemo(
    () =>
      [
        {
          key: "HIGHEST_SUCCESS_RATE" as const,
          title: t("apps:wizard.channels.routingHighestSuccess"),
          desc: t("apps:wizard.channels.routingHighestSuccessDesc"),
        },
        {
          key: "LOWEST_FEE" as const,
          title: t("apps:wizard.channels.routingLowestFee"),
          desc: t("apps:wizard.channels.routingLowestFeeDesc"),
        },
        {
          key: "PRIORITY_LIST" as const,
          title: t("apps:wizard.channels.routingPriority"),
          desc: t("apps:wizard.channels.routingPriorityDesc"),
        },
      ],
    [t]
  );

  const wizardSteps = useMemo(
    () =>
      [
        { step: 1, label: t("apps:wizard.steps.1"), icon: Layers },
        { step: 2, label: t("apps:wizard.steps.2"), icon: CreditCard },
        { step: 3, label: t("apps:wizard.steps.3"), icon: Package },
        { step: 4, label: t("apps:wizard.steps.4"), icon: Tag },
        { step: 5, label: t("apps:wizard.steps.5"), icon: Mail },
        { step: 6, label: t("apps:wizard.steps.6"), icon: Languages },
      ],
    [t]
  );

  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { currentPage, setCurrentPage, reset: _ar, pageSize } = usePagination(10);

  // Modal / Wizard State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Detail Drawer State
  const [viewingDetailApp, setViewingDetailApp] = useState<PaymentApp | null>(null);

  // Form State (Comprehensive Application Configuration)
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formTenantId, setFormTenantId] = useState("bu_eu_saas");
  const [formDesc, setFormDesc] = useState("");
  const [formEnv, setFormEnv] = useState<"Production" | "Staging">("Production");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formPublishableKey, setFormPublishableKey] = useState("");
  const [formSecretKey, setFormSecretKey] = useState("");

  // Payment channels & methods
  const [formChannels, setFormChannels] = useState<PaymentChannel[]>(["stripe", "paypal", "apple_pay"]);
  const [formPaymentMethods, setFormPaymentMethods] = useState<string[]>([
    "credit_card",
    "paypal_wallet",
    "apple_pay",
    "google_pay",
  ]);
  const [formRoutingStrategy, setFormRoutingStrategy] = useState<"HIGHEST_SUCCESS_RATE" | "LOWEST_FEE" | "PRIORITY_LIST">(
    "HIGHEST_SUCCESS_RATE"
  );

  // Associated products & discounts
  const [formAssociatedProductCodes, setFormAssociatedProductCodes] = useState<string[]>([]);
  const [formAssociatedDiscountCodes, setFormAssociatedDiscountCodes] = useState<string[]>([]);

  // 按应用已选渠道过滤可关联的商品/折扣（需求6b）：
  // 未选渠道时显示全部；已选渠道时只显示绑定了对应渠道账号的商品/折扣（未绑定渠道的视为对全部渠道可用）
  const selectedChannelAccountIds = new Set(
    paymentChannels.filter((c) => formChannels.includes(c.channelKey)).map((c) => c.id)
  );
  const visibleProducts = products.filter((p) => {
    if (formChannels.length === 0) return true;
    if (!p.boundChannelIds || p.boundChannelIds.length === 0) return true;
    return p.boundChannelIds.some((id) => selectedChannelAccountIds.has(id));
  });
  const visibleDiscounts = discounts.filter((d) => {
    if (formChannels.length === 0) return true;
    if (!d.boundChannelIds || d.boundChannelIds.length === 0) return true;
    return d.boundChannelIds.some((id) => selectedChannelAccountIds.has(id));
  });

  // Email Configuration
  const [formEmailChannelId, setFormEmailChannelId] = useState<string>("ech_sendgrid_live");
  const [formSenderEmail, setFormSenderEmail] = useState("billing@novaspay.global");
  const [formSenderName, setFormSenderName] = useState("Novas AI Billing Team");
  const [formEnabledEmailEvents, setFormEnabledEmailEvents] = useState<string[]>([
    ...EMAIL_TRIGGER_EVENT_IDS,
  ]);

  // Languages
  const [formSupportedLanguages, setFormSupportedLanguages] = useState<SupportedLanguage[]>([
    "en-US",
    "zh-CN",
    "ja-JP",
    "de-DE",
  ]);
  const [formDefaultLanguage, setFormDefaultLanguage] = useState<SupportedLanguage>("en-US");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleShowSecret = (id: string) => {
    setShowSecretMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCreateApp = () => {
    setEditingAppId(null);
    setCurrentStep(1);
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedCode = `APP-GLOBAL-${randSuffix}`;
    setFormName("");
    setFormCode(generatedCode);
    setFormTenantId(tenants[0]?.id || "bu_na_ecom");
    setFormDesc("");
    setFormEnv("Production");
    setFormCurrency("USD");
    setFormWebhookUrl("https://api.yourdomain.com/v1/webhooks/billing");
    setFormPublishableKey(`np_pub_live_${Math.random().toString(36).substring(2, 14)}`);
    setFormSecretKey(`np_sec_live_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`);
    setFormChannels(["stripe", "paypal", "apple_pay", "google_pay"]);
    setFormPaymentMethods(["credit_card", "paypal_wallet", "apple_pay", "google_pay"]);
    setFormRoutingStrategy("HIGHEST_SUCCESS_RATE");
    // Pre-select popular product codes
    setFormAssociatedProductCodes(products.slice(0, 3).map((p) => p.code));
    // Pre-select first discount
    setFormAssociatedDiscountCodes(discounts.slice(0, 2).map((d) => d.code));
    // Email settings
    setFormEmailChannelId(emailChannels[0]?.id || "ech_sendgrid_live");
    setFormSenderEmail("billing@yourdomain.com");
    setFormSenderName("Global Billing Operations");
    setFormEnabledEmailEvents([...EMAIL_TRIGGER_EVENT_IDS]);
    setFormSupportedLanguages(["en-US", "zh-CN", "ja-JP", "de-DE"]);
    setFormDefaultLanguage("en-US");
    setIsConfigModalOpen(true);
  };

  const handleOpenEditApp = (app: PaymentApp) => {
    setEditingAppId(app.id);
    setCurrentStep(1);
    setFormName(app.name);
    setFormCode(app.code);
    setFormTenantId((app.tenantId as string) || tenants[0]?.id || "bu_na_ecom");
    setFormDesc(app.description);
    setFormEnv(app.environment);
    setFormCurrency(app.defaultCurrency);
    setFormWebhookUrl(app.webhookUrl);
    setFormPublishableKey(app.publishableKey);
    setFormSecretKey(app.secretKey);
    setFormChannels(app.enabledChannels || ["stripe", "paypal"]);
    setFormPaymentMethods(app.enabledPaymentMethods || ["credit_card", "paypal_wallet"]);
    setFormRoutingStrategy(app.routingStrategy || "HIGHEST_SUCCESS_RATE");
    setFormAssociatedProductCodes(app.associatedProductCodes || []);
    setFormAssociatedDiscountCodes(app.associatedDiscountCodes || []);
    setFormEmailChannelId(app.emailChannelId || emailChannels[0]?.id || "ech_sendgrid_live");
    setFormSenderEmail(app.senderEmail || "billing@domain.com");
    setFormSenderName(app.senderName || "Billing Team");
    setFormEnabledEmailEvents(
      app.enabledEmailEvents?.length ? app.enabledEmailEvents : [...EMAIL_TRIGGER_EVENT_IDS]
    );
    setFormSupportedLanguages(app.supportedLanguages || ["en-US", "zh-CN"]);
    setFormDefaultLanguage(app.defaultLanguage || "en-US");
    setIsConfigModalOpen(true);
  };

  const handleRotateKey = (app: PaymentApp) => {
    const rotatedSec = `np_sec_live_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;
    const updated = { ...app, secretKey: rotatedSec };
    setAppList((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    showToast(t("apps:toast.secretRotated", { name: app.name }));
  };

  const handleToggleAppStatus = (app: PaymentApp) => {
    const updated: PaymentApp = {
      ...app,
      status: app.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
    };
    setAppList((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    showToast(
      t("apps:toast.statusChanged", {
        name: app.name,
        status: t(`apps:status.${updated.status}`),
      })
    );
  };

  const handleSaveAppConfiguration = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formName.trim()) {
      showToast(t("apps:toast.nameRequired"));
      setCurrentStep(1);
      return;
    }

    if (!formCode.trim()) {
      showToast(t("apps:toast.codeRequired"));
      setCurrentStep(1);
      return;
    }

    if (editingAppId) {
      const existing = appList.find((a) => a.id === editingAppId);
      if (!existing) return;
      const updatedApp: PaymentApp = {
        ...existing,
        name: formName.trim(),
        code: formCode.trim(),
        tenantId: formTenantId as any,
        description: formDesc.trim(),
        environment: formEnv,
        defaultCurrency: formCurrency,
        webhookUrl: formWebhookUrl.trim(),
        publishableKey: formPublishableKey,
        secretKey: formSecretKey,
        enabledChannels: formChannels,
        enabledPaymentMethods: formPaymentMethods,
        routingStrategy: formRoutingStrategy,
        associatedProductCodes: formAssociatedProductCodes,
        associatedDiscountCodes: formAssociatedDiscountCodes,
        emailChannelId: formEmailChannelId,
        senderEmail: formSenderEmail.trim(),
        senderName: formSenderName.trim(),
        enabledEmailEvents: formEnabledEmailEvents,
        supportedLanguages: formSupportedLanguages,
        defaultLanguage: formDefaultLanguage,
      };

      setAppList((prev) => prev.map((a) => (a.id === updatedApp.id ? updatedApp : a)));
      showToast(t("apps:toast.saved", { name: updatedApp.name }));
    } else {
      const newApp: PaymentApp = {
        id: `app_${formName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 16)}_${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        code: formCode.trim() || `APP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        tenantId: formTenantId as any,
        description: formDesc.trim() || "新接入的出海 SaaS 客户端应用",
        environment: formEnv,
        publishableKey: formPublishableKey,
        secretKey: formSecretKey,
        webhookUrl: formWebhookUrl.trim() || "https://api.yourdomain.com/webhooks",
        defaultCurrency: formCurrency,
        enabledChannels: formChannels,
        enabledPaymentMethods: formPaymentMethods,
        routingStrategy: formRoutingStrategy,
        associatedProductCodes: formAssociatedProductCodes,
        associatedDiscountCodes: formAssociatedDiscountCodes,
        emailChannelId: formEmailChannelId,
        senderEmail: formSenderEmail.trim(),
        senderName: formSenderName.trim(),
        enabledEmailEvents: formEnabledEmailEvents,
        supportedLanguages: formSupportedLanguages,
        defaultLanguage: formDefaultLanguage,
        activeSubscribersCount: 0,
        totalGmv: 0,
        status: "ACTIVE",
        createdAt: new Date().toISOString().split("T")[0],
      };

      setAppList([newApp, ...appList]);
      showToast(t("apps:toast.created", { name: newApp.name }));
    }

    setIsConfigModalOpen(false);
  };

  const totalAppGmv = appList.reduce((acc, a) => acc + (a.totalGmv || 0), 0);
  const totalSubscribers = appList.reduce((acc, a) => acc + (a.activeSubscribersCount || 0), 0);

  const handleExport = () => {
    exportToCSV(
      t("apps:exportFilename"),
      t("apps:exportHeaders", { returnObjects: true }) as string[],
      appList.map((a) => [
        a.id, a.name, a.code, a.environment, a.defaultCurrency,
        a.activeSubscribersCount, a.totalGmv, a.status, a.createdAt,
      ])
    );
  };

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

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("apps:title")}</h1>
          </div>
          <p
            className="text-xs text-fg-secondary mt-1 max-w-2xl"
            dangerouslySetInnerHTML={{ __html: t("apps:subtitle") }}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="px-3.5 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("apps:exportCsv")}</span>
          </button>
          <button
            onClick={handleOpenCreateApp}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("apps:addApp")}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("apps:metrics.connectedApps")}</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {appList.length}{" "}
            <span className="text-xs font-normal text-fg-tertiary">{t("apps:metrics.appCountUnit")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {t("apps:metrics.activeApps", {
              count: appList.filter((a) => a.status === "ACTIVE").length,
            })}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("apps:metrics.totalGmv")}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {formatCurrency(totalAppGmv, "USD")}
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("apps:metrics.gmvHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("apps:metrics.subscribers")}</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {totalSubscribers.toLocaleString()}{" "}
            <span className="text-xs font-normal text-fg-tertiary">{t("apps:metrics.subscriberCountUnit")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("apps:metrics.subscriberHint")}</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>{t("apps:metrics.languages")}</span>
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            6 <span className="text-xs font-normal text-fg-tertiary">{t("apps:metrics.languageCount")}</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">{t("apps:metrics.languageHint")}</div>
        </div>
      </div>

      {/* App Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {paginate<PaymentApp>(appList, currentPage, pageSize).map((app) => {
          const isSecretVisible = showSecretMap[app.id];
          const tenantInfo = tenants.find((t) => t.id === app.tenantId);

          return (
            <div
              key={app.id}
              className="bg-surface border border-line/80 hover:border-line rounded-2xl p-4 shadow-card transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-fg text-sm">{app.name}</h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {app.environment}
                      </span>
                      {app.status === "PAUSED" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {t("apps:metrics.paused")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fg-secondary mt-1 line-clamp-1">{app.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-fg-tertiary">
                        Code: <strong className="text-fg-secondary">{app.code}</strong>
                      </span>
                      {tenantInfo && (
                        <span className="text-[10px] bg-hover text-fg-secondary px-1.5 py-0.5 rounded">
                          {tenantInfo.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-fg-tertiary block">{t("apps:metrics.cumulativeGmv")}</span>
                    <span className="font-mono font-bold text-sm text-fg">
                      {formatCurrency(app.totalGmv, app.defaultCurrency || "USD")}
                    </span>
                  </div>
                </div>

                {/* API Credentials Box */}
                <div className="bg-subtle rounded-xl p-3 border border-line/70 space-y-2 text-xs font-mono">
                  {/* Publishable Key */}
                  <div>
                    <span className="text-[10px] text-fg-tertiary block font-sans">
                      {t("apps:card.publishableKey")}
                    </span>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">{app.publishableKey}</span>
                      <button
                        onClick={() => copyText(app.publishableKey, `${app.id}_pub`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2"
                        title={t("apps:card.copyPublishable")}
                      >
                        {copiedKey === `${app.id}_pub` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Secret Key */}
                  <div className="pt-2 border-t border-line/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-fg-tertiary font-sans">
                        {t("apps:card.secretKey")}
                      </span>
                      <button
                        onClick={() => toggleShowSecret(app.id)}
                        className="text-fg-tertiary hover:text-fg-secondary text-[10px] flex items-center gap-1 font-sans"
                      >
                        {isSecretVisible ? (
                          <>
                            <EyeOff className="w-3 h-3" /> {t("apps:card.hide")}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> {t("apps:card.show")}
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">
                        {isSecretVisible
                          ? app.secretKey
                          : "np_sec_••••••••••••••••••••••••••••••••"}
                      </span>
                      <span
                        className="text-[9px] text-rose-400 font-sans ml-2 shrink-0"
                        title={t("apps:card.copyForbiddenTitle")}
                      >
                        {t("apps:card.copyForbidden")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Module Configuration Badges */}
                <div className="space-y-2 text-xs">
                  {/* Channels & Payment Methods */}
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-blue-500" /> {t("apps:card.channelsMethods")}
                    </span>
                    {app.enabledChannels?.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] uppercase font-bold"
                      >
                        {c}
                      </span>
                    ))}
                    {app.enabledPaymentMethods && (
                      <span className="text-[10px] text-fg-secondary bg-hover px-1.5 py-0.5 rounded font-mono">
                        {t("apps:card.paymentMethodsCount", { count: app.enabledPaymentMethods.length })}
                      </span>
                    )}
                  </div>

                  {/* Associated Products & Coupons */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <Package className="w-3 h-3 text-emerald-500" /> {t("apps:card.products")}
                    </span>
                    <span className="text-fg-secondary font-medium">
                      {app.associatedProductCodes && app.associatedProductCodes.length > 0 ? (
                        t("apps:card.productsSelected", { count: app.associatedProductCodes.length })
                      ) : (
                        <span className="text-fg-tertiary">{t("apps:card.productsAll")}</span>
                      )}
                    </span>

                    <span className="text-zinc-300">|</span>

                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-500" /> {t("apps:card.discounts")}
                    </span>
                    <span className="text-fg-secondary font-mono text-[10px]">
                      {app.associatedDiscountCodes && app.associatedDiscountCodes.length > 0
                        ? app.associatedDiscountCodes.join(", ")
                        : t("apps:card.discountsAll")}
                    </span>
                  </div>

                  {/* Email & Language */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-fg-secondary">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{app.senderEmail || t("apps:card.emailUnbound")}</span>
                      {app.enabledEmailEvents && (
                        <span className="text-[10px] text-fg-tertiary font-mono">
                          {t("apps:card.emailEventsCount", { count: app.enabledEmailEvents.length })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Languages className="w-3.5 h-3.5 text-fg-tertiary" />
                      <div className="flex items-center gap-0.5">
                        {app.supportedLanguages?.map((lang) => {
                          const item = AVAILABLE_LANGUAGES.find((l) => l.code === lang);
                          return (
                            <span key={lang} title={item?.label} className="text-xs">
                              {item?.flag || "🌐"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-line-subtle flex items-center justify-between text-xs">
                <span className="text-fg-tertiary text-[11px]">
                  {t("apps:card.createdAt", { date: app.createdAt })}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingDetailApp(app)}
                    className="px-2.5 py-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg font-medium transition-colors"
                  >
                    {t("apps:card.configOverview")}
                  </button>

                  <button
                    onClick={() => handleOpenEditApp(app)}
                    className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>{t("apps:card.editConfig")}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalItems={appList.length} pageSize={pageSize} onPageChange={setCurrentPage} />

      {/* Comprehensive Application Wizard SideSheet */}
      {isConfigModalOpen && (
        <SideSheet
          id="side-sheet-app-config"
          isOpen={true}
          onClose={() => setIsConfigModalOpen(false)}
          title={
            editingAppId
              ? t("apps:wizard.editTitle", { name: formName || t("common:labels.name") })
              : t("apps:wizard.createTitle")
          }
          description={t("apps:wizard.description")}
          icon={<Layers className="w-5 h-5 text-indigo-600" />}
          widthClass="max-w-4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                    className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-xl font-medium flex items-center gap-1 hover:bg-subtle text-xs cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t("apps:wizard.prev")}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-xl font-medium hover:bg-subtle text-xs transition-colors cursor-pointer"
                >
                  {t("apps:wizard.cancel")}
                </button>

                {editingAppId && currentStep < 6 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveAppConfiguration();
                    }}
                    className="px-3.5 py-1.5 bg-hover hover:bg-hover text-fg rounded-xl font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                    title={t("apps:wizard.saveQuickTitle")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t("apps:wizard.saveQuick")}</span>
                  </button>
                )}

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (currentStep === 1) {
                        if (!formName.trim()) {
                          showToast(t("apps:toast.nameRequired"));
                          return;
                        }
                        if (!formCode.trim()) {
                          showToast(t("apps:toast.codeRequired"));
                          return;
                        }
                      }
                      setCurrentStep((prev) => Math.min(6, prev + 1));
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1 text-xs shadow-card cursor-pointer transition-colors"
                  >
                    <span>{t("apps:wizard.next")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveAppConfiguration();
                    }}
                    className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-card cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{editingAppId ? t("apps:wizard.saveUpdate") : t("apps:wizard.finishCreate")}</span>
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Step Wizard Navigator */}
            <div className="pb-3 border-b border-line-subtle flex items-center justify-between overflow-x-auto gap-2 text-xs">
              {wizardSteps.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.step;
                const isPassed = currentStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setCurrentStep(s.step)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors text-xs cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-card"
                        : isPassed
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-subtle text-fg-secondary hover:bg-hover"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="text-xs space-y-4">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">
                        {t("apps:wizard.basic.nameLabel")} <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t("apps:wizard.basic.namePlaceholder")}
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg focus:bg-surface text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">
                        {t("apps:wizard.basic.codeLabel")} <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t("apps:wizard.basic.codePlaceholder")}
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg focus:bg-surface text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">{t("apps:wizard.basic.tenantLabel")}</label>
                      <ShadcnSelect
                        value={formTenantId}
                        onValueChange={(val) => setFormTenantId(val)}
                        options={tenants.map((t) => ({
                          value: t.id,
                          label: `${t.name} (${t.code})`,
                        }))}
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">{t("apps:wizard.basic.envLabel")}</label>
                      <ShadcnSelect
                        value={formEnv}
                        onValueChange={(val) => setFormEnv(val as any)}
                        options={[
                          { value: "Production", label: t("apps:wizard.basic.envProduction") },
                          { value: "Staging", label: t("apps:wizard.basic.envStaging") },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">{t("apps:wizard.basic.currencyLabel")}</label>
                      <ShadcnSelect
                        value={formCurrency}
                        onValueChange={(val) => setFormCurrency(val)}
                        options={[
                          { value: "USD", label: t("apps:wizard.basic.currencyUSD") },
                          { value: "EUR", label: t("apps:wizard.basic.currencyEUR") },
                          { value: "JPY", label: t("apps:wizard.basic.currencyJPY") },
                          { value: "GBP", label: t("apps:wizard.basic.currencyGBP") },
                          { value: "CAD", label: t("apps:wizard.basic.currencyCAD") },
                          { value: "AUD", label: t("apps:wizard.basic.currencyAUD") },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold">{t("apps:wizard.basic.descLabel")}</label>
                    <textarea
                      rows={2}
                      placeholder={t("apps:wizard.basic.descPlaceholder")}
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold">
                      {t("apps:wizard.basic.webhookLabel")}
                    </label>
                    <input
                      type="url"
                      placeholder={t("apps:wizard.basic.webhookPlaceholder")}
                      value={formWebhookUrl}
                      onChange={(e) => setFormWebhookUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg text-xs"
                    />
                    <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                      {t("apps:wizard.basic.webhookHint")}
                    </span>
                  </div>

                  {/* Generated API Keys Preview */}
                  <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2 font-mono text-xs">
                    <div className="text-[11px] font-sans font-bold text-fg-secondary flex items-center justify-between">
                      <span>{t("apps:wizard.basic.apiCredentials")}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSecretKey(`np_sec_live_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`);
                          showToast(t("apps:toast.secretRegenerated"));
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-medium flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> {t("apps:wizard.basic.regenerateKey")}
                      </button>
                    </div>
                    <div>
                      <span className="text-[10px] text-fg-tertiary block font-sans">{t("apps:wizard.basic.publishableKeyLabel")}</span>
                      <span className="text-fg break-all">{formPublishableKey}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-fg-tertiary block font-sans">{t("apps:wizard.basic.secretKeyLabel")}</span>
                      <span className="text-fg break-all">{formSecretKey}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment Gateways & Methods */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Gateways */}
                  <div>
                    <label className="text-fg block mb-1.5 font-semibold text-xs">
                      {t("apps:wizard.channels.gatewaysLabel")}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {AVAILABLE_PAYMENT_CHANNELS.map((ch) => {
                        const isChecked = formChannels.includes(ch.key);
                        return (
                          <label
                            key={ch.key}
                            className={`flex items-start gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200"
                                : "bg-surface border-line hover:bg-subtle"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormChannels([...formChannels, ch.key]);
                                } else {
                                  setFormChannels(formChannels.filter((c) => c !== ch.key));
                                }
                              }}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-fg text-xs">
                                <span>{ch.icon}</span>
                                <span>{ch.label}</span>
                              </div>
                              <p className="text-[11px] text-fg-secondary mt-0.5 leading-snug">{ch.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-1.5 font-semibold text-xs">
                      {t("apps:wizard.channels.methodsLabel")}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PAYMENT_METHODS.map((pm) => {
                        const isChecked = formPaymentMethods.includes(pm.id);
                        return (
                          <label
                            key={pm.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                              isChecked
                                ? "bg-blue-50/50 border-blue-300 text-fg font-medium"
                                : "bg-subtle border-line text-fg-secondary"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormPaymentMethods([...formPaymentMethods, pm.id]);
                                } else {
                                  setFormPaymentMethods(formPaymentMethods.filter((m) => m !== pm.id));
                                }
                              }}
                              className="rounded text-blue-600"
                            />
                            <div className="flex-1">
                              <div>{pm.name}</div>
                              <span className="text-[10px] text-fg-tertiary">{t("apps:wizard.channels.carrierPrefix")} {pm.channelCategory}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Routing Strategy */}
                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-1 font-semibold text-xs">
                      {t("apps:wizard.channels.routingLabel")}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {routingStrategies.map((strat) => (
                        <label
                          key={strat.key}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer ${
                            formRoutingStrategy === strat.key
                              ? "bg-primary text-primary-foreground border-primary font-medium"
                              : "bg-subtle border-line text-fg-secondary hover:bg-hover"
                          }`}
                        >
                          <input
                            type="radio"
                            name="routing_strategy"
                            checked={formRoutingStrategy === strat.key}
                            onChange={() => setFormRoutingStrategy(strat.key as any)}
                            className="sr-only"
                          />
                          <div className="font-bold">{strat.title}</div>
                          <p
                            className={`text-[10px] mt-1 ${
                              formRoutingStrategy === strat.key ? "text-zinc-300" : "text-fg-tertiary"
                            }`}
                          >
                            {strat.desc}
                          </p>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Associated Products (Multi-Currency SKUs) */}
              {currentStep === 3 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-fg text-xs">{t("apps:wizard.products.title")}</h4>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">{t("apps:wizard.products.hint")}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormAssociatedProductCodes(products.map((p) => p.code))}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        {t("apps:wizard.products.selectAll", { count: products.length })}
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormAssociatedProductCodes([])}
                        className="text-xs text-fg-tertiary hover:underline"
                      >
                        {t("common:actions.clear")}
                      </button>
                    </div>
                  </div>

                  <div className="bg-subtle rounded-xl border border-line max-h-64 overflow-y-auto divide-y divide-line">
                    {visibleProducts.map((p) => {
                      const isChecked = formAssociatedProductCodes.includes(p.code);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-surface transition-colors ${
                            isChecked ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormAssociatedProductCodes([...formAssociatedProductCodes, p.code]);
                                } else {
                                  setFormAssociatedProductCodes(
                                    formAssociatedProductCodes.filter((c) => c !== p.code)
                                  );
                                }
                              }}
                              className="rounded text-indigo-600"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-fg text-xs">{p.code}</span>
                                <span className="text-[10px] bg-hover text-fg-secondary px-1 rounded font-mono font-bold">
                                  {p.currency || "USD"}
                                </span>
                              </div>
                              <div className="text-[11px] text-fg-secondary mt-0.5">{p.name}</div>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <div className="font-bold text-fg text-xs">
                              {formatCurrency(p.price, p.currency || "USD")}
                            </div>
                            <span className="text-[10px] text-fg-tertiary">
                              {p.billingInterval === "MONTHLY"
                                ? t("apps:wizard.products.billingMonthly")
                                : p.billingInterval === "YEARLY"
                                ? t("apps:wizard.products.billingYearly")
                                : t("apps:wizard.products.billingOneTime")}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="p-2.5 bg-hover rounded-lg text-fg-secondary text-[11px] flex items-center justify-between">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: t("apps:wizard.products.selectedSummary", {
                          count: formAssociatedProductCodes.length,
                        }),
                      }}
                    />
                    <span className="text-fg-tertiary font-mono">
                      {t("apps:wizard.products.currencyCoverage", {
                        count: Array.from(
                          new Set(
                            visibleProducts
                              .filter((p) => formAssociatedProductCodes.includes(p.code))
                              .map((p) => p.currency || "USD")
                          )
                        ).length,
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 4: Discounts & Coupons */}
              {currentStep === 4 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-fg text-xs">{t("apps:wizard.discounts.title")}</h4>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">{t("apps:wizard.discounts.hint")}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormAssociatedDiscountCodes(discounts.map((d) => d.code))}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      {t("apps:wizard.discounts.linkAll", { count: discounts.length })}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {visibleDiscounts.map((d) => {
                      const isChecked = formAssociatedDiscountCodes.includes(d.code);
                      return (
                        <label
                          key={d.id}
                          className={`p-3 rounded-xl border flex items-start justify-between cursor-pointer transition-all ${
                            isChecked
                              ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-200"
                              : "bg-surface border-line hover:bg-subtle"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormAssociatedDiscountCodes([...formAssociatedDiscountCodes, d.code]);
                                } else {
                                  setFormAssociatedDiscountCodes(
                                    formAssociatedDiscountCodes.filter((c) => c !== d.code)
                                  );
                                }
                              }}
                              className="mt-0.5 rounded text-amber-600"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-mono font-bold text-fg text-xs">
                                <Tag className="w-3.5 h-3.5 text-amber-500" />
                                <span>{d.code}</span>
                              </div>
                              <div className="text-[11px] text-fg-secondary mt-0.5">{d.name}</div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {d.type === "PERCENTAGE" ? `${d.value}% OFF` : `-$${d.value}`}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 5: Email Gateway & Notification Events */}
              {currentStep === 5 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        {t("apps:wizard.email.channelLabel")}
                      </label>
                      <ShadcnSelect
                        value={formEmailChannelId}
                        onValueChange={(val) => setFormEmailChannelId(val)}
                        options={emailChannels.map((ech) => ({
                          value: ech.id,
                          label: `${ech.name} (${ech.providerKey.toUpperCase()} - ${ech.verifiedDomain})`,
                        }))}
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        {t("apps:wizard.email.senderNameLabel")}
                      </label>
                      <input
                        type="text"
                        placeholder={t("apps:wizard.email.senderNamePlaceholder")}
                        value={formSenderName}
                        onChange={(e) => setFormSenderName(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                      {t("apps:wizard.email.senderEmailLabel")}
                    </label>
                    <input
                      type="email"
                      placeholder={t("apps:wizard.email.senderEmailPlaceholder")}
                      value={formSenderEmail}
                      onChange={(e) => setFormSenderEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg text-xs"
                    />
                    <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                      {t("apps:wizard.email.senderEmailHint")}
                    </span>
                  </div>

                  {/* Lifecycle Email Events */}
                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-2 font-semibold text-xs">
                      {t("apps:wizard.email.triggersLabel")}
                    </label>
                    <div className="space-y-2">
                      {EMAIL_TRIGGER_EVENT_IDS.map((evtId) => {
                        const isChecked = formEnabledEmailEvents.includes(evtId);
                        return (
                          <label
                            key={evtId}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              isChecked ? "bg-indigo-50/40 border-indigo-200" : "bg-subtle border-line"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormEnabledEmailEvents([...formEnabledEmailEvents, evtId]);
                                } else {
                                  setFormEnabledEmailEvents(
                                    formEnabledEmailEvents.filter((id) => id !== evtId)
                                  );
                                }
                              }}
                              className="mt-0.5 rounded text-indigo-600"
                            />
                            <div>
                              <div className="font-semibold text-fg">
                                {t(`apps:wizard.email.events.${evtId}.label`)}
                              </div>
                              <div className="text-[10px] text-fg-tertiary mt-0.5">
                                {t(`apps:wizard.email.events.${evtId}.desc`)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Supported Languages & Localization */}
              {currentStep === 6 && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="text-fg block mb-1 font-semibold text-xs">
                      {t("apps:wizard.languages.defaultLabel")}
                    </label>
                    <ShadcnSelect
                      value={formDefaultLanguage}
                      onValueChange={(val) => setFormDefaultLanguage(val as any)}
                      options={AVAILABLE_LANGUAGES.map((l) => ({
                        value: l.code,
                        label: `${l.flag} ${l.label} (${l.code})`,
                      }))}
                    />
                    <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                      {t("apps:wizard.languages.defaultHint")}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-2 font-semibold text-xs">
                      {t("apps:wizard.languages.supportedLabel")}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {AVAILABLE_LANGUAGES.map((l) => {
                        const isChecked = formSupportedLanguages.includes(l.code);
                        return (
                          <label
                            key={l.code}
                            className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200 font-medium text-fg"
                                : "bg-surface border-line text-fg-secondary hover:bg-subtle"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormSupportedLanguages([...formSupportedLanguages, l.code]);
                                } else {
                                  if (formSupportedLanguages.length <= 1) {
                                    showToast(t("apps:toast.minLanguageRequired"));
                                    return;
                                  }
                                  setFormSupportedLanguages(
                                    formSupportedLanguages.filter((c) => c !== l.code)
                                  );
                                }
                              }}
                              className="rounded text-indigo-600"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{l.flag}</span>
                              <div>
                                <div className="font-bold text-xs text-fg">{l.label}</div>
                                <span className="text-[10px] text-fg-tertiary font-mono">{l.code}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 bg-subtle border border-line rounded-xl text-fg-secondary text-[11px] leading-relaxed">
                    {t("apps:wizard.languages.linkHint")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SideSheet>
      )}

      {/* Detail SideSheet (View Full Configuration) */}
      {viewingDetailApp && (
        <SideSheet
          id="side-sheet-app-detail"
          isOpen={true}
          onClose={() => setViewingDetailApp(null)}
          title={viewingDetailApp.name}
          description={t("apps:detail.codeEnv", {
            code: viewingDetailApp.code,
            env: viewingDetailApp.environment,
          })}
          icon={<Layers className="w-5 h-5 text-indigo-600" />}
          widthClass="max-w-lg"
          footer={
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => {
                  const target = viewingDetailApp;
                  setViewingDetailApp(null);
                  handleOpenEditApp(target);
                }}
                className="flex-1 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-card"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t("apps:detail.editConfig")}</span>
              </button>
              <button
                onClick={() => handleToggleAppStatus(viewingDetailApp)}
                className="px-3.5 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-xl font-medium text-xs cursor-pointer"
              >
                {viewingDetailApp.status === "ACTIVE" ? t("apps:detail.pauseBilling") : t("apps:detail.resumeBilling")}
              </button>
              <button
                onClick={() => handleRotateKey(viewingDetailApp)}
                className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-medium text-xs cursor-pointer"
                title={t("apps:detail.rotateKeyTitle")}
              >
                {t("apps:detail.rotateKey")}
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* 1. Basic Info */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center justify-between">
                <span>{t("apps:detail.basicParams")}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                  {viewingDetailApp.environment}
                </span>
              </div>
              <div className="text-[11px] text-fg-secondary">{viewingDetailApp.description}</div>
              <div className="pt-2 border-t border-line/60 font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-fg-tertiary">{t("apps:detail.defaultCurrency")} </span>
                  <strong className="text-fg">{viewingDetailApp.defaultCurrency}</strong>
                </div>
                <div>
                  <span className="text-fg-tertiary">Webhook: </span>
                  <span className="text-fg break-all">{viewingDetailApp.webhookUrl}</span>
                </div>
              </div>
            </div>

            {/* 2. Gateways & Methods */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                  {t("apps:detail.gatewaysTitle")}
                </span>
                <span className="text-[10px] font-mono text-fg-tertiary font-normal">
                  {t("apps:detail.gatewaysEnabled", {
                    count: (viewingDetailApp.enabledChannels || []).length,
                  })}
                </span>
              </div>
              {viewingDetailApp.enabledChannels && viewingDetailApp.enabledChannels.length > 0 ? (
                <div className="space-y-1.5">
                  {viewingDetailApp.enabledChannels.map((c) => {
                    const cfg = (paymentChannels || []).find((ch) => ch.channelKey === (c as PaymentChannelConfig["channelKey"]));
                    return (
                      <div
                        key={c}
                        className="bg-surface rounded-lg border border-line/80 px-2.5 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-fg uppercase text-[10px] font-mono leading-tight">
                            {c}
                          </div>
                          <div className="text-[11px] text-fg-secondary truncate">
                            {cfg ? cfg.name : t("apps:detail.channelNotConnected")}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {cfg ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-hover text-fg-secondary">
                                {cfg.mode}
                              </span>
                              <span
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-semibold max-w-[120px] truncate"
                                title={cfg.accountName || cfg.name}
                              >
                                {cfg.accountName || t("apps:detail.defaultAccount")}
                              </span>
                            </>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[9px] font-semibold">
                              {t("apps:detail.notConnected")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-fg-tertiary">{t("apps:detail.noChannels")}</div>
              )}
              <div className="text-[11px] text-fg-secondary pt-1">
                {t("apps:detail.routingStrategy")}{" "}
                <strong>{viewingDetailApp.routingStrategy || "HIGHEST_SUCCESS_RATE"}</strong>
              </div>
            </div>

            {/* 3. Associated Products */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {t("apps:detail.productsTitle", {
                    count: viewingDetailApp.associatedProductCodes?.length || 0,
                  })}
                </span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-[11px]">
                {viewingDetailApp.associatedProductCodes && viewingDetailApp.associatedProductCodes.length > 0 ? (
                  viewingDetailApp.associatedProductCodes.map((code) => {
                    const prod = products.find((p) => p.code === code);
                    return (
                      <div
                        key={code}
                        className="bg-surface p-1.5 rounded border border-line/80 flex items-center justify-between"
                      >
                        <span className="text-fg font-bold">{code}</span>
                        <span className="text-emerald-600 font-semibold">
                          {prod ? formatCurrency(prod.price, prod.currency || "USD") : ""}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-fg-tertiary font-sans text-xs">{t("apps:detail.productsAll")}</span>
                )}
              </div>
            </div>

            {/* 4. Discounts */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>{t("apps:detail.discountsTitle")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {viewingDetailApp.associatedDiscountCodes && viewingDetailApp.associatedDiscountCodes.length > 0 ? (
                  viewingDetailApp.associatedDiscountCodes.map((code) => (
                    <span key={code} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-fg-tertiary font-sans text-xs">{t("apps:detail.discountsAll")}</span>
                )}
              </div>
            </div>

            {/* 5. Email & Notification */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t("apps:detail.emailTitle")}</span>
              </div>
              <div className="text-[11px] text-fg-secondary">
                {t("apps:detail.senderEmail")}{" "}
                <strong>{viewingDetailApp.senderEmail || "billing@domain.com"}</strong>
              </div>
              <div className="text-[11px] text-fg-secondary">
                {t("apps:detail.emailChannel")}{" "}
                {viewingDetailApp.emailChannelId || t("apps:detail.defaultChannel")}
              </div>
              <div className="pt-1 flex flex-wrap gap-1 text-[10px]">
                {viewingDetailApp.enabledEmailEvents?.map((evt) => (
                  <span key={evt} className="bg-hover text-fg-secondary px-1.5 py-0.5 rounded">
                    {t(`apps:wizard.email.events.${evt}.label`, { defaultValue: evt })}
                  </span>
                ))}
              </div>
            </div>

            {/* 6. Languages */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-fg-secondary" />
                <span>{t("apps:detail.languagesTitle")}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {viewingDetailApp.supportedLanguages?.map((lang) => {
                  const item = AVAILABLE_LANGUAGES.find((l) => l.code === lang);
                  return (
                    <span
                      key={lang}
                      className="px-2 py-1 bg-surface border border-line rounded-lg flex items-center gap-1.5 text-fg font-medium"
                    >
                      <span>{item?.flag}</span>
                      <span>{item?.label}</span>
                      {viewingDetailApp.defaultLanguage === lang && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold">
                          {t("apps:detail.defaultBadge")}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </SideSheet>
      )}
    </div>
  );
};
