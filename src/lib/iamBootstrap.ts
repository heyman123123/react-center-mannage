/**
 * 将一期后端 IAM/字典响应映射为前端壳层类型。
 */
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

export function flattenMenus(nodes: iamApi.ApiMenuNode[], acc: SystemMenuItem[] = []): SystemMenuItem[] {
  for (const n of nodes) {
    acc.push({
      id: n.id,
      title: n.title,
      path: n.path || "",
      icon: n.icon || "Folder",
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      order: n.sortOrder,
      menuType: (n.menuType as SystemMenuItem["menuType"]) || "route",
      routeKey: n.key || n.id,
      visible: !n.hidden,
      status: n.hidden ? "DISABLED" : "ENABLED",
      children: undefined,
    });
    if (n.children?.length) flattenMenus(n.children, acc);
  }
  return acc;
}

function flattenDepts(nodes: iamApi.ApiDeptNode[], acc: Department[] = []): Department[] {
  for (const n of nodes) {
    acc.push({
      id: n.id,
      name: n.name,
      code: n.code,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
      description: n.description,
      leader: n.leader,
      roleKeys: n.roleKeys || [],
    });
    if (n.children?.length) flattenDepts(n.children, acc);
  }
  return acc;
}

export interface ShellIamData {
  users: SystemUser[];
  roles: RbacRole[];
  packs: PermissionPack[];
  menus: SystemMenuItem[];
  departments: Department[];
  dictionary: DictionaryEntry[];
  me?: SystemUser;
}

export async function loadShellIamData(): Promise<ShellIamData | null> {
  const [
    usersRes,
    rolesRes,
    packsRes,
    menusRes,
    deptRes,
    dictRes,
    meRes,
  ] = await Promise.allSettled([
    iamApi.listUsers({ page: 1, pageSize: 100 }),
    iamApi.listRoles(),
    iamApi.listPermissionPacks(),
    iamApi.getMenuTree(),
    iamApi.getDepartmentTree(),
    iamApi.listDictionaryEntries({ page: 1, pageSize: 100 }),
    import("../api/modules/auth").then((m) => m.me()),
  ]);

  const usersPage = usersRes.status === "fulfilled" ? usersRes.value : { list: [] };
  const roles = rolesRes.status === "fulfilled" ? rolesRes.value : [];
  const packs = packsRes.status === "fulfilled" ? packsRes.value : [];
  const menuTree = menusRes.status === "fulfilled" && Array.isArray(menusRes.value) ? menusRes.value : [];
  const deptTree = deptRes.status === "fulfilled" && Array.isArray(deptRes.value) ? deptRes.value : [];
  const dictPage = dictRes.status === "fulfilled" ? dictRes.value : { list: [] };
  const me = meRes.status === "fulfilled" ? meRes.value : null;

  const users: SystemUser[] = (usersPage.list || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleKey: (u.roleKeys && u.roleKeys[0]) || "BU_OPERATOR",
    roleKeys: u.roleKeys || [],
    avatarText: u.avatarText || u.name.slice(0, 1).toUpperCase(),
    lastLogin: "-",
    status: (u.status as SystemUser["status"]) || "ACTIVE",
    departmentIds: u.departmentIds || [],
    phone: u.phone,
    createdAt: formatUnix(u.createdAt),
  }));

  const roleList: RbacRole[] = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isCustom: r.isCustom,
    permissions: {
      menuPermissionIds: [],
      appPermissionIds: r.appIds || [],
    },
    packIds: r.packIds || [],
  }));

  const packList: PermissionPack[] = (packs || []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description || "",
    menuIds: p.menuIds || [],
    createdAt: p.createdAt,
  }));

  const dictionary: DictionaryEntry[] = (dictPage.list || []).map((d) => ({
    id: d.id,
    key: d.key || d.entryKey,
    category: (d.category?.toUpperCase() as DictionaryEntry["category"]) || "COMMON",
    categoryId: d.categoryId || undefined,
    description: d.description || d.label,
    referencedTemplatesCount: 0,
    translations: {
      "zh-CN": d.translations?.["zh-CN"] || d.label || "",
      "en-US": d.translations?.["en-US"] || "",
    } as DictionaryEntry["translations"],
    updatedAt: formatUnix(d.createdAt),
  }));

  const meUser: SystemUser | undefined = me
    ? {
        ...(users.find((u) => u.id === me.id) || {
          id: me.id,
          name: me.name,
          email: me.email,
          roleKey: (me.roleKeys && me.roleKeys[0]) || "SUPER_ADMIN",
          roleKeys: me.roleKeys || [],
          avatarText: me.name.slice(0, 1).toUpperCase(),
          lastLogin: "-",
          status: "ACTIVE" as const,
        }),
        name: me.name,
        email: me.email,
        roleKey: (me.roleKeys && me.roleKeys[0]) || "SUPER_ADMIN",
        roleKeys: me.roleKeys || [],
        menuKeys: me.menuKeys || [],
      }
    : undefined;

  const flatMenus = flattenMenus(menuTree);

  return {
    users,
    roles: roleList,
    packs: packList,
    menus: flatMenus,
    departments: flattenDepts(deptTree),
    dictionary,
    me: meUser,
  };
}

export async function fetchRealMenus(): Promise<SystemMenuItem[] | null> {
  try {
    const tree = await iamApi.getMenuTree();
    if (Array.isArray(tree) && tree.length > 0) {
      return flattenMenus(tree);
    }
  } catch (err) {
    console.warn("Failed to fetch real menu data:", err);
  }
  return null;
}
