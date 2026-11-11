import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createVnpayPayment, getPaymentStatus, receiveVnpayIpn, receiveVnpayReturn } from "./payments.controller.js";

export const orderPaymentRoutes = Router();
orderPaymentRoutes.use(authenticate, requireRole("MEMBER"));
orderPaymentRoutes.post("/:orderId/payments/vnpay", createVnpayPayment);
orderPaymentRoutes.get("/:orderId/payment-status", getPaymentStatus);

export const vnpayRoutes = Router();
vnpayRoutes.get("/ipn", receiveVnpayIpn);
vnpayRoutes.get("/return", receiveVnpayReturn);
