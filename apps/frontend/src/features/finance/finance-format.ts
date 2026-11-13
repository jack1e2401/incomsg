import type { MerchantFinanceTierLevel } from "../../api/commerce-types";

const vietnamTimeZone = "Asia/Ho_Chi_Minh";
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: vietnamTimeZone,
  dateStyle: "short",
  timeStyle: "short",
});
const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: vietnamTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const merchantTierLabels: Record<MerchantFinanceTierLevel, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

export function feeMoney(value: string, signed = false) {
  const amount = BigInt(value);
  return `${signed && amount > 0n ? "+" : ""}${vnd.format(amount)}`;
}

export function feeRateLabel(rate: string) {
  return percent.format(Number(rate));
}

export function financeDateTime(value: string) {
  return dateTime.format(new Date(value));
}

export function currentWeekRange(now = new Date()) {
  return { from: dateKey.format(new Date(now.getTime() - 6 * 86_400_000)), to: dateKey.format(now) };
}
