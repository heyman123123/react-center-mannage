import { http, upload } from "../request";
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

/** M2: 审核通过结算批次 */
export async function approveSettlement(id: string): Promise<SettlementBatch> {
  return http.post<SettlementBatch>(`/settlements/${id}/approve`);
}

/** M2: 驳回结算批次（需原因） */
export async function rejectSettlement(id: string, reason: string): Promise<SettlementBatch> {
  return http.post<SettlementBatch>(`/settlements/${id}/reject`, { reason });
}

/** M2: 上传出金凭证（multipart: file） */
export async function uploadPayoutProof(id: string, file: File): Promise<SettlementBatch> {
  const form = new FormData();
  form.append("file", file);
  return upload<SettlementBatch>(`/settlements/${id}/payout-proof`, form);
}

/** M2: 批次补单（当天后续新增交易补入） */
export async function supplementBatch(id: string): Promise<{ addedCount: number }> {
  return http.post<{ addedCount: number }>(`/settlements/${id}/supplement`);
}
