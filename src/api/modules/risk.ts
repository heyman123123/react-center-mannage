import { http } from "../request";
import type {
  BlacklistEntry,
  BlacklistType,
  RiskDecision,
  RiskReview,
  RiskRule,
} from "../../types/payment";

// ---- Risk Rules ----
export async function listRiskRules(): Promise<RiskRule[]> {
  return http.get<RiskRule[]>("/risk-rules");
}

export async function saveRiskRule(payload: Partial<RiskRule>): Promise<RiskRule> {
  if (payload.id) {
    return http.put<RiskRule>(`/risk-rules/${payload.id}`, payload);
  }
  return http.post<RiskRule>("/risk-rules", payload);
}

export async function deleteRiskRule(id: string): Promise<void> {
  await http.delete(`/risk-rules/${id}`);
}

export async function toggleRiskRule(id: string): Promise<RiskRule> {
  return http.post<RiskRule>(`/risk-rules/${id}/toggle`);
}

// ---- Blacklist ----
export async function listBlacklist(type?: BlacklistType): Promise<BlacklistEntry[]> {
  return http.get<BlacklistEntry[]>("/blacklist", type ? { type } : undefined);
}

export async function saveBlacklistEntry(
  payload: Omit<BlacklistEntry, "id" | "createdAt" | "status">
): Promise<BlacklistEntry> {
  return http.post<BlacklistEntry>("/blacklist", payload);
}

export async function batchImportBlacklist(entries: Array<{ type: BlacklistType; value: string; reason?: string }>): Promise<{ imported: number; skipped: number }> {
  return http.post<{ imported: number; skipped: number }>("/blacklist/batch", { entries });
}

export async function deleteBlacklistEntry(id: string): Promise<void> {
  await http.delete(`/blacklist/${id}`);
}

// ---- Risk Decisions ----
export interface RiskEvaluateResult {
  riskScore: number;
  decision: "PASS" | "REVIEW" | "BLOCK";
  matchedRules: string[];
  blacklistHits: string[];
}

export async function evaluateRisk(transaction: Record<string, unknown>): Promise<RiskEvaluateResult> {
  return http.post<RiskEvaluateResult>("/risk/evaluate", transaction);
}

export async function listRiskDecisions(): Promise<RiskDecision[]> {
  return http.get<RiskDecision[]>("/risk-decisions");
}

// ---- Risk Reviews ----
export async function listRiskReviews(status?: "PENDING"): Promise<RiskReview[]> {
  return http.get<RiskReview[]>("/risk-reviews", status ? { status } : undefined);
}

export async function approveRiskReview(id: string): Promise<RiskReview> {
  return http.post<RiskReview>(`/risk-reviews/${id}/approve`);
}

export async function rejectRiskReview(id: string, reason: string): Promise<RiskReview> {
  return http.post<RiskReview>(`/risk-reviews/${id}/reject`, { reason });
}
