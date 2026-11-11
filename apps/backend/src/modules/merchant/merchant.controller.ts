import type { RequestHandler } from "express";
import { merchantService } from "./merchant.service.js";

export const getOwnStore: RequestHandler = async (_request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  response.json({ merchant });
};
