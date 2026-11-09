import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import type { DefinitionDto, DefinitionInput, DefinitionPatch, MemberVoucherDto } from "./vouchers.types.js";

type DefinitionRecord = Prisma.VoucherDefinitionGetPayload<{}>;
type OwnedVoucherRecord = Prisma.MemberVoucherGetPayload<{ include: { membership: true; definition: true } }>;
function toDefinitionDto(item: DefinitionRecord): DefinitionDto {
  return { id: item.id, merchantId: item.merchantId, type: item.type, title: item.title, pointsCost: item.pointsCost, discountAmount: item.discountAmount?.toFixed(0) ?? null, rewardDescription: item.rewardDescription, isActive: item.isActive };
}
function toMemberVoucherDto(item: OwnedVoucherRecord): MemberVoucherDto {
  return { id: item.id, definitionId: item.definitionId, merchantId: item.membership.merchantId, memberId: item.membership.memberId, title: item.definition.title, type: item.definition.type, status: item.status, pointsCost: item.definition.pointsCost, discountAmount: item.definition.discountAmount?.toFixed(0) ?? null, rewardDescription: item.definition.rewardDescription, redeemedAt: item.redeemedAt.toISOString(), usedAt: item.usedAt?.toISOString() ?? null };
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
        tx.memberVoucher.create({ data: { membershipId: membership.id, definitionId: definition.id } }),
      ]);
      await tx.pointTransaction.create({ data: {
        walletId: wallet.id,
        type: definition.type === "DISCOUNT" ? "REDEEM_DISCOUNT" : "REDEEM_REWARD",
        delta: -definition.pointsCost,
        balanceAfter: updatedWallet.availablePoints,
        reason: `Redeemed ${definition.title}`,
        memberVoucherId: voucher.id,
      } });
      const fullVoucher = await tx.memberVoucher.findUniqueOrThrow({ where: { id: voucher.id }, include: { membership: true, definition: true } });
      return { voucher: toMemberVoucherDto(fullVoucher), wallet: { availablePoints: updatedWallet.availablePoints, lifetimeEarnedPoints: updatedWallet.lifetimeEarnedPoints } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
};
