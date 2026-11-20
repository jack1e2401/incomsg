import { HttpError } from "../../../lib/http-error.js";
import { toInventorySummary } from "../inventory/inventory.persistence.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { categoriesRepository } from "./categories.repository.js";
import { productsRepository, type SelectedProduct } from "./products.repository.js";
import type {
  MerchantProductListQuery,
  PaginatedProductsDto,
  ProductDto,
  ProductInput,
  ProductPatch,
  PublicProductListQuery,
  PublicStoreProductsDto,
} from "./products.types.js";

function toProductDto(product: SelectedProduct, merchantView = false): ProductDto {
  const availableQuantity = product.inventoryBalance
    ? product.inventoryBalance.onHandQuantity - product.inventoryBalance.reservedQuantity
    : 0;

  return {
    id: product.id,
    merchantId: product.merchantId,
    categoryId: product.categoryId,
    category: product.category,
    sku: product.sku,
    name: product.name,
    description: product.description,
    richDescription: product.richDescription,
    imageUrl: product.imageUrl ?? product.images[0]?.url ?? null,
    images: product.images,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: availableQuantity <= product.lowStockThreshold,
    kind: product.kind,
    price: product.price.toFixed(0),
    status: product.status,
    inventory: {
      availableQuantity,
      ...(merchantView && product.inventoryBalance ? toInventorySummary(product.inventoryBalance) : {}),
    },
  };
}

function buildPagination(page: number, limit: number, totalItems: number) {
  return {
    page,
    limit,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit),
  };
}

export const productsService = {
  async createProduct(ownerId: number, input: ProductInput): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return toProductDto(await productsRepository.create(merchant.id, ownerId, input), true);
  },

  async listOwnProducts(
    ownerId: number,
    query: MerchantProductListQuery,
  ): Promise<PaginatedProductsDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const { rows, totalItems } = await productsRepository.listPaginated(merchant.id, false, query);
    return {
      items: rows.map((product) => toProductDto(product, true)),
      pagination: buildPagination(query.page, query.limit, totalItems),
    };
  },

  async updateProduct(ownerId: number, productId: number, patch: ProductPatch): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const product = await productsRepository.updateOwned(merchant.id, productId, patch);
    if (!product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND");
    }
    return toProductDto(product, true);
  },

  async listPublicProducts(
    merchantId: number,
    query: PublicProductListQuery,
  ): Promise<PaginatedProductsDto> {
    if (!(await productsRepository.isMerchantActive(merchantId))) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const { rows, totalItems } = await productsRepository.listPaginated(merchantId, true, query);
    return {
      items: rows.map((product) => toProductDto(product)),
      pagination: buildPagination(query.page, query.limit, totalItems),
    };
  },

  async listPublicStoreProducts(
    slug: string,
    query: PublicProductListQuery,
  ): Promise<PublicStoreProductsDto> {
    const merchant = await productsRepository.findActiveStoreBySlug(slug);
    if (!merchant) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const [{ rows, totalItems }, categories] = await Promise.all([
      productsRepository.listPaginated(merchant.id, true, query),
      categoriesRepository.listByMerchant(merchant.id),
    ]);
    return {
      items: rows.map((product) => toProductDto(product)),
      categories,
      pagination: buildPagination(query.page, query.limit, totalItems),
    };
  },

  async getPublicStoreProduct(slug: string, productId: number): Promise<ProductDto> {
    const merchant = await productsRepository.findActiveStoreBySlug(slug);
    if (!merchant) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const product = await productsRepository.findPublicProductById(merchant.id, productId);
    if (!product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND");
    }
    return toProductDto(product);
  },
};
