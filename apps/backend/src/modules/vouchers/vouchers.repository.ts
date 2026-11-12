import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import type { CancelRewardResponseDto, DefinitionDto, DefinitionInput, DefinitionPatch, MemberVoucherDto, RewardItemDto } from "./vouchers.types.js";
import { snapshotVoucherTerms } from "./vouchers.snapshot.js";
import { describeWallet } from "../loyalty/loyalty.balance.js";
import { points } from "../loyalty/loyalty.calculation.js";

type DefinitionRecord = Prisma.VoucherDefinitionGetPayload<{}>;
type OwnedVoucherRecord = Prisma.MemberVoucherGetPayload<{ include: { membership: true; definition: true; activeReservation: true } }>;
type RewardRecord = Prisma.MemberVoucherGetPayload<{
  include: {
    membership: { include: { member: { select: { email: true } } } };
    definition: true;
    activeReservation: true;
    fulfillment: true;
    cancellation: true;
  };
}>;

function toDefinitionDto(item: DefinitionRecord): DefinitionDto {
  return { id: item.id, merchantId: item.merchantId, type: item.type, title: item.title, pointsCost: item.pointsCost, discountAmount: item.discountAmount?.toFixed(0) ?? null, rewardDescription: item.rewardDescription, rewardProductId: item.rewardProductId, isActive: item.isActive };
}

function toMemberVoucherDto(item: OwnedVoucherRecord): MemberVoucherDto {
  return { id: item.id, definitionId: item.definitionId, merchantId: item.membership.merchantId, memberId: item.membership.memberId, title: item.snapshotTitle, type: item.snapshotType, status: item.status, reserved: item.status === "AVAILABLE" && Boolean(item.activeReservation), pointsCost: item.snapshotPointsCost, discountAmount: item.snapshotDiscountAmount?.toFixed(0) ?? null, rewardDescription: item.snapshotRewardDescription, redeemedAt: item.redeemedAt.toISOString(), usedAt: item.usedAt?.toISOString() ?? null };
}

function toRewardItemDto(item: RewardRecord): RewardItemDto {
  return {
    id: item.id,
    memberVoucherId: item.id,
    definitionId: item.definitionId,
    merchantId: item.membership.merchantId,
    memberId: item.membership.memberId,
    memberEmail: item.membership.member.email,
    title: item.snapshotTitle,
    type: item.snapshotType,
    status: item.status,
    reserved: item.status === "AVAILABLE" && Boolean(item.activeReservation),
    pointsCost: item.snapshotPointsCost,
    discountAmount: item.snapshotDiscountAmount?.toFixed(0) ?? null,
    rewardDescription: item.snapshotRewardDescription,
    redeemedAt: item.redeemedAt.toISOString(),
    requestedAt: item.redeemedAt.toISOString(),
    usedAt: item.usedAt?.toISOString() ?? null,
    fulfilledAt: item.fulfillment?.fulfilledAt?.toISOString() ?? null,
    fulfilledById: item.fulfillment?.fulfilledById ?? null,
    note: item.fulfillment?.note ?? null,
    cancelledAt: item.cancellation?.cancelledAt?.toISOString() ?? null,
    cancelledById: item.cancellation?.cancelledById ?? null,
    cancellationReason: item.cancellation?.reason ?? null,
  };
}

const availableRewardProduct = {
  OR: [{ rewardProductId: null }, { rewardProduct: { is: { kind: "REWARD", status: "ACTIVE" } } }],
} satisfies Prisma.VoucherDefinitionWhereInput;

export const vouchersRepository = {
  async createDefinition(merchantId: number, input: DefinitionInput): Promise<DefinitionDto> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const product = input.rewardProductId === null ? null : await tx.product.findFirst({
        where: { id: input.rewardProductId, merchantId, kind: "REWARD", status: "ACTIVE" },
        select: { name: true },
      });
      if (input.type === "REWARD" && !product) throw new HttpError(404, "REWARD_PRODUCT_NOT_FOUND");
      const definition = await tx.voucherDefinition.create({
        data: {
          merchantId,
          ...input,
          rewardDescription: product?.name ?? input.rewardDescription,
          discountAmount: input.discountAmount === null ? null : new Prisma.Decimal(input.discountAmount),
        },
      });
      return toDefinitionDto(definition);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
  async listDefinitions(merchantId: number, activeOnly: boolean): Promise<DefinitionDto[]> {
    const records = await prisma.voucherDefinition.findMany({ where: { merchantId, ...(activeOnly ? { isActive: true, ...availableRewardProduct } : {}) }, orderBy: { id: "asc" } });
    return records.map(toDefinitionDto);
  },
  async updateDefinition(merchantId: number, id: number, patch: DefinitionPatch): Promise<DefinitionDto | null> {
    const updated = await prisma.voucherDefinition.updateMany({
      where: { id, merchantId },
      data: { ...patch, ...(patch.discountAmount !== undefined ? { discountAmount: patch.discountAmount === null ? null : new Prisma.Decimal(patch.discountAmount) } : {}) },
    });
    if (!updated.count) return null;
    const item = await prisma.voucherDefinition.findUnique({ where: { id } });
    return item ? toDefinitionDto(item) : null;
  },
  async getDefinition(id: number) {
    return prisma.voucherDefinition.findUnique({ where: { id } });
  },
  async listPublicDefinitions(merchantId: number): Promise<DefinitionDto[] | null> {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
    return merchant ? this.listDefinitions(merchantId, true) : null;
  },
  async listOwnedVouchers(memberId: number, merchantId: number): Promise<MemberVoucherDto[] | null> {
    const merchant = await prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
    if (!merchant) return null;
    const records = await prisma.memberVoucher.findMany({ where: { membership: { memberId, merchantId } }, include: { membership: true, definition: true, activeReservation: true }, orderBy: [{ redeemedAt: "desc" }, { id: "desc" }] });
    return records.map(toMemberVoucherDto);
  },
  async redeemVoucher(memberId: number, definitionId: number, idempotencyKey: string) {
    const route = "/api/member/vouchers/:definitionId/redeem";
    const requestHash = createHash("sha256").update(JSON.stringify({ definitionId })).digest("hex");
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const existingIdempotency = await tx.redemptionIdempotency.findUnique({
        where: { memberId_route_idempotencyKey: { memberId, route, idempotencyKey } },
      });
      if (existingIdempotency) {
        if (existingIdempotency.definitionId !== definitionId) {
          throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT");
        }
        const existingVoucher = await tx.memberVoucher.findUniqueOrThrow({
          where: { id: existingIdempotency.voucherId },
          include: { membership: true, definition: true, activeReservation: true },
        });
        const currentWallet = await tx.loyaltyWallet.findUniqueOrThrow({
          where: { membershipId: existingVoucher.membershipId },
        });
        return { voucher: toMemberVoucherDto(existingVoucher), wallet: describeWallet(currentWallet) };
      }

      const definition = await tx.voucherDefinition.findFirst({
        where: { id: definitionId, isActive: true, ...availableRewardProduct },
        include: { merchant: { select: { isActive: true } } },
      });
      if (!definition || !definition.merchant.isActive) throw new HttpError(404, "VOUCHER_DEFINITION_NOT_FOUND");
      const membership = await tx.merchantMembership.upsert({
        where: { memberId_merchantId: { memberId, merchantId: definition.merchantId } },
        create: { memberId, merchantId: definition.merchantId },
        update: {},
      });
      const wallet = await tx.loyaltyWallet.upsert({
        where: { membershipId: membership.id },
        create: { membershipId: membership.id },
        update: {},
      });
      const debit = await tx.loyaltyWallet.updateMany({
        where: { id: wallet.id, exactBalance: { gte: definition.pointsCost } },
        data: { exactBalance: { decrement: definition.pointsCost } },
      });
      if (!debit.count) throw new HttpError(409, "INSUFFICIENT_POINTS");
      const [updatedWallet, voucher] = await Promise.all([
        tx.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } }),
        tx.memberVoucher.create({
          data: {
            membershipId: membership.id,
            definitionId: definition.id,
            status: definition.type === "REWARD" ? "PENDING_FULFILLMENT" : "AVAILABLE",
            ...snapshotVoucherTerms({
              type: definition.type,
              title: definition.title,
              pointsCost: definition.pointsCost,
              discountAmount: definition.discountAmount?.toFixed(0) ?? null,
              rewardDescription: definition.rewardDescription,
            }),
            snapshotDiscountAmount: definition.discountAmount,
          },
        }),
      ]);
      await tx.pointTransaction.create({
        data: {
          walletId: wallet.id,
          type: voucher.snapshotType === "DISCOUNT" ? "REDEEM_DISCOUNT" : "REDEEM_REWARD",
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
        include: { membership: true, definition: true, activeReservation: true },
      });
      return { voucher: toMemberVoucherDto(fullVoucher), wallet: describeWallet(updatedWallet) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
  async listRewardFulfillments(merchantId: number): Promise<RewardItemDto[]> {
    const records = await prisma.memberVoucher.findMany({
      where: {
        membership: { merchantId },
        snapshotType: "REWARD",
        status: { in: ["PENDING_FULFILLMENT", "AVAILABLE", "FULFILLED", "CANCELLED"] },
      },
      include: {
        membership: { include: { member: { select: { email: true } } } },
        definition: true,
        activeReservation: true,
        fulfillment: true,
        cancellation: true,
      },
      orderBy: [{ redeemedAt: "asc" }, { id: "asc" }],
    });
    return records.map(toRewardItemDto);
  },
  async fulfillReward(merchantId: number, ownerId: number, memberVoucherId: number, note?: string): Promise<RewardItemDto | "missing" | "already_fulfilled" | "already_cancelled" | "invalid_status"> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const voucher = await tx.memberVoucher.findFirst({
        where: { id: memberVoucherId, membership: { merchantId }, snapshotType: "REWARD" },
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
      if (voucher.status !== "PENDING_FULFILLMENT" && voucher.status !== "AVAILABLE") return "invalid_status";
      const changed = await tx.memberVoucher.updateMany({
        where: { id: voucher.id, status: { in: ["PENDING_FULFILLMENT", "AVAILABLE"] } },
        data: { status: "FULFILLED" },
      });
      if (changed.count !== 1) return "already_fulfilled";
      await tx.rewardFulfillment.create({ data: { voucherId: voucher.id, fulfilledById: ownerId, note: note ?? null } });
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
    }, { isolationLevel: "Serializable" }));
  },
  async cancelReward(
    merchantId: number,
    ownerId: number,
    memberVoucherId: number,
    reason: string,
  ): Promise<CancelRewardResponseDto | "missing" | "already_fulfilled" | "already_cancelled" | "invalid_status"> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const voucher = await tx.memberVoucher.findFirst({
        where: { id: memberVoucherId, membership: { merchantId }, snapshotType: "REWARD" },
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
      if (voucher.status !== "PENDING_FULFILLMENT" && voucher.status !== "AVAILABLE") return "invalid_status";

      const changed = await tx.memberVoucher.updateMany({
        where: { id: voucher.id, status: { in: ["PENDING_FULFILLMENT", "AVAILABLE"] } },
        data: { status: "CANCELLED" },
      });
      if (changed.count !== 1) return "already_cancelled";

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
        throw Object.assign(new Error("Concurrent wallet update"), { code: "P2034" });
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
            membership: { include: { member: { select: { email: true } } } },
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
    }, { isolationLevel: "Serializable" }));
  },
};
