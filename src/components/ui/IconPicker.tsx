import React, { useState } from "react";
import { Check, Search } from "lucide-react";
import { ICON_OPTIONS, MENU_ICON_REGISTRY } from "./iconRegistry";
import { cn } from "../../lib/utils";

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  label?: string;
}

/**
 * 图标选择器：以网格卡片方式选择菜单节点图标（替代下拉框）
 */
export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, label = "菜单节点图标" }) => {
  const [keyword, setKeyword] = useState("");

  const filtered = keyword.trim()
    ? ICON_OPTIONS.filter(
        (opt) =>
          opt.name.toLowerCase().includes(keyword.toLowerCase()) ||
          opt.label.includes(keyword.trim())
      )
    : ICON_OPTIONS;

  const currentIcon = MENU_ICON_REGISTRY[value];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-fg-secondary font-medium text-xs">{label}</label>
        {currentIcon && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-secondary bg-subtle border border-line rounded-lg px-2 py-0.5">
            {React.createElement(currentIcon, { className: "w-3.5 h-3.5 text-fg-secondary" })}
            <span className="font-mono">{value}</span>
          </span>
        )}
      </div>

      {/* 图标搜索 */}
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="搜索图标名称 / 语义..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-subtle border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface"
        />
      </div>

      {/* 图标网格 */}
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 bg-subtle/70 border border-line rounded-xl">
        {filtered.map((opt) => {
          const Icon = MENU_ICON_REGISTRY[opt.name];
          const isSelected = value === opt.name;
          if (!Icon) return null;
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => onChange(opt.name)}
              title={`${opt.label} (${opt.name})`}
              className={cn(
                "relative aspect-square w-full flex items-center justify-center rounded-lg border transition-all cursor-pointer",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-card"
                  : "bg-surface text-fg-secondary border-line hover:border-line hover:text-fg hover:bg-surface"
              )}
            >
              <Icon className="w-4 h-4" />
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-4 text-center text-[11px] text-fg-tertiary">
            未找到匹配图标
          </div>
        )}
      </div>
    </div>
  );
};
