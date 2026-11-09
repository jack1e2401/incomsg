import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { applicationRoutes } from "./modules/merchant-applications/application.routes.js";
import { merchantRoutes } from "./modules/merchant/merchant.routes.js";
import { merchantProductRoutes, publicProductRoutes } from "./modules/products/products.routes.js";

export const app = express();
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/merchants", applicationRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/merchant/products", merchantProductRoutes);
app.use("/api/merchants", publicProductRoutes);
app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});
app.use(errorHandler);
