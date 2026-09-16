import { http } from "../request";

export type RevenueReport = {
  totalRevenue: number;
  orderCount: number;
  channelBreakdown: Record<string, number>;
  from?: string;
  to?: string;
};

export async function getRevenueReport(query?: {
  tenantId?: string;
  from?: string;
  to?: string;
}): Promise<RevenueReport> {
  return http.get<RevenueReport>("/reports/revenue", query);
}
