import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PopconfirmProps {
  /** 确认标题 */
  title: string;
  /** 补充说明 */
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  children: React.ReactNode;
  /** 确认按钮样式（默认红色系） */
  okClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Popconfirm 二次确认气泡（基于 Radix Popover，Portal 渲染不受裁剪）
 * 用于删除 / 停用等危险操作的二次确认。
 */
export const Popconfirm: React.FC<PopconfirmProps> = ({
  title,
  description,
  confirmText = "确认删除",
  cancelText = "取消",
  onConfirm,
  children,
  okClassName,
  align = "end",
  side = "top",
}) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          sideOffset={8}
          className="z-[9999] w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 outline-none"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-900 leading-snug">
                {title}
              </div>
              {description && (
                <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {description}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer",
                okClassName
              )}
            >
              {confirmText}
            </button>
          </div>

          <Popover.Close
            className="absolute right-2 top-2 p-0.5 text-zinc-300 hover:text-zinc-600 rounded transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-3 h-3" />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
