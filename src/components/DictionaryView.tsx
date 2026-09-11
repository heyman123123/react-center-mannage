import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  CheckCircle2,
  Sparkles,
  Layers,
  Tag,
  Languages,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Globe,
  Info,
  CheckCircle,
  Code2,
  Smartphone,
  Server,
  LayoutTemplate,
  Monitor,
  Mail,
  ExternalLink,
} from "lucide-react";
import {
  DictionaryEntry,
  SupportedLanguage,
  Tenant,
  ProjectPlatform,
  DictionaryCategory,
} from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface DictionaryViewProps {
  dictionary: DictionaryEntry[];
  currentTenant: Tenant;
  onSaveEntry: (entry: DictionaryEntry) => void;
  onDeleteEntry?: (id: string) => void;
}

export const LANGUAGES: {
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

export const PLATFORM_OPTIONS: {
  key: ProjectPlatform;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { key: "CHECKOUT", label: "收银台 (Web Checkout)", icon: LayoutTemplate, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "PORTAL", label: "商户管理后台 (Portal)", icon: Monitor, color: "text-violet-600 bg-violet-50 border-violet-200" },
  { key: "GATEWAY_API", label: "网关API与错误码", icon: Server, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "MOBILE_SDK", label: "移动端原生SDK/App", icon: Smartphone, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "EMAIL_NOTIFY", label: "邮件与消息通知", icon: Mail, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
];

// 出海全项目标准常用词条预设模板 (涵盖收银台、商户平台、网关错误码、移动端、邮件与通知)
const PROJECT_PRESET_ENTRIES: {
  key: string;
  category: DictionaryCategory;
  platforms: ProjectPlatform[];
  description: string;
  translations: Record<SupportedLanguage, string>;
}[] = [
  {
    key: "checkout.pay_now_cta",
    category: "CHECKOUT",
    platforms: ["CHECKOUT", "MOBILE_SDK"],
    description: "全球海外收银台聚合支付CTA主按钮",
    translations: {
      "en-US": "Pay Securely Now →",
      "zh-CN": "立即安全结算 →",
      "ja-JP": "今すぐ安全に支払う →",
      "de-DE": "Jetzt sicher bezahlen →",
      "es-ES": "Pagar de forma segura ahora →",
      "fr-FR": "Payer en toute sécurité →",
    },
  },
  {
    key: "gateway.error.card_declined",
    category: "GATEWAY_ERRORS",
    platforms: ["GATEWAY_API", "CHECKOUT", "MOBILE_SDK"],
    description: "银行收单行拒绝发卡行拒绝交易通用错误响应信息",
    translations: {
      "en-US": "Your payment method was declined by the card issuer. Please try another card or contact your bank.",
      "zh-CN": "发卡行已拒绝此次交易。请尝试更换其他支付方式或联络发卡行核实。",
      "ja-JP": "カード会社により取引が拒否されました。別のカードをお試しいただくか、カード会社にお問い合わせください。",
      "de-DE": "Ihre Zahlungsmethode wurde vom Kartenaussteller abgelehnt. Bitte versuchen Sie eine andere Karte.",
      "es-ES": "Su método de pago fue rechazado por la entidad emisora. Por favor intente con otra tarjeta.",
      "fr-FR": "Votre moyen de paiement a été refusé par votre banque. Veuillez utiliser une autre carte.",
    },
  },
  {
    key: "portal.dashboard.net_revenue",
    category: "PORTAL",
    platforms: ["PORTAL"],
    description: "商户后台管理中台-实时净收入指标卡片主标题",
    translations: {
      "en-US": "Total Net Processed Revenue",
      "zh-CN": "实际结算净入账流水总额",
      "ja-JP": "決済純売上高（手数料控除後）",
      "de-DE": "Nettoumsatz gesamt",
      "es-ES": "Ingresos Netos Totales Procesados",
      "fr-FR": "Chiffre d'Affaires Net Traité",
    },
  },
  {
    key: "payment.receipt.title",
    category: "BILLING",
    platforms: ["EMAIL_NOTIFY", "PORTAL", "CHECKOUT"],
    description: "官方交易对账单与出海电子付款凭据主标题",
    translations: {
      "en-US": "Official Payment Confirmation & Receipt",
      "zh-CN": "官方交易对账单与电子付款凭据",
      "ja-JP": "決済完了のご案内・電子領収書（適格）",
      "de-DE": "Offizielle Zahlungsbestätigung und Beleg",
      "es-ES": "Confirmación y Recibo Oficial de Pago",
      "fr-FR": "Reçu Officiel et Confirmation de Paiement",
    },
  },
  {
    key: "security.verification.hint",
    category: "SECURITY",
    platforms: ["CHECKOUT", "PORTAL", "MOBILE_SDK", "EMAIL_NOTIFY"],
    description: "双重验证与一次性验证码防欺诈保密提示",
    translations: {
      "en-US": "Security Alert: This code is valid for 15 minutes. NovasPay staff will never ask for your verification code.",
      "zh-CN": "安全警示：该验证码15分钟内有效。官方客服与工作人员绝不会向您索取，切勿泄露给第三方。",
      "ja-JP": "セキュリティ警告：この認証コードの有効期限は15分間です。スタッフがコードをお尋ねすることはございません。",
      "de-DE": "Sicherheitshinweis: Dieser Code ist 15 Minuten gültig. Unsere Mitarbeiter werden Sie niemals nach dem Code fragen.",
      "es-ES": "Aviso de seguridad: Este código vence en 15 minutos. El personal de NovasPay nunca te pedirá tu código de verificación.",
      "fr-FR": "Alerte de sécurité : Ce code est valable 15 minutes. Nos équipes ne vous demanderont jamais ce code confidentiel.",
    },
  },
  {
    key: "subscription.auto_renew.notice",
    category: "LIFECYCLE",
    platforms: ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY"],
    description: "周期订阅自动续期扣划授权告知条款",
    translations: {
      "en-US": "Your subscription will automatically renew at the end of each billing cycle unless canceled prior to the renewal date.",
      "zh-CN": "除非在扣款日前主动取消，否则您的会员方案将在计费周期届满时自动按期续约扣划。",
      "ja-JP": "次回更新日までに解約手続きが行われない限り、ご契約は同一条件にて自動的に更新・決済されます。",
      "de-DE": "Ihr Abonnement verlängert sich automatisch am Ende jedes Abrechnungszeitraums, sofern es nicht gekündigt wird.",
      "es-ES": "Tu suscripción se renovará automáticamente al final de cada ciclo a menos que la canceles antes de la fecha de renovación.",
      "fr-FR": "Votre abonnement sera automatiquement renouvelé à la fin de chaque période, sauf résiliation avant l'échéance.",
    },
  },
];

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  dictionary,
  currentTenant,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [entryList, setEntryList] = useState<DictionaryEntry[]>(() => {
    // 确保每个词条都有 platforms 初始值
    return dictionary.map((item) => ({
      ...item,
      platforms: item.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"],
    }));
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [previewLanguage, setPreviewLanguage] = useState<SupportedLanguage>("en-US");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"COMPACT" | "MATRIX">("COMPACT");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCodeEntry, setActiveCodeEntry] = useState<DictionaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State - Default multi-language with all 6 languages
  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState<DictionaryCategory>("COMMON");
  const [formPlatforms, setFormPlatforms] = useState<ProjectPlatform[]>([
    "CHECKOUT",
    "PORTAL",
    "EMAIL_NOTIFY",
  ]);
  const [formDescription, setFormDescription] = useState("");
  const [formTranslations, setFormTranslations] = useState<Record<SupportedLanguage, string>>({
    "en-US": "",
    "zh-CN": "",
    "ja-JP": "",
    "de-DE": "",
    "es-ES": "",
    "fr-FR": "",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Add modal: defaults to adding all 6 languages and standard platforms
  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFormKey("");
    setFormCategory("COMMON");
    setFormPlatforms(["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"]);
    setFormDescription("");
    setFormTranslations({
      "en-US": "",
      "zh-CN": "",
      "ja-JP": "",
      "de-DE": "",
      "es-ES": "",
      "fr-FR": "",
    });
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setFormKey(entry.key);
    setFormCategory(entry.category);
    setFormPlatforms(entry.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY"]);
    setFormDescription(entry.description);
    setFormTranslations({
      "en-US": entry.translations["en-US"] || "",
      "zh-CN": entry.translations["zh-CN"] || "",
      "ja-JP": entry.translations["ja-JP"] || "",
      "de-DE": entry.translations["de-DE"] || "",
      "es-ES": entry.translations["es-ES"] || "",
      "fr-FR": entry.translations["fr-FR"] || "",
    });
    setIsModalOpen(true);
  };

  // Open Code Integration Helper
  const handleOpenCodeHelper = (entry: DictionaryEntry) => {
    setActiveCodeEntry(entry);
    setIsCodeModalOpen(true);
  };

  // Smart translate/auto-fill all 6 languages based on Chinese or English input
  const handleAutoTranslateAll = () => {
    const baseZh = formTranslations["zh-CN"].trim();
    const baseEn = formTranslations["en-US"].trim();

    if (!baseZh && !baseEn) {
      alert("请先在【简体中文】或【English】输入框中输入文案，系统将自动智能补齐其余所有语言！");
      return;
    }

    const source = baseZh || baseEn;
    const newTranslations: Record<SupportedLanguage, string> = { ...formTranslations };

    const matchedPreset = PROJECT_PRESET_ENTRIES.find(
      (p) =>
        p.key === formKey ||
        p.translations["zh-CN"].includes(source) ||
        p.translations["en-US"].toLowerCase().includes(source.toLowerCase())
    );

    if (matchedPreset) {
      LANGUAGES.forEach((l) => {
        newTranslations[l.code] = matchedPreset.translations[l.code];
      });
      showToast("已匹配出海全项目金融标准词典，自动补全 6 国语言！");
    } else {
      if (baseZh) {
        newTranslations["en-US"] = baseEn || `${baseZh} (Official English)`;
        newTranslations["ja-JP"] = formTranslations["ja-JP"] || `${baseZh}（公式日本語）`;
        newTranslations["de-DE"] = formTranslations["de-DE"] || `${baseZh} (Offizielle Deutsche Fassung)`;
        newTranslations["es-ES"] = formTranslations["es-ES"] || `${baseZh} (Versión en Español)`;
        newTranslations["fr-FR"] = formTranslations["fr-FR"] || `${baseZh} (Version Française)`;
      } else {
        newTranslations["zh-CN"] = formTranslations["zh-CN"] || `${baseEn}（官方中文译文）`;
        newTranslations["ja-JP"] = formTranslations["ja-JP"] || `${baseEn} (公式日本語)`;
        newTranslations["de-DE"] = formTranslations["de-DE"] || `${baseEn} (Deutsch)`;
        newTranslations["es-ES"] = formTranslations["es-ES"] || `${baseEn} (Español)`;
        newTranslations["fr-FR"] = formTranslations["fr-FR"] || `${baseEn} (Français)`;
      }
      showToast("已智能补全全套 6 种语言文案！您可直接进行细节微调。");
    }

    setFormTranslations(newTranslations);
  };

  // Quick insert industry preset
  const handleApplyPreset = (preset: (typeof PROJECT_PRESET_ENTRIES)[0]) => {
    setFormKey(preset.key);
    setFormCategory(preset.category);
    setFormPlatforms(preset.platforms);
    setFormDescription(preset.description);
    setFormTranslations({ ...preset.translations });
    showToast(`已应用【${preset.key}】全项目出海预设，已默认填充全部 6 种语言！`);
  };

  // Submit dictionary entry (ensures default multi-language added)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const guaranteedTranslations: Record<SupportedLanguage, string> = {
      "en-US": formTranslations["en-US"] || formTranslations["zh-CN"] || formKey,
      "zh-CN": formTranslations["zh-CN"] || formTranslations["en-US"] || formKey,
      "ja-JP": formTranslations["ja-JP"] || formTranslations["en-US"] || formKey,
      "de-DE": formTranslations["de-DE"] || formTranslations["en-US"] || formKey,
      "es-ES": formTranslations["es-ES"] || formTranslations["en-US"] || formKey,
      "fr-FR": formTranslations["fr-FR"] || formTranslations["en-US"] || formKey,
    };

    if (editingEntry) {
      const updated: DictionaryEntry = {
        ...editingEntry,
        key: formKey.trim(),
        category: formCategory,
        platforms: formPlatforms,
        description: formDescription.trim(),
        translations: guaranteedTranslations,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      };
      setEntryList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveEntry(updated);
      showToast(`全项目字典词条【${updated.key}】更新成功！各端 6 种语言已同步`);
    } else {
      const newEntry: DictionaryEntry = {
        id: `dict_${Date.now().toString().slice(-6)}`,
        key: formKey.trim(),
        category: formCategory,
        platforms: formPlatforms,
        description: formDescription.trim(),
        referencedTemplatesCount: 1,
        translations: guaranteedTranslations,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      };
      setEntryList((prev) => [newEntry, ...prev]);
      onSaveEntry(newEntry);
      showToast(`新词条【${newEntry.key}】已加入全项目词典！默认 6 国语言已就绪`);
    }
    setIsModalOpen(false);
  };

  // Delete entry
  const handleDelete = (id: string, key: string) => {
    if (window.confirm(`确定要从全项目字典中删除词条【${key}】吗？删除后各端调用将回退至键名或默认兜底。`)) {
      setEntryList((prev) => prev.filter((item) => item.id !== id));
      if (onDeleteEntry) onDeleteEntry(id);
      showToast(`词条【${key}】已从全项目字典删除`);
    }
  };

  // Batch auto-complete missing languages for all entries
  const handleBatchAutoComplete = () => {
    let completedCount = 0;
    const updated = entryList.map((entry) => {
      const trans = { ...entry.translations };
      let changed = false;
      const fallback = trans["en-US"] || trans["zh-CN"] || entry.key;

      LANGUAGES.forEach((l) => {
        if (!trans[l.code]) {
          trans[l.code] = `${fallback} (${l.nativeName})`;
          changed = true;
        }
      });

      if (changed) {
        completedCount++;
        const item: DictionaryEntry = { ...entry, translations: trans };
        onSaveEntry(item);
        return item;
      }
      return entry;
    });

    setEntryList(updated);
    showToast(`已成功为全项目 ${completedCount} 个词条补齐全部 6 国多语言！`);
  };

  // Export dictionary as Web i18n JSON
  const handleExportWebJSON = () => {
    const i18nBundle: Record<string, Record<string, string>> = {};
    LANGUAGES.forEach((l) => {
      i18nBundle[l.code] = {};
      entryList.forEach((entry) => {
        i18nBundle[l.code][entry.key] = entry.translations[l.code] || entry.key;
      });
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(i18nBundle, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `project_i18n_locales_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("全项目前端/API 多语言包 JSON 导出成功！");
  };

  // Toggle platform in form
  const togglePlatform = (p: ProjectPlatform) => {
    setFormPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  // Filter
  const filteredEntries = entryList.filter((item) => {
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesPlatform =
      platformFilter === "ALL" ||
      (item.platforms && item.platforms.includes(platformFilter as ProjectPlatform));
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.key.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      Object.values(item.translations).some((t) => typeof t === "string" && t.toLowerCase().includes(query));
    return matchesCategory && matchesPlatform && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold text-emerald-600 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* Header - 全项目字典管理全局定位 */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                <Globe className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">全项目字典管理</h1>
              <span className="px-2.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-xs font-semibold flex items-center gap-1">
                <Layers className="w-3 h-3" />
                全工程统一国际化中心 (Global I18n Core)
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                默认配置全 6 种语言
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 max-w-3xl leading-relaxed">
              面向出海全工程的统一多语言国际化中心。打通【海外收银台 Checkout】、【商户后台 Portal】、【网关API与错误代码】、【移动端原生SDK】及【全域交易凭据/邮件】，实现全项目 6 国多语言动态同步、统一词条版本与一键出海本地化发布。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBatchAutoComplete}
              className="px-3 py-2 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
              title="智能补全所有词条的 6 种语言"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>智能补全 6 国多语言</span>
            </button>

            <button
              onClick={handleExportWebJSON}
              className="px-3 py-2 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
              title="导出全项目多语言包 JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>导出多端 i18n 资源</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新增全项目词条 (默认多语言)</span>
            </button>
          </div>
        </div>

        {/* Global Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-zinc-100">
          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-violet-500" />
              全项目统一词条
            </div>
            <div className="text-lg font-bold font-mono text-zinc-900 mt-0.5">
              {entryList.length} <span className="text-xs font-normal text-zinc-400">个统一标识符 (Keys)</span>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              全工程覆盖终端
            </div>
            <div className="text-xs text-zinc-700 font-medium mt-1 flex items-center gap-1 flex-wrap">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">收银台</span>
              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px]">商户后台</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">网关API</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px]">移动SDK</span>
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">邮件通知</span>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              默认多语言覆盖
            </div>
            <div className="text-xs text-zinc-700 font-medium mt-1 flex items-center gap-1">
              {LANGUAGES.map((l) => (
                <span key={l.code} title={l.label}>
                  {l.flag}
                </span>
              ))}
              <span className="text-[10px] text-emerald-600 font-bold ml-1">6/6 默认就绪</span>
            </div>
          </div>

          <div className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-emerald-500" />
              调用方式支持
            </div>
            <div className="text-xs text-zinc-600 font-mono mt-1">
              t("key") • API • iOS • Android • {"{{dict}}"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Categories */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-zinc-400 text-xs font-semibold">业务分类:</span>
            {[
              { key: "ALL", label: "全部业务" },
              { key: "CHECKOUT", label: "海外收银台" },
              { key: "GATEWAY_ERRORS", label: "网关与错误码" },
              { key: "PORTAL", label: "商户管理后台" },
              { key: "BILLING", label: "交易与账单" },
              { key: "LIFECYCLE", label: "订阅周期" },
              { key: "COMMON", label: "通用词汇" },
              { key: "SECURITY", label: "账号安全" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategoryFilter(tab.key)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === tab.key
                    ? "bg-violet-600 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="搜索全项目键名 / 描述 / 任意语种译文..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-violet-500 transition-colors"
            />
          </div>
        </div>

        {/* Platform scope & language selector */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-400 text-[11px] font-semibold">工程终端过滤:</span>
            <button
              onClick={() => setPlatformFilter("ALL")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                platformFilter === "ALL" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              全部终端
            </button>
            {PLATFORM_OPTIONS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  onClick={() => setPlatformFilter(p.key)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    platformFilter === p.key
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{p.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-[11px]">当前巡检语种:</span>
            <div className="flex items-center gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setPreviewLanguage(l.code)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    previewLanguage === l.code
                      ? "bg-violet-600 text-white font-bold shadow-xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.nativeName}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg ml-2">
              <button
                onClick={() => setViewMode("COMPACT")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "COMPACT" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                单列视图
              </button>
              <button
                onClick={() => setViewMode("MATRIX")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "MATRIX" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                多国矩阵
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dictionary Table: 宽度规范化，操作列固定在右边 */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-500 font-semibold text-[11px]">
                <th className="py-3.5 px-4 w-[280px]">词条键名 (Key) & 描述</th>
                <th className="py-3.5 px-3 w-[130px]">业务分类</th>
                <th className="py-3.5 px-3 w-[200px]">全项目应用终端</th>
                {viewMode === "COMPACT" ? (
                  <th className="py-3.5 px-4 min-w-[300px]">
                    巡检译文 ({LANGUAGES.find((l) => l.code === previewLanguage)?.flag}{" "}
                    {LANGUAGES.find((l) => l.code === previewLanguage)?.nativeName})
                  </th>
                ) : (
                  <>
                    <th className="py-3.5 px-3 w-[190px]">🇺🇸 英语 (en-US)</th>
                    <th className="py-3.5 px-3 w-[190px]">🇨🇳 中文 (zh-CN)</th>
                    <th className="py-3.5 px-3 w-[190px]">🇯🇵 日语 (ja-JP)</th>
                    <th className="py-3.5 px-3 w-[190px]">🇩🇪 德语 (de-DE)</th>
                  </>
                )}
                <th className="py-3.5 px-3 w-[140px]">多语言状态</th>
                <th className="py-3.5 px-3 w-[110px]">更新时间</th>
                {/* 关键：操作列固定在右边 */}
                <th className="py-3.5 px-4 w-[160px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEntries.map((item) => {
                const currentText = item.translations[previewLanguage] || "—";
                const isCopied = copiedKey === item.id;
                const isExpanded = !!expandedKeys[item.id];
                const completedCount = Object.values(item.translations).filter(Boolean).length;
                const platforms = item.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY"];

                return (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-zinc-50/80 transition-colors group">
                      {/* Key & Description */}
                      <td className="py-3.5 px-4 w-[280px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 truncate max-w-[220px]" title={item.key}>
                            {item.key}
                          </span>
                          <button
                            onClick={() => handleCopy(item.key, item.id)}
                            className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                            title="复制键名"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-1 line-clamp-1" title={item.description}>
                          {item.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 w-[130px] whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          {item.category === "CHECKOUT"
                            ? "海外收银台"
                            : item.category === "GATEWAY_ERRORS"
                            ? "网关错误码"
                            : item.category === "PORTAL"
                            ? "商户后台"
                            : item.category === "BILLING"
                            ? "交易与账单"
                            : item.category === "LIFECYCLE"
                            ? "订阅周期"
                            : item.category === "SECURITY"
                            ? "账号安全"
                            : "通用词汇"}
                        </span>
                      </td>

                      {/* Platforms Scope */}
                      <td className="py-3.5 px-3 w-[200px]">
                        <div className="flex items-center gap-1 flex-wrap">
                          {platforms.slice(0, 3).map((plat) => {
                            const opt = PLATFORM_OPTIONS.find((p) => p.key === plat);
                            return (
                              <span
                                key={plat}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200"
                              >
                                {opt ? opt.label.split(" ")[0] : plat}
                              </span>
                            );
                          })}
                          {platforms.length > 3 && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              +{platforms.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Translations */}
                      {viewMode === "COMPACT" ? (
                        <td className="py-3.5 px-4 min-w-[300px]">
                          <div className="text-zinc-900 font-medium line-clamp-2 leading-relaxed">{currentText}</div>
                        </td>
                      ) : (
                        <>
                          <td className="py-3.5 px-3 w-[190px] text-zinc-800">
                            <div className="line-clamp-2" title={item.translations["en-US"]}>
                              {item.translations["en-US"] || "—"}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 w-[190px] text-zinc-800">
                            <div className="line-clamp-2" title={item.translations["zh-CN"]}>
                              {item.translations["zh-CN"] || "—"}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 w-[190px] text-zinc-800">
                            <div className="line-clamp-2" title={item.translations["ja-JP"]}>
                              {item.translations["ja-JP"] || "—"}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 w-[190px] text-zinc-800">
                            <div className="line-clamp-2" title={item.translations["de-DE"]}>
                              {item.translations["de-DE"] || "—"}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Completeness */}
                      <td className="py-3.5 px-3 w-[140px] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {completedCount}/6 多语言就绪
                        </span>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-3 w-[110px] whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {item.updatedAt.substring(0, 10)}
                      </td>

                      {/* Actions: 固定在最右边 */}
                      <td className="py-3.5 px-4 w-[160px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenCodeHelper(item)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="查看全项目各端集成代码"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                            title="展开 6 种语言详细对照"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded-lg transition-colors font-semibold"
                            title="编辑词条多语言"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id, item.key)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="删除词条"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable 6-Language Drawer */}
                    {isExpanded && (
                      <tr className="bg-violet-50/40">
                        <td colSpan={viewMode === "COMPACT" ? 7 : 10} className="p-4 border-b border-zinc-200">
                          <div className="bg-white rounded-xl p-4 border border-violet-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-900 pb-2 border-b border-zinc-100">
                              <span className="flex items-center gap-1.5">
                                <Languages className="w-4 h-4 text-violet-600" />
                                【{item.key}】全项目 6 国多语言完整译文对照
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenCodeHelper(item)}
                                  className="text-violet-600 hover:text-violet-800 text-[11px] font-medium flex items-center gap-1 bg-violet-50 px-2 py-1 rounded"
                                >
                                  <Code2 className="w-3 h-3" />
                                  <span>查看各端调用示例</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {LANGUAGES.map((l) => (
                                <div key={l.code} className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-xs space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                                    <span className="flex items-center gap-1">
                                      <span>{l.flag}</span>
                                      <span>{l.nativeName}</span>
                                    </span>
                                    <span className="font-mono text-zinc-400 text-[10px]">{l.code}</span>
                                  </div>
                                  <div className="text-zinc-900 font-sans text-xs bg-white p-2 rounded border border-zinc-200/80 leading-relaxed min-h-[42px]">
                                    {item.translations[l.code] || (
                                      <span className="text-zinc-400 italic">未填</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Snippet Helper SideSheet */}
      {isCodeModalOpen && activeCodeEntry && (
        <SideSheet
          id="side-sheet-dict-code"
          isOpen={true}
          onClose={() => setIsCodeModalOpen(false)}
          title={`全项目调用示例: ${activeCodeEntry.key}`}
          description="该词条可在全工程各个终端模块通过标准 i18n 客户端无缝调用"
          icon={<Code2 className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-xl"
          footer={
            <button
              type="button"
              onClick={() => setIsCodeModalOpen(false)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              关闭
            </button>
          }
        >
          <div className="space-y-3 text-xs">
            {/* React / Frontend */}
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
                  Web 前端 (React / Vue / Next.js / 收银台组件)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(`t("${activeCodeEntry.key}")`, "code_react")}
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>复制</span>
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`import { useTranslation } from "react-i18next";\nconst { t } = useTranslation();\n\n// 渲染国际化文本\n<Button>{t("${activeCodeEntry.key}")}</Button>`}
              </pre>
            </div>

            {/* Backend API & Error Code */}
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-600" />
                  后端 API 网关响应与错误码 (Node.js / Java / Go)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`i18n.resolve(req.locale, "${activeCodeEntry.key}")`, "code_api")
                  }
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>复制</span>
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`// 根据请求头 Accept-Language 或客户端参数自动本地化\nconst message = i18n.resolve(req.locale, "${activeCodeEntry.key}");\nres.status(400).json({ code: "${activeCodeEntry.key}", error: message });`}
              </pre>
            </div>

            {/* Mobile SDK */}
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  移动端原生 SDK (iOS Swift & Android Kotlin)
                </span>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`// iOS Swift:\nlet title = NSLocalizedString("${activeCodeEntry.key}", comment: "")\n\n// Android Kotlin:\nval title = getString(R.string.${activeCodeEntry.key.replace(/\./g, "_")})`}
              </pre>
            </div>

            {/* Email & Notifications */}
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
              <div className="flex items-center justify-between font-semibold text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  交易凭据与通知邮件模版插值
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(`{{dict.${activeCodeEntry.key}}}`, "code_mail")}
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>复制</span>
                </button>
              </div>
              <pre className="bg-zinc-900 text-zinc-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`<h1>{{dict.${activeCodeEntry.key}}}</h1>`}
              </pre>
            </div>
          </div>
        </SideSheet>
      )}

      {/* Add / Edit Dictionary SideSheet (全项目维度，默认 6 种语言) */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-dict-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingEntry ? `编辑全项目词条: ${editingEntry.key}` : "新增全项目字典词条 (默认配置 6 国语言)"}
          description="统一字典是全工程的国际化单一事实来源，配置后自动同步给收银台、商户中台、网关API、移动端与通知邮件"
          icon={<Globe className="w-5 h-5 text-violet-600" />}
          widthClass="max-w-2xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-100 font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
              >
                {editingEntry ? "保存全项目词条更改" : "确认添加词条 (默认 6 语种生效)"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Presets Bar */}
            <div className="bg-violet-50/70 p-3 rounded-xl border border-violet-200/80 space-y-1.5">
              <div className="text-[11px] font-bold text-violet-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                快速插入出海全工程标准词条模板（点击自动填充全套 6 种语言）：
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PROJECT_PRESET_ENTRIES.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2 py-1 bg-white hover:bg-violet-100 text-violet-700 rounded-lg text-[10px] font-mono border border-violet-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    +{preset.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Key and Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  统一词条键名 (Key Identifier) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：checkout.pay_now_cta 或 gateway.error.card_declined"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="w-full p-2 bg-white border border-zinc-200 rounded-xl font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  所属业务场景分类 <span className="text-rose-500">*</span>:
                </label>
                <ShadcnSelect
                  value={formCategory}
                  onValueChange={(val) => setFormCategory(val as DictionaryCategory)}
                  options={[
                    { value: "CHECKOUT", label: "海外收银台 (Web Checkout)" },
                    { value: "GATEWAY_ERRORS", label: "支付网关响应与错误码 (Gateway Errors)" },
                    { value: "PORTAL", label: "商户管理中台 (Merchant Portal)" },
                    { value: "BILLING", label: "交易扣款与凭据 (Billing / Receipt)" },
                    { value: "LIFECYCLE", label: "订阅与周期扣款 (Lifecycle)" },
                    { value: "COMMON", label: "全项目通用 (Common / Branding)" },
                    { value: "SECURITY", label: "账号安全与风控 (Security)" },
                    { value: "PROMOTION", label: "营销促销 (Promotion)" },
                  ]}
                />
              </div>
            </div>

            {/* Platforms Selection */}
            <div>
              <label className="font-semibold text-zinc-700 block mb-1.5">
                全项目适用终端范围 (可多选):
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PLATFORM_OPTIONS.map((p) => {
                  const isSelected = formPlatforms.includes(p.key);
                  const Icon = p.icon;
                  return (
                    <button
                      type="button"
                      key={p.key}
                      onClick={() => togglePlatform(p.key)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                用途说明 (业务含义与开发指引):
              </label>
              <input
                type="text"
                required
                placeholder="如：展示在全球收银台付款按钮上的文案，支持多货币与通道"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full p-2 bg-white border border-zinc-200 rounded-xl text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* 6 Languages Multi-language Configuration Box */}
            <div className="pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-indigo-600" />
                  <span>默认多语言配置 (全套 6 种支持语种):</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoTranslateAll}
                  className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-violet-200 transition-colors cursor-pointer"
                  title="输入中文或英文后，点击一键生成其他所有语言"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>✨ 一键智能补齐其余多语言</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LANGUAGES.map((l) => (
                  <div key={l.code} className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/90 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-800">
                      <span className="flex items-center gap-1.5">
                        <span>{l.flag}</span>
                        <span>{l.nativeName}</span>
                        <span className="font-mono text-zinc-400 font-normal">({l.code})</span>
                      </span>
                      {formTranslations[l.code] ? (
                        <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> 已配置
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-normal">待输入</span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      placeholder={`输入 ${l.nativeName} 对应文案...`}
                      value={formTranslations[l.code] || ""}
                      onChange={(e) =>
                        setFormTranslations((prev) => ({
                          ...prev,
                          [l.code]: e.target.value,
                        }))
                      }
                      className="w-full p-2 bg-white border border-zinc-200 rounded-lg text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </SideSheet>
      )}
    </div>
  );
};
