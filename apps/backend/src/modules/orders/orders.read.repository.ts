import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { toOrderDto } from "./orders.serialization.js";

type OrderReadRecord = Prisma.OrderGetPayload<{
  include: {
    items: true;
    pointTransactions: true;
    paymentAttempt: true;
    refund: true;
  };
}>;

function toOrderReadDto(order: OrderReadRecord) {
  return toOrderDto(order);
}

export const orderReadRepository = {
  async listMemberOrders(memberId: number, merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { memberId, merchantId },
      include: {
        items: true,
        pointTransactions: true,
        paymentAttempt: true,
        refund: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map(toOrderReadDto);
  },

  async findMemberOrder(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, memberId },
      include: {
        items: true,
        pointTransactions: true,
        paymentAttempt: true,
        refund: true,
      },
    });
    if (!order) return null;
    const earnTx = order.pointTransactions?.find((tx) => tx.type === "EARN");
    return {
      ...toOrderReadDto(order),
      promotedToTier: earnTx?.promotedToTier ?? null,
    };
  },

  async listMerchantOrders(merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: {
        items: true,
        pointTransactions: true,
        paymentAttempt: true,
        refund: true,
        member: { select: { email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map((order) => ({
      ...toOrderReadDto(order),
      memberEmail: order.member.email,
    }));
  },

  async findMerchantOrder(merchantId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: {
        items: true,
        pointTransactions: true,
        paymentAttempt: true,
        refund: true,
      },
    });
    return order ? toOrderReadDto(order) : null;
  },
};
