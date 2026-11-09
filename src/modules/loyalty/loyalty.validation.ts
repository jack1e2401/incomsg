import { HttpError } from "../../lib/http-error.js";
import type { LoyaltyConfigInput } from "./loyalty.types.js";
import type { TierLevel } from "./loyalty.calculation.js";

const levels: readonly TierLevel[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
const maxInt = 2147483647;

export function parseConfig(value: unknown): LoyaltyConfigInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "INVALID_INPUT");
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.vndPerPoint) || (input.vndPerPoint as number) <= 0 || (input.vndPerPoint as number) > maxInt || typeof input.isActive !== "boolean") {
    throw new HttpError(400, "INVALID_INPUT");
  }
  if (!Array.isArray(input.tiers) || input.tiers.length !== levels.length) throw new HttpError(400, "INVALID_INPUT");
  const tiers = input.tiers.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "INVALID_INPUT");
    const tier = value as Record<string, unknown>;
    if (
      tier.level !== levels[index] ||
      !Number.isInteger(tier.minLifetimePoints) ||
      (tier.minLifetimePoints as number) < 0 ||
      (tier.minLifetimePoints as number) > maxInt ||
      typeof tier.multiplier !== "string" ||
      !/^\d{1,3}\.\d{2}$/.test(tier.multiplier) ||
      Number(tier.multiplier) <= 0
    ) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    return {
      level: tier.level as TierLevel,
      minLifetimePoints: tier.minLifetimePoints as number,
      multiplier: tier.multiplier,
    };
  });
  if (tiers.at(0)?.minLifetimePoints !== 0 || tiers.some((tier, index) => index > 0 && tier.minLifetimePoints <= tiers[index - 1]!.minLifetimePoints)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return { vndPerPoint: input.vndPerPoint as number, isActive: input.isActive, tiers };
}
