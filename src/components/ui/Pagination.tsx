import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * 统一表格分页器：底部居中「第 X 页，共 Y 页（共 N 条记录）」+ 上一页/下一页
 */
export function Pagination({ currentPage, totalItems, pageSize, onPageChange }: PaginationProps) {
  const { t } = useTranslation("common");
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line-subtle">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(currentPage - 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-fg-secondary bg-surface hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        {t("pagination.prev")}
      </button>
      <div className="text-xs text-fg-secondary whitespace-nowrap">
        {t("pagination.pageInfo", { current: currentPage, totalPages, totalItems })}
      </div>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(currentPage + 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-fg-secondary bg-surface hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t("pagination.next")}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
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
  const reset = React.useCallback(() => setCurrentPage(1), []);
  return { currentPage, setCurrentPage, reset, pageSize };
}

export { Pagination as default, cn as _cn };
