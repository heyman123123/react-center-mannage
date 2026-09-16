import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PaymentChannel, Tenant } from "../../types/payment";
import { INITIAL_TENANTS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export type ApiTenant = Tenant & { createdAt?: number; updatedAt?: number };

export type TenantInput = {
  id?: string;
  name: string;
  code: string;
  currency: string;
  description?: string;
  color?: string;
  dailyCap?: number;
  channelsEnabled?: string[];
  isolationLevel?: Tenant["isolationLevel"];
  activeMerchantsCount?: number;
};

export async function listTenants(): Promise<ApiTenant[]> {
  if (USE_MOCK) return mockResolve(INITIAL_TENANTS);
  return http.get<ApiTenant[]>("/tenants");
}

export async function getTenant(id: string): Promise<ApiTenant> {
  if (USE_MOCK) {
    const found = INITIAL_TENANTS.find((t) => t.id === id);
    if (!found) throw new Error("not found");
    return mockResolve(found);
  }
  return http.get<ApiTenant>(`/tenants/${id}`);
}

export async function createTenant(body: TenantInput & { id: string }): Promise<ApiTenant> {
  if (USE_MOCK) {
    const item: ApiTenant = {
      id: body.id,
      name: body.name,
      code: body.code,
      currency: body.currency,
      description: body.description || "",
      color: body.color || "#0284c7",
      dailyCap: body.dailyCap || 0,
      usedToday: 0,
      channelsEnabled: (body.channelsEnabled || []) as PaymentChannel[],
      isolationLevel: body.isolationLevel || "LOGICAL_TENANT",
      activeMerchantsCount: body.activeMerchantsCount || 0,
    };
    return mockResolve(item);
  }
  return http.post<ApiTenant>("/tenants", body);
}

export async function updateTenant(id: string, body: TenantInput): Promise<ApiTenant> {
  if (USE_MOCK) {
    const found = INITIAL_TENANTS.find((t) => t.id === id);
    const merged = { ...(found || INITIAL_TENANTS[0]), ...body, id };
    return mockResolve({
      ...merged,
      channelsEnabled: (merged.channelsEnabled || []) as PaymentChannel[],
    });
  }
  return http.put<ApiTenant>(`/tenants/${id}`, body);
}

export async function deleteTenant(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/tenants/${id}`);
}
