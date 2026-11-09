import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createOrder, payOrder } from "./orders.controller.js";

export const orderRoutes = Router();
orderRoutes.use(authenticate, requireRole("MEMBER"));
orderRoutes.post("/", createOrder);
orderRoutes.post("/:orderId/pay", payOrder);
