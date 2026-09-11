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
            "flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg shadow-2xs transition-all cursor-pointer hover:border-line focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-line disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-line ring-2 ring-primary/10",
            triggerClassName
          )}
        >
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-fg-tertiary truncate">{placeholder}</span>
            ) : (
              <>
                {selectedOptions.slice(0, maxTags).map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded-md bg-hover border border-line px-1.5 py-0.5 text-[10px] font-medium text-fg-secondary"
                  >
                    <span className="truncate max-w-[140px]">{opt.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleValue(opt.value);
                      }}
                      className="text-fg-tertiary hover:text-fg-secondary cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {value.length > maxTags && (
                  <span className="text-[10px] text-fg-tertiary font-mono">
                    +{value.length - maxTags}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-fg-tertiary shrink-0 transition-transform",
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
            "z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[12rem] rounded-xl border border-line bg-surface text-fg shadow-2xl animate-in fade-in zoom-in-95 outline-none",
            contentClassName
          )}
        >
          {showToolbar && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-line-subtle">
              <span className="text-[11px] text-fg-tertiary font-medium flex items-center gap-1">
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
                  className="text-fg-secondary hover:text-fg font-medium cursor-pointer"
                >
                  全选
                </button>
                <span className="text-zinc-200">|</span>
                <button
                  type="button"
                  onClick={() => onValueChange([])}
                  className="text-fg-secondary hover:text-fg font-medium cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {normalizedOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-tertiary">
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
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-fg-secondary transition-colors cursor-pointer hover:bg-hover hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed",
                      isChecked && "bg-subtle text-fg font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-line bg-surface"
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
            className="absolute right-2 top-2 p-1 text-fg-tertiary hover:text-fg-secondary rounded transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
