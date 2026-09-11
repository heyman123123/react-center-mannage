import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Settings,
  Globe,
} from "lucide-react";
import { SystemUser, SystemMenuItem } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";
import { renderMenuIcon } from "./ui/iconRegistry";

interface SidebarProps {
  menus: SystemMenuItem[];
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: SystemUser;
  onOpenUserSettings: () => void;
  onOpenQuickCreate?: () => void;
}

interface MenuTreeNode extends SystemMenuItem {
  children: MenuTreeNode[];
  level: number;
}

/** 由扁平菜单数据构建无限级树 */
function buildMenuTree(menus: SystemMenuItem[]): MenuTreeNode[] {
  const itemMap = new Map<string, MenuTreeNode>();
  menus.forEach((m) => {
    itemMap.set(m.id, { ...m, children: [], level: 0 });
  });
  const roots: MenuTreeNode[] = [];
  menus.forEach((m) => {
    const node = itemMap.get(m.id)!;
    if (m.parentId && itemMap.has(m.parentId)) {
      const parent = itemMap.get(m.parentId)!;
      node.level = parent.level + 1;
      parent.children.push(node);
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
}) => {
  const currentRole = RBAC_ROLES[currentUser.roleKey] || {
    name: currentUser.role,
  };

  const tree = useMemo(() => buildMenuTree(menus), [menus]);

  // 默认展开所有一级分组
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(tree.filter((n) => n.children.length > 0).map((n) => n.id))
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: MenuTreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isActive = !hasChildren && currentTab === node.routeKey;

    if (hasChildren) {
      // 手风琴分组节点：递归渲染子节点，无限层级
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

    // 叶子节点：直接导航
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => node.routeKey && setCurrentTab(node.routeKey)}
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
      {/* Top Section */}
      <div className="p-3.5 flex flex-col gap-2 overflow-y-auto flex-1">
        {/* Platform Identity */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl border border-line-subtle bg-subtle/60">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 shadow-card">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="truncate">
            <div className="font-bold text-xs text-fg truncate">
              全球聚合支付中台
            </div>
            <div className="text-[10px] text-fg-tertiary font-mono">
              Global PayHub • Overseas
            </div>
          </div>
        </div>

        {/* Navigation Accordion (driven by menu management data) */}
        <nav className="space-y-0.5 pt-1">
          {tree
            .filter((n) => n.visible !== false)
            .map((node) => renderNode(node))}
        </nav>
      </div>

      {/* Bottom User Card - Opens User Profile Settings */}
      <div className="p-3 border-t border-line/80 bg-subtle/50">
        <button
          id="user-profile-settings-btn"
          onClick={onOpenUserSettings}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-hover transition-colors text-left group bg-surface border border-line/60 shadow-2xs cursor-pointer"
          title="点击打开个人账户设置（修改头像、修改密码等）"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-line"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-line">
                {currentUser.avatarText || currentUser.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <div className="font-bold text-xs text-fg truncate group-hover:text-blue-600 transition-colors">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-fg-secondary truncate flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-blue-600" />
                <span>{currentRole.name ? currentRole.name.split(" ")[0] : currentUser.role}</span>
              </div>
            </div>
          </div>
          <div className="p-1 rounded-lg text-fg-tertiary group-hover:text-fg group-hover:bg-hover transition-colors shrink-0">
            <Settings className="w-4 h-4" />
          </div>
        </button>
      </div>
    </aside>
  );
};
