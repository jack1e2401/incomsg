import { HttpError } from "../../lib/http-error.js";

export type CreateAbuseReportInput = { memberId: number; orderId?: number; reason: string };

function invalid(): never {
  throw new HttpError(400, "INVALID_INPUT");
}

function readId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) invalid();
  return value;
}

export function readCreateAbuseReport(value: unknown): CreateAbuseReportInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["memberId", "orderId", "reason"].includes(key))) invalid();
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 1 || reason.length > 2_000) invalid();
  return {
    memberId: readId(input.memberId),
    ...(input.orderId === undefined ? {} : { orderId: readId(input.orderId) }),
    reason,
  };
}
