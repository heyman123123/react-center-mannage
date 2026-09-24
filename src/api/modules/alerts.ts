import { http } from "../request";
import type { AlertChannel, AlertHistory, AlertRule } from "../../types/payment";

// ---- Alert Rules ----
export async function listAlertRules(): Promise<AlertRule[]> {
  return http.get<AlertRule[]>("/alert-rules");
}

export async function saveAlertRule(payload: Partial<AlertRule>): Promise<AlertRule> {
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

export interface TriggerResult {
  triggered: boolean;
  currentValue: number;
  threshold: number;
  message: string;
}

export async function triggerAlertRule(id: string): Promise<TriggerResult> {
  return http.post<TriggerResult>(`/alert-rules/${id}/trigger`);
}

// ---- Alert History ----
export async function listAlertHistory(params?: { status?: string; severity?: string }): Promise<AlertHistory[]> {
  return http.get<AlertHistory[]>("/alert-history", params as Record<string, string> | undefined);
}

export async function ackAlertHistory(id: string): Promise<AlertHistory> {
  return http.post<AlertHistory>(`/alert-history/${id}/ack`);
}

export async function resolveAlertHistory(id: string, resolutionNote: string): Promise<AlertHistory> {
  return http.post<AlertHistory>(`/alert-history/${id}/resolve`, { resolutionNote });
}

// ---- Alert Channels ----
export async function listAlertChannels(): Promise<AlertChannel[]> {
  return http.get<AlertChannel[]>("/alert-channels");
}

export async function saveAlertChannel(payload: Partial<AlertChannel>): Promise<AlertChannel> {
  if (payload.id) {
    return http.put<AlertChannel>(`/alert-channels/${payload.id}`, payload);
  }
  return http.post<AlertChannel>("/alert-channels", payload);
}

export async function deleteAlertChannel(id: string): Promise<void> {
  await http.delete(`/alert-channels/${id}`);
}
