/**
 * 统一 API 导出入口
 */
export * from "./types";
export { API_BASE_URL } from "./config";
export { request, http } from "./request";

export * as authApi from "./modules/auth";
export * as iamApi from "./modules/iam";
export * as transactionsApi from "./modules/transactions";
export * as settlementsApi from "./modules/settlements";
export * as refundsApi from "./modules/refunds";
export * as channelsApi from "./modules/channels";
export * as appsApi from "./modules/apps";
export * as tenantsApi from "./modules/tenants";
export { fetchTenantList } from "../lib/tenants";
export * as productsApi from "./modules/products";
export * as discountsApi from "./modules/discounts";
export * as reconciliationApi from "./modules/reconciliation";
export * as paymentWebhooksApi from "./modules/paymentWebhooks";
export * as messagingApi from "./modules/messaging";
export * as promoApi from "./modules/promo";
export * as endUsersApi from "./modules/endUsers";
export * as exchangeRatesApi from "./modules/exchangeRates";
export * as feeRulesApi from "./modules/feeRules";
export * as riskApi from "./modules/risk";
export * as merchantApi from "./modules/merchant";
export * as alertsApi from "./modules/alerts";
export * as reportsApi from "./modules/reports";
