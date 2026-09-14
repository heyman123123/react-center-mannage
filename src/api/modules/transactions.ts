import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { TransactionRecord } from "../../types/payment";
import { INITIAL_TRANSACTIONS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function getTransactions(): Promise<TransactionRecord[]> {
  if (USE_MOCK) return mockResolve(INITIAL_TRANSACTIONS);
  return http.get<TransactionRecord[]>("/transactions");
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  if (USE_MOCK) {
    return mockResolve(INITIAL_TRANSACTIONS.find((t) => t.id === id) ?? null);
  }
  return http.get<TransactionRecord>(`/transactions/${id}`);
}
