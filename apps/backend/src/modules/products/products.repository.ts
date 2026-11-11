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
  kind: true,
  status: true,
} as const;

const sellableProductFilter = { kind: "SALE", status: "ACTIVE" } as const;

export const productsRepository = {
  async create(merchantId: number, input: ProductInput) {
    return prisma.product.create({
      data: {
        merchantId,
        name: input.name,
        kind: input.kind,
        price: new Prisma.Decimal(input.kind === "REWARD" ? "0" : input.price),
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
      },
      select: productSelection,
    });
  },

  async listByMerchant(merchantId: number, sellableOnly: boolean) {
    return prisma.product.findMany({
      where: {
        merchantId,
        ...(sellableOnly ? sellableProductFilter : {}),
      },
      select: productSelection,
      orderBy: { id: "asc" },
    });
  },

  async updateOwned(merchantId: number, productId: number, patch: ProductPatch) {
    const result = await prisma.product.updateMany({
      where: {
        id: productId,
        merchantId,
        ...(patch.price !== undefined ? { kind: "SALE" as const } : {}),
      },
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

  async findOwnedKind(merchantId: number, productId: number) {
    const product = await prisma.product.findFirst({
      where: { id: productId, merchantId },
      select: { kind: true },
    });
    return product?.kind ?? null;
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
        ...sellableProductFilter,
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
