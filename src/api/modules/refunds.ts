import { http, upload } from "../request";
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

/** 获取单笔拒付详情 */
export async function getChargebackById(id: string): Promise<ChargebackRecord> {
  return http.get<ChargebackRecord>(`/chargebacks/${id}`);
}

/**
 * M2: 真实上传拒付抗辩证据文件（multipart/form-data，字段名 file）。
 * 替换原模拟 addChargebackEvidence。
 */
export async function uploadChargebackEvidence(
  id: string,
  file: File
): Promise<ChargebackRecord> {
  const form = new FormData();
  form.append("file", file);
  return upload<ChargebackRecord>(`/chargebacks/${id}/evidence`, form);
}

/** @deprecated 兼容旧调用；请使用 uploadChargebackEvidence */
export async function addChargebackEvidence(
  id: string,
  body: { name: string; size: string }
): Promise<ChargebackRecord> {
  return http.post<ChargebackRecord>(`/chargebacks/${id}/evidence`, body);
}

export async function submitChargeback(id: string): Promise<ChargebackRecord> {
  return http.post<ChargebackRecord>(`/chargebacks/${id}/submit`);
}

/** M2: 接受拒付（= 败诉，资金永久扣除） */
export async function acceptChargeback(id: string): Promise<ChargebackRecord> {
  return http.post<ChargebackRecord>(`/chargebacks/${id}/accept`);
}
