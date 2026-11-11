import { Prisma } from "../../generated/prisma/client.js";

export function calculateDiscountedTotal(subtotal: Prisma.Decimal, requestedDiscount: Prisma.Decimal) {
  const discountAmount = requestedDiscount.greaterThan(subtotal) ? subtotal : requestedDiscount;
  return { discountAmount, total: subtotal.sub(discountAmount) };
}
