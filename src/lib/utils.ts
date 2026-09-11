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
