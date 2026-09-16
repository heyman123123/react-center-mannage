import React from "react";
import { useTranslation } from "react-i18next";
import type { PaymentApp } from "../types/payment";
import { MultiSelect } from "./ui/MultiSelect";

export function AppScopeMultiSelect(props: {
  apps: PaymentApp[];
  value: string[];
  onChange: (ids: string[]) => void;
  allowAllToggle?: boolean;
  placeholder?: string;
  hint?: string;
}): React.ReactElement {
  const { apps, value, onChange, allowAllToggle, placeholder, hint } = props;
  const { t } = useTranslation("rbac");
  const isAll = value.includes("ALL");

  const specificIds = value.filter((id) => id !== "ALL");
  const displayValue = isAll ? apps.map((a) => a.id) : specificIds;

  return (
    <div className="space-y-2">
      {allowAllToggle && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAll}
            onChange={(e) => onChange(e.target.checked ? ["ALL"] : [])}
            className="rounded border-line text-fg"
          />
          <span className="text-xs text-fg-secondary">{t("appScopeSelect.allToggle")}</span>
        </label>
      )}
      <MultiSelect
        value={displayValue}
        onValueChange={onChange}
        placeholder={placeholder ?? t("appScopeSelect.placeholder")}
        options={apps.map((a) => ({
          value: a.id,
          label: `${a.name}（${a.code}）`,
        }))}
        showToolbar
        disabled={allowAllToggle && isAll}
      />
      {hint ? <p className="text-[11px] text-fg-tertiary">{hint}</p> : null}
    </div>
  );
}
