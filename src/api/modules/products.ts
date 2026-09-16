import { USE_MOCK, randomMockDelay } from "../config";
import { http } from "../request";
import type { ProductConfig } from "../../types/payment";
import { INITIAL_PRODUCTS } from "../../data/mockData";

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), randomMockDelay()));
}

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
  if (USE_MOCK) return mockResolve(INITIAL_PRODUCTS);
  return http.get<ProductConfig[]>("/products", query);
}

export async function createProduct(body: ProductInput): Promise<ProductConfig> {
  if (USE_MOCK) {
    const item: ProductConfig = {
      id: `prod_${Date.now()}`,
      code: body.code,
      name: body.name,
      type: body.type || "SUBSCRIPTION",
      tenantId: body.tenantId || "group_hq",
      currency: body.currency || "USD",
      price: body.price,
      description: body.description || "",
      features: body.features || [],
      trialDays: body.trialDays,
      status: body.status || "ACTIVE",
      billingInterval: body.billingInterval || "MONTHLY",
      boundChannelIds: body.channelId ? [body.channelId] : [],
      channelId: body.channelId,
      syncStatus: "SYNCED",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    return mockResolve(item);
  }
  return http.post<ProductConfig>("/products", body);
}

export async function updateProduct(id: string, body: ProductInput): Promise<ProductConfig> {
  if (USE_MOCK) {
    const found = INITIAL_PRODUCTS.find((p) => p.id === id);
    return mockResolve({ ...(found || INITIAL_PRODUCTS[0]), ...body, id } as ProductConfig);
  }
  return http.put<ProductConfig>(`/products/${id}`, body);
}

export async function deleteProduct(id: string): Promise<void> {
  if (USE_MOCK) return mockResolve(undefined as void);
  await http.delete(`/products/${id}`);
}

export async function syncProduct(id: string): Promise<ProductConfig> {
  if (USE_MOCK) {
    const found = INITIAL_PRODUCTS.find((p) => p.id === id);
    return mockResolve({ ...(found || INITIAL_PRODUCTS[0]), syncStatus: "SYNCED" });
  }
  return http.post<ProductConfig>(`/products/${id}/sync`);
}
