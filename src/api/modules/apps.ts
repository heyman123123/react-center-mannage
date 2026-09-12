import { USE_MOCK, getCurrentApiEnv, randomMockDelay } from "../config";
import { http } from "../request";
import type { PaymentApp } from "../../types/payment";
import { INITIAL_APPS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

function pickByEnv(list: PaymentApp[]): PaymentApp[] {
  const env = getCurrentApiEnv();
  // PaymentApp 既有 environment 字段：Production=live, Staging=sandbox
  return list.filter((a) => (env === "sandbox" ? a.environment === "Staging" : a.environment === "Production"));
}

export async function getApps(): Promise<PaymentApp[]> {
  if (USE_MOCK) return mockResolve(pickByEnv(INITIAL_APPS));
  return http.get<PaymentApp[]>("/apps");
}

export async function updateApp(payload: PaymentApp): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.put<{ ok: boolean }>(`/apps/${payload.id}`, payload);
}
