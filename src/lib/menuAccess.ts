/**
 * 按当前用户有效角色过滤侧栏菜单。
 * 有效角色 = 个人 roleKeys ∪ 部门继承角色；SUPER_ADMIN 看全部。
 * 优先 /me.menuKeys；角色表 menuPermissionIds 仅作无 menuKeys 时的 fallback。
 */
import type { Department, RbacRole, SystemMenuItem, SystemUser } from "../types/payment";
import { hasMenuAccess } from "./permission";

function visible(m: SystemMenuItem): boolean {
  return m.visible !== false && m.status !== "DISABLED";
}

export function resolveUserRoleKeys(
  user: SystemUser,
  departments: Department[] = [],
): string[] {
  const set = new Set<string>();
  if (user.roleKeys?.length) {
    user.roleKeys.forEach((k) => set.add(k));
  } else if (user.roleKey) {
    set.add(user.roleKey);
  }
  for (const deptId of user.departmentIds || []) {
    const dept = departments.find((d) => d.id === deptId);
    (dept?.roleKeys || []).forEach((k) => set.add(k));
  }
  return Array.from(set);
}

export function filterMenusForUser(
  menus: SystemMenuItem[],
  user: SystemUser,
  roles: RbacRole[],
  departments: Department[] = [],
): SystemMenuItem[] {
  const roleKeys = resolveUserRoleKeys(user, departments);
  if (roleKeys.includes("SUPER_ADMIN")) {
    return menus.filter(visible);
  }

  const allowedKeys = new Set<string>();
  const allowedIds = new Set<string>();

  // 优先 /me.menuKeys
  if (Array.isArray(user.menuKeys)) {
    for (const k of user.menuKeys) {
      allowedKeys.add(k);
    }
  } else {
    // fallback：角色表菜单 ID（mock / 尚未带回 menuKeys）
    for (const rk of roleKeys) {
      const role = roles.find((r) => (r.key || r.id) === rk);
      for (const id of role?.permissions?.menuPermissionIds || []) {
        allowedIds.add(id);
      }
    }
  }

  if (allowedIds.size === 0 && allowedKeys.size === 0) {
    return [];
  }

  const byId = new Map(menus.map((m) => [m.id, m]));
  const keep = new Set<string>();

  const isAllowedNode = (m: SystemMenuItem): boolean => {
    if (!visible(m)) return false;
    if (allowedIds.size > 0 && allowedIds.has(m.id)) return true;
    if (allowedKeys.size > 0 && m.routeKey && allowedKeys.has(m.routeKey)) return true;
    return false;
  };

  for (const m of menus) {
    if (!isAllowedNode(m)) continue;
    keep.add(m.id);
    let pid = m.parentId ?? null;
    while (pid && byId.has(pid)) {
      keep.add(pid);
      pid = byId.get(pid)!.parentId ?? null;
    }
  }

  return menus.filter((m) => keep.has(m.id));
}

/** 当前用户是否可进入某个 tab（routeKey） */
export function canAccessTab(
  tab: string,
  menus: SystemMenuItem[],
  user: SystemUser,
  roles: RbacRole[],
  departments: Department[] = [],
): boolean {
  // 优先 menuKeys / SUPER_ADMIN
  if (hasMenuAccess(user, tab)) return true;
  // 已有 menuKeys（含空数组）则信任裁决，不再回退角色菜单 ID
  if (Array.isArray(user.menuKeys)) return false;

  const filtered = filterMenusForUser(menus, user, roles, departments);
  return filtered.some((m) => m.routeKey === tab);
}

interface MenuTreeNode extends SystemMenuItem {
  children: MenuTreeNode[];
}

/** 扁平菜单 → 按 order 排序的树（与侧栏一致） */
function buildSortedMenuTree(menus: SystemMenuItem[]): MenuTreeNode[] {
  const itemMap = new Map<string, MenuTreeNode>();
  menus.forEach((m) => {
    itemMap.set(m.id, { ...m, children: [] });
  });
  const roots: MenuTreeNode[] = [];
  menus.forEach((m) => {
    const node = itemMap.get(m.id)!;
    if (m.parentId && itemMap.has(m.parentId)) {
      itemMap.get(m.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: MenuTreeNode[]) => {
    nodes.sort((a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function firstLeafInTree(nodes: MenuTreeNode[]): SystemMenuItem | undefined {
  for (const node of nodes) {
    if (node.visible === false || node.status === "DISABLED") continue;
    if (node.children.length > 0) {
      const found = firstLeafInTree(node.children);
      if (found) return found;
      continue;
    }
    if (node.routeKey && node.menuType !== "directory") return node;
  }
  return undefined;
}

/** 侧栏树序下第一个可访问叶子菜单的 routeKey */
export function firstAccessibleTab(
  menus: SystemMenuItem[],
  user: SystemUser,
  roles: RbacRole[],
  departments: Department[] = [],
  fallback = "dashboard",
): string {
  const filtered = filterMenusForUser(menus, user, roles, departments);
  const leaf = firstLeafInTree(buildSortedMenuTree(filtered));
  return leaf?.routeKey || fallback;
}

/** 当前 routeKey 对应菜单的全部祖先 id（用于侧栏展开） */
export function ancestorIdsForRoute(menus: SystemMenuItem[], routeKey: string): string[] {
  if (!routeKey) return [];
  const byId = new Map(menus.map((m) => [m.id, m]));
  const target = menus.find((m) => m.routeKey === routeKey);
  if (!target) return [];
  const ids: string[] = [];
  let pid = target.parentId ?? null;
  while (pid && byId.has(pid)) {
    ids.push(pid);
    pid = byId.get(pid)!.parentId ?? null;
  }
  return ids;
}
