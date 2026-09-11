import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: React.ReactNode;
  searchText?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value?: string;
  onValueChange: (val: string) => void;
  options: (SearchableSelectOption | string)[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** 无匹配结果时的提示 */
  emptyText?: string;
}

/**
 * 可搜索下拉选择（基于 Radix Popover + 输入过滤）
 * 用于选项较多（如邮件模板、应用列表）时支持键入查找。
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "请选择...",
  searchPlaceholder = "输入关键字查找...",
  className,
  triggerClassName,
  contentClassName,
  disabled,
  emptyText = "未找到匹配项",
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const normalizedOptions: SearchableSelectOption[] = options.map((opt) =>
    typeof opt === "string"
      ? { value: opt, label: opt }
      : {
          ...opt,
          searchText: opt.searchText || (typeof opt.label === "string" ? opt.label : ""),
        }
  );

  const selected = normalizedOptions.find((o) => o.value === value);

  const filtered = normalizedOptions.filter((o) => {
    if (!keyword.trim()) return true;
    const kw = keyword.toLowerCase();
    const hay = `${o.value} ${typeof o.label === "string" ? o.label : ""} ${o.searchText || ""}`.toLowerCase();
    return hay.includes(kw);
  });

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setKeyword("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setKeyword("");
      }}
    >
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
          <span className="truncate text-left">
            {selected ? (
              <span className="text-zinc-900">{selected.label}</span>
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[14rem] rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-2xl animate-in fade-in zoom-in-95 outline-none",
            contentClassName
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-zinc-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder={searchPlaceholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white placeholder:text-zinc-400"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const isChecked = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 transition-colors cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed",
                      isChecked && "bg-zinc-50 text-zinc-900 font-medium"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isChecked && <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
