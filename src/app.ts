import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});
app.use(errorHandler);
