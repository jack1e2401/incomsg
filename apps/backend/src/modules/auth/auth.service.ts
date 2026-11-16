import { hashPassword, verifyPassword } from "../../lib/password.js";
import { HttpError } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/access-token.js";
import { authRepository } from "./auth.repository.js";
import type { ApplicationDto, Credentials, MerchantRegistration, UserDto } from "./auth.types.js";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isSlugConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const meta = "meta" in error && typeof error.meta === "object" && error.meta !== null ? error.meta : null;
  const target = meta && "target" in meta ? meta.target : undefined;
  if (typeof target === "string") return target.toLowerCase().includes("slug");
  if (Array.isArray(target)) return target.some((item) => String(item).toLowerCase().includes("slug"));
  return "message" in error && typeof error.message === "string" && error.message.includes("MerchantApplication_slug_key");
}

async function createWithUniqueFields<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      if (isSlugConflictError(error)) throw new HttpError(409, "SLUG_TAKEN");
      throw new HttpError(409, "EMAIL_TAKEN");
    }
    throw error;
  }
}

export const authService = {
  async registerMember(input: Credentials): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return createWithUniqueFields(() => authRepository.createMember(input.email, passwordHash));
  },

  async registerMerchant(input: MerchantRegistration) {
    const passwordHash = await hashPassword(input.password);
    return createWithUniqueFields(() =>
      authRepository.createApplicant(input.email, passwordHash, input.storeName, input.slug),
    );
  },

  async login(input: Credentials): Promise<{ accessToken: string; user: UserDto }> {
    const identity = await authRepository.findByEmail(input.email);
    if (!identity || !(await verifyPassword(input.password, identity.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }

    if (identity.blacklisted) throw new HttpError(403, "EMAIL_BLACKLISTED");
    if (identity.user.accountStatus === "SUSPENDED") throw new HttpError(403, "ACCOUNT_SUSPENDED");
    if (identity.user.accountStatus === "BANNED") throw new HttpError(403, "ACCOUNT_BANNED");
    if (identity.user.role === "MERCHANT") {
      if (identity.user.accountStatus === "PENDING_APPROVAL" || identity.applicationStatus === "PENDING") {
        throw new HttpError(403, "MERCHANT_PENDING");
      }
      if (identity.user.accountStatus === "REJECTED" || identity.applicationStatus === "REJECTED") {
        throw new HttpError(403, "MERCHANT_REJECTED");
      }
    }
    if (identity.user.accountStatus !== "ACTIVE") throw new HttpError(403, "ACCOUNT_INACTIVE");
    if (
      identity.user.role === "MERCHANT" &&
      (identity.applicationStatus !== "APPROVED" || !identity.merchant?.isActive)
    ) {
      throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
    }

    return {
      accessToken: await signAccessToken(identity.user.id),
      user: identity.user,
    };
  },

  async getMerchantApplicationStatus(input: Credentials): Promise<ApplicationDto> {
    const identity = await authRepository.findByEmail(input.email);
    if (!identity || !(await verifyPassword(input.password, identity.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }
    if (identity.user.role !== "MERCHANT") throw new HttpError(404, "APPLICATION_NOT_FOUND");

    const application = await authRepository.findApplicationForApplicant(identity.user.id);
    if (!application) throw new HttpError(404, "APPLICATION_NOT_FOUND");
    return application;
  },
};
