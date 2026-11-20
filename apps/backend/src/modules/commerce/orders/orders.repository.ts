import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  CancelOrderResult,
  CreatePendingOrderInput,
  OrderDto,
  RefundPreviewDto,
} from "./orders.types.js";
import { OrderNotCancellableError } from "./orders.types.js";
import { loyaltyRepository } from "../../loyalty/program/loyalty.repository.js";
import { withTransactionRetry } from "../../loyalty/program/loyalty.transaction.js";
import { calculateDiscountedTotal } from "./order-pricing.js";
import { toOrderDto } from "./orders.serialization.js";
import { HttpError } from "../../../lib/http-error.js";
import { describeWallet, exactPoints } from "../../loyalty/program/loyalty.balance.js";
import { points, selectTier } from "../../loyalty/program/loyalty.calculation.js";
import { defaultTiers, loadEarningPolicy } from "../../loyalty/program/loyalty.config.js";
import {
  reserveOrderInventory,
  releaseOrderInventory,
  releaseExpiredMockOrders,
} from "../inventory/inventory.order.js";
import { orderReadRepository } from "./orders.read.repository.js";

export const ordersRepository = {
  ...orderReadRepository,

  async createPendingOrder(input: CreatePendingOrderInput): Promise<OrderDto> {
    let order: Prisma.OrderGetPayload<{
      include: {
        items: true;
        paymentAttempt: true;
        refund: true;
        pointTransactions: true;
      };
    }>;
    try {
      order = await withTransactionRetry(() =>
        prisma.$transaction(
          async (tx) => {
            let requestedDiscount = new Prisma.Decimal(0);
            if (input.voucherId !== null) {
              const voucher = await tx.memberVoucher.findFirst({
                where: {
                  id: input.voucherId,
                  status: "AVAILABLE",
                  membership: {
                    memberId: input.memberId,
                    merchantId: input.merchantId,
                  },
                  snapshotType: "DISCOUNT",
                },
                include: { activeReservation: true },
              });
              if (!voucher) throw new HttpError(404, "VOUCHER_NOT_FOUND");
              if (voucher.activeReservation)
                throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
              requestedDiscount =
                voucher.snapshotDiscountAmount ?? new Prisma.Decimal(0);
            }
            const { discountAmount, total } = calculateDiscountedTotal(
              input.subtotal,
              requestedDiscount,
            );
            const now = new Date();
            const created = await tx.order.create({
              data: {
                memberId: input.memberId,
                merchantId: input.merchantId,
                status: "PENDING",
                subtotal: input.subtotal,
                discountAmount,
                total,
                voucherId: input.voucherId,
                stockReservedAt: now,
                stockReservedUntil: new Date(now.getTime() + 5 * 60 * 1000),
                paidAt: null,
                items: { create: input.items },
              },
              include: {
                items: { orderBy: { id: "asc" } },
                paymentAttempt: true,
                refund: true,
                pointTransactions: true,
              },
            });
            await reserveOrderInventory(tx, {
              merchantId: input.merchantId,
              orderId: created.id,
              memberId: input.memberId,
              items: created.items,
            });
            if (input.voucherId !== null) {
              await tx.orderVoucherReservation.create({
                data: {
                  voucherId: input.voucherId,
                  orderId: created.id,
                },
              });
            }
            return created;
          },
          { isolationLevel: "Serializable" },
        ),
      );
    } catch (error) {
      if (
        input.voucherId !== null &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
      }
      throw error;
    }
    return toOrderDto(order);
  },

  async markPaid(
    memberId: number,
    orderId: number,
  ): Promise<
    | OrderDto
    | "missing"
    | "already_paid"
    | "vnpay_attempt_exists"
    | "reservation_expired"
  > {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, memberId },
            include: { items: true, paymentAttempt: true },
          });
          if (!order) return "missing";
          if (order.status !== "PENDING") return "already_paid";
          if (order.paymentAttempt) return "vnpay_attempt_exists";
          if (
            order.stockReservedUntil &&
            order.stockReservedUntil.getTime() <= Date.now()
          ) {
            await releaseOrderInventory(
              tx,
              order,
              memberId,
              "Order stock reservation expired after five minutes",
            );
            await tx.order.updateMany({
              where: { id: orderId, memberId, status: "PENDING" },
              data: { status: "CANCELLED" },
            });
            await tx.orderVoucherReservation.deleteMany({ where: { orderId } });
            return "reservation_expired";
          }
          return loyaltyRepository.completePaidOrder(tx, orderId, memberId);
        },
        { isolationLevel: "Serializable" },
      ),
      6,
    );
  },

  async cancelOrder(
    memberId: number,
    orderId: number,
  ): Promise<CancelOrderResult> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, memberId },
            include: {
              paymentAttempt: true,
              voucherReservation: true,
              items: true,
            },
          });
          if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
          if (order.status !== "PENDING") {
            throw new OrderNotCancellableError(
              order.status,
              order.paymentAttempt?.status ?? null,
            );
          }
          if (order.paymentAttempt) {
            if (
              order.paymentAttempt.status === "CREATED" ||
              order.paymentAttempt.status === "SUCCEEDED"
            ) {
              throw new OrderNotCancellableError(
                order.status,
                order.paymentAttempt.status,
              );
            }
          }

          await releaseOrderInventory(
            tx,
            order,
            memberId,
            `Cancelled by member #${memberId}`,
          );

          const deletedReservation =
            await tx.orderVoucherReservation.deleteMany({
              where: { orderId },
            });
          const voucherReleased = deletedReservation.count > 0;

          const updated = await tx.order.update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
            include: {
              items: true,
              paymentAttempt: true,
              refund: true,
              pointTransactions: true,
            },
          });

          return {
            order: toOrderDto(updated),
            voucherReleased,
            capacityReleasedExact: "0",
          };
        },
        { isolationLevel: "Serializable" },
      ),
    );
  },

  async getRefundPreview(
    merchantId: number,
    orderId: number,
  ): Promise<RefundPreviewDto> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { voucher: true, paymentAttempt: true, refund: true },
      });
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      if (order.merchantId !== merchantId)
        throw new HttpError(403, "FORBIDDEN");
      if (
        order.status !== "PAID" &&
        order.status !== "REFUND_PENDING" &&
        order.status !== "REFUNDED"
      ) {
        throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
      }

      const [membership, configuredTiers] = await Promise.all([
        tx.merchantMembership.findUnique({
          where: {
            memberId_merchantId: { memberId: order.memberId, merchantId },
          },
          include: { wallet: true },
        }),
        tx.loyaltyTier.findMany({
          where: { merchantId },
          orderBy: { minLifetimePoints: "asc" },
        }),
      ]);
      const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
      const wallet = membership?.wallet;
      const originalEarned = points(order.earnedPointsExact ?? "0");

      const tierBefore =
        selectTier(wallet?.netLifetimeEarned ?? "0", tiers) ?? "UNRANKED";
      const isVnpay = Boolean(
        order.paymentAttempt && order.paymentAttempt.status === "SUCCEEDED",
      );
      const challengeEntries = await tx.challengeProgressEntry.findMany({
        where: { activity: { orderId: order.id, type: "ORDER_PAID" }, deltaValue: { gt: 0 } },
        include: { progress: { include: { challenge: true, grants: { where: { status: "GRANTED" }, orderBy: { cycle: "desc" }, take: 1 } } } },
      });
      const challenges = challengeEntries.map((entry) => {
        const progress = entry.progress; const challenge = progress.challenge; const grant = progress.grants[0] ?? null;
        const after = progress.currentValue.minus(entry.deltaValue); const belowTarget = after.lessThan(challenge.targetValue); const revoke = Boolean(grant && belowTarget);
        return { challengeId: challenge.id, title: challenge.title, type: challenge.type, targetValue: challenge.targetValue.toFixed(0), currentValueBefore: progress.currentValue.toFixed(0), currentValueAfter: after.toFixed(0), rewardStateBefore: progress.rewardState, rewardStateAfter: belowTarget ? "IN_PROGRESS" : progress.rewardState, grantStatusBefore: grant ? "GRANTED" as const : null, grantStatusAfter: revoke ? "REVERSED" as const : grant ? "GRANTED" as const : null, pointsToReverseExact: revoke && grant ? grant.pointsGranted.toFixed(12) : "0", budgetSpentBefore: challenge.budgetSpent.toFixed(12), budgetSpentAfter: revoke && grant ? challenge.budgetSpent.minus(grant.pointsGranted).toFixed(12) : challenge.budgetSpent.toFixed(12) };
      });
      const challengeReversalTotal = challenges.reduce((sum, item) => sum.plus(item.pointsToReverseExact), points("0"));
      const walletBefore = describeWallet(wallet);
      const projectedBalance = points(wallet?.exactBalance ?? "0").minus(originalEarned).minus(challengeReversalTotal);
      const projectedLifetime = points(wallet?.netLifetimeEarned ?? "0").minus(originalEarned).minus(challengeReversalTotal);
      const walletAfter = describeWallet({
        exactBalance: projectedBalance,
        netLifetimeEarned: projectedLifetime,
      });
      const tierAfter = selectTier(projectedLifetime, tiers) ?? "UNRANKED";

      return {
        orderId: order.id,
        refundAmountVnd: order.total.toFixed(0),
        refundStatus: order.refund?.status ?? null,
        earningReversalExact: exactPoints(originalEarned),
        walletBefore,
        walletAfter,
        tierBefore,
        tierAfter,
        discountVoucherRestorable: Boolean(
          order.voucherId && order.voucher?.status === "USED",
        ),
        providerConfirmationRequired: isVnpay,
        challenges,
      };
    });
  },

  releaseExpiredMockOrders,
};
