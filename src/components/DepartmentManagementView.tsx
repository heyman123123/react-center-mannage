import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Mail,
  Shield,
  FolderTree,
  Eye,
  ListTree,
  X,
  ArrowRightLeft,
} from "lucide-react";
import { Department, SystemUser, RbacRole } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { Popconfirm } from "./ui/Popconfirm";
import { ShadcnSelect } from "./ui/select";
import { MultiSelect } from "./ui/MultiSelect";
import { ContextMenu } from "./ui/ContextMenu";
import { Pagination, paginate, usePagination } from "./ui/Pagination";

interface DepartmentManagementViewProps {
  departments: Department[];
  users: SystemUser[];
  roles: RbacRole[];
  onSaveDepartment: (dept: Department) => void;
  onDeleteDepartment?: (id: string) => void;
  onSaveUser?: (user: SystemUser) => void;
}

interface DeptTreeNode extends Department {
  children: DeptTreeNode[];
  level: number;
}

function buildDeptTree(departments: Department[]): DeptTreeNode[] {
  const itemMap = new Map<string, DeptTreeNode>();
  departments.forEach((d) => itemMap.set(d.id, { ...d, children: [], level: 0 }));
  const roots: DeptTreeNode[] = [];
  departments.forEach((d) => {
    const node = itemMap.get(d.id)!;
    if (d.parentId && itemMap.has(d.parentId)) {
      const parent = itemMap.get(d.parentId)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: DeptTreeNode[]) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** 收集某部门及其所有后代 id */
function collectDeptIds(dept: DeptTreeNode): string[] {
  return [dept.id, ...dept.children.flatMap((c) => collectDeptIds(c))];
}

/** 收集某部门 id 的所有后代（不含自身） */
function collectDescendantIds(deptId: string, departments: Department[]): Set<string> {
  const result = new Set<string>();
  const walk = (parentId: string) => {
    departments.filter((d) => d.parentId === parentId).forEach((d) => {
      result.add(d.id);
      walk(d.id);
    });
  };
  walk(deptId);
  return result;
}

export const DepartmentManagementView: React.FC<DepartmentManagementViewProps> = ({
  departments,
  users,
  roles,
  onSaveDepartment,
  onDeleteDepartment,
  onSaveUser,
}) => {
  const { t } = useTranslation(["settings", "common"]);
  const [deptList, setDeptList] = useState<Department[]>(departments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(departments.filter((d) => d.parentId == null).map((d) => d.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [treeKeyword, setTreeKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"DEPT" | "MEMBER">("DEPT");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferItemIds, setTransferItemIds] = useState<string[]>([]);
  const [transferMode, setTransferMode] = useState<"DEPT" | "MEMBER">("DEPT");
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState<string>("ROOT");
  const [formCode, setFormCode] = useState("");
  const [formSort, setFormSort] = useState("1");
  const [formLeader, setFormLeader] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRoleKeys, setFormRoleKeys] = useState<string[]>([]);

  const tree = useMemo(() => buildDeptTree(deptList), [deptList]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    setDeptList(departments);
  }, [departments]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRoleName = (key: string) => {
    const r = roles.find((role) => (role.key || role.id) === key);
    return r?.name || key;
  };

  const getRoleBadgeStyle = (key: string) => {
    switch (key) {
      case "SUPER_ADMIN": return "bg-rose-50 text-rose-700 border-rose-200";
      case "FINANCE_DIRECTOR": return "bg-amber-50 text-amber-700 border-amber-200";
      case "RECON_SPECIALIST": return "bg-blue-50 text-blue-700 border-blue-200";
      case "RISK_AUDITOR": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  // 选中部门（含后代）集合
  const scopedDeptIds = useMemo(() => {
    if (selectedDeptId === "ALL") return null;
    const findNode = (nodes: DeptTreeNode[]): DeptTreeNode | null => {
      for (const n of nodes) {
        if (n.id === selectedDeptId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(tree);
    return node ? collectDeptIds(node) : null;
  }, [tree, selectedDeptId]);

  const filteredDepts = deptList.filter((d) => {
    const matchesScope = !scopedDeptIds || scopedDeptIds.includes(d.id);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q);
    return matchesScope && matchesSearch;
  });

  // 成员视图：选中部门及其后代的所有用户
  const scopeMembers = useMemo(() => {
    if (viewMode !== "MEMBER") return [];
    return users.filter((u) => {
      const ids = u.departmentIds || [];
      if (selectedDeptId === "ALL") return ids.length > 0;
      return scopedDeptIds ? ids.some((id) => scopedDeptIds.includes(id)) : false;
    });
  }, [users, viewMode, scopedDeptIds, selectedDeptId]);

  const selectedDeptName = useMemo(() => {
    if (selectedDeptId === "ALL") return t("departments.allDepts");
    return deptList.find((d) => d.id === selectedDeptId)?.name || t("departments.allDepts");
  }, [deptList, selectedDeptId]);

  const handleOpenAdd = (parentId?: string) => {
    setEditingDept(null);
    setFormName("");
    setFormParentId(parentId && parentId !== "ROOT" ? parentId : selectedDeptId === "ALL" ? "ROOT" : selectedDeptId);
    setFormCode("");
    setFormSort("1");
    setFormLeader("");
    setFormDescription("");
    setFormRoleKeys([]);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setFormParentId(dept.parentId || "ROOT");
    setFormCode(dept.code);
    setFormSort(String(dept.sortOrder ?? 1));
    setFormLeader(dept.leader || "");
    setFormDescription(dept.description || "");
    setFormRoleKeys(dept.roleKeys || []);
    setIsSheetOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      showToast(t("departments.toast.nameRequired"));
      return;
    }
    if (editingDept) {
      const updated: Department = {
        ...editingDept,
        name: formName.trim(),
        code: formCode.trim() || editingDept.code,
        parentId: formParentId === "ROOT" ? null : formParentId,
        sortOrder: parseInt(formSort, 10) || 1,
        leader: formLeader.trim() || undefined,
        description: formDescription.trim() || undefined,
        roleKeys: formRoleKeys,
      };
      setDeptList((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      onSaveDepartment(updated);
      showToast(t("departments.toast.updated", { name: updated.name }));
    } else {
      const newDept: Department = {
        id: `dep_${Date.now().toString().slice(-6)}`,
        name: formName.trim(),
        code: formCode.trim() || `D${Date.now().toString().slice(-4)}`,
        parentId: formParentId === "ROOT" ? null : formParentId,
        sortOrder: parseInt(formSort, 10) || 1,
        leader: formLeader.trim() || undefined,
        description: formDescription.trim() || undefined,
        roleKeys: formRoleKeys,
        memberCount: 0,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setDeptList((prev) => [...prev, newDept]);
      onSaveDepartment(newDept);
      showToast(t("departments.toast.created", { name: newDept.name }));
    }
    setIsSheetOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    const hasChild = deptList.some((d) => d.parentId === id);
    if (hasChild) {
      showToast(t("departments.toast.hasChildren", { name }));
      return;
    }
    setDeptList((prev) => prev.filter((d) => d.id !== id));
    if (onDeleteDepartment) onDeleteDepartment(id);
    showToast(t("departments.toast.deleted", { name }));
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const canDelete = selectedIds.every((id) => !deptList.some((d) => d.parentId === id));
    if (!canDelete) {
      showToast(t("departments.toast.batchHasChildren"));
      return;
    }
    setDeptList((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
    if (onDeleteDepartment) selectedIds.forEach((id) => onDeleteDepartment(id));
    setSelectedIds([]);
    showToast(t("departments.toast.batchDeleted", { count: selectedIds.length }));
  };

  const openTransferSheet = (ids: string[], mode: "DEPT" | "MEMBER") => {
    if (ids.length === 0) {
      showToast(t("departments.toast.transferNoSelection"));
      return;
    }
    setTransferItemIds(ids);
    setTransferMode(mode);
    setTransferTargetId("");
    setIsTransferSheetOpen(true);
  };

  const handleBatchTransfer = () => {
    if (viewMode === "MEMBER") {
      openTransferSheet(selectedMemberIds, "MEMBER");
    } else {
      openTransferSheet(selectedIds, "DEPT");
    }
  };

  const isInvalidTransferTarget = (sourceIds: string[], targetId: string): boolean => {
    if (!targetId || sourceIds.includes(targetId)) return true;
    return sourceIds.some((id) => collectDescendantIds(id, deptList).has(targetId));
  };

  const handleConfirmTransfer = () => {
    if (!transferTargetId) {
      showToast(t("departments.toast.transferNoTarget"));
      return;
    }
    if (isInvalidTransferTarget(transferItemIds, transferTargetId)) {
      showToast(t("departments.toast.transferInvalidTarget"));
      return;
    }

    const targetName = deptList.find((d) => d.id === transferTargetId)?.name || transferTargetId;

    if (transferMode === "DEPT") {
      const updatedDepts = transferItemIds
        .map((id) => deptList.find((d) => d.id === id))
        .filter(Boolean) as Department[];
      const nextList = deptList.map((d) =>
        transferItemIds.includes(d.id) ? { ...d, parentId: transferTargetId } : d
      );
      setDeptList(nextList);
      updatedDepts.forEach((dept) => {
        onSaveDepartment({ ...dept, parentId: transferTargetId });
      });
      setSelectedIds([]);
    } else {
      if (!onSaveUser) {
        setIsTransferSheetOpen(false);
        return;
      }
      const targetDept = deptList.find((d) => d.id === transferTargetId);
      const scopeIds = scopedDeptIds || [];
      transferItemIds.forEach((userId) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        const newDeptIds = Array.from(
          new Set([
            ...(user.departmentIds || []).filter((id) => !scopeIds.includes(id)),
            transferTargetId,
          ])
        );
        const deptNames = newDeptIds
          .map((id) => deptList.find((d) => d.id === id)?.name)
          .filter(Boolean);
        const updated: SystemUser = {
          ...user,
          departmentIds: newDeptIds,
          department: deptNames.join(" / ") || targetDept?.name,
        };
        onSaveUser(updated);
      });
      setSelectedMemberIds([]);
    }

    setIsTransferSheetOpen(false);
    showToast(t("departments.toast.transferSuccess", { count: transferItemIds.length, target: targetName }));
  };

  const transferTargetOptions = useMemo(() => {
    const exclude = new Set(transferItemIds);
    transferItemIds.forEach((id) => {
      collectDescendantIds(id, deptList).forEach((descId) => exclude.add(descId));
    });
    return deptList
      .filter((d) => !exclude.has(d.id))
      .map((d) => ({ value: d.id, label: d.name }));
  }, [deptList, transferItemIds]);

  const handleRefresh = () => {
    setDeptList(departments);
    setSearchQuery("");
    setSelectedIds([]);
    setViewMode("DEPT");
    showToast(t("departments.toast.refreshed"));
  };

  // 继承角色提示：所选部门角色并集
  const inheritedRoleNames = useMemo(() => {
    const ids = formParentId === "ROOT" ? [] : [formParentId];
    const keys = deptList.filter((d) => ids.includes(d.id)).flatMap((d) => d.roleKeys || []);
    return Array.from(new Set(keys)).map(getRoleName);
  }, [formParentId, deptList]);

  // 部门节点右键菜单项（需求6）
  const deptNodeMenu = (node: DeptTreeNode) => [
    { key: "add", label: t("departments.menu.addChild"), onClick: () => handleOpenAdd(node.id) },
    {
      key: "rename", label: t("departments.menu.rename"), onClick: () => {
        const name = window.prompt(t("departments.menu.renamePrompt"), node.name);
        if (name && name.trim()) setDeptList((prev) => prev.map((d) => (d.id === node.id ? { ...d, name: name.trim() } : d)));
      },
    },
    {
      key: "del", label: t("departments.menu.delete"), danger: true, onClick: () => {
        if (!window.confirm(t("departments.deleteConfirm", { name: node.name }))) return;
        setDeptList((prev) => prev.filter((d) => d.id !== node.id));
        if (selectedDeptId === node.id) setSelectedDeptId("ALL");
        showToast(t("departments.toast.nodeDeleted", { name: node.name }));
      },
    },
    { key: "refresh", label: t("departments.menu.refresh"), onClick: handleRefresh },
  ];

  // 渲染部门树
  const renderTreeNode = (node: DeptTreeNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isActive = selectedDeptId === node.id;
    const isVisible = !treeKeyword || node.name.toLowerCase().includes(treeKeyword.toLowerCase()) || node.code.toLowerCase().includes(treeKeyword.toLowerCase());

    return (
      <div key={node.id} className={isVisible ? "" : "hidden"}>
        <ContextMenu
          items={deptNodeMenu(node)}
          trigger={(
          <div
          className={`relative flex items-center gap-1.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border ${
            isActive
              ? "bg-blue-50/90 text-fg font-semibold border-blue-200 shadow-sm"
              : "text-fg-secondary hover:bg-hover border-transparent"
          }`}
          style={{ paddingLeft: `${6 + node.level * 14}px` }}
          onClick={() => {
            setSelectedDeptId(node.id);
            setViewMode("DEPT");
            setSearchQuery("");
          }}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full" />
          )}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="shrink-0 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
            isActive ? "bg-blue-500" : "bg-subtle border border-line-subtle"
          }`}>
            <Building2 className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-fg-tertiary"}`} />
          </span>
          <span className="truncate flex-1">{node.name}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isActive ? "bg-blue-100 text-blue-700 font-bold" : "bg-hover text-fg-tertiary"
          }`}>
            {node.memberCount ?? 0}
          </span>
          </div>
          )}
        />
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">{node.children.map((c) => renderTreeNode(c))}</div>
        )}
      </div>
    );
  };

  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [searchQuery, reset]);

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-3 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 顶部操作栏（截图风格：扁平、无圆角 / 简洁） ===== */}
      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("departments.refreshTitle")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("common:actions.refresh")}
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("common:actions.add")}
          </button>

          {selectedIds.length === 0 ? (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("common:actions.delete")}
            </button>
          ) : (
            <Popconfirm
              title={t("departments.batchDeleteTitle", { count: selectedIds.length })}
              description={t("departments.batchDeleteDesc")}
              onConfirm={handleBatchDelete}
            >
              <button
                type="button"
                className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("common:actions.delete")}
              </button>
            </Popconfirm>
          )}

          {(viewMode === "DEPT" ? selectedIds.length : selectedMemberIds.length) === 0 ? (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 border border-emerald-200 text-emerald-600 rounded text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {t("common:actions.transfer")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBatchTransfer}
              className="px-3 py-1.5 border border-emerald-200 hover:bg-emerald-50 text-emerald-600 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {t("common:actions.transfer")}
            </button>
          )}

          <div className="w-px h-5 bg-hover mx-1" />

          <div className="flex items-center bg-hover p-0.5 rounded">
            <button
              type="button"
              onClick={() => setViewMode("DEPT")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === "DEPT" ? "bg-surface text-fg shadow-card" : "text-fg-secondary hover:text-fg"
              }`}
            >
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {t("departments.tabs.deptList")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("MEMBER")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                viewMode === "MEMBER" ? "bg-surface text-fg shadow-card" : "text-fg-secondary hover:text-fg"
              }`}
            >
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {t("departments.tabs.members")}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative w-56">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("departments.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            {t("common:actions.search")}
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-start">
      {/* ===== 左侧：类型 / 部门树 ===== */}
      <div className="w-52 shrink-0 bg-surface border border-line rounded-md shadow-card overflow-hidden lg:sticky lg:top-4">
        <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-fg-secondary" />
            {t("departments.orgStructure")}
          </span>
          <button
            type="button"
            onClick={() => setSelectedDeptId("ALL")}
            className="text-[10px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          >
            {t("departments.all")}
          </button>
        </div>

        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t("departments.treeSearchPlaceholder")}
              value={treeKeyword}
              onChange={(e) => setTreeKeyword(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="p-2 space-y-0.5">
          <div
            className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-all border ${
              selectedDeptId === "ALL" ? "bg-blue-50/90 text-fg font-semibold border-blue-200 shadow-sm" : "text-fg-secondary hover:bg-hover border-transparent"
            }`}
            onClick={() => {
              setSelectedDeptId("ALL");
              setViewMode("DEPT");
            }}
          >
            {selectedDeptId === "ALL" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r-full" />
            )}
            <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
              selectedDeptId === "ALL" ? "bg-blue-500" : "bg-subtle border border-line-subtle"
            }`}>
              <FolderTree className={`w-3.5 h-3.5 ${selectedDeptId === "ALL" ? "text-white" : "text-fg-tertiary"}`} />
            </span>
            <span className="truncate flex-1">{t("departments.allDepts")}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              selectedDeptId === "ALL" ? "bg-blue-100 text-blue-700 font-bold" : "bg-hover text-fg-tertiary"
            }`}>{deptList.length}</span>
          </div>
          {tree.map((node) => renderTreeNode(node))}
        </div>
      </div>

      {/* ===== 右侧：列表 / 成员 ===== */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 标题 */}
        <div className="flex items-center gap-2 text-sm font-bold text-fg px-1">
          <span>{viewMode === "DEPT" ? t("departments.viewTitle.dept") : t("departments.viewTitle.member")}</span>
          <span className="text-fg-tertiary font-normal text-xs">（{selectedDeptName}）</span>
        </div>

        {viewMode === "DEPT" ? (
          /* ===== 部门列表表格 ===== */
          <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && filteredDepts.every((d) => selectedIds.includes(d.id))}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredDepts.map((d) => d.id) : [])
                        }
                        className="rounded text-fg"
                      />
                    </th>
                    <th className="py-2 px-3">{t("departments.table.name")}</th>
                    <th className="py-2 px-3">{t("departments.table.code")}</th>
                    <th className="py-2 px-3">{t("departments.table.parent")}</th>
                    <th className="py-2 px-3">{t("departments.table.roles")}</th>
                    <th className="py-2 px-3 text-center">{t("departments.table.members")}</th>
                    <th className="py-2 px-3 text-center">{t("departments.table.sort")}</th>
                    <th className="py-2 px-3 text-right">{t("departments.table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-fg-secondary">
                  {filteredDepts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-fg-tertiary">
{t("departments.empty")}
                      </td>
                    </tr>
                  ) : (
                    paginate<Department>(filteredDepts, currentPage, pageSize).map((dept) => {
                      const parent = deptList.find((d) => d.id === dept.parentId);
                      const roleKeys = dept.roleKeys || [];
                      return (
                        <tr key={dept.id} className="hover:bg-subtle/80 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(dept.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, dept.id]
                                    : prev.filter((id) => id !== dept.id)
                                )
                              }
                              className="rounded text-fg"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded-md bg-hover text-fg-secondary">
                                <Building2 className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="font-semibold text-fg">{dept.name}</div>
                                {dept.leader && (
                                  <div className="text-[10px] text-fg-tertiary">{t("departments.leader", { name: dept.leader })}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-fg-secondary">{dept.code}</td>
                          <td className="py-2 px-3 text-fg-secondary">
                            {parent ? (
                              <span className="inline-flex items-center gap-1 text-[11px]">
                                <Building2 className="w-3 h-3 text-fg-tertiary" />
                                {parent.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-hover text-fg-tertiary border border-line rounded text-[10px]">
{t("departments.topLevel")}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {roleKeys.length === 0 ? (
                                <span className="text-[11px] text-fg-tertiary italic">{t("departments.noRoles")}</span>
                              ) : (
                                roleKeys.map((key) => (
                                  <span
                                    key={key}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeStyle(key)}`}
                                  >
                                    <Shield className="w-2.5 h-2.5" />
                                    {getRoleName(key).split(" ")[0]}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-fg-secondary">
                            {dept.memberCount ?? 0}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-fg-secondary">{dept.sortOrder ?? 1}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-3 text-[11px]">
                              <button
                                type="button"
                                onClick={() => openTransferSheet([dept.id], "DEPT")}
                                className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                              >
                                {t("departments.transfer.rowAction")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(dept)}
                                className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                              >
                                {t("common:actions.edit")}
                              </button>
                              <Popconfirm
                                title={t("departments.deleteTitle", { name: dept.name })}
                                description={t("departments.deleteDesc")}
                                onConfirm={() => handleDelete(dept.id, dept.name)}
                              >
                                <button
                                  type="button"
                                  className="text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                                >
                                  {t("common:actions.delete")}
                                </button>
                              </Popconfirm>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalItems={filteredDepts.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        ) : (
          /* ===== 部门成员视图 ===== */
          <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
            <div className="px-3 py-2 border-b border-line-subtle flex items-center justify-between">
              <span className="text-xs text-fg-secondary">
                <Eye className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
{t("departments.memberSummary", { name: selectedDeptName, count: scopeMembers.length })}
              </span>
              <span className="text-[11px] text-fg-tertiary">{t("departments.memberHint")}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={scopeMembers.length > 0 && scopeMembers.every((u) => selectedMemberIds.includes(u.id))}
                        onChange={(e) =>
                          setSelectedMemberIds(e.target.checked ? scopeMembers.map((u) => u.id) : [])
                        }
                        className="rounded text-fg"
                      />
                    </th>
                    <th className="py-2 px-3">{t("departments.memberTable.user")}</th>
                    <th className="py-2 px-3">{t("departments.memberTable.dept")}</th>
                    <th className="py-2 px-3">{t("departments.memberTable.roles")}</th>
                    <th className="py-2 px-3">{t("departments.memberTable.apps")}</th>
                    <th className="py-2 px-3">{t("departments.memberTable.status")}</th>
                    <th className="py-2 px-3 text-right">{t("departments.table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-fg-secondary">
                  {scopeMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-fg-tertiary">
{t("departments.noMembers")}
                      </td>
                    </tr>
                  ) : (
                    scopeMembers.map((u) => {
                      const roleKeys = u.roleKeys?.length ? u.roleKeys : u.roleKey ? [u.roleKey] : [];
                      const deptNames = (u.departmentIds || []).map(
                        (id) => deptList.find((d) => d.id === id)?.name
                      ).filter(Boolean);
                      return (
                        <tr key={u.id} className="hover:bg-subtle/80 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(u.id)}
                              onChange={(e) =>
                                setSelectedMemberIds((prev) =>
                                  e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                )
                              }
                              className="rounded text-fg"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-hover border border-line text-fg font-bold flex items-center justify-center text-[10px] shrink-0">
                                {u.avatarText || u.name[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-fg">{u.name}</div>
                                <div className="text-[10px] text-fg-tertiary flex items-center gap-1">
                                  <Mail className="w-2.5 h-2.5" />
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {deptNames.length === 0 ? (
                                <span className="text-fg-tertiary italic">{t("departments.unassigned")}</span>
                              ) : (
                                deptNames.map((name) => (
                                  <span key={name} className="px-1.5 py-0.5 bg-hover text-fg-secondary border border-line rounded text-[10px]">
                                    {name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {roleKeys.length === 0 ? (
                                <span className="text-fg-tertiary italic">{t("departments.unassignedRole")}</span>
                              ) : (
                                roleKeys.map((key) => (
                                  <span key={key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeStyle(key)}`}>
                                    <Shield className="w-2.5 h-2.5" />
                                    {getRoleName(key).split(" ")[0]}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-fg-secondary">
                            {(u.allowedAppIds || []).includes("ALL")
                              ? t("departments.allApps")
                              : t("departments.appCount", { count: (u.allowedAppIds || []).length })}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.status === "DISABLED" ? "bg-hover text-fg-secondary" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              {u.status === "DISABLED" ? t("departments.status.disabled") : t("departments.status.active")}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => openTransferSheet([u.id], "MEMBER")}
                              className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer text-[11px]"
                            >
                              {t("departments.transfer.rowAction")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ===== 转移 SideSheet ===== */}
      <SideSheet
        id="side-sheet-department-transfer"
        isOpen={isTransferSheetOpen}
        onClose={() => setIsTransferSheetOpen(false)}
        title={t("departments.transfer.title", {
          mode: transferMode === "DEPT" ? t("departments.transfer.modeDept") : t("departments.transfer.modeMember"),
        })}
        description={
          transferMode === "DEPT"
            ? t("departments.transfer.descriptionDept")
            : t("departments.transfer.descriptionMember")
        }
        icon={<ArrowRightLeft className="w-5 h-5 text-fg" />}
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsTransferSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirmTransfer}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("departments.transfer.confirm")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-fg-secondary">
            {t("departments.transfer.selectedCount", { count: transferItemIds.length })}
          </p>
          <div>
            <label className="block text-fg-secondary font-medium mb-1">
              {t("departments.transfer.targetLabel")}
            </label>
            <ShadcnSelect
              value={transferTargetId}
              onValueChange={setTransferTargetId}
              options={transferTargetOptions}
              placeholder={t("departments.transfer.targetPlaceholder")}
            />
          </div>
        </div>
      </SideSheet>

      {/* ===== 新增/编辑部门 SideSheet ===== */}
      <SideSheet
        id="side-sheet-department-edit"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={editingDept ? t("departments.sheet.editTitle", { name: editingDept.name }) : t("departments.sheet.createTitle")}
        description={t("departments.sheet.description")}
        icon={<Building2 className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {editingDept ? t("departments.sheet.saveEdit") : t("departments.sheet.saveCreate")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary font-medium mb-1">
{t("departments.sheet.nameLabel")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder={t("departments.sheet.namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-fg-secondary font-medium mb-1">{t("departments.sheet.codeLabel")}</label>
              <input
                type="text"
                placeholder={t("departments.sheet.codePlaceholder")}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary font-medium mb-1">{t("departments.sheet.parentLabel")}</label>
              <ShadcnSelect
                value={formParentId}
                onValueChange={setFormParentId}
                options={[
                  { value: "ROOT", label: t("departments.sheet.parentRoot") },
                  ...deptList
                    .filter((d) => d.id !== editingDept?.id)
                    .map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>

            <div>
              <label className="block text-fg-secondary font-medium mb-1">{t("departments.sheet.sortLabel")}</label>
              <input
                type="number"
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">{t("departments.sheet.leaderLabel")}</label>
            <input
              type="text"
              placeholder={t("departments.sheet.leaderPlaceholder")}
              value={formLeader}
              onChange={(e) => setFormLeader(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">{t("departments.sheet.descLabel")}</label>
            <textarea
              rows={2}
              placeholder={t("departments.sheet.descPlaceholder")}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-fg-secondary font-medium">
{t("departments.sheet.rolesLabel")}
              </label>
              <span className="text-[11px] text-fg-tertiary">{t("departments.sheet.rolesHint")}</span>
            </div>
            <MultiSelect
              value={formRoleKeys}
              onValueChange={setFormRoleKeys}
              placeholder={t("departments.sheet.rolesPlaceholder")}
              options={roles.map((r) => ({
                value: (r.key || r.id) as string,
                label: r.name,
              }))}
            />
          </div>

          {inheritedRoleNames.length > 0 && (
            <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-[11px] text-blue-800 flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
{t("departments.sheet.inheritHint")}
                <b>{inheritedRoleNames.join("、")}</b>
              </span>
            </div>
          )}
        </div>
      </SideSheet>
    </div>
  );
};
