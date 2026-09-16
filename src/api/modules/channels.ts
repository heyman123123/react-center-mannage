import { http } from "../request";
import type { PaymentChannelConfig } from "../../types/payment";

export type PaymentChannelInput = {
  channelKey?: PaymentChannelConfig["channelKey"];
  name: string;
  accountName?: string;
  description?: string;
  mode?: string;
  enabled?: boolean;
  apiSecretKey?: string;
  webhookSecret?: string;
  supportedCurrencies?: string[];
  feeRateText?: string;
  routingPriority?: number;
  fallbackChannelId?: string;
  tenantId?: string;
};

export async function listPaymentChannels(query?: {
  mode?: string;
  channelKey?: string;
}): Promise<PaymentChannelConfig[]> {
  return http.get<PaymentChannelConfig[]>("/payment-channels", query);
}

/** @deprecated 使用 listPaymentChannels */
export async function getChannels(): Promise<PaymentChannelConfig[]> {
  return listPaymentChannels();
}

export async function createPaymentChannel(body: PaymentChannelInput): Promise<PaymentChannelConfig> {
  return http.post<PaymentChannelConfig>("/payment-channels", body);
}

export async function updatePaymentChannel(
  id: string,
  body: PaymentChannelInput
): Promise<PaymentChannelConfig> {
  return http.put<PaymentChannelConfig>(`/payment-channels/${id}`, body);
}

export async function deletePaymentChannel(id: string): Promise<void> {
  await http.delete(`/payment-channels/${id}`);
}

export async function testPaymentChannel(id: string): Promise<PaymentChannelConfig> {
  return http.post<PaymentChannelConfig>(`/payment-channels/${id}/test`);
}

/** @deprecated 使用 updatePaymentChannel */
export async function updateChannel(payload: PaymentChannelConfig): Promise<{ ok: boolean }> {
  await updatePaymentChannel(payload.id, {
    name: payload.name,
    accountName: payload.accountName,
    description: payload.description,
    mode: payload.mode,
    enabled: payload.enabled,
    apiSecretKey: payload.apiSecretKey,
    webhookSecret: payload.webhookSecret,
    supportedCurrencies: payload.supportedCurrencies,
    feeRateText: payload.feeRateText,
    routingPriority: payload.routingPriority,
  });
  return { ok: true };
}
