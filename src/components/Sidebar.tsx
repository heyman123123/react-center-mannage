import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { SystemUser, SystemMenuItem } from "../types/payment";
import { resolveCurrentRole } from "../lib/permissions";
import { ancestorIdsForRoute } from "../lib/menuAccess";
import { renderMenuIcon } from "./ui/iconRegistry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface SidebarProps {
  menus: SystemMenuItem[];
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: SystemUser;
  onOpenUserSettings: () => void;
  onOpenQuickCreate?: () => void;
  onLogout?: () => void;
}

interface MenuTreeNode extends SystemMenuItem {
  children: MenuTreeNode[];
  level: number;
}

/** 由扁平或树形菜单数据构建无限级树 */
function flattenMenuTree(items: SystemMenuItem[]): SystemMenuItem[] {
  const result: SystemMenuItem[] = [];
  const recurse = (list: SystemMenuItem[]) => {
    for (const item of list) {
      const { children, ...rest } = item;
      result.push(rest as SystemMenuItem);
      if (children && children.length > 0) {
        recurse(children as SystemMenuItem[]);
      }
    }
  };
  recurse(items);
  return result;
}

function buildMenuTree(menus: SystemMenuItem[]): MenuTreeNode[] {
  const flat = flattenMenuTree(menus);
  const itemMap = new Map<string, MenuTreeNode>();
  flat.forEach((m) => {
    itemMap.set(m.id, { ...m, children: [], level: 0 });
    if (m.routeKey) {
      itemMap.set(m.routeKey, itemMap.get(m.id)!);
    }
  });
  const roots: MenuTreeNode[] = [];
  flat.forEach((m) => {
    const node = itemMap.get(m.id)!;
    if (node.level > 0 || roots.includes(node)) return;
    if (m.parentId && itemMap.has(m.parentId) && itemMap.get(m.parentId) !== node) {
      const parent = itemMap.get(m.parentId)!;
      node.level = parent.level + 1;
      if (!parent.children.some((c) => c.id === node.id)) {
        parent.children.push(node);
      }
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

export const Sidebar: React.FC<SidebarProps> = ({
  menus,
  currentTab,
  setCurrentTab,
  currentUser,
  onOpenUserSettings,
  onLogout,
}) => {
  const { t } = useTranslation("nav");
  const currentRole = resolveCurrentRole(currentUser, []);

  const tree = useMemo(() => buildMenuTree(menus), [menus]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    new Set(ancestorIdsForRoute(menus, currentTab))
  );

  // 刷新 / 切页 / 菜单异步加载后：展开当前页对应的祖先目录
  useEffect(() => {
    const ids = ancestorIdsForRoute(menus, currentTab);
    if (ids.length === 0) return;
    setExpandedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [menus, currentTab]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const avatarFallback =
    currentUser.avatarText || currentUser.name.slice(0, 2).toUpperCase();

  const UserAvatar = ({ className = "size-8" }: { className?: string }) =>
    currentUser.avatar ? (
      <img
        src={currentUser.avatar}
        alt={currentUser.name}
        className={`${className} rounded-lg object-cover shrink-0`}
      />
    ) : (
      <div
        className={`${className} rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0`}
      >
        {avatarFallback}
      </div>
    );

  const renderNode = (node: MenuTreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const targetTab = node.routeKey || node.id;
    const isActive =
      !hasChildren &&
      (currentTab === targetTab ||
        currentTab === node.routeKey ||
        currentTab === node.id ||
        (currentTab === "scheduled_tasks" && (node.routeKey === "system_config" || node.id === "system_config")));

    if (hasChildren) {
      const visibleChildren = node.children.filter((c) => c.visible !== false);
      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all text-left group cursor-pointer ${
              isExpanded
                ? "bg-hover text-fg font-bold"
                : "text-fg-secondary hover:bg-subtle hover:text-fg font-semibold"
            }`}
            title={node.description || node.title}
          >
            <div className="flex items-center gap-2.5 truncate">
              {renderMenuIcon(node.icon, `w-4 h-4 shrink-0 ${isExpanded ? "text-fg" : "text-fg-secondary group-hover:text-fg"}`)}
              <span className="truncate">{node.title}</span>
              {visibleChildren.length > 0 && (
                <span className="text-[9px] font-mono text-fg-tertiary bg-surface/70 border border-line rounded-full px-1.5">
                  {visibleChildren.length}
                </span>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-fg-tertiary shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-fg-tertiary shrink-0" />
            )}
          </button>

          {isExpanded && (
            <div
              className="ml-2 pl-2.5 border-l border-line-subtle space-y-0.5"
              style={{ marginLeft: `${Math.min(node.level + 1, 4) * 8}px` }}
            >
              {visibleChildren.map((child) => renderNode(child))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => targetTab && setCurrentTab(targetTab)}
        data-path={node.path}
        title={`${node.title} (${node.path})`}
        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all text-left group ${
          isActive
            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
            : "text-fg-secondary hover:bg-subtle hover:text-fg font-medium"
        }`}
      >
        {renderMenuIcon(
          node.icon,
          `w-4 h-4 shrink-0 ${
            isActive ? "text-white" : "text-fg-tertiary group-hover:text-fg-secondary"
          }`
        )}
        <span className="truncate flex-1">{node.title}</span>
      </button>
    );
  };

  return (
    <aside
      id="main-sidebar"
      className="w-64 h-screen bg-surface border-r border-line/80 flex flex-col justify-between shrink-0 select-none text-fg font-sans"
    >
      <div className="p-3.5 flex flex-col gap-2 overflow-y-auto flex-1">
        <nav className="space-y-0.5 pt-1">
          {tree
            .filter((n) => n.visible !== false)
            .map((node) => renderNode(node))}
        </nav>
      </div>

      {/* NavUser（sidebar-07） */}
      <div className="p-3 border-t border-line/80 bg-subtle/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              id="user-profile-settings-btn"
              type="button"
              className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-hover transition-colors text-left group bg-surface border border-line/60 shadow-2xs cursor-pointer data-[state=open]:bg-hover"
              title={t("userMenu.openMenu")}
            >
              <UserAvatar />
              <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
                <span className="truncate font-semibold text-fg">{currentUser.name}</span>
                <span className="truncate text-[10px] text-fg-secondary">
                  {currentUser.email || currentRole.name}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-fg-tertiary shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side="right"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar className="size-8" />
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-medium">{currentUser.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {currentUser.email || currentRole.name}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onOpenUserSettings()}
                className="gap-2"
              >
                <Sparkles />
                {t("userMenu.upgradePro")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => onOpenUserSettings()}
                className="gap-2"
              >
                <BadgeCheck />
                {t("userMenu.account")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setCurrentTab("settlements")}
                className="gap-2"
              >
                <CreditCard />
                {t("userMenu.billing")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setCurrentTab("alerts")}
                className="gap-2"
              >
                <Bell />
                {t("userMenu.notifications")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {onLogout && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onLogout()}
                  className="gap-2"
                >
                  <LogOut />
                  {t("userMenu.logout")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
