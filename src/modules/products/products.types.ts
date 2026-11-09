import type { ProductStatus } from "../../generated/prisma/enums.js";

export type ProductInput = {
  name: string;
  price: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type ProductPatch = Partial<ProductInput> & { status?: ProductStatus };

export type ProductDto = {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  status: ProductStatus;
};
