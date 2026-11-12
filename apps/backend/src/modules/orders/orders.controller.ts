import type { RequestHandler } from "express";
import { readRouteId } from "../products/products.validation.js";
import { ordersService } from "./orders.service.js";
import { paymentsService } from "../payments/payments.service.js";
import { readCreateOrderInput } from "./orders.validation.js";
import { HttpError } from "../../lib/http-error.js";
import { OrderNotCancellableError } from "./orders.types.js";

export const createOrder: RequestHandler = async (request, response) => {
  const input = readCreateOrderInput(request.body);
  const order = await ordersService.createOrder(response.locals.user.id, input);
  response.status(201).json({ order });
};

export const payOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  const order = await paymentsService.payMock(response.locals.user.id, orderId);
  response.json({ order });
};

export const listMemberOrders: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.query.merchantId);
  const orders = await ordersService.listMemberOrders(response.locals.user.id, merchantId);
  response.json({ orders });
};

export const getMemberOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId!);
  const order = await ordersService.getMemberOrder(response.locals.user.id, orderId);
  response.json({ order });
};

export const listMerchantOrders: RequestHandler = async (_request, response) => {
  const orders = await ordersService.listMerchantOrders(response.locals.user.id);
  response.json({ orders });
};

export const getMerchantOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId!);
  const order = await ordersService.getMerchantOrder(response.locals.user.id, orderId);
  response.json({ order });
};

export const cancelOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  try {
    const result = await ordersService.cancelOrder(response.locals.user.id, orderId);
    response.json(result);
  } catch (error: unknown) {
    if (error instanceof OrderNotCancellableError) {
      response.status(409).json({
        error: "ORDER_NOT_CANCELLABLE",
        orderStatus: error.orderStatus,
        paymentStatus: error.paymentStatus,
      });
      return;
    }
    throw error;
  }
};

export const getRefundPreview: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  const preview = await ordersService.getRefundPreview(response.locals.user.id, orderId);
  response.json(preview);
};

export const refundOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  const reason = request.body?.reason;
  const result = await ordersService.refundOrder(response.locals.user.id, orderId, reason);
  response.json(result);
};
