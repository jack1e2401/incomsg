import type { OrderStatus } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";

type OrderLineInput = {
  productId: number;
  quantity: number;
};

export type CreateOrderInput = {
  items: OrderLineInput[];
  voucherId?: number;
};

export type CreatePendingOrderInput = {
  memberId: number;
  merchantId: number;
  items: (OrderLineInput & {
    productName: string;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  })[];
  subtotal: Prisma.Decimal;
  voucherId: number | null;
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
