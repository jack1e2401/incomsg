import type { OrderStatus } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";

export type CreateOrderInput = {
  productId: number;
  quantity: number;
};

export type CreatePendingOrderInput = {
  memberId: number;
  merchantId: number;
  productId: number;
  productName: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  total: Prisma.Decimal;
};

export type OrderItemDto = {
  productId: number;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

export type OrderDto = {
  id: number;
  merchantId: number;
  memberId: number;
  status: OrderStatus;
  subtotal: string;
  discountAmount: string;
  total: string;
  paidAt: string | null;
  items: OrderItemDto[];
};
