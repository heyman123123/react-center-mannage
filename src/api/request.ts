import { API_BASE_URL } from "./config";
import { ApiError } from "./types";

/**
 * fetch 封装：统一 baseURL、超时 15s、错误处理、自动 JSON 解析。
 * 所有 API 请求经此出口，携带 credentials: 'include'。
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

    const contentType = resp.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");
    const json = isJSON ? await resp.json() : null;

    if (!resp.ok) {
      if (json && typeof json === "object" && "message" in json) {
        throw new ApiError(String(json.message || `HTTP ${resp.status}`), Number(json.code ?? resp.status), resp.status);
      }
      throw new ApiError(`HTTP ${resp.status} ${resp.statusText}`, resp.status, resp.status);
    }

    if (!isJSON) {
      return (await resp.text()) as unknown as T;
    }

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

/**
 * 上传 multipart/form-data 文件。底层复用 fetch（credentials: include），
 * 但不设置 Content-Type（由浏览器自动带 boundary），也不 JSON.stringify body。
 * 响应解析与统一 {code,message,data} 包装逻辑保持一致。
 */
export async function upload<T = unknown>(
  path: string,
  formData: FormData,
  query?: RequestOptions["query"]
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch(buildUrl(path, query), {
      method: "POST",
      signal: controller.signal,
      credentials: "include",
      headers: { Accept: "application/json" },
      body: formData,
    });
    clearTimeout(timer);

    const contentType = resp.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");
    const json = isJSON ? await resp.json() : null;

    if (!resp.ok) {
      if (json && typeof json === "object" && "message" in json) {
        throw new ApiError(String(json.message || `HTTP ${resp.status}`), Number(json.code ?? resp.status), resp.status);
      }
      throw new ApiError(`HTTP ${resp.status} ${resp.statusText}`, resp.status, resp.status);
    }

    if (!isJSON) return (await resp.text()) as unknown as T;

    if (json && typeof json === "object" && "code" in json && "data" in json) {
      if (json.code !== 0) throw new ApiError(json.message || "业务错误", json.code, resp.status);
      return json.data as T;
    }
    return json as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("上传超时（>30000ms）", -2);
    }
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败", -3);
  }
}
