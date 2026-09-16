import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Mail,
  Send,
  Eye,
  Edit3,
  CheckCircle2,
  Copy,
  Check,
  Languages,
  Sparkles,
  Laptop,
  Smartphone,
  Save,
  Search,
  BookOpen,
  Filter,
  Code,
  Plus,
  Trash2,
  CopyPlus,
  Power,
  AlertTriangle,
  X,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle,
  Tag,
  Globe,
  Layers,
  ExternalLink,
} from "lucide-react";
import { EmailTemplate, SupportedLanguage, DictionaryEntry, EmailCategory } from "../types/payment";
import { INITIAL_DICTIONARY } from "../data/mockData";
import { REACT_EMAIL_PRESETS } from "../data/emailTemplatesData";
import { ReactEmailRenderer } from "./ReactEmailRenderer";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { Popconfirm } from "./ui/Popconfirm";

interface EmailTemplatesViewProps {
  templates: EmailTemplate[];
  dictionary?: DictionaryEntry[];
  onSaveTemplate?: (template: EmailTemplate) => void;
  onDeleteTemplate?: (id: string) => void;
}

export const SUPPORTED_LANG_CONFIG: {
  code: SupportedLanguage;
  label: string;
  flag: string;
  nativeName: string;
}[] = [
  { code: "en-US", label: "English (US)", flag: "🇺🇸", nativeName: "English" },
  { code: "zh-CN", label: "简体中文 (zh-CN)", flag: "🇨🇳", nativeName: "简体中文" },
  { code: "ja-JP", label: "日本語 (ja-JP)", flag: "🇯🇵", nativeName: "日本語" },
  { code: "de-DE", label: "Deutsch (de-DE)", flag: "🇩🇪", nativeName: "Deutsch" },
  { code: "es-ES", label: "Español (es-ES)", flag: "🇪🇸", nativeName: "Español" },
  { code: "fr-FR", label: "Français (fr-FR)", flag: "🇫🇷", nativeName: "Français" },
];

const CATEGORY_STYLES: Record<EmailCategory, { bg: string; text: string; border: string }> = {
  BILLING: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  LIFECYCLE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  SECURITY: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  PROMOTION: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  SYSTEM: { bg: "bg-subtle", text: "text-fg-secondary", border: "border-line" },
  RISK: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const DYNAMIC_TAG_SAMPLES: { tag: string; key: string; sample: string }[] = [
  { tag: "{{customer_name}}", key: "customer_name", sample: "Alex Wright" },
  { tag: "{{app_name}}", key: "app_name", sample: "NovasAI Studio" },
  { tag: "{{plan_name}}", key: "plan_name", sample: "Enterprise Annual Plan" },
  { tag: "{{amount}}", key: "amount", sample: "199.00" },
  { tag: "{{currency}}", key: "currency", sample: "USD" },
  { tag: "{{order_id}}", key: "order_id", sample: "ord_live_890281" },
  { tag: "{{payment_method}}", key: "payment_method", sample: "Visa •••• 4242" },
  { tag: "{{billing_period}}", key: "billing_period", sample: "2026/09/01 - 2027/09/01" },
  { tag: "{{next_renewal_date}}", key: "next_renewal_date", sample: "2027-09-01" },
  { tag: "{{billing_portal_url}}", key: "billing_portal_url", sample: "https://billing.novaspay.global/portal" },
  { tag: "{{security_code}}", key: "security_code", sample: "849201" },
  { tag: "{{coupon_code}}", key: "coupon_code", sample: "VIP25OFF" },
  { tag: "{{discount_rate}}", key: "discount_rate", sample: "25" },
  { tag: "{{expiry_date}}", key: "expiry_date", sample: "2026-09-30" },
];

export const EmailTemplatesView: React.FC<EmailTemplatesViewProps> = ({
  templates,
  dictionary = INITIAL_DICTIONARY,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const { t } = useTranslation(["email", "common"]);

  const categoryMap = useMemo(
    () =>
      (Object.keys(CATEGORY_STYLES) as EmailCategory[]).reduce(
        (acc, code) => ({
          ...acc,
          [code]: {
            ...CATEGORY_STYLES[code],
            label: t(`templates.categories.${code}`),
          },
        }),
        {} as Record<EmailCategory, { label: string; bg: string; text: string; border: string }>
      ),
    [t]
  );

  const commonDynamicTags = useMemo(
    () =>
      DYNAMIC_TAG_SAMPLES.map((item) => ({
        tag: item.tag,
        label: t(`templates.dynamicTags.${item.key}`),
        sample: item.sample,
      })),
    [t]
  );

  const categoryOptionLabel = useCallback(
    (code: EmailCategory) =>
      t("templates.filters.categoryWithCode", {
        label: t(`templates.categories.${code}`),
        code,
      }),
    [t]
  );

  const editorCategoryOptions = useMemo(
    () =>
      (["BILLING", "LIFECYCLE", "SECURITY", "PROMOTION", "SYSTEM"] as EmailCategory[]).map((code) => ({
        value: code,
        label: categoryOptionLabel(code),
      })),
    [categoryOptionLabel]
  );

  const filterCategoryOptions = useMemo(
    () => [
      { value: "ALL", label: t("templates.filters.categoryAllFull") },
      ...editorCategoryOptions,
    ],
    [t, editorCategoryOptions]
  );

  const filterStatusOptions = useMemo(
    () => [
      { value: "ALL", label: t("templates.filters.statusAllFull") },
      { value: "ACTIVE", label: t("templates.filters.statusActiveFull") },
      { value: "DRAFT", label: t("templates.filters.statusDraftFull") },
      { value: "DISABLED", label: t("templates.filters.statusDisabledFull") },
    ],
    [t]
  );

  const editorStatusOptions = useMemo(
    () =>
      (["ACTIVE", "DRAFT", "DISABLED"] as const).map((status) => ({
        value: status,
        label: t(`templates.editorStatus.${status}`),
      })),
    [t]
  );

  const testSendChannelOptions = useMemo(
    () => [
      { value: "SENDGRID", label: t("templates.testSend.channelSendgrid") },
      { value: "AWS_SES", label: t("templates.testSend.channelAwsSes") },
      { value: "RESEND", label: t("templates.testSend.channelResend") },
    ],
    [t]
  );

  const [templateList, setTemplateList] = useState<EmailTemplate[]>(templates);
  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [searchQuery, langFilter, categoryFilter, statusFilter, reset]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [editingEmail, setEditingEmail] = useState<EmailTemplate | null>(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<EmailTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [cloningSourceEmail, setCloningSourceEmail] = useState<EmailTemplate | null>(null);
  const [cloneTargetLang, setCloneTargetLang] = useState<SupportedLanguage>("ja-JP");
  const [testSendingEmail, setTestSendingEmail] = useState<EmailTemplate | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState("admin@company.global");
  const [testSendChannel, setTestSendChannel] = useState<"SENDGRID" | "AWS_SES" | "RESEND">("SENDGRID");
  const [isSending, setIsSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{
    success: boolean;
    messageId: string;
    durationMs: number;
    log: string;
  } | null>(null);

  // Variable drawer in editor
  const [activeTabInEditor, setActiveTabInEditor] = useState<"EDIT" | "SPLIT_PREVIEW">("SPLIT_PREVIEW");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Filtered standalone emails
  const filteredEmails = templateList.filter((email) => {
    const matchesLang = langFilter === "ALL" || email.language === langFilter;
    const matchesCategory = categoryFilter === "ALL" || email.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || email.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      email.name.toLowerCase().includes(query) ||
      email.code.toLowerCase().includes(query) ||
      email.subject.toLowerCase().includes(query) ||
      email.senderEmail.toLowerCase().includes(query) ||
      email.contentMarkdown.toLowerCase().includes(query);

    return matchesLang && matchesCategory && matchesStatus && matchesSearch;
  });

  // Calculate stats
  const activeCount = templateList.filter((tmpl) => tmpl.status === "ACTIVE").length;
  const coveredLanguages: SupportedLanguage[] = Array.from(new Set(templateList.map((tmpl) => tmpl.language)));

  // Open Edit Modal for a single independent email
  const handleOpenEdit = (email: EmailTemplate) => {
    setEditingEmail({ ...email });
    setIsEditingModalOpen(true);
  };

  // Create new standalone email
  const handleOpenCreateNew = () => {
    const newId = `mail_${Date.now().toString().slice(-6)}`;
    const newEmail: EmailTemplate = {
      id: newId,
      code: `EMAIL_CUSTOM_${Date.now().toString().slice(-4)}`,
      name: "新建独立单一邮件",
      language: "en-US",
      languageLabel: "English (US)",
      category: "BILLING",
      description: "独立单一邮件实体，直接指定归属语言与独立模板文案",
      triggerEvent: "charge.succeeded",
      subject: "Important update regarding your {{app_name}} account",
      senderName: "NovasPay Notifications",
      senderEmail: "notify@novaspay.global",
      previewText: "Please find your latest transaction and account details enclosed.",
      contentMarkdown: `### Hi {{customer_name}},

This is a confirmation from **{{app_name}}**.

#### Summary
- **Plan:** {{plan_name}}
- **Amount:** \${{amount}} {{currency}}
- **Order ID:** {{order_id}}

You can manage your preferences anytime at: **[Customer Center]({{billing_portal_url}})**.

{{dict.support.contact_247}}

Best regards,  
The {{app_name}} Team`,
      status: "ACTIVE",
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      associatedTenantId: "ALL",
      variables: ["customer_name", "app_name", "plan_name", "amount", "currency", "order_id", "billing_portal_url"],
      dictReferences: ["support.contact_247"],
    };
    setEditingEmail(newEmail);
    setIsEditingModalOpen(true);
  };

  // Save standalone email
  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmail) return;

    const langObj = SUPPORTED_LANG_CONFIG.find((l) => l.code === editingEmail.language);
    const updated: EmailTemplate = {
      ...editingEmail,
      languageLabel: langObj ? `${langObj.nativeName} (${langObj.code})` : editingEmail.language,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    setTemplateList((prev) => {
      const exists = prev.some((tmpl) => tmpl.id === updated.id);
      return exists ? prev.map((tmpl) => (tmpl.id === updated.id ? updated : tmpl)) : [updated, ...prev];
    });

    if (onSaveTemplate) {
      onSaveTemplate(updated);
    }

    setIsEditingModalOpen(false);
    showToast(t("templates.toast.savedStandalone", { name: updated.name, language: updated.language }));
  };

  // Toggle single email active/disabled
  const handleToggleStatus = (email: EmailTemplate) => {
    const nextStatus = email.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const updated: EmailTemplate = {
      ...email,
      status: nextStatus,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    setTemplateList((prev) => prev.map((tmpl) => (tmpl.id === updated.id ? updated : tmpl)));
    if (onSaveTemplate) onSaveTemplate(updated);
    showToast(
      t("templates.toast.statusChanged", {
        name: email.name,
        status:
          nextStatus === "ACTIVE"
            ? t("templates.toast.statusActiveOnline")
            : t("templates.status.DISABLED"),
      })
    );
  };

  // Delete single email
  const handleDelete = (id: string, name: string) => {
    setTemplateList((prev) => prev.filter((tmpl) => tmpl.id !== id));
    if (onDeleteTemplate) onDeleteTemplate(id);
    showToast(t("templates.toast.removedStandalone", { name }));
  };

  // Execute clone to another language
  const handleExecuteClone = () => {
    if (!cloningSourceEmail) return;
    const targetLangObj = SUPPORTED_LANG_CONFIG.find((l) => l.code === cloneTargetLang);
    const langSuffix = cloneTargetLang.split("-")[0].toUpperCase();
    const clonedId = `mail_${cloningSourceEmail.code.toLowerCase()}_${cloneTargetLang.toLowerCase().replace("-", "_")}_${Date.now().toString().slice(-4)}`;
    
    // Suggest clean name based on target lang
    const clonedName = `${cloningSourceEmail.name.replace(/\(.*?\)/g, "").trim()} (${targetLangObj?.nativeName || cloneTargetLang})`;
    const clonedCode = `${cloningSourceEmail.code.replace(/_[A-Z]{2}$/, "")}_${langSuffix}`;

    const cloned: EmailTemplate = {
      ...cloningSourceEmail,
      id: clonedId,
      code: clonedCode,
      name: clonedName,
      language: cloneTargetLang,
      languageLabel: targetLangObj ? `${targetLangObj.nativeName} (${targetLangObj.code})` : cloneTargetLang,
      status: "DRAFT", // default to draft for review
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    setTemplateList((prev) => [cloned, ...prev]);
    if (onSaveTemplate) onSaveTemplate(cloned);
    setCloningSourceEmail(null);
    showToast(
      t("templates.toast.clonedStandalone", {
        sourceName: cloningSourceEmail.name,
        clonedName: cloned.name,
      })
    );
    // Automatically open for editing
    setEditingEmail(cloned);
    setIsEditingModalOpen(true);
  };

  // Execute test send
  const handleExecuteTestSend = () => {
    if (!testSendingEmail || !testEmailAddress) return;
    setIsSending(true);
    setTestSendResult(null);

    setTimeout(() => {
      setIsSending(false);
      const fakeMessageId = `<msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}@novaspay.global>`;
      setTestSendResult({
        success: true,
        messageId: fakeMessageId,
        durationMs: 342,
        log: `HTTP 202 Accepted. Channel [${testSendChannel}] dispatched. SPF/DKIM/DMARC PASS. Recipient: ${testEmailAddress}. Language: ${testSendingEmail.language}.`,
      });
      showToast(t("templates.toast.testSent", { email: testEmailAddress, durationMs: 342 }));
    }, 900);
  };

  const getLanguageMeta = (code: SupportedLanguage) => {
    return SUPPORTED_LANG_CONFIG.find((l) => l.code === code) || { code, label: code, flag: "🌐", nativeName: code };
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-card animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Languages className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-fg tracking-tight">{t("templates.pageTitle")}</h1>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">
                {t("templates.architectureBadge")}
              </span>
            </div>
            <p className="text-xs text-fg-secondary mt-1 max-w-3xl">
              {t("templates.pageSubtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenCreateNew}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("templates.createStandalone")}
            </button>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-line-subtle">
          <div className="bg-subtle/80 p-3 rounded-xl border border-line/60">
            <div className="text-[11px] text-fg-secondary font-medium flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-fg-tertiary" />
              {t("templates.kpi.totalEmails")}
            </div>
            <div className="text-lg font-bold text-fg mt-0.5">
              {templateList.length}{" "}
              <span className="text-xs font-normal text-fg-tertiary">{t("templates.kpi.totalUnit")}</span>
            </div>
          </div>

          <div className="bg-subtle/80 p-3 rounded-xl border border-line/60">
            <div className="text-[11px] text-fg-secondary font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              {t("templates.kpi.coveredLangs")}
            </div>
            <div className="text-lg font-bold text-fg mt-0.5 flex items-center gap-1.5">
              {coveredLanguages.length}{" "}
              <span className="text-xs text-fg-tertiary font-normal">{t("templates.kpi.targetMarkets")}</span>
              <div className="flex -space-x-1 ml-1">
                {coveredLanguages.slice(0, 5).map((l) => (
                  <span key={l} className="text-xs" title={l}>
                    {getLanguageMeta(l).flag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-subtle/80 p-3 rounded-xl border border-line/60">
            <div className="text-[11px] text-fg-secondary font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              {t("templates.kpi.activeOnline")}
            </div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              {activeCount}{" "}
              <span className="text-xs font-normal text-fg-tertiary">
                / {templateList.length} {t("templates.kpi.productionReady")}
              </span>
            </div>
          </div>

          <div className="bg-subtle/80 p-3 rounded-xl border border-line/60">
            <div className="text-[11px] text-fg-secondary font-medium flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-violet-500" />
              {t("templates.kpi.dictRefSharing")}
            </div>
            <div className="text-lg font-bold text-violet-700 mt-0.5 flex items-center gap-1">
              100%{" "}
              <span className="text-[10px] text-violet-600 bg-violet-100 px-1.5 py-0.2 rounded font-normal">
                {t("templates.kpi.dictConnected")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface p-3 rounded-2xl border border-line/80 shadow-card space-y-3">
        {/* Language Tabs / Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-fg-tertiary font-semibold flex items-center gap-1 text-[11px] shrink-0">
            <Filter className="w-3.5 h-3.5" /> {t("templates.filters.langFilterLabel")}
          </span>
          <button
            onClick={() => setLangFilter("ALL")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              langFilter === "ALL"
                ? "bg-primary text-primary-foreground shadow-card"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            {t("templates.filters.allLangsCount", { count: templateList.length })}
          </button>
          {SUPPORTED_LANG_CONFIG.map((lang) => {
            const count = templateList.filter((tmpl) => tmpl.language === lang.code).length;
            const isSelected = langFilter === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setLangFilter(lang.code)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-card"
                    : "bg-hover text-fg-secondary hover:bg-hover"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? "bg-indigo-700 text-indigo-100" : "bg-hover/80 text-fg-secondary"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Category Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-line-subtle">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-fg-tertiary absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t("templates.filters.searchStandalonePlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-subtle border border-line rounded-xl text-xs focus:bg-surface focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Category Dropdown */}
            <div className="w-[190px]">
              <ShadcnSelect
                value={categoryFilter}
                onValueChange={(val) => setCategoryFilter(val)}
                options={filterCategoryOptions}
              />
            </div>

            {/* Status Dropdown */}
            <div className="w-[150px]">
              <ShadcnSelect
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val)}
                options={filterStatusOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Email Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-subtle/90 text-[11px] font-semibold text-fg-secondary border-b border-line/70">
                <th className="py-2 px-3 w-[240px]">{t("templates.tableStandalone.emailInfo")}</th>
                <th className="py-2 px-3 w-[160px]">{t("templates.tableStandalone.language")}</th>
                <th className="py-2 px-3 w-[180px]">{t("templates.tableStandalone.categoryTrigger")}</th>
                <th className="py-2 px-3 min-w-[260px]">{t("templates.tableStandalone.senderSubject")}</th>
                <th className="py-2 px-3 w-[110px]">{t("templates.tableStandalone.status")}</th>
                <th className="py-2 px-3 w-[110px]">{t("templates.tableStandalone.updatedAt")}</th>
                <th className="py-2 px-3 w-[160px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("templates.tableStandalone.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle text-xs text-fg-secondary">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-fg-tertiary">
                    <Mail className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                    <p className="text-xs">{t("templates.empty.noResults")}</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setLangFilter("ALL");
                        setCategoryFilter("ALL");
                        setStatusFilter("ALL");
                      }}
                      className="mt-2 text-xs text-indigo-600 hover:underline font-medium"
                    >
                      {t("templates.empty.clearFilters")}
                    </button>
                  </td>
                </tr>
              ) : (
                paginate<EmailTemplate>(filteredEmails, currentPage, pageSize).map((email) => {
                  const langMeta = getLanguageMeta(email.language);
                  const catStyle = categoryMap[email.category] || categoryMap.SYSTEM;

                  return (
                    <tr key={email.id} className="hover:bg-subtle/80 transition-colors group">
                      {/* Name & Code */}
                      <td className="py-3.5 px-3 w-[240px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-fg flex items-center gap-1.5">
                            {email.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-fg-secondary bg-hover px-1.5 py-0.2 rounded border border-line">
                              {email.code}
                            </span>
                            <span className="text-[10px] text-fg-tertiary truncate max-w-[150px]">
                              {email.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Single Language Badge */}
                      <td className="py-3.5 px-3 w-[160px]">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-hover text-fg rounded-lg text-xs font-semibold border border-line/80">
                          <span>{langMeta.flag}</span>
                          <span>{langMeta.nativeName}</span>
                          <span className="text-[10px] text-fg-secondary font-mono">({email.language})</span>
                        </span>
                      </td>

                      {/* Category & Trigger */}
                      <td className="py-3.5 px-3 w-[180px]">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {catStyle.label}
                          </span>
                          <div className="font-mono text-[10px] text-fg-secondary flex items-center gap-1 truncate">
                            <Code className="w-3 h-3 text-fg-tertiary shrink-0" />
                            <span className="truncate">{email.triggerEvent}</span>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Sender */}
                      <td className="py-3.5 px-3 min-w-[260px]">
                        <div className="space-y-0.5">
                          <div className="font-medium text-fg line-clamp-1" title={email.subject}>
                            {email.subject}
                          </div>
                          <div className="text-[11px] text-fg-secondary flex items-center gap-1 truncate">
                            <span className="text-fg-secondary font-medium">{email.senderName}</span>
                            <span className="text-fg-tertiary font-mono text-[10px] truncate">
                              &lt;{email.senderEmail}&gt;
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 w-[110px] whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(email)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                            email.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : email.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-hover text-fg-secondary border-line hover:bg-hover"
                          }`}
                          title={t("templates.actions.toggleStatusTitle")}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              email.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : email.status === "DRAFT"
                                ? "bg-amber-500"
                                : "bg-hover"
                            }`}
                          />
                          {t(`templates.status.${email.status}`)}
                        </button>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-3 w-[110px] whitespace-nowrap text-[11px] text-fg-tertiary font-mono">
                        {email.updatedAt.substring(0, 10)}
                      </td>

                      {/* Action Buttons: Sticky Right */}
                      <td className="py-3.5 px-3 w-[160px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1">
                          {/* Preview Button */}
                          <button
                            onClick={() => setPreviewEmail(email)}
                            className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-lg transition-colors"
                            title={t("templates.actions.previewDevice")}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(email)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t("templates.actions.editStandalone")}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Clone/Duplicate to New Language Button */}
                          <button
                            onClick={() => {
                              setCloningSourceEmail(email);
                              // pick next unused lang or ja-JP
                              const remaining = SUPPORTED_LANG_CONFIG.find((l) => l.code !== email.language);
                              if (remaining) setCloneTargetLang(remaining.code);
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t("templates.actions.cloneLang")}
                          >
                            <CopyPlus className="w-3.5 h-3.5" />
                          </button>

                          {/* Test Send Button */}
                          <button
                            onClick={() => {
                              setTestSendingEmail(email);
                              setTestSendResult(null);
                            }}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                            title={t("templates.actions.testSend")}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <Popconfirm
                            title={t("templates.confirm.deleteStandaloneTitle", { name: email.name })}
                            description={t("templates.confirm.deleteStandaloneDesc")}
                            onConfirm={() => handleDelete(email.id, email.name)}
                          >
                            <button
                              type="button"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title={t("templates.actions.deleteEmail")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredEmails.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* 1. SideSheet: Edit Standalone Email (独立单一邮件编辑) */}
      {isEditingModalOpen && editingEmail && (
        <SideSheet
          id="side-sheet-email-edit"
          isOpen={true}
          onClose={() => setIsEditingModalOpen(false)}
          title={t("templates.editor.title", { code: editingEmail.code })}
          description={t("templates.editor.description")}
          icon={<Edit3 className="w-5 h-5 text-indigo-600" />}
          widthClass="max-w-5xl"
          headerExtra={
            <div className="flex items-center bg-hover/80 p-0.5 rounded-lg text-xs mr-2">
              <button
                type="button"
                onClick={() => setActiveTabInEditor("EDIT")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTabInEditor === "EDIT" ? "bg-surface text-fg shadow-card" : "text-fg-secondary"
                }`}
              >
                {t("templates.editor.tabForm")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTabInEditor("SPLIT_PREVIEW")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTabInEditor === "SPLIT_PREVIEW" ? "bg-surface text-fg shadow-card" : "text-fg-secondary"
                }`}
              >
                {t("templates.editor.tabSplit")}
              </button>
            </div>
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-3 py-2 border border-line hover:bg-hover text-fg-secondary rounded-xl text-xs font-semibold cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveEmail}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {t("templates.editor.saveStandalone")}
              </button>
            </>
          }
        >
          {/* Form Body */}
          <form onSubmit={handleSaveEmail} className="space-y-5">
            <div
              className={`grid gap-6 ${
                activeTabInEditor === "SPLIT_PREVIEW" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
              }`}
            >
              {/* Left Side: Form Fields */}
              <div className={activeTabInEditor === "SPLIT_PREVIEW" ? "lg:col-span-7 space-y-4" : "space-y-4"}>
                {/* Basic Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-subtle/50 p-3 rounded-xl border border-line/60">
                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.nameLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingEmail.name}
                      onChange={(e) => setEditingEmail({ ...editingEmail, name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.codeLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingEmail.code}
                      onChange={(e) => setEditingEmail({ ...editingEmail, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-mono font-medium focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Single Independent Language Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.languageLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <ShadcnSelect
                      value={editingEmail.language}
                      onValueChange={(val) =>
                        setEditingEmail({
                          ...editingEmail,
                          language: val as SupportedLanguage,
                        })
                      }
                      options={SUPPORTED_LANG_CONFIG.map((l) => ({
                        value: l.code,
                        label: `${l.flag} ${l.nativeName} (${l.code})`,
                      }))}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.categoryLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <ShadcnSelect
                      value={editingEmail.category}
                      onValueChange={(val) =>
                        setEditingEmail({
                          ...editingEmail,
                          category: val as EmailCategory,
                        })
                      }
                      options={editorCategoryOptions}
                    />
                  </div>

                  {/* Trigger Event */}
                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.triggerLabel")}
                    </label>
                    <input
                      type="text"
                      value={editingEmail.triggerEvent}
                      onChange={(e) => setEditingEmail({ ...editingEmail, triggerEvent: e.target.value })}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-mono text-fg-secondary focus:border-indigo-500 focus:outline-hidden"
                      placeholder={t("templates.editor.triggerPlaceholder")}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-fg-secondary mb-1">
                      {t("templates.editor.statusLabel")}
                    </label>
                    <ShadcnSelect
                      value={editingEmail.status}
                      onValueChange={(val) =>
                        setEditingEmail({
                          ...editingEmail,
                          status: val as "ACTIVE" | "DRAFT" | "DISABLED",
                        })
                      }
                      options={editorStatusOptions}
                    />
                  </div>
                </div>

                  {/* Sender & Subject */}
                  <div className="space-y-3 bg-subtle/50 p-3 rounded-xl border border-line/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-fg-secondary mb-1">
                          {t("templates.editor.senderNameLabel")}
                        </label>
                        <input
                          type="text"
                          value={editingEmail.senderName}
                          onChange={(e) => setEditingEmail({ ...editingEmail, senderName: e.target.value })}
                          className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-fg-secondary mb-1">
                          {t("templates.editor.senderEmailLabel")}
                        </label>
                        <input
                          type="email"
                          value={editingEmail.senderEmail}
                          onChange={(e) => setEditingEmail({ ...editingEmail, senderEmail: e.target.value })}
                          className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-mono focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-fg-secondary mb-1">
                        {t("templates.editor.subjectLabel")} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmail.subject}
                        onChange={(e) => setEditingEmail({ ...editingEmail, subject: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-medium text-fg focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-fg-secondary mb-1">
                        {t("templates.editor.preheaderLabel")}
                      </label>
                      <input
                        type="text"
                        value={editingEmail.previewText}
                        onChange={(e) => setEditingEmail({ ...editingEmail, previewText: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs text-fg-secondary focus:border-indigo-500 focus:outline-hidden"
                        placeholder={t("templates.editor.preheaderPlaceholder")}
                      />
                    </div>
                  </div>

                  {/* Body Content React Email & Markdown Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                      <label className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        {t("templates.editor.bodyLabel")}
                      </label>
                      <div className="flex items-center gap-2">
                        <a
                          href="https://github.com/resend/react-email"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-[10px] font-mono transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          <span>Resend React Email</span>
                          <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                        </a>
                        <span className="text-[11px] text-fg-tertiary">
                          {t("templates.reactEmail.charCount", { count: editingEmail.contentMarkdown.length })}
                        </span>
                      </div>
                    </div>

                    {/* Quick Presets Bar */}
                    <div className="bg-indigo-50/80 dark:bg-indigo-950/40 p-2 rounded-t-xl border border-line border-b-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1">
                          <Layers className="w-3 h-3 text-indigo-600" />
                          {t("templates.reactEmail.presetsLabel")}
                        </span>
                        {REACT_EMAIL_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              if (
                                editingEmail.contentMarkdown.trim() &&
                                !window.confirm(t("templates.reactEmail.applyPresetConfirm"))
                              ) {
                                return;
                              }
                              setEditingEmail({
                                ...editingEmail,
                                contentMarkdown: preset.content,
                              });
                              showToast(t("templates.toast.presetApplied"));
                            }}
                            className="px-2 py-0.5 bg-surface hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-medium border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>{t(preset.nameKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* React Email Component Insert & Tag Bars */}
                    <div className="bg-hover p-2 border border-line border-b-0 space-y-1.5">
                      {/* React Email Components Insertion */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-[10px] text-fg-secondary font-semibold flex items-center gap-1">
                          <Code className="w-3 h-3 text-indigo-500" />
                          {t("templates.reactEmail.componentsLabel")}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<Button href="{{billing_portal_url}}" style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>\n  访问商户账务门户\n</Button>`;
                            setEditingEmail({
                              ...editingEmail,
                              contentMarkdown: `${editingEmail.contentMarkdown}\n\n${snippet}`,
                            });
                            showToast(t("templates.toast.componentInserted", { name: "<Button>" }));
                          }}
                          className="px-1.5 py-0.5 bg-surface hover:bg-hover text-indigo-600 rounded text-[10px] font-mono border border-indigo-200 flex items-center gap-1 cursor-pointer font-semibold"
                          title={t("templates.reactEmail.insertButton")}
                        >
                          &lt;Button&gt;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<Heading as="h2" style={{ color: '#111827', fontSize: '20px', fontWeight: '700', margin: '16px 0 8px 0' }}>\n  标题文字内容\n</Heading>`;
                            setEditingEmail({
                              ...editingEmail,
                              contentMarkdown: `${editingEmail.contentMarkdown}\n\n${snippet}`,
                            });
                            showToast(t("templates.toast.componentInserted", { name: "<Heading>" }));
                          }}
                          className="px-1.5 py-0.5 bg-surface hover:bg-hover text-indigo-600 rounded text-[10px] font-mono border border-indigo-200 flex items-center gap-1 cursor-pointer font-semibold"
                          title={t("templates.reactEmail.insertHeading")}
                        >
                          &lt;Heading&gt;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<Text style={{ color: '#4b5563', fontSize: '14px', lineHeight: '24px', margin: '8px 0' }}>\n  段落正文文本...\n</Text>`;
                            setEditingEmail({
                              ...editingEmail,
                              contentMarkdown: `${editingEmail.contentMarkdown}\n\n${snippet}`,
                            });
                            showToast(t("templates.toast.componentInserted", { name: "<Text>" }));
                          }}
                          className="px-1.5 py-0.5 bg-surface hover:bg-hover text-indigo-600 rounded text-[10px] font-mono border border-indigo-200 flex items-center gap-1 cursor-pointer font-semibold"
                          title={t("templates.reactEmail.insertText")}
                        >
                          &lt;Text&gt;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<Hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />`;
                            setEditingEmail({
                              ...editingEmail,
                              contentMarkdown: `${editingEmail.contentMarkdown}\n\n${snippet}`,
                            });
                            showToast(t("templates.toast.componentInserted", { name: "<Hr />" }));
                          }}
                          className="px-1.5 py-0.5 bg-surface hover:bg-hover text-indigo-600 rounded text-[10px] font-mono border border-indigo-200 flex items-center gap-1 cursor-pointer font-semibold"
                          title={t("templates.reactEmail.insertHr")}
                        >
                          &lt;Hr /&gt;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<Section style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6', margin: '14px 0' }}>\n  <Text style={{ margin: '0', fontSize: '13px', color: '#374151' }}>区块内容说明</Text>\n</Section>`;
                            setEditingEmail({
                              ...editingEmail,
                              contentMarkdown: `${editingEmail.contentMarkdown}\n\n${snippet}`,
                            });
                            showToast(t("templates.toast.componentInserted", { name: "<Section>" }));
                          }}
                          className="px-1.5 py-0.5 bg-surface hover:bg-hover text-indigo-600 rounded text-[10px] font-mono border border-indigo-200 flex items-center gap-1 cursor-pointer font-semibold"
                          title={t("templates.reactEmail.insertSection")}
                        >
                          &lt;Section&gt;
                        </button>
                      </div>

                      {/* Dynamic Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1 border-t border-line">
                        <span className="text-[10px] text-fg-secondary font-semibold flex items-center gap-1">
                          <Tag className="w-3 h-3 text-amber-500" /> {t("templates.editor.dynamicTagsLabel")}
                        </span>
                        {commonDynamicTags.slice(0, 6).map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => {
                              setEditingEmail({
                                ...editingEmail,
                                contentMarkdown: `${editingEmail.contentMarkdown}\n${item.tag}`,
                              });
                              copyToClipboard(item.tag, item.tag);
                            }}
                            className="px-1.5 py-0.5 bg-surface hover:bg-hover text-fg-secondary rounded text-[10px] font-mono border border-line flex items-center gap-1 cursor-pointer"
                            title={t("templates.actions.insertTag", { label: item.label })}
                          >
                            <span>{item.tag}</span>
                            {copiedKey === item.tag && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          </button>
                        ))}
                      </div>

                      {/* Dictionary Reference Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1 border-t border-line">
                        <span className="text-[10px] text-violet-700 dark:text-violet-300 font-semibold flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-violet-500" /> {t("templates.editor.dictTagsLabel")}
                        </span>
                        {dictionary.slice(0, 4).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              const placeholder = `{{dict.${d.key}}}`;
                              setEditingEmail({
                                ...editingEmail,
                                contentMarkdown: `${editingEmail.contentMarkdown}\n${placeholder}`,
                              });
                              copyToClipboard(placeholder, d.id);
                            }}
                            className="px-1.5 py-0.5 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:text-violet-300 dark:bg-violet-950/40 rounded text-[10px] font-mono border border-violet-200 dark:border-violet-800 flex items-center gap-1 cursor-pointer"
                            title={t("templates.actions.insertDict", { description: d.description })}
                          >
                            <span>{`{{dict.${d.key}}}`}</span>
                            {copiedKey === d.id && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      rows={14}
                      value={editingEmail.contentMarkdown}
                      onChange={(e) => setEditingEmail({ ...editingEmail, contentMarkdown: e.target.value })}
                      className="w-full p-3 font-mono text-xs bg-surface border border-line rounded-b-xl focus:border-indigo-500 focus:outline-hidden"
                    />
                    <div className="mt-1 text-[11px] text-fg-tertiary">
                      {t("templates.reactEmail.syntaxInfo")}
                    </div>
                  </div>
                </div>

                {/* Right Side: Split-Pane Real-Time Render Powered by React Email */}
                {activeTabInEditor === "SPLIT_PREVIEW" && (
                  <div className="lg:col-span-5 h-[620px] flex flex-col">
                    <ReactEmailRenderer
                      content={editingEmail.contentMarkdown}
                      subject={editingEmail.subject}
                      senderName={editingEmail.senderName}
                      senderEmail={editingEmail.senderEmail}
                      previewText={editingEmail.previewText}
                      language={editingEmail.language}
                      dictionary={dictionary}
                      dynamicTags={commonDynamicTags}
                      compact={true}
                    />
                  </div>
                )}
              </div>
            </form>
          </SideSheet>
        )}

      {/* 2. SideSheet: Standalone Email Device Preview (设备预览) */}
      {previewEmail && (
        <SideSheet
          id="side-sheet-email-preview"
          isOpen={true}
          onClose={() => setPreviewEmail(null)}
          title={
            <div className="flex items-center gap-2">
              <span className="text-base">{getLanguageMeta(previewEmail.language).flag}</span>
              <span>{previewEmail.name}</span>
            </div>
          }
          description={`${previewEmail.code} · ${previewEmail.language}`}
          icon={<Eye className="w-5 h-5 text-indigo-600" />}
          widthClass="max-w-3xl"
          headerExtra={
            <div className="flex items-center bg-hover/80 p-0.5 rounded-lg text-xs mr-2">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  previewDevice === "desktop" ? "bg-surface text-fg shadow-card" : "text-fg-secondary"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" /> {t("templates.preview.desktop")}
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  previewDevice === "mobile" ? "bg-surface text-fg shadow-card" : "text-fg-secondary"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> {t("templates.preview.mobile")}
              </button>
            </div>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-[11px] text-fg-secondary">
                {t("templates.preview.dictLinked")}
                {previewEmail.dictReferences && previewEmail.dictReferences.length > 0 ? (
                  previewEmail.dictReferences.map((r) => (
                    <span key={r} className="ml-1 font-mono text-violet-700 bg-violet-50 px-1 py-0.5 rounded">
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-fg-tertiary ml-1">{t("templates.preview.directText")}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewEmail;
                    setPreviewEmail(null);
                    setTestSendingEmail(target);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> {t("templates.preview.sendTest")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewEmail(null)}
                  className="px-3 py-1.5 border border-line hover:bg-hover rounded-lg text-xs font-medium cursor-pointer"
                >
                  {t("common:actions.close")}
                </button>
              </div>
            </div>
          }
        >
          {/* React Email Canvas Preview */}
          <div className="h-[750px] flex flex-col">
            <ReactEmailRenderer
              content={previewEmail.contentMarkdown}
              subject={previewEmail.subject}
              senderName={previewEmail.senderName}
              senderEmail={previewEmail.senderEmail}
              previewText={previewEmail.previewText}
              language={previewEmail.language}
              dictionary={dictionary}
              dynamicTags={commonDynamicTags}
              device={previewDevice}
              onDeviceChange={setPreviewDevice}
              showHeader={true}
            />
          </div>
        </SideSheet>
      )}

      {/* 3. SideSheet: Clone / Duplicate to New Language (克隆为新语种邮件) */}
      {cloningSourceEmail && (
        <SideSheet
          id="side-sheet-email-clone"
          isOpen={true}
          onClose={() => setCloningSourceEmail(null)}
          title={t("templates.clone.title")}
          description={t("templates.clone.description", {
            name: cloningSourceEmail.name,
            flag: getLanguageMeta(cloningSourceEmail.language).flag,
            language: getLanguageMeta(cloningSourceEmail.language).nativeName,
          })}
          icon={<CopyPlus className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setCloningSourceEmail(null)}
                className="px-3 py-2 border border-line hover:bg-hover rounded-xl text-xs font-semibold text-fg-secondary cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleExecuteClone}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card cursor-pointer"
              >
                <CopyPlus className="w-3.5 h-3.5" /> {t("templates.clone.confirm")}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-fg-secondary">{t("templates.clone.intro")}</p>

            <div>
              <label className="block text-xs font-semibold text-fg-secondary mb-1">
                {t("templates.clone.targetLangLabel")}
              </label>
              <ShadcnSelect
                value={cloneTargetLang}
                onValueChange={(val) => setCloneTargetLang(val as SupportedLanguage)}
                options={SUPPORTED_LANG_CONFIG.filter((l) => l.code !== cloningSourceEmail.language).map((l) => ({
                  value: l.code,
                  label: `${l.flag} ${l.nativeName} (${l.code})`,
                }))}
              />
            </div>

            <div className="bg-subtle p-3.5 rounded-xl border border-line text-xs space-y-1.5">
              <div className="text-[11px] text-fg-secondary font-medium">{t("templates.clone.autoGeneratedLabel")}</div>
              <div className="font-mono text-fg font-bold text-xs">
                {cloningSourceEmail.code.replace(/_[A-Z]{2}$/, "")}_{cloneTargetLang.split("-")[0].toUpperCase()}
              </div>
              <div className="text-fg-secondary text-xs">
                {cloningSourceEmail.name.replace(/\(.*?\)/g, "").trim()} (
                {getLanguageMeta(cloneTargetLang).nativeName})
              </div>
            </div>
          </div>
        </SideSheet>
      )}

      {/* 4. SideSheet: Test Send Simulation (测试发送模拟) */}
      {testSendingEmail && (
        <SideSheet
          id="side-sheet-email-test-send"
          isOpen={true}
          onClose={() => setTestSendingEmail(null)}
          title={t("templates.testSend.title")}
          description={t("templates.testSend.description", {
            name: testSendingEmail.name,
            flag: getLanguageMeta(testSendingEmail.language).flag,
            language: testSendingEmail.language,
          })}
          icon={<Send className="w-5 h-5 text-emerald-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setTestSendingEmail(null)}
                className="px-3 py-2 border border-line hover:bg-hover rounded-xl text-xs font-semibold text-fg-secondary cursor-pointer"
              >
                {t("common:actions.close")}
              </button>
              <button
                type="button"
                disabled={isSending || !testEmailAddress}
                onClick={handleExecuteTestSend}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    {t("templates.testSend.sending")}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> {t("templates.testSend.dispatch")}
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-fg-secondary">{t("templates.testSend.intro")}</p>

            <div>
              <label className="block text-xs font-semibold text-fg-secondary mb-1">
                {t("templates.testSend.recipientLabel")}
              </label>
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                placeholder={t("templates.testSend.recipientPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-fg-secondary mb-1">
                {t("templates.testSend.channelLabel")}
              </label>
              <ShadcnSelect
                value={testSendChannel}
                onValueChange={(val) =>
                  setTestSendChannel(val as "SENDGRID" | "AWS_SES" | "RESEND")
                }
                options={testSendChannelOptions}
              />
            </div>

            {testSendResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="text-emerald-800 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {t("templates.testSend.successTitle")}
                </div>
                <div className="text-[11px] font-mono text-emerald-700">
                  {t("templates.testSend.messageIdLabel")} {testSendResult.messageId}
                </div>
                <div className="text-[10px] text-fg-secondary">{testSendResult.log}</div>
              </div>
            )}
          </div>
        </SideSheet>
      )}
    </div>
  );
};
