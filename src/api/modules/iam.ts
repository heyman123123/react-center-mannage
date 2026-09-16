/**
 * IAM / 字典 API
 */
import { http } from "../request";
import type { PageResult } from "../types";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  status: string;
  phone?: string;
  avatarText?: string;
  roleKeys: string[];
  departmentIds: string[];
  createdAt: number;
}

export interface ApiPermissionPack {
  id: string;
  key: string;
  name: string;
  description: string;
  menuIds: string[];
  createdAt: number;
}

export interface ApiRole {
  id: string;
  key: string;
  name: string;
  description: string;
  isCustom: boolean;
  packIds: string[];
  appIds: string[];
  createdAt: number;
}

export interface ApiMenuNode {
  id: string;
  parentId: string | null;
  key: string;
  title: string;
  menuType: string;
  path: string;
  icon: string;
  sortOrder: number;
  hidden: boolean;
  children?: ApiMenuNode[];
}

export interface ApiDeptNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  sortOrder: number;
  leader: string;
  description: string;
  roleKeys: string[];
  memberIds: string[];
  children?: ApiDeptNode[];
}

export interface ApiDictEntry {
  id: string;
  namespace: string;
  entryKey: string;
  key: string;
  description: string;
  label: string;
  translations: Record<string, string>;
  category: string;
  categoryId?: string | null;
  createdAt: number;
}

export interface ApiDictCategory {
  id: string;
  parentId: string | null;
  key: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
  children?: ApiDictCategory[];
}

export const listUsers = (query?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
  http.get<PageResult<ApiUser>>("/users", query);

export const createUser = (body: {
  email: string;
  name: string;
  phone?: string;
  roleKeys?: string[];
  departmentIds?: string[];
}) => http.post<{ user: ApiUser; initialPassword: string }>("/users", body);

export const updateUser = (
  id: string,
  body: Partial<{ name: string; phone: string; status: string; roleKeys: string[]; departmentIds: string[] }>,
) => http.put<ApiUser>(`/users/${id}`, body);

export const deleteUser = (id: string) => http.delete(`/users/${id}`);

export const resetUserPassword = (id: string) =>
  http.post<{ password: string }>(`/users/${id}/reset-password`);

export const listRoles = () => http.get<ApiRole[]>("/roles");

export const createRole = (body: {
  key: string;
  name: string;
  description?: string;
  packIds?: string[];
  appIds?: string[];
}) => http.post<ApiRole>("/roles", body);

export const updateRole = (id: string, body: { name?: string; description?: string }) =>
  http.put<ApiRole>(`/roles/${id}`, body);

export const deleteRole = (id: string) => http.delete(`/roles/${id}`);

export const updateRolePermissions = (
  id: string,
  body: { packIds: string[]; appIds: string[] },
) => http.put<ApiRole>(`/roles/${id}/permissions`, body);

export const listPermissionPacks = () => http.get<ApiPermissionPack[]>("/permission-packs");

export const createPermissionPack = (body: {
  key: string;
  name: string;
  description?: string;
  menuIds?: string[];
}) => http.post<ApiPermissionPack>("/permission-packs", body);

export const updatePermissionPack = (
  id: string,
  body: { name?: string; description?: string },
) => http.put<ApiPermissionPack>(`/permission-packs/${id}`, body);

export const deletePermissionPack = (id: string) => http.delete(`/permission-packs/${id}`);

export const updatePermissionPackMenus = (id: string, menuIds: string[]) =>
  http.put<ApiPermissionPack>(`/permission-packs/${id}/menus`, { menuIds });

export const getMenuTree = () => http.get<ApiMenuNode[]>("/menus");

export const replaceMenus = (items: unknown[]) => http.put<ApiMenuNode[]>("/menus", items);

export const createMenu = (body: Record<string, unknown>) =>
  http.post<ApiMenuNode>("/menus", body);

export const updateMenu = (id: string, body: Record<string, unknown>) =>
  http.put<ApiMenuNode>(`/menus/${id}`, body);

export const deleteMenu = (id: string) => http.delete(`/menus/${id}`);

export const getDepartmentTree = () => http.get<ApiDeptNode[]>("/departments");

export const createDepartment = (body: Record<string, unknown>) =>
  http.post<ApiDeptNode>("/departments", body);

export const updateDepartment = (id: string, body: Record<string, unknown>) =>
  http.put<ApiDeptNode>(`/departments/${id}`, body);

export const deleteDepartment = (id: string) => http.delete(`/departments/${id}`);

export const transferDepartment = (body: {
  departmentId?: string;
  newParentId?: string;
  userId?: string;
  targetDepartmentId?: string;
}) => http.post("/departments/transfer", body);

export const listDictionaryEntries = (query?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  namespace?: string;
  categoryId?: string;
}) => http.get<PageResult<ApiDictEntry>>("/dictionary/entries", query);

export const createDictionaryEntry = (body: Record<string, unknown>) =>
  http.post<ApiDictEntry>("/dictionary/entries", body);

export const updateDictionaryEntry = (id: string, body: Record<string, unknown>) =>
  http.put<ApiDictEntry>(`/dictionary/entries/${id}`, body);

export const deleteDictionaryEntry = (id: string) => http.delete(`/dictionary/entries/${id}`);

export const listLanguages = () => http.get("/dictionary/languages");

export const listDictionaryCategories = () =>
  http.get<ApiDictCategory[]>("/dictionary/categories");

export const createDictionaryCategory = (body: {
  parentId?: string | null;
  key: string;
  name: string;
  sortOrder?: number;
}) => http.post<ApiDictCategory>("/dictionary/categories", body);

export const updateDictionaryCategory = (
  id: string,
  body: { name: string; sortOrder?: number },
) => http.put<ApiDictCategory>(`/dictionary/categories/${id}`, body);

export const deleteDictionaryCategory = (id: string) =>
  http.delete(`/dictionary/categories/${id}`);

export const listAuditLogs = (query?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  actions?: string;
  userIds?: string;
  action?: string;
  operator?: string;
}) => http.get<PageResult<ApiAuditLog>>("/audit-logs", query);

export interface ApiAuditLog {
  id: string;
  action: string;
  userId?: string;
  userName?: string;
  operator?: string;
  operatorRole?: string;
  role?: string;
  targetResource?: string;
  targetId?: string;
  details?: string;
  ipAddress: string;
  status?: string;
  timestamp: number;
  tenantId?: string;
}

export interface ApiSystemConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  remark?: string;
  updatedAt: number;
  updatedBy: string;
}

export interface ApiScheduledTask {
  id: string;
  name: string;
  type: string;
  jobKey?: string;
  cron: string;
  lastRunAt?: number;
  lastRunStatus?: string;
  nextRunAt?: number;
  status: "ENABLED" | "DISABLED";
}

export interface ApiScheduledTaskRun {
  id: string;
  taskId: string;
  status: string;
  startedAt: number;
  finishedAt?: number;
  durationMs: number;
  summary: string;
  triggerSource: string;
}

export const listSystemConfigs = (query?: { category?: string; keyword?: string }) =>
  http.get<ApiSystemConfig[]>("/system-configs", query);

export const createSystemConfig = (body: {
  key: string;
  value: string;
  description?: string;
  category: string;
  remark?: string;
}) => http.post<ApiSystemConfig>("/system-configs", body);

export const updateSystemConfig = (
  id: string,
  body: { value?: string; description?: string; category?: string; remark?: string },
) => http.put<ApiSystemConfig>(`/system-configs/${id}`, body);

export const deleteSystemConfig = (id: string) => http.delete(`/system-configs/${id}`);

export const listScheduledTasks = (query?: { keyword?: string }) =>
  http.get<ApiScheduledTask[]>("/scheduled-tasks", query);

export const getScheduledTask = (id: string) =>
  http.get<ApiScheduledTask>(`/scheduled-tasks/${id}`);

export const createScheduledTask = (body: {
  name: string;
  type: string;
  cron: string;
  jobKey?: string;
}) => http.post<ApiScheduledTask>("/scheduled-tasks", body);

export const listScheduledTaskRuns = (
  id: string,
  query?: { page?: number; pageSize?: number },
) => http.get<PageResult<ApiScheduledTaskRun>>(`/scheduled-tasks/${id}/runs`, query);

export const updateScheduledTaskStatus = (id: string, status: "ENABLED" | "DISABLED") =>
  http.put<ApiScheduledTask>(`/scheduled-tasks/${id}/status`, { status });

export const triggerScheduledTask = (id: string) =>
  http.post<ApiScheduledTask>(`/scheduled-tasks/${id}/trigger`);

