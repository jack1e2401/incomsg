import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import { getAnalytics } from "./analytics.controller.js";

export const merchantAnalyticsRoutes = Router();
merchantAnalyticsRoutes.use(authenticate, requireRole("MERCHANT"));
merchantAnalyticsRoutes.get("/", getAnalytics);
