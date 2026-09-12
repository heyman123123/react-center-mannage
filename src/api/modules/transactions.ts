import { USE_MOCK, getCurrentApiEnv, randomMockDelay } from "../config";
import { http } from "../request";
import type { TransactionRecord } from "../../types/payment";
import {
  INITIAL_TRANSACTIONS,
  SANDBOX_TRANSACTIONS,
} from "../../data/mockData";

/** mock 延迟包装 */
function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

/** 按当前环境过滤交易（缺省 environment 视为 live） */
function pickByEnv(list: TransactionRecord[]): TransactionRecord[] {
  const env = getCurrentApiEnv();
  const base = env === "sandbox" ? list.filter((t) => t.environment === "sandbox") : list.filter((t) => t.environment !== "sandbox");
  // sandbox 环境追加独立的 sandbox 数据集
  if (env === "sandbox") return [...base, ...SANDBOX_TRANSACTIONS];
  return base;
}

export async function getTransactions(): Promise<TransactionRecord[]> {
  if (USE_MOCK) return mockResolve(pickByEnv(INITIAL_TRANSACTIONS));
  return http.get<TransactionRecord[]>("/transactions");
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  if (USE_MOCK) {
    return mockResolve(pickByEnv(INITIAL_TRANSACTIONS).find((t) => t.id === id) ?? null);
  }
  return http.get<TransactionRecord>(`/transactions/${id}`);
}
