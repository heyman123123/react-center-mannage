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
            "flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg shadow-2xs transition-all cursor-pointer hover:border-line focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-line disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-line ring-2 ring-primary/10",
            triggerClassName
          )}
        >
          <span className="truncate text-left">
            {selected ? (
              <span className="text-fg">{selected.label}</span>
            ) : (
              <span className="text-fg-tertiary">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-fg-tertiary shrink-0 transition-transform",
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
            "z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[14rem] rounded-xl border border-line bg-surface text-fg shadow-2xl animate-in fade-in zoom-in-95 outline-none",
            contentClassName
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-line-subtle">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder={searchPlaceholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface placeholder:text-fg-tertiary"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg-secondary cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-tertiary">
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
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-fg-secondary transition-colors cursor-pointer hover:bg-hover hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed",
                      isChecked && "bg-subtle text-fg font-medium"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isChecked && <Check className="w-3.5 h-3.5 text-fg shrink-0" />}
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
