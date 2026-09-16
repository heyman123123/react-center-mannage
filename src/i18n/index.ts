import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "../locales/zh-CN";

/**
 * 管理端 UI i18n。默认 zh-CN。
 * 用户可见文案一律 t('namespace:key')，禁止在 TSX 硬编码中文/英文 UI 文案。
 * 后端下发的业务数据（订单标题、商户名等）除外，见 AGENTS.md。
 */
void i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": zhCN,
  },
  lng: "zh-CN",
  fallbackLng: "zh-CN",
  defaultNS: "common",
  ns: Object.keys(zhCN),
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
