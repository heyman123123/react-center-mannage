import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

/** 单选 + 面板内模糊搜索（Portal，避免 SideSheet 裁剪） */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  triggerClassName,
  disabled,
}) => {
  const { t } = useTranslation("shell");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const resolvedPlaceholder = placeholder ?? t("multiSelect.placeholder");
  const resolvedSearch = searchPlaceholder ?? t("multiSelect.searchPlaceholder");
  const resolvedEmpty = emptyText ?? t("multiSelect.empty");

  const selected = options.find((o) => o.value === value);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          (o.description || "").toLowerCase().includes(q)
      )
    : options;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg shadow-2xs transition-all cursor-pointer hover:border-line focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-line ring-2 ring-primary/10",
            triggerClassName,
            className
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-fg-tertiary")}>
            {selected ? selected.label : resolvedPlaceholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-fg-tertiary shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95"
        >
          <div className="px-1 pb-1.5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={resolvedSearch}
              className="w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-xs text-fg outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-tertiary">{resolvedEmpty}</div>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-hover disabled:opacity-40",
                      active ? "bg-subtle text-fg font-medium" : "text-fg-secondary"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        active ? "bg-primary border-primary text-primary-foreground" : "border-line bg-surface"
                      )}
                    >
                      {active && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description ? (
                        <span className="block truncate text-[10px] text-fg-tertiary mt-0.5">
                          {opt.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <Popover.Close
            className="absolute right-2 top-2 p-1 text-fg-tertiary hover:text-fg-secondary rounded cursor-pointer"
            aria-label={t("sideSheet.close")}
          >
            <X className="w-3.5 h-3.5" />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
