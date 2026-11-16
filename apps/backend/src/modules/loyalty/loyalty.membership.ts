import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { defaultTiers } from "./loyalty.config.js";
import { selectTier, type TierLevel } from "./loyalty.calculation.js";

export type MembershipTier = TierLevel | "UNRANKED";

export interface EnsureMembershipResult {
  membership: {
    id: number;
    merchantId: number;
    memberId: number;
    tier: MembershipTier;
    createdAt: string;
  };
  created: boolean;
}

function isRetryableMembershipError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "P2002" || error.code === "P2034";
}

async function ensureMembershipForMerchant(memberId: number, merchantId: number): Promise<EnsureMembershipResult> {
  const maxAttempts = 6;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.merchantMembership.findUnique({
          where: { memberId_merchantId: { memberId, merchantId } },
          include: {
            wallet: {
              include: {
                _count: { select: { transactions: { where: { type: "EARN" } } } },
              },
            },
          },
        });

        if (existing) {
          let wallet = existing.wallet;
          if (!wallet) {
            const createdWallet = await tx.loyaltyWallet.create({ data: { membershipId: existing.id } });
            wallet = { ...createdWallet, _count: { transactions: 0 } };
          }
          const configuredTiers = await tx.loyaltyTier.findMany({
            where: { merchantId },
            orderBy: { minLifetimePoints: "asc" },
          });
          const tiers = configuredTiers.length ? configuredTiers : defaultTiers;
          const ranked = existing.tierId !== null || wallet._count.transactions > 0;
          const tier: MembershipTier = ranked
            ? selectTier(wallet.netLifetimeEarned, tiers) ?? "UNRANKED"
            : "UNRANKED";

          return {
            membership: {
              id: existing.id,
              merchantId: existing.merchantId,
              memberId: existing.memberId,
              tier,
              createdAt: existing.createdAt.toISOString(),
            },
            created: false,
          };
        }

        const membership = await tx.merchantMembership.create({
          data: {
            memberId,
            merchantId,
            tierId: null,
          },
        });
        await tx.loyaltyWallet.create({
          data: { membershipId: membership.id },
        });

        return {
          membership: {
            id: membership.id,
            merchantId: membership.merchantId,
            memberId: membership.memberId,
            tier: "UNRANKED",
            createdAt: membership.createdAt.toISOString(),
          },
          created: true,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (!isRetryableMembershipError(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }
}

export async function ensureMemberStoreMembershipBySlug(
  memberId: number,
  rawSlug: string,
): Promise<EnsureMembershipResult> {
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";
  if (!slug || slug.length > 191) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const merchant = await prisma.merchant.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
  if (!merchant.isActive) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
  return ensureMembershipForMerchant(memberId, merchant.id);
}

export async function ensureMemberStoreMembershipByMerchantId(
  memberId: number,
  merchantId: number,
): Promise<EnsureMembershipResult> {
  if (!Number.isSafeInteger(merchantId) || merchantId < 1) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, isActive: true },
  });
  if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
  if (!merchant.isActive) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
  return ensureMembershipForMerchant(memberId, merchant.id);
}
