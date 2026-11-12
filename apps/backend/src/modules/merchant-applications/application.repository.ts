import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { ApplicationDto, MerchantDto } from "../auth/auth.types.js";

type ReviewFailure = { kind: "missing" } | { kind: "already_reviewed" };
type ApprovalResult = ReviewFailure | { kind: "approved"; application: ApplicationDto; merchant: MerchantDto };
type RejectionResult = ReviewFailure | { kind: "rejected"; application: ApplicationDto };

const applicationSelection = {
  id: true,
  applicantId: true,
  storeName: true,
  status: true,
  reviewedById: true,
  reviewedAt: true,
} satisfies Prisma.MerchantApplicationSelect;

export const applicationRepository = {
  async listPending(): Promise<ApplicationDto[]> {
    return prisma.merchantApplication.findMany({
      where: { status: "PENDING" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: applicationSelection,
    });
  },

  async listReviewed(): Promise<ApplicationDto[]> {
    return prisma.merchantApplication.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
      select: applicationSelection,
    });
  },

  async approve(applicationId: number, reviewerId: number): Promise<ApprovalResult> {
    return prisma.$transaction(async (tx) => {
      const application = await tx.merchantApplication.findUnique({
        where: { id: applicationId },
        select: applicationSelection,
      });
      if (!application) return { kind: "missing" };
      if (application.status !== "PENDING") return { kind: "already_reviewed" };

      const reviewedAt = new Date();
      const claim = await tx.merchantApplication.updateMany({
        where: { id: applicationId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt },
      });
      if (claim.count !== 1) return { kind: "already_reviewed" };

      const merchant = await tx.merchant.create({
        data: {
          ownerId: application.applicantId,
          name: application.storeName,
          slug: `store-${application.id}`,
          isActive: true,
        },
        select: { id: true, name: true, slug: true, isActive: true },
      });
      await tx.user.updateMany({
        where: { id: application.applicantId, accountStatus: "PENDING_APPROVAL" },
        data: { accountStatus: "ACTIVE" },
      });

      return {
        kind: "approved",
        application: {
          ...application,
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt,
        },
        merchant,
      };
    });
  },

  async reject(applicationId: number, reviewerId: number): Promise<RejectionResult> {
    return prisma.$transaction(async (tx) => {
      const application = await tx.merchantApplication.findUnique({
        where: { id: applicationId },
        select: applicationSelection,
      });
      if (!application) return { kind: "missing" };
      if (application.status !== "PENDING") return { kind: "already_reviewed" };

      const reviewedAt = new Date();
      const claim = await tx.merchantApplication.updateMany({
        where: { id: applicationId, status: "PENDING" },
        data: { status: "REJECTED", reviewedById: reviewerId, reviewedAt },
      });
      if (claim.count !== 1) return { kind: "already_reviewed" };
      await tx.user.updateMany({
        where: { id: application.applicantId, accountStatus: "PENDING_APPROVAL" },
        data: { accountStatus: "REJECTED" },
      });

      return {
        kind: "rejected",
        application: {
          ...application,
          status: "REJECTED",
          reviewedById: reviewerId,
          reviewedAt,
        },
      };
    });
  },
};
