import { http } from "../request";
import type { PageResult } from "../types";
import type { TransactionRecord } from "../../types/payment";

export async function listTransactions(query?: {
  page?: number;
  pageSize?: number;
  tenantId?: string;
  channel?: string;
  status?: string;
  keyword?: string;
}): Promise<PageResult<TransactionRecord>> {
  return http.get<PageResult<TransactionRecord>>("/transactions", query);
}

/** @deprecated 使用 listTransactions */
export async function getTransactions(): Promise<TransactionRecord[]> {
  const res = await listTransactions({ page: 1, pageSize: 200 });
  return res.list;
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  try {
    return await http.get<TransactionRecord>(`/transactions/${id}`);
  } catch {
    return null;
  }
}
