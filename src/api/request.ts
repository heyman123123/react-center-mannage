import { API_BASE_URL } from "./config";
import { ApiError } from "./types";

/**
 * fetch 封装：统一 baseURL、超时 15s、错误处理、自动 JSON 解析
 * 仅在 VITE_USE_MOCK=false 时被真实调用；当前为预留对接点。
 */

const DEFAULT_TIMEOUT = 15000;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${url}?${qs}` : url;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, headers = {}, timeout = DEFAULT_TIMEOUT } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      throw new ApiError(`HTTP ${resp.status} ${resp.statusText}`, resp.status, resp.status);
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return (await resp.text()) as unknown as T;
    }

    const json = await resp.json();
    // 兼容后端统一包装 { code, message, data }
    if (json && typeof json === "object" && "code" in json && "data" in json) {
      if (json.code !== 0) {
        throw new ApiError(json.message || "业务错误", json.code, resp.status);
      }
      return json.data as T;
    }
    return json as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`请求超时（>${timeout}ms）`, -2);
    }
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败", -3);
  }
}

export const http = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
