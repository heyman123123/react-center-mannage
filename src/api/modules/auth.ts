/**
 * Auth API — Cookie 会话（credentials: include，JSON 无 token）
 */
import { http } from "../request";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roleKeys?: string[];
  menuKeys?: string[];
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  return http.post<{ user: AuthUser }>("/auth/login", { email, password });
}

export async function logout(): Promise<void> {
  await http.post("/auth/logout");
}

export async function me(): Promise<AuthUser> {
  return http.get<AuthUser>("/me");
}

export async function register(email: string, password: string, name: string): Promise<{ user: AuthUser }> {
  return http.post<{ user: AuthUser }>("/auth/register", { email, password, name });
}
