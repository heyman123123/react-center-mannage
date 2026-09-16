/**
 * 会话门禁（对齐后端 HttpOnly Cookie 方案）
 *
 * - 生产：凭证只在 Cookie 中，前端不可读/写/删；用 GET /me（credentials:include）探测。
 * - Mock：仅用内存门禁标记「是否已走过登录页」，不存任何 token；刷新页面需重新登录。
 * - 禁止：localStorage / sessionStorage 存 access_token、refresh_token 或 Cookie 内容。
 * - 注意：真实环境下 sessionCached 初始为 null，刷新后须先 await probeSession，
 *   应用层应用 authReady 门闩，避免在探测完成前误渲染登录页。
 */

import { USE_MOCK } from "../api/config";
import * as authApi from "../api/modules/auth";

let mockLoggedIn = false;
/** 非 mock 下缓存最近一次探测结果，避免同步路径阻塞 */
let sessionCached: boolean | null = null;

export function isAuthenticated(): boolean {
  if (USE_MOCK) return mockLoggedIn;
  return sessionCached === true;
}

/** Mock 登录成功：只翻内存门禁。真实环境由服务端 Set-Cookie，前端不存凭证。 */
export function setAuthenticated(): void {
  if (USE_MOCK) {
    mockLoggedIn = true;
  } else {
    sessionCached = true;
  }
}

/** Mock 登出。真实环境须先调 POST /auth/logout，由服务端清 Cookie。 */
export function clearAuth(): void {
  mockLoggedIn = false;
  sessionCached = false;
}

/**
 * 探测会话：Mock 读内存；真实环境 GET /me。
 */
export async function probeSession(): Promise<boolean> {
  if (USE_MOCK) {
    return isAuthenticated();
  }
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
