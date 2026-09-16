import { http } from "../request";

export type ChannelBreakdownItem = {
  channel: string;
  revenue: number;
  count: number;
};

export type DashboardKPI = {
  totalRevenue: number;
  orderCount: number;
  refundRate: number;
  channelBreakdown: ChannelBreakdownItem[];
  revenueChangePercent: number;
};

export async function getDashboardKPI(tenantId?: string): Promise<DashboardKPI> {
  return http.get<DashboardKPI>("/dashboard/kpi", tenantId ? { tenantId } : undefined);
}
