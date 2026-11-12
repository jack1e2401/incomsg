import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { createMerchantAbuseReport } from "./abuse-reports.controller.js";

export const merchantAbuseReportRoutes = Router();
merchantAbuseReportRoutes.use(authenticate, requireRole("MERCHANT"));
merchantAbuseReportRoutes.post("/abuse-reports", createMerchantAbuseReport);
