import type { ProductKind, ProductStatus } from "../../generated/prisma/enums.js";

type ProductDetails = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type ProductInput = ProductDetails & (
  | { kind: "SALE"; price: string; initialQuantity?: number }
  | { kind: "REWARD"; initialQuantity?: number }
);

export type ProductPatch = Partial<ProductDetails> & { price?: string; status?: ProductStatus };

export type ProductDto = {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  kind: ProductKind;
  status: ProductStatus;
  inventory: { availableQuantity: number; onHandQuantity?: number; reservedQuantity?: number };
};
