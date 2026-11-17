export type ProductKind = "SALE" | "REWARD";

export type ProductStatus = "ACTIVE" | "HIDDEN";

export interface ProductImageDto {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductImageInput {
  url: string;
  altText?: string | null;
  sortOrder?: number;
}

export interface ProductCategoryDto {
  id: number;
  merchantId: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface ProductCategoryInput {
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

export type ProductCategoryPatch = Partial<ProductCategoryInput>;

export interface PaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export type ProductSortOption = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface ProductListQuery {
  q?: string;
  categoryId?: number;
  status?: ProductStatus;
  kind?: ProductKind;
  lowStock?: boolean;
  sort?: ProductSortOption;
  page?: number;
  limit?: number;
}

export interface PublicProductListQuery {
  q?: string;
  categoryId?: number;
  sort?: ProductSortOption;
  page?: number;
  limit?: number;
}

export interface ProductDto {
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
  kind: ProductKind;
  price: string;
  status: ProductStatus;
  inventory: { availableQuantity: number; onHandQuantity?: number; reservedQuantity?: number };
}

interface ProductFields {
  name: string;
  description?: string | null;
  richDescription?: string | null;
  imageUrl?: string | null;
  images?: ProductImageInput[];
  sku?: string | null;
  categoryId?: number | null;
  lowStockThreshold?: number;
}

export type ProductInput = ProductFields &
  (
    | { kind?: "SALE"; price: string; initialQuantity?: number }
    | { kind: "REWARD"; price?: never; initialQuantity?: number }
  );

export type ProductPatch = Partial<ProductFields> & { price?: string; status?: ProductStatus };

export type CategoriesResponse = { categories: ProductCategoryDto[] };

export type CategoryResponse = { category: ProductCategoryDto };

export type DeleteCategoryResponse = { deleted: boolean };

export type ProductsResponse = { items: ProductDto[]; pagination: PaginationDto };

export type PublicStoreProductsResponse = {
  items: ProductDto[];
  categories: ProductCategoryDto[];
  pagination: PaginationDto;
};

export type ProductResponse = { product: ProductDto };
