import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { productsRepository } from "../products/products.repository.js";
import { ordersRepository } from "./orders.repository.js";
import type { CreateOrderInput, OrderDto } from "./orders.types.js";
import { merchantRepository } from "../merchant/merchant.repository.js";

const maxOrderTotal = new Prisma.Decimal("999999999999999");

export const ordersService = {
  async listMemberOrders(memberId: number, merchantId: number) {
    const merchant = await merchantRepository.findStoreById(merchantId);
    if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    return ordersRepository.listMemberOrders(memberId, merchantId);
  },

  async getMemberOrder(memberId: number, orderId: number) {
    const order = await ordersRepository.findMemberOrder(memberId, orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    return order;
  },

  async listMerchantOrders(ownerId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return ordersRepository.listMerchantOrders(merchant.id);
  },

  async getMerchantOrder(ownerId: number, orderId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    const order = await ordersRepository.findMerchantOrder(merchant.id, orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    return order;
  },

  async createOrder(memberId: number, input: CreateOrderInput): Promise<OrderDto> {
    const products = await productsRepository.findSellableProducts(input.items.map(({ productId }) => productId));
    const merchantId = products[0]?.merchantId;
    if (merchantId === undefined || products.length !== input.items.length) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND");
    }
    if (products.some((product) => product.merchantId !== merchantId)) {
      throw new HttpError(400, "INVALID_INPUT");
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map(({ productId, quantity }) => {
      const product = byId.get(productId)!;
      return {
        productId,
        productName: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal: product.price.mul(quantity),
      };
    });
    const subtotal = items.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
    if (subtotal.greaterThan(maxOrderTotal)) throw new HttpError(400, "INVALID_INPUT");

    return ordersRepository.createPendingOrder({
      memberId,
      merchantId,
      items,
      subtotal,
      voucherId: input.voucherId ?? null,
    });
  },

  async payOrder(memberId: number, orderId: number): Promise<OrderDto> {
    const result = await ordersRepository.markPaid(memberId, orderId);
    if (result === "missing") throw new HttpError(404, "ORDER_NOT_FOUND");
    if (result === "already_paid") throw new HttpError(409, "ORDER_ALREADY_PAID");
    if (result === "vnpay_attempt_exists") throw new HttpError(409, "VNPAY_ATTEMPT_EXISTS");
    if (result === "reservation_expired") throw new HttpError(409, "ORDER_RESERVATION_EXPIRED");
    return result;
  },

  async cancelOrder(memberId: number, orderId: number) {
    return ordersRepository.cancelOrder(memberId, orderId);
  },

  expirePendingOrders() {
    return ordersRepository.releaseExpiredMockOrders();
  },

  async getRefundPreview(ownerId: number, orderId: number) {
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return ordersRepository.getRefundPreview(merchant.id, orderId);
  },

  async refundOrder(ownerId: number, orderId: number, reason: unknown) {
    if (!reason || typeof reason !== "string" || !reason.trim() || reason.trim().length > 255) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    const merchant = await merchantRepository.findActiveStoreByOwner(ownerId);
    if (!merchant) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    return ordersRepository.refundOrder(merchant.id, ownerId, orderId, reason.trim());
  },
};
