import type { RequestHandler } from "express";
import { loyaltyService } from "./loyalty.service.js";
import { parseConfig } from "./loyalty.validation.js";

export const getLoyaltyConfig: RequestHandler = async (_request, response) => {
  response.json({ config: await loyaltyService.getConfig(response.locals.user.id) });
};

export const putLoyaltyConfig: RequestHandler = async (request, response) => {
  const input = parseConfig(request.body);
  response.json({ config: await loyaltyService.saveConfig(response.locals.user.id, input) });
};
