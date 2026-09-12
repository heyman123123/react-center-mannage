import React, { useMemo } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { SystemMenuItem } from "../types/payment";
import { renderMenuIcon } from "./ui/iconRegistry";

interface MenuPermissionTreeProps {
  menus: SystemMenuItem[];
  checkedIds: string[];
  onChange: (ids: string[]) => void;
}

interface TreeNode extends SystemMenuItem {
  children: TreeNode[];
}

function buildTree(menus: SystemMenuItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  menus.forEach((m) => map.set(m.id, { ...m, children: [] }));
  const roots: TreeNode[] = [];
  menus.forEach((m) => {
    const node = map.get(m.id)!;
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** 收集节点及其所有后代 id */
function collectSubtreeIds(node: TreeNode): string[] {
  return [node.id, ...node.children.flatMap((c) => collectSubtreeIds(c))];
}

/**
 * 基于菜单树的权限勾选树：父子联动（父节点选中则全部子节点选中；子节点部分选中时父节点为半选态）
 */
export const MenuPermissionTree: React.FC<MenuPermissionTreeProps> = ({
  menus,
  checkedIds,
  onChange,
}) => {
  const tree = useMemo(() => buildTree(menus), [menus]);
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const toggleNode = (node: TreeNode, checked: boolean) => {
    const subtreeIds = collectSubtreeIds(node);
    const next = new Set(checkedSet);
    subtreeIds.forEach((id) => {
      if (checked) next.add(id);
      else next.delete(id);
    });
    onChange(Array.from(next));
  };

  const renderNode = (node: TreeNode, level: number) => {
    const hasChildren = node.children.length > 0;
    const subtreeIds = collectSubtreeIds(node);
    const checkedCount = subtreeIds.filter((id) => checkedSet.has(id)).length;
    const isChecked = checkedCount === subtreeIds.length && subtreeIds.length > 0;
    const isIndeterminate = checkedCount > 0 && checkedCount < subtreeIds.length;

    return (
      <div key={node.id} className="select-none">
        <div
          className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-subtle transition-colors cursor-pointer"
          style={{ paddingLeft: `${8 + level * 22}px` }}
          onClick={() => toggleNode(node, !isChecked)}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              isChecked
                ? "bg-blue-500 border-blue-500 text-white"
                : isIndeterminate
                ? "bg-blue-500 border-blue-500 text-white"
                : "border-line bg-surface"
            }`}
          >
            {isChecked ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : isIndeterminate ? (
              <span className="w-1.5 h-1.5 bg-surface rounded-sm" />
            ) : null}
          </span>

          {renderMenuIcon(node.icon, "w-4 h-4 text-fg-secondary shrink-0")}

          <span className={`text-xs ${isChecked ? "font-semibold text-fg" : "text-fg-secondary"}`}>
            {node.title}
          </span>

          {hasChildren && (
            <span className="text-[10px] text-fg-tertiary font-mono ml-auto shrink-0">
              {checkedCount}/{subtreeIds.length}
            </span>
          )}
          {!hasChildren && node.path && (
            <span className="text-[10px] font-mono text-fg-tertiary ml-auto shrink-0 truncate max-w-[140px]">
              {node.path}
            </span>
          )}

          {hasChildren && (
            <ChevronDown className="w-3 h-3 text-zinc-300 shrink-0" />
          )}
        </div>

        {hasChildren && (
          <div className="space-y-0.5">{node.children.map((c) => renderNode(c, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-line rounded-xl bg-surface divide-y divide-line-subtle max-h-96 overflow-y-auto p-1">
      {tree.length === 0 && (
        <div className="py-8 text-center text-xs text-fg-tertiary">暂无菜单数据，请先在菜单管理中创建菜单</div>
      )}
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
};
