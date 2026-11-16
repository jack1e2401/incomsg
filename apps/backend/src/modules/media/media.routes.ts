import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { uploadMerchantMedia } from "./media.controller.js";

export const merchantMediaRoutes = Router();
merchantMediaRoutes.use(authenticate, requireRole("MERCHANT"));
merchantMediaRoutes.post("/upload", uploadMerchantMedia);
