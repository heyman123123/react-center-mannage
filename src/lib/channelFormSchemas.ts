/**
 * 接入支付渠道时，按 channelKey 展示不同凭证字段。
 * 字段值最终映射到 PaymentChannelInput（apiPublicKey / apiSecretKey / webhookSecret / accountName）。
 */
export type ChannelFormFieldId =
  | "accountName"
  | "mode"
  | "apiPublicKey"
  | "apiSecretKey"
  | "webhookSecret"
  | "merchantAccount"
  | "currencies"
  | "feeRate";

export type ChannelFormField = {
  id: ChannelFormFieldId;
  /** i18n key under payment.addSheet.fields.* or byChannel.<key>.* */
  required?: boolean;
};

export type ChannelFormSchema = {
  /** default mode when selecting this channel */
  defaultMode: "live" | "sandbox";
  defaultCurrencies: string;
  fields: ChannelFormField[];
  /** show webhook callback URL hint */
  showWebhookUrlHint?: boolean;
};

const COMMON_TAIL: ChannelFormField[] = [
  { id: "currencies" },
  { id: "feeRate" },
];

export const CHANNEL_FORM_SCHEMAS: Record<string, ChannelFormSchema> = {
  creem: {
    defaultMode: "sandbox",
    defaultCurrencies: "USD,EUR",
    showWebhookUrlHint: true,
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiSecretKey", required: true },
      { id: "webhookSecret" },
      ...COMMON_TAIL,
    ],
  },
  stripe: {
    defaultMode: "live",
    defaultCurrencies: "USD,EUR,GBP",
    showWebhookUrlHint: true,
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiPublicKey", required: true },
      { id: "apiSecretKey", required: true },
      { id: "webhookSecret", required: true },
      ...COMMON_TAIL,
    ],
  },
  paypal: {
    defaultMode: "live",
    defaultCurrencies: "USD,EUR",
    showWebhookUrlHint: true,
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiPublicKey", required: true }, // Client ID
      { id: "apiSecretKey", required: true }, // Client Secret
      { id: "webhookSecret" }, // Webhook ID / secret
      ...COMMON_TAIL,
    ],
  },
  adyen: {
    defaultMode: "live",
    defaultCurrencies: "EUR,USD,GBP",
    showWebhookUrlHint: true,
    fields: [
      { id: "accountName" },
      { id: "merchantAccount", required: true },
      { id: "mode", required: true },
      { id: "apiSecretKey", required: true },
      { id: "apiPublicKey" }, // Client Key
      { id: "webhookSecret" }, // HMAC key
      ...COMMON_TAIL,
    ],
  },
  checkout: {
    defaultMode: "live",
    defaultCurrencies: "USD,EUR,GBP",
    showWebhookUrlHint: true,
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiPublicKey", required: true },
      { id: "apiSecretKey", required: true },
      { id: "webhookSecret" },
      ...COMMON_TAIL,
    ],
  },
  klarna: {
    defaultMode: "live",
    defaultCurrencies: "EUR,USD,GBP",
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiPublicKey", required: true }, // Username
      { id: "apiSecretKey", required: true }, // Password
      ...COMMON_TAIL,
    ],
  },
  sepa: {
    defaultMode: "live",
    defaultCurrencies: "EUR",
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "merchantAccount" },
      { id: "apiSecretKey", required: true },
      ...COMMON_TAIL,
    ],
  },
  apple_pay: {
    defaultMode: "live",
    defaultCurrencies: "USD,EUR,GBP",
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiSecretKey", required: true },
      ...COMMON_TAIL,
    ],
  },
  google_pay: {
    defaultMode: "live",
    defaultCurrencies: "USD,EUR,GBP",
    fields: [
      { id: "accountName" },
      { id: "mode", required: true },
      { id: "apiSecretKey", required: true },
      ...COMMON_TAIL,
    ],
  },
};

const FALLBACK_SCHEMA: ChannelFormSchema = {
  defaultMode: "live",
  defaultCurrencies: "USD",
  fields: [
    { id: "accountName" },
    { id: "mode", required: true },
    { id: "apiSecretKey", required: true },
    { id: "webhookSecret" },
    ...COMMON_TAIL,
  ],
};

export function getChannelFormSchema(channelKey: string): ChannelFormSchema {
  return CHANNEL_FORM_SCHEMAS[channelKey] || FALLBACK_SCHEMA;
}
