export type ProductCategoryDto = {
  id: number;
  merchantId: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type ProductCategoryInput = {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
};

export type ProductCategoryPatch = {
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
};
