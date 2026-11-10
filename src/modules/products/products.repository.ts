import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { ProductInput, ProductPatch } from "./products.types.js";

const productSelection = {
  id: true,
  merchantId: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  status: true,
} as const;

export const productsRepository = {
  async create(merchantId: number, input: ProductInput) {
    return prisma.product.create({
      data: {
        merchantId,
        name: input.name,
        price: new Prisma.Decimal(input.price),
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
      },
      select: productSelection,
    });
  },

  async listByMerchant(merchantId: number, activeOnly: boolean) {
    return prisma.product.findMany({
      where: {
        merchantId,
        ...(activeOnly ? { status: "ACTIVE" as const } : {}),
      },
      select: productSelection,
      orderBy: { id: "asc" },
    });
  },

  async updateOwned(merchantId: number, productId: number, patch: ProductPatch) {
    const result = await prisma.product.updateMany({
      where: { id: productId, merchantId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.price !== undefined ? { price: new Prisma.Decimal(patch.price) } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    });
    if (result.count === 0) return null;

    return prisma.product.findFirst({
      where: { id: productId, merchantId },
      select: productSelection,
    });
  },

  async isMerchantActive(merchantId: number): Promise<boolean> {
    const merchant = await prisma.merchant.findFirst({
      where: { id: merchantId, isActive: true },
      select: { id: true },
    });
    return merchant !== null;
  },

  async findSellableProducts(productIds: number[]) {
    return prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
        merchant: { is: { isActive: true } },
      },
      select: {
        id: true,
        merchantId: true,
        name: true,
        price: true,
      },
    });
  },
};
