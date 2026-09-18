import { http } from "../request";
import type { DiscountConfig } from "../../types/payment";

export type DiscountInput = {
  channelId: string;
  tenantId?: string;
  code: string;
  name: string;
  type?: DiscountConfig["type"];
  value: number;
  currency?: string;
  minOrderAmount?: number;
  maxUsageLimit?: number;
  startDate?: string;
  endDate?: string;
  applicableScope?: DiscountConfig["applicableScope"];
  targetTenantId?: string;
  status?: DiscountConfig["status"];
  duration?: string;
  durationInMonths?: number;
  appliesToProductIds?: string[];
};

export async function listDiscounts(query?: {
  tenantId?: string;
  channelId?: string;
}): Promise<DiscountConfig[]> {
  return http.get<DiscountConfig[]>("/discounts", query);
}

export async function createDiscount(body: DiscountInput): Promise<DiscountConfig> {
  return http.post<DiscountConfig>("/discounts", body);
}

export async function updateDiscount(id: string, body: DiscountInput): Promise<DiscountConfig> {
  return http.put<DiscountConfig>(`/discounts/${id}`, body);
}

export async function deleteDiscount(id: string): Promise<void> {
  await http.delete(`/discounts/${id}`);
}

export type SyncFromCreemResult = {
  created: number;
  updated: number;
  total: number;
};

export async function syncFromCreem(channelId: string): Promise<SyncFromCreemResult> {
  return http.post<SyncFromCreemResult>(
    `/discounts/sync-from-creem?channelId=${encodeURIComponent(channelId)}`
  );
}

export type CopyToChannelResult = {
  created: number;
  skipped: number;
  total: number;
};

export async function copyDiscountsToChannel(
  sourceChannelId: string,
  targetChannelId: string
): Promise<CopyToChannelResult> {
  return http.post<CopyToChannelResult>("/discounts/copy-to-channel", {
    sourceChannelId,
    targetChannelId,
  });
}
