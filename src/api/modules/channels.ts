import { USE_MOCK, getCurrentApiEnv, randomMockDelay } from "../config";
import { http } from "../request";
import type { PaymentChannelConfig } from "../../types/payment";
import { INITIAL_PAYMENT_CHANNELS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

function pickByEnv(list: PaymentChannelConfig[]): PaymentChannelConfig[] {
  const env = getCurrentApiEnv();
  return list.filter((c) => (env === "sandbox" ? c.environment === "sandbox" : c.environment !== "sandbox"));
}

export async function getChannels(): Promise<PaymentChannelConfig[]> {
  if (USE_MOCK) return mockResolve(pickByEnv(INITIAL_PAYMENT_CHANNELS));
  return http.get<PaymentChannelConfig[]>("/channels");
}

export async function updateChannel(payload: PaymentChannelConfig): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.put<{ ok: boolean }>(`/channels/${payload.id}`, payload);
}
