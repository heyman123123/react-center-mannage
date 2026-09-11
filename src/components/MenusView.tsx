import React, { useState, useMemo } from "react";
import {
  Menu,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  FolderTree,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Receipt,
  Scale,
  Users,
  Package,
  Tag,
  Megaphone,
  CreditCard,
  Webhook,
  Layers,
  Mail,
  MailCheck,
  Languages,
  BookOpen,
  Folder,
  FolderOpen,
  CornerDownRight,
  ExternalLink,
} from "lucide-react";
import { SystemMenuItem, Tenant } from "../types/payment";
import { ShadcnSelect } from "./ui/select";
import { SideSheet } from "./ui/SideSheet";

interface MenusViewProps {
  menus: SystemMenuItem[];
  currentTenant?: Tenant;
  onSaveMenu: (menu: SystemMenuItem) => void;
  onDeleteMenu?: (id: string) => void;
}

const CATEGORY_OPTIONS = [
  "核心运营",
  "商品与销售",
  "支付与网关",
  "国际化与邮件",
  "系统与权限",
];

const ICON_PRESETS = [
  { name: "LayoutDashboard", label: "概览看板 (LayoutDashboard)" },
  { name: "Receipt", label: "交易流水 (Receipt)" },
  { name: "Scale", label: "对账中心 (Scale)" },
  { name: "Users", label: "用户管理 (Users)" },
  { name: "Package", label: "商品配置 (Package)" },
  { name: "Tag", label: "折扣优惠 (Tag)" },
  { name: "Megaphone", label: "营销推广 (Megaphone)" },
  { name: "CreditCard", label: "支付渠道 (CreditCard)" },
  { name: "Webhook", label: "网关回调 (Webhook)" },
  { name: "Layers", label: "出海应用 (Layers)" },
  { name: "Mail", label: "邮件通道 (Mail)" },
  { name: "MailCheck", label: "邮件模版 (MailCheck)" },
  { name: "Languages", label: "语言配置 (Languages)" },
  { name: "BookOpen", label: "字典管理 (BookOpen)" },
  { name: "ShieldCheck", label: "角色权限 (ShieldCheck)" },
  { name: "FolderTree", label: "菜单目录 (FolderTree)" },
  { name: "Folder", label: "分类目录 (Folder)" },
];

export const MenusView: React.FC<MenusViewProps> = ({
  menus,
  onSaveMenu,
  onDeleteMenu,
}) => {
  const [menuList, setMenuList] = useState<SystemMenuItem[]>(menus);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<SystemMenuItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tree expansion state
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(["root_core", "root_commerce", "root_gateway", "root_i18n", "root_system"])
  );

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formParentId, setFormParentId] = useState<string>("NONE");
  const [formIcon, setFormIcon] = useState("LayoutDashboard");
  const [formCategory, setFormCategory] = useState("核心运营");
  const [formOrder, setFormOrder] = useState(10);
  const [formRole, setFormRole] = useState("canViewExecutiveDashboard");
  const [formVisible, setFormVisible] = useState(true);
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

  const renderMenuIcon = (iconName: string) => {
    switch (iconName) {
      case "LayoutDashboard":
        return <LayoutDashboard className="w-4 h-4 text-blue-500" />;
      case "Receipt":
        return <Receipt className="w-4 h-4 text-emerald-500" />;
      case "Scale":
        return <Scale className="w-4 h-4 text-amber-500" />;
      case "Users":
        return <Users className="w-4 h-4 text-indigo-500" />;
      case "Package":
        return <Package className="w-4 h-4 text-teal-500" />;
      case "Tag":
        return <Tag className="w-4 h-4 text-rose-500" />;
      case "Megaphone":
        return <Megaphone className="w-4 h-4 text-amber-600" />;
      case "CreditCard":
        return <CreditCard className="w-4 h-4 text-sky-500" />;
      case "Webhook":
        return <Webhook className="w-4 h-4 text-purple-500" />;
      case "Layers":
        return <Layers className="w-4 h-4 text-blue-600" />;
      case "Mail":
        return <Mail className="w-4 h-4 text-pink-500" />;
      case "MailCheck":
        return <MailCheck className="w-4 h-4 text-violet-500" />;
      case "Languages":
        return <Languages className="w-4 h-4 text-cyan-500" />;
      case "BookOpen":
        return <BookOpen className="w-4 h-4 text-amber-500" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case "FolderTree":
        return <FolderTree className="w-4 h-4 text-zinc-700" />;
      case "Folder":
        return <Folder className="w-4 h-4 text-amber-500" />;
      default:
        return <Menu className="w-4 h-4 text-zinc-500" />;
    }
  };

  // Build hierarchical tree structure from menuList
  interface TreeNode extends SystemMenuItem {
    children?: TreeNode[];
    level: number;
  }

  const treeData = useMemo(() => {
    // Map items by id
    const itemMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Grouping by sections if not assigned explicit parent
    const categoryGroupMap: Record<string, { id: string; title: string; icon: string }> = {
      "核心运营": { id: "root_core", title: "核心业务导航 (Core Operations)", icon: "Folder" },
      "商品与销售": { id: "root_commerce", title: "商品与销售体系 (Commerce & Catalog)", icon: "Folder" },
      "支付与网关": { id: "root_gateway", title: "支付与网关调度 (Payments & Routing)", icon: "Folder" },
      "国际化与邮件": { id: "root_i18n", title: "国际化与邮件通知 (Localization & Mail)", icon: "Folder" },
      "系统与权限": { id: "root_system", title: "系统与安全权限 (Security & System)", icon: "Folder" },
    };

    // Ensure all items are in map
    menuList.forEach((m) => {
      itemMap.set(m.id, { ...m, level: 1, children: [] });
    });

    // Check if items have explicit parentId
    const explicitParents = new Set<string>();
    menuList.forEach((m) => {
      if (m.parentId && itemMap.has(m.parentId)) {
        explicitParents.add(m.parentId);
      }
    });

    if (explicitParents.size > 0) {
      // Build pure tree from parentId
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
      return roots;
    }

    // Default structure: group under Category Root Nodes to provide rich tree hierarchy!
    Object.entries(categoryGroupMap).forEach(([catName, groupInfo]) => {
      const itemsInCat = menuList.filter((m) => (m.category || "核心运营") === catName);
      if (itemsInCat.length > 0) {
        const rootNode: TreeNode = {
          id: groupInfo.id,
          title: groupInfo.title,
          path: "#",
          icon: groupInfo.icon,
          category: catName,
          order: 0,
          sortOrder: 0,
          requiredPermission: "canViewExecutiveDashboard",
          visible: true,
          level: 0,
          children: itemsInCat.map((m) => ({
            ...m,
            parentId: groupInfo.id,
            level: 1,
            children: [],
          })),
        };
        roots.push(rootNode);
      }
    });

    return roots;
  }, [menuList]);

  const handleOpenAdd = (parentId: string = "NONE", defaultCategory?: string) => {
    setEditingMenu(null);
    setFormTitle("");
    setFormPath("/new-route");
    setFormParentId(parentId);
    setFormIcon("FolderTree");
    setFormCategory(defaultCategory || "核心运营");
    setFormOrder((menuList.length + 1) * 10);
    setFormRole("canViewExecutiveDashboard");
    setFormVisible(true);
    setFormDescription("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: SystemMenuItem) => {
    setEditingMenu(m);
    setFormTitle(m.title);
    setFormPath(m.path);
    setFormParentId(m.parentId || "NONE");
    setFormIcon(m.icon);
    setFormCategory(m.category || "核心运营");
    setFormOrder(m.order ?? m.sortOrder ?? 10);
    setFormRole(m.requiredPermission || "canViewExecutiveDashboard");
    setFormVisible(m.visible);
    setFormDescription(m.description || "");
    setIsModalOpen(true);
  };

  const handleToggleVisible = (m: SystemMenuItem) => {
    const updated: SystemMenuItem = { ...m, visible: !m.visible };
    setMenuList((prev) => prev.map((item) => (item.id === m.id ? updated : item)));
    onSaveMenu(updated);
    showToast(`菜单【${m.title}】已设置为${updated.visible ? "在侧边栏显示" : "隐藏"}`);
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
        category: formCategory,
        order: finalOrder,
        sortOrder: finalOrder,
        requiredPermission: formRole,
        visible: formVisible,
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
        category: formCategory,
        order: finalOrder,
        sortOrder: finalOrder,
        requiredPermission: formRole,
        visible: formVisible,
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
    showToast(`菜单节点【${title}】已成功删除`);
  };

  // Filter evaluation helper
  const filterMatch = (node: TreeNode): boolean => {
    const matchesSearch =
      !searchQuery ||
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "VISIBLE" ? node.visible : !node.visible);

    const matchesCategory =
      categoryFilter === "ALL" || node.category === categoryFilter;

    const childrenMatch = node.children ? node.children.some(filterMatch) : false;

    return (matchesSearch && matchesStatus && matchesCategory) || childrenMatch;
  };

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode) => {
    if (!filterMatch(node)) return null;

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const isCategoryRoot = node.level === 0;

    return (
      <React.Fragment key={node.id}>
        <div
          className={`flex items-center justify-between py-2.5 px-4 transition-colors group border-b border-zinc-100 ${
            isCategoryRoot
              ? "bg-zinc-50/80 font-bold text-zinc-900"
              : "hover:bg-zinc-50/60 text-zinc-800 text-xs"
          }`}
          style={{ paddingLeft: `${Math.max(16, node.level * 28 + 16)}px` }}
        >
          {/* Node Left Content */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Expansion Toggle Button */}
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

            {/* Icon */}
            <div className="shrink-0 flex items-center justify-center">
              {isCategoryRoot ? (
                isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-amber-500" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500" />
                )
              ) : (
                renderMenuIcon(node.icon)
              )}
            </div>

            {/* Title & Path */}
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`truncate ${
                  isCategoryRoot
                    ? "text-xs font-bold text-zinc-900"
                    : "text-xs font-medium text-zinc-800"
                }`}
              >
                {node.title}
              </span>

              {!isCategoryRoot && node.path && node.path !== "#" && (
                <span className="text-[11px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200/70 hidden sm:inline-block">
                  {node.path}
                </span>
              )}

              {isCategoryRoot && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-medium">
                  {node.children?.length || 0} 个子菜单项
                </span>
              )}
            </div>
          </div>

          {/* Node Right Content (Category, Role, Visibility, Actions) */}
          <div className="flex items-center gap-3 shrink-0">
            {!isCategoryRoot && (
              <>
                {/* Category Tag */}
                {node.category && (
                  <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium border border-zinc-200">
                    {node.category}
                  </span>
                )}

                {/* Role Permission */}
                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                  <ShieldCheck className="w-3 h-3 text-zinc-400" />
                  <span>{node.requiredPermission || "canViewExecutiveDashboard"}</span>
                </span>

                {/* Visible Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleVisible(node)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    node.visible
                      ? "text-emerald-600 hover:bg-emerald-50"
                      : "text-zinc-400 hover:bg-zinc-100"
                  }`}
                  title={node.visible ? "当前侧边栏可见 (点击隐藏)" : "当前已隐藏 (点击显示)"}
                >
                  {node.visible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handleOpenAdd(
                    isCategoryRoot ? node.id : node.parentId || node.id,
                    node.category
                  )
                }
                className="p-1 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                title="添加子菜单"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {!isCategoryRoot && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(node)}
                    className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                    title="编辑菜单节点"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(node.id, node.title)}
                    className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    title="删除节点"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
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
                系统菜单树结构管理 (Hierarchical Menu Architecture)
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                以清晰的多层级树状结构管理系统左侧导航栏、父子菜单挂载、路由路径与权限绑定。
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

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="w-full md:w-44">
            <ShadcnSelect
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={[
                { value: "ALL", label: "全部业务分组" },
                ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
              ]}
              placeholder="按业务分组筛选"
            />
          </div>

          <div className="w-full md:w-36">
            <ShadcnSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "ALL", label: "全部显示状态" },
                { value: "VISIBLE", label: "侧边栏显示" },
                { value: "HIDDEN", label: "隐藏不展示" },
              ]}
              placeholder="按显隐筛选"
            />
          </div>
        </div>
      </div>

      {/* Tree Structure Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 flex items-center justify-between">
          <span>层级节点名称 / 路由路径</span>
          <span className="hidden sm:inline">分类 / 权限 / 操作</span>
        </div>

        <div className="divide-y divide-zinc-100">
          {treeData.map(renderTreeNode)}
        </div>
      </div>

      {/* SideSheet for Add/Edit Menu (Sliding from Left to Right) */}
      <SideSheet
        id="side-sheet-menu-edit"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMenu ? `编辑菜单节点: ${editingMenu.title}` : "新增系统树级菜单"}
        description="配置菜单名称、挂载的上级父节点、路由路径、图标以及访问所需的权限凭证。"
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
                { value: "root_core", label: "核心业务导航 (Core Operations)" },
                { value: "root_commerce", label: "商品与销售体系 (Commerce & Catalog)" },
                { value: "root_gateway", label: "支付与网关调度 (Payments & Routing)" },
                { value: "root_i18n", label: "国际化与邮件通知 (Localization & Mail)" },
                { value: "root_system", label: "系统与安全权限 (Security & System)" },
                ...menuList
                  .filter((m) => !editingMenu || m.id !== editingMenu.id)
                  .map((m) => ({
                    value: m.id,
                    label: `菜单: ${m.title} (${m.path})`,
                  })),
              ]}
              placeholder="选择上级菜单节点"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              选择上级节点后，该菜单将以树状子节点缩进形式嵌套在其下方展示。
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
              <label className="block text-zinc-600 font-medium mb-1">业务所属分组</label>
              <ShadcnSelect
                value={formCategory}
                onValueChange={setFormCategory}
                options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-600 font-medium mb-1">菜单节点图标</label>
              <ShadcnSelect
                value={formIcon}
                onValueChange={setFormIcon}
                options={ICON_PRESETS.map((ic) => ({
                  value: ic.name,
                  label: ic.label,
                }))}
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

          <div>
            <label className="block text-zinc-600 font-medium mb-1">所需角色权限项</label>
            <ShadcnSelect
              value={formRole}
              onValueChange={setFormRole}
              options={[
                { value: "canViewExecutiveDashboard", label: "看板查阅权限 (canViewExecutiveDashboard)" },
                { value: "canTriggerReconciliation", label: "对账中心平账权限 (canTriggerReconciliation)" },
                { value: "canManageProducts", label: "商品与折扣管理权限 (canManageProducts)" },
                { value: "canConfigGateways", label: "海外网关配置权限 (canConfigGateways)" },
                { value: "canManageDictionary", label: "多语言字典配置权限 (canManageDictionary)" },
                { value: "canManageRbac", label: "系统超级管理特权 (canManageRbac)" },
              ]}
            />
          </div>

          <div>
            <label className="block text-zinc-600 font-medium mb-1">侧边栏显隐状态</label>
            <ShadcnSelect
              value={formVisible ? "VISIBLE" : "HIDDEN"}
              onValueChange={(val) => setFormVisible(val === "VISIBLE")}
              options={[
                { value: "VISIBLE", label: "显示在系统导航树中" },
                { value: "HIDDEN", label: "隐藏不展示 (仅供后台路由解析)" },
              ]}
            />
          </div>

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
