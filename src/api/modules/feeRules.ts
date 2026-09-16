import { http } from "../request";
import type { FeeRule } from "../../types/payment";

export async function listFeeRules(): Promise<FeeRule[]> {
  return http.get<FeeRule[]>("/fee-rules");
}

export async function saveFeeRule(payload: FeeRule): Promise<FeeRule> {
  if (payload.id) {
    return http.put<FeeRule>(`/fee-rules/${payload.id}`, payload);
  }
  return http.post<FeeRule>("/fee-rules", payload);
}

export async function deleteFeeRule(id: string): Promise<void> {
  await http.delete(`/fee-rules/${id}`);
}
