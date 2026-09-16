import { http } from "../request";
import type { PromoCampaign } from "../../types/payment";

export async function listPromoCampaigns(): Promise<PromoCampaign[]> {
  return http.get<PromoCampaign[]>("/promo-campaigns");
}

export async function savePromoCampaign(payload: PromoCampaign): Promise<PromoCampaign> {
  if (payload.id) {
    return http.put<PromoCampaign>(`/promo-campaigns/${payload.id}`, payload);
  }
  return http.post<PromoCampaign>("/promo-campaigns", payload);
}

export async function deletePromoCampaign(id: string): Promise<void> {
  await http.delete(`/promo-campaigns/${id}`);
}
