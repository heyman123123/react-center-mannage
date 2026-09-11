import React from "react";
import { Skeleton } from "./Skeleton";

/**
 * 表格型视图骨架屏
 * 结构贴近真实表格卡片：标题+搜索区 → 列头 → N 行数据 → 分页占位
 */
export function TableSkeleton({ rows = 9, cols = 6 }: { rows?: number; cols?: number }) {
  // 各列骨架条宽度比例（按常见管理后台列设计）
  const colWidths = ["w-3/4", "w-2/3", "w-1/2", "w-1/2", "w-2/5", "w-3/5"];
  const colCount = Math.min(cols, colWidths.length);
  const widths = colWidths.slice(0, colCount);

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
      {/* 卡片标题 + 搜索/筛选区 */}
      <div className="p-5 pb-4 flex items-center justify-between gap-4 border-b border-line-subtle">
        <div className="space-y-2.5 min-w-0">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-52 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* 列头 */}
      <div
        className="grid gap-4 px-5 pt-4 pb-3 border-b border-line-subtle"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}
      >
        {widths.map((w, i) => (
          <Skeleton key={`h-${i}`} className={`h-3.5 ${w}`} />
        ))}
      </div>

      {/* 数据行 */}
      <div className="divide-y divide-line-subtle">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-4 px-5 py-3.5 items-center"
            style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}
          >
            {widths.map((w, i) => (
              <Skeleton
                key={`c-${i}`}
                className={`h-3.5 ${i === 0 ? (r % 3 === 0 ? "w-4/5" : "w-3/5") : w}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 分页占位 */}
      <div className="flex items-center justify-center gap-3 py-4 border-t border-line-subtle">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * 看板/统计卡片骨架屏（Dashboard 等）
 * 统计卡片区 + 图表区占位
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片 4 列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`s-${i}`} className="bg-surface rounded-2xl border border-line shadow-card p-5 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* 图表区 */}
      <div className="bg-surface rounded-2xl border border-line shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * 轻量内容区骨架屏（通用，铺满约 60vh）
 */
export function GenericSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
      <div className="p-5 pb-4 border-b border-line-subtle space-y-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-60" />
      </div>
      <div className="p-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={`g-${i}`} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
