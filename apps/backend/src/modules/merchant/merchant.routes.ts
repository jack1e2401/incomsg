import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getOwnStore } from "./merchant.controller.js";

export const merchantRoutes = Router();
merchantRoutes.get("/me", authenticate, requireRole("MERCHANT"), getOwnStore);
