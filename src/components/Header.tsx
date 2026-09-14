import React from "react";
import { useTranslation } from "react-i18next";
import { PanelLeft } from "lucide-react";
import { Tenant, SystemUser } from "../types/payment";

interface HeaderProps {
  currentTenant?: Tenant;
  currentUser?: SystemUser;
  isSimulating?: boolean;
  setIsSimulating?: (val: boolean) => void;
  onRefreshData?: () => void;
  currentViewTitle: string;
  currentPath?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentViewTitle,
  currentPath,
  onToggleSidebar,
}) => {
  const { t } = useTranslation("nav");

  return (
    <header
      id="main-top-header"
      className="h-14 px-4 border-b border-line/80 bg-surface flex items-center justify-between shrink-0 select-none"
    >
      {/* Left Breadcrumbs */}
      <div className="flex items-center gap-2">
        <button
          id="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={t("header.toggleSidebar")}
          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-md transition-colors cursor-pointer"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-hover" />
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <span className="text-fg-secondary hover:text-fg transition-colors cursor-pointer">
            {t("header.brand")}
          </span>
          <span className="text-fg-tertiary">/</span>
          <span className="font-semibold text-fg">{currentViewTitle}</span>
          {currentPath && (
            <span
              title={t("header.routePathTitle")}
              className="text-[11px] font-mono bg-hover/90 text-fg-secondary px-1.5 py-0.5 rounded border border-line"
            >
              {currentPath}
            </span>
          )}
        </div>
      </div>

      {/* Right side controls (环境切换与刷新按钮已移除) */}
      <div className="flex items-center gap-2" />
    </header>
  );
};
