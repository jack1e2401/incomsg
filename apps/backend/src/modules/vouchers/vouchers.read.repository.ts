import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type {
  DefinitionDto,
  MemberVoucherDto,
  RewardItemDto,
} from "./vouchers.types.js";

type DefinitionRecord = Prisma.VoucherDefinitionGetPayload<{
  include: {
    inventoryBalance: true;
    rewardProduct: { include: { inventoryBalance: true } };
  };
}>;
type OwnedVoucherRecord = Prisma.MemberVoucherGetPayload<{
  include: { membership: true; definition: true; activeReservation: true };
}>;
type RewardRecord = Prisma.MemberVoucherGetPayload<{
  include: {
    membership: { include: { member: { select: { email: true } } } };
    definition: true;
    activeReservation: true;
    fulfillment: true;
    cancellation: true;
  };
}>;

export function toDefinitionDto(
  item: DefinitionRecord,
  issuedQuantity = 0,
): DefinitionDto {
  const stock =
    item.type === "DISCOUNT"
      ? item.inventoryBalance
      : item.rewardProduct?.inventoryBalance;
  return {
    id: item.id,
    merchantId: item.merchantId,
    type: item.type,
    title: item.title,
    pointsCost: item.pointsCost,
    discountAmount: item.discountAmount?.toFixed(0) ?? null,
    rewardDescription: item.rewardDescription,
    rewardProductId: item.rewardProductId,
    isActive: item.isActive,
    availableQuantity: stock
      ? stock.onHandQuantity - stock.reservedQuantity
      : 0,
    issuedQuantity: item.type === "DISCOUNT" ? issuedQuantity : null,
  };
}

export function toMemberVoucherDto(item: OwnedVoucherRecord): MemberVoucherDto {
  return {
    id: item.id,
    definitionId: item.definitionId,
    merchantId: item.membership.merchantId,
    memberId: item.membership.memberId,
    title: item.snapshotTitle,
    type: item.snapshotType,
    status: item.status,
    reserved: item.status === "AVAILABLE" && Boolean(item.activeReservation),
    pointsCost: item.snapshotPointsCost,
    discountAmount: item.snapshotDiscountAmount?.toFixed(0) ?? null,
    rewardDescription: item.snapshotRewardDescription,
    redeemedAt: item.redeemedAt.toISOString(),
    usedAt: item.usedAt?.toISOString() ?? null,
  };
}

export function toRewardItemDto(item: RewardRecord): RewardItemDto {
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

export const availableRewardProduct = {
  OR: [
    { type: "DISCOUNT" },
    { rewardProductId: null },
    { rewardProduct: { is: { kind: "REWARD", status: "ACTIVE" } } },
  ],
} satisfies Prisma.VoucherDefinitionWhereInput;

export const definitionInclude = {
  inventoryBalance: true,
  rewardProduct: { include: { inventoryBalance: true } },
} as const;

export async function definitionDtos(
  merchantId: number,
  activeOnly: boolean,
): Promise<DefinitionDto[]> {
  const records = await prisma.voucherDefinition.findMany({
    where: {
      merchantId,
      ...(activeOnly ? { isActive: true, ...availableRewardProduct } : {}),
    },
    include: definitionInclude,
    orderBy: { id: "asc" },
  });
  const ids = records
    .filter((item) => item.type === "DISCOUNT")
    .map((item) => item.id);
  const issued = ids.length
    ? await prisma.inventoryMovement.groupBy({
        by: ["voucherDefinitionId"],
        where: {
          voucherDefinitionId: { in: ids },
          movementType: "VOUCHER_REDEMPTION_OUT",
        },
        _sum: { quantityDelta: true },
      })
    : [];
  const countById = new Map(
    issued.map((item) => [
      item.voucherDefinitionId,
      Math.abs(item._sum.quantityDelta ?? 0),
    ]),
  );
  return records.map((item) =>
    toDefinitionDto(item, countById.get(item.id) ?? 0),
  );
}

export const voucherReadRepository = {
  async listDefinitions(
    merchantId: number,
    activeOnly: boolean,
  ): Promise<DefinitionDto[]> {
    return definitionDtos(merchantId, activeOnly);
  },
  async getDefinition(id: number) {
    return prisma.voucherDefinition.findUnique({ where: { id } });
  },
  async listPublicDefinitions(
    merchantId: number,
  ): Promise<DefinitionDto[] | null> {
    const merchant = await prisma.merchant.findFirst({
      where: { id: merchantId, isActive: true },
      select: { id: true },
    });
    return merchant ? definitionDtos(merchantId, true) : null;
  },
  async listOwnedVouchers(
    memberId: number,
    merchantId: number,
  ): Promise<MemberVoucherDto[] | null> {
    const merchant = await prisma.merchant.findFirst({
      where: { id: merchantId, isActive: true },
      select: { id: true },
    });
    if (!merchant) return null;
    const records = await prisma.memberVoucher.findMany({
      where: { membership: { memberId, merchantId } },
      include: { membership: true, definition: true, activeReservation: true },
      orderBy: [{ redeemedAt: "desc" }, { id: "desc" }],
    });
    return records.map(toMemberVoucherDto);
  },
  async listRewardFulfillments(merchantId: number): Promise<RewardItemDto[]> {
    const records = await prisma.memberVoucher.findMany({
      where: {
        membership: { merchantId },
        snapshotType: "REWARD",
        status: {
          in: ["PENDING_FULFILLMENT", "AVAILABLE", "FULFILLED", "CANCELLED"],
        },
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
};
