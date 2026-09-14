/**
 * 会话门禁（对齐后端 HttpOnly Cookie 方案）
 *
 * - 生产：凭证只在 Cookie 中，前端不可读/写/删；用 GET /auth/me（credentials:include）探测。
 * - Mock：仅用内存门禁标记「是否已走过登录页」，不存任何 token；刷新页面需重新登录。
 * - 禁止：localStorage / sessionStorage 存 access_token、refresh_token 或 Cookie 内容。
 */

let mockLoggedIn = false;

export function isAuthenticated(): boolean {
  return mockLoggedIn;
}

/** Mock 登录成功：只翻内存门禁。真实环境由服务端 Set-Cookie，前端不存凭证。 */
export function setAuthenticated(): void {
  mockLoggedIn = true;
}

/** Mock 登出。真实环境须先调 POST /auth/logout，由服务端清 Cookie。 */
export function clearAuth(): void {
  mockLoggedIn = false;
}

/**
 * 生产探测会话（预留）。联调时改为真实请求：
 *   await http.get('/auth/me')  // credentials: 'include'
 * 401 → clearAuth + 跳转登录
 */
export async function probeSession(): Promise<boolean> {
  return isAuthenticated();
}
