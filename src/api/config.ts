import type { AppEnvironment } from "../types/payment";

/**
 * API 层运行时配置
 * - 读取 VITE_USE_MOCK / VITE_API_BASE_URL
 * - 维护当前业务环境（sandbox / live），供 mock 数据按环境分桶过滤
 */

// Vite 环境变量均为 string，需显式与 'true' 比较
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === "true";
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

/** 当前业务环境（由 App.tsx 在切换环境时同步进来） */
let currentEnv: AppEnvironment = "live";

export function setCurrentApiEnv(env: AppEnvironment): void {
  currentEnv = env;
}

export function getCurrentApiEnv(): AppEnvironment {
  return currentEnv;
}

/** mock 统一模拟延迟（ms） */
export const MOCK_DELAY = {
  min: 300,
  max: 600,
};

export function randomMockDelay(): number {
  return MOCK_DELAY.min + Math.floor(Math.random() * (MOCK_DELAY.max - MOCK_DELAY.min));
}
