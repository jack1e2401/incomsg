import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import type { DefinitionDto, DefinitionInput, DefinitionPatch, MemberVoucherDto } from "./vouchers.types.js";
import { snapshotVoucherTerms } from "./vouchers.snapshot.js";

type DefinitionRecord = Prisma.VoucherDefinitionGetPayload<{}>;
type OwnedVoucherRecord = Prisma.MemberVoucherGetPayload<{ include: { membership: true; definition: true } }>;
function toDefinitionDto(item: DefinitionRecord): DefinitionDto {
  return { id: item.id, merchantId: item.merchantId, type: item.type, title: item.title, pointsCost: item.pointsCost, discountAmount: item.discountAmount?.toFixed(0) ?? null, rewardDescription: item.rewardDescription, isActive: item.isActive };
}
function toMemberVoucherDto(item: OwnedVoucherRecord): MemberVoucherDto {
  return { id: item.id, definitionId: item.definitionId, merchantId: item.membership.merchantId, memberId: item.membership.memberId, title: item.snapshotTitle, type: item.snapshotType, status: item.status, pointsCost: item.snapshotPointsCost, discountAmount: item.snapshotDiscountAmount?.toFixed(0) ?? null, rewardDescription: item.snapshotRewardDescription, redeemedAt: item.redeemedAt.toISOString(), usedAt: item.usedAt?.toISOString() ?? null };
}

export const vouchersRepository = {
  async createDefinition(merchantId: number, input: DefinitionInput): Promise<DefinitionDto> {
    return toDefinitionDto(await prisma.voucherDefinition.create({ data: { merchantId, ...input, discountAmount: input.discountAmount === null ? null : new Prisma.Decimal(input.discountAmount) } }));
  },
  async listDefinitions(merchantId: number, activeOnly: boolean): Promise<DefinitionDto[]> {
    const records = await prisma.voucherDefinition.findMany({ where: { merchantId, ...(activeOnly ? { isActive: true } : {}) }, orderBy: { id: "asc" } });
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
    const records = await prisma.memberVoucher.findMany({ where: { membership: { memberId, merchantId } }, include: { membership: true, definition: true }, orderBy: [{ redeemedAt: "desc" }, { id: "desc" }] });
    return records.map(toMemberVoucherDto);
  },
  async redeemVoucher(memberId: number, definitionId: number) {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const definition = await tx.voucherDefinition.findFirst({ where: { id: definitionId, isActive: true }, include: { merchant: { select: { isActive: true } } } });
      if (!definition || !definition.merchant.isActive) throw new HttpError(404, "VOUCHER_DEFINITION_NOT_FOUND");
      const membership = await tx.merchantMembership.upsert({
        where: { memberId_merchantId: { memberId, merchantId: definition.merchantId } },
        create: { memberId, merchantId: definition.merchantId },
        update: {},
      });
      const wallet = await tx.loyaltyWallet.upsert({ where: { membershipId: membership.id }, create: { membershipId: membership.id }, update: {} });
      const debit = await tx.loyaltyWallet.updateMany({
        where: { id: wallet.id, availablePoints: { gte: definition.pointsCost } },
        data: { availablePoints: { decrement: definition.pointsCost } },
      });
      if (!debit.count) throw new HttpError(409, "INSUFFICIENT_POINTS");
      const [updatedWallet, voucher] = await Promise.all([
        tx.loyaltyWallet.findUniqueOrThrow({ where: { id: wallet.id } }),
        tx.memberVoucher.create({ data: {
          membershipId: membership.id,
          definitionId: definition.id,
          ...snapshotVoucherTerms({
            type: definition.type,
            title: definition.title,
            pointsCost: definition.pointsCost,
            discountAmount: definition.discountAmount?.toFixed(0) ?? null,
            rewardDescription: definition.rewardDescription,
          }),
          snapshotDiscountAmount: definition.discountAmount,
        } }),
      ]);
      await tx.pointTransaction.create({ data: {
        walletId: wallet.id,
        type: voucher.snapshotType === "DISCOUNT" ? "REDEEM_DISCOUNT" : "REDEEM_REWARD",
        delta: -voucher.snapshotPointsCost,
        balanceAfter: updatedWallet.availablePoints,
        reason: `Redeemed ${voucher.snapshotTitle}`,
        memberVoucherId: voucher.id,
      } });
      const fullVoucher = await tx.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id }, include: { membership: true, definition: true } });
      return { voucher: toMemberVoucherDto(fullVoucher), wallet: { availablePoints: updatedWallet.availablePoints, lifetimeEarnedPoints: updatedWallet.lifetimeEarnedPoints } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
  async listRewardFulfillments(merchantId: number): Promise<MemberVoucherDto[]> {
    const records = await prisma.memberVoucher.findMany({
      where: { membership: { merchantId }, snapshotType: "REWARD", status: "AVAILABLE" },
      include: { membership: true, definition: true },
      orderBy: [{ redeemedAt: "asc" }, { id: "asc" }],
    });
    return records.map(toMemberVoucherDto);
  },
  async fulfillReward(merchantId: number, ownerId: number, memberVoucherId: number, note?: string): Promise<MemberVoucherDto | "missing" | "already_fulfilled"> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const voucher = await tx.memberVoucher.findFirst({
        where: { id: memberVoucherId, membership: { merchantId }, snapshotType: "REWARD" },
        include: { membership: true, definition: true },
      });
      if (!voucher) return "missing";
      if (voucher.status !== "AVAILABLE") return "already_fulfilled";
      const changed = await tx.memberVoucher.updateMany({ where: { id: voucher.id, status: "AVAILABLE" }, data: { status: "FULFILLED" } });
      if (changed.count !== 1) return "already_fulfilled";
      await tx.rewardFulfillment.create({ data: { voucherId: voucher.id, fulfilledById: ownerId, note: note ?? null } });
      const updated = await tx.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id }, include: { membership: true, definition: true } });
      return toMemberVoucherDto(updated);
    }, { isolationLevel: "Serializable" }));
  },
};
