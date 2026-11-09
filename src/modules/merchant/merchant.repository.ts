import { prisma } from "../../lib/prisma.js";
import type { MerchantDto } from "../auth/auth.types.js";

export const merchantRepository = {
  async findActiveStoreByOwner(ownerId: number): Promise<MerchantDto | null> {
    return prisma.merchant.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true, name: true, slug: true, isActive: true },
    });
  },
};
