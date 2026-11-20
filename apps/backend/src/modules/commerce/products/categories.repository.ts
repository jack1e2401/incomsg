import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";
import { prisma } from "../../../lib/prisma.js";
import type { ProductCategoryDto, ProductCategoryInput, ProductCategoryPatch } from "./categories.types.js";

const categorySelection = {
  id: true,
  merchantId: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const categoriesRepository = {
  async listByMerchant(merchantId: number): Promise<ProductCategoryDto[]> {
    return prisma.productCategory.findMany({
      where: { merchantId },
      select: categorySelection,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  },

  async findOwned(merchantId: number, categoryId: number): Promise<ProductCategoryDto | null> {
    return prisma.productCategory.findFirst({
      where: { id: categoryId, merchantId },
      select: categorySelection,
    });
  },

  async create(merchantId: number, input: ProductCategoryInput): Promise<ProductCategoryDto> {
    try {
      return await prisma.productCategory.create({
        data: {
          merchantId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
        },
        select: categorySelection,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "CATEGORY_ALREADY_EXISTS");
      }
      throw error;
    }
  },

  async updateOwned(
    merchantId: number,
    categoryId: number,
    patch: ProductCategoryPatch,
  ): Promise<ProductCategoryDto | null> {
    const existing = await prisma.productCategory.findFirst({
      where: { id: categoryId, merchantId },
      select: { id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.productCategory.update({
        where: { id: categoryId },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        },
        select: categorySelection,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "CATEGORY_ALREADY_EXISTS");
      }
      throw error;
    }
  },

  async deleteOwned(merchantId: number, categoryId: number): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productCategory.findFirst({
        where: { id: categoryId, merchantId },
        select: { id: true },
      });
      if (!existing) return false;

      await tx.product.updateMany({
        where: { merchantId, categoryId },
        data: { categoryId: null },
      });
      await tx.productCategory.delete({
        where: { id: categoryId },
      });
      return true;
    });
  },
};
