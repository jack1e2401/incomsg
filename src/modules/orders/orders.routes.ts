import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createOrder, getMemberOrder, listMemberOrders, listMerchantOrders, payOrder } from "./orders.controller.js";

export const orderRoutes = Router();
orderRoutes.use(authenticate, requireRole("MEMBER"));
orderRoutes.post("/", createOrder);
orderRoutes.post("/:orderId/pay", payOrder);

export const memberOrderReadRoutes = Router();
memberOrderReadRoutes.use(authenticate, requireRole("MEMBER"));
memberOrderReadRoutes.get("/", listMemberOrders);
memberOrderReadRoutes.get("/:orderId", getMemberOrder);

export const merchantOrderReadRoutes = Router();
merchantOrderReadRoutes.use(authenticate, requireRole("MERCHANT"));
merchantOrderReadRoutes.get("/", listMerchantOrders);
