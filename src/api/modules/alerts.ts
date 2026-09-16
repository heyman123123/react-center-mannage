import { http } from "../request";
import type { AlertHistory, AlertRule } from "../../types/payment";

export async function listAlertRules(): Promise<AlertRule[]> {
  return http.get<AlertRule[]>("/alert-rules");
}

export async function saveAlertRule(payload: AlertRule): Promise<AlertRule> {
  if (payload.id) {
    return http.put<AlertRule>(`/alert-rules/${payload.id}`, payload);
  }
  return http.post<AlertRule>("/alert-rules", payload);
}

export async function deleteAlertRule(id: string): Promise<void> {
  await http.delete(`/alert-rules/${id}`);
}

export async function toggleAlertRule(id: string): Promise<AlertRule> {
  return http.post<AlertRule>(`/alert-rules/${id}/toggle`);
}

export async function listAlertHistory(): Promise<AlertHistory[]> {
  return http.get<AlertHistory[]>("/alert-history");
}
