import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { addAdminBlacklist, changeAdminMerchantStatus, changeAdminUserStatus, deactivateAdminBlacklist, getAdminDashboard, listAdminAuditLogs, listAdminBlacklist, listAdminMerchants, listAdminUsers } from "./admin.controller.js";

export const adminRoutes = Router();
adminRoutes.use(authenticate, requireRole("ADMIN"));
adminRoutes.get("/merchants", listAdminMerchants);
adminRoutes.get("/dashboard", getAdminDashboard);
adminRoutes.get("/users", listAdminUsers);
adminRoutes.patch("/users/:userId/status", changeAdminUserStatus);
adminRoutes.patch("/merchants/:merchantId/status", changeAdminMerchantStatus);
adminRoutes.get("/email-blacklist", listAdminBlacklist);
adminRoutes.post("/email-blacklist", addAdminBlacklist);
adminRoutes.post("/email-blacklist/:id/deactivate", deactivateAdminBlacklist);
adminRoutes.get("/audit-logs", listAdminAuditLogs);
