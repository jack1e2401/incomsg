import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
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
};
