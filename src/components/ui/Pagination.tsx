import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShadcnSelect } from "./select";
import { cn } from "../../lib/utils";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

type PageItem = number | "ellipsis";

/** 页码窗口：首尾始终保留，当前页附近展开，中间用省略号 */
function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: PageItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("ellipsis");
    out.push(sorted[i]);
  }
  return out;
}

const navBtn =
  "inline-flex items-center justify-center gap-1 h-7 min-w-7 px-2 rounded-lg text-xs font-medium border border-line text-fg-secondary bg-surface hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * 统一表格分页器：每页数量 + 记录数 + 上一页 / 可点页码 / 下一页
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationProps) {
  const { t } = useTranslation("common");
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const items = pageItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line-subtle">
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary whitespace-nowrap">
            <span>{t("pagination.pageSizeLabel")}</span>
            <ShadcnSelect
              value={String(pageSize)}
              onValueChange={(val) => {
                const next = Number(val) || DEFAULT_PAGE_SIZES[0];
                onPageSizeChange(next);
                onPageChange(1);
              }}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
              triggerClassName="h-7 w-[72px] px-2 text-xs"
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
            <span>{t("pagination.pageSizeSuffix")}</span>
          </label>
        ) : null}
        <div className="text-xs text-fg-secondary whitespace-nowrap">
          {t("pagination.pageInfo", { current: page, totalPages, totalItems })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={navBtn}
          aria-label={t("pagination.prev")}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("pagination.prev")}</span>
        </button>
        {items.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-fg-tertiary select-none" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => item !== page && onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={t("pagination.page", { page: item })}
              className={cn(
                "inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-lg text-xs font-medium border transition-colors",
                item === page
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-line text-fg-secondary bg-surface hover:bg-hover"
              )}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={navBtn}
          aria-label={t("pagination.next")}
        >
          <span className="hidden sm:inline">{t("pagination.next")}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** 分页工具：对数组按当前页切片 */
export function paginate<T>(list: T[], currentPage: number, pageSize: number): T[] {
  return list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
}

/** 通用分页 state hook：数据/筛选变化时重置到第 1 页 */
export function usePagination(pageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [size, setPageSize] = React.useState(pageSize);
  const reset = React.useCallback(() => setCurrentPage(1), []);
  const changePageSize = React.useCallback((next: number) => setPageSize(next), []);
  return {
    currentPage,
    setCurrentPage,
    reset,
    pageSize: size,
    setPageSize: changePageSize,
  };
}

export { Pagination as default, cn as _cn };
