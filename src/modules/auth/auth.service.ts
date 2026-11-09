import { hashPassword, verifyPassword } from "../../lib/password.js";
import { HttpError } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/access-token.js";
import { authRepository } from "./auth.repository.js";
import type { Credentials, MerchantRegistration, UserDto } from "./auth.types.js";

function isUniqueEmailError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function createWithUniqueEmail<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueEmailError(error)) throw new HttpError(409, "EMAIL_TAKEN");
    throw error;
  }
}

function publicUser(user: UserDto): UserDto {
  return user;
}

export const authService = {
  async registerMember(input: Credentials): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return createWithUniqueEmail(() => authRepository.createMember(input.email, passwordHash));
  },

  async registerMerchant(input: MerchantRegistration) {
    const passwordHash = await hashPassword(input.password);
    return createWithUniqueEmail(() => authRepository.createApplicant(input.email, passwordHash, input.storeName));
  },

  async login(input: Credentials): Promise<{ accessToken: string; user: UserDto }> {
    const identity = await authRepository.findByEmail(input.email);
    if (!identity || !(await verifyPassword(input.password, identity.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }

    if (identity.user.role === "MERCHANT") {
      if (identity.applicationStatus === "PENDING") throw new HttpError(403, "MERCHANT_PENDING");
      if (identity.applicationStatus === "REJECTED") throw new HttpError(403, "MERCHANT_REJECTED");
    }
    if (!identity.user.isActive) throw new HttpError(403, "ACCOUNT_INACTIVE");

    return {
      accessToken: await signAccessToken(identity.user.id),
      user: publicUser(identity.user),
    };
  },
};
