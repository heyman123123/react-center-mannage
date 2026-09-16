import { http } from "../request";
import type { SettlementBatch } from "../../types/payment";

export async function getSettlements(): Promise<SettlementBatch[]> {
  return http.get<SettlementBatch[]>("/settlements");
}

export async function getSettlementById(id: string): Promise<SettlementBatch | null> {
  return http.get<SettlementBatch>(`/settlements/${id}`);
}

export async function generateSettlements(tenantId?: string): Promise<{ created: number }> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return http.post<{ created: number }>(`/settlements/generate${qs}`);
}

export async function createPayout(payload: { batchId: string; amount: number }): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>("/settlements/payout", payload);
}
