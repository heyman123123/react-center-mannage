import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PaymentApp } from "../../types/payment";
import { INITIAL_APPS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function getApps(): Promise<PaymentApp[]> {
  if (USE_MOCK) return mockResolve(INITIAL_APPS);
  return http.get<PaymentApp[]>("/apps");
}

export async function updateApp(payload: PaymentApp): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.put<{ ok: boolean }>(`/apps/${payload.id}`, payload);
}
