import { HttpError } from "../../lib/http-error.js";
import { merchantService } from "../merchant/merchant.service.js";
import { productsRepository } from "./products.repository.js";
import type { ProductDto, ProductInput, ProductPatch } from "./products.types.js";

function toProductDto(product: Awaited<ReturnType<typeof productsRepository.create>>): ProductDto {
  return {
    ...product,
    price: product.price.toFixed(0),
  };
}

export const productsService = {
  async createProduct(ownerId: number, input: ProductInput): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    return toProductDto(await productsRepository.create(merchant.id, input));
  },

  async listOwnProducts(ownerId: number): Promise<ProductDto[]> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const products = await productsRepository.listByMerchant(merchant.id, false);
    return products.map(toProductDto);
  },

  async updateProduct(ownerId: number, productId: number, patch: ProductPatch): Promise<ProductDto> {
    const merchant = await merchantService.getOwnStore(ownerId);
    const product = await productsRepository.updateOwned(merchant.id, productId, patch);
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND");
    return toProductDto(product);
  },

  async listPublicProducts(merchantId: number): Promise<ProductDto[]> {
    if (!(await productsRepository.isMerchantActive(merchantId))) {
      throw new HttpError(404, "MERCHANT_NOT_FOUND");
    }
    const products = await productsRepository.listByMerchant(merchantId, true);
    return products.map(toProductDto);
  },
};
