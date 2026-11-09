import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { CreatePendingOrderInput, OrderDto } from "./orders.types.js";
import { loyaltyRepository } from "../loyalty/loyalty.repository.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { calculateDiscountedTotal } from "./order-pricing.js";
import { HttpError } from "../../lib/http-error.js";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
type OrderReadRecord = Prisma.OrderGetPayload<{ include: { items: true; pointTransaction: { select: { delta: true } } } }>;

function toOrderReadDto(order: OrderReadRecord) {
  return { ...toOrderDto(order), earnedPoints: order.status === "PAID" ? (order.pointTransaction?.delta ?? 0) : null };
}

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
  async listMemberOrders(memberId: number, merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { memberId, merchantId },
      include: { items: true, pointTransaction: { select: { delta: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map(toOrderReadDto);
  },

  async findMemberOrder(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, memberId },
      include: { items: true, pointTransaction: { select: { delta: true } } },
    });
    return order ? toOrderReadDto(order) : null;
  },

  async listMerchantOrders(merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: { items: true, pointTransaction: { select: { delta: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map(toOrderReadDto);
  },

  async createPendingOrder(input: CreatePendingOrderInput): Promise<OrderDto> {
    let order: OrderWithItems;
    try {
      order = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      let requestedDiscount = new Prisma.Decimal(0);
      if (input.voucherId !== null) {
        const voucher = await tx.memberVoucher.findFirst({
          where: {
            id: input.voucherId,
            status: "AVAILABLE",
            membership: { memberId: input.memberId, merchantId: input.merchantId },
            snapshotType: "DISCOUNT",
          },
        });
        if (!voucher) throw new HttpError(404, "VOUCHER_NOT_FOUND");
        const existingOrder = await tx.order.findFirst({ where: { voucherId: input.voucherId }, select: { id: true } });
        if (existingOrder) throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
        requestedDiscount = voucher.snapshotDiscountAmount ?? new Prisma.Decimal(0);
      }
      const { discountAmount, total } = calculateDiscountedTotal(input.total, requestedDiscount);
      const order = await tx.order.create({
      data: {
        memberId: input.memberId,
        merchantId: input.merchantId,
        status: "PENDING",
        subtotal: input.total,
        discountAmount,
        total,
        voucherId: input.voucherId,
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
      return order;
      }, { isolationLevel: "Serializable" }));
    } catch (error) {
      if (input.voucherId !== null && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
      }
      throw error;
    }
    return toOrderDto(order);
  },

  async markPaid(memberId: number, orderId: number): Promise<OrderDto | "missing" | "already_paid"> {
    return withTransactionRetry(() => prisma.$transaction(
      (tx) => loyaltyRepository.completePaidOrder(tx, orderId, memberId),
      { isolationLevel: "Serializable" },
    ));
  },
};
