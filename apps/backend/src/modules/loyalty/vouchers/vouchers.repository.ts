import { createHash } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HttpError } from "../../../lib/http-error.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import type {
  CancelRewardResponseDto,
  DefinitionDto,
  DefinitionInput,
  DefinitionPatch,
  MemberVoucherDto,
  RewardItemDto,
} from "./vouchers.types.js";
import { snapshotVoucherTerms } from "./vouchers.snapshot.js";
import { describeWallet } from "../program/loyalty.balance.js";
import { points } from "../program/loyalty.calculation.js";
import {
  createInventoryBalance,
  moveInventory,
  readInventoryBalance,
  toInventorySummary,
} from "../../commerce/inventory/inventory.persistence.js";
import {
  availableRewardProduct,
  definitionDtos,
  definitionInclude,
  toDefinitionDto,
  toMemberVoucherDto,
  toRewardItemDto,
  voucherReadRepository,
} from "./vouchers.read.repository.js";

export const vouchersRepository = {
  ...voucherReadRepository,
  async createDefinition(
    merchantId: number,
    actorId: number,
    input: DefinitionInput,
  ): Promise<DefinitionDto> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const product =
            input.rewardProductId === null
              ? null
              : await tx.product.findFirst({
                  where: {
                    id: input.rewardProductId,
                    merchantId,
                    kind: "REWARD",
                    status: "ACTIVE",
                  },
                  select: { name: true },
                });
          if (input.type === "REWARD" && !product)
            throw new HttpError(404, "REWARD_PRODUCT_NOT_FOUND");
          const definition = await tx.voucherDefinition.create({
            data: {
              merchantId,
              type: input.type,
              title: input.title,
              pointsCost: input.pointsCost,
              rewardDescription: product?.name ?? input.rewardDescription,
              discountAmount:
                input.discountAmount === null
                  ? null
                  : new Prisma.Decimal(input.discountAmount),
              rewardProductId: input.rewardProductId,
            },
          });
          if (input.type === "DISCOUNT") {
            await createInventoryBalance(
              tx,
              {
                merchantId,
                ownerType: "DISCOUNT_VOUCHER",
                voucherDefinitionId: definition.id,
              },
              input.initialQuantity ?? 0,
              actorId,
            );
          }
          const full = await tx.voucherDefinition.findUniqueOrThrow({
            where: { id: definition.id },
            include: definitionInclude,
          });
          return toDefinitionDto(full);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
  async updateDefinition(
    merchantId: number,
    id: number,
    patch: DefinitionPatch,
  ): Promise<DefinitionDto | null> {
    const updated = await prisma.voucherDefinition.updateMany({
      where: { id, merchantId },
      data: {
        ...patch,
        ...(patch.discountAmount !== undefined
          ? {
              discountAmount:
                patch.discountAmount === null
                  ? null
                  : new Prisma.Decimal(patch.discountAmount),
            }
          : {}),
      },
    });
    if (!updated.count) return null;
    const item = await prisma.voucherDefinition.findUnique({
      where: { id },
      include: definitionInclude,
    });
    if (!item) return null;
    const issued =
      item.type === "DISCOUNT"
        ? await prisma.inventoryMovement.aggregate({
            where: {
              voucherDefinitionId: id,
              merchantId,
              movementType: "VOUCHER_REDEMPTION_OUT",
            },
            _sum: { quantityDelta: true },
          })
        : null;
    return toDefinitionDto(item, Math.abs(issued?._sum.quantityDelta ?? 0));
  },
  async redeemVoucher(
    memberId: number,
    definitionId: number,
    idempotencyKey: string,
  ) {
    const route = "/api/member/vouchers/:definitionId/redeem";
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ definitionId }))
      .digest("hex");
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const existingIdempotency = await tx.redemptionIdempotency.findUnique(
            {
              where: {
                memberId_route_idempotencyKey: {
                  memberId,
                  route,
                  idempotencyKey,
                },
              },
            },
          );
          if (existingIdempotency) {
            if (existingIdempotency.definitionId !== definitionId) {
              throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT");
            }
            const existingVoucher = await tx.memberVoucher.findUniqueOrThrow({
              where: { id: existingIdempotency.voucherId },
              include: {
                membership: true,
                definition: true,
                activeReservation: true,
              },
            });
            const currentWallet = await tx.loyaltyWallet.findUniqueOrThrow({
              where: { membershipId: existingVoucher.membershipId },
            });
            return {
              voucher: toMemberVoucherDto(existingVoucher),
              wallet: describeWallet(currentWallet),
            };
          }

          const definition = await tx.voucherDefinition.findFirst({
            where: {
              id: definitionId,
              isActive: true,
              ...availableRewardProduct,
            },
            include: { merchant: { select: { isActive: true } } },
          });
          if (!definition || !definition.merchant.isActive)
            throw new HttpError(404, "VOUCHER_DEFINITION_NOT_FOUND");
          const membership = await tx.merchantMembership.upsert({
            where: {
              memberId_merchantId: {
                memberId,
                merchantId: definition.merchantId,
              },
            },
            create: { memberId, merchantId: definition.merchantId },
            update: {},
          });
          const wallet = await tx.loyaltyWallet.upsert({
            where: { membershipId: membership.id },
            create: { membershipId: membership.id },
            update: {},
          });
          const debit = await tx.loyaltyWallet.updateMany({
            where: {
              id: wallet.id,
              exactBalance: { gte: definition.pointsCost },
            },
            data: { exactBalance: { decrement: definition.pointsCost } },
          });
          if (!debit.count) throw new HttpError(409, "INSUFFICIENT_POINTS");
          const voucher = await tx.memberVoucher.create({
            data: {
              membershipId: membership.id,
              definitionId: definition.id,
              status:
                definition.type === "REWARD"
                  ? "PENDING_FULFILLMENT"
                  : "AVAILABLE",
              rewardProductIdSnapshot:
                definition.type === "REWARD"
                  ? definition.rewardProductId
                  : null,
              rewardInventoryReserved: definition.type === "REWARD",
              ...snapshotVoucherTerms({
                type: definition.type,
                title: definition.title,
                pointsCost: definition.pointsCost,
                discountAmount: definition.discountAmount?.toFixed(0) ?? null,
                rewardDescription: definition.rewardDescription,
              }),
              snapshotDiscountAmount: definition.discountAmount,
            },
          });
          try {
            if (definition.type === "DISCOUNT") {
              await moveInventory(tx, {
                merchantId: definition.merchantId,
                ownerType: "DISCOUNT_VOUCHER",
                voucherDefinitionId: definition.id,
                movementType: "VOUCHER_REDEMPTION_OUT",
                quantity: 1,
                reason: `Issued discount voucher to member #${memberId}`,
                eventRef: `voucher-redemption-${voucher.id}`,
                memberVoucherId: voucher.id,
                actorId: memberId,
              });
            } else if (definition.rewardProductId !== null) {
              await moveInventory(tx, {
                merchantId: definition.merchantId,
                ownerType: "REWARD_PRODUCT",
                productId: definition.rewardProductId,
                movementType: "REWARD_RESERVE",
                quantity: 1,
                reason: `Reserved for reward claim #${voucher.id}`,
                eventRef: `reward-reserve-${voucher.id}`,
                memberVoucherId: voucher.id,
                actorId: memberId,
              });
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Insufficient available inventory"
            ) {
              throw new HttpError(409, "VOUCHER_OUT_OF_STOCK");
            }
            throw error;
          }
          const updatedWallet = await tx.loyaltyWallet.findUniqueOrThrow({
            where: { id: wallet.id },
          });
          await tx.pointTransaction.create({
            data: {
              walletId: wallet.id,
              type:
                voucher.snapshotType === "DISCOUNT"
                  ? "REDEEM_DISCOUNT"
                  : "REDEEM_REWARD",
              delta: -voucher.snapshotPointsCost,
              balanceAfter: updatedWallet.exactBalance,
              reason: `Redeemed ${voucher.snapshotTitle}`,
              eventRef: `redeem-voucher-${voucher.id}`,
              source: "MEMBER_REDEMPTION",
              actorId: memberId,
              memberVoucherId: voucher.id,
            },
          });
          await tx.redemptionIdempotency.create({
            data: {
              memberId,
              route,
              idempotencyKey,
              requestHash,
              definitionId,
              voucherId: voucher.id,
            },
          });
          const fullVoucher = await tx.memberVoucher.findUniqueOrThrow({
            where: { id: voucher.id },
            include: {
              membership: true,
              definition: true,
              activeReservation: true,
            },
          });
          return {
            voucher: toMemberVoucherDto(fullVoucher),
            wallet: describeWallet(updatedWallet),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
  async fulfillReward(
    merchantId: number,
    ownerId: number,
    memberVoucherId: number,
    note?: string,
  ): Promise<
    | RewardItemDto
    | "missing"
    | "already_fulfilled"
    | "already_cancelled"
    | "invalid_status"
    | "out_of_stock"
  > {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const voucher = await tx.memberVoucher.findFirst({
            where: {
              id: memberVoucherId,
              membership: { merchantId },
              snapshotType: "REWARD",
            },
            include: {
              membership: { include: { member: { select: { email: true } } } },
              definition: true,
              activeReservation: true,
              fulfillment: true,
              cancellation: true,
            },
          });
          if (!voucher) return "missing";
          if (voucher.status === "FULFILLED") return "already_fulfilled";
          if (voucher.status === "CANCELLED") return "already_cancelled";
          if (
            voucher.status !== "PENDING_FULFILLMENT" &&
            voucher.status !== "AVAILABLE"
          )
            return "invalid_status";
          if (
            voucher.rewardProductIdSnapshot !== null &&
            !voucher.rewardInventoryReserved
          )
            return "out_of_stock";
          const changed = await tx.memberVoucher.updateMany({
            where: {
              id: voucher.id,
              status: { in: ["PENDING_FULFILLMENT", "AVAILABLE"] },
            },
            data: { status: "FULFILLED", rewardInventoryReserved: false },
          });
          if (changed.count !== 1) return "already_fulfilled";
          if (
            voucher.rewardInventoryReserved &&
            voucher.rewardProductIdSnapshot !== null
          ) {
            await moveInventory(tx, {
              merchantId,
              ownerType: "REWARD_PRODUCT",
              productId: voucher.rewardProductIdSnapshot,
              movementType: "REWARD_FULFILL_OUT",
              quantity: 1,
              reason: `Fulfilled reward claim #${voucher.id}`,
              eventRef: `reward-fulfill-${voucher.id}`,
              memberVoucherId: voucher.id,
              actorId: ownerId,
            });
          }
          await tx.rewardFulfillment.create({
            data: {
              voucherId: voucher.id,
              fulfilledById: ownerId,
              note: note ?? null,
            },
          });
          const updated = await tx.memberVoucher.findUniqueOrThrow({
            where: { id: voucher.id },
            include: {
              membership: { include: { member: { select: { email: true } } } },
              definition: true,
              activeReservation: true,
              fulfillment: true,
              cancellation: true,
            },
          });
          return toRewardItemDto(updated);
        },
        { isolationLevel: "Serializable" },
      ),
    );
  },
  async cancelReward(
    merchantId: number,
    ownerId: number,
    memberVoucherId: number,
    reason: string,
  ): Promise<
    | CancelRewardResponseDto
    | "missing"
    | "already_fulfilled"
    | "already_cancelled"
    | "invalid_status"
  > {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const voucher = await tx.memberVoucher.findFirst({
            where: {
              id: memberVoucherId,
              membership: { merchantId },
              snapshotType: "REWARD",
            },
            include: {
              membership: { include: { member: { select: { email: true } } } },
              definition: true,
              activeReservation: true,
              fulfillment: true,
              cancellation: true,
            },
          });
          if (!voucher) return "missing";
          if (voucher.status === "FULFILLED") return "already_fulfilled";
          if (voucher.status === "CANCELLED") return "already_cancelled";
          if (
            voucher.status !== "PENDING_FULFILLMENT" &&
            voucher.status !== "AVAILABLE"
          )
            return "invalid_status";

          const changed = await tx.memberVoucher.updateMany({
            where: {
              id: voucher.id,
              status: { in: ["PENDING_FULFILLMENT", "AVAILABLE"] },
            },
            data: { status: "CANCELLED", rewardInventoryReserved: false },
          });
          if (changed.count !== 1) return "already_cancelled";

          if (
            voucher.rewardInventoryReserved &&
            voucher.rewardProductIdSnapshot !== null
          ) {
            await moveInventory(tx, {
              merchantId,
              ownerType: "REWARD_PRODUCT",
              productId: voucher.rewardProductIdSnapshot,
              movementType: "REWARD_CANCEL_RELEASE",
              quantity: 1,
              reason: `Released for cancelled reward claim #${voucher.id}`,
              eventRef: `reward-cancel-release-${voucher.id}`,
              memberVoucherId: voucher.id,
              actorId: ownerId,
            });
          }

          await tx.rewardCancellation.create({
            data: {
              voucherId: voucher.id,
              cancelledById: ownerId,
              reason,
            },
          });

          const wallet = await tx.loyaltyWallet.findUniqueOrThrow({
            where: { membershipId: voucher.membershipId },
          });

          const pointsRefund = points(voucher.snapshotPointsCost);
          const balanceAfter = points(wallet.exactBalance).plus(pointsRefund);

          const updateWallet = await tx.loyaltyWallet.updateMany({
            where: { id: wallet.id, exactBalance: wallet.exactBalance },
            data: {
              exactBalance: { increment: pointsRefund },
            },
          });
          if (updateWallet.count !== 1) {
            throw Object.assign(new Error("Concurrent wallet update"), {
              code: "P2034",
            });
          }

          await tx.pointTransaction.create({
            data: {
              walletId: wallet.id,
              type: "REDEMPTION_REVERSAL",
              delta: pointsRefund,
              balanceAfter,
              reason,
              eventRef: `reward-cancellation-${voucher.id}`,
              source: "MERCHANT_REWARD_CANCELLATION",
              actorId: ownerId,
              memberVoucherId: voucher.id,
            },
          });

          const [updatedVoucher, updatedWallet] = await Promise.all([
            tx.memberVoucher.findUniqueOrThrow({
              where: { id: voucher.id },
              include: {
                membership: {
                  include: { member: { select: { email: true } } },
                },
                definition: true,
                activeReservation: true,
                fulfillment: true,
                cancellation: true,
              },
            }),
            tx.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } }),
          ]);

          const walletDto = describeWallet(updatedWallet);
          return {
            reward: toRewardItemDto(updatedVoucher),
            wallet: walletDto,
            walletImpact: walletDto,
          };
        },
        { isolationLevel: "Serializable" },
      ),
    );
  },
};
