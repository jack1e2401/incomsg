import type {
  CategoriesResponse,
  CategoryResponse,
  DeleteCategoryResponse,
  ProductCategoryInput,
  ProductCategoryPatch,
  ProductInput,
  ProductListQuery,
  ProductPatch,
  ProductResponse,
  ProductsResponse,
  PublicProductListQuery,
  PublicStoreProductsResponse,
} from "../contracts/catalog";
import { requestJson, productQueryPath } from "./shared";

export function createCatalogClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    listOwnCategories(token: string) {
      return requestJson<CategoriesResponse>(fetcher, baseUrl, "/api/merchant/categories", { token });
    },
    createCategory(input: ProductCategoryInput, token: string) {
      return requestJson<CategoryResponse>(fetcher, baseUrl, "/api/merchant/categories", {
        method: "POST",
        token,
        body: input,
      });
    },
    updateCategory(categoryId: number, patch: ProductCategoryPatch, token: string) {
      return requestJson<CategoryResponse>(fetcher, baseUrl, `/api/merchant/categories/${categoryId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
    },
    deleteCategory(categoryId: number, token: string) {
      return requestJson<DeleteCategoryResponse>(fetcher, baseUrl, `/api/merchant/categories/${categoryId}`, {
        method: "DELETE",
        token,
      });
    },
    listOwnProducts(token: string, query: ProductListQuery = {}) {
      return requestJson<ProductsResponse>(
        fetcher,
        baseUrl,
        productQueryPath("/api/merchant/products", query),
        {
          token,
        },
      );
    },
    createProduct(input: ProductInput, token: string) {
      return requestJson<ProductResponse>(fetcher, baseUrl, "/api/merchant/products", {
        method: "POST",
        token,
        body: input,
      });
    },
    updateProduct(productId: number, patch: ProductPatch, token: string) {
      return requestJson<ProductResponse>(fetcher, baseUrl, `/api/merchant/products/${productId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
    },
    listPublicProducts(merchantId: number, query: PublicProductListQuery = {}) {
      return requestJson<ProductsResponse>(
        fetcher,
        baseUrl,
        productQueryPath(`/api/merchants/${merchantId}/products`, query),
      );
    },
    listPublicStoreProducts(slug: string, query: PublicProductListQuery = {}) {
      return requestJson<PublicStoreProductsResponse>(
        fetcher,
        baseUrl,
        productQueryPath(`/api/public/stores/${encodeURIComponent(slug)}/products`, query),
      );
    },
    getPublicStoreProduct(slug: string, productId: number) {
      return requestJson<ProductResponse>(
        fetcher,
        baseUrl,
        `/api/public/stores/${encodeURIComponent(slug)}/products/${productId}`,
      );
    },
  };
}
