/**
 * 会话门禁（对齐后端 HttpOnly Cookie 方案）
 *
 * - 凭证只在 Cookie 中，前端不可读/写/删；用 GET /me（credentials:include）探测。
 * - 禁止：localStorage / sessionStorage 存 access_token、refresh_token 或 Cookie 内容。
 * - sessionCached 初始为 null，刷新后须先 await probeSession，
 *   应用层应用 authReady 门闩，避免在探测完成前误渲染登录页。
 */

import * as authApi from "../api/modules/auth";

/** 缓存最近一次探测结果，避免同步路径阻塞 */
let sessionCached: boolean | null = null;

export function isAuthenticated(): boolean {
  return sessionCached === true;
}

/** 登录成功：服务端 Set-Cookie，前端不存凭证；更新本地缓存。 */
export function setAuthenticated(): void {
  sessionCached = true;
}

/** 登出须先调 POST /auth/logout，由服务端清 Cookie。 */
export function clearAuth(): void {
  sessionCached = false;
}

/** 探测会话：GET /me */
export async function probeSession(): Promise<boolean> {
  try {
    await authApi.me();
    sessionCached = true;
    return true;
  } catch {
    sessionCached = false;
    return false;
  }
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  await authApi.login(email, password);
  setAuthenticated();
}

export async function logoutSession(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    clearAuth();
  }
}
