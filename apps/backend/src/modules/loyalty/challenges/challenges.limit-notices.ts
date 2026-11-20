import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { prisma } from "../../../lib/prisma.js";
import { readChallengeId } from "./challenges.validation.js";

export const getUnreadChallengeLimitNotice: RequestHandler = async (_req, res) => {
  const memberId: number = res.locals.user.id;
  const row = await prisma.challengeLimitNotice.findFirst({
    where: { reads: { none: { memberId } } },
    orderBy: { id: "asc" },
    select: {
      id: true, title: true, previousLimit: true, newLimit: true, createdAt: true,
      challenge: { select: { id: true, status: true, merchant: { select: { slug: true, isActive: true } } } },
    },
  });
  res.set("Cache-Control", "private, no-store");
  if (!row) return void res.json({ notice: null });
  const { challenge, ...notice } = row;
  res.json({
    notice: {
      ...notice,
      challengeId: challenge?.status === "ACTIVE" && challenge.merchant.isActive ? challenge.id : null,
      storeSlug: challenge?.merchant.slug ?? null,
    },
  });
};

export const markChallengeLimitNoticeRead: RequestHandler = async (req, res) => {
  const memberId: number = res.locals.user.id;
  const noticeId = readChallengeId(req.params.noticeId);
  if (!await prisma.challengeLimitNotice.findUnique({ where: { id: noticeId }, select: { id: true } })) {
    throw new HttpError(404, "CHALLENGE_NOTICE_NOT_FOUND");
  }
  await prisma.challengeLimitNoticeRead.createMany({ data: [{ memberId, noticeId }], skipDuplicates: true });
  res.json({ read: true });
};
