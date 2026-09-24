import { http, upload } from "../request";
import type { ReconciliationBatch, TransactionRecord, DiscrepancyRecord } from "../../types/payment";

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

/** M2: 导入渠道账单（multipart: file, channelId, statementDate） */
export async function importStatement(
  file: File,
  channelId: string,
  statementDate: string
): Promise<{ importedCount: number; matchedCount: number; discrepancyCount: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("channelId", channelId);
  form.append("statementDate", statementDate);
  return upload<{ importedCount: number; matchedCount: number; discrepancyCount: number }>(
    "/reconciliation/import",
    form
  );
}

/** M2: 获取真实对账差异列表 */
export async function listDiscrepancies(
  tenantId?: string,
  type?: string
): Promise<DiscrepancyRecord[]> {
  return http.get<DiscrepancyRecord[]>("/reconciliation/discrepancies", { tenantId, type });
}

/** M2: 处理差异（accept / investigate / escalate） */
export async function handleDiscrepancy(
  txId: string,
  action: string,
  note: string
): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>(`/reconciliation/discrepancies/${txId}/handle`, { action, note });
}
