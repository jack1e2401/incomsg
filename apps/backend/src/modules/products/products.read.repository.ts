import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

export const productSelection = {
  id: true,
  merchantId: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true } },
  sku: true,
  name: true,
  description: true,
  richDescription: true,
  imageUrl: true,
  images: {
    select: { id: true, url: true, altText: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
  lowStockThreshold: true,
  price: true,
  kind: true,
  status: true,
  inventoryBalance: {
    select: { onHandQuantity: true, reservedQuantity: true },
  },
} satisfies Prisma.ProductSelect;

export type SelectedProduct = Prisma.ProductGetPayload<{
  select: typeof productSelection;
}>;

export const sellableProductFilter = {
  kind: "SALE",
  status: "ACTIVE",
} as const;

export const productReadRepository = {
  async findPublicProductById(
    merchantId: number,
    productId: number,
  ): Promise<SelectedProduct | null> {
    return prisma.product.findFirst({
      where: {
        id: productId,
        merchantId,
        ...sellableProductFilter,
      },
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

  async findActiveStoreBySlug(slug: string) {
    return prisma.merchant.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
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
