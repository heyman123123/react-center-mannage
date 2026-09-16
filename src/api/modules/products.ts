import { http } from "../request";
import type { ProductConfig } from "../../types/payment";

export type ProductInput = {
  channelId: string;
  tenantId?: string;
  code: string;
  name: string;
  type?: ProductConfig["type"];
  currency?: string;
  price: number;
  description?: string;
  features?: string[];
  trialDays?: number;
  status?: ProductConfig["status"];
  billingInterval?: ProductConfig["billingInterval"];
};

export async function listProducts(query?: {
  tenantId?: string;
  channelId?: string;
  keyword?: string;
}): Promise<ProductConfig[]> {
  return http.get<ProductConfig[]>("/products", query);
}

export async function createProduct(body: ProductInput): Promise<ProductConfig> {
  return http.post<ProductConfig>("/products", body);
}

export async function updateProduct(id: string, body: ProductInput): Promise<ProductConfig> {
  return http.put<ProductConfig>(`/products/${id}`, body);
}

export async function deleteProduct(id: string): Promise<void> {
  await http.delete(`/products/${id}`);
}

export async function syncProduct(id: string): Promise<ProductConfig> {
  return http.post<ProductConfig>(`/products/${id}/sync`);
}

export type SyncFromCreemResult = {
  created: number;
  updated: number;
  total: number;
};

export async function syncFromCreem(channelId: string): Promise<SyncFromCreemResult> {
  return http.post<SyncFromCreemResult>(
    `/products/sync-from-creem?channelId=${encodeURIComponent(channelId)}`
  );
}
