/**
 * 后端统一存 UTC Unix 秒；前端展示时按本地时区格式化。
 * 兼容历史字符串，便于 Mock / 过渡期。
 */
export type UnixTime = number | string | null | undefined;

export function toUnixSeconds(value: UnixTime): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // 毫秒误传时收敛到秒
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  const n = Number(value);
  if (Number.isFinite(n) && /^\d+$/.test(String(value).trim())) {
    return n > 1e12 ? Math.floor(n / 1000) : n;
  }
  const ms = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function formatUnix(
  value: UnixTime,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  },
): string {
  const sec = toUnixSeconds(value);
  if (sec == null) return "-";
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(sec * 1000));
}
