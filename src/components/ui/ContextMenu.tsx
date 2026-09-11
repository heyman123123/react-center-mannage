import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  /** 触发元素（必须是可聚焦/可交互元素） */
  trigger: React.ReactElement;
  className?: string;
}

/**
 * 简易右键菜单（ContextMenu）
 * 右键触发元素时在鼠标位置弹出菜单，点击外部 / Escape 关闭。
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  trigger,
  className,
}) => {
  const [state, setState] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setState(null);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onBlur = () => close();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [state]);

  const triggerWithHandler = React.cloneElement(trigger, {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const menuW = 168;
      const menuH = items.length * 36 + 12;
      const x = Math.min(e.clientX, viewportW - menuW - 8);
      const y = Math.min(e.clientY, viewportH - menuH - 8);
      setState({ x: Math.max(8, x), y: Math.max(8, y) });
      if (trigger.props.onContextMenu) trigger.props.onContextMenu(e);
    },
  });

  return (
    <>
      {triggerWithHandler}
      {state && (
        <div
          ref={menuRef}
          style={{ left: state.x, top: state.y }}
          className={cn(
            "fixed z-[9999] w-40 rounded-xl border border-line bg-surface p-1 shadow-2xl animate-in fade-in zoom-in-95",
            className
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-fg-secondary transition-colors cursor-pointer hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed",
                item.danger && "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
