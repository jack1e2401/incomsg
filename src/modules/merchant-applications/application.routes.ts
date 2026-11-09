import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { approve, listPending, reject } from "./application.controller.js";

export const applicationRoutes = Router();
applicationRoutes.use(authenticate, requireRole("ADMIN"));
applicationRoutes.get("/pending", listPending);
applicationRoutes.patch("/:id/approve", approve);
applicationRoutes.patch("/:id/reject", reject);
