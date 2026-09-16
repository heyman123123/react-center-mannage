import { http } from "../request";
import type { PaymentApp } from "../../types/payment";

export async function getApps(query?: { tenantId?: string }): Promise<PaymentApp[]> {
  return http.get<PaymentApp[]>("/apps", query);
}

export async function getApp(id: string): Promise<PaymentApp> {
  return http.get<PaymentApp>(`/apps/${id}`);
}

export async function createApp(body: Partial<PaymentApp> & { name: string; code: string }): Promise<PaymentApp> {
  return http.post<PaymentApp>("/apps", body);
}

export async function updateApp(payload: PaymentApp): Promise<PaymentApp> {
  return http.put<PaymentApp>(`/apps/${payload.id}`, payload);
}

export async function deleteApp(id: string): Promise<void> {
  await http.delete(`/apps/${id}`);
}
