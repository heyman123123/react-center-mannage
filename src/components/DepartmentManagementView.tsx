import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Department, SystemUser, RbacRole } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";
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

export const DepartmentManagementView: React.FC<DepartmentManagementViewProps> = ({
  departments,
  users,
  roles,
  onSaveDepartment,
  onDeleteDepartment,
}) => {
  const [deptList, setDeptList] = useState<Department[]>(departments);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(departments.filter((d) => d.parentId == null).map((d) => d.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [treeKeyword, setTreeKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"DEPT" | "MEMBER">("DEPT");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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
    const r = roles.find((role) => (role.key || role.id) === key) || RBAC_ROLES[key as keyof typeof RBAC_ROLES];
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
    if (selectedDeptId === "ALL") return "全部部门";
    return deptList.find((d) => d.id === selectedDeptId)?.name || "全部部门";
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
      showToast("请填写部门名称");
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
      showToast(`部门【${updated.name}】已保存更新！`);
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
      showToast(`新部门【${newDept.name}】创建成功！`);
    }
    setIsSheetOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    const hasChild = deptList.some((d) => d.parentId === id);
    if (hasChild) {
      showToast(`部门【${name}】下存在子部门，请先删除子部门`);
      return;
    }
    setDeptList((prev) => prev.filter((d) => d.id !== id));
    if (onDeleteDepartment) onDeleteDepartment(id);
    showToast(`部门【${name}】已删除`);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const canDelete = selectedIds.every((id) => !deptList.some((d) => d.parentId === id));
    if (!canDelete) {
      showToast("存在包含子部门的项，请先处理子部门");
      return;
    }
    setDeptList((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
    if (onDeleteDepartment) selectedIds.forEach((id) => onDeleteDepartment(id));
    setSelectedIds([]);
    showToast(`已删除 ${selectedIds.length} 个部门`);
  };

  const handleRefresh = () => {
    setDeptList(departments);
    setSearchQuery("");
    setSelectedIds([]);
    setViewMode("DEPT");
    showToast("部门数据已刷新");
  };

  // 继承角色提示：所选部门角色并集
  const inheritedRoleNames = useMemo(() => {
    const ids = formParentId === "ROOT" ? [] : [formParentId];
    const keys = deptList.filter((d) => ids.includes(d.id)).flatMap((d) => d.roleKeys || []);
    return Array.from(new Set(keys)).map(getRoleName);
  }, [formParentId, deptList]);

  // 部门节点右键菜单项（需求6）
  const deptNodeMenu = (node: DeptTreeNode) => [
    { key: "add", label: "新增子部门", onClick: () => handleOpenAdd(node.id) },
    {
      key: "rename", label: "重命名", onClick: () => {
        const name = window.prompt("部门名称：", node.name);
        if (name && name.trim()) setDeptList((prev) => prev.map((d) => (d.id === node.id ? { ...d, name: name.trim() } : d)));
      },
    },
    {
      key: "del", label: "删除", danger: true, onClick: () => {
        if (!window.confirm(`确认删除部门【${node.name}】及其下级？`)) return;
        setDeptList((prev) => prev.filter((d) => d.id !== node.id));
        if (selectedDeptId === node.id) setSelectedDeptId("ALL");
        showToast(`已删除部门【${node.name}】`);
      },
    },
    { key: "refresh", label: "刷新列表", onClick: handleRefresh },
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
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
            isActive ? "bg-primary text-primary-foreground font-semibold" : "text-fg-secondary hover:bg-hover"
          }`}
          style={{ paddingLeft: `${10 + node.level * 14}px` }}
          onClick={() => {
            setSelectedDeptId(node.id);
            setViewMode("DEPT");
            setSearchQuery("");
          }}
        >
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
          <Building2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-300" : "text-fg-tertiary"}`} />
          <span className="truncate flex-1">{node.name}</span>
          <span className={`text-[10px] font-mono ${isActive ? "text-fg-tertiary" : "text-fg-tertiary"}`}>
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
    <div className="flex gap-3 items-start font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===== 左侧：类型 / 部门树 ===== */}
      <div className="w-52 shrink-0 bg-surface border border-line rounded-xl shadow-card overflow-hidden lg:sticky lg:top-4">
        <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
          <span className="text-xs font-bold text-fg flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-fg-secondary" />
            组织架构
          </span>
          <button
            type="button"
            onClick={() => setSelectedDeptId("ALL")}
            className="text-[10px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
          >
            全部
          </button>
        </div>

        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="w-3 h-3 text-fg-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索部门名称..."
              value={treeKeyword}
              onChange={(e) => setTreeKeyword(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="p-2 space-y-0.5">
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
              selectedDeptId === "ALL" ? "bg-primary text-primary-foreground font-semibold" : "text-fg-secondary hover:bg-hover"
            }`}
            onClick={() => {
              setSelectedDeptId("ALL");
              setViewMode("DEPT");
            }}
          >
            <FolderTree className="w-3.5 h-3.5 text-fg-tertiary" />
            <span className="truncate flex-1">全部部门</span>
            <span className="text-[10px] font-mono text-fg-tertiary">{deptList.length}</span>
          </div>
          {tree.map((node) => renderTreeNode(node))}
        </div>
      </div>

      {/* ===== 右侧：列表 / 成员 ===== */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* 标题与工具栏 */}
        <div className="bg-surface border border-line rounded-xl shadow-card px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-fg">
            <span>{viewMode === "DEPT" ? "部门列表" : "部门成员"}</span>
            <span className="text-fg-tertiary font-normal text-xs">（{selectedDeptName}）</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="刷新部门数据"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>

            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增
            </button>

            {selectedIds.length === 0 ? (
              <button
                type="button"
                disabled
                className="px-2.5 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            ) : (
              <Popconfirm
                title={`删除选中的 ${selectedIds.length} 个部门？`}
                description="删除后这些部门及其成员关联关系将一并解除，且无法恢复。"
                onConfirm={handleBatchDelete}
              >
                <button
                  type="button"
                  className="px-2.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </Popconfirm>
            )}

            <div className="w-px h-5 bg-hover mx-1" />

            <div className="flex items-center bg-hover p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode("DEPT")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "DEPT" ? "bg-surface text-fg shadow-card" : "text-fg-secondary hover:text-fg"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> 部门列表
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("MEMBER")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  viewMode === "MEMBER" ? "bg-surface text-fg shadow-card" : "text-fg-secondary hover:text-fg"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> 查看成员
                </span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === "DEPT" ? (
          /* ===== 部门列表表格 ===== */
          <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-line-subtle">
              <span className="text-xs text-fg-secondary">
                共 <b className="text-fg font-mono">{filteredDepts.length}</b> 个部门
              </span>
              <div className="relative w-56">
                <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索名称"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && filteredDepts.every((d) => selectedIds.includes(d.id))}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredDepts.map((d) => d.id) : [])
                        }
                        className="rounded text-fg"
                      />
                    </th>
                    <th className="py-2.5 px-3">部门名称</th>
                    <th className="py-2.5 px-3">编码</th>
                    <th className="py-2.5 px-3">上级部门</th>
                    <th className="py-2.5 px-3">绑定角色（多选）</th>
                    <th className="py-2.5 px-3 text-center">成员数</th>
                    <th className="py-2.5 px-3 text-center">排序</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-fg-secondary">
                  {filteredDepts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-fg-tertiary">
                        暂无部门数据
                      </td>
                    </tr>
                  ) : (
                    paginate<Department>(filteredDepts, currentPage, pageSize).map((dept) => {
                      const parent = deptList.find((d) => d.id === dept.parentId);
                      const roleKeys = dept.roleKeys || [];
                      return (
                        <tr key={dept.id} className="hover:bg-subtle/80 transition-colors">
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded-md bg-hover text-fg-secondary">
                                <Building2 className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="font-semibold text-fg">{dept.name}</div>
                                {dept.leader && (
                                  <div className="text-[10px] text-fg-tertiary">负责人：{dept.leader}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-fg-secondary">{dept.code}</td>
                          <td className="py-2.5 px-3 text-fg-secondary">{parent ? parent.name : "—（顶级部门）"}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {roleKeys.length === 0 ? (
                                <span className="text-[11px] text-fg-tertiary italic">未绑定角色</span>
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
                          <td className="py-2.5 px-3 text-center font-mono text-fg-secondary">
                            {dept.memberCount ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-fg-secondary">{dept.sortOrder ?? 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenAdd(dept.id)}
                                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-[11px] font-medium cursor-pointer"
                                title="新增子部门"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(dept)}
                                className="px-2 py-1 text-fg-secondary hover:bg-hover rounded-md text-[11px] font-medium cursor-pointer"
                                title="编辑部门"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <Popconfirm
                                title={`删除部门「${dept.name}」？`}
                                description="删除后该部门及其成员关联关系将一并解除，且无法恢复。"
                                onConfirm={() => handleDelete(dept.id, dept.name)}
                              >
                                <button
                                  type="button"
                                  className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-md text-[11px] font-medium cursor-pointer"
                                  title="删除部门"
                                >
                                  <Trash2 className="w-3 h-3" />
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
          <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
            <div className="px-3 py-2 border-b border-line-subtle flex items-center justify-between">
              <span className="text-xs text-fg-secondary">
                <Eye className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                部门「{selectedDeptName}」及其子部门共 <b className="text-fg font-mono">{scopeMembers.length}</b> 名成员
              </span>
              <span className="text-[11px] text-fg-tertiary">成员角色继承自部门绑定角色与个人角色</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                    <th className="py-2.5 px-3">用户</th>
                    <th className="py-2.5 px-3">所属部门</th>
                    <th className="py-2.5 px-3">角色权限（多选）</th>
                    <th className="py-2.5 px-3">应用授权范围</th>
                    <th className="py-2.5 px-3">账号状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-fg-secondary">
                  {scopeMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-fg-tertiary">
                        该部门暂无成员
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
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {deptNames.length === 0 ? (
                                <span className="text-fg-tertiary italic">未分配</span>
                              ) : (
                                deptNames.map((name) => (
                                  <span key={name} className="px-1.5 py-0.5 bg-hover text-fg-secondary border border-line rounded text-[10px]">
                                    {name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {roleKeys.length === 0 ? (
                                <span className="text-fg-tertiary italic">未分配角色</span>
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
                          <td className="py-2.5 px-3 text-[11px] text-fg-secondary">
                            {(u.allowedAppIds || []).includes("ALL")
                              ? "全部应用"
                              : `${(u.allowedAppIds || []).length} 款应用`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.status === "DISABLED" ? "bg-hover text-fg-secondary" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              {u.status === "DISABLED" ? "已停用" : "正常在职"}
                            </span>
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

      {/* ===== 新增/编辑部门 SideSheet ===== */}
      <SideSheet
        id="side-sheet-department-edit"
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={editingDept ? `编辑部门: ${editingDept.name}` : "新增部门"}
        description="配置部门基本信息并绑定角色（多选）；部门成员将继承该部门绑定角色的权限。"
        icon={<Building2 className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
            >
              {editingDept ? "保存部门" : "创建部门"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary font-medium mb-1">
                部门名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例如: 出海运营中心"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-fg-secondary font-medium mb-1">部门编码</label>
              <input
                type="text"
                placeholder="例如: OPS-NA"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-fg-secondary font-medium mb-1">上级部门</label>
              <ShadcnSelect
                value={formParentId}
                onValueChange={setFormParentId}
                options={[
                  { value: "ROOT", label: "作为顶级部门（无上级）" },
                  ...deptList
                    .filter((d) => d.id !== editingDept?.id)
                    .map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>

            <div>
              <label className="block text-fg-secondary font-medium mb-1">排序权重</label>
              <input
                type="number"
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">负责人</label>
            <input
              type="text"
              placeholder="部门负责人姓名"
              value={formLeader}
              onChange={(e) => setFormLeader(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-fg-secondary font-medium mb-1">部门描述</label>
            <textarea
              rows={2}
              placeholder="部门职责说明"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-fg-secondary font-medium">
                绑定角色（多选）
              </label>
              <span className="text-[11px] text-fg-tertiary">部门成员将继承所选角色的权限</span>
            </div>
            <MultiSelect
              value={formRoleKeys}
              onValueChange={setFormRoleKeys}
              placeholder="选择该部门绑定的角色..."
              options={roles.map((r) => ({
                value: (r.key || r.id) as string,
                label: r.name,
              }))}
            />
          </div>

          {inheritedRoleNames.length > 0 && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                该部门将继承上级部门绑定角色：
                <b>{inheritedRoleNames.join("、")}</b>
              </span>
            </div>
          )}
        </div>
      </SideSheet>
    </div>
  );
};
