import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  Menu,
  Plus,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
  FolderTree,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderOpen,
  Folder,
} from "lucide-react";
import { SystemMenuItem, SystemMenuType } from "../types/payment";
import { ShadcnSelect } from "./ui/select";
import { SideSheet } from "./ui/SideSheet";
import { IconPicker } from "./ui/IconPicker";
import { renderMenuIcon } from "./ui/iconRegistry";
import { Popconfirm } from "./ui/Popconfirm";

interface MenusViewProps {
  menus: SystemMenuItem[];
  onSaveMenu: (menu: SystemMenuItem) => void;
  onDeleteMenu?: (id: string) => void;
}

export const MenusView: React.FC<MenusViewProps> = ({
  menus,
  onSaveMenu,
  onDeleteMenu,
}) => {
  const { t } = useTranslation(["settings", "common"]);
  const [menuList, setMenuList] = useState<SystemMenuItem[]>(menus);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<SystemMenuItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tree expansion state（默认展开全部一级节点）
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => {
    const roots = menus.filter((m) => !m.parentId || !menus.some((x) => x.id === m.parentId));
    return new Set(roots.map((m) => m.id));
  });

  // Form State（纯菜单管理字段：标题/路径/上级/图标/排序/说明）
  const [formTitle, setFormTitle] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formParentId, setFormParentId] = useState<string>("NONE");
  const [formIcon, setFormIcon] = useState("LayoutDashboard");
  const [formOrder, setFormOrder] = useState(10);
  const [formDescription, setFormDescription] = useState("");
  const [formMenuType, setFormMenuType] = useState<SystemMenuType>("route");
  const [formRouteKey, setFormRouteKey] = useState("");

  const menuTypeOptions: { value: SystemMenuType; label: string }[] = [
    { value: "directory", label: t("menus.menuType.directory") },
    { value: "route", label: t("menus.menuType.route") },
    { value: "button", label: t("menus.menuType.button") },
  ];

  const getMenuTypeBadgeStyle = (type: SystemMenuType) => {
    switch (type) {
      case "directory":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "button":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const getMenuTypeLabel = (type: SystemMenuType) => {
    switch (type) {
      case "directory":
        return t("menus.menuType.directory");
      case "button":
        return t("menus.menuType.button");
      default:
        return t("menus.menuType.route");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleNodeExpand = (id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    menuList.forEach((m) => allIds.add(m.id));
    treeData.forEach((t) => allIds.add(t.id));
    setExpandedNodeIds(allIds);
    showToast(t("menus.toast.expandedAll"));
  };

  const collapseAll = () => {
    setExpandedNodeIds(new Set());
    showToast(t("menus.toast.collapsedAll"));
  };

  // 由 parentId 构建无限级树
  interface TreeNode extends SystemMenuItem {
    children?: TreeNode[];
    level: number;
  }

  const treeData = useMemo(() => {
    const itemMap = new Map<string, TreeNode>();
    menuList.forEach((m) => {
      itemMap.set(m.id, { ...m, level: 0, children: [] });
    });

    const roots: TreeNode[] = [];
    menuList.forEach((m) => {
      const node = itemMap.get(m.id)!;
      if (m.parentId && itemMap.has(m.parentId)) {
        const parentNode = itemMap.get(m.parentId)!;
        node.level = parentNode.level + 1;
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0));
      nodes.forEach((n) => n.children && sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }, [menuList]);

  // 扁平化树节点（用于上级节点选择器）
  const flattenTree = (nodes: TreeNode[], depth = 0): { id: string; label: string; depth: number }[] => {
    const result: { id: string; label: string; depth: number }[] = [];
    nodes.forEach((n) => {
      result.push({ id: n.id, label: n.title, depth });
      if (n.children && n.children.length > 0) {
        result.push(...flattenTree(n.children, depth + 1));
      }
    });
    return result;
  };

  const allNodes = useMemo(() => flattenTree(treeData), [treeData]);

  const handleOpenAdd = (parentId: string = "NONE") => {
    setEditingMenu(null);
    setFormTitle("");
    setFormPath(parentId === "NONE" ? "/new-route" : "#");
    setFormParentId(parentId);
    setFormIcon(parentId === "NONE" ? "FolderTree" : "Menu");
    setFormOrder((menuList.length + 1) * 10);
    setFormDescription("");
    setFormMenuType(parentId === "NONE" ? "route" : "directory");
    setFormRouteKey("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: SystemMenuItem) => {
    setEditingMenu(m);
    setFormTitle(m.title);
    setFormPath(m.path);
    setFormParentId(m.parentId || "NONE");
    setFormIcon(m.icon);
    setFormOrder(m.order ?? m.sortOrder ?? 10);
    setFormDescription(m.description || "");
    setFormMenuType(m.menuType || "route");
    setFormRouteKey(m.routeKey || "");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast(t("menus.toast.titleRequired"));
      return;
    }

    if (formMenuType === "route" && !formPath.trim()) {
      showToast(t("menus.toast.pathRequired"));
      return;
    }

    const finalOrder = Number(formOrder) || 10;
    const finalParent = formParentId === "NONE" ? null : formParentId;
    const finalPath = formPath.trim() || (formMenuType === "directory" ? "#" : "");
    const finalRouteKey = formRouteKey.trim() || undefined;

    if (editingMenu) {
      const updated: SystemMenuItem = {
        ...editingMenu,
        title: formTitle.trim(),
        path: finalPath,
        parentId: finalParent,
        icon: formIcon,
        order: finalOrder,
        sortOrder: finalOrder,
        menuType: formMenuType,
        routeKey: finalRouteKey,
        visible: true,
        description: formDescription.trim(),
      };
      setMenuList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveMenu(updated);
      showToast(t("menus.toast.updated", { title: updated.title }));
    } else {
      const newMenu: SystemMenuItem = {
        id: `menu_${Date.now().toString().slice(-6)}`,
        title: formTitle.trim(),
        path: finalPath,
        parentId: finalParent,
        icon: formIcon,
        order: finalOrder,
        sortOrder: finalOrder,
        menuType: formMenuType,
        routeKey: finalRouteKey,
        visible: true,
        description: formDescription.trim(),
      };
      setMenuList((prev) => [...prev, newMenu]);
      onSaveMenu(newMenu);
      if (finalParent) {
        setExpandedNodeIds((prev) => new Set([...prev, finalParent]));
      }
      showToast(t("menus.toast.created", { title: newMenu.title }));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, title: string) => {
    setMenuList((prev) => prev.filter((m) => m.id !== id && m.parentId !== id));
    if (onDeleteMenu) onDeleteMenu(id);
    showToast(t("menus.toast.deleted", { title }));
  };

  // Filter evaluation helper
  const filterMatch = (node: TreeNode): boolean => {
    const matchesSearch =
      !searchQuery ||
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase());

    const childrenMatch = node.children ? node.children.some(filterMatch) : false;

    return matchesSearch || childrenMatch;
  };

  // Render tree node recursively（无限层级）
  const renderTreeNode = (node: TreeNode) => {
    if (!filterMatch(node)) return null;

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const isRoot = node.level === 0;
    const nodeMenuType: SystemMenuType = node.menuType || "route";

    return (
      <React.Fragment key={node.id}>
        <div
          className={`flex items-center justify-between py-2.5 px-3 transition-colors group border-b border-line-subtle ${
            isRoot
              ? "bg-subtle/80 font-bold text-fg"
              : "hover:bg-subtle/60 text-fg text-xs"
          }`}
          style={{ paddingLeft: `${Math.max(16, node.level * 28 + 16)}px` }}
        >
          {/* Node Left Content */}
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNodeExpand(node.id)}
                className="p-1 text-fg-tertiary hover:text-fg hover:bg-hover/60 rounded transition-colors cursor-pointer"
                title={isExpanded ? t("menus.collapseNode") : t("menus.expandNode")}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-fg-secondary" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-fg-secondary" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-zinc-300">
                <CornerDownRight className="w-3 h-3" />
              </span>
            )}

            <div className="shrink-0 flex items-center justify-center">
              {isRoot ? (
                isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-500" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500" />
                )
              ) : (
                renderMenuIcon(node.icon, "w-4 h-4")
              )}
            </div>

            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`truncate ${
                  isRoot
                    ? "text-xs font-bold text-fg"
                    : "text-xs font-medium text-fg"
                }`}
              >
                {node.title}
              </span>

              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0 ${getMenuTypeBadgeStyle(nodeMenuType)}`}
              >
                {getMenuTypeLabel(nodeMenuType)}
              </span>

              {!isRoot && node.path && node.path !== "#" && (
                <span className="text-[11px] font-mono bg-hover text-fg-secondary px-1.5 py-0.5 rounded border border-line/70 hidden sm:inline-block">
                  {node.path}
                </span>
              )}

              {isRoot && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-hover text-fg-secondary font-medium">
                  {t("menus.childCount", { count: node.children?.length || 0 })}
                </span>
              )}
            </div>
          </div>

          {/* Node Right Content (Actions) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleOpenAdd(node.id)}
                className="p-1 text-fg-secondary hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                title={t("menus.menu.addChild")}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(node)}
                className="p-1 text-fg-secondary hover:text-fg hover:bg-hover rounded transition-colors cursor-pointer"
                title={t("menus.menu.edit")}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <Popconfirm
                title={t("menus.menu.deleteTitle", { title: node.title })}
                description={t("menus.menu.deleteDesc")}
                onConfirm={() => handleDelete(node.id, node.title)}
              >
                <button
                  type="button"
                  className="p-1 text-fg-tertiary hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  title={t("menus.menu.deleteNode")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Popconfirm>
            </div>
          </div>
        </div>

        {/* Recursive Children Rendering */}
        {hasChildren && isExpanded && (
          <div className="divide-y divide-line-subtle/60">
            {node.children!.map(renderTreeNode)}
          </div>
        )}
      </React.Fragment>
    );
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-4 md:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface border border-line rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
              <FolderTree className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-fg">
{t("menus.titleFull")}
              </h1>
              <p className="text-xs text-fg-secondary mt-0.5">
{t("menus.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
{t("menus.expandAll")}
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
{t("menus.collapseAll")}
          </button>
          <button
            id="btn-add-menu-root"
            type="button"
            onClick={() => handleOpenAdd("NONE")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t("menus.addRoot")}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-line rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row gap-2 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("menus.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-subtle/80 border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
          />
        </div>
      </div>

      {/* Tree Structure Card */}
      <div className="bg-surface border border-line rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-4 py-2 bg-subtle border-b border-line text-xs font-medium text-fg-secondary flex items-center justify-between">
          <span>{t("menus.treeHeader")}</span>
          <span className="hidden sm:inline">{t("menus.treeActions")}</span>
        </div>

        <div className="divide-y divide-line-subtle">
          {treeData.map(renderTreeNode)}
          {treeData.length === 0 && (
            <div className="py-14 text-center text-xs text-fg-tertiary">
{t("menus.empty")}
            </div>
          )}
        </div>
      </div>

      {/* SideSheet for Add/Edit Menu（右侧滑入，与左侧侧边栏一致） */}
      <SideSheet
        id="side-sheet-menu-edit"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMenu ? t("menus.sheet.editTitle", { title: editingMenu.title }) : t("menus.sheet.createTitle")}
        description={t("menus.sheet.description")}
        icon={<FolderTree className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
            >
              {editingMenu ? t("menus.sheet.saveEdit") : t("menus.sheet.saveCreate")}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-fg-secondary font-medium mb-1">
{t("menus.sheet.titleLabel")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={t("menus.sheet.titlePlaceholder")}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">
{t("menus.sheet.parentLabel")}
            </label>
            <ShadcnSelect
              value={formParentId}
              onValueChange={setFormParentId}
              options={[
                { value: "NONE", label: t("menus.sheet.parentRoot") },
                ...allNodes
                  .filter((n) => !editingMenu || n.id !== editingMenu.id)
                  .map((n) => ({
                    value: n.id,
                    label: `${"　".repeat(n.depth)}${n.depth > 0 ? "└ " : ""}${n.label} (${n.id})`,
                  })),
              ]}
              placeholder={t("menus.sheet.parentPlaceholder")}
            />
            <p className="text-[11px] text-fg-tertiary mt-1">
{t("menus.sheet.parentHint")}
            </p>
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">
              {t("menus.sheet.menuTypeLabel")}
            </label>
            <ShadcnSelect
              value={formMenuType}
              onValueChange={(val) => setFormMenuType(val as SystemMenuType)}
              options={menuTypeOptions}
            />
            <p className="text-[11px] text-fg-tertiary mt-1">
              {formMenuType === "directory"
                ? t("menus.menuType.directoryHint")
                : formMenuType === "button"
                ? t("menus.menuType.buttonHint")
                : t("menus.menuType.routeHint")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary font-medium mb-1">
                {t("menus.sheet.pathLabel")}
                {formMenuType === "route" ? (
                  <span className="text-rose-500"> *</span>
                ) : (
                  <span className="text-fg-tertiary font-normal"> {t("menus.menuType.pathOptional")}</span>
                )}
              </label>
              <input
                type="text"
                placeholder={formMenuType === "button" ? "txn:export" : "/financial-reports"}
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-fg-secondary font-medium mb-1">{t("menus.sheet.orderLabel")}</label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {(formMenuType === "route" || formMenuType === "directory") && (
            <div>
              <label className="block text-fg-secondary font-medium mb-1">
                {t("menus.menuType.routeKeyLabel")}
                <span className="text-fg-tertiary font-normal"> {t("menus.menuType.routeKeyOptional")}</span>
              </label>
              <input
                type="text"
                placeholder={t("menus.menuType.routeKeyPlaceholder")}
                value={formRouteKey}
                onChange={(e) => setFormRouteKey(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* 图标选择器（替代下拉框） */}
          <IconPicker value={formIcon} onChange={setFormIcon} />

          <div>
            <label className="block text-fg-secondary font-medium mb-1">{t("menus.sheet.descLabel")}</label>
            <textarea
              rows={3}
              placeholder={t("menus.sheet.descPlaceholder")}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </form>
      </SideSheet>
    </div>
  );
};
