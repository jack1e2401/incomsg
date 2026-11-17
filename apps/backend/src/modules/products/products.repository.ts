import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { createInventoryBalance } from "../inventory/inventory.persistence.js";
import { withTransactionRetry } from "../loyalty/loyalty.transaction.js";
import {
  productReadRepository,
  productSelection,
  sellableProductFilter,
  type SelectedProduct,
} from "./products.read.repository.js";
import type {
  MerchantProductListQuery,
  ProductInput,
  ProductPatch,
  ProductSortOption,
  PublicProductListQuery,
} from "./products.types.js";

export type { SelectedProduct } from "./products.read.repository.js";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function buildOrderBy(
  sort: ProductSortOption,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "name_asc":
      return [{ name: "asc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

async function assertCategoryOwned(
  tx: Prisma.TransactionClient,
  merchantId: number,
  categoryId: number,
): Promise<void> {
  const category = await tx.productCategory.findFirst({
    where: { id: categoryId, merchantId },
    select: { id: true },
  });
  if (!category) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND");
  }
}

async function syncImagesOnUpdate(
  tx: Prisma.TransactionClient,
  merchantId: number,
  productId: number,
  patch: ProductPatch,
): Promise<void> {
  if (patch.images !== undefined) {
    await tx.productImage.deleteMany({ where: { productId, merchantId } });
    if (patch.images.length > 0) {
      await tx.productImage.createMany({
        data: patch.images.map((image) => ({
          merchantId,
          productId,
          url: image.url,
          altText: image.altText,
          sortOrder: image.sortOrder,
        })),
      });
    }
    return;
  }

  if (patch.imageUrl !== undefined) {
    if (patch.imageUrl === null) {
      await tx.productImage.deleteMany({ where: { productId, merchantId } });
      return;
    }
    const existingFirst = await tx.productImage.findFirst({
      where: { productId, merchantId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (existingFirst) {
      await tx.productImage.update({
        where: { id: existingFirst.id },
        data: { url: patch.imageUrl },
      });
    } else {
      await tx.productImage.create({
        data: {
          merchantId,
          productId,
          url: patch.imageUrl,
          altText: null,
          sortOrder: 0,
        },
      });
    }
  }
}

export const productsRepository = {
  ...productReadRepository,
  async create(
    merchantId: number,
    actorId: number,
    input: ProductInput,
  ): Promise<SelectedProduct> {
    return withTransactionRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (typeof input.categoryId === "number") {
            await assertCategoryOwned(tx, merchantId, input.categoryId);
          }

          const primaryImageUrl =
            input.images !== undefined
              ? (input.images[0]?.url ?? null)
              : (input.imageUrl ?? null);

          let product: { id: number };
          try {
            product = await tx.product.create({
              data: {
                merchantId,
                categoryId: input.categoryId ?? null,
                sku: input.sku ?? null,
                name: input.name,
                kind: input.kind,
                price: new Prisma.Decimal(
                  input.kind === "REWARD" ? "0" : input.price,
                ),
                description: input.description ?? null,
                richDescription: input.richDescription ?? null,
                imageUrl: primaryImageUrl,
                lowStockThreshold: input.lowStockThreshold ?? 5,
              },
              select: { id: true },
            });
          } catch (error) {
            if (isUniqueViolation(error)) {
              throw new HttpError(409, "SKU_ALREADY_EXISTS");
            }
            throw error;
          }

          if (input.images !== undefined) {
            if (input.images.length > 0) {
              await tx.productImage.createMany({
                data: input.images.map((image) => ({
                  merchantId,
                  productId: product.id,
                  url: image.url,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                })),
              });
            }
          } else if (primaryImageUrl) {
            await tx.productImage.create({
              data: {
                merchantId,
                productId: product.id,
                url: primaryImageUrl,
                altText: null,
                sortOrder: 0,
              },
            });
          }

          await createInventoryBalance(
            tx,
            {
              merchantId,
              ownerType:
                input.kind === "REWARD" ? "REWARD_PRODUCT" : "SALE_PRODUCT",
              productId: product.id,
            },
            input.initialQuantity ?? 0,
            actorId,
          );

          return tx.product.findUniqueOrThrow({
            where: { id: product.id },
            select: productSelection,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },

  async listPaginated(
    merchantId: number,
    sellableOnly: boolean,
    query: MerchantProductListQuery | PublicProductListQuery,
  ): Promise<{ rows: SelectedProduct[]; totalItems: number }> {
    const merchantQuery = !sellableOnly
      ? (query as MerchantProductListQuery)
      : undefined;
    const where: Prisma.ProductWhereInput = {
      merchantId,
      ...(sellableOnly ? sellableProductFilter : {}),
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(merchantQuery?.status !== undefined
        ? { status: merchantQuery.status }
        : {}),
      ...(merchantQuery?.kind !== undefined
        ? { kind: merchantQuery.kind }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { sku: { contains: query.q } },
            ],
          }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort);
    const skip = (query.page - 1) * query.limit;

    if (merchantQuery?.lowStock) {
      const candidates = await prisma.product.findMany({
        where,
        orderBy,
        select: {
          id: true,
          lowStockThreshold: true,
          inventoryBalance: {
            select: { onHandQuantity: true, reservedQuantity: true },
          },
        },
      });
      const lowStockIds = candidates
        .filter((item) => {
          const available = item.inventoryBalance
            ? item.inventoryBalance.onHandQuantity -
              item.inventoryBalance.reservedQuantity
            : 0;
          return available <= item.lowStockThreshold;
        })
        .map((item) => item.id);

      const pageIds = lowStockIds.slice(skip, skip + query.limit);
      if (pageIds.length === 0) {
        return { rows: [], totalItems: lowStockIds.length };
      }

      const fetched = await prisma.product.findMany({
        where: { id: { in: pageIds } },
        select: productSelection,
      });
      const byId = new Map(fetched.map((row) => [row.id, row]));
      const ordered = pageIds
        .map((id) => byId.get(id))
        .filter((row): row is SelectedProduct => Boolean(row));
      return { rows: ordered, totalItems: lowStockIds.length };
    }

    const [totalItems, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: productSelection,
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);
    return { rows, totalItems };
  },

  async updateOwned(
    merchantId: number,
    productId: number,
    patch: ProductPatch,
  ): Promise<SelectedProduct | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, merchantId },
        select: { id: true, kind: true },
      });
      if (!existing) return null;
      if (patch.price !== undefined && existing.kind === "REWARD") {
        throw new HttpError(400, "INVALID_INPUT");
      }
      if (typeof patch.categoryId === "number") {
        await assertCategoryOwned(tx, merchantId, patch.categoryId);
      }

      const primaryImageUrl =
        patch.images !== undefined
          ? (patch.images[0]?.url ?? null)
          : patch.imageUrl;

      try {
        await tx.product.update({
          where: { id: productId },
          data: {
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.price !== undefined
              ? { price: new Prisma.Decimal(patch.price) }
              : {}),
            ...(patch.description !== undefined
              ? { description: patch.description }
              : {}),
            ...(patch.richDescription !== undefined
              ? { richDescription: patch.richDescription }
              : {}),
            ...(primaryImageUrl !== undefined
              ? { imageUrl: primaryImageUrl }
              : {}),
            ...(patch.sku !== undefined ? { sku: patch.sku } : {}),
            ...(patch.categoryId !== undefined
              ? { categoryId: patch.categoryId }
              : {}),
            ...(patch.lowStockThreshold !== undefined
              ? { lowStockThreshold: patch.lowStockThreshold }
              : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HttpError(409, "SKU_ALREADY_EXISTS");
        }
        throw error;
      }

      await syncImagesOnUpdate(tx, merchantId, productId, patch);

      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: productSelection,
      });
    });
  },
};
