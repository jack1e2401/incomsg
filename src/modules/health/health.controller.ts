import type { RequestHandler } from "express";
import { healthService } from "./health.service.js";

export const getHealth: RequestHandler = (_request, response) => {
  response.json(healthService.getStatus());
};

export const getDatabaseHealth: RequestHandler = async (_request, response) => {
  try {
    response.json(await healthService.getDatabaseStatus());
  } catch {
    response.status(503).json({ status: "error", database: "unavailable" });
  }
};
