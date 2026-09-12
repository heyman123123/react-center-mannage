import { USE_MOCK, getCurrentApiEnv, randomMockDelay } from "../config";
import { http } from "../request";
import type { SettlementBatch } from "../../types/payment";
import { INITIAL_SETTLEMENTS, SANDBOX_SETTLEMENTS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

function pickByEnv(list: SettlementBatch[]): SettlementBatch[] {
  const env = getCurrentApiEnv();
  const base = list.filter((b) => (env === "sandbox" ? b.environment === "sandbox" : b.environment !== "sandbox"));
  if (env === "sandbox") return [...base, ...SANDBOX_SETTLEMENTS];
  return base;
}

export async function getSettlements(): Promise<SettlementBatch[]> {
  if (USE_MOCK) return mockResolve(pickByEnv(INITIAL_SETTLEMENTS));
  return http.get<SettlementBatch[]>("/settlements");
}

export async function getSettlementById(id: string): Promise<SettlementBatch | null> {
  if (USE_MOCK) {
    return mockResolve(pickByEnv(INITIAL_SETTLEMENTS).find((b) => b.id === id) ?? null);
  }
  return http.get<SettlementBatch>(`/settlements/${id}`);
}

/** 发起出金（预留对接点） */
export async function createPayout(payload: { batchId: string; amount: number }): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.post<{ ok: boolean }>("/settlements/payout", payload);
}
