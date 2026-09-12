import React from "react";
import {
  PanelLeft,
  RefreshCw,
  FlaskConical,
  Rocket,
} from "lucide-react";
import { Tenant, SystemUser, AppEnvironment } from "../types/payment";
import { Popconfirm } from "./ui/Popconfirm";

interface HeaderProps {
  currentTenant?: Tenant;
  currentUser?: SystemUser;
  isSimulating?: boolean;
  setIsSimulating?: (val: boolean) => void;
  onRefreshData: () => void;
  currentViewTitle: string;
  currentPath?: string;
  onToggleSidebar?: () => void;
  /** P2: 当前业务环境 */
  currentEnv?: AppEnvironment;
  /** P2: 切换环境回调 */
  onEnvChange?: (env: AppEnvironment) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRefreshData,
  currentViewTitle,
  currentPath,
  onToggleSidebar,
  currentEnv = "live",
  onEnvChange,
}) => {
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
          title="折叠/展开导航"
          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-md transition-colors cursor-pointer"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-hover" />
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <span className="text-fg-secondary hover:text-fg transition-colors cursor-pointer">
            聚合支付中台
          </span>
          <span className="text-fg-tertiary">/</span>
          <span className="font-semibold text-fg">{currentViewTitle}</span>
          {currentPath && (
            <span
              title="当前路由物理路径"
              className="text-[11px] font-mono bg-hover/90 text-fg-secondary px-1.5 py-0.5 rounded border border-line"
            >
              {currentPath}
            </span>
          )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* P2: 环境切换器 */}
        {onEnvChange && (
          <div className="flex items-center gap-1 p-0.5 bg-hover rounded-lg border border-line/60">
            {/* 当前环境徽章（常显） */}
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border ${
                currentEnv === "sandbox"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {currentEnv === "sandbox" ? <FlaskConical className="w-3 h-3" /> : <Rocket className="w-3 h-3" />}
              {currentEnv === "sandbox" ? "Sandbox" : "Live"}
            </span>

            {/* 切换按钮 */}
            {(["sandbox", "live"] as AppEnvironment[]).map((env) => {
              if (env === currentEnv) return null;
              const isSandbox = env === "sandbox";
              return (
                <Popconfirm
                  key={env}
                  title={isSandbox ? "切换到 Sandbox 环境？" : "切换到 Live 生产环境？"}
                  description={
                    isSandbox
                      ? "将展示沙箱测试数据，不影响真实交易。"
                      : "即将切换到生产环境，所有数据为真实业务数据，请谨慎操作。"
                  }
                  confirmText="确认切换"
                  onConfirm={() => onEnvChange(env)}
                >
                  <button
                    type="button"
                    title={isSandbox ? "切换到 Sandbox" : "切换到 Live"}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      isSandbox
                        ? "text-amber-600 hover:bg-amber-50"
                        : "text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {isSandbox ? <FlaskConical className="w-3 h-3" /> : <Rocket className="w-3 h-3" />}
                    <span className="hidden md:inline">{isSandbox ? "Sandbox" : "Live"}</span>
                  </button>
                </Popconfirm>
              );
            })}
          </div>
        )}

        {/* Manual Refresh */}
        <button
          id="manual-refresh-btn"
          onClick={onRefreshData}
          title="刷新数据"
          className="p-1.5 text-fg-secondary hover:text-fg hover:bg-hover rounded-md transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
