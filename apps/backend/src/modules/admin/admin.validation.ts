import type { AdminAuditAction, AdminAuditTargetType, AccountStatus, UserRole } from "../../generated/prisma/enums.js";
import { HttpError } from "../../lib/http-error.js";

function invalid(): never {
  throw new HttpError(400, "INVALID_INPUT");
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid();
}

export function readId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) invalid();
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) invalid();
  return id;
}

function readReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 1 || reason.length > 255) invalid();
  return reason;
}

export function readUserStatusChange(value: unknown): { status: "ACTIVE" | "SUSPENDED" | "BANNED"; reason: string } {
  const input = readObject(value);
  rejectUnknownKeys(input, ["status", "reason"]);
  if (input.status !== "ACTIVE" && input.status !== "SUSPENDED" && input.status !== "BANNED") invalid();
  return { status: input.status, reason: readReason(input.reason) };
}

export function readMerchantStatusChange(value: unknown): { isActive: boolean; reason: string } {
  const input = readObject(value);
  rejectUnknownKeys(input, ["isActive", "reason"]);
  if (typeof input.isActive !== "boolean") invalid();
  return { isActive: input.isActive, reason: readReason(input.reason) };
}

export function readBlacklistCreate(value: unknown): { email: string; reason: string } {
  const input = readObject(value);
  rejectUnknownKeys(input, ["email", "reason"]);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid();
  return { email, reason: readReason(input.reason) };
}

function readPage(query: Record<string, unknown>): { cursor: number | null; limit: number } {
  const cursor = query.cursor === undefined ? null : readId(query.cursor);
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
  return { cursor, limit };
}

function readQuery(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  const query = readObject(value);
  rejectUnknownKeys(query, allowed);
  return query;
}

export function readUserListQuery(value: unknown) {
  const query = readQuery(value, ["search", "status", "role", "cursor", "limit"]);
  const search = query.search === undefined ? undefined : typeof query.search === "string" ? query.search.trim() : invalid();
  if (search && search.length > 191) invalid();
  const statuses: AccountStatus[] = ["ACTIVE", "PENDING_APPROVAL", "REJECTED", "SUSPENDED", "BANNED"];
  const roles: UserRole[] = ["ADMIN", "MERCHANT", "MEMBER"];
  if (query.status !== undefined && (typeof query.status !== "string" || !statuses.includes(query.status as AccountStatus))) invalid();
  if (query.role !== undefined && (typeof query.role !== "string" || !roles.includes(query.role as UserRole))) invalid();
  return { ...readPage(query), search, status: query.status as AccountStatus | undefined, role: query.role as UserRole | undefined };
}

export function readBlacklistListQuery(value: unknown) {
  const query = readQuery(value, ["search", "active", "cursor", "limit"]);
  const search = query.search === undefined ? undefined : typeof query.search === "string" ? query.search.trim() : invalid();
  if (search && search.length > 191) invalid();
  if (query.active !== undefined && query.active !== "true" && query.active !== "false") invalid();
  return { ...readPage(query), search, active: query.active === undefined ? undefined : query.active === "true" };
}

export function readAuditListQuery(value: unknown) {
  const query = readQuery(value, ["actorId", "action", "targetType", "targetId", "from", "to", "cursor", "limit"]);
  const actions: AdminAuditAction[] = ["USER_STATUS_CHANGED", "EMAIL_BLACKLISTED", "EMAIL_BLACKLIST_DEACTIVATED", "MERCHANT_STATUS_CHANGED"];
  const targetTypes: AdminAuditTargetType[] = ["USER", "EMAIL_BLACKLIST", "MERCHANT"];
  if (query.action !== undefined && (typeof query.action !== "string" || !actions.includes(query.action as AdminAuditAction))) invalid();
  if (query.targetType !== undefined && (typeof query.targetType !== "string" || !targetTypes.includes(query.targetType as AdminAuditTargetType))) invalid();
  const readDate = (input: unknown) => {
    if (input === undefined) return undefined;
    if (typeof input !== "string" || !Number.isFinite(Date.parse(input))) invalid();
    return new Date(input);
  };
  const actorId = query.actorId === undefined ? undefined : readId(query.actorId);
  const targetId = query.targetId === undefined ? undefined : readId(query.targetId);
  return {
    ...readPage(query),
    actorId,
    targetId,
    action: query.action as AdminAuditAction | undefined,
    targetType: query.targetType as AdminAuditTargetType | undefined,
    from: readDate(query.from),
    to: readDate(query.to),
  };
}

export function readAbuseReportListQuery(value: unknown) {
  const query = readQuery(value, ["merchantId", "memberId", "cursor", "limit"]);
  const merchantId = query.merchantId === undefined ? undefined : readId(query.merchantId);
  const memberId = query.memberId === undefined ? undefined : readId(query.memberId);
  return { ...readPage(query), merchantId, memberId };
}

export function readReasonBody(value: unknown): { reason: string } {
  const input = readObject(value);
  rejectUnknownKeys(input, ["reason"]);
  return { reason: readReason(input.reason) };
}
