import React from "react";
import {
  PanelLeft,
  Radio,
  RefreshCw,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Tenant, SystemUser } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";

interface HeaderProps {
  currentTenant?: Tenant;
  currentUser?: SystemUser;
  isSimulating?: boolean;
  setIsSimulating?: (val: boolean) => void;
  onRefreshData: () => void;
  currentViewTitle: string;
  currentPath?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onRefreshData,
  currentViewTitle,
  currentPath,
}) => {
  return (
    <header
      id="main-top-header"
      className="h-14 px-6 border-b border-zinc-200/80 bg-white flex items-center justify-between shrink-0 select-none"
    >
      {/* Left Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          id="sidebar-toggle-btn"
          title="折叠/展开导航"
          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-zinc-200" />
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <span className="text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer">
            聚合支付中台
          </span>
          <span className="text-zinc-400">/</span>
          <span className="font-semibold text-zinc-950">{currentViewTitle}</span>
          {currentPath && (
            <span
              title="当前路由物理路径"
              className="text-[11px] font-mono bg-zinc-100/90 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200"
            >
              {currentPath}
            </span>
          )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Manual Refresh */}
        <button
          id="manual-refresh-btn"
          onClick={onRefreshData}
          title="刷新数据"
          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
