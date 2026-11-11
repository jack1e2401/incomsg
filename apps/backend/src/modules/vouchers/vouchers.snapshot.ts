import type { VoucherType } from "../../generated/prisma/enums.js";

export function snapshotVoucherTerms(definition: {
  type: VoucherType;
  title: string;
  pointsCost: number;
  discountAmount: string | null;
  rewardDescription: string | null;
}) {
  return {
    snapshotType: definition.type,
    snapshotTitle: definition.title,
    snapshotPointsCost: definition.pointsCost,
    snapshotDiscountAmount: definition.discountAmount,
    snapshotRewardDescription: definition.rewardDescription,
  };
}
