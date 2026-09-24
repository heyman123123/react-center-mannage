import { http } from "../request";
import type { MerchantApplication, MerchantStats } from "../../types/payment";

export async function listMerchantApplications(params?: { status?: string }): Promise<MerchantApplication[]> {
  return http.get<MerchantApplication[]>("/merchant-applications", params as Record<string, string> | undefined);
}

export async function getMerchantDetail(id: string): Promise<MerchantApplication> {
  return http.get<MerchantApplication>(`/merchant-applications/${id}`);
}

export async function approveMerchant(id: string): Promise<MerchantApplication> {
  return http.post<MerchantApplication>(`/merchant-applications/${id}/approve`);
}

export async function rejectMerchant(id: string, reason: string): Promise<MerchantApplication> {
  return http.post<MerchantApplication>(`/merchant-applications/${id}/reject`, { reason });
}

export async function getMerchantStats(id: string): Promise<MerchantStats> {
  return http.get<MerchantStats>(`/merchant-applications/${id}/stats`);
}
