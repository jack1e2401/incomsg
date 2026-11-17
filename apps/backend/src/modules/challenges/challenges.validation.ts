import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { ChallengeType } from "../../generated/prisma/enums.js";

export function readChallengeId(value: unknown): number { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "INVALID_INPUT"); return id; }
export function readChallengeInput(value: unknown, partial = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "INVALID_INPUT");
  const body = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const text = (key: string, max: number, required: boolean) => { const v = body[key]; if (v === undefined && !required) return; if (typeof v !== "string" || !v.trim() || v.length > max) throw new HttpError(400, "INVALID_INPUT"); result[key] = v.trim(); };
  text("title", 191, !partial); text("description", 20000, !partial);
  if (body.type !== undefined || !partial) { if (!["ORDER_COUNT", "DAILY_CHECKIN", "SPEND_TOTAL"].includes(String(body.type))) throw new HttpError(400, "INVALID_INPUT"); result.type = body.type as ChallengeType; }
  for (const field of ["targetValue", "rewardPoints", "budgetTotal"] as const) {
    if (body[field] === undefined && partial) continue;
    const raw = body[field];
    try {
      const d = new Prisma.Decimal(String(raw));
      const minViolation = field === "budgetTotal" ? d.lessThan(0) : d.lessThanOrEqualTo(0);
      if (!d.isFinite() || minViolation || (field === "targetValue" && !d.isInteger())) throw new Error();
      result[field] = d;
    } catch {
      throw new HttpError(400, "INVALID_INPUT");
    }
  }
  for (const field of ["startsAt", "endsAt"] as const) {
    if (body[field] === undefined && partial) continue;
    const d = new Date(String(body[field]));
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "INVALID_INPUT");
    result[field] = d;
  }
  if (result.startsAt instanceof Date && result.endsAt instanceof Date && result.endsAt <= result.startsAt) {
    throw new HttpError(400, "CHALLENGE_INVALID_DATE_RANGE");
  }
  if (body.isFeatured !== undefined) { if (typeof body.isFeatured !== "boolean") throw new HttpError(400, "INVALID_INPUT"); result.isFeatured = body.isFeatured; }
  if (!partial && body.status !== undefined) { if (body.status !== "DRAFT" && body.status !== "ACTIVE") throw new HttpError(400, "INVALID_INPUT"); result.status = body.status; }
  return result;
}
