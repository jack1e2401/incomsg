import { prisma } from "../../lib/prisma.js";
import type { ApplicationDto, LoginIdentity, MerchantDto, UserDto } from "./auth.types.js";

const userSelection = {
  id: true,
  email: true,
  role: true,
  isActive: true,
} as const;

export const authRepository = {
  async createMember(email: string, passwordHash: string): Promise<UserDto> {
    return prisma.user.create({
      data: { email, passwordHash, role: "MEMBER", isActive: true },
      select: userSelection,
    });
  },

  async createApplicant(
    email: string,
    passwordHash: string,
    storeName: string,
  ): Promise<{ user: UserDto; application: ApplicationDto }> {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "MERCHANT",
        isActive: false,
        application: { create: { storeName } },
      },
      select: {
        ...userSelection,
        application: {
          select: {
            id: true,
            applicantId: true,
            storeName: true,
            status: true,
            reviewedById: true,
            reviewedAt: true,
          },
        },
      },
    });
    return { user: created, application: created.application! };
  },

  async findByEmail(email: string): Promise<LoginIdentity | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...userSelection,
        passwordHash: true,
        application: { select: { status: true } },
        merchant: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });
    if (!user) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      passwordHash: user.passwordHash,
      applicationStatus: user.application?.status ?? null,
      merchant: user.merchant as MerchantDto | null,
    };
  },

  async findUser(userId: number): Promise<UserDto | null> {
    return prisma.user.findUnique({ where: { id: userId }, select: userSelection });
  },
};
