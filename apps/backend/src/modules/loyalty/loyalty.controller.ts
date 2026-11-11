import type { RequestHandler } from "express";
import { loyaltyService } from "./loyalty.service.js";
import { parseConfig } from "./loyalty.validation.js";
import { loyaltyRepository } from "./loyalty.repository.js";
import { HttpError } from "../../lib/http-error.js";
import { readRouteId } from "../products/products.validation.js";

export const getLoyaltyConfig: RequestHandler = async (_request, response) => {
  response.json({ config: await loyaltyService.getConfig(response.locals.user.id) });
};

export const putLoyaltyConfig: RequestHandler = async (request, response) => {
  const input = parseConfig(request.body);
  response.json({ config: await loyaltyService.saveConfig(response.locals.user.id, input) });
};

export const getMemberWallet: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.params.merchantId);
  const wallet = await loyaltyRepository.getWallet(response.locals.user.id, merchantId);
  if (wallet === "merchant_missing") throw new HttpError(404, "MERCHANT_NOT_FOUND");
  response.json({ wallet });
};
