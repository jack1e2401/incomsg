import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { CreatePendingOrderInput, OrderDto } from "./orders.types.js";
import { loyaltyRepository } from "../loyalty/loyalty.repository.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

function toOrderDto(order: OrderWithItems): OrderDto {
  return {
    id: order.id,
    merchantId: order.merchantId,
    memberId: order.memberId,
    status: order.status,
    subtotal: order.subtotal.toFixed(0),
    discountAmount: order.discountAmount.toFixed(0),
    total: order.total.toFixed(0),
    paidAt: order.paidAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toFixed(0),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(0),
    })),
  };
}

export const ordersRepository = {
  async createPendingOrder(input: CreatePendingOrderInput): Promise<OrderDto> {
    const order = await prisma.order.create({
      data: {
        memberId: input.memberId,
        merchantId: input.merchantId,
        status: "PENDING",
        subtotal: input.total,
        discountAmount: new Prisma.Decimal(0),
        total: input.total,
        voucherId: null,
        paidAt: null,
        items: {
          create: {
            productId: input.productId,
            productName: input.productName,
            unitPrice: input.unitPrice,
            quantity: input.quantity,
            lineTotal: input.total,
          },
        },
      },
      include: { items: true },
    });
    return toOrderDto(order);
  },

  async markPaid(memberId: number, orderId: number): Promise<OrderDto | "missing" | "already_paid"> {
    return withTransactionRetry(() => prisma.$transaction(
      (tx) => loyaltyRepository.completePaidOrder(tx, orderId, memberId),
      { isolationLevel: "Serializable" },
    ));
  },
};
