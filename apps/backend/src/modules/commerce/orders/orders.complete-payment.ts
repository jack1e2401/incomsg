import type { Prisma } from "../../../generated/prisma/client.js";
import { consumeOrderInventory } from "../inventory/inventory.order.js";
import { processPaidOrderChallenges } from "../../loyalty/challenges/challenges.engine.js";
import { creditOrderPoints, type EarningSnapshot } from "../../loyalty/program/loyalty.earning.js";
import { consumeOrderVoucher } from "../../loyalty/vouchers/vouchers.order.js";
import { recordMerchantFee } from "../../merchants/profile/merchant.finance.js";
import { toOrderDto } from "./orders.serialization.js";
import type { OrderDto } from "./orders.types.js";

export async function completePaidOrder(
  tx: Prisma.TransactionClient, orderId: number, memberId: number, snapshot?: EarningSnapshot,
): Promise<OrderDto | "missing" | "already_paid"> {
  const changed = await tx.order.updateMany({
    where: { id: orderId, memberId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() },
  });
  if (changed.count === 0) {
    const existing = await tx.order.findFirst({ where: { id: orderId, memberId }, select: { id: true } });
    return existing ? "already_paid" : "missing";
  }
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId }, include: { items: true, voucher: { include: { membership: true } } },
  });
  await consumeOrderInventory(tx, order);
  await consumeOrderVoucher(tx, order);
  const paidOrder = { ...order, paidAt: order.paidAt! };
  const { paid, promotedToTier, membershipId } = await creditOrderPoints(tx, paidOrder, snapshot);
  await recordMerchantFee(tx, paidOrder);
  await processPaidOrderChallenges(tx, paidOrder, membershipId);
  return { ...toOrderDto(paid), promotedToTier };
}
