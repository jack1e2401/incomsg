import type { TierLevel } from "./loyalty.calculation.js";

export interface LoyaltyTierInput {
  level: TierLevel;
  minLifetimePoints: number;
  multiplier: string;
}

export interface LoyaltyConfigInput {
  vndPerPoint: number;
  isActive: boolean;
  tiers: LoyaltyTierInput[];
}

export interface LoyaltyTierDto extends LoyaltyTierInput {}

export interface LoyaltyConfigDto {
  merchantId: number;
  vndPerPoint: number;
  isActive: boolean;
  tiers: LoyaltyTierDto[];
}
