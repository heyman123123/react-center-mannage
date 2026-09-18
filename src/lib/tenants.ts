import * as tenantsApi from "../api/modules/tenants";
import type { Tenant } from "../types/payment";

/** 统一租户列表请求入口，避免各页面重复封装或分叉调用。 */
export async function fetchTenantList(): Promise<Tenant[]> {
  return tenantsApi.listTenants();
}
