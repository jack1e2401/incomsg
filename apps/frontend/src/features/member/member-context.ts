import { useOutletContext } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import type { useMemberCart } from "./useMemberCart";

export const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
export const money = (value: string | bigint) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    typeof value === "bigint" ? value : Number(value),
  );

export type MemberContext = { merchantId: number; basePath?: string; cart: ReturnType<typeof useMemberCart> };

export function useMerchantContext() {
  const ctx = useOutletContext<MemberContext>();
  return {
    ...ctx,
    basePath: ctx.basePath ?? `/member/${ctx.merchantId}`,
  };
}
