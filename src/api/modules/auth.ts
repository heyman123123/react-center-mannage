/**
 * Auth API — Cookie 会话（credentials: include，JSON 无 token）
 */
import { http } from "../request";
import { USE_MOCK } from "../config";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roleKeys?: string[];
  menuKeys?: string[];
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { user: { id: "mock", email, name: email.split("@")[0] || "User", status: "ACTIVE" } };
  }
  return http.post<{ user: AuthUser }>("/auth/login", { email, password });
}

export async function logout(): Promise<void> {
  if (USE_MOCK) return;
  await http.post("/auth/logout");
}

export async function me(): Promise<AuthUser> {
  if (USE_MOCK) {
    throw new Error("mock me not used");
  }
  return http.get<AuthUser>("/me");
}

export async function register(email: string, password: string, name: string): Promise<{ user: AuthUser }> {
  if (USE_MOCK) {
    return { user: { id: "mock", email, name, status: "ACTIVE" } };
  }
  return http.post<{ user: AuthUser }>("/auth/register", { email, password, name });
}
