import { USE_MOCK, getCurrentApiEnv, randomMockDelay } from "../config";
import { http } from "../request";
import type { RefundRecord, ChargebackRecord } from "../../types/payment";
import {
  INITIAL_REFUNDS,
  INITIAL_CHARGEBACKS,
  SANDBOX_REFUNDS,
} from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

function pickRefunds(list: RefundRecord[]): RefundRecord[] {
  const env = getCurrentApiEnv();
  const base = list.filter((r) => (env === "sandbox" ? r.environment === "sandbox" : r.environment !== "sandbox"));
  if (env === "sandbox") return [...base, ...SANDBOX_REFUNDS];
  return base;
}

export async function getRefunds(): Promise<RefundRecord[]> {
  if (USE_MOCK) return mockResolve(pickRefunds(INITIAL_REFUNDS));
  return http.get<RefundRecord[]>("/refunds");
}

export async function createRefund(payload: Partial<RefundRecord>): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.post<{ ok: boolean }>("/refunds", payload);
}

export async function getChargebacks(): Promise<ChargebackRecord[]> {
  if (USE_MOCK) return mockResolve(INITIAL_CHARGEBACKS);
  return http.get<ChargebackRecord[]>("/chargebacks");
}
