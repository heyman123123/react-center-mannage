import { http } from "../request";
import type { PageResult } from "../types";
import type { PaymentWebhookLog } from "../../types/payment";

export async function listPaymentWebhooks(query?: {
  page?: number;
  pageSize?: number;
  channelId?: string;
}): Promise<PageResult<PaymentWebhookLog>> {
  return http.get<PageResult<PaymentWebhookLog>>("/payment-webhooks", query);
}

export async function redeliverPaymentWebhook(id: string): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>(`/payment-webhooks/${id}/redeliver`);
}
