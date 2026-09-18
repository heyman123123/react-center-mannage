import { http } from "../request";
import type { PaymentChannel, Tenant } from "../../types/payment";

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
  return http.get<ApiTenant[]>("/tenants");
}

export async function getTenant(id: string): Promise<ApiTenant> {
  return http.get<ApiTenant>(`/tenants/${id}`);
}

export async function createTenant(body: TenantInput & { id: string }): Promise<ApiTenant> {
  return http.post<ApiTenant>("/tenants", body);
}

export async function updateTenant(id: string, body: TenantInput): Promise<ApiTenant> {
  const { id: _omit, ...payload } = body;
  return http.put<ApiTenant>(`/tenants/${id}`, payload);
}

export async function deleteTenant(id: string): Promise<void> {
  await http.delete(`/tenants/${id}`);
}
