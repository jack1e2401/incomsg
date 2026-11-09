import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getAdminDashboard, listAdminMerchants } from "./admin.controller.js";

export const adminRoutes = Router();
adminRoutes.use(authenticate, requireRole("ADMIN"));
adminRoutes.get("/merchants", listAdminMerchants);
adminRoutes.get("/dashboard", getAdminDashboard);
