import { http } from "../request";
import type { BlacklistEntry, RiskRule } from "../../types/payment";

export async function listRiskRules(): Promise<RiskRule[]> {
  return http.get<RiskRule[]>("/risk-rules");
}

export async function saveRiskRule(payload: RiskRule): Promise<RiskRule> {
  if (payload.id) {
    return http.put<RiskRule>(`/risk-rules/${payload.id}`, payload);
  }
  return http.post<RiskRule>("/risk-rules", payload);
}

export async function deleteRiskRule(id: string): Promise<void> {
  await http.delete(`/risk-rules/${id}`);
}

export async function listBlacklist(): Promise<BlacklistEntry[]> {
  return http.get<BlacklistEntry[]>("/blacklist");
}

export async function saveBlacklistEntry(payload: BlacklistEntry): Promise<BlacklistEntry> {
  return http.post<BlacklistEntry>("/blacklist", payload);
}

export async function deleteBlacklistEntry(id: string): Promise<void> {
  await http.delete(`/blacklist/${id}`);
}
