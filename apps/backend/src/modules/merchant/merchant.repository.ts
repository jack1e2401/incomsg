import { prisma } from "../../lib/prisma.js";
import type { MerchantDto } from "../auth/auth.types.js";

export const merchantRepository = {
  async findActiveStoreById(merchantId: number) {
    return prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
  },

  async findStoreById(merchantId: number) {
    return prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  },

  async listActiveStores() {
    return prisma.merchant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { id: "asc" },
    });
  },

  async findActiveStoreByOwner(ownerId: number): Promise<MerchantDto | null> {
    return prisma.merchant.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true, name: true, slug: true, isActive: true },
    });
  },
};
