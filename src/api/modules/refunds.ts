import { http } from "../request";
import type { RefundRecord, ChargebackRecord } from "../../types/payment";

export async function getRefunds(query?: { tenantId?: string; channel?: string }): Promise<RefundRecord[]> {
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
  return http.post<RefundRecord>("/refunds", payload);
}

export async function processRefund(id: string): Promise<RefundRecord> {
  return http.post<RefundRecord>(`/refunds/${id}/process`);
}

export async function getChargebacks(query?: { tenantId?: string; channel?: string }): Promise<ChargebackRecord[]> {
  return http.get<ChargebackRecord[]>("/chargebacks", query);
}

export async function addChargebackEvidence(
  id: string,
  body: { name: string; size: string }
): Promise<ChargebackRecord> {
  return http.post<ChargebackRecord>(`/chargebacks/${id}/evidence`, body);
}

export async function submitChargeback(id: string): Promise<ChargebackRecord> {
  return http.post<ChargebackRecord>(`/chargebacks/${id}/submit`);
}
