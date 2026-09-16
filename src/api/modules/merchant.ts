import { http } from "../request";
import type { MerchantApplication } from "../../types/payment";

export async function listMerchantApplications(): Promise<MerchantApplication[]> {
  return http.get<MerchantApplication[]>("/merchant-applications");
}

export async function approveMerchant(id: string): Promise<MerchantApplication> {
  return http.post<MerchantApplication>(`/merchant-applications/${id}/approve`);
}

export async function rejectMerchant(id: string, reason: string): Promise<MerchantApplication> {
  return http.post<MerchantApplication>(`/merchant-applications/${id}/reject`, { reason });
}
