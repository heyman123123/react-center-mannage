import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { PageResult } from "../types";
import type { TransactionRecord } from "../../types/payment";
import { INITIAL_TRANSACTIONS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

export async function listTransactions(query?: {
  page?: number;
  pageSize?: number;
  tenantId?: string;
  channel?: string;
  status?: string;
  keyword?: string;
}): Promise<PageResult<TransactionRecord>> {
  if (USE_MOCK) {
    let list = INITIAL_TRANSACTIONS;
    if (query?.tenantId && query.tenantId !== "group_hq" && query.tenantId !== "ALL") {
      list = list.filter((t) => t.tenantId === query.tenantId);
    }
    if (query?.channel && query.channel !== "all") {
      list = list.filter((t) => t.channel === query.channel);
    }
    if (query?.status && query.status !== "all") {
      list = list.filter((t) => t.status === query.status);
    }
    if (query?.keyword) {
      const q = query.keyword.toLowerCase();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.channelTradeNo.toLowerCase().includes(q) ||
          t.orderTitle.toLowerCase().includes(q) ||
          (t.merchantName || "").toLowerCase().includes(q)
      );
    }
    return mockResolve({
      list,
      total: list.length,
      page: 1,
      pageSize: list.length,
    });
  }
  return http.get<PageResult<TransactionRecord>>("/transactions", query);
}

/** @deprecated 使用 listTransactions */
export async function getTransactions(): Promise<TransactionRecord[]> {
  const res = await listTransactions({ page: 1, pageSize: 200 });
  return res.list;
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  if (USE_MOCK) {
    return mockResolve(INITIAL_TRANSACTIONS.find((t) => t.id === id) ?? null);
  }
  try {
    return await http.get<TransactionRecord>(`/transactions/${id}`);
  } catch {
    return null;
  }
}
