/**
 * 壳层 IAM 写操作：Mock 时纯本地；真实后端时调 API。
 */
import { USE_MOCK } from "../api/config";
import * as iamApi from "../api/modules/iam";
import { formatUnix } from "./time";
import type {
  DictionaryEntry,
  Department,
  PermissionPack,
  RbacRole,
  SystemMenuItem,
  SystemUser,
} from "../types/payment";

export type SaveUserResult = { user: SystemUser; initialPassword?: string };

export async function persistUser(user: SystemUser, isNew: boolean): Promise<SaveUserResult> {
  if (USE_MOCK) {
    return { user };
  }
  if (isNew) {
    const res = await iamApi.createUser({
      email: user.email,
      name: user.name,
      phone: user.phone,
      roleKeys: user.roleKeys || (user.roleKey ? [user.roleKey] : []),
      departmentIds: user.departmentIds || [],
    });
    return {
      user: {
        ...user,
        id: res.user.id,
        avatarText: res.user.avatarText || user.avatarText,
        status: (res.user.status as SystemUser["status"]) || "ACTIVE",
        createdAt: formatUnix(res.user.createdAt),
        roleKeys: res.user.roleKeys,
        departmentIds: res.user.departmentIds,
      },
      initialPassword: res.initialPassword,
    };
  }
  const updated = await iamApi.updateUser(user.id, {
    name: user.name,
    phone: user.phone,
    status: user.status,
    roleKeys: user.roleKeys || (user.roleKey ? [user.roleKey] : []),
    departmentIds: user.departmentIds || [],
  });
  return {
    user: {
      ...user,
      name: updated.name,
      phone: updated.phone,
      status: (updated.status as SystemUser["status"]) || user.status,
      roleKeys: updated.roleKeys,
      departmentIds: updated.departmentIds,
    },
  };
}

export async function removeUser(id: string): Promise<void> {
  if (USE_MOCK) return;
  await iamApi.deleteUser(id);
}

export async function resetUserPassword(id: string): Promise<string> {
  if (USE_MOCK) {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
  const res = await iamApi.resetUserPassword(id);
  return res.password;
}

export async function persistRole(role: RbacRole, isNew: boolean): Promise<RbacRole> {
  if (USE_MOCK) return role;
  const packIds = role.packIds || [];
  const appIds = role.permissions?.appPermissionIds || [];
  if (isNew) {
    const created = await iamApi.createRole({
      key: role.key || role.name.replace(/\s+/g, "_").toUpperCase(),
      name: role.name,
      description: role.description,
      packIds,
      appIds,
    });
    return {
      ...role,
      id: created.id,
      key: created.key,
      isCustom: created.isCustom,
      permissions: {
        ...role.permissions,
        menuPermissionIds: [],
        appPermissionIds: created.appIds || [],
      },
      packIds: created.packIds || [],
    };
  }
  if (!role.id) return role;
  await iamApi.updateRole(role.id, { name: role.name, description: role.description });
  await iamApi.updateRolePermissions(role.id, { packIds, appIds });
  return role;
}

export async function removeRole(idOrKey: string): Promise<void> {
  if (USE_MOCK) return;
  // 后端按 id 删除；若传入 key 则跳过（前端应传 id）
  if (idOrKey.includes("-") || idOrKey.length > 20) {
    await iamApi.deleteRole(idOrKey);
  }
}

function mapApiPack(p: iamApi.ApiPermissionPack): PermissionPack {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description || "",
    menuIds: p.menuIds || [],
    createdAt: p.createdAt,
  };
}

export async function persistPermissionPack(
  pack: PermissionPack,
  isNew: boolean,
): Promise<PermissionPack> {
  if (USE_MOCK) return pack;
  if (isNew) {
    const created = await iamApi.createPermissionPack({
      key: pack.key,
      name: pack.name,
      description: pack.description,
      menuIds: pack.menuIds || [],
    });
    return mapApiPack(created);
  }
  await iamApi.updatePermissionPack(pack.id, {
    name: pack.name,
    description: pack.description,
  });
  return pack;
}

export async function persistPermissionPackMenus(
  id: string,
  menuIds: string[],
): Promise<PermissionPack> {
  if (USE_MOCK) {
    return { id, key: id, name: "", description: "", menuIds };
  }
  const updated = await iamApi.updatePermissionPackMenus(id, menuIds);
  return mapApiPack(updated);
}

export async function removePermissionPack(id: string): Promise<void> {
  if (USE_MOCK) return;
  await iamApi.deletePermissionPack(id);
}

export async function persistMenu(menu: SystemMenuItem, isNew: boolean): Promise<SystemMenuItem> {
  if (USE_MOCK) return menu;
  const body = {
    id: isNew ? undefined : menu.id,
    parentId: menu.parentId ?? null,
    key: menu.routeKey || menu.id,
    title: menu.title,
    menuType: menu.menuType || "route",
    path: menu.path,
    icon: menu.icon,
    sortOrder: menu.sortOrder ?? menu.order ?? 0,
    hidden: menu.visible === false,
  };
  if (isNew) {
    const created = await iamApi.createMenu(body);
    return {
      ...menu,
      id: created.id,
      routeKey: created.key,
      parentId: created.parentId,
      sortOrder: created.sortOrder,
      visible: !created.hidden,
    };
  }
  await iamApi.updateMenu(menu.id, body);
  return menu;
}

export async function removeMenu(id: string): Promise<void> {
  if (USE_MOCK) return;
  await iamApi.deleteMenu(id);
}

export async function persistDepartment(dept: Department, isNew: boolean): Promise<Department> {
  if (USE_MOCK) return dept;
  const body = {
    parentId: dept.parentId ?? null,
    name: dept.name,
    code: dept.code,
    sortOrder: dept.sortOrder ?? 1,
    leader: dept.leader || "",
    description: dept.description || "",
    roleKeys: dept.roleKeys || [],
  };
  if (isNew) {
    const created = await iamApi.createDepartment(body);
    return {
      ...dept,
      id: created.id,
      roleKeys: created.roleKeys || dept.roleKeys,
    };
  }
  await iamApi.updateDepartment(dept.id, body);
  return dept;
}

export async function removeDepartment(id: string): Promise<void> {
  if (USE_MOCK) return;
  await iamApi.deleteDepartment(id);
}

export async function persistDictionaryEntry(
  entry: DictionaryEntry,
  isNew: boolean,
): Promise<DictionaryEntry> {
  if (USE_MOCK) return entry;
  const translations = entry.translations as Record<string, string>;
  const label = translations?.["zh-CN"] || entry.description || entry.key;
  if (isNew) {
    const created = await iamApi.createDictionaryEntry({
      namespace: "common",
      entryKey: entry.key,
      key: entry.key,
      description: entry.description,
      category: (entry.category || "general").toLowerCase(),
      categoryId: entry.categoryId,
      translations,
      label,
    });
    return {
      ...entry,
      id: created.id,
      key: created.key || created.entryKey,
      categoryId: created.categoryId || entry.categoryId,
    };
  }
  await iamApi.updateDictionaryEntry(entry.id, {
    description: entry.description,
    category: (entry.category || "general").toLowerCase(),
    categoryId: entry.categoryId,
    translations,
    label,
  });
  return entry;
}

export async function removeDictionaryEntry(id: string): Promise<void> {
  if (USE_MOCK) return;
  await iamApi.deleteDictionaryEntry(id);
}
