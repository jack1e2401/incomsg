import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import type { ApplicationDto, AuthenticatedUser, LoginIdentity, MerchantDto, UserDto } from "./auth.types.js";

const userSelection = {
  id: true,
  email: true,
  role: true,
  accountStatus: true,
} as const;

const applicationSelection = {
  id: true,
  applicantId: true,
  storeName: true,
  status: true,
  reviewedById: true,
  reviewedAt: true,
} as const;

function toUserDto(user: { id: number; email: string; role: UserDto["role"]; accountStatus: UserDto["accountStatus"] }): UserDto {
  return { id: user.id, email: user.email, role: user.role, accountStatus: user.accountStatus, isActive: user.accountStatus === "ACTIVE" };
}

async function assertNotBlacklisted(tx: Prisma.TransactionClient, email: string): Promise<void> {
  const entry = await tx.emailBlacklistEntry.findUnique({ where: { email }, select: { isActive: true } });
  if (entry?.isActive) throw new HttpError(403, "EMAIL_BLACKLISTED");
}

export const authRepository = {
  async createMember(email: string, passwordHash: string): Promise<UserDto> {
    return prisma.$transaction(async (tx) => {
      await assertNotBlacklisted(tx, email);
      const user = await tx.user.create({
        data: { email, passwordHash, role: "MEMBER", accountStatus: "ACTIVE" },
        select: userSelection,
      });
      return toUserDto(user);
    }, { isolationLevel: "Serializable" });
  },

  async createApplicant(
    email: string,
    passwordHash: string,
    storeName: string,
  ): Promise<{ user: UserDto; application: ApplicationDto }> {
    return prisma.$transaction(async (tx) => {
      await assertNotBlacklisted(tx, email);
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "MERCHANT",
          accountStatus: "PENDING_APPROVAL",
          application: { create: { storeName } },
        },
        select: {
          ...userSelection,
          application: { select: applicationSelection },
        },
      });
      const { application, ...user } = created;
      return { user: toUserDto(user), application: application! };
    }, { isolationLevel: "Serializable" });
  },

  async findByEmail(email: string): Promise<LoginIdentity | null> {
    const [user, blacklist] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: {
          ...userSelection,
          passwordHash: true,
          application: { select: { status: true } },
          merchant: { select: { id: true, name: true, slug: true, isActive: true } },
        },
      }),
      prisma.emailBlacklistEntry.findUnique({ where: { email }, select: { isActive: true } }),
    ]);
    if (!user) return null;
    return {
      user: toUserDto(user),
      passwordHash: user.passwordHash,
      applicationStatus: user.application?.status ?? null,
      merchant: user.merchant as MerchantDto | null,
      blacklisted: blacklist?.isActive ?? false,
    };
  },

  async findUser(userId: number): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelection, merchant: { select: { isActive: true } } },
    });
    if (!user) return null;
    return { ...toUserDto(user), merchantIsActive: user.merchant?.isActive ?? null };
  },

  async findApplicationForApplicant(applicantId: number): Promise<ApplicationDto | null> {
    return prisma.merchantApplication.findUnique({
      where: { applicantId },
      select: applicationSelection,
    });
  },
};
