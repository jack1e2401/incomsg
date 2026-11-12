import { HttpError } from "../../lib/http-error.js";
import { merchantService } from "../merchant/merchant.service.js";
import { productsRepository } from "./products.repository.js";
import type { ProductDto, ProductInput, ProductPatch } from "./products.types.js";
import { toInventorySummary } from "../inventory/inventory.persistence.js";

function toProductDto(product: Awaited<ReturnType<typeof productsRepository.create>>, merchantView = false): ProductDto {
  return {
    id: product.id,
    merchantId: product.merchantId,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    kind: product.kind,
    status: product.status,
    price: product.price.toFixed(0),
    inventory: {
      availableQuantity: product.inventoryBalance ? product.inventoryBalance.onHandQuantity - product.inventoryBalance.reservedQuantity : 0,
      ...(merchantView && product.inventoryBalance ? toInventorySummary(product.inventoryBalance) : {}),
    },
  };
}

export const productsService = {
  async createProduct(ownerId: number, input: ProductInput): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return toProductDto(await productsRepository.create(merchant.id, ownerId, input), true);
  },

  async listOwnProducts(ownerId: number): Promise<ProductDto[]> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const products = await productsRepository.listByMerchant(merchant.id, false);
    return products.map((product) => toProductDto(product, true));
  },

  async updateProduct(ownerId: number, productId: number, patch: ProductPatch): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const product = await productsRepository.updateOwned(merchant.id, productId, patch);
    if (!product) {
      if (patch.price !== undefined && (await productsRepository.findOwnedKind(merchant.id, productId)) === "REWARD") {
        throw new HttpError(400, "INVALID_INPUT");
      }
      throw new HttpError(404, "PRODUCT_NOT_FOUND");
    }
    return toProductDto(product, true);
  },

  async listPublicProducts(merchantId: number): Promise<ProductDto[]> {
    if (!(await productsRepository.isMerchantActive(merchantId))) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const products = await productsRepository.listByMerchant(merchantId, true);
    return products.map((product) => toProductDto(product));
  },
};
