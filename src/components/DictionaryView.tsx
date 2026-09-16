import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  FolderTree,
  ArrowRightLeft,
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
import { ContextMenu, type ContextMenuItem } from "./ui/ContextMenu";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  listDictionaryCategories,
  createDictionaryCategory,
  updateDictionaryCategory,
  deleteDictionaryCategory,
  type ApiDictCategory,
} from "../api/modules/iam";

type CategoryNode = {
  id: string;
  parentId: string | null;
  key: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
  children?: CategoryNode[];
};

const mockCategoriesFromLabels = (
  labels: { key: string; label: string }[],
): CategoryNode[] =>
  labels.map((c, i) => ({
    id: c.key,
    parentId: null,
    key: c.key,
    name: c.label,
    isSystem: false,
    sortOrder: i + 1,
  }));

const flattenCategories = (nodes: CategoryNode[]): CategoryNode[] => {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

const filterCategoryTree = (nodes: CategoryNode[], keyword: string): CategoryNode[] => {
  const q = keyword.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (list: CategoryNode[]): CategoryNode[] =>
    list
      .map((n) => {
        const children = n.children ? walk(n.children) : [];
        const selfHit =
          n.name.toLowerCase().includes(q) || n.key.toLowerCase().includes(q);
        if (selfHit || children.length > 0) {
          return { ...n, children };
        }
        return null;
      })
      .filter(Boolean) as CategoryNode[];
  return walk(nodes);
};

const mapApiCategoryTree = (nodes: ApiDictCategory[]): CategoryNode[] =>
  (nodes || []).map((n) => ({
    id: n.id,
    parentId: n.parentId ?? null,
    key: n.key,
    name: n.name,
    isSystem: !!n.isSystem,
    sortOrder: n.sortOrder ?? 1,
    children: n.children ? mapApiCategoryTree(n.children) : [],
  }));

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

// 可扩展候选语言池（Google Translate 全量语言，字典管理 → 语种配置中可添加到全局多语言）
export const AVAILABLE_LANGUAGES: {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
}[] = [
  { code: "af-ZA", label: "南非荷兰语 (af-ZA)", flag: "🌐", nativeName: "南非荷兰语" },
  { code: "sq-AL", label: "阿尔巴尼亚语 (sq-AL)", flag: "🌐", nativeName: "阿尔巴尼亚语" },
  { code: "am-ET", label: "阿姆哈拉语 (am-ET)", flag: "🌐", nativeName: "阿姆哈拉语" },
  { code: "hy-AM", label: "亚美尼亚语 (hy-AM)", flag: "🌐", nativeName: "亚美尼亚语" },
  { code: "az-AZ", label: "阿塞拜疆语 (az-AZ)", flag: "🌐", nativeName: "阿塞拜疆语" },
  { code: "eu-ES", label: "巴斯克语 (eu-ES)", flag: "🌐", nativeName: "巴斯克语" },
  { code: "be-BY", label: "白俄罗斯语 (be-BY)", flag: "🌐", nativeName: "白俄罗斯语" },
  { code: "bn-BD", label: "孟加拉语 (bn-BD)", flag: "🌐", nativeName: "孟加拉语" },
  { code: "bs-BA", label: "波斯尼亚语 (bs-BA)", flag: "🌐", nativeName: "波斯尼亚语" },
  { code: "bg-BG", label: "保加利亚语 (bg-BG)", flag: "🌐", nativeName: "保加利亚语" },
  { code: "ca-ES", label: "加泰罗尼亚语 (ca-ES)", flag: "🌐", nativeName: "加泰罗尼亚语" },
  { code: "ceb-PH", label: "宿务语 (ceb-PH)", flag: "🌐", nativeName: "宿务语" },
  { code: "zh-CN", label: "简体中文 (zh-CN)", flag: "🌐", nativeName: "简体中文" },
  { code: "zh-TW", label: "中文(繁体) (zh-TW)", flag: "🌐", nativeName: "中文(繁体)" },
  { code: "co-FR", label: "科西嘉语 (co-FR)", flag: "🌐", nativeName: "科西嘉语" },
  { code: "hr-HR", label: "克罗地亚语 (hr-HR)", flag: "🌐", nativeName: "克罗地亚语" },
  { code: "cs-CZ", label: "捷克语 (cs-CZ)", flag: "🌐", nativeName: "捷克语" },
  { code: "da-DK", label: "丹麦语 (da-DK)", flag: "🌐", nativeName: "丹麦语" },
  { code: "nl-NL", label: "荷兰语 (nl-NL)", flag: "🌐", nativeName: "荷兰语" },
  { code: "en-US", label: "英语 (en-US)", flag: "🌐", nativeName: "英语" },
  { code: "eo-XX", label: "世界语 (eo-XX)", flag: "🌐", nativeName: "世界语" },
  { code: "et-EE", label: "爱沙尼亚语 (et-EE)", flag: "🌐", nativeName: "爱沙尼亚语" },
  { code: "fi-FI", label: "芬兰语 (fi-FI)", flag: "🌐", nativeName: "芬兰语" },
  { code: "fy-NL", label: "弗里斯兰语 (fy-NL)", flag: "🌐", nativeName: "弗里斯兰语" },
  { code: "gl-ES", label: "加利西亚语 (gl-ES)", flag: "🌐", nativeName: "加利西亚语" },
  { code: "ka-GE", label: "格鲁吉亚语 (ka-GE)", flag: "🌐", nativeName: "格鲁吉亚语" },
  { code: "de-DE", label: "德语 (de-DE)", flag: "🌐", nativeName: "德语" },
  { code: "el-GR", label: "希腊语 (el-GR)", flag: "🌐", nativeName: "希腊语" },
  { code: "gu-IN", label: "古吉拉特语 (gu-IN)", flag: "🌐", nativeName: "古吉拉特语" },
  { code: "ht-HT", label: "海地克里奥尔语 (ht-HT)", flag: "🌐", nativeName: "海地克里奥尔语" },
  { code: "ha-NG", label: "豪萨语 (ha-NG)", flag: "🌐", nativeName: "豪萨语" },
  { code: "haw-US", label: "夏威夷语 (haw-US)", flag: "🌐", nativeName: "夏威夷语" },
  { code: "he-IL", label: "希伯来语 (he-IL)", flag: "🌐", nativeName: "希伯来语" },
  { code: "hi-IN", label: "印地语 (hi-IN)", flag: "🌐", nativeName: "印地语" },
  { code: "hmn-XX", label: "苗语 (hmn-XX)", flag: "🌐", nativeName: "苗语" },
  { code: "hu-HU", label: "匈牙利语 (hu-HU)", flag: "🌐", nativeName: "匈牙利语" },
  { code: "is-IS", label: "冰岛语 (is-IS)", flag: "🌐", nativeName: "冰岛语" },
  { code: "ig-NG", label: "伊博语 (ig-NG)", flag: "🌐", nativeName: "伊博语" },
  { code: "id-ID", label: "印尼语 (id-ID)", flag: "🌐", nativeName: "印尼语" },
  { code: "ga-IE", label: "爱尔兰语 (ga-IE)", flag: "🌐", nativeName: "爱尔兰语" },
  { code: "it-IT", label: "意大利语 (it-IT)", flag: "🌐", nativeName: "意大利语" },
  { code: "ja-JP", label: "日语 (ja-JP)", flag: "🌐", nativeName: "日语" },
  { code: "jv-ID", label: "爪哇语 (jv-ID)", flag: "🌐", nativeName: "爪哇语" },
  { code: "kn-IN", label: "卡纳达语 (kn-IN)", flag: "🌐", nativeName: "卡纳达语" },
  { code: "kk-KZ", label: "哈萨克语 (kk-KZ)", flag: "🌐", nativeName: "哈萨克语" },
  { code: "km-KH", label: "高棉语 (km-KH)", flag: "🌐", nativeName: "高棉语" },
  { code: "rw-RW", label: "卢旺达语 (rw-RW)", flag: "🌐", nativeName: "卢旺达语" },
  { code: "ko-KR", label: "韩语 (ko-KR)", flag: "🌐", nativeName: "韩语" },
  { code: "ku-TR", label: "库尔德语 (ku-TR)", flag: "🌐", nativeName: "库尔德语" },
  { code: "ky-KG", label: "吉尔吉斯语 (ky-KG)", flag: "🌐", nativeName: "吉尔吉斯语" },
  { code: "lo-LA", label: "老挝语 (lo-LA)", flag: "🌐", nativeName: "老挝语" },
  { code: "lv-LV", label: "拉脱维亚语 (lv-LV)", flag: "🌐", nativeName: "拉脱维亚语" },
  { code: "lt-LT", label: "立陶宛语 (lt-LT)", flag: "🌐", nativeName: "立陶宛语" },
  { code: "lb-LU", label: "卢森堡语 (lb-LU)", flag: "🌐", nativeName: "卢森堡语" },
  { code: "mk-MK", label: "马其顿语 (mk-MK)", flag: "🌐", nativeName: "马其顿语" },
  { code: "mg-MG", label: "马达加斯加语 (mg-MG)", flag: "🌐", nativeName: "马达加斯加语" },
  { code: "ms-MY", label: "马来语 (ms-MY)", flag: "🌐", nativeName: "马来语" },
  { code: "ml-IN", label: "马拉雅拉姆语 (ml-IN)", flag: "🌐", nativeName: "马拉雅拉姆语" },
  { code: "mt-MT", label: "马耳他语 (mt-MT)", flag: "🌐", nativeName: "马耳他语" },
  { code: "mi-NZ", label: "毛利语 (mi-NZ)", flag: "🌐", nativeName: "毛利语" },
  { code: "mr-IN", label: "马拉地语 (mr-IN)", flag: "🌐", nativeName: "马拉地语" },
  { code: "mn-MN", label: "蒙古语 (mn-MN)", flag: "🌐", nativeName: "蒙古语" },
  { code: "my-MM", label: "缅甸语 (my-MM)", flag: "🌐", nativeName: "缅甸语" },
  { code: "ne-NP", label: "尼泊尔语 (ne-NP)", flag: "🌐", nativeName: "尼泊尔语" },
  { code: "no-NO", label: "挪威语 (no-NO)", flag: "🌐", nativeName: "挪威语" },
  { code: "ny-MW", label: "齐切瓦语 (ny-MW)", flag: "🌐", nativeName: "齐切瓦语" },
  { code: "or-IN", label: "奥里亚语 (or-IN)", flag: "🌐", nativeName: "奥里亚语" },
  { code: "ps-AF", label: "普什图语 (ps-AF)", flag: "🌐", nativeName: "普什图语" },
  { code: "fa-IR", label: "波斯语 (fa-IR)", flag: "🌐", nativeName: "波斯语" },
  { code: "pl-PL", label: "波兰语 (pl-PL)", flag: "🌐", nativeName: "波兰语" },
  { code: "pt-BR", label: "葡萄牙语(巴西) (pt-BR)", flag: "🌐", nativeName: "葡萄牙语(巴西)" },
  { code: "pt-PT", label: "葡萄牙语(欧洲) (pt-PT)", flag: "🌐", nativeName: "葡萄牙语(欧洲)" },
  { code: "pa-IN", label: "旁遮普语 (pa-IN)", flag: "🌐", nativeName: "旁遮普语" },
  { code: "ro-RO", label: "罗马尼亚语 (ro-RO)", flag: "🌐", nativeName: "罗马尼亚语" },
  { code: "ru-RU", label: "俄语 (ru-RU)", flag: "🌐", nativeName: "俄语" },
  { code: "sm-WS", label: "萨摩亚语 (sm-WS)", flag: "🌐", nativeName: "萨摩亚语" },
  { code: "gd-GB", label: "苏格兰盖尔语 (gd-GB)", flag: "🌐", nativeName: "苏格兰盖尔语" },
  { code: "sr-RS", label: "塞尔维亚语 (sr-RS)", flag: "🌐", nativeName: "塞尔维亚语" },
  { code: "st-LS", label: "塞索托语 (st-LS)", flag: "🌐", nativeName: "塞索托语" },
  { code: "sn-ZW", label: "绍纳语 (sn-ZW)", flag: "🌐", nativeName: "绍纳语" },
  { code: "sd-PK", label: "信德语 (sd-PK)", flag: "🌐", nativeName: "信德语" },
  { code: "si-LK", label: "僧伽罗语 (si-LK)", flag: "🌐", nativeName: "僧伽罗语" },
  { code: "sk-SK", label: "斯洛伐克语 (sk-SK)", flag: "🌐", nativeName: "斯洛伐克语" },
  { code: "sl-SI", label: "斯洛文尼亚语 (sl-SI)", flag: "🌐", nativeName: "斯洛文尼亚语" },
  { code: "so-SO", label: "索马里语 (so-SO)", flag: "🌐", nativeName: "索马里语" },
  { code: "es-ES", label: "西班牙语 (es-ES)", flag: "🌐", nativeName: "西班牙语" },
  { code: "es-419", label: "西班牙语(拉美) (es-419)", flag: "🌐", nativeName: "西班牙语(拉美)" },
  { code: "su-ID", label: "巽他语 (su-ID)", flag: "🌐", nativeName: "巽他语" },
  { code: "sw-KE", label: "斯瓦希里语 (sw-KE)", flag: "🌐", nativeName: "斯瓦希里语" },
  { code: "sv-SE", label: "瑞典语 (sv-SE)", flag: "🌐", nativeName: "瑞典语" },
  { code: "tl-PH", label: "他加禄语 (tl-PH)", flag: "🌐", nativeName: "他加禄语" },
  { code: "tg-TJ", label: "塔吉克语 (tg-TJ)", flag: "🌐", nativeName: "塔吉克语" },
  { code: "ta-IN", label: "泰米尔语 (ta-IN)", flag: "🌐", nativeName: "泰米尔语" },
  { code: "tt-RU", label: "鞑靼语 (tt-RU)", flag: "🌐", nativeName: "鞑靼语" },
  { code: "te-IN", label: "泰卢固语 (te-IN)", flag: "🌐", nativeName: "泰卢固语" },
  { code: "th-TH", label: "泰语 (th-TH)", flag: "🌐", nativeName: "泰语" },
  { code: "tr-TR", label: "土耳其语 (tr-TR)", flag: "🌐", nativeName: "土耳其语" },
  { code: "tk-TM", label: "土库曼语 (tk-TM)", flag: "🌐", nativeName: "土库曼语" },
  { code: "uk-UA", label: "乌克兰语 (uk-UA)", flag: "🌐", nativeName: "乌克兰语" },
  { code: "ur-PK", label: "乌尔都语 (ur-PK)", flag: "🌐", nativeName: "乌尔都语" },
  { code: "ug-CN", label: "维吾尔语 (ug-CN)", flag: "🌐", nativeName: "维吾尔语" },
  { code: "uz-UZ", label: "乌兹别克语 (uz-UZ)", flag: "🌐", nativeName: "乌兹别克语" },
  { code: "vi-VN", label: "越南语 (vi-VN)", flag: "🌐", nativeName: "越南语" },
  { code: "cy-GB", label: "威尔士语 (cy-GB)", flag: "🌐", nativeName: "威尔士语" },
  { code: "xh-ZA", label: "科萨语 (xh-ZA)", flag: "🌐", nativeName: "科萨语" },
  { code: "yi-XX", label: "意第绪语 (yi-XX)", flag: "🌐", nativeName: "意第绪语" },
  { code: "yo-NG", label: "约鲁巴语 (yo-NG)", flag: "🌐", nativeName: "约鲁巴语" },
  { code: "zu-ZA", label: "祖鲁语 (zu-ZA)", flag: "🌐", nativeName: "祖鲁语" },
];

const PLATFORM_OPTION_META: {
  key: ProjectPlatform;
  icon: React.ElementType;
  color: string;
}[] = [
  { key: "CHECKOUT", icon: LayoutTemplate, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "PORTAL", icon: Monitor, color: "text-violet-600 bg-violet-50 border-violet-200" },
  { key: "GATEWAY_API", icon: Server, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "MOBILE_SDK", icon: Smartphone, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "EMAIL_NOTIFY", icon: Mail, color: "text-indigo-600 text-indigo-700 border-indigo-200" },
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

const CATEGORY_KEYS: DictionaryCategory[] = [
  "COMMON",
  "BILLING",
  "LIFECYCLE",
  "PROMOTION",
  "SECURITY",
  "CHECKOUT",
  "PORTAL",
  "GATEWAY_ERRORS",
  "CURRENCY",
  "PAYMENT_CHANNEL",
];

const DICT_REFERENCE_POINT_KEYS = [
  { keyPrefix: "checkout.", refKey: "checkout" },
  { keyPrefix: "payment.receipt", refKey: "paymentReceipt" },
  { keyPrefix: "subscription.", refKey: "subscription" },
  { keyPrefix: "security.", refKey: "security" },
  { keyPrefix: "account.", refKey: "account" },
  { keyPrefix: "email.footer", refKey: "emailFooter" },
  { keyPrefix: "support.", refKey: "support" },
  { keyPrefix: "currency.", refKey: "currency" },
  { keyPrefix: "gateway.error", refKey: "gatewayError" },
  { keyPrefix: "portal.", refKey: "portal" },
] as const;

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  dictionary,
  currentTenant,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const { t } = useTranslation(["dictionary", "common"]);

  const categoryLabels = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => ({
        key,
        label: t(`dictionary:categories.${key}`),
      })),
    [t]
  );

  const dictReferencePoints = useMemo(
    () =>
      DICT_REFERENCE_POINT_KEYS.map((item) => ({
        keyPrefix: item.keyPrefix,
        label: t(`dictionary:references.${item.refKey}.label`),
        scope: t(`dictionary:references.${item.refKey}.scope`),
      })),
    [t]
  );

  const platformOptions = useMemo(
    () =>
      PLATFORM_OPTION_META.map((item) => ({
        ...item,
        label: t(`dictionary:platforms.${item.key}`),
      })),
    [t]
  );

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ===== 左侧分类：可右键新增/删除/重命名/刷新 =====
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>(() =>
    mockCategoriesFromLabels(categoryLabels),
  );
  const [categorySheetMode, setCategorySheetMode] = useState<"create" | "rename" | null>(null);
  const [categorySheetParent, setCategorySheetParent] = useState<CategoryNode | null>(null);
  const [categorySheetTarget, setCategorySheetTarget] = useState<CategoryNode | null>(null);
  const [categoryFormKey, setCategoryFormKey] = useState("");
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [treeRefreshing, setTreeRefreshing] = useState(false);
  const { currentPage, setCurrentPage, reset: resetPage, pageSize } = usePagination(10);

  const flatCategories = useMemo(() => flattenCategories(categoryTree), [categoryTree]);

  const isSystemCategoryEntry = (entry: DictionaryEntry) => {
    const cat =
      flatCategories.find((c) => c.id === entry.categoryId) ||
      flatCategories.find((c) => c.key === entry.category);
    return !!cat?.isSystem;
  };

  const loadCategoryTree = async () => {
    try {
      const tree = await listDictionaryCategories();
      setCategoryTree(mapApiCategoryTree(tree || []));
    } catch {
      showToast(t("dictionary:toast.treeLoadFailed"));
    }
  };

  useEffect(() => {
    void loadCategoryTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateCategorySheet = (parent: CategoryNode | null) => {
    setCategorySheetMode("create");
    setCategorySheetParent(parent);
    setCategorySheetTarget(null);
    setCategoryFormKey("");
    setCategoryFormName("");
  };

  const openRenameCategorySheet = (node: CategoryNode) => {
    setCategorySheetMode("rename");
    setCategorySheetParent(null);
    setCategorySheetTarget(node);
    setCategoryFormKey(node.key);
    setCategoryFormName(node.name);
  };

  const closeCategorySheet = () => {
    setCategorySheetMode(null);
    setCategorySheetParent(null);
    setCategorySheetTarget(null);
    setCategoryFormKey("");
    setCategoryFormName("");
  };

  const handleSubmitCategorySheet = async () => {
    const name = categoryFormName.trim();
    if (categorySheetMode === "create") {
      const key = categoryFormKey.trim().toLowerCase().replace(/\s+/g, "_");
      if (!key || !name) {
        showToast(t("dictionary:categorySheet.fieldsRequired"));
        return;
      }
      setCategorySaving(true);
      try {
        const created = await createDictionaryCategory({
          parentId: categorySheetParent?.id ?? null,
          key,
          name,
        });
        await loadCategoryTree();
        setCategoryFilter(created.id);
        showToast(t("dictionary:toast.categoryAdded", { name: created.name || name }));
        closeCategorySheet();
      } catch {
        showToast(t("dictionary:toast.categorySaveFailed"));
      } finally {
        setCategorySaving(false);
      }
      return;
    }

    if (categorySheetMode === "rename" && categorySheetTarget) {
      if (!name) {
        showToast(t("dictionary:categorySheet.nameRequired"));
        return;
      }
      setCategorySaving(true);
      try {
        await updateDictionaryCategory(categorySheetTarget.id, { name });
        await loadCategoryTree();
        showToast(t("dictionary:toast.categoryRenamed"));
        closeCategorySheet();
      } catch {
        showToast(t("dictionary:toast.categorySaveFailed"));
      } finally {
        setCategorySaving(false);
      }
    }
  };

  const handleDeleteCategory = async (node: CategoryNode) => {
    if (node.isSystem) {
      showToast(t("dictionary:tree.deleteBlocked"));
      return;
    }
    try {
      await deleteDictionaryCategory(node.id);
      await loadCategoryTree();
      if (categoryFilter === node.id) setCategoryFilter("ALL");
      showToast(t("dictionary:toast.categoryDeleted", { label: node.name }));
    } catch {
      showToast(t("dictionary:toast.categoryDeleteFailed"));
    }
  };

  const handleRefreshTree = () => {
    setTreeRefreshing(true);
    void (async () => {
      await loadCategoryTree();
      setTreeRefreshing(false);
      showToast(t("dictionary:toast.treeRefreshed"));
    })();
  };
  useEffect(() => { resetPage(); }, [categoryFilter, searchQuery, resetPage]);

  // ===== 语种配置（字典管理可配置"有哪些多语言"）=====
  const [languages, setLanguages] = useState<
    { code: string; label: string; flag: string; nativeName: string }[]
  >(LANGUAGES);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [customLangCode, setCustomLangCode] = useState("");
  const [langPoolSearch, setLangPoolSearch] = useState("");
  const [customLangName, setCustomLangName] = useState("");
  const [customLangFlag, setCustomLangFlag] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCodeEntry, setActiveCodeEntry] = useState<DictionaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const isKeyReadOnly = Boolean(editingEntry && isSystemCategoryEntry(editingEntry));

  // Form State
  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState<DictionaryCategory>("COMMON");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formPlatforms, setFormPlatforms] = useState<ProjectPlatform[]>([
    "CHECKOUT",
    "PORTAL",
    "EMAIL_NOTIFY",
  ]);
  const [formDescription, setFormDescription] = useState("");
  const [formTranslations, setFormTranslations] = useState<Record<string, string>>({});

  // 基于当前语种配置构造空译文表单
  const emptyTranslations = (): Record<string, string> => {
    const translationsMap: Record<string, string> = {};
    languages.forEach((l) => (translationsMap[l.code] = ""));
    return translationsMap;
  };

  // 添加语种：同步所有词条补齐该语言（默认沿用 en-US/zh-CN 兜底文案）
  const handleAddLanguage = (lang: { code: string; label: string; flag: string; nativeName: string }) => {
    if (languages.some((l) => l.code === lang.code)) {
      showToast(t("dictionary:toast.langExists", { name: lang.nativeName, code: lang.code }));
      return;
    }
    setLanguages((prev) => [...prev, lang]);
    setEntryList((prev) =>
      prev.map((e) => {
        const fallback = e.translations["en-US"] || e.translations["zh-CN"] || "";
        return { ...e, translations: { ...e.translations, [lang.code]: fallback } };
      })
    );
    showToast(t("dictionary:toast.langAdded", { name: lang.nativeName, code: lang.code }));
  };

  // 移除语种：同步移除所有词条该语言译文
  const handleRemoveLanguage = (lang: { code: string; label: string; flag: string; nativeName: string }) => {
    if (languages.length <= 1) {
      showToast(t("dictionary:toast.minLanguageRequired"));
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
    showToast(t("dictionary:toast.langRemoved", { name: lang.nativeName, code: lang.code }));
  };

  // 自定义添加语种
  const handleAddCustomLanguage = () => {
    const code = customLangCode.trim();
    const name = customLangName.trim();
    if (!code || !name) {
      showToast(t("dictionary:toast.langFieldsRequired"));
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resolveCategorySelection = (idOrKey?: string) => {
    const hit =
      flatCategories.find((c) => c.id === idOrKey) ||
      flatCategories.find((c) => c.key === idOrKey) ||
      flatCategories[0];
    return hit;
  };

  const handleOpenAdd = (presetCategory?: DictionaryCategory | string) => {
    setEditingEntry(null);
    setFormKey("");
    const hit = resolveCategorySelection(
      typeof presetCategory === "string" ? presetCategory : categoryFilter !== "ALL" ? categoryFilter : undefined,
    );
    setFormCategory((hit?.key as DictionaryCategory) || "COMMON");
    setFormCategoryId(hit?.id || "");
    setFormPlatforms(["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"]);
    setFormDescription("");
    setFormTranslations(emptyTranslations());
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    setFormKey(entry.key);
    setFormCategory(entry.category);
    setFormCategoryId(entry.categoryId || resolveCategorySelection(entry.category)?.id || "");
    setFormPlatforms(entry.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY"]);
    setFormDescription(entry.description);
    const translationsMap: Record<string, string> = {};
    languages.forEach((l) => (translationsMap[l.code] = entry.translations[l.code] || ""));
    setFormTranslations(translationsMap);
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
      showToast(t("dictionary:toast.autoTranslateNeedBase"));
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
      showToast(t("dictionary:toast.presetMatched", { count: languages.length }));
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
      showToast(t("dictionary:toast.autoTranslateDone", { count: languages.length }));
    }

    setFormTranslations(newTranslations);
  };

  const handleApplyPreset = (preset: (typeof PROJECT_PRESET_ENTRIES)[0]) => {
    if (!isKeyReadOnly) {
      setFormKey(preset.key);
    }
    setFormCategory(preset.category);
    const hit = resolveCategorySelection(preset.category);
    setFormCategoryId(hit?.id || "");
    setFormPlatforms(preset.platforms);
    setFormDescription(preset.description);
    const translationsMap: Record<string, string> = {};
    languages.forEach((l) => (translationsMap[l.code] = preset.translations[l.code] || ""));
    setFormTranslations(translationsMap);
    showToast(t("dictionary:toast.presetApplied", { key: preset.key, count: languages.length }));
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

    const finalKey = isKeyReadOnly && editingEntry ? editingEntry.key : formKey.trim();

    if (editingEntry) {
      const updated: DictionaryEntry = {
        ...editingEntry,
        key: finalKey,
        category: formCategory,
        categoryId: formCategoryId || editingEntry.categoryId,
        platforms: formPlatforms,
        description: formDescription.trim(),
        translations: guaranteedTranslations,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      };
      setEntryList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveEntry(updated);
      showToast(t("dictionary:toast.entryUpdated", { key: updated.key, count: languages.length }));
    } else {
      const newEntry: DictionaryEntry = {
        id: `dict_${Date.now().toString().slice(-6)}`,
        key: formKey.trim(),
        category: formCategory,
        categoryId: formCategoryId || undefined,
        platforms: formPlatforms,
        description: formDescription.trim(),
        referencedTemplatesCount: 1,
        translations: guaranteedTranslations,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      };
      setEntryList((prev) => [newEntry, ...prev]);
      onSaveEntry(newEntry);
      showToast(t("dictionary:toast.entryCreated", { key: newEntry.key, count: languages.length }));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, key: string) => {
    setEntryList((prev) => prev.filter((item) => item.id !== id));
    if (onDeleteEntry) onDeleteEntry(id);
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    showToast(t("dictionary:toast.entryDeleted", { key }));
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setEntryList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    if (onDeleteEntry) selectedIds.forEach((id) => onDeleteEntry(id));
    setSelectedIds([]);
    showToast(t("dictionary:toast.batchDeleted", { count: selectedIds.length }));
  };

  const handleBatchTransfer = () => {
    if (selectedIds.length === 0) return;
    showToast(t("dictionary:toast.batchTransfer", { count: selectedIds.length }));
  };

  const handleRefresh = () => {
    setSearchQuery("");
    setSelectedIds([]);
    setEntryList(dictionary.map((item) => ({ ...item, platforms: item.platforms || ["CHECKOUT", "PORTAL", "EMAIL_NOTIFY", "MOBILE_SDK"] })));
    showToast(t("dictionary:toast.refreshed"));
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
    showToast(t("dictionary:toast.batchAutoComplete", { entryCount: completedCount, langCount: languages.length }));
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
    showToast(t("dictionary:toast.exportSuccess"));
  };

  const togglePlatform = (p: ProjectPlatform) => {
    setFormPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const filteredEntries = entryList.filter((item) => {
    const matchesCategory =
      categoryFilter === "ALL" ||
      item.categoryId === categoryFilter ||
      item.category === categoryFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.key.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      Object.values(item.translations).some((t) => typeof t === "string" && t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const currentCategoryLabel =
    categoryFilter === "ALL"
      ? t("dictionary:tree.all")
      : flatCategories.find((c) => c.id === categoryFilter || c.key === categoryFilter)?.name ||
        t("dictionary:tree.all");

  const visibleCategoryTree = useMemo(
    () => filterCategoryTree(categoryTree, treeKeyword),
    [categoryTree, treeKeyword],
  );

  const countEntriesForCategory = (node: CategoryNode) =>
    entryList.filter((e) => e.categoryId === node.id || e.category === node.key).length;

  const renderCategoryNode = (node: CategoryNode, depth = 0): React.ReactNode => {
    const count = countEntriesForCategory(node);
    const active = categoryFilter === node.id || categoryFilter === node.key;
    const menuItems: ContextMenuItem[] = [
      {
        key: "add-sibling",
        label: t("dictionary:tree.addSibling"),
        onClick: () =>
          openCreateCategorySheet(
            node.parentId ? flatCategories.find((c) => c.id === node.parentId) || null : null,
          ),
      },
      {
        key: "add-child",
        label: t("dictionary:tree.addChild"),
        onClick: () => openCreateCategorySheet(node),
      },
      {
        key: "rename",
        label: t("dictionary:tree.rename"),
        onClick: () => openRenameCategorySheet(node),
      },
      ...(!node.isSystem
        ? [
            {
              key: "del",
              label: t("dictionary:tree.delete"),
              danger: true,
              onClick: () => {
                void handleDeleteCategory(node);
              },
            } as ContextMenuItem,
          ]
        : []),
      {
        key: "refresh",
        label: t("dictionary:tree.refresh"),
        onClick: handleRefreshTree,
      },
    ];

    return (
      <div key={node.id} className="space-y-0.5">
        <ContextMenu
          items={menuItems}
          trigger={
            <button
              type="button"
              onClick={() => setCategoryFilter(node.id)}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
              className={`relative w-full flex items-center gap-2 pr-2 py-1.5 rounded text-xs cursor-pointer transition-all border ${
                active
                  ? "bg-blue-50/90 text-fg font-semibold border-blue-200 shadow-sm"
                  : "text-fg-secondary hover:bg-hover border-transparent"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full" />
              )}
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  active ? "bg-blue-500" : "bg-subtle border border-line-subtle"
                }`}
              >
                <FolderTree className={`w-3.5 h-3.5 ${active ? "text-white" : "text-fg-tertiary"}`} />
              </span>
              <span className="flex-1 text-left truncate flex items-center gap-1">
                <span className="truncate">{node.name}</span>
                {node.isSystem && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    {t("dictionary:tree.systemBadge")}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                  active ? "bg-blue-100 text-blue-700 font-bold" : "bg-hover text-fg-tertiary"
                }`}
              >
                {count}
              </span>
            </button>
          }
        />
        {(node.children || []).map((child) => renderCategoryNode(child, depth + 1))}
      </div>
    );
  };

  // 计算词条关联位置（映射到多语言关联点：邮件模板 / 收银台 / 网关等）
  const getReferencePoints = (item: DictionaryEntry) => {
    const matched = dictReferencePoints.filter((p) => item.key.startsWith(p.keyPrefix));
    return matched.length > 0 ? matched : [{ keyPrefix: item.category, label: item.category, scope: item.category }];
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-3 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 顶部操作栏（截图风格） ===== */}
      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("dictionary:toolbar.refreshTitle")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("dictionary:toolbar.refresh")}
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("dictionary:toolbar.add")}
          </button>

          {selectedIds.length === 0 ? (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("dictionary:toolbar.delete")}
            </button>
          ) : (
            <Popconfirm
              title={t("dictionary:batchDelete.title", { count: selectedIds.length })}
              description={t("dictionary:batchDelete.description")}
              onConfirm={handleBatchDelete}
            >
              <button
                type="button"
                className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("dictionary:toolbar.delete")}
              </button>
            </Popconfirm>
          )}

          <div className="w-px h-5 bg-hover mx-1" />

          <button
            type="button"
            onClick={handleBatchAutoComplete}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("dictionary:toolbar.autoCompleteTitle")}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t("dictionary:toolbar.autoComplete", { count: languages.length })}
          </button>

          <button
            type="button"
            onClick={handleExportWebJSON}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("dictionary:toolbar.exportI18nTitle")}
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            {t("dictionary:toolbar.exportI18n")}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative w-64">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("dictionary:toolbar.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            {t("dictionary:toolbar.search")}
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-start">
      {/* ===== 左侧：类型分类栏 ===== */}
      <div className="w-48 shrink-0 bg-surface border border-line rounded-md shadow-card overflow-hidden lg:sticky lg:top-4">
        <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-fg-secondary" />
            {t("dictionary:tree.title")}
          </span>
          <button
            type="button"
            onClick={handleRefreshTree}
            title={t("dictionary:tree.refreshTitle")}
            className="p-1 rounded text-fg-tertiary hover:bg-hover hover:text-fg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${treeRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("dictionary:tree.searchPlaceholder")}
              value={treeKeyword}
              onChange={(e) => setTreeKeyword(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="p-2 space-y-0.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`relative w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all border ${
              categoryFilter === "ALL"
                ? "bg-blue-50/90 text-fg font-semibold border-blue-200 shadow-sm"
                : "text-fg-secondary hover:bg-hover border-transparent"
            }`}
          >
            {categoryFilter === "ALL" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full" />
            )}
            <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              categoryFilter === "ALL" ? "bg-blue-500" : "bg-subtle border border-line-subtle"
            }`}>
              <BookOpen className={`w-3.5 h-3.5 ${categoryFilter === "ALL" ? "text-white" : "text-fg-tertiary"}`} />
            </span>
            <span className="flex-1 text-left truncate">{t("dictionary:tree.all")}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              categoryFilter === "ALL" ? "bg-blue-100 text-blue-700 font-bold" : "bg-hover text-fg-tertiary"
            }`}>{entryList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateCategorySheet(null)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] text-blue-600 hover:bg-blue-50 border border-transparent cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            {t("dictionary:tree.addSibling")}
          </button>

          {visibleCategoryTree.map((c) => renderCategoryNode(c))}
        </div>
      </div>

      {/* ===== 右侧：字典列表 ===== */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 标题 */}
        <div className="flex items-center gap-2 text-sm font-bold text-fg px-1">
          <span>{t("dictionary:list.title")}</span>
          <span className="text-fg-tertiary font-normal text-xs">
            {t("dictionary:list.categorySuffix", { label: currentCategoryLabel })}
          </span>
        </div>

        {/* 语种切换 */}
        <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-fg-secondary flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-violet-500" />
            {t("dictionary:list.previewLang")}
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setPreviewLanguage(l.code)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  previewLanguage === l.code
                    ? "bg-blue-600 text-white font-semibold"
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
              className="px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
              title={t("dictionary:list.manageLanguagesTitle")}
            >
              <Settings2 className="w-3 h-3" />
              {t("dictionary:list.manageLanguages")}
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                  <th className="py-2 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && filteredEntries.every((e) => selectedIds.includes(e.id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredEntries.map((e) => e.id) : [])
                      }
                      className="rounded text-fg"
                    />
                  </th>
                  <th className="py-2 px-3 w-[120px]">{t("dictionary:table.id")}</th>
                  <th className="py-2 px-3 min-w-[280px]">{t("dictionary:table.nameKey")}</th>
                  <th className="py-2 px-3 min-w-[240px]">
                    {t("dictionary:table.value", {
                      flag: languages.find((l) => l.code === previewLanguage)?.flag ?? "",
                      name: languages.find((l) => l.code === previewLanguage)?.nativeName ?? "",
                    })}
                  </th>
                  <th className="py-2 px-3 min-w-[180px]">{t("dictionary:table.remark")}</th>
                  <th className="py-2 px-3 w-[100px]">{t("dictionary:table.created")}</th>
                  <th className="py-2 px-3 w-[120px] text-right">{t("common:labels.operations")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-fg-secondary">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-fg-tertiary">
                      {t("dictionary:table.empty")}
                    </td>
                  </tr>
                ) : (
                  paginate<DictionaryEntry>(filteredEntries, currentPage, pageSize).map((item) => {
                    const isCopied = copiedKey === item.id;
                    const isExpanded = !!expandedKeys[item.id];

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-subtle/80 transition-colors group">
                          <td className="py-2 px-3">
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
                          <td className="py-2 px-3 font-mono text-fg-tertiary text-[11px] whitespace-nowrap">
                            {item.id}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-start gap-1.5">
                              <span
                                className="font-mono font-bold text-xs text-fg bg-hover px-2 py-0.5 rounded border border-line break-all"
                                title={item.key}
                              >
                                {item.key}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.key, item.id)}
                                className="p-0.5 text-fg-tertiary hover:text-fg-secondary rounded transition-colors cursor-pointer shrink-0 mt-0.5"
                                title={t("dictionary:table.copyKey")}
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="text-fg line-clamp-2 leading-relaxed" title={item.translations[previewLanguage]}>
                              {item.translations[previewLanguage] || "—"}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-fg-secondary">
                            <span className="line-clamp-2" title={item.description}>{item.description}</span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-fg-tertiary font-mono text-[11px]">
                            {item.updatedAt.substring(0, 10)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                                title={t("dictionary:table.editTitle")}
                              >
                                {t("dictionary:table.edit")}
                              </button>
                              {!isSystemCategoryEntry(item) && (
                                <Popconfirm
                                  title={t("dictionary:deleteEntry.title", { key: item.key })}
                                  description={t("dictionary:deleteEntry.description")}
                                  onConfirm={() => handleDelete(item.id, item.key)}
                                >
                                  <button
                                    type="button"
                                    className="text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                                    title={t("dictionary:table.deleteTitle")}
                                  >
                                    {t("dictionary:table.delete")}
                                  </button>
                                </Popconfirm>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* 展开：全部语种对照 */}
                        {isExpanded && (
                          <tr className="bg-violet-50/40">
                            <td colSpan={7} className="p-3 border-b border-line">
                              <div className="bg-surface rounded p-3 border border-violet-200 shadow-card space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-fg pb-2 border-b border-line-subtle">
                                  <span className="flex items-center gap-1.5">
                                    <Languages className="w-4 h-4 text-violet-600" />
                                    {t("dictionary:table.expandedTitle", { key: item.key, count: languages.length })}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {languages.map((l) => (
                                    <div key={l.code} className="bg-subtle p-2.5 rounded border border-line text-xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-fg-secondary">
                                        <span className="flex items-center gap-1">
                                          <span>{l.flag}</span>
                                          <span>{l.nativeName}</span>
                                        </span>
                                        <span className="font-mono text-fg-tertiary text-[10px]">{l.code}</span>
                                      </div>
                                      <div className="text-fg font-sans text-xs bg-surface p-2 rounded border border-line/80 leading-relaxed min-h-[42px]">
                                        {item.translations[l.code] || (
                                          <span className="text-fg-tertiary italic">{t("dictionary:table.notFilled")}</span>
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
          <Pagination currentPage={currentPage} totalItems={filteredEntries.length} pageSize={pageSize} onPageChange={setCurrentPage} />
        </div>
      </div>
      </div>

      {/* Code Snippet Helper SideSheet */}
      {isCodeModalOpen && activeCodeEntry && (
        <SideSheet
          id="side-sheet-dict-code"
          isOpen={true}
          onClose={() => setIsCodeModalOpen(false)}
          title={t("dictionary:codeSheet.title", { key: activeCodeEntry.key })}
          description={t("dictionary:codeSheet.description")}
          icon={<Code2 className="w-5 h-5 text-blue-600" />}
          widthClass="max-w-xl"
          footer={
            <button
              type="button"
              onClick={() => setIsCodeModalOpen(false)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
            >
              {t("dictionary:codeSheet.close")}
            </button>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="bg-subtle p-3 rounded border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
                  {t("dictionary:codeSheet.webFrontend")}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(`t("${activeCodeEntry.key}")`, "code_react")}
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{t("dictionary:codeSheet.copy")}</span>
                </button>
              </div>
              <pre className="bg-primary text-primary-foreground p-2.5 rounded font-mono text-[11px] overflow-x-auto">
                {`import { useTranslation } from "react-i18next";\nconst { t } = useTranslation();\n\n// 渲染国际化文本\n<Button>{t("${activeCodeEntry.key}")}</Button>`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-600" />
                  {t("dictionary:codeSheet.backendApi")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`i18n.resolve(req.locale, "${activeCodeEntry.key}")`, "code_api")
                  }
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{t("dictionary:codeSheet.copy")}</span>
                </button>
              </div>
              <pre className="bg-primary text-primary-foreground p-2.5 rounded font-mono text-[11px] overflow-x-auto">
                {`// 根据请求头 Accept-Language 或客户端参数自动本地化\nconst message = i18n.resolve(req.locale, "${activeCodeEntry.key}");\nres.status(400).json({ code: "${activeCodeEntry.key}", error: message });`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  {t("dictionary:codeSheet.mobileSdk")}
                </span>
              </div>
              <pre className="bg-primary text-primary-foreground p-2.5 rounded font-mono text-[11px] overflow-x-auto">
                {`// iOS Swift:\nlet title = NSLocalizedString("${activeCodeEntry.key}", comment: "")\n\n// Android Kotlin:\nval title = getString(R.string.${activeCodeEntry.key.replace(/\./g, "_")})`}
              </pre>
            </div>

            <div className="bg-subtle p-3 rounded border border-line space-y-1">
              <div className="flex items-center justify-between font-semibold text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  {t("dictionary:codeSheet.emailTemplate")}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(`{{dict.${activeCodeEntry.key}}}`, "code_mail")}
                  className="text-blue-600 hover:text-blue-800 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{t("dictionary:codeSheet.copy")}</span>
                </button>
              </div>
              <pre className="bg-primary text-primary-foreground p-2.5 rounded font-mono text-[11px] overflow-x-auto">
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
        title={t("dictionary:langSheet.title")}
        description={t("dictionary:langSheet.description")}
        icon={<Languages className="w-5 h-5 text-violet-600" />}
        widthClass="max-w-xl"
        footer={
          <button
            type="button"
            onClick={() => setIsLangModalOpen(false)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
          >
            {t("dictionary:langSheet.done")}
          </button>
        }
      >
        <div className="space-y-5 text-xs">
          {/* 当前已配置语言 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t("dictionary:langSheet.configured")}
                <span className="text-[10px] text-fg-tertiary font-mono">({languages.length})</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {languages.map((l) => (
                <div
                  key={l.code}
                  className="flex items-center justify-between p-2.5 rounded border border-line bg-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{l.flag}</span>
                    <div>
                      <div className="font-semibold text-fg">{l.nativeName}</div>
                      <div className="text-[10px] text-fg-tertiary font-mono">{l.code} · {l.label}</div>
                    </div>
                  </div>
                  <Popconfirm
                    title={t("dictionary:langSheet.removeTitle", { name: l.nativeName })}
                    description={t("dictionary:langSheet.removeDesc")}
                    onConfirm={() => handleRemoveLanguage(l)}
                  >
                    <button
                      type="button"
                      disabled={languages.length <= 1}
                      className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded font-medium cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={
                        languages.length <= 1
                          ? t("dictionary:langSheet.keepOneTitle")
                          : t("dictionary:langSheet.removeLangTitle")
                      }
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
              {t("dictionary:langSheet.addFromPool")}
              <span className="text-[10px] text-fg-tertiary font-mono">（{AVAILABLE_LANGUAGES.length}）</span>
            </div>
            <input
              type="text"
              value={langPoolSearch}
              onChange={(e) => setLangPoolSearch(e.target.value)}
              placeholder={t("dictionary:langSheet.poolSearchPlaceholder")}
              className="w-full px-2.5 py-1.5 mb-2 bg-subtle border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <div className="flex items-center gap-1.5 flex-wrap max-h-64 overflow-y-auto p-1">
              {AVAILABLE_LANGUAGES.filter((cand) => {
                const q = langPoolSearch.trim().toLowerCase();
                if (!q) return true;
                return cand.nativeName.toLowerCase().includes(q) || cand.code.toLowerCase().includes(q) || cand.label.toLowerCase().includes(q);
              }).map((cand) => {
                const added = languages.some((l) => l.code === cand.code);
                return (
                  <button
                    key={cand.code}
                    type="button"
                    disabled={added}
                    onClick={() => handleAddLanguage(cand)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      added
                        ? "bg-subtle text-zinc-300 border-line-subtle cursor-not-allowed"
                        : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                    }`}
                  >
                    <span>{cand.flag}</span>
                    <span>{cand.nativeName}</span>
                    <span className="font-mono text-[9px] opacity-70">{cand.code}</span>
                    {added && <span className="text-[9px] opacity-60">{t("dictionary:langSheet.alreadyAdded")}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 自定义语种 */}
          <div className="border-t border-line-subtle pt-4">
            <div className="font-bold text-fg mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-violet-600" />
              {t("dictionary:langSheet.customAdd")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder={t("dictionary:langSheet.customCodePlaceholder")}
                value={customLangCode}
                onChange={(e) => setCustomLangCode(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
              <input
                type="text"
                placeholder={t("dictionary:langSheet.customNamePlaceholder")}
                value={customLangName}
                onChange={(e) => setCustomLangName(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
              <input
                type="text"
                placeholder={t("dictionary:langSheet.customFlagPlaceholder")}
                value={customLangFlag}
                onChange={(e) => setCustomLangFlag(e.target.value)}
                className="px-2.5 py-1.5 bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface"
              />
            </div>
            <button
              type="button"
              onClick={handleAddCustomLanguage}
              className="mt-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
            >
              {t("dictionary:langSheet.customSubmit")}
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
          title={
            editingEntry
              ? t("dictionary:editSheet.editTitle", { key: editingEntry.key })
              : t("dictionary:editSheet.createTitle", { count: languages.length })
          }
          description={t("dictionary:editSheet.description")}
          icon={<Globe className="w-5 h-5 text-violet-600" />}
          widthClass="max-w-2xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer"
              >
                {t("dictionary:editSheet.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded font-semibold cursor-pointer"
              >
                {editingEntry ? t("dictionary:editSheet.saveEdit") : t("dictionary:editSheet.saveCreate")}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Presets Bar */}
            {!isKeyReadOnly && (
              <div className="bg-violet-50/70 p-3 rounded border border-violet-200/80 space-y-1.5">
                <div className="text-[11px] font-bold text-violet-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  {t("dictionary:editSheet.presetsTitle")}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PROJECT_PRESET_ENTRIES.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2 py-1 bg-surface hover:bg-violet-100 text-violet-700 rounded text-[10px] font-mono border border-violet-200 transition-colors cursor-pointer"
                    >
                      +{preset.key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-fg-secondary block">
                  {t("dictionary:editSheet.keyLabel")} <span className="text-rose-500">*</span>:
                </label>
                {isKeyReadOnly && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
                    ({t("dictionary:editSheet.systemKeyReadOnly")})
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                readOnly={isKeyReadOnly}
                disabled={isKeyReadOnly}
                placeholder={t("dictionary:editSheet.keyPlaceholder")}
                value={formKey}
                onChange={(e) => {
                  if (!isKeyReadOnly) setFormKey(e.target.value);
                }}
                className={`w-full p-2 border rounded font-mono text-xs focus:outline-none transition-colors ${
                  isKeyReadOnly
                    ? "bg-subtle text-fg-secondary border-line cursor-not-allowed opacity-80"
                    : "bg-surface border-line focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                }`}
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("dictionary:editSheet.categoryLabel")} <span className="text-rose-500">*</span>
              </label>
              <ShadcnSelect
                value={formCategoryId || formCategory}
                onValueChange={(v) => {
                  const hit = resolveCategorySelection(v);
                  if (hit) {
                    setFormCategoryId(hit.id);
                    setFormCategory(hit.key as DictionaryCategory);
                  }
                }}
                options={flatCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                placeholder={t("dictionary:editSheet.categoryLabel")}
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("dictionary:editSheet.descLabel")}
              </label>
              <input
                type="text"
                required
                placeholder={t("dictionary:editSheet.descPlaceholder")}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="pt-2 border-t border-line-subtle">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-fg flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-indigo-600" />
                  <span>{t("dictionary:editSheet.translationsTitle", { count: languages.length })}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoTranslateAll}
                  className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded text-xs font-semibold flex items-center gap-1 border border-violet-200 transition-colors cursor-pointer"
                  title={t("dictionary:editSheet.autoTranslateTitle")}
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>{t("dictionary:editSheet.autoTranslate")}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {languages.map((l) => (
                  <div key={l.code} className="bg-subtle p-3 rounded border border-line/90 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-fg">
                      <span className="flex items-center gap-1.5">
                        <span>{l.flag}</span>
                        <span>{l.nativeName}</span>
                        <span className="font-mono text-fg-tertiary font-normal">({l.code})</span>
                      </span>
                      {formTranslations[l.code] ? (
                        <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> {t("dictionary:editSheet.configured")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-fg-tertiary font-normal">{t("dictionary:editSheet.pending")}</span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      placeholder={t("dictionary:editSheet.translationPlaceholder", { name: l.nativeName })}
                      value={formTranslations[l.code] || ""}
                      onChange={(e) =>
                        setFormTranslations((prev) => ({
                          ...prev,
                          [l.code]: e.target.value,
                        }))
                      }
                      className="w-full p-2 bg-surface border border-line rounded text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </SideSheet>
      )}

      {/* Category add / rename SideSheet */}
      <SideSheet
        id="side-sheet-dict-category"
        isOpen={categorySheetMode !== null}
        onClose={closeCategorySheet}
        title={
          categorySheetMode === "rename"
            ? t("dictionary:categorySheet.renameTitle")
            : t("dictionary:categorySheet.createTitle")
        }
        description={t("dictionary:categorySheet.description")}
        icon={<FolderTree className="w-5 h-5 text-blue-600" />}
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeCategorySheet}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer"
            >
              {t("dictionary:categorySheet.cancel")}
            </button>
            <button
              type="button"
              disabled={categorySaving}
              onClick={() => {
                void handleSubmitCategorySheet();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded font-semibold cursor-pointer"
            >
              {categorySheetMode === "rename"
                ? t("dictionary:categorySheet.submitRename")
                : t("dictionary:categorySheet.submitCreate")}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {categorySheetMode === "create" && (
            <p className="text-fg-tertiary">
              {categorySheetParent
                ? t("dictionary:categorySheet.parentHint", { name: categorySheetParent.name })
                : t("dictionary:categorySheet.rootHint")}
            </p>
          )}
          {categorySheetMode === "create" && (
            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("dictionary:categorySheet.keyLabel")}
              </label>
              <input
                type="text"
                value={categoryFormKey}
                onChange={(e) => setCategoryFormKey(e.target.value)}
                placeholder={t("dictionary:categorySheet.keyPlaceholder")}
                className="w-full p-2 bg-surface border border-line rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("dictionary:categorySheet.nameLabel")}
            </label>
            <input
              type="text"
              value={categoryFormName}
              onChange={(e) => setCategoryFormName(e.target.value)}
              placeholder={t("dictionary:categorySheet.namePlaceholder")}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
