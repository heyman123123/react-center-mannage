import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PaymentChannelConfig } from "../../types/payment";
import { INITIAL_PAYMENT_CHANNELS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

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
  if (USE_MOCK) {
    const list = INITIAL_PAYMENT_CHANNELS.map((c) => ({ ...c, mode: c.mode || "live" }));
    if (!query?.mode || query.mode === "all") {
      if (!query?.channelKey || query.channelKey === "all") return mockResolve(list);
      return mockResolve(list.filter((c) => c.channelKey === query.channelKey));
    }
    const filtered = list.filter((c) => (c.mode || "live") === query.mode);
    if (!query?.channelKey || query.channelKey === "all") return mockResolve(filtered);
    return mockResolve(filtered.filter((c) => c.channelKey === query.channelKey));
  }
  return http.get<PaymentChannelConfig[]>("/payment-channels", query);
}

/** @deprecated 使用 listPaymentChannels */
export async function getChannels(): Promise<PaymentChannelConfig[]> {
  return listPaymentChannels();
}

export async function createPaymentChannel(body: PaymentChannelInput): Promise<PaymentChannelConfig> {
  if (USE_MOCK) {
    const slug = body.channelKey || "creem";
    const item: PaymentChannelConfig = {
      id: `ch_${slug}_${Date.now()}`,
      channelKey: slug as PaymentChannelConfig["channelKey"],
      name: body.name,
      accountName: body.accountName,
      description: body.description || body.name,
      enabled: body.enabled ?? true,
      mode: body.mode || "live",
      apiPublicKey: "",
      apiSecretKey: body.apiSecretKey || "",
      webhookSecret: body.webhookSecret || "",
      supportedCurrencies: body.supportedCurrencies || ["USD"],
      feeRateText: body.feeRateText || "—",
      routingPriority: body.routingPriority ?? 1,
      lastTestedAt: "",
      testStatus: "DEGRADED",
      latencyMs: 0,
    };
    return mockResolve(item);
  }
  return http.post<PaymentChannelConfig>("/payment-channels", body);
}

export async function updatePaymentChannel(
  id: string,
  body: PaymentChannelInput
): Promise<PaymentChannelConfig> {
  if (USE_MOCK) {
    const found = INITIAL_PAYMENT_CHANNELS.find((c) => c.id === id);
    return mockResolve({
      ...(found || INITIAL_PAYMENT_CHANNELS[0]),
      ...body,
      id,
      mode: body.mode || found?.mode || "live",
    } as PaymentChannelConfig);
  }
  return http.put<PaymentChannelConfig>(`/payment-channels/${id}`, body);
}

export async function deletePaymentChannel(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/payment-channels/${id}`);
}

export async function testPaymentChannel(id: string): Promise<PaymentChannelConfig> {
  if (USE_MOCK) {
    const found = INITIAL_PAYMENT_CHANNELS.find((c) => c.id === id);
    const latency = Math.floor(Math.random() * 80) + 95;
    return mockResolve({
      ...(found || INITIAL_PAYMENT_CHANNELS[0]),
      id,
      testStatus: "HEALTHY",
      latencyMs: latency,
      lastTestedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    });
  }
  return http.post<PaymentChannelConfig>(`/payment-channels/${id}/test`);
}

/** @deprecated 使用 updatePaymentChannel */
export async function updateChannel(payload: PaymentChannelConfig): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
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
