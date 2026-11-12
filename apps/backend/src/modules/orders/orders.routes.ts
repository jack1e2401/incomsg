import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import {
  cancelOrder,
  createOrder,
  getMemberOrder,
  getMerchantOrder,
  getRefundPreview,
  listMemberOrders,
  listMerchantOrders,
  payOrder,
  refundOrder,
} from "./orders.controller.js";

export const orderRoutes = Router();
orderRoutes.use(authenticate, requireRole("MEMBER"));
orderRoutes.post("/", createOrder);
orderRoutes.post("/:orderId/pay", payOrder);
orderRoutes.post("/:orderId/cancel", cancelOrder);

export const memberOrderReadRoutes = Router();
memberOrderReadRoutes.use(authenticate, requireRole("MEMBER"));
memberOrderReadRoutes.get("/", listMemberOrders);
memberOrderReadRoutes.get("/:orderId", getMemberOrder);

export const merchantOrderReadRoutes = Router();
merchantOrderReadRoutes.use(authenticate, requireRole("MERCHANT"));
merchantOrderReadRoutes.get("/", listMerchantOrders);
merchantOrderReadRoutes.get("/:orderId", getMerchantOrder);
merchantOrderReadRoutes.get("/:orderId/refund-preview", getRefundPreview);
merchantOrderReadRoutes.post("/:orderId/refund", refundOrder);
