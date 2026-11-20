import { Router } from "express";
import { getDatabaseHealth, getHealth } from "./health.controller.js";

export const healthRoutes = Router();
healthRoutes.get("/", getHealth);
healthRoutes.get("/db", getDatabaseHealth);
