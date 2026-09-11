import React, { useState, useMemo } from "react";
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
import { SystemMenuItem } from "../types/payment";
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
    showToast("已展开全部树级菜单");
  };

  const collapseAll = () => {
    setExpandedNodeIds(new Set());
    showToast("已收起全部树级菜单");
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
    setFormPath("/new-route");
    setFormParentId(parentId);
    setFormIcon("FolderTree");
    setFormOrder((menuList.length + 1) * 10);
    setFormDescription("");
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
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast("请填写菜单标题");
      return;
    }

    const finalOrder = Number(formOrder) || 10;
    const finalParent = formParentId === "NONE" ? null : formParentId;

    if (editingMenu) {
      const updated: SystemMenuItem = {
        ...editingMenu,
        title: formTitle.trim(),
        path: formPath.trim(),
        parentId: finalParent,
        icon: formIcon,
        order: finalOrder,
        sortOrder: finalOrder,
        visible: true,
        description: formDescription.trim(),
      };
      setMenuList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveMenu(updated);
      showToast(`菜单节点【${updated.title}】已成功更新！`);
    } else {
      const newMenu: SystemMenuItem = {
        id: `menu_${Date.now().toString().slice(-6)}`,
        title: formTitle.trim(),
        path: formPath.trim(),
        parentId: finalParent,
        icon: formIcon,
        order: finalOrder,
        sortOrder: finalOrder,
        visible: true,
        description: formDescription.trim(),
      };
      setMenuList((prev) => [...prev, newMenu]);
      onSaveMenu(newMenu);
      if (finalParent) {
        setExpandedNodeIds((prev) => new Set([...prev, finalParent]));
      }
      showToast(`新子菜单【${newMenu.title}】已成功挂载到树节点！`);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, title: string) => {
    setMenuList((prev) => prev.filter((m) => m.id !== id && m.parentId !== id));
    if (onDeleteMenu) onDeleteMenu(id);
    showToast(`菜单节点【${title}】及其子节点已成功删除`);
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

    return (
      <React.Fragment key={node.id}>
        <div
          className={`flex items-center justify-between py-2.5 px-4 transition-colors group border-b border-zinc-100 ${
            isRoot
              ? "bg-zinc-50/80 font-bold text-zinc-900"
              : "hover:bg-zinc-50/60 text-zinc-800 text-xs"
          }`}
          style={{ paddingLeft: `${Math.max(16, node.level * 28 + 16)}px` }}
        >
          {/* Node Left Content */}
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNodeExpand(node.id)}
                className="p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 rounded transition-colors cursor-pointer"
                title={isExpanded ? "收起子节点" : "展开子节点"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
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
                    ? "text-xs font-bold text-zinc-900"
                    : "text-xs font-medium text-zinc-800"
                }`}
              >
                {node.title}
              </span>

              {!isRoot && node.path && node.path !== "#" && (
                <span className="text-[11px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200/70 hidden sm:inline-block">
                  {node.path}
                </span>
              )}

              {isRoot && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-medium">
                  {node.children?.length || 0} 个子菜单项
                </span>
              )}
            </div>
          </div>

          {/* Node Right Content (Actions) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleOpenAdd(node.id)}
                className="p-1 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                title="添加子菜单"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(node)}
                className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                title="编辑菜单节点"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <Popconfirm
                title={`删除菜单节点「${node.title}」？`}
                description="该节点及其全部子节点将从侧边栏菜单树中移除，且无法恢复。"
                onConfirm={() => handleDelete(node.id, node.title)}
              >
                <button
                  type="button"
                  className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  title="删除节点（含子节点）"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Popconfirm>
            </div>
          </div>
        </div>

        {/* Recursive Children Rendering */}
        {hasChildren && isExpanded && (
          <div className="divide-y divide-zinc-100/60">
            {node.children!.map(renderTreeNode)}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans p-6 md:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
              <FolderTree className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900">
                系统菜单树结构管理 (Menu Management)
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                以无限级树状结构管理左侧导航菜单（左侧侧边栏与这里保持一致），支持任意层级挂载与图标选择。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            全部展开
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            全部收起
          </button>
          <button
            id="btn-add-menu-root"
            type="button"
            onClick={() => handleOpenAdd("NONE")}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增菜单节点</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索菜单名称、路由路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-50/80 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
          />
        </div>
      </div>

      {/* Tree Structure Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 flex items-center justify-between">
          <span>层级节点名称 / 路由路径</span>
          <span className="hidden sm:inline">操作</span>
        </div>

        <div className="divide-y divide-zinc-100">
          {treeData.map(renderTreeNode)}
          {treeData.length === 0 && (
            <div className="py-14 text-center text-xs text-zinc-400">
              暂无菜单数据，点击右上角「新增菜单节点」创建第一个菜单
            </div>
          )}
        </div>
      </div>

      {/* SideSheet for Add/Edit Menu（右侧滑入，与左侧侧边栏一致） */}
      <SideSheet
        id="side-sheet-menu-edit"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMenu ? `编辑菜单节点: ${editingMenu.title}` : "新增系统树级菜单"}
        description="配置菜单名称、挂载的上级父节点、路由路径与图标。菜单管理不再绑定角色权限，权限在「权限管理」中按菜单树配置。"
        icon={<FolderTree className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {editingMenu ? "保存菜单变更" : "创建并挂载节点"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-600 font-medium mb-1">
              菜单标题 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例如: 财务分析报表"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-zinc-600 font-medium mb-1">
              挂载上级节点 (Parent Node)
            </label>
            <ShadcnSelect
              value={formParentId}
              onValueChange={setFormParentId}
              options={[
                { value: "NONE", label: "作为顶级根节点 (无上级)" },
                ...allNodes
                  .filter((n) => !editingMenu || n.id !== editingMenu.id)
                  .map((n) => ({
                    value: n.id,
                    label: `${"　".repeat(n.depth)}${n.depth > 0 ? "└ " : ""}${n.label} (${n.id})`,
                  })),
              ]}
              placeholder="选择上级菜单节点"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              选择上级节点后，该菜单将以树状子节点缩进形式嵌套在其下方展示，支持无限层级。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-600 font-medium mb-1">
                路由路径 (Route Path) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="/financial-reports"
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-zinc-600 font-medium mb-1">排序权重 (Order)</label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* 图标选择器（替代下拉框） */}
          <IconPicker value={formIcon} onChange={setFormIcon} />

          <div>
            <label className="block text-zinc-600 font-medium mb-1">功能用途说明</label>
            <textarea
              rows={3}
              placeholder="简要阐述此菜单节点的职责边界与涉及的海外支付能力..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </form>
      </SideSheet>
    </div>
  );
};
