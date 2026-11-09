import type { RequestHandler } from "express";
import { authService } from "./auth.service.js";
import { readLogin, readMerchantRegistration, readRegistration } from "./auth.validation.js";

export const registerMember: RequestHandler = async (request, response) => {
  const user = await authService.registerMember(readRegistration(request.body));
  response.status(201).json({ user });
};

export const registerMerchant: RequestHandler = async (request, response) => {
  const result = await authService.registerMerchant(readMerchantRegistration(request.body));
  response.status(201).json(result);
};

export const login: RequestHandler = async (request, response) => {
  response.json(await authService.login(readLogin(request.body)));
};
