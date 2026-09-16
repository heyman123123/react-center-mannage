import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PageResult } from "../types";
import type { PaymentWebhookLog } from "../../types/payment";
import { INITIAL_PAYMENT_WEBHOOKS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function listPaymentWebhooks(query?: {
  page?: number;
  pageSize?: number;
  channelId?: string;
}): Promise<PageResult<PaymentWebhookLog>> {
  if (USE_MOCK) {
    return mockResolve({
      list: INITIAL_PAYMENT_WEBHOOKS,
      total: INITIAL_PAYMENT_WEBHOOKS.length,
      page: 1,
      pageSize: 20,
    });
  }
  return http.get<PageResult<PaymentWebhookLog>>("/payment-webhooks", query);
}
