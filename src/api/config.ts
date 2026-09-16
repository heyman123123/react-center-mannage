/**
 * API 层运行时配置
 * - 读取 VITE_API_BASE_URL
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";
