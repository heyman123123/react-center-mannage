import type { RbacRole, SystemUser } from "../types/payment";

const MENU_PERMISSION_MAP: Record<string, Partial<RbacRole["permissions"]>> = {
  dashboard: { canViewExecutiveDashboard: true },
  reconciliation: { canTriggerReconciliation: true, canResolveDiscrepancy: true },
  financial_reports: { canExportFinancialReports: true },
  tenants: { canManageTenantSettings: true, canViewAllTenants: true },
  payment_channels: { canManageChannels: true },
  payment_webhooks: { canManageWebhooks: true },
  apps: { canManageApps: true },
  system_users: { canManageUsers: true },
  roles: { canManageRbac: true },
  permission_packs: { canManageRbac: true },
  menus: { canManageRbac: true },
  email_templates: { canManageEmailTemplates: true },
  products: { canManageProducts: true },
  discounts: { canManageDiscounts: true },
  promo_campaigns: { canManagePromoCampaigns: true },
  dictionary: { canManageDictionary: true },
};

export function deriveRolePermissions(menuKeys: string[]): RbacRole["permissions"] {
  const perms: RbacRole["permissions"] = {};
  const keys = new Set(menuKeys);
  if (keys.has("*") || keys.has("all")) {
    return {
      canViewExecutiveDashboard: true,
      canViewAllTenants: true,
      canTriggerReconciliation: true,
      canResolveDiscrepancy: true,
      canManualAdjustFund: true,
      canExportFinancialReports: true,
      canManageRbac: true,
      canManageTenantSettings: true,
      canManageChannels: true,
      canManageWebhooks: true,
      canManageUsers: true,
      canManageApps: true,
      canManageEmailTemplates: true,
      canManageProducts: true,
      canManageDiscounts: true,
      canManagePromoCampaigns: true,
      canManageDictionary: true,
    };
  }
  for (const key of keys) {
    const mapped = MENU_PERMISSION_MAP[key];
    if (mapped) Object.assign(perms, mapped);
  }
  return perms;
}

export function resolveCurrentRole(user: SystemUser | null | undefined, roles: RbacRole[]): RbacRole {
  const roleKey = user?.roleKey || "BU_OPERATOR";
  const fromList = roles.find((r) => r.key === roleKey);
  const menuKeys = user?.menuKeys || [];
  const permissions = deriveRolePermissions(menuKeys);
  if (fromList) {
    return { ...fromList, permissions: { ...permissions, ...fromList.permissions } };
  }
  return {
    key: roleKey,
    name: roleKey,
    description: "",
    permissions,
    dataScope: roleKey === "SUPER_ADMIN" ? "ALL_TENANTS" : "ASSIGNED_TENANT",
  };
}
