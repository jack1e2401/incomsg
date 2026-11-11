import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { CreatePendingOrderInput, OrderDto } from "./orders.types.js";
import { loyaltyRepository } from "../loyalty/loyalty.repository.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { calculateDiscountedTotal } from "./order-pricing.js";
import { toOrderDto } from "./orders.serialization.js";
import { HttpError } from "../../lib/http-error.js";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
type OrderReadRecord = Prisma.OrderGetPayload<{ include: { items: true; pointTransactions: { select: { type: true; delta: true; promotedToTier: true } } } }>;

function toOrderReadDto(order: OrderReadRecord) {
  return toOrderDto(order);
}

export const ordersRepository = {
  async listMemberOrders(memberId: number, merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { memberId, merchantId },
      include: { items: true, pointTransactions: { select: { type: true, delta: true, promotedToTier: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map(toOrderReadDto);
  },

  async findMemberOrder(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, memberId },
      include: { items: true, pointTransactions: { select: { type: true, delta: true, promotedToTier: true } } },
    });
    if (!order) return null;
    const earnTx = order.pointTransactions?.find((tx) => tx.type === "EARN");
    return { ...toOrderReadDto(order), promotedToTier: earnTx?.promotedToTier ?? null };
  },

  async listMerchantOrders(merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: {
        items: true,
        pointTransactions: { select: { type: true, delta: true, promotedToTier: true } },
        member: { select: { email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map((order) => ({ ...toOrderReadDto(order), memberEmail: order.member.email }));
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
      const { discountAmount, total } = calculateDiscountedTotal(input.subtotal, requestedDiscount);
      return tx.order.create({
        data: {
          memberId: input.memberId,
          merchantId: input.merchantId,
          status: "PENDING",
          subtotal: input.subtotal,
          discountAmount,
          total,
          voucherId: input.voucherId,
          paidAt: null,
          items: { create: input.items },
        },
        include: { items: { orderBy: { id: "asc" } } },
      });
      }, { isolationLevel: "Serializable" }));
    } catch (error) {
      if (input.voucherId !== null && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
      }
      throw error;
    }
    return toOrderDto(order);
  },

  async markPaid(memberId: number, orderId: number): Promise<OrderDto | "missing" | "already_paid" | "vnpay_attempt_exists"> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, memberId }, select: { id: true, status: true } });
      if (!order) return "missing";
      if (order.status !== "PENDING") return "already_paid";
      const attempt = await tx.paymentAttempt.findUnique({ where: { orderId }, select: { id: true } });
      if (attempt) return "vnpay_attempt_exists";
      return loyaltyRepository.completePaidOrder(tx, orderId, memberId);
    }, { isolationLevel: "Serializable" }));
  },
};
