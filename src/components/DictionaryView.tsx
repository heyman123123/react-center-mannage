import React, { useState } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  BookOpen,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  CheckCircle2,
  Sparkles,
  Languages,
  Trash2,
  Download,
  ChevronUp,
  Globe,
  Code2,
  Smartphone,
  Server,
  LayoutTemplate,
  Monitor,
  Mail,
  RefreshCw,
  ListFilter,
  Eye,
  Link2,
  Settings2,
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
import { Popconfirm } from "./ui/Popconfirm";

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

// 可扩展候选语言池（字典管理 → 语种配置中可添加到全局多语言）
export const AVAILABLE_LANGUAGES: {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
}[] = [
  { code: "ko-KR", label: "한국어 (ko-KR)", flag: "🇰🇷", nativeName: "한국어" },
  { code: "pt-BR", label: "Português (pt-BR)", flag: "🇧🇷", nativeName: "Português" },
  { code: "it-IT", label: "Italiano (it-IT)", flag: "🇮🇹", nativeName: "Italiano" },
  { code: "ru-RU", label: "Русский (ru-RU)", flag: "🇷🇺", nativeName: "Русский" },
  { code: "ar-SA", label: "العربية (ar-SA)", flag: "🇸🇦", nativeName: "العربية" },
  { code: "hi-IN", label: "हिन्दी (hi-IN)", flag: "🇮🇳", nativeName: "हिन्दी" },
  { code: "nl-NL", label: "Nederlands (nl-NL)", flag: "🇳🇱", nativeName: "Nederlands" },
  { code: "sv-SE", label: "Svenska (sv-SE)", flag: "🇸🇪", nativeName: "Svenska" },
  { code: "pl-PL", label: "Polski (pl-PL)", flag: "🇵🇱", nativeName: "Polski" },
  { code: "tr-TR", label: "Türkçe (tr-TR)", flag: "🇹🇷", nativeName: "Türkçe" },
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

// 出海全项目标准常用词条预设模板
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

const CATEGORY_LABELS: { key: DictionaryCategory; label: string }[] = [
  { key: "COMMON", label: "通用词汇" },
  { key: "BILLING", label: "交易与账单" },
  { key: "LIFECYCLE", label: "订阅周期" },
  { key: "PROMOTION", label: "营销促销" },
  { key: "SECURITY", label: "账号安全" },
  { key: "CHECKOUT", label: "海外收银台" },
  { key: "PORTAL", label: "商户管理后台" },
  { key: "GATEWAY_ERRORS", label: "网关与错误码" },
  { key: "CURRENCY", label: "结算货币" },
];

// 字典词条 → 关联位置（多语言关联映射：收银台/商户后台/网关/移动端/通知邮件模板）
export const DICT_REFERENCE_POINTS: {
  keyPrefix: string;
  label: string;
  scope: string;
}[] = [
  { keyPrefix: "checkout.", label: "海外收银台", scope: "收银台按钮/提示文案" },
  { keyPrefix: "payment.receipt", label: "交易通知邮件", scope: "收据邮件主题与正文" },
  { keyPrefix: "subscription.", label: "订阅周期邮件", scope: "续费/扣款通知" },
  { keyPrefix: "security.", label: "安全验证通知", scope: "验证码/风控邮件" },
  { keyPrefix: "account.", label: "账号安全", scope: "密码重置/登录通知" },
  { keyPrefix: "email.footer", label: "邮件页脚", scope: "退订与偏好链接" },
  { keyPrefix: "support.", label: "技术支持", scope: "客服联系链接" },
  { keyPrefix: "currency.", label: "结算货币", scope: "收银台币种/账单/对账单" },
  { keyPrefix: "gateway.error", label: "网关错误码", scope: "API 响应与错误提示" },
  { keyPrefix: "portal.", label: "商户管理后台", scope: "后台导航与指标卡片" },
];

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  dictionary,
  currentTenant,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [entryList, setEntryList] = useState<DictionaryEntry[]>(() => {
    return dictionary.map((item) => ({
      ...item,
      platforms: item.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"],
    }));
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [previewLanguage, setPreviewLanguage] = useState<string>("en-US");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [treeKeyword, setTreeKeyword] = useState("");

  // ===== 语种配置（字典管理可配置"有哪些多语言"）=====
  const [languages, setLanguages] = useState<
    { code: string; label: string; flag: string; nativeName: string }[]
  >(LANGUAGES);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [customLangCode, setCustomLangCode] = useState("");
  const [customLangName, setCustomLangName] = useState("");
  const [customLangFlag, setCustomLangFlag] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCodeEntry, setActiveCodeEntry] = useState<DictionaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState<DictionaryCategory>("COMMON");
  const [formPlatforms, setFormPlatforms] = useState<ProjectPlatform[]>([
    "CHECKOUT",
    "PORTAL",
    "EMAIL_NOTIFY",
  ]);
  const [formDescription, setFormDescription] = useState("");
  const [formTranslations, setFormTranslations] = useState<Record<string, string>>({});

  // 基于当前语种配置构造空译文表单
  const emptyTranslations = (): Record<string, string> => {
    const t: Record<string, string> = {};
    languages.forEach((l) => (t[l.code] = ""));
    return t;
  };

  // 添加语种：同步所有词条补齐该语言（默认沿用 en-US/zh-CN 兜底文案）
  const handleAddLanguage = (lang: { code: string; label: string; flag: string; nativeName: string }) => {
    if (languages.some((l) => l.code === lang.code)) {
      showToast(`语言 ${lang.nativeName} (${lang.code}) 已在多语言配置中`);
      return;
    }
    setLanguages((prev) => [...prev, lang]);
    setEntryList((prev) =>
      prev.map((e) => {
        const fallback = e.translations["en-US"] || e.translations["zh-CN"] || "";
        return { ...e, translations: { ...e.translations, [lang.code]: fallback } };
      })
    );
    showToast(`已添加语言 ${lang.nativeName} (${lang.code})，所有词条已自动补齐占位译文`);
  };

  // 移除语种：同步移除所有词条该语言译文
  const handleRemoveLanguage = (lang: { code: string; label: string; flag: string; nativeName: string }) => {
    if (languages.length <= 1) {
      showToast("至少需要保留一种语言");
      return;
    }
    setLanguages((prev) => prev.filter((l) => l.code !== lang.code));
    setEntryList((prev) =>
      prev.map((e) => {
        const t = { ...e.translations };
        delete t[lang.code];
        return { ...e, translations: t };
      })
    );
    setPreviewLanguage((prev) => (prev === lang.code ? languages[0].code : prev));
    showToast(`已移除语言 ${lang.nativeName} (${lang.code})`);
  };

  // 自定义添加语种
  const handleAddCustomLanguage = () => {
    const code = customLangCode.trim();
    const name = customLangName.trim();
    if (!code || !name) {
      showToast("请填写语言代码与语言名称");
      return;
    }
    handleAddLanguage({
      code,
      label: `${name} (${code})`,
      flag: customLangFlag.trim() || "🌐",
      nativeName: name,
    });
    setCustomLangCode("");
    setCustomLangName("");
    setCustomLangFlag("");
  };

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

  const handleOpenAdd = (presetCategory?: DictionaryCategory) => {
    setEditingEntry(null);
    setFormKey("");
    setFormCategory(presetCategory || "COMMON");
    setFormPlatforms(["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"]);
    setFormDescription("");
    setFormTranslations(emptyTranslations());
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setFormKey(entry.key);
    setFormCategory(entry.category);
    setFormPlatforms(entry.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY"]);
    setFormDescription(entry.description);
    const t: Record<string, string> = {};
    languages.forEach((l) => (t[l.code] = entry.translations[l.code] || ""));
    setFormTranslations(t);
    setIsModalOpen(true);
  };

  const handleOpenCodeHelper = (entry: DictionaryEntry) => {
    setActiveCodeEntry(entry);
    setIsCodeModalOpen(true);
  };

  const handleAutoTranslateAll = () => {
    const baseZh = formTranslations["zh-CN"].trim();
    const baseEn = formTranslations["en-US"].trim();

    if (!baseZh && !baseEn) {
      showToast("请先输入简体中文或 English 文案，再一键补齐其余语言");
      return;
    }

    const source = baseZh || baseEn;
    const newTranslations: Record<string, string> = { ...formTranslations };

    const matchedPreset = PROJECT_PRESET_ENTRIES.find(
      (p) =>
        p.key === formKey ||
        p.translations["zh-CN"].includes(source) ||
        p.translations["en-US"].toLowerCase().includes(source.toLowerCase())
    );

    if (matchedPreset) {
      languages.forEach((l) => {
        newTranslations[l.code] = matchedPreset.translations[l.code] || newTranslations["en-US"] || "";
      });
      showToast(`已匹配出海全项目标准词典，自动补全 ${languages.length} 种语言！`);
    } else {
      const fallbackMap: Record<string, string> = {};
      languages.forEach((l) => {
        if (l.code === "en-US") {
          fallbackMap[l.code] = baseEn || `${baseZh} (Official English)`;
        } else if (l.code === "zh-CN") {
          fallbackMap[l.code] = baseZh || `${baseEn}（官方中文译文）`;
        } else {
          fallbackMap[l.code] = baseZh || baseEn;
        }
      });
      languages.forEach((l) => {
        newTranslations[l.code] = formTranslations[l.code] || fallbackMap[l.code] || "";
      });
      showToast(`已智能补全全套 ${languages.length} 种语言文案！您可直接进行细节微调。`);
    }

    setFormTranslations(newTranslations);
  };

  const handleApplyPreset = (preset: (typeof PROJECT_PRESET_ENTRIES)[0]) => {
    setFormKey(preset.key);
    setFormCategory(preset.category);
    setFormPlatforms(preset.platforms);
    setFormDescription(preset.description);
    const t: Record<string, string> = {};
    languages.forEach((l) => (t[l.code] = preset.translations[l.code] || ""));
    setFormTranslations(t);
    showToast(`已应用【${preset.key}】全项目出海预设，已默认填充全部 ${languages.length} 种语言！`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const guaranteedTranslations: Record<string, string> = {};
    languages.forEach((l) => {
      if (l.code === "en-US") {
        guaranteedTranslations[l.code] = formTranslations["en-US"] || formTranslations["zh-CN"] || formKey;
      } else if (l.code === "zh-CN") {
        guaranteedTranslations[l.code] = formTranslations["zh-CN"] || formTranslations["en-US"] || formKey;
      } else {
        guaranteedTranslations[l.code] = formTranslations[l.code] || formTranslations["en-US"] || formKey;
      }
    });

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
      showToast(`全项目字典词条【${updated.key}】更新成功！各端 ${languages.length} 种语言已同步`);
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
      showToast(`新词条【${newEntry.key}】已加入全项目词典！默认 ${languages.length} 种语言已就绪`);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, key: string) => {
    setEntryList((prev) => prev.filter((item) => item.id !== id));
    if (onDeleteEntry) onDeleteEntry(id);
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    showToast(`词条【${key}】已从全项目字典删除`);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setEntryList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    if (onDeleteEntry) selectedIds.forEach((id) => onDeleteEntry(id));
    setSelectedIds([]);
    showToast(`已删除 ${selectedIds.length} 个词条`);
  };

  const handleBatchAutoComplete = () => {
    let completedCount = 0;
    const updated = entryList.map((entry) => {
      const trans = { ...entry.translations };
      let changed = false;
      const fallback = trans["en-US"] || trans["zh-CN"] || entry.key;

      // 补齐当前配置的所有语种（含新增语种）
      languages.forEach((l) => {
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
    showToast(`已成功为全项目 ${completedCount} 个词条补齐全部 ${languages.length} 种多语言！`);
  };

  const handleExportWebJSON = () => {
    const i18nBundle: Record<string, Record<string, string>> = {};
    languages.forEach((l) => {
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

  const togglePlatform = (p: ProjectPlatform) => {
    setFormPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const filteredEntries = entryList.filter((item) => {
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.key.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      Object.values(item.translations).some((t) => typeof t === "string" && t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const currentCategoryLabel =
    categoryFilter === "ALL" ? "全部" : CATEGORY_LABELS.find((c) => c.key === categoryFilter)?.label || "全部";

  const visibleCategoryKeys = CATEGORY_LABELS.filter((c) =>
    !treeKeyword ||
    c.label.toLowerCase().includes(treeKeyword.toLowerCase())
  );

  // 计算词条关联位置（映射到多语言关联点：邮件模板 / 收银台 / 网关等）
  const getReferencePoints = (item: DictionaryEntry) => {
    const matched = DICT_REFERENCE_POINTS.filter((p) => item.key.startsWith(p.keyPrefix));
    return matched.length > 0 ? matched : [{ keyPrefix: item.category, label: item.category, scope: item.category }];
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="flex gap-3 items-start font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 左侧：类型分类栏 ===== */}
      <div className="w-48 shrink-0 bg-surface border border-line rounded-xl shadow-card overflow-hidden lg:sticky lg:top-4">
        <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-fg-secondary" />
            类型
          </span>
        </div>

        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索关键字"
              value={treeKeyword}
              onChange={(e) => setTreeKeyword(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="p-2 space-y-0.5 max-h-[70vh] overflow-y-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
              categoryFilter === "ALL"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-fg-secondary hover:bg-hover"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              全部
            </span>
            <span className="text-[10px] font-mono text-fg-tertiary">{entryList.length}</span>
          </button>

          {visibleCategoryKeys.map((c) => {
            const count = entryList.filter((e) => e.category === c.key).length;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryFilter(c.key)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  categoryFilter === c.key
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-fg-secondary hover:bg-hover"
                }`}
              >
                <span>{c.label}</span>
                <span className="text-[10px] font-mono text-fg-tertiary">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 右侧：字典列表 ===== */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 标题与工具栏 */}
        <div className="bg-surface border border-line rounded-xl shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-bold text-fg">
            <span>字典列表</span>
            <span className="text-fg-tertiary font-normal text-xs">（{currentCategoryLabel}）</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedIds([]);
                setEntryList(dictionary.map((item) => ({ ...item, platforms: item.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"] })));
                showToast("字典数据已刷新");
              }}
              className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="刷新字典数据"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>

            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增
            </button>

            {selectedIds.length === 0 ? (
              <button
                type="button"
                disabled
                className="px-2.5 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            ) : (
              <Popconfirm
                title={`删除选中的 ${selectedIds.length} 个词条？`}
                description="删除后所有关联的多语言位置将回退为键名本身，请谨慎操作。"
                onConfirm={handleBatchDelete}
              >
                <button
                  type="button"
                  className="px-2.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </Popconfirm>
            )}            <div className="w-px h-5 bg-hover mx-1" />

            <button
              type="button"
              onClick={handleBatchAutoComplete}
              className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="智能补全所有词条的当前配置语种"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              智能补全 {languages.length} 语
            </button>

            <button
              type="button"
              onClick={handleExportWebJSON}
              className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="导出全项目多语言包 JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              导出 i18n
            </button>
          </div>
        </div>

        {/* 语种切换 */}
        <div className="bg-surface border border-line rounded-xl shadow-card px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-fg-secondary flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-violet-500" />
            巡检语种：
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setPreviewLanguage(l.code)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  previewLanguage === l.code
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-hover text-fg-secondary hover:bg-hover"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.nativeName}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsLangModalOpen(true)}
              className="px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
              title="配置全项目支持的多语言列表（可新增 / 移除语种）"
            >
              <Settings2 className="w-3 h-3" />
              管理语种
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line-subtle">
            <span className="text-xs text-fg-secondary">
              共 <b className="text-fg font-mono">{filteredEntries.length}</b> 个词条
            </span>
            <div className="relative w-64">
              <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索名称 / 键名 / 译文..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && filteredEntries.every((e) => selectedIds.includes(e.id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredEntries.map((e) => e.id) : [])
                      }
                      className="rounded text-fg"
                    />
                  </th>
                  <th className="py-2.5 px-3 w-[260px]">名称 (Key)</th>
                  <th className="py-2.5 px-3 w-[110px]">ID</th>
                  <th className="py-2.5 px-3 min-w-[240px]">
                    值（{languages.find((l) => l.code === previewLanguage)?.flag}{" "}
                    {languages.find((l) => l.code === previewLanguage)?.nativeName}）
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px]">备注</th>
                  <th className="py-2.5 px-3 min-w-[160px]">关联位置</th>
                  <th className="py-2.5 px-3 w-[100px]">创建</th>
                  <th className="py-2.5 px-3 w-[80px] text-center">引用</th>
                  <th className="py-2.5 px-3 w-[150px] text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-fg-secondary">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-fg-tertiary">
                      暂无字典词条数据
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((item) => {
                    const isCopied = copiedKey === item.id;
                    const isExpanded = !!expandedKeys[item.id];
                    const completedCount = Object.values(item.translations).filter(Boolean).length;

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-subtle/80 transition-colors group">
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                                )
                              }
                              className="rounded text-fg"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-fg bg-hover px-2 py-0.5 rounded border border-line truncate max-w-[200px]" title={item.key}>
                                {item.key}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.key, item.id)}
                                className="p-0.5 text-fg-tertiary hover:text-fg-secondary rounded transition-colors cursor-pointer"
                                title="复制键名"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-fg-tertiary text-[11px]">{item.id}</td>
                          <td className="py-2.5 px-3">
                            <div className="text-fg line-clamp-2 leading-relaxed" title={item.translations[previewLanguage]}>
                              {item.translations[previewLanguage] || "—"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-fg-secondary">
                            <span className="line-clamp-2" title={item.description}>{item.description}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {getReferencePoints(item).map((rp) => (
                                <span
                                  key={rp.keyPrefix}
                                  title={rp.scope}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                                >
                                  <Link2 className="w-2.5 h-2.5" />
                                  {rp.label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-fg-tertiary font-mono text-[11px]">
                            {item.updatedAt.substring(0, 10)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {completedCount}/{languages.length}
                            </span>
                            <div className="text-[9px] text-fg-tertiary mt-0.5">
                              {item.referencedTemplatesCount ?? 0} 模板
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenAdd(item.category)}
                                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-[11px] font-medium cursor-pointer"
                                title="新增同分类词条"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenCodeHelper(item)}
                                className="px-2 py-1 text-fg-secondary hover:bg-hover rounded-md text-[11px] font-medium cursor-pointer"
                                title="查看各端调用示例"
                              >
                                <Code2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpand(item.id)}
                                className="px-2 py-1 text-fg-secondary hover:bg-hover rounded-md text-[11px] font-medium cursor-pointer"
                                title="展开全部语种对照"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="px-2 py-1 text-fg-secondary hover:bg-hover rounded-md text-[11px] font-medium cursor-pointer"
                                title="编辑词条"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <Popconfirm
                                title={`删除词条「${item.key}」？`}
                                description="该词条将被移出全项目字典，所有关联的多语言位置将回退为键名本身。"
                                onConfirm={() => handleDelete(item.id, item.key)}
                              >
                                <button
                                  type="button"
                                  className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-md text-[11px] font-medium cursor-pointer"
                                  title="删除词条"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </Popconfirm>
                            </div>
                          </td>
                        </tr>

                        {/* 展开：全部语种对照 */}
                        {isExpanded && (
                          <tr className="bg-violet-50/40">
                            <td colSpan={9} className="p-3 border-b border-line">
                              <div className="bg-surface rounded-xl p-3 border border-violet-200 shadow-card space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-fg pb-2 border-b border-line-subtle">
                                  <span className="flex items-center gap-1.5">
                                    <Languages className="w-4 h-4 text-violet-600" />
                                    【{item.key}】全项目 {languages.length} 种多语言完整译文对照
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {languages.map((l) => (
                                    <div key={l.code} className="bg-subtle p-2.5 rounded-lg border border-line text-xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-fg-secondary">
                                        <span className="flex items-center gap-1">
                                          <span>{l.flag}</span>
                                          <span>{l.nativeName}</span>
                                        </span>
                                        <span className="font-mono text-fg-tertiary text-[10px]">{l.code}</span>
                                      </div>
                                      <div className="text-fg font-sans text-xs bg-surface p-2 rounded border border-line/80 leading-relaxed min-h-[42px]">
                                        {item.translations[l.code] || (
                                          <span className="text-fg-tertiary italic">未填</span>
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
                  })
                )}
              </tbody>
            </table>
          </div>
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
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold cursor-pointer"
            >
              关闭
            </button>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
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
              <pre className="bg-primary text-primary-foreground p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`import { useTranslation } from "react-i18next";\nconst { t } = useTranslation();\n\n// 渲染国际化文本\n<Button>{t("${activeCodeEntry.key}")}</Button>`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
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
              <pre className="bg-primary text-primary-foreground p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`// 根据请求头 Accept-Language 或客户端参数自动本地化\nconst message = i18n.resolve(req.locale, "${activeCodeEntry.key}");\nres.status(400).json({ code: "${activeCodeEntry.key}", error: message });`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  移动端原生 SDK (iOS Swift & Android Kotlin)
                </span>
              </div>
              <pre className="bg-primary text-primary-foreground p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`// iOS Swift:\nlet title = NSLocalizedString("${activeCodeEntry.key}", comment: "")\n\n// Android Kotlin:\nval title = getString(R.string.${activeCodeEntry.key.replace(/\./g, "_")})`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
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
              <pre className="bg-primary text-primary-foreground p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                {`<h1>{{dict.${activeCodeEntry.key}}}</h1>`}
              </pre>
            </div>
          </div>
        </SideSheet>
      )}

      {/* ===== 语种配置 SideSheet（配置全项目支持哪些多语言） ===== */}
      <SideSheet
        id="side-sheet-lang-config"
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
        title="多语言配置 (Language Settings)"
        description="配置全项目支持哪些语种：新增语种会同步为所有词条补齐占位译文，移除语种会一并移除词条中该语言译文。所有与多语言关联的位置（收银台 / 邮件模板 / 网关提示）均以该配置为准。"
        icon={<Languages className="w-5 h-5 text-violet-600" />}
        widthClass="max-w-xl"
        footer={
          <button
            type="button"
            onClick={() => setIsLangModalOpen(false)}
            className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold cursor-pointer"
          >
            完成
          </button>
        }
      >
        <div className="space-y-5 text-xs">
          {/* 当前已配置语言 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                已配置语种
                <span className="text-[10px] text-fg-tertiary font-mono">({languages.length})</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {languages.map((l) => (
                <div
                  key={l.code}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{l.flag}</span>
                    <div>
                      <div className="font-semibold text-fg">{l.nativeName}</div>
                      <div className="text-[10px] text-fg-tertiary font-mono">{l.code} · {l.label}</div>
                    </div>
                  </div>
                  <Popconfirm
                    title={`移除语言「${l.nativeName}」？`}
                    description="将同时移除所有词条中该语言的译文，且不可恢复。"
                    onConfirm={() => handleRemoveLanguage(l)}
                  >
                    <button
                      type="button"
                      disabled={languages.length <= 1}
                      className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-md font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={languages.length <= 1 ? "至少保留一种语言" : "移除该语言"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Popconfirm>
                </div>
              ))}
            </div>
          </div>

          {/* 候选语言池 */}
          <div className="border-t border-line-subtle pt-4">
            <div className="font-bold text-fg mb-2 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-violet-600" />
              从候选语种添加
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {AVAILABLE_LANGUAGES.map((cand) => {
                const added = languages.some((l) => l.code === cand.code);
                return (
                  <button
                    key={cand.code}
                    type="button"
                    disabled={added}
                    onClick={() => handleAddLanguage(cand)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      added
                        ? "bg-subtle text-zinc-300 border-line-subtle cursor-not-allowed"
                        : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                    }`}
                  >
                    <span>{cand.flag}</span>
                    <span>{cand.nativeName}</span>
                    <span className="font-mono text-[9px] opacity-70">{cand.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 自定义语种 */}
          <div className="border-t border-line-subtle pt-4">
            <div className="font-bold text-fg mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-violet-600" />
              自定义添加语种
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="语言代码，如 ko-KR"
                value={customLangCode}
                onChange={(e) => setCustomLangCode(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
              <input
                type="text"
                placeholder="语言名称，如 한국어"
                value={customLangName}
                onChange={(e) => setCustomLangName(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
              <input
                type="text"
                placeholder="国旗 Emoji（可选）"
                value={customLangFlag}
                onChange={(e) => setCustomLangFlag(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
            </div>
            <button
              type="button"
              onClick={handleAddCustomLanguage}
              className="mt-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
            >
              添加自定义语种
            </button>
          </div>
        </div>
      </SideSheet>

      {/* Add / Edit Dictionary SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-dict-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingEntry ? `编辑全项目词条: ${editingEntry.key}` : `新增全项目字典词条 (默认配置 ${languages.length} 种语言)`}
          description="统一字典是全工程的国际化单一事实来源，配置后自动同步给收银台、商户中台、网关API、移动端与通知邮件"
          icon={<Globe className="w-5 h-5 text-violet-600" />}
          widthClass="max-w-2xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 border border-line text-fg-secondary rounded-xl hover:bg-hover font-semibold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold shadow-card cursor-pointer"
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
                快速插入出海全工程标准词条模板（点击自动填充当前配置语种）：
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PROJECT_PRESET_ENTRIES.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2 py-1 bg-surface hover:bg-violet-100 text-violet-700 rounded-lg text-[10px] font-mono border border-violet-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    +{preset.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
                  统一词条键名 (Key Identifier) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：checkout.pay_now_cta 或 gateway.error.card_declined"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="w-full p-2 bg-surface border border-line rounded-xl font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">
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
                    { value: "CURRENCY", label: "结算货币 (Currency / 多语言币种配置)" },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1.5">
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
                          : "bg-subtle text-fg-secondary border-line hover:bg-hover"
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
              <label className="font-semibold text-fg-secondary block mb-1">
                用途说明 (业务含义与开发指引):
              </label>
              <input
                type="text"
                required
                placeholder="如：展示在全球收银台付款按钮上的文案，支持多货币与通道"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full p-2 bg-surface border border-line rounded-xl text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="pt-2 border-t border-line-subtle">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-fg flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-indigo-600" />
                  <span>默认多语言配置 (当前 {languages.length} 种支持语种):</span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {languages.map((l) => (
                  <div key={l.code} className="bg-subtle p-3 rounded-xl border border-line/90 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-fg">
                      <span className="flex items-center gap-1.5">
                        <span>{l.flag}</span>
                        <span>{l.nativeName}</span>
                        <span className="font-mono text-fg-tertiary font-normal">({l.code})</span>
                      </span>
                      {formTranslations[l.code] ? (
                        <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> 已配置
                        </span>
                      ) : (
                        <span className="text-[10px] text-fg-tertiary font-normal">待输入</span>
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
                      className="w-full p-2 bg-surface border border-line rounded-lg text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
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
