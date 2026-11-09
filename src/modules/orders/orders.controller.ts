import type { RequestHandler } from "express";
import { readRouteId } from "../products/products.validation.js";
import { ordersService } from "./orders.service.js";
import { paymentsService } from "../payments/payments.service.js";
import { readCreateOrderInput } from "./orders.validation.js";

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
