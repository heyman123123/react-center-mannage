import React, { useState, useEffect } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
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
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface ApplicationManagementViewProps {
  apps: PaymentApp[];
  paymentChannels?: PaymentChannelConfig[];
  emailChannels?: EmailChannelConfig[];
  products?: ProductConfig[];
  discounts?: DiscountConfig[];
  emailTemplates?: EmailTemplate[];
  tenants?: Tenant[];
  onUpdateApp?: (app: PaymentApp) => void;
  onSaveApp?: (app: PaymentApp) => void;
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

const EMAIL_TRIGGER_EVENTS = [
  { id: "subscription_welcome_receipt", label: "首次订阅欢迎与电子发票收据", desc: "客户成功付费拉起后立即发送" },
  { id: "recurring_renewal_success", label: "周期性自动续订扣款凭据", desc: "每月/每年到期扣款成功自动送达" },
  { id: "payment_failed_dunning", label: "扣款失败催付与重试挽留 (Dunning)", desc: "触发卡过期或余额不足时自动化催付" },
  { id: "subscription_canceled_notice", label: "退订确认与专属权益挽回", desc: "用户主动取消订阅时发送挽回方案" },
  { id: "security_password_reset", label: "账号密码重置与安全异地登录告警", desc: "触发终端用户账户安全事件时提醒" },
];

export const ApplicationManagementView: React.FC<ApplicationManagementViewProps> = ({
  apps,
  paymentChannels = [],
  emailChannels = [],
  products = [],
  discounts = [],
  emailTemplates = [],
  tenants = [],
  onUpdateApp,
  onSaveApp,
}) => {
  const [appList, setAppList] = useState<PaymentApp[]>(apps);

  useEffect(() => {
    setAppList(apps);
  }, [apps]);
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Email Configuration
  const [formEmailChannelId, setFormEmailChannelId] = useState<string>("ech_sendgrid_live");
  const [formSenderEmail, setFormSenderEmail] = useState("billing@novaspay.global");
  const [formSenderName, setFormSenderName] = useState("Novas AI Billing Team");
  const [formEnabledEmailEvents, setFormEnabledEmailEvents] = useState<string[]>([
    "subscription_welcome_receipt",
    "recurring_renewal_success",
    "payment_failed_dunning",
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
    setFormEnabledEmailEvents([
      "subscription_welcome_receipt",
      "recurring_renewal_success",
      "payment_failed_dunning",
    ]);
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
      app.enabledEmailEvents || [
        "subscription_welcome_receipt",
        "recurring_renewal_success",
      ]
    );
    setFormSupportedLanguages(app.supportedLanguages || ["en-US", "zh-CN"]);
    setFormDefaultLanguage(app.defaultLanguage || "en-US");
    setIsConfigModalOpen(true);
  };

  const handleRotateKey = (app: PaymentApp) => {
    const rotatedSec = `np_sec_live_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`;
    const updated = { ...app, secretKey: rotatedSec };
    setAppList((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    if (onUpdateApp) onUpdateApp(updated);
    if (onSaveApp) onSaveApp(updated);
    showToast(`已成功为应用【${app.name}】轮换生成全新 Backend Secret Key！`);
  };

  const handleToggleAppStatus = (app: PaymentApp) => {
    const updated: PaymentApp = {
      ...app,
      status: app.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
    };
    setAppList((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    if (onUpdateApp) onUpdateApp(updated);
    if (onSaveApp) onSaveApp(updated);
    showToast(`应用【${app.name}】状态已变更为: ${updated.status === "ACTIVE" ? "活跃运行" : "暂停收单"}`);
  };

  const handleSaveAppConfiguration = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formName.trim()) {
      showToast("请输入应用名称 (Application Name)");
      setCurrentStep(1);
      return;
    }

    if (!formCode.trim()) {
      showToast("请输入应用唯一标识 (App Code)");
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
      if (onUpdateApp) onUpdateApp(updatedApp);
      if (onSaveApp) onSaveApp(updatedApp);
      showToast(`应用【${updatedApp.name}】全套出海配置已成功保存！`);
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
      if (onSaveApp) onSaveApp(newApp);
      showToast(`新应用【${newApp.name}】已成功接入，通道与邮件服务已就绪！`);
    }

    setIsConfigModalOpen(false);
  };

  const totalAppGmv = appList.reduce((acc, a) => acc + (a.totalGmv || 0), 0);
  const totalSubscribers = appList.reduce((acc, a) => acc + (a.activeSubscribersCount || 0), 0);

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
            <h1 className="text-xl font-bold text-fg tracking-tight">
              接入应用全配置中枢 (Client Apps & Gateway Hub)
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            支持一站式同时配置出海应用所关联的<strong>支付渠道</strong>、<strong>支付方式</strong>、<strong>商品方案 (单币种SKU)</strong>、<strong>优惠券与折扣</strong>、<strong>出海邮件通道</strong>与<strong>多语言本地化</strong>。
          </p>
        </div>

        <button
          onClick={handleOpenCreateApp}
          className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>接入并完整配置新应用</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>已接入客户端应用</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {appList.length} <span className="text-xs font-normal text-fg-tertiary">个应用</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">
            {appList.filter((a) => a.status === "ACTIVE").length} 个应用正常收单运行中
          </div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>全应用累计清算 GMV</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {formatCurrency(totalAppGmv, "USD")}
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">包含 Stripe / PayPal / Adyen 全渠道</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>活跃出海订阅用户</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            {totalSubscribers.toLocaleString()} <span className="text-xs font-normal text-fg-tertiary">位订户</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">北美、西欧及亚太全球受众</div>
        </div>

        <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
          <div className="flex items-center justify-between text-fg-tertiary text-xs">
            <span>支持语言与国际化</span>
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-fg mt-1">
            6 <span className="text-xs font-normal text-fg-tertiary">大主流语系</span>
          </div>
          <div className="text-[11px] text-fg-secondary mt-0.5">收银台与邮件多语言统一字典联动</div>
        </div>
      </div>

      {/* App Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {appList.map((app) => {
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
                          已暂停收单
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
                    <span className="text-[10px] text-fg-tertiary block">累计 GMV</span>
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
                      Client Publishable Key (前端公钥)
                    </span>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">{app.publishableKey}</span>
                      <button
                        onClick={() => copyText(app.publishableKey, `${app.id}_pub`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2"
                        title="复制公钥"
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
                        Backend Secret Key (服务端私钥)
                      </span>
                      <button
                        onClick={() => toggleShowSecret(app.id)}
                        className="text-fg-tertiary hover:text-fg-secondary text-[10px] flex items-center gap-1 font-sans"
                      >
                        {isSecretVisible ? (
                          <>
                            <EyeOff className="w-3 h-3" /> 隐藏
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> 显示
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
                      <button
                        onClick={() => copyText(app.secretKey, `${app.id}_sec`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2"
                        title="复制私钥"
                      >
                        {copiedKey === `${app.id}_sec` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-Module Configuration Badges */}
                <div className="space-y-2 text-xs">
                  {/* Channels & Payment Methods */}
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-blue-500" /> 渠道/方式:
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
                        +{app.enabledPaymentMethods.length} 种支付方式
                      </span>
                    )}
                  </div>

                  {/* Associated Products & Coupons */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <Package className="w-3 h-3 text-emerald-500" /> 售卖商品:
                    </span>
                    <span className="text-fg-secondary font-medium">
                      {app.associatedProductCodes && app.associatedProductCodes.length > 0 ? (
                        <>已选 {app.associatedProductCodes.length} 款独立币种方案</>
                      ) : (
                        <span className="text-fg-tertiary">全部通用方案</span>
                      )}
                    </span>

                    <span className="text-zinc-300">|</span>

                    <span className="text-[10px] text-fg-tertiary font-semibold flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-500" /> 折扣优惠:
                    </span>
                    <span className="text-fg-secondary font-mono text-[10px]">
                      {app.associatedDiscountCodes && app.associatedDiscountCodes.length > 0
                        ? app.associatedDiscountCodes.join(", ")
                        : "全场可用"}
                    </span>
                  </div>

                  {/* Email & Language */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-fg-secondary">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{app.senderEmail || "未绑定邮件"}</span>
                      {app.enabledEmailEvents && (
                        <span className="text-[10px] text-fg-tertiary font-mono">
                          ({app.enabledEmailEvents.length} 个事件)
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
                <span className="text-fg-tertiary text-[11px]">创建于: {app.createdAt}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingDetailApp(app)}
                    className="px-2.5 py-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg font-medium transition-colors"
                  >
                    配置概览
                  </button>

                  <button
                    onClick={() => handleOpenEditApp(app)}
                    className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>编辑应用配置</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprehensive Application Wizard SideSheet */}
      {isConfigModalOpen && (
        <SideSheet
          id="side-sheet-app-config"
          isOpen={true}
          onClose={() => setIsConfigModalOpen(false)}
          title={editingAppId ? `编辑出海应用配置: ${formName || "应用"}` : "接入出海新应用 (完整多模块配置)"}
          description="同时配置支付渠道、支付方式、单币种商品SKU、折扣码、出海发信与多语言"
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
                    <span>上一步</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-xl font-medium hover:bg-subtle text-xs transition-colors cursor-pointer"
                >
                  取消
                </button>

                {/* If in edit mode and not on the last step, allow quick saving right away */}
                {editingAppId && currentStep < 6 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveAppConfiguration();
                    }}
                    className="px-3.5 py-1.5 bg-hover hover:bg-hover text-fg rounded-xl font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                    title="快速保存当前所做修改"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>直接保存修改</span>
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
                          showToast("请输入应用名称 (Application Name)");
                          return;
                        }
                        if (!formCode.trim()) {
                          showToast("请输入应用唯一标识 (App Code)");
                          return;
                        }
                      }
                      setCurrentStep((prev) => Math.min(6, prev + 1));
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-1 text-xs shadow-card cursor-pointer transition-colors"
                  >
                    <span>下一步</span>
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
                    <span>{editingAppId ? "保存更新完整配置" : "完成接入并生成应用"}</span>
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Step Wizard Navigator */}
            <div className="pb-3 border-b border-line-subtle flex items-center justify-between overflow-x-auto gap-2 text-xs">
              {[
                { step: 1, label: "1. 基础信息", icon: Layers },
                { step: 2, label: "2. 渠道与方式", icon: CreditCard },
                { step: 3, label: "3. 关联商品", icon: Package },
                { step: 4, label: "4. 折扣与优惠券", icon: Tag },
                { step: 5, label: "5. 邮件与通知", icon: Mail },
                { step: 6, label: "6. 语言本地化", icon: Languages },
              ].map((s) => {
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
                        应用名称 (Application Name) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="如：Novas AI Writer & Copilot"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg focus:bg-surface text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">
                        唯一应用标识 (App Code) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="如：APP-AI-WRITER"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg focus:bg-surface text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">业务归属单元:</label>
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
                      <label className="text-fg-secondary block mb-1 font-semibold">运行环境:</label>
                      <ShadcnSelect
                        value={formEnv}
                        onValueChange={(val) => setFormEnv(val as any)}
                        options={[
                          { value: "Production", label: "Production (生产环境)" },
                          { value: "Staging", label: "Staging (沙箱测试)" },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold">默认基准结算货币:</label>
                      <ShadcnSelect
                        value={formCurrency}
                        onValueChange={(val) => setFormCurrency(val)}
                        options={[
                          { value: "USD", label: "USD - 美元 ($)" },
                          { value: "EUR", label: "EUR - 欧元 (€)" },
                          { value: "JPY", label: "JPY - 日元 (¥)" },
                          { value: "GBP", label: "GBP - 英镑 (£)" },
                          { value: "CAD", label: "CAD - 加元 (C$)" },
                          { value: "AUD", label: "AUD - 澳元 (A$)" },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold">应用定位描述:</label>
                    <textarea
                      rows={2}
                      placeholder="说明该出海客户端的业务类型、主要目标受众及出海运营重点..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold">
                      服务端 Webhook 业务回调地址 (Webhook URL):
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.yourdomain.com/v1/billing/webhooks"
                      value={formWebhookUrl}
                      onChange={(e) => setFormWebhookUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg text-xs"
                    />
                    <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                      中台在支付成功、续订扣款、退款及催付等生命周期事件触发时，将向该端点异步推送带有 HMAC 验签的通知
                    </span>
                  </div>

                  {/* Generated API Keys Preview */}
                  <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2 font-mono text-xs">
                    <div className="text-[11px] font-sans font-bold text-fg-secondary flex items-center justify-between">
                      <span>系统自动分配的专属 API 凭据</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSecretKey(`np_sec_live_${Math.random().toString(36).substring(2, 18)}${Math.random().toString(36).substring(2, 18)}`);
                          showToast("已重新生成新的 Secret Key！");
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-medium flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> 重新生成密钥
                      </button>
                    </div>
                    <div>
                      <span className="text-[10px] text-fg-tertiary block font-sans">Publishable Key:</span>
                      <span className="text-fg break-all">{formPublishableKey}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-fg-tertiary block font-sans">Secret Key:</span>
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
                      1. 启用的出海支付通道 (Payment Gateways):
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
                      2. 细分支付方式 (Payment Methods) 开放清单:
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
                              <span className="text-[10px] text-fg-tertiary">承载: {pm.channelCategory}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Routing Strategy */}
                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-1 font-semibold text-xs">
                      3. 智能路由与分流策略 (Routing Strategy):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          key: "HIGHEST_SUCCESS_RATE",
                          title: "最高成功率优先",
                          desc: "智能根据各网关实时 3DS / 拒付率动态择优路由",
                        },
                        {
                          key: "LOWEST_FEE",
                          title: "最低交易费率优先",
                          desc: "优先路由至通道收单费率最低的网关降低摩擦成本",
                        },
                        {
                          key: "PRIORITY_LIST",
                          title: "主备顺序容灾优先",
                          desc: "按预先设定优先级顺序排队，遇超时阻断时自动Failover",
                        },
                      ].map((strat) => (
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
                      <h4 className="font-semibold text-fg text-xs">
                        选择该应用上架售卖的商品方案 (单币种独立 SKU)
                      </h4>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">
                        根据每个商品在 USD、EUR、JPY、GBP 独立配置的代码直接上架，客户端拉起收银台时仅允许结算已选商品
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormAssociatedProductCodes(products.map((p) => p.code))}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        全选所有商品 ({products.length})
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormAssociatedProductCodes([])}
                        className="text-xs text-fg-tertiary hover:underline"
                      >
                        清空
                      </button>
                    </div>
                  </div>

                  <div className="bg-subtle rounded-xl border border-line max-h-64 overflow-y-auto divide-y divide-line">
                    {products.map((p) => {
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
                                ? "按月续订"
                                : p.billingInterval === "YEARLY"
                                ? "按年续费"
                                : "单次购买"}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="p-2.5 bg-hover rounded-lg text-fg-secondary text-[11px] flex items-center justify-between">
                    <span>
                      当前已为该应用勾选 <strong>{formAssociatedProductCodes.length}</strong> 款商品方案
                    </span>
                    <span className="text-fg-tertiary font-mono">
                      覆盖 {Array.from(new Set(products.filter((p) => formAssociatedProductCodes.includes(p.code)).map((p) => p.currency || "USD"))).length} 种货币
                    </span>
                  </div>
                </div>
              )}

              {/* Step 4: Discounts & Coupons */}
              {currentStep === 4 && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-fg text-xs">
                        关联允许在此应用收银台兑换的优惠券与折扣码
                      </h4>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">
                        绑定后，海外终端用户在该应用的前端 Checkout 页面输入指定 Code 可享受减免
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormAssociatedDiscountCodes(discounts.map((d) => d.code))}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      关联所有可用优惠券 ({discounts.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {discounts.map((d) => {
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
                              <p className="text-[10px] text-fg-tertiary mt-1">{d.description}</p>
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
                        绑定发信邮件渠道 (Email Channel):
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
                        发件人显示名称 (Sender Name):
                      </label>
                      <input
                        type="text"
                        placeholder="如：Novas AI Billing Operations"
                        value={formSenderName}
                        onChange={(e) => setFormSenderName(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                      发件人专属邮箱地址 (Sender Email):
                    </label>
                    <input
                      type="email"
                      placeholder="billing@yourbrand.global"
                      value={formSenderEmail}
                      onChange={(e) => setFormSenderEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-subtle border border-line rounded-lg font-mono text-fg text-xs"
                    />
                    <span className="text-[10px] text-fg-tertiary mt-0.5 block">
                      客户收到付款发票与系统通知时展示的 From 邮箱，需与 SPF/DKIM 认证域名一致
                    </span>
                  </div>

                  {/* Lifecycle Email Events */}
                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-2 font-semibold text-xs">
                      启用的生命周期业务邮件自动化事件 (Email Triggers):
                    </label>
                    <div className="space-y-2">
                      {EMAIL_TRIGGER_EVENTS.map((evt) => {
                        const isChecked = formEnabledEmailEvents.includes(evt.id);
                        return (
                          <label
                            key={evt.id}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              isChecked ? "bg-indigo-50/40 border-indigo-200" : "bg-subtle border-line"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormEnabledEmailEvents([...formEnabledEmailEvents, evt.id]);
                                } else {
                                  setFormEnabledEmailEvents(
                                    formEnabledEmailEvents.filter((id) => id !== evt.id)
                                  );
                                }
                              }}
                              className="mt-0.5 rounded text-indigo-600"
                            />
                            <div>
                              <div className="font-semibold text-fg">{evt.label}</div>
                              <div className="text-[10px] text-fg-tertiary mt-0.5">{evt.desc}</div>
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
                      1. 设定收银台与邮件默认基准语言 (Default Language):
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
                      当海外客户浏览器未匹配到特定语言时，默认呈现的基准国际化文案
                    </span>
                  </div>

                  <div className="pt-2 border-t border-line-subtle">
                    <label className="text-fg block mb-2 font-semibold text-xs">
                      2. 勾选面向海外市场开放的语种支持 (Supported Locales):
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
                                    showToast("至少需要保留一种支持语言");
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
                    💡 多语言将统一自动联动【多语言邮件模版】与【系统字典中心】中对应的 i18n 键值翻译，无需针对每个业务事件重复配置。
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
          description={`唯一代码: ${viewingDetailApp.code} | 运行环境: ${viewingDetailApp.environment}`}
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
                <span>编辑配置</span>
              </button>
              <button
                onClick={() => handleToggleAppStatus(viewingDetailApp)}
                className="px-3.5 py-2 border border-line hover:bg-subtle text-fg-secondary rounded-xl font-medium text-xs cursor-pointer"
              >
                {viewingDetailApp.status === "ACTIVE" ? "暂停收单" : "恢复上线"}
              </button>
              <button
                onClick={() => handleRotateKey(viewingDetailApp)}
                className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-medium text-xs cursor-pointer"
                title="重置刷新密钥"
              >
                轮换密钥
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* 1. Basic Info */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center justify-between">
                <span>基础运行参数</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                  {viewingDetailApp.environment}
                </span>
              </div>
              <div className="text-[11px] text-fg-secondary">{viewingDetailApp.description}</div>
              <div className="pt-2 border-t border-line/60 font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-fg-tertiary">默认货币: </span>
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
              <div className="font-bold text-fg flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                <span>支付通道与路由策略</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {viewingDetailApp.enabledChannels?.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase font-mono"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-fg-secondary pt-1">
                路由策略: <strong>{viewingDetailApp.routingStrategy || "HIGHEST_SUCCESS_RATE"}</strong>
              </div>
            </div>

            {/* 3. Associated Products */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-500" />
                <span>上架商品 SKU ({viewingDetailApp.associatedProductCodes?.length || 0})</span>
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
                  <span className="text-fg-tertiary font-sans text-xs">默认全量在售商品均可结算</span>
                )}
              </div>
            </div>

            {/* 4. Discounts */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>生效优惠券与促销码</span>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {viewingDetailApp.associatedDiscountCodes && viewingDetailApp.associatedDiscountCodes.length > 0 ? (
                  viewingDetailApp.associatedDiscountCodes.map((code) => (
                    <span key={code} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-fg-tertiary font-sans text-xs">全场折扣码均可兑换</span>
                )}
              </div>
            </div>

            {/* 5. Email & Notification */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-500" />
                <span>出海邮件服务</span>
              </div>
              <div className="text-[11px] text-fg-secondary">
                发件邮箱: <strong>{viewingDetailApp.senderEmail || "billing@domain.com"}</strong>
              </div>
              <div className="text-[11px] text-fg-secondary">
                发信通道: {viewingDetailApp.emailChannelId || "默认主通道"}
              </div>
              <div className="pt-1 flex flex-wrap gap-1 text-[10px]">
                {viewingDetailApp.enabledEmailEvents?.map((evt) => (
                  <span key={evt} className="bg-hover text-fg-secondary px-1.5 py-0.5 rounded font-mono">
                    {evt}
                  </span>
                ))}
              </div>
            </div>

            {/* 6. Languages */}
            <div className="bg-subtle rounded-xl p-3.5 border border-line space-y-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-fg-secondary" />
                <span>支持语言与默认基准</span>
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
                          默认
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
