import type { OrderRefund, Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";
import { reverseOrderChallenges } from "../../loyalty/challenges/challenges.engine.js";
import { describeWallet } from "../../loyalty/program/loyalty.balance.js";
import { reverseOrderPoints } from "../../loyalty/program/loyalty.reversal.js";
import { restoreOrderVoucher } from "../../loyalty/vouchers/vouchers.order.js";
import { reverseMerchantFee } from "../../merchants/profile/merchant.finance.js";
import { toOrderDto } from "../orders/orders.serialization.js";
import type { RefundResponseDto } from "../orders/orders.types.js";

export async function completeMockRefund(
  tx: Prisma.TransactionClient,
  input: { merchantId: number; ownerId: number; orderId: number; reason: string; replay: boolean },
): Promise<RefundResponseDto & { challengeReversals: number }> {
  const { merchantId, ownerId, orderId, reason, replay } = input;
  const order = await tx.order.findFirst({
    where: { id: orderId, merchantId },
    include: { items: true, paymentAttempt: true, refund: true, refundRequest: true, pointTransactions: true },
  });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
  if (order.paymentAttempt?.status === "SUCCEEDED") throw new HttpError(409, "VNPAY_REFUND_NOT_SUPPORTED");

  const memberId = order.memberId;
  const getWallet = () => tx.loyaltyWallet.findFirst({ where: { membership: { memberId, merchantId } } });
  if (replay) {
    if (order.status !== "REFUNDED" || order.refund?.status !== "COMPLETED") {
      throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
    }
    return refundResult(order, order.refund, describeWallet(await getWallet()), 0);
  }
  if (order.status !== "PAID" || order.refund) throw new HttpError(409, "ORDER_NOT_REFUNDABLE");

  const completedAt = new Date();
  const refund = await tx.orderRefund.create({
    data: {
      orderId: order.id,
      status: "COMPLETED",
      amountVnd: order.total,
      reason,
      requestedById: ownerId,
      completedAt,
      providerReference: `mock-refund-${order.id}`,
    },
  });

  await reverseOrderPoints(tx, order, ownerId);
  await restoreOrderVoucher(tx, order.voucherId);

  const challengeReversals = await reverseOrderChallenges(tx, order.id, ownerId);
  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: { status: "REFUNDED" },
    include: { items: true, paymentAttempt: true, pointTransactions: true, refundRequest: true, refund: true },
  });
  await reverseMerchantFee(tx, merchantId, order.id, completedAt);
  return refundResult(updatedOrder, refund, describeWallet(await getWallet()), challengeReversals);
}

function refundResult(
  order: Parameters<typeof toOrderDto>[0],
  refund: OrderRefund,
  walletImpact: RefundResponseDto["walletImpact"],
  challengeReversals: number,
): RefundResponseDto & { challengeReversals: number } {
  return {
    refund: {
      id: refund.id,
      status: refund.status,
      amountVnd: refund.amountVnd.toFixed(0),
      reason: refund.reason,
      requestedById: refund.requestedById,
      requestedAt: refund.requestedAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
      providerReference: refund.providerReference,
    },
    order: toOrderDto(order),
    walletImpact,
    challengeReversals,
  };
}
