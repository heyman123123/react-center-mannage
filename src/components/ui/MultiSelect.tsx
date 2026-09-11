import React, { useState } from "react";
import { Check, ChevronDown, X, ListFilter } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../lib/utils";

export interface MultiSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface MultiSelectProps {
  value: string[];
  onValueChange: (vals: string[]) => void;
  options: (MultiSelectOption | string)[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** 是否显示「全选 / 清空」工具条 */
  showToolbar?: boolean;
  maxTags?: number;
}

/**
 * Shadcn 风格多选下拉（Radix Popover + Checkbox 实现）
 * 面板经 Radix Portal 渲染到 body，不受 SideSheet/Modal overflow 裁剪；
 * 点击外部自动关闭，支持全选/清空，已选项以 Tag 形式展示。
 */
export const MultiSelect: React.FC<MultiSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "请选择（可多选）...",
  className,
  triggerClassName,
  contentClassName,
  disabled,
  showToolbar = true,
  maxTags = 3,
}) => {
  const [open, setOpen] = useState(false);

  const normalizedOptions: MultiSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOptions = normalizedOptions.filter((o) => value.includes(o.value));

  const toggleValue = (val: string) => {
    onValueChange((prev: string[]) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Trigger */}
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-2xs transition-all cursor-pointer hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-zinc-400 ring-2 ring-zinc-950/10",
            triggerClassName
          )}
        >
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-zinc-400 truncate">{placeholder}</span>
            ) : (
              <>
                {selectedOptions.slice(0, maxTags).map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700"
                  >
                    <span className="truncate max-w-[140px]">{opt.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleValue(opt.value);
                      }}
                      className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {value.length > maxTags && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    +{value.length - maxTags}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </Popover.Trigger>

      {/* Dropdown Panel (Radix Portal -> body) */}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[12rem] rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-2xl animate-in fade-in zoom-in-95 outline-none",
            contentClassName
          )}
        >
          {showToolbar && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100">
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                <ListFilter className="w-3 h-3" />
                已选 {value.length} 项
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    onValueChange((prev: string[]) => [
                      ...new Set([...prev, ...normalizedOptions.map((o) => o.value)]),
                    ])
                  }
                  className="text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                >
                  全选
                </button>
                <span className="text-zinc-200">|</span>
                <button
                  type="button"
                  onClick={() => onValueChange([])}
                  className="text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {normalizedOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                暂无可选项
              </div>
            ) : (
              normalizedOptions.map((opt) => {
                const isChecked = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => toggleValue(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 transition-colors cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed",
                      isChecked && "bg-zinc-50 text-zinc-900 font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-zinc-900 border-zinc-900 text-white"
                          : "border-zinc-300 bg-white"
                      )}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>

          <Popover.Close
            className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
