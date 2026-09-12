import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const curr = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(
      curr === "EUR" ? "de-DE" : curr === "GBP" ? "en-GB" : curr === "JPY" ? "ja-JP" : "en-US",
      {
        style: "currency",
        currency: curr,
        minimumFractionDigits: curr === "JPY" ? 0 : 2,
        maximumFractionDigits: curr === "JPY" ? 0 : 2,
      }
    ).format(amount);
  } catch (e) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * CSV 字段转义：含逗号 / 引号 / 换行时用双引号包裹，内部双引号转义为两个双引号
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 通用 CSV 导出：前端生成 Blob 触发下载。
 * - 文件名含页面名与日期时间戳
 * - UTF-8 BOM 头（\uFEFF）确保 Excel 打开中文不乱码
 * - 逗号分隔，字段含逗号/引号/换行自动用双引号包裹
 *
 * @param fileName  基础文件名（不含扩展名），如 "交易流水"
 * @param headers   表头数组，如 ["流水号", "渠道", "金额"]
 * @param rows      数据行二维数组，每行元素顺序与表头对应
 */
export function exportToCSV(fileName: string, headers: string[], rows: unknown[][]): void {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14); // YYYYMMDDHHmmss
  const headerLine = headers.map(escapeCSVField).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCSVField).join(","));
  const csvContent = "\uFEFF" + [headerLine, ...bodyLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${fileName}_${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
