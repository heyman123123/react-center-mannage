import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { RefundRecord, ChargebackRecord } from "../../types/payment";
import { INITIAL_REFUNDS, INITIAL_CHARGEBACKS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function getRefunds(query?: { tenantId?: string; channel?: string }): Promise<RefundRecord[]> {
  if (USE_MOCK) return mockResolve(INITIAL_REFUNDS);
  return http.get<RefundRecord[]>("/refunds", query);
}

export type CreateRefundInput = {
  transactionNo: string;
  refundAmount?: number;
  reason?: string;
  refundType?: "PARTIAL" | "FULL";
  note?: string;
};

export async function createRefund(payload: CreateRefundInput): Promise<RefundRecord> {
  if (USE_MOCK) {
    const item: RefundRecord = {
      id: `ref_${Date.now()}`,
      transactionNo: payload.transactionNo,
      tenantId: "bu_na_ecom",
      channel: "creem",
      refundAmount: payload.refundAmount || 0,
      originalAmount: 99,
      currency: "USD",
      reason: (payload.reason as RefundRecord["reason"]) || "客户要求",
      status: "PROCESSING",
      refundType: payload.refundType || "FULL",
      note: payload.note,
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    return mockResolve(item);
  }
  return http.post<RefundRecord>("/refunds", payload);
}

export async function processRefund(id: string): Promise<RefundRecord> {
  if (USE_MOCK) {
    const found = INITIAL_REFUNDS.find((r) => r.id === id);
    return mockResolve({ ...(found || INITIAL_REFUNDS[0]), id, status: "SUCCESS" });
  }
  return http.post<RefundRecord>(`/refunds/${id}/process`);
}

export async function getChargebacks(query?: { tenantId?: string; channel?: string }): Promise<ChargebackRecord[]> {
  if (USE_MOCK) return mockResolve(INITIAL_CHARGEBACKS);
  return http.get<ChargebackRecord[]>("/chargebacks", query);
}

export async function addChargebackEvidence(
  id: string,
  body: { name: string; size: string }
): Promise<ChargebackRecord> {
  if (USE_MOCK) {
    const found = INITIAL_CHARGEBACKS.find((c) => c.id === id);
    return mockResolve(found || INITIAL_CHARGEBACKS[0]);
  }
  return http.post<ChargebackRecord>(`/chargebacks/${id}/evidence`, body);
}

export async function submitChargeback(id: string): Promise<ChargebackRecord> {
  if (USE_MOCK) {
    const found = INITIAL_CHARGEBACKS.find((c) => c.id === id);
    return mockResolve({ ...(found || INITIAL_CHARGEBACKS[0]), status: "已提交证据" });
  }
  return http.post<ChargebackRecord>(`/chargebacks/${id}/submit`);
}
