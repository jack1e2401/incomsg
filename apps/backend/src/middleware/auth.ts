import type { RequestHandler } from "express";
import { readAccessToken } from "../lib/access-token.js";
import { HttpError } from "../lib/http-error.js";
import { authRepository } from "../modules/auth/auth.repository.js";
import type { UserDto } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Locals {
      user: UserDto;
    }
  }
}

export const authenticate: RequestHandler = async (request, response, next) => {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "UNAUTHORIZED");
  let userId: number;
  try {
    userId = await readAccessToken(authorization.slice(7));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "UNAUTHORIZED");
  }

  const user = await authRepository.findUser(userId);
  if (!user) throw new HttpError(401, "UNAUTHORIZED");
  if (user.accountStatus === "SUSPENDED") throw new HttpError(403, "ACCOUNT_SUSPENDED");
  if (user.accountStatus === "BANNED") throw new HttpError(403, "ACCOUNT_BANNED");
  if (user.accountStatus === "PENDING_APPROVAL") throw new HttpError(403, "MERCHANT_PENDING");
  if (user.accountStatus === "REJECTED") throw new HttpError(403, "MERCHANT_REJECTED");
  if (!user.isActive) throw new HttpError(403, "ACCOUNT_INACTIVE");
  if (user.role === "MERCHANT" && user.merchantIsActive !== true) {
    throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
  }
  response.locals.user = user;
  next();
};

export function requireRole(role: UserDto["role"]): RequestHandler {
  return (_request, response, next) => {
    if (response.locals.user?.role !== role) throw new HttpError(403, "FORBIDDEN");
    next();
  };
}
