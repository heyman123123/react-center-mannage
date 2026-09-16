import { http } from "../request";
import type { ReconciliationBatch, TransactionRecord } from "../../types/payment";

export type ReconciliationSummary = {
  orderTotalAmount: number;
  gatewayTotalAmount: number;
  bankTotalAmount: number;
  orderCount: number;
  matchedRate: number;
  discrepancyCount: number;
  pendingCount: number;
};

export async function getReconciliationSummary(tenantId?: string): Promise<ReconciliationSummary> {
  return http.get<ReconciliationSummary>("/reconciliation/summary", tenantId ? { tenantId } : undefined);
}

export async function listReconciliationBatches(tenantId?: string): Promise<ReconciliationBatch[]> {
  return http.get<ReconciliationBatch[]>("/reconciliation/batches", tenantId ? { tenantId } : undefined);
}

export async function runReconciliation(tenantId?: string): Promise<{ matchedCount: number }> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return http.post<{ matchedCount: number }>(`/reconciliation/run${qs}`);
}

export async function resolveDiscrepancy(
  txId: string,
  body: { resolutionType: string; note: string }
): Promise<TransactionRecord> {
  return http.post<TransactionRecord>(`/reconciliation/discrepancies/${txId}/resolve`, body);
}
