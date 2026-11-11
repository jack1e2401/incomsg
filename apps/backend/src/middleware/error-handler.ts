import type { ErrorRequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.code });
    return;
  }

  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
    response.status(400).json({ error: "INVALID_INPUT" });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    response.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "INTERNAL_ERROR" });
};
