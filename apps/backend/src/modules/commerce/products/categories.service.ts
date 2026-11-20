import { HttpError } from "../../../lib/http-error.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { categoriesRepository } from "./categories.repository.js";
import type { ProductCategoryDto, ProductCategoryInput, ProductCategoryPatch } from "./categories.types.js";

export const categoriesService = {
  async listOwnCategories(ownerId: number): Promise<ProductCategoryDto[]> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return categoriesRepository.listByMerchant(merchant.id);
  },

  async createCategory(ownerId: number, input: ProductCategoryInput): Promise<ProductCategoryDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return categoriesRepository.create(merchant.id, input);
  },

  async updateCategory(
    ownerId: number,
    categoryId: number,
    patch: ProductCategoryPatch,
  ): Promise<ProductCategoryDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const updated = await categoriesRepository.updateOwned(merchant.id, categoryId, patch);
    if (!updated) {
      throw new HttpError(404, "CATEGORY_NOT_FOUND");
    }
    return updated;
  },

  async deleteCategory(ownerId: number, categoryId: number): Promise<{ deleted: true }> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const deleted = await categoriesRepository.deleteOwned(merchant.id, categoryId);
    if (!deleted) {
      throw new HttpError(404, "CATEGORY_NOT_FOUND");
    }
    return { deleted: true };
  },
};
