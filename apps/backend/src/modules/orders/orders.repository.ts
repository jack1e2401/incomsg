import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CancelOrderResult,
  CreatePendingOrderInput,
  OrderDto,
  RefundPreviewDto,
  RefundResponseDto,
} from "./orders.types.js";
import { OrderNotCancellableError } from "./orders.types.js";
import { loyaltyRepository } from "../loyalty/loyalty.repository.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import { calculateDiscountedTotal } from "./order-pricing.js";
import { toOrderDto } from "./orders.serialization.js";
import { HttpError } from "../../lib/http-error.js";
import { describeWallet, exactPoints } from "../loyalty/loyalty.balance.js";
import { points, selectTier } from "../loyalty/loyalty.calculation.js";
import { defaultTiers, loadEarningPolicy } from "../loyalty/loyalty.config.js";

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

export const ordersRepository = {
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
    return { ...toOrderReadDto(order), promotedToTier: earnTx?.promotedToTier ?? null };
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
    return orders.map((order) => ({ ...toOrderReadDto(order), memberEmail: order.member.email }));
  },

  async createPendingOrder(input: CreatePendingOrderInput): Promise<OrderDto> {
    let order: Prisma.OrderGetPayload<{
      include: { items: true; paymentAttempt: true; refund: true; pointTransactions: true };
    }>;
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
            include: { activeReservation: true },
          });
          if (!voucher) throw new HttpError(404, "VOUCHER_NOT_FOUND");
          if (voucher.activeReservation) throw new HttpError(409, "VOUCHER_ALREADY_RESERVED");
          requestedDiscount = voucher.snapshotDiscountAmount ?? new Prisma.Decimal(0);
        }
        const { discountAmount, total } = calculateDiscountedTotal(input.subtotal, requestedDiscount);
        const created = await tx.order.create({
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
          include: {
            items: { orderBy: { id: "asc" } },
            paymentAttempt: true,
            refund: true,
            pointTransactions: true,
          },
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

  async cancelOrder(memberId: number, orderId: number): Promise<CancelOrderResult> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, memberId },
        include: { paymentAttempt: true, voucherReservation: true },
      });
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      if (order.status !== "PENDING") {
        throw new OrderNotCancellableError(order.status, order.paymentAttempt?.status ?? null);
      }
      if (order.paymentAttempt) {
        if (order.paymentAttempt.status === "CREATED" || order.paymentAttempt.status === "SUCCEEDED") {
          throw new OrderNotCancellableError(order.status, order.paymentAttempt.status);
        }
      }

      const deletedReservation = await tx.orderVoucherReservation.deleteMany({
        where: { orderId },
      });
      const voucherReleased = deletedReservation.count > 0;

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
        include: { items: true, paymentAttempt: true, refund: true, pointTransactions: true },
      });

      return {
        order: toOrderDto(updated),
        voucherReleased,
        capacityReleasedExact: "0",
      };
    }, { isolationLevel: "Serializable" }));
  },

  async getRefundPreview(merchantId: number, orderId: number): Promise<RefundPreviewDto> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { voucher: true, paymentAttempt: true, refund: true },
      });
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      if (order.merchantId !== merchantId) throw new HttpError(403, "FORBIDDEN");
      if (order.status !== "PAID" && order.status !== "REFUND_PENDING" && order.status !== "REFUNDED") {
        throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
      }

      const [membership, configuredTiers] = await Promise.all([
        tx.merchantMembership.findUnique({
          where: { memberId_merchantId: { memberId: order.memberId, merchantId } },
          include: { wallet: true },
        }),
        tx.loyaltyTier.findMany({ where: { merchantId }, orderBy: { minLifetimePoints: "asc" } }),
      ]);
      const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
      const wallet = membership?.wallet;
      const originalEarned = points(order.earnedPointsExact ?? "0");

      const walletBefore = describeWallet(wallet);
      const projectedBalance = points(wallet?.exactBalance ?? "0").minus(originalEarned);
      const projectedLifetime = points(wallet?.netLifetimeEarned ?? "0").minus(originalEarned);
      const walletAfter = describeWallet({ exactBalance: projectedBalance, netLifetimeEarned: projectedLifetime });

      const tierBefore = selectTier(wallet?.netLifetimeEarned ?? "0", tiers) ?? "UNRANKED";
      const tierAfter = selectTier(projectedLifetime, tiers) ?? "UNRANKED";

      const isVnpay = Boolean(order.paymentAttempt && order.paymentAttempt.status === "SUCCEEDED");

      return {
        orderId: order.id,
        refundAmountVnd: order.total.toFixed(0),
        refundStatus: order.refund?.status ?? null,
        earningReversalExact: exactPoints(originalEarned),
        walletBefore,
        walletAfter,
        tierBefore,
        tierAfter,
        discountVoucherRestorable: Boolean(order.voucherId && order.voucher?.status === "USED"),
        providerConfirmationRequired: isVnpay,
      };
    });
  },

  async refundOrder(merchantId: number, ownerId: number, orderId: number, reason: string): Promise<RefundResponseDto> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, paymentAttempt: true, voucher: true, refund: true, pointTransactions: true },
      });
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
      if (order.merchantId !== merchantId) throw new HttpError(403, "FORBIDDEN");

      if (order.refund) {
        const existingRefund = order.refund;
        const wallet = await tx.loyaltyWallet.findFirst({
          where: { membership: { memberId: order.memberId, merchantId } },
        });
        return {
          refund: {
            id: existingRefund.id,
            status: existingRefund.status,
            amountVnd: existingRefund.amountVnd.toFixed(0),
            reason: existingRefund.reason,
            requestedById: existingRefund.requestedById,
            requestedAt: existingRefund.requestedAt.toISOString(),
            completedAt: existingRefund.completedAt?.toISOString() ?? null,
            providerReference: existingRefund.providerReference,
          },
          order: toOrderDto(order),
          walletImpact: existingRefund.status === "COMPLETED" ? describeWallet(wallet) : null,
        };
      }

      if (order.status !== "PAID") {
        throw new HttpError(409, "ORDER_NOT_REFUNDABLE");
      }

      const isVnpay = Boolean(order.paymentAttempt && order.paymentAttempt.status === "SUCCEEDED");

      if (isVnpay) {
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: "REFUND_PENDING" },
          include: { items: true, paymentAttempt: true, pointTransactions: true },
        });
        const refund = await tx.orderRefund.create({
          data: {
            orderId: order.id,
            status: "PENDING_PROVIDER",
            amountVnd: order.total,
            reason,
            requestedById: ownerId,
          },
        });
        return {
          refund: {
            id: refund.id,
            status: refund.status,
            amountVnd: refund.amountVnd.toFixed(0),
            reason: refund.reason,
            requestedById: refund.requestedById,
            requestedAt: refund.requestedAt.toISOString(),
            completedAt: null,
            providerReference: null,
          },
          order: toOrderDto({ ...updatedOrder, refund }),
          walletImpact: null,
        };
      }

      // Mock mode: simulated atomic refund completion
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
        include: { items: true, paymentAttempt: true, pointTransactions: true },
      });
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

      const originalEarned = points(order.earnedPointsExact ?? "0");
      let updatedWalletRecord = null;
      if (originalEarned.isPositive()) {
        const membership = await tx.merchantMembership.findUniqueOrThrow({
          where: { memberId_merchantId: { memberId: order.memberId, merchantId } },
          include: { wallet: true },
        });
        const wallet = membership.wallet!;
        const balanceAfter = points(wallet.exactBalance).minus(originalEarned);
        const lifetimeAfter = points(wallet.netLifetimeEarned).minus(originalEarned);

        const updatedWallet = await tx.loyaltyWallet.updateMany({
          where: { id: wallet.id, exactBalance: wallet.exactBalance, netLifetimeEarned: wallet.netLifetimeEarned },
          data: {
            exactBalance: { decrement: originalEarned },
            netLifetimeEarned: { decrement: originalEarned },
          },
        });
        if (updatedWallet.count !== 1) throw Object.assign(new Error("Concurrent wallet update"), { code: "P2034" });

        const policy = await loadEarningPolicy(tx, merchantId);
        const nextLevel = selectTier(lifetimeAfter, policy.tiers) ?? "BRONZE";
        const nextTier = policy.tiers.find((t) => t.level === nextLevel);
        if (nextTier) {
          await tx.merchantMembership.update({ where: { id: membership.id }, data: { tierId: nextTier.id } });
        }

        await tx.pointTransaction.create({
          data: {
            walletId: wallet.id,
            type: "EARN_REVERSAL",
            delta: originalEarned.negated(),
            balanceAfter,
            promotedToTier: null,
            reason: `Refund for order #${order.id}`,
            eventRef: `order-earn-reversal-${order.id}`,
            source: "MERCHANT_REFUND",
            actorId: ownerId,
            orderId: order.id,
          },
        });

        updatedWalletRecord = await tx.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      } else {
        const membership = await tx.merchantMembership.findUnique({
          where: { memberId_merchantId: { memberId: order.memberId, merchantId } },
          include: { wallet: true },
        });
        updatedWalletRecord = membership?.wallet ?? null;
      }

      if (order.voucherId !== null) {
        await tx.memberVoucher.updateMany({
          where: { id: order.voucherId, status: "USED" },
          data: { status: "AVAILABLE", usedAt: null },
        });
      }

      return {
        refund: {
          id: refund.id,
          status: refund.status,
          amountVnd: refund.amountVnd.toFixed(0),
          reason: refund.reason,
          requestedById: refund.requestedById,
          requestedAt: refund.requestedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          providerReference: refund.providerReference,
        },
        order: toOrderDto({ ...updatedOrder, refund }),
        walletImpact: describeWallet(updatedWalletRecord),
      };
    }, { isolationLevel: "Serializable" }));
  },
};
