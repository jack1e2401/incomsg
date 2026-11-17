import { prisma } from "../../lib/prisma.js";
import type {
  StorefrontCategoryDto,
  StorefrontEventDto,
  StorefrontProductDto,
} from "./storefront.types.js";

export const storefrontPublicRepository = {
  async loadDynamicStorefrontData(
    merchantId: number,
    featuredProductIds: number[],
  ): Promise<{
    featuredProducts: StorefrontProductDto[];
    categories: StorefrontCategoryDto[];
    upcomingEvents: StorefrontEventDto[];
  }> {
    const now = new Date();
    const [products, categories, events] = await Promise.all([
      featuredProductIds.length > 0
        ? prisma.product.findMany({
            where: {
              id: { in: featuredProductIds },
              merchantId,
              kind: "SALE",
              status: "ACTIVE",
            },
            select: {
              id: true,
              merchantId: true,
              categoryId: true,
              category: { select: { id: true, name: true, slug: true } },
              sku: true,
              name: true,
              description: true,
              imageUrl: true,
              kind: true,
              status: true,
              price: true,
              inventoryBalance: {
                select: { onHandQuantity: true, reservedQuantity: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.productCategory.findMany({
        where: { merchantId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          merchantId: true,
          name: true,
          slug: true,
          description: true,
          sortOrder: true,
        },
      }),
      prisma.merchantEvent.findMany({
        where: {
          merchantId,
          status: "PUBLISHED",
          endAt: { gte: now },
        },
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
        take: 6,
        select: {
          id: true,
          merchantId: true,
          title: true,
          slug: true,
          description: true,
          bannerUrl: true,
          startAt: true,
          endAt: true,
          locationName: true,
          locationAddress: true,
          status: true,
          publishedAt: true,
        },
      }),
    ]);

    const productById = new Map(
      products.map((product) => [
        product.id,
        {
          id: product.id,
          merchantId: product.merchantId,
          categoryId: product.categoryId,
          category: product.category,
          sku: product.sku,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          kind: product.kind,
          status: product.status,
          price: product.price.toFixed(0),
          inventory: {
            availableQuantity: product.inventoryBalance
              ? product.inventoryBalance.onHandQuantity -
                product.inventoryBalance.reservedQuantity
              : 0,
          },
        } satisfies StorefrontProductDto,
      ]),
    );

    const orderedProducts = featuredProductIds
      .map((id) => productById.get(id))
      .filter(
        (product): product is StorefrontProductDto => product !== undefined,
      );

    return {
      featuredProducts: orderedProducts,
      categories,
      upcomingEvents: events.map((event) => ({
        ...event,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
      })),
    };
  },
};
