/**
 * API 层运行时配置
 * - 读取 VITE_USE_MOCK / VITE_API_BASE_URL
 */

// Mock 开关：默认开启（缺省/未定义时视为 true），仅显式配置为 "false" 时才走真实后端。
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== "false";
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

/** mock 统一模拟延迟（ms） */
export const MOCK_DELAY = {
  min: 300,
  max: 600,
};

export function randomMockDelay(): number {
  return MOCK_DELAY.min + Math.floor(Math.random() * (MOCK_DELAY.max - MOCK_DELAY.min));
}
