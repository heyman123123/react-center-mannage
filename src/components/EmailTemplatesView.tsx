import React, { useState } from "react";
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
} from "lucide-react";
import { EmailTemplate, SupportedLanguage, DictionaryEntry, EmailCategory } from "../types/payment";
import { INITIAL_DICTIONARY } from "../data/mockData";
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

const CATEGORY_MAP: Record<EmailCategory, { label: string; bg: string; text: string; border: string }> = {
  BILLING: { label: "支付账单收据", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  LIFECYCLE: { label: "订阅全周期", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  SECURITY: { label: "账号安全验证", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  PROMOTION: { label: "营销立减优惠", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  SYSTEM: { label: "系统运维通知", bg: "bg-zinc-50", text: "text-zinc-700", border: "border-zinc-200" },
  RISK: { label: "风控合规预警", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const COMMON_DYNAMIC_TAGS = [
  { tag: "{{customer_name}}", label: "客户姓名", sample: "Alex Wright" },
  { tag: "{{app_name}}", label: "应用名称", sample: "NovasAI Studio" },
  { tag: "{{plan_name}}", label: "订购套餐", sample: "Enterprise Annual Plan" },
  { tag: "{{amount}}", label: "实付金额", sample: "199.00" },
  { tag: "{{currency}}", label: "交易币种", sample: "USD" },
  { tag: "{{order_id}}", label: "订单单号", sample: "ord_live_890281" },
  { tag: "{{payment_method}}", label: "支付卡别", sample: "Visa •••• 4242" },
  { tag: "{{billing_period}}", label: "计费周期", sample: "2026/09/01 - 2027/09/01" },
  { tag: "{{next_renewal_date}}", label: "下次扣费日", sample: "2027-09-01" },
  { tag: "{{billing_portal_url}}", label: "账务门户链接", sample: "https://billing.novaspay.global/portal" },
  { tag: "{{security_code}}", label: "安全验证码", sample: "849201" },
  { tag: "{{coupon_code}}", label: "专属折扣码", sample: "VIP25OFF" },
  { tag: "{{discount_rate}}", label: "折扣比率", sample: "25" },
  { tag: "{{expiry_date}}", label: "截止日期", sample: "2026-09-30" },
];

export const EmailTemplatesView: React.FC<EmailTemplatesViewProps> = ({
  templates,
  dictionary = INITIAL_DICTIONARY,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const [templateList, setTemplateList] = useState<EmailTemplate[]>(templates);
  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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
  const activeCount = templateList.filter((t) => t.status === "ACTIVE").length;
  const coveredLanguages: SupportedLanguage[] = Array.from(new Set(templateList.map((t) => t.language)));

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
      const exists = prev.some((t) => t.id === updated.id);
      return exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...prev];
    });

    if (onSaveTemplate) {
      onSaveTemplate(updated);
    }

    setIsEditingModalOpen(false);
    showToast(`独立邮件【${updated.name}】已成功保存！当前独立归属语种：${updated.language}`);
  };

  // Toggle single email active/disabled
  const handleToggleStatus = (email: EmailTemplate) => {
    const nextStatus = email.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const updated: EmailTemplate = {
      ...email,
      status: nextStatus,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    setTemplateList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (onSaveTemplate) onSaveTemplate(updated);
    showToast(`邮件【${email.name}】状态已变更为【${nextStatus === "ACTIVE" ? "已启用上线" : "已停用"}】`);
  };

  // Delete single email
  const handleDelete = (id: string, name: string) => {
    setTemplateList((prev) => prev.filter((t) => t.id !== id));
    if (onDeleteTemplate) onDeleteTemplate(id);
    showToast(`独立邮件【${name}】已成功移除`);
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
    showToast(`已成功将【${cloningSourceEmail.name}】复制为新独立邮件【${cloned.name}】(草稿状态)，请点击编辑微调文案！`);
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
      showToast(`测试信已成功发送至 ${testEmailAddress}，送达耗时 342ms！`);
    }, 900);
  };

  // Helper to render preview text resolving variables and dictionary items
  const renderResolvedContent = (rawMarkdown: string, lang: SupportedLanguage) => {
    let text = rawMarkdown;

    // 1. Resolve dynamic sample tags
    COMMON_DYNAMIC_TAGS.forEach((tag) => {
      text = text.replaceAll(tag.tag, `**${tag.sample}**`);
    });

    // 2. Resolve {{dict.*}} tags using dictionary for this language
    dictionary.forEach((dictEntry) => {
      const dictTag = `{{dict.${dictEntry.key}}}`;
      const translation = dictEntry.translations[lang] || dictEntry.translations["en-US"] || dictEntry.key;
      text = text.replaceAll(dictTag, translation);
    });

    return text;
  };

  const getLanguageMeta = (code: SupportedLanguage) => {
    return SUPPORTED_LANG_CONFIG.find((l) => l.code === code) || { code, label: code, flag: "🌐", nativeName: code };
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-sm animate-in fade-in">
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
      <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Languages className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">多语言邮件管理</h1>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">
                独立单一邮件架构
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 max-w-3xl">
              系统的每封邮件均为<strong>独立单一实体</strong>，支持独立指定归属语言、触发器、发信人与正文。内置与【字典管理】联动的全局多语言共享词条插槽，保障全球统一合规与本地化表达。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenCreateNew}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建独立邮件
            </button>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-zinc-100">
          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              独立邮件总数
            </div>
            <div className="text-lg font-bold text-zinc-900 mt-0.5">
              {templateList.length} <span className="text-xs font-normal text-zinc-400">封独立邮件</span>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              覆盖出海语种
            </div>
            <div className="text-lg font-bold text-zinc-900 mt-0.5 flex items-center gap-1.5">
              {coveredLanguages.length}{" "}
              <span className="text-xs text-zinc-400 font-normal">个目标市场</span>
              <div className="flex -space-x-1 ml-1">
                {coveredLanguages.slice(0, 5).map((l) => (
                  <span key={l} className="text-xs" title={l}>
                    {getLanguageMeta(l).flag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              已启用上线 (Active)
            </div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              {activeCount}{" "}
              <span className="text-xs font-normal text-zinc-400">/ {templateList.length} 生产就绪</span>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-violet-500" />
              字典变量共享引用
            </div>
            <div className="text-lg font-bold text-violet-700 mt-0.5 flex items-center gap-1">
              100%{" "}
              <span className="text-[10px] text-violet-600 bg-violet-100 px-1.5 py-0.2 rounded font-normal">
                已接入字典管理
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3">
        {/* Language Tabs / Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-zinc-400 font-semibold flex items-center gap-1 text-[11px] shrink-0">
            <Filter className="w-3.5 h-3.5" /> 筛选语种:
          </span>
          <button
            onClick={() => setLangFilter("ALL")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              langFilter === "ALL"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            全部语言 ({templateList.length})
          </button>
          {SUPPORTED_LANG_CONFIG.map((lang) => {
            const count = templateList.filter((t) => t.language === lang.code).length;
            const isSelected = langFilter === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setLangFilter(lang.code)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? "bg-indigo-700 text-indigo-100" : "bg-zinc-200/80 text-zinc-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Category Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-zinc-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜索邮件名称、唯一代码、邮件主题、发件人或正文关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Category Dropdown */}
            <div className="w-[190px]">
              <ShadcnSelect
                value={categoryFilter}
                onValueChange={(val) => setCategoryFilter(val)}
                options={[
                  { value: "ALL", label: "全部分类 (All Categories)" },
                  { value: "BILLING", label: "支付账单收据 (BILLING)" },
                  { value: "LIFECYCLE", label: "订阅全周期 (LIFECYCLE)" },
                  { value: "SECURITY", label: "账号安全验证 (SECURITY)" },
                  { value: "PROMOTION", label: "营销立减优惠 (PROMOTION)" },
                  { value: "SYSTEM", label: "系统运维通知 (SYSTEM)" },
                ]}
              />
            </div>

            {/* Status Dropdown */}
            <div className="w-[150px]">
              <ShadcnSelect
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val)}
                options={[
                  { value: "ALL", label: "全部状态" },
                  { value: "ACTIVE", label: "已启用 (ACTIVE)" },
                  { value: "DRAFT", label: "草稿 (DRAFT)" },
                  { value: "DISABLED", label: "已停用 (DISABLED)" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Email Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 border-b border-zinc-200/70">
                <th className="py-3 px-4 w-[240px]">独立邮件信息 / 唯一编号</th>
                <th className="py-3 px-3 w-[160px]">归属语言</th>
                <th className="py-3 px-3 w-[180px]">业务分类 & 触发器</th>
                <th className="py-3 px-3 min-w-[260px]">发件人 & 邮件主题 (Subject)</th>
                <th className="py-3 px-3 w-[110px]">状态</th>
                <th className="py-3 px-3 w-[110px]">最近更新</th>
                <th className="py-3 px-4 w-[160px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs text-zinc-700">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Mail className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                    <p className="text-xs">未找到符合条件的独立邮件</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setLangFilter("ALL");
                        setCategoryFilter("ALL");
                        setStatusFilter("ALL");
                      }}
                      className="mt-2 text-xs text-indigo-600 hover:underline font-medium"
                    >
                      清空所有筛选条件
                    </button>
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => {
                  const langMeta = getLanguageMeta(email.language);
                  const catStyle = CATEGORY_MAP[email.category] || CATEGORY_MAP.SYSTEM;

                  return (
                    <tr key={email.id} className="hover:bg-zinc-50/80 transition-colors group">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4 w-[240px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                            {email.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                              {email.code}
                            </span>
                            <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">
                              {email.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Single Language Badge */}
                      <td className="py-3.5 px-3 w-[160px]">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-800 rounded-lg text-xs font-semibold border border-zinc-200/80">
                          <span>{langMeta.flag}</span>
                          <span>{langMeta.nativeName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({email.language})</span>
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
                          <div className="font-mono text-[10px] text-zinc-500 flex items-center gap-1 truncate">
                            <Code className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span className="truncate">{email.triggerEvent}</span>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Sender */}
                      <td className="py-3.5 px-3 min-w-[260px]">
                        <div className="space-y-0.5">
                          <div className="font-medium text-zinc-900 line-clamp-1" title={email.subject}>
                            {email.subject}
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-1 truncate">
                            <span className="text-zinc-700 font-medium">{email.senderName}</span>
                            <span className="text-zinc-400 font-mono text-[10px] truncate">
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
                              : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                          }`}
                          title="点击切换启用/停用状态"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              email.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : email.status === "DRAFT"
                                ? "bg-amber-500"
                                : "bg-zinc-400"
                            }`}
                          />
                          {email.status === "ACTIVE" ? "已启用" : email.status === "DRAFT" ? "草稿" : "已停用"}
                        </button>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-3 w-[110px] whitespace-nowrap text-[11px] text-zinc-400 font-mono">
                        {email.updatedAt.substring(0, 10)}
                      </td>

                      {/* Action Buttons: Sticky Right */}
                      <td className="py-3.5 px-4 w-[160px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1">
                          {/* Preview Button */}
                          <button
                            onClick={() => setPreviewEmail(email)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                            title="设备预览"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(email)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="编辑此独立邮件"
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
                            title="克隆为新语种独立邮件"
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
                            title="模拟测试发送"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <Popconfirm
                            title={`删除独立邮件「${email.name}」？`}
                            description="删除后对应触发事件将不再投递该语言版本，且无法恢复。"
                            onConfirm={() => handleDelete(email.id, email.name)}
                          >
                            <button
                              type="button"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="删除邮件"
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
      </div>

      {/* 1. SideSheet: Edit Standalone Email (独立单一邮件编辑) */}
      {isEditingModalOpen && editingEmail && (
        <SideSheet
          id="side-sheet-email-edit"
          isOpen={true}
          onClose={() => setIsEditingModalOpen(false)}
          title={`编辑独立单一邮件: ${editingEmail.code}`}
          description="当前配置只针对当前单一邮件实体生效，具备独立主题、发件人与正文内容"
          icon={<Edit3 className="w-5 h-5 text-indigo-600" />}
          widthClass="max-w-5xl"
          headerExtra={
            <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-xs mr-2">
              <button
                type="button"
                onClick={() => setActiveTabInEditor("EDIT")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTabInEditor === "EDIT" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                纯表单模式
              </button>
              <button
                type="button"
                onClick={() => setActiveTabInEditor("SPLIT_PREVIEW")}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTabInEditor === "SPLIT_PREVIEW" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                双栏实时对照
              </button>
            </div>
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEmail}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                保存独立邮件
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-200/60">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      邮件名称 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingEmail.name}
                      onChange={(e) => setEditingEmail({ ...editingEmail, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      唯一系统代码 (Code) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingEmail.code}
                      onChange={(e) => setEditingEmail({ ...editingEmail, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-medium focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Single Independent Language Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      独立归属语言 (Language) <span className="text-rose-500">*</span>
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
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      业务场景分类 <span className="text-rose-500">*</span>
                    </label>
                    <ShadcnSelect
                      value={editingEmail.category}
                      onValueChange={(val) =>
                        setEditingEmail({
                          ...editingEmail,
                          category: val as EmailCategory,
                        })
                      }
                      options={[
                        { value: "BILLING", label: "支付账单收据 (BILLING)" },
                        { value: "LIFECYCLE", label: "订阅全周期 (LIFECYCLE)" },
                        { value: "SECURITY", label: "账号安全验证 (SECURITY)" },
                        { value: "PROMOTION", label: "营销立减优惠 (PROMOTION)" },
                        { value: "SYSTEM", label: "系统运维通知 (SYSTEM)" },
                      ]}
                    />
                  </div>

                  {/* Trigger Event */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">触发事件 (Webhook Trigger)</label>
                    <input
                      type="text"
                      value={editingEmail.triggerEvent}
                      onChange={(e) => setEditingEmail({ ...editingEmail, triggerEvent: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-700 focus:border-indigo-500 focus:outline-hidden"
                      placeholder="例如 charge.succeeded"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">生效状态</label>
                    <ShadcnSelect
                      value={editingEmail.status}
                      onValueChange={(val) =>
                        setEditingEmail({
                          ...editingEmail,
                          status: val as "ACTIVE" | "DRAFT" | "DISABLED",
                        })
                      }
                      options={[
                        { value: "ACTIVE", label: "已启用上线 (ACTIVE)" },
                        { value: "DRAFT", label: "暂存草稿 (DRAFT)" },
                        { value: "DISABLED", label: "已停用 (DISABLED)" },
                      ]}
                    />
                  </div>
                </div>

                  {/* Sender & Subject */}
                  <div className="space-y-3 bg-zinc-50/50 p-4 rounded-xl border border-zinc-200/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">发件人显示名称</label>
                        <input
                          type="text"
                          value={editingEmail.senderName}
                          onChange={(e) => setEditingEmail({ ...editingEmail, senderName: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">发件人地址</label>
                        <input
                          type="email"
                          value={editingEmail.senderEmail}
                          onChange={(e) => setEditingEmail({ ...editingEmail, senderEmail: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        独立邮件主题 (Subject) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmail.subject}
                        onChange={(e) => setEditingEmail({ ...editingEmail, subject: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">邮件摘要预热文本 (Preheader)</label>
                      <input
                        type="text"
                        value={editingEmail.previewText}
                        onChange={(e) => setEditingEmail({ ...editingEmail, previewText: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-600 focus:border-indigo-500 focus:outline-hidden"
                        placeholder="在收件箱列表中展示的一句话预览摘要"
                      />
                    </div>
                  </div>

                  {/* Body Content Markdown Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        邮件正文内容 (Markdown / HTML)
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        支持 Markdown 排版、HTML 标签及插槽变量
                      </span>
                    </div>

                    {/* Quick Variable Insertion Bar */}
                    <div className="bg-zinc-100 p-2 rounded-t-xl border border-zinc-300 border-b-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                          <Tag className="w-3 h-3 text-amber-500" /> 常用动态插槽:
                        </span>
                        {COMMON_DYNAMIC_TAGS.slice(0, 6).map((item) => (
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
                            className="px-1.5 py-0.5 bg-white hover:bg-zinc-200 text-zinc-700 rounded text-[10px] font-mono border border-zinc-200 flex items-center gap-1"
                            title={`点击插入 ${item.label}`}
                          >
                            <span>{item.tag}</span>
                            {copiedKey === item.tag && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          </button>
                        ))}
                      </div>

                      {/* Dictionary Reference Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1 border-t border-zinc-200">
                        <span className="text-[10px] text-violet-700 font-semibold flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-violet-500" /> 统一字典引用:
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
                            className="px-1.5 py-0.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded text-[10px] font-mono border border-violet-200 flex items-center gap-1"
                            title={`点击插入字典: ${d.description}`}
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
                      className="w-full p-3 font-mono text-xs bg-white border border-zinc-300 rounded-b-xl focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Right Side: Split-Pane Real-Time Render */}
                {activeTabInEditor === "SPLIT_PREVIEW" && (
                  <div className="lg:col-span-5 bg-zinc-100/70 p-4 rounded-xl border border-zinc-200/80 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-3">
                      <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                        实时渲染效果 ({editingEmail.language})
                      </span>
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 动态插槽与字典自动换算
                      </span>
                    </div>

                    <div className="flex-1 bg-white rounded-xl border border-zinc-200 p-4 overflow-y-auto text-xs space-y-3 shadow-xs">
                      {/* Email Header Preview */}
                      <div className="pb-3 border-b border-zinc-100 text-zinc-600 space-y-1 text-[11px]">
                        <div>
                          <span className="text-zinc-400">发件人：</span>{" "}
                          <span className="font-semibold text-zinc-900">{editingEmail.senderName}</span> &lt;
                          {editingEmail.senderEmail}&gt;
                        </div>
                        <div>
                          <span className="text-zinc-400">主题：</span>{" "}
                          <span className="font-bold text-zinc-900">{editingEmail.subject}</span>
                        </div>
                        {editingEmail.previewText && (
                          <div className="text-zinc-400 text-[10px] italic">
                            Preheader: {editingEmail.previewText}
                          </div>
                        )}
                      </div>

                      {/* Email Body Markdown Rendered */}
                      <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 font-sans text-xs">
                        {renderResolvedContent(editingEmail.contentMarkdown, editingEmail.language)}
                      </div>
                    </div>
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
            <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-xs mr-2">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  previewDevice === "desktop" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" /> 桌面端 (640px)
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  previewDevice === "mobile" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> 移动端 (375px)
              </button>
            </div>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-[11px] text-zinc-500">
                当前语言已关联字典：
                {previewEmail.dictReferences && previewEmail.dictReferences.length > 0 ? (
                  previewEmail.dictReferences.map((r) => (
                    <span key={r} className="ml-1 font-mono text-violet-700 bg-violet-50 px-1 py-0.5 rounded">
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-zinc-400 ml-1">直接文本</span>
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
                  <Send className="w-3.5 h-3.5" /> 发送测试邮件
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewEmail(null)}
                  className="px-3 py-1.5 border border-zinc-300 hover:bg-zinc-100 rounded-lg text-xs font-medium cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          }
        >
          {/* Email Canvas Preview */}
          <div className="bg-zinc-100 p-4 sm:p-6 rounded-2xl flex justify-center">
            <div
              className={`bg-white rounded-xl border border-zinc-200 shadow-md p-6 transition-all ${
                previewDevice === "desktop" ? "w-full max-w-[640px]" : "w-[375px]"
              }`}
            >
              {/* Simulated Email Envelope Header */}
              <div className="border-b border-zinc-100 pb-4 mb-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>From:</span>
                  <span className="font-mono">NovasPay Cloud Relays</span>
                </div>
                <div className="font-bold text-zinc-900 text-sm">{previewEmail.subject}</div>
                <div className="text-zinc-600 text-xs flex items-center justify-between">
                  <span>
                    {previewEmail.senderName} &lt;{previewEmail.senderEmail}&gt;
                  </span>
                  <span className="text-[10px] text-zinc-400">刚刚送达</span>
                </div>
                {previewEmail.previewText && (
                  <div className="text-zinc-400 text-[11px] italic bg-zinc-50 p-1.5 rounded">
                    {previewEmail.previewText}
                  </div>
                )}
              </div>

              {/* Email Body Content */}
              <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 text-xs">
                {renderResolvedContent(previewEmail.contentMarkdown, previewEmail.language)}
              </div>

              {/* Simulated Email Footer */}
              <div className="mt-8 pt-4 border-t border-zinc-100 text-[10px] text-zinc-400 text-center space-y-1">
                <div>NovasPay Global Financial Infrastructure Inc. · 100 Montgomery St, San Francisco, CA</div>
                <div>This transaction confirmation is cryptographically certified for PCI-DSS compliance.</div>
              </div>
            </div>
          </div>
        </SideSheet>
      )}

      {/* 3. SideSheet: Clone / Duplicate to New Language (克隆为新语种邮件) */}
      {cloningSourceEmail && (
        <SideSheet
          id="side-sheet-email-clone"
          isOpen={true}
          onClose={() => setCloningSourceEmail(null)}
          title="克隆为新语种独立邮件"
          description={`将当前邮件【${cloningSourceEmail.name}】（${getLanguageMeta(cloningSourceEmail.language).flag} ${getLanguageMeta(cloningSourceEmail.language).nativeName}）复制为全新实体。`}
          icon={<CopyPlus className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setCloningSourceEmail(null)}
                className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExecuteClone}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CopyPlus className="w-3.5 h-3.5" /> 确认克隆并立即编辑
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              复制为一个全新的独立邮件实体，便于针对其他出海国家单独撰写或本地化微调。
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">选择目标出海语言</label>
              <ShadcnSelect
                value={cloneTargetLang}
                onValueChange={(val) => setCloneTargetLang(val as SupportedLanguage)}
                options={SUPPORTED_LANG_CONFIG.filter((l) => l.code !== cloningSourceEmail.language).map((l) => ({
                  value: l.code,
                  label: `${l.flag} ${l.nativeName} (${l.code})`,
                }))}
              />
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-xs space-y-1.5">
              <div className="text-[11px] text-zinc-500 font-medium">自动生成的独立编号与名称：</div>
              <div className="font-mono text-zinc-800 font-bold text-xs">
                {cloningSourceEmail.code.replace(/_[A-Z]{2}$/, "")}_{cloneTargetLang.split("-")[0].toUpperCase()}
              </div>
              <div className="text-zinc-600 text-xs">
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
          title="模拟真实测试发送"
          description={`使用海外通道向指定邮箱投递【${testSendingEmail.name}】（${getLanguageMeta(testSendingEmail.language).flag} ${testSendingEmail.language}）`}
          icon={<Send className="w-5 h-5 text-emerald-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setTestSendingEmail(null)}
                className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={isSending || !testEmailAddress}
                onClick={handleExecuteTestSend}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    发信投递中...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> 发起投递
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              系统将使用已配置的海外 SMTP / API 通道，向指定收件邮箱投递当前独立邮件。
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">测试收件人邮箱</label>
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">海外发信通道选择</label>
              <ShadcnSelect
                value={testSendChannel}
                onValueChange={(val) =>
                  setTestSendChannel(val as "SENDGRID" | "AWS_SES" | "RESEND")
                }
                options={[
                  { value: "SENDGRID", label: "SendGrid v3 API (US-East Primary Cluster)" },
                  { value: "AWS_SES", label: "Amazon SES Europe (eu-central-1 Frankfurt)" },
                  { value: "RESEND", label: "Resend Edge Global Delivery (Tokyo / Oregon)" },
                ]}
              />
            </div>

            {testSendResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="text-emerald-800 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  投递响应成功
                </div>
                <div className="text-[11px] font-mono text-emerald-700">
                  Message-ID: {testSendResult.messageId}
                </div>
                <div className="text-[10px] text-zinc-500">{testSendResult.log}</div>
              </div>
            )}
          </div>
        </SideSheet>
      )}
    </div>
  );
};
