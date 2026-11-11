import type { Prisma } from "../../generated/prisma/client.js";
import { exactPoints } from "../loyalty/loyalty.balance.js";
import type { OrderDto } from "./orders.types.js";

type OrderRecord = Prisma.OrderGetPayload<{ include: { items: true } }>;

export function toOrderDto(order: OrderRecord): OrderDto {
  const earned = order.status === "PAID" ? order.earnedPointsExact : null;
  return {
    id: order.id, merchantId: order.merchantId, memberId: order.memberId, status: order.status,
    subtotal: order.subtotal.toFixed(0), discountAmount: order.discountAmount.toFixed(0), total: order.total.toFixed(0),
    paidAt: order.paidAt?.toISOString() ?? null,
    earnedPoints: earned?.floor().toNumber() ?? (order.status === "PAID" ? 0 : null),
    earnedPointsExact: earned === null ? null : exactPoints(earned),
    items: order.items.map((item) => ({
      productId: item.productId, productName: item.productName, unitPrice: item.unitPrice.toFixed(0),
      quantity: item.quantity, lineTotal: item.lineTotal.toFixed(0),
    })),
  };
}
