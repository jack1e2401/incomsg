import { Prisma } from "../../generated/prisma/client.js";
import type { ChallengeType, ChallengeStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { merchantService } from "../merchant/merchant.service.js";
import { grantChallengeReward } from "./challenges.engine.js";
import { buildDefaultChallengeMilestones, type ChallengeMilestoneInput } from "./challenges.milestones.js";

export type ChallengeInput = { title: string; description: string; type: ChallengeType; targetValue: Prisma.Decimal; rewardPoints: Prisma.Decimal; budgetTotal: Prisma.Decimal; startsAt: Date; endsAt: Date; isFeatured: boolean; milestones: ChallengeMilestoneInput[]; status?: "DRAFT" | "ACTIVE" };
export type ChallengePatch = Partial<ChallengeInput>;
type ChallengeMilestoneRow = { position: number; thresholdValue: Prisma.Decimal; title: string; description: string };
type ChallengeRow = Prisma.ChallengeGetPayload<{ include: { milestones: true; _count: { select: { progresses: true } } } }> & { inProgressCount?: number; completedCount?: number; waitingBudgetCount?: number };
const challengeInclude = { milestones: { orderBy: { position: "asc" } }, _count: { select: { progresses: true } } } as const;
const pagination = (page: number, limit: number, totalItems: number) => ({ page, limit, totalItems, totalPages: totalItems ? Math.ceil(totalItems / limit) : 0 });
const paged = (query: Record<string, unknown>) => ({ page: Math.max(1, Number(query.page) || 1), limit: Math.min(100, Math.max(1, Number(query.limit) || 20)) });
const publicSelect = { id: true, merchantId: true, title: true, description: true, type: true, status: true, targetValue: true, rewardPoints: true, startsAt: true, endsAt: true, isFeatured: true, milestones: { orderBy: { position: "asc" } } } as const;
function milestoneDtos(rows: ChallengeMilestoneRow[] | undefined, type: ChallengeType, targetValue: Prisma.Decimal | string) {
  if (!rows?.length) {
    return buildDefaultChallengeMilestones(type, typeof targetValue === "string" ? targetValue : targetValue.toFixed(0))
      .map((milestone, index) => ({ position: index + 1, ...milestone }));
  }
  return [...rows].sort((a, b) => a.position - b.position).map((milestone) => ({
    position: milestone.position,
    thresholdValue: milestone.thresholdValue.toFixed(0),
    title: milestone.title,
    description: milestone.description,
  }));
}
function milestoneRows(challengeId: number, milestones: ChallengeMilestoneInput[]) {
  return milestones.map((milestone, index) => ({
    challengeId,
    position: index + 1,
    thresholdValue: new Prisma.Decimal(milestone.thresholdValue),
    title: milestone.title,
    description: milestone.description,
  }));
}
function sameMilestoneStructure(existing: ChallengeMilestoneInput[], next: ChallengeMilestoneInput[]) {
  return existing.length === next.length && existing.every((milestone, index) => milestone.thresholdValue === next[index]?.thresholdValue);
}
function publicDto(c: { id: number; merchantId: number; title: string; description: string; type: ChallengeType; status: ChallengeStatus; targetValue: Prisma.Decimal; rewardPoints: Prisma.Decimal; startsAt: Date; endsAt: Date; isFeatured: boolean; milestones?: ChallengeMilestoneRow[] }, now = new Date()) {
  const effectiveStatus = ["ACTIVE", "PAUSED"].includes(c.status) && c.endsAt < now ? "ENDED" : c.status;
  return { id: c.id, merchantId: c.merchantId, title: c.title, description: c.description, type: c.type, effectiveStatus, targetValue: c.targetValue.toFixed(0), rewardPoints: c.rewardPoints.toFixed(12), startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), isFeatured: c.isFeatured, milestones: milestoneDtos(c.milestones, c.type, c.targetValue) };
}
function dateInHcm(now: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
function dayRange(dateKey: string) { return { start: new Date(`${dateKey}T00:00:00+07:00`), end: new Date(`${dateKey}T00:00:00+07:00`).getTime() + 86400000 }; }

export const challengesService = {
  async listMerchant(ownerId: number, query: Record<string, unknown>) {
    const merchant = await merchantService.getOwnStore(ownerId); const { page, limit } = paged(query);
    const now = new Date();
    const statusFilter = typeof query.status === "string" && query.status ? query.status : "";
    const statusWhere: Prisma.ChallengeWhereInput =
      statusFilter === "ENDED"
        ? { status: { in: ["ACTIVE", "PAUSED"] }, endsAt: { lt: now } }
        : statusFilter === "ACTIVE" || statusFilter === "PAUSED"
          ? { status: statusFilter as ChallengeStatus, endsAt: { gte: now } }
          : statusFilter
            ? { status: statusFilter as ChallengeStatus }
            : {};
    const where: Prisma.ChallengeWhereInput = {
      merchantId: merchant.id,
      ...statusWhere,
      ...(typeof query.type === "string" && query.type ? { type: query.type as ChallengeType } : {}),
      ...(typeof query.q === "string" && query.q ? { title: { contains: query.q } } : {}),
    };
    const [items, totalItems] = await Promise.all([prisma.challenge.findMany({ where, include: challengeInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }), prisma.challenge.count({ where })]);
    const grouped = items.length ? await prisma.challengeProgress.groupBy({ by: ["challengeId", "rewardState"], where: { challengeId: { in: items.map((c) => c.id) } }, _count: { _all: true } }) : [];
    const counts = new Map<number, { IN_PROGRESS: number; REWARDED: number; WAITING_BUDGET: number }>();
    for (const row of grouped) { const value = counts.get(row.challengeId) ?? { IN_PROGRESS: 0, REWARDED: 0, WAITING_BUDGET: 0 }; value[row.rewardState] = row._count._all; counts.set(row.challengeId, value); }
    return { items: items.map((c) => { const count = counts.get(c.id); return this.toMerchantDto({ ...c, inProgressCount: count?.IN_PROGRESS, completedCount: count?.REWARDED, waitingBudgetCount: count?.WAITING_BUDGET }); }), pagination: pagination(page, limit, totalItems) };
  },
  toMerchantDto(c: ChallengeRow) {
    const now = new Date(); const effectiveStatus = ["ACTIVE", "PAUSED"].includes(c.status) && c.endsAt < now ? "ENDED" : c.status;
    return { id: c.id, merchantId: c.merchantId, title: c.title, description: c.description, type: c.type, status: c.status, effectiveStatus, targetValue: c.targetValue.toFixed(0), rewardPoints: c.rewardPoints.toFixed(12), budgetTotal: c.budgetTotal.toFixed(12), budgetSpent: c.budgetSpent.toFixed(12), budgetRemaining: c.budgetTotal.minus(c.budgetSpent).toFixed(12), startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), isFeatured: c.isFeatured, milestones: milestoneDtos(c.milestones, c.type, c.targetValue), hasProgress: Boolean(c._count?.progresses), lockedFields: Boolean(c.activatedAt || c._count?.progresses), inProgressCount: c.inProgressCount ?? 0, completedCount: c.completedCount ?? 0, waitingBudgetCount: c.waitingBudgetCount ?? 0, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
  },
  async create(ownerId: number, input: ChallengeInput) {
    const merchant = await merchantService.getOwnStore(ownerId);
    if (!input.targetValue.greaterThan(0) || !input.rewardPoints.greaterThan(0) || input.budgetTotal.lessThan(0) || input.endsAt <= input.startsAt) {
      throw new HttpError(400, "INVALID_CHALLENGE_CONFIGURATION");
    }
    if (input.status === "ACTIVE") this.validateActivation(input);
    const { milestones, ...challengeData } = input;
    return prisma.$transaction(async (tx) => {
      if (input.isFeatured) await tx.challenge.updateMany({ where: { merchantId: merchant.id }, data: { isFeatured: false } });
      const c = await tx.challenge.create({
        data: {
          ...challengeData,
          merchantId: merchant.id,
          activatedAt: input.status === "ACTIVE" ? new Date() : null,
          milestones: { create: milestones.map((milestone, index) => ({ position: index + 1, thresholdValue: new Prisma.Decimal(milestone.thresholdValue), title: milestone.title, description: milestone.description })) },
        },
        include: challengeInclude,
      });
      return this.toMerchantDto(c);
    }, { isolationLevel: "Serializable" });
  },
  validateActivation(c: { targetValue: Prisma.Decimal; rewardPoints: Prisma.Decimal; budgetTotal: Prisma.Decimal; startsAt: Date; endsAt: Date }) {
    if (!c.targetValue.greaterThan(0) || !c.rewardPoints.greaterThan(0) || !c.budgetTotal.greaterThanOrEqualTo(c.rewardPoints) || c.endsAt <= c.startsAt) throw new HttpError(400, "INVALID_CHALLENGE_CONFIGURATION");
  },
  async update(ownerId: number, id: number, patch: ChallengePatch) {
    const merchant = await merchantService.getOwnStore(ownerId);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.challenge.findFirst({ where: { id, merchantId: merchant.id }, include: challengeInclude });
      if (!existing) throw new HttpError(404, "CHALLENGE_NOT_FOUND");
      const isLocked = Boolean(existing.activatedAt || existing._count.progresses);
      if (isLocked) {
        const changedLocked =
          (patch.type !== undefined && patch.type !== existing.type) ||
          (patch.targetValue !== undefined && !patch.targetValue.equals(existing.targetValue)) ||
          (patch.rewardPoints !== undefined && !patch.rewardPoints.equals(existing.rewardPoints)) ||
          (patch.startsAt !== undefined && patch.startsAt.getTime() !== existing.startsAt.getTime());
        if (changedLocked) throw new HttpError(409, "CHALLENGE_FIELDS_LOCKED");
      }
      const nextStartsAt = patch.startsAt ?? existing.startsAt;
      const nextEndsAt = patch.endsAt ?? existing.endsAt;
      if (nextEndsAt <= nextStartsAt) throw new HttpError(400, "CHALLENGE_INVALID_DATE_RANGE");
      if (patch.budgetTotal !== undefined && patch.budgetTotal.lessThan(existing.budgetSpent)) {
        throw new HttpError(400, "CHALLENGE_INVALID_BUDGET");
      }
      const nextType = patch.type ?? existing.type;
      const nextTargetValue = patch.targetValue ?? existing.targetValue;
      let milestonesToSave = patch.milestones;
      if (milestonesToSave && !new Prisma.Decimal(milestonesToSave.at(-1)?.thresholdValue ?? "0").equals(nextTargetValue)) {
        throw new HttpError(400, "INVALID_INPUT");
      }
      if (isLocked && milestonesToSave) {
        const existingMilestones = milestoneDtos(existing.milestones, existing.type, existing.targetValue)
          .map(({ thresholdValue, title, description }) => ({ thresholdValue, title, description }));
        if (!sameMilestoneStructure(existingMilestones, milestonesToSave)) throw new HttpError(409, "CHALLENGE_FIELDS_LOCKED");
      }
      const goalChanged = nextType !== existing.type || !nextTargetValue.equals(existing.targetValue);
      if (!milestonesToSave && !isLocked && goalChanged) milestonesToSave = buildDefaultChallengeMilestones(nextType, nextTargetValue.toFixed(0));
      if (patch.isFeatured) await tx.challenge.updateMany({ where: { merchantId: merchant.id, id: { not: id } }, data: { isFeatured: false } });
      const { milestones: _milestones, ...challengePatch } = patch;
      const data: Prisma.ChallengeUpdateInput = isLocked
        ? {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.budgetTotal !== undefined ? { budgetTotal: patch.budgetTotal } : {}),
            ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
            ...(patch.isFeatured !== undefined ? { isFeatured: patch.isFeatured } : {}),
          }
        : challengePatch;
      let c = await tx.challenge.update({ where: { id }, data, include: challengeInclude });
      if (milestonesToSave) {
        await tx.challengeMilestone.deleteMany({ where: { challengeId: id } });
        await tx.challengeMilestone.createMany({ data: milestoneRows(id, milestonesToSave) });
        c = await tx.challenge.findUniqueOrThrow({ where: { id }, include: challengeInclude });
      }
      const replenishedCount = patch.budgetTotal && c.status === "ACTIVE" ? await this.replenish(tx, id) : 0;
      const refreshed = replenishedCount > 0 ? await tx.challenge.findUniqueOrThrow({ where: { id }, include: challengeInclude }) : c;
      return { challenge: this.toMerchantDto(refreshed), replenishedCount };
    }, { isolationLevel: "Serializable" });
  },
  async replenish(tx: Prisma.TransactionClient, challengeId: number) {
    const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } }); if (challenge.status !== "ACTIVE") return 0;
    const queue = await tx.challengeProgress.findMany({ where: { challengeId, rewardState: "WAITING_BUDGET" }, orderBy: [{ completedAt: "asc" }, { id: "asc" }] }); let granted = 0;
    for (const progress of queue) { if (!await grantChallengeReward(tx, challengeId, progress.id, progress.membershipId, challenge.rewardPoints, new Date())) break; granted += 1; } return granted;
  },
  async activate(ownerId: number, id: number) {
    const merchant = await merchantService.getOwnStore(ownerId);
    return prisma.$transaction(async (tx) => { const challenge = await tx.challenge.findFirst({ where: { id, merchantId: merchant.id } }); if (!challenge) throw new HttpError(404, "CHALLENGE_NOT_FOUND"); this.validateActivation(challenge); const active = await tx.challenge.update({ where: { id }, data: { status: "ACTIVE", activatedAt: challenge.activatedAt ?? new Date() }, include: challengeInclude }); const replenishedCount = await this.replenish(tx, id); const refreshed = replenishedCount > 0 ? await tx.challenge.findUniqueOrThrow({ where: { id }, include: challengeInclude }) : active; return { challenge: this.toMerchantDto(refreshed), replenishedCount }; }, { isolationLevel: "Serializable" });
  },
  async setStatus(ownerId: number, id: number, status: "PAUSED" | "ARCHIVED") { const merchant = await merchantService.getOwnStore(ownerId); const c = await prisma.challenge.updateMany({ where: { id, merchantId: merchant.id }, data: { status } }); if (!c.count) throw new HttpError(404, "CHALLENGE_NOT_FOUND"); const updated = await prisma.challenge.findUniqueOrThrow({ where: { id }, include: challengeInclude }); return { challenge: this.toMerchantDto(updated) }; },
  async detail(ownerId: number, id: number, query: Record<string, unknown>) {
    const merchant = await merchantService.getOwnStore(ownerId); const { page, limit } = paged(query);
    const challenge = await prisma.challenge.findFirst({ where: { id, merchantId: merchant.id }, include: challengeInclude });
    if (!challenge) throw new HttpError(404, "CHALLENGE_NOT_FOUND");
    const where = { challengeId: id };
    const [items, totalItems, grants, inProgressCount, completedCount, waitingBudgetCount] = await Promise.all([
      prisma.challengeProgress.findMany({ where, include: { membership: { include: { member: { select: { id: true, email: true } } } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
      prisma.challengeProgress.count({ where }),
      prisma.challengeRewardGrant.findMany({ where: { progress: { challengeId: id } }, include: { progress: { include: { membership: { include: { member: { select: { id: true, email: true } } } } } } }, orderBy: { grantedAt: "desc" }, take: 20 }),
      prisma.challengeProgress.count({ where: { challengeId: id, rewardState: "IN_PROGRESS" } }),
      prisma.challengeProgress.count({ where: { challengeId: id, rewardState: "REWARDED" } }),
      prisma.challengeProgress.count({ where: { challengeId: id, rewardState: "WAITING_BUDGET" } }),
    ]);
    return {
      challenge: this.toMerchantDto({ ...challenge, inProgressCount, completedCount, waitingBudgetCount }),
      participants: {
        items: items.map((p) => ({
          progressId: p.id,
          membershipId: p.membershipId,
          memberId: p.membership.member.id,
          memberEmail: p.membership.member.email,
          currentValue: p.currentValue.toFixed(0),
          targetValue: challenge.targetValue.toFixed(0),
          rewardState: p.rewardState,
          rewardCycle: p.rewardCycle,
          completedAt: p.completedAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
        })),
        pagination: pagination(page, limit, totalItems),
      },
      recentGrants: grants.map((g) => ({
        id: g.id,
        progressId: g.progressId,
        memberId: g.progress.membership.member.id,
        memberEmail: g.progress.membership.member.email,
        cycle: g.cycle,
        status: g.status,
        pointsGranted: g.pointsGranted.toFixed(12),
        earnTransactionId: g.earnTransactionId,
        reversalTransactionId: g.reversalTransactionId,
        grantedAt: g.grantedAt.toISOString(),
        reversedAt: g.reversedAt?.toISOString() ?? null,
      })),
    };
  },
  async delete(ownerId: number, id: number) {
    const merchant = await merchantService.getOwnStore(ownerId);
    return prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findFirst({ where: { id, merchantId: merchant.id } }); if (!challenge) throw new HttpError(404, "CHALLENGE_NOT_FOUND");
      const [progressCount, grantCount] = await Promise.all([tx.challengeProgress.count({ where: { challengeId: id } }), tx.challengeRewardGrant.count({ where: { progress: { challengeId: id } } })]);
      if (progressCount || grantCount) throw new HttpError(409, "CHALLENGE_HAS_PROGRESS");
      await tx.challenge.delete({ where: { id } }); return { deleted: true as const };
    }, { isolationLevel: "Serializable" });
  },
  async listPublic(slug: string) {
    const merchant = await prisma.merchant.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true } }); if (!merchant) throw new HttpError(404, "STORE_NOT_FOUND"); const now = new Date();
    const raw = await prisma.challenge.findMany({ where: { merchantId: merchant.id, status: "ACTIVE", startsAt: { lte: now } }, select: publicSelect, orderBy: [{ isFeatured: "desc" }, { startsAt: "asc" }, { id: "asc" }] });
    const challenges = raw.map((c) => publicDto(c, now));
    const heroChallenge = challenges.find((c) => c.effectiveStatus === "ACTIVE") ?? null;
    return { merchant, heroChallenge, challenges };
  },
  async getPublic(slug: string, id: number) { const list = await this.listPublic(slug); const challenge = list.challenges.find((c) => c.id === id); if (!challenge) throw new HttpError(404, "CHALLENGE_NOT_FOUND"); return { merchant: list.merchant, challenge }; },
  async listMember(memberId: number, slug: string) {
    const list = await this.listPublic(slug); const membership = await prisma.merchantMembership.findUnique({ where: { memberId_merchantId: { memberId, merchantId: list.merchant.id } } }); const dateKey = dateInHcm(new Date()); const range = dayRange(dateKey);
    const checkedInToday = membership ? Boolean(await prisma.memberActivity.findFirst({ where: { membershipId: membership.id, type: "DAILY_CHECKIN", occurredAt: { gte: range.start, lt: new Date(range.end) } }, select: { id: true } })) : false;
    const progress = membership ? await prisma.challengeProgress.findMany({ where: { membershipId: membership.id, challengeId: { in: list.challenges.map((c) => c.id) } }, include: { grants: { where: { status: "GRANTED" }, orderBy: { cycle: "desc" }, take: 1 } } }) : [];
    const byId = new Map(progress.map((p) => [p.challengeId, p]));
    const enrich = (item: typeof list.challenges[number]) => { const p = byId.get(item.id); const current = new Prisma.Decimal(p?.currentValue ?? 0); const target = new Prisma.Decimal(item.targetValue); return { ...item, progress: p ? { currentValue: current.toFixed(0), targetValue: target.toFixed(0), remainingValue: Prisma.Decimal.max(target.minus(current), 0).toFixed(0), percent: Math.min(100, current.div(target).mul(100).toNumber()), rewardState: p.rewardState, rewardCycle: p.rewardCycle, completedAt: p.completedAt?.toISOString() ?? null, grantedAt: p.grants[0]?.grantedAt.toISOString() ?? null } : null }; };
    const enriched = list.challenges.map(enrich);
    const activeIncomplete = enriched.filter((c) => c.effectiveStatus === "ACTIVE" && c.progress?.rewardState !== "REWARDED");
    const inProgress = activeIncomplete
      .filter((c) => c.progress && Number(c.progress.currentValue) > 0 && c.progress.rewardState === "IN_PROGRESS")
      .sort((a, b) => (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0) || Number(b.isFeatured) - Number(a.isFeatured));
    const heroChallenge =
      inProgress[0] ??
      activeIncomplete.find((c) => c.isFeatured) ??
      activeIncomplete[0] ??
      enriched.find((c) => c.effectiveStatus === "ACTIVE" && c.isFeatured) ??
      enriched.find((c) => c.effectiveStatus === "ACTIVE") ??
      null;
    return { merchant: list.merchant, checkedInToday, todayDateKey: dateKey, heroChallenge, challenges: enriched };
  },
  async getMember(memberId: number, slug: string, id: number) {
    const list = await this.listMember(memberId, slug); const challenge = list.challenges.find((item) => item.id === id); if (!challenge) throw new HttpError(404, "CHALLENGE_NOT_FOUND");
    const membership = await prisma.merchantMembership.findUnique({ where: { memberId_merchantId: { memberId, merchantId: list.merchant.id } } });
    const entries = membership ? await prisma.challengeProgressEntry.findMany({ where: { progress: { challengeId: id, membershipId: membership.id } }, include: { activity: true }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
    return { merchant: list.merchant, checkedInToday: list.checkedInToday, todayDateKey: list.todayDateKey, challenge, recentEntries: entries.map((entry) => ({ id: entry.id, activityType: entry.activity.type, deltaValue: entry.deltaValue.toFixed(0), orderId: entry.activity.orderId, occurredAt: entry.activity.occurredAt.toISOString() })) };
  },
  async checkIn(memberId: number, slug: string) {
    const merchant = await prisma.merchant.findFirst({ where: { slug, isActive: true }, select: { id: true } }); if (!merchant) throw new HttpError(404, "STORE_NOT_FOUND"); const now = new Date(); const dateKey = dateInHcm(now); const range = dayRange(dateKey); const membership = await prisma.merchantMembership.upsert({ where: { memberId_merchantId: { memberId, merchantId: merchant.id } }, create: { memberId, merchantId: merchant.id }, update: {} });
    return prisma.$transaction(async (tx) => {
      const exists = await tx.memberActivity.findFirst({ where: { membershipId: membership.id, type: "DAILY_CHECKIN", occurredAt: { gte: range.start, lt: new Date(range.end) } } }); if (exists) return { checkedIn: true, alreadyCheckedInToday: true, dateKey, updatedChallenges: [] };
      const activity = await tx.memberActivity.create({ data: { membershipId: membership.id, type: "DAILY_CHECKIN", eventKey: `checkin-${membership.id}-${dateKey}`, occurredAt: now } }); const active = await tx.challenge.findMany({ where: { merchantId: merchant.id, type: "DAILY_CHECKIN", status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } } }); const updatedChallenges = [];
      for (const c of active) { const p = await tx.challengeProgress.upsert({ where: { challengeId_membershipId: { challengeId: c.id, membershipId: membership.id } }, create: { challengeId: c.id, membershipId: membership.id }, update: {} }); await tx.challengeProgressEntry.create({ data: { progressId: p.id, activityId: activity.id, deltaValue: 1 } }); const value = p.currentValue.plus(1); const qualifies = value.greaterThanOrEqualTo(c.targetValue) && p.rewardState === "IN_PROGRESS"; await tx.challengeProgress.update({ where: { id: p.id }, data: { currentValue: value, ...(qualifies ? { rewardState: "WAITING_BUDGET", completedAt: now } : {}) } }); let awarded = false; if (qualifies) awarded = await grantChallengeReward(tx, c.id, p.id, membership.id, c.rewardPoints, now); updatedChallenges.push({ challengeId: c.id, title: c.title, currentValue: value.toFixed(0), targetValue: c.targetValue.toFixed(0), rewardState: awarded ? "REWARDED" : qualifies ? "WAITING_BUDGET" : p.rewardState, pointsAwardedExact: awarded ? c.rewardPoints.toFixed(12) : null }); }
      return { checkedIn: true, alreadyCheckedInToday: false, dateKey, updatedChallenges };
    }, { isolationLevel: "Serializable" });
  },
};
