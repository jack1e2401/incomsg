import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { productsRepository } from "../products/products.repository.js";
import { ordersRepository } from "./orders.repository.js";
import type { CreateOrderInput, OrderDto } from "./orders.types.js";

const maxOrderTotal = new Prisma.Decimal("999999999999999");

export const ordersService = {
  async createOrder(memberId: number, input: CreateOrderInput): Promise<OrderDto> {
    const product = await productsRepository.findSellableProduct(input.productId);
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND");

    const total = product.price.mul(input.quantity);
    if (total.greaterThan(maxOrderTotal)) throw new HttpError(400, "INVALID_INPUT");

    return ordersRepository.createPendingOrder({
      memberId,
      merchantId: product.merchantId,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: input.quantity,
      total,
      voucherId: input.voucherId ?? null,
    });
  },

  async payOrder(memberId: number, orderId: number): Promise<OrderDto> {
    const result = await ordersRepository.markPaid(memberId, orderId);
    if (result === "missing") throw new HttpError(404, "ORDER_NOT_FOUND");
    if (result === "already_paid") throw new HttpError(409, "ORDER_ALREADY_PAID");
    return result;
  },
};
