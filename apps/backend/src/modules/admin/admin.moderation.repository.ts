import type { AccountStatus, AdminAuditAction, AdminAuditTargetType } from "../../generated/prisma/enums.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";

export type AdminActor = { id: number; email: string };

async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "code" in error &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt >= 3) throw error;
    }
  }
}

async function appendAudit(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  action: AdminAuditAction,
  targetType: AdminAuditTargetType,
  targetId: number,
  reason: string,
  before: Prisma.InputJsonValue,
  after: Prisma.InputJsonValue,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: { actorId: actor.id, actorEmail: actor.email, action, targetType, targetId, reason, before, after },
  });
}

function publicUser(user: { id: number; email: string; role: "ADMIN" | "MERCHANT" | "MEMBER"; accountStatus: AccountStatus; createdAt: Date }) {
  return { ...user, isActive: user.accountStatus === "ACTIVE" };
}

export const adminModerationRepository = {
  async changeUserStatus(userId: number, requestedStatus: "ACTIVE" | "SUSPENDED" | "BANNED", reason: string, actor: AdminActor) {
    return withSerializableRetry(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, accountStatus: true, createdAt: true, application: { select: { status: true } } },
      });
      if (!current) throw new HttpError(404, "USER_NOT_FOUND");
      if (current.accountStatus === requestedStatus) throw new HttpError(409, "INVALID_STATE_TRANSITION");

      let nextStatus: AccountStatus = requestedStatus;
      if (requestedStatus === "ACTIVE") {
        if (current.accountStatus !== "SUSPENDED" && current.accountStatus !== "BANNED") {
          throw new HttpError(409, "INVALID_STATE_TRANSITION");
        }
        nextStatus = current.application?.status === "PENDING"
          ? "PENDING_APPROVAL"
          : current.application?.status === "REJECTED" ? "REJECTED" : "ACTIVE";
      } else if (current.accountStatus === "BANNED" && requestedStatus === "SUSPENDED") {
        throw new HttpError(409, "INVALID_STATE_TRANSITION");
      }

      const update = await tx.user.updateMany({
        where: { id: userId, accountStatus: current.accountStatus },
        data: { accountStatus: nextStatus },
      });
      if (update.count !== 1) throw new HttpError(409, "INVALID_STATE_TRANSITION");
      await appendAudit(tx, actor, "USER_STATUS_CHANGED", "USER", userId, reason,
        { accountStatus: current.accountStatus }, { accountStatus: nextStatus });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, role: true, accountStatus: true, createdAt: true } });
      return { user: publicUser(user) };
    });
  },

  async changeMerchantStatus(merchantId: number, isActive: boolean, reason: string, actor: AdminActor) {
    return withSerializableRetry(async (tx) => {
      const current = await tx.merchant.findUnique({ where: { id: merchantId }, select: { id: true, name: true, slug: true, isActive: true } });
      if (!current) throw new HttpError(404, "MERCHANT_NOT_FOUND");
      if (current.isActive === isActive) throw new HttpError(409, "INVALID_STATE_TRANSITION");
      const update = await tx.merchant.updateMany({ where: { id: merchantId, isActive: current.isActive }, data: { isActive } });
      if (update.count !== 1) throw new HttpError(409, "INVALID_STATE_TRANSITION");
      await appendAudit(tx, actor, "MERCHANT_STATUS_CHANGED", "MERCHANT", merchantId, reason,
        { isActive: current.isActive }, { isActive });
      return { merchant: { ...current, isActive } };
    });
  },

  async addBlacklist(email: string, reason: string, actor: AdminActor) {
    return withSerializableRetry(async (tx) => {
      const current = await tx.emailBlacklistEntry.findUnique({ where: { email } });
      if (current?.isActive) throw new HttpError(409, "EMAIL_BLACKLIST_ACTIVE");
      const entry = current
        ? await tx.emailBlacklistEntry.update({
          where: { id: current.id },
          data: { isActive: true, reason, lastActorId: actor.id, lastActorEmail: actor.email },
        })
        : await tx.emailBlacklistEntry.create({
          data: { email, reason, lastActorId: actor.id, lastActorEmail: actor.email },
        });
      await appendAudit(tx, actor, "EMAIL_BLACKLISTED", "EMAIL_BLACKLIST", entry.id, reason,
        current ? { isActive: false } : { exists: false }, { isActive: true, email });
      return { entry };
    });
  },

  async deactivateBlacklist(entryId: number, reason: string, actor: AdminActor) {
    return withSerializableRetry(async (tx) => {
      const current = await tx.emailBlacklistEntry.findUnique({ where: { id: entryId } });
      if (!current) throw new HttpError(404, "BLACKLIST_ENTRY_NOT_FOUND");
      if (!current.isActive) throw new HttpError(409, "INVALID_STATE_TRANSITION");
      const update = await tx.emailBlacklistEntry.updateMany({
        where: { id: entryId, isActive: true },
        data: { isActive: false, reason, lastActorId: actor.id, lastActorEmail: actor.email },
      });
      if (update.count !== 1) throw new HttpError(409, "INVALID_STATE_TRANSITION");
      const entry = await tx.emailBlacklistEntry.findUniqueOrThrow({ where: { id: entryId } });
      await appendAudit(tx, actor, "EMAIL_BLACKLIST_DEACTIVATED", "EMAIL_BLACKLIST", entryId, reason,
        { isActive: true, email: current.email }, { isActive: false, email: current.email });
      return { entry };
    });
  },
};
