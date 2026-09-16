import { http } from "../request";
import type { EndUser } from "../../types/payment";

export async function listEndUsers(tenantId?: string): Promise<EndUser[]> {
  return http.get<EndUser[]>("/end-users", tenantId ? { tenantId } : undefined);
}

export async function saveEndUser(payload: EndUser): Promise<EndUser> {
  if (payload.id) {
    return http.put<EndUser>(`/end-users/${payload.id}`, payload);
  }
  return http.post<EndUser>("/end-users", payload);
}

export async function deleteEndUser(id: string): Promise<void> {
  await http.delete(`/end-users/${id}`);
}
