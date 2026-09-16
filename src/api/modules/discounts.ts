import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { DiscountConfig } from "../../types/payment";
import { INITIAL_DISCOUNTS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

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
  if (USE_MOCK) return mockResolve(INITIAL_DISCOUNTS);
  return http.get<DiscountConfig[]>("/discounts", query);
}

export async function createDiscount(body: DiscountInput): Promise<DiscountConfig> {
  if (USE_MOCK) {
    const item: DiscountConfig = {
      id: `disc_${Date.now()}`,
      code: body.code.toUpperCase(),
      name: body.name,
      type: body.type || "PERCENTAGE",
      value: body.value,
      currency: body.currency || "USD",
      minOrderAmount: body.minOrderAmount ?? 0,
      maxUsageLimit: body.maxUsageLimit ?? 1000,
      usedCount: 0,
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      endDate: body.endDate || "2026-12-31",
      applicableScope: body.applicableScope || "ALL",
      status: body.status || "ACTIVE",
      boundChannelIds: body.channelId ? [body.channelId] : [],
      channelId: body.channelId,
      appliesToProductIds: body.appliesToProductIds,
      syncStatus: "SYNCED",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    return mockResolve(item);
  }
  return http.post<DiscountConfig>("/discounts", body);
}

export async function deleteDiscount(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/discounts/${id}`);
}
