import type { ProductKind, ProductStatus } from "../../generated/prisma/enums.js";
import type { ProductCategoryDto } from "./categories.types.js";

export type ProductImageInput = {
  url: string;
  altText: string | null;
  sortOrder: number;
};

export type ProductImageDto = {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
};

type ProductDetails = {
  name: string;
  description?: string | null;
  richDescription?: string | null;
  imageUrl?: string | null;
  images?: ProductImageInput[];
  sku?: string | null;
  categoryId?: number | null;
  lowStockThreshold?: number;
};

export type ProductInput = ProductDetails & (
  | { kind: "SALE"; price: string; initialQuantity?: number }
  | { kind: "REWARD"; initialQuantity?: number }
);

export type ProductPatch = Partial<ProductDetails> & { price?: string; status?: ProductStatus };

export type ProductSortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

export type MerchantProductListQuery = {
  q?: string;
  categoryId?: number;
  status?: ProductStatus;
  kind?: ProductKind;
  lowStock?: boolean;
  sort: ProductSortOption;
  page: number;
  limit: number;
};

export type PublicProductListQuery = {
  q?: string;
  categoryId?: number;
  sort: ProductSortOption;
  page: number;
  limit: number;
};

export type PaginationDto = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type ProductDto = {
  id: number;
  merchantId: number;
  categoryId: number | null;
  category: { id: number; name: string; slug: string } | null;
  sku: string | null;
  name: string;
  description: string | null;
  richDescription: string | null;
  imageUrl: string | null;
  images: ProductImageDto[];
  lowStockThreshold: number;
  isLowStock: boolean;
  price: string;
  kind: ProductKind;
  status: ProductStatus;
  inventory: { availableQuantity: number; onHandQuantity?: number; reservedQuantity?: number };
};

export type PaginatedProductsDto = {
  items: ProductDto[];
  pagination: PaginationDto;
};

export type PublicStoreProductsDto = PaginatedProductsDto & {
  categories: ProductCategoryDto[];
};
