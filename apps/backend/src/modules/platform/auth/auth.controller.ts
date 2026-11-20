import type { Request, RequestHandler, Response } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { env } from "../../../config/env.js";
import { authService } from "./auth.service.js";
import { readLogin, readMerchantRegistration, readRegistration } from "./auth.validation.js";
import {
  getRefreshCookieOptions,
  parseRefreshTokenCookie,
  REFRESH_COOKIE_NAME,
} from "./refresh-session.js";

function clearRefreshCookie(response: Response): void {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions();
  response.clearCookie(REFRESH_COOKIE_NAME, options);
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.get("origin");
  if (origin && origin !== new URL(env.frontendOrigin).origin) throw new HttpError(403, "ORIGIN_NOT_ALLOWED");
}

export const registerMember: RequestHandler = async (request, response) => {
  const user = await authService.registerMember(readRegistration(request.body));
  response.status(201).json({ user });
};

export const registerMerchant: RequestHandler = async (request, response) => {
  const result = await authService.registerMerchant(readMerchantRegistration(request.body));
  response.status(201).json(result);
};

export const login: RequestHandler = async (request, response) => {
  assertTrustedOrigin(request);
  const { refreshToken, ...session } = await authService.login(readLogin(request.body));
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
  response.json(session);
};

export const refresh: RequestHandler = async (request, response) => {
  assertTrustedOrigin(request);
  const token = parseRefreshTokenCookie(request.header("cookie"));
  if (!token) {
    clearRefreshCookie(response);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN");
  }
  try {
    const { refreshToken, ...session } = await authService.refresh(token);
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
    response.json(session);
  } catch (error) {
    clearRefreshCookie(response);
    throw error;
  }
};

export const logout: RequestHandler = async (request, response) => {
  assertTrustedOrigin(request);
  await authService.logout(parseRefreshTokenCookie(request.header("cookie")));
  clearRefreshCookie(response);
  response.status(204).end();
};

export const applicationStatus: RequestHandler = async (request, response) => {
  const application = await authService.getMerchantApplicationStatus(readLogin(request.body));
  response.json({ application });
};
