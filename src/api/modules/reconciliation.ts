import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { ReconciliationBatch, TransactionRecord } from "../../types/payment";
import { INITIAL_RECON_BATCHES } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

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
  if (USE_MOCK) {
    return mockResolve({
      orderTotalAmount: 18420650,
      gatewayTotalAmount: 18420650,
      bankTotalAmount: 18385000,
      orderCount: 45678,
      matchedRate: 99.85,
      discrepancyCount: 2,
      pendingCount: 5,
    });
  }
  return http.get<ReconciliationSummary>("/reconciliation/summary", tenantId ? { tenantId } : undefined);
}

export async function listReconciliationBatches(tenantId?: string): Promise<ReconciliationBatch[]> {
  if (USE_MOCK) return mockResolve(INITIAL_RECON_BATCHES);
  return http.get<ReconciliationBatch[]>("/reconciliation/batches", tenantId ? { tenantId } : undefined);
}

export async function runReconciliation(tenantId?: string): Promise<{ matchedCount: number }> {
  if (USE_MOCK) return mockResolve({ matchedCount: 12 });
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return http.post<{ matchedCount: number }>(`/reconciliation/run${qs}`);
}

export async function resolveDiscrepancy(
  txId: string,
  body: { resolutionType: string; note: string }
): Promise<TransactionRecord> {
  if (USE_MOCK) {
    return mockResolve({
      id: txId,
      tenantId: "group_hq",
      channel: "creem",
      orderTitle: "",
      channelTradeNo: "",
      orderAmount: 0,
      channelFee: 0,
      currency: "USD",
      createdAt: "",
      status: "done",
      paymentMethod: "",
    });
  }
  return http.post<TransactionRecord>(`/reconciliation/discrepancies/${txId}/resolve`, body);
}
