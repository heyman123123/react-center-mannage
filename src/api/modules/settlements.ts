import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { SettlementBatch } from "../../types/payment";
import { INITIAL_SETTLEMENTS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function getSettlements(): Promise<SettlementBatch[]> {
  if (USE_MOCK) return mockResolve(INITIAL_SETTLEMENTS);
  return http.get<SettlementBatch[]>("/settlements");
}

export async function getSettlementById(id: string): Promise<SettlementBatch | null> {
  if (USE_MOCK) {
    return mockResolve(INITIAL_SETTLEMENTS.find((b) => b.id === id) ?? null);
  }
  return http.get<SettlementBatch>(`/settlements/${id}`);
}

export async function createPayout(payload: { batchId: string; amount: number }): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mockResolve({ ok: true });
  return http.post<{ ok: boolean }>("/settlements/payout", payload);
}
