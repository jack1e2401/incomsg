import { HttpError } from "../../lib/http-error.js";
import type { EventStatus } from "../../generated/prisma/enums.js";
import type {
  CreateEventInput,
  ListMerchantEventsQuery,
  ListPublicEventsQuery,
  PublicEventScope,
  UpdateEventInput,
} from "./events.types.js";

const MAX_INT_ID = 2_147_483_647;
export const EVENT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const ALLOWED_EVENT_FIELDS = [
  "title",
  "slug",
  "description",
  "bannerUrl",
  "startAt",
  "endAt",
  "locationName",
  "locationAddress",
] as const;

function invalidInput(): never {
  throw new HttpError(400, "INVALID_INPUT");
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidInput();
  }
  return value as Record<string, unknown>;
}

function rejectUnexpectedFields(input: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    invalidInput();
  }
}

export function slugifyVietnamese(value: string): string {
  const base = value
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 170)
    .replace(/-+$/g, "");
  return base || "su-kien";
}

function readRequiredText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") invalidInput();
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) invalidInput();
  return trimmed;
}

function readEventSlug(value: unknown): string {
  if (typeof value !== "string") invalidInput();
  if (value.length < 1 || value.length > 191 || !EVENT_SLUG_REGEX.test(value)) {
    invalidInput();
  }
  return value;
}

function readBannerUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalidInput();
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 2048) invalidInput();
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) invalidInput();

  if (trimmed.startsWith("/images/") || trimmed.startsWith("/uploads/")) {
    const prefix = trimmed.startsWith("/images/") ? "/images/" : "/uploads/";
    if (trimmed.length <= prefix.length || trimmed.includes("..") || trimmed.includes("\\")) {
      invalidInput();
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      invalidInput();
    }
  } catch {
    invalidInput();
  }
  return trimmed;
}

function readLocationAddress(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalidInput();
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) invalidInput();
  return trimmed;
}

function readIsoDate(value: unknown): Date {
  if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) {
    invalidInput();
  }
  const [datePart, timeAndZone] = value.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const check = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month! - 1 ||
    check.getUTCDate() !== day
  ) {
    invalidInput();
  }
  const timePart = timeAndZone!.replace(/(?:Z|[+-]\d{2}:\d{2})$/, "");
  const [hourStr, minuteStr, secPart] = timePart.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = secPart ? Number(secPart) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second >= 60) {
    invalidInput();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalidInput();
  return parsed;
}

function readPositiveInt(value: unknown, fallback: number, max = MAX_INT_ID): number {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" && typeof value !== "number") invalidInput();
  const raw = String(value).trim();
  if (!/^[1-9]\d*$/.test(raw)) invalidInput();
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) invalidInput();
  return parsed;
}

export function readEventId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) invalidInput();
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_INT_ID) invalidInput();
  return id;
}

export function readRouteSlug(value: unknown): string {
  if (typeof value !== "string") invalidInput();
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 191) invalidInput();
  return trimmed;
}

export function readCreateEventInput(value: unknown): CreateEventInput {
  const input = readObject(value);
  rejectUnexpectedFields(input, ALLOWED_EVENT_FIELDS);

  const title = readRequiredText(input.title, 191);
  const description = readRequiredText(input.description, 5000);
  const startAt = readIsoDate(input.startAt);
  const endAt = readIsoDate(input.endAt);
  if (endAt.getTime() <= startAt.getTime()) {
    invalidInput();
  }
  const locationName = readRequiredText(input.locationName, 191);

  const result: CreateEventInput = {
    title,
    description,
    startAt,
    endAt,
    locationName,
    bannerUrl: input.bannerUrl === undefined ? null : readBannerUrl(input.bannerUrl),
    locationAddress: input.locationAddress === undefined ? null : readLocationAddress(input.locationAddress),
  };

  if (input.slug !== undefined && input.slug !== null) {
    result.slug = readEventSlug(input.slug);
  }

  return result;
}

export function readUpdateEventInput(value: unknown): UpdateEventInput {
  const input = readObject(value);
  rejectUnexpectedFields(input, ALLOWED_EVENT_FIELDS);
  if (Object.keys(input).length === 0) invalidInput();

  const patch: UpdateEventInput = {};
  if ("title" in input) patch.title = readRequiredText(input.title, 191);
  if ("slug" in input) patch.slug = readEventSlug(input.slug);
  if ("description" in input) patch.description = readRequiredText(input.description, 5000);
  if ("bannerUrl" in input) patch.bannerUrl = readBannerUrl(input.bannerUrl);
  if ("startAt" in input) patch.startAt = readIsoDate(input.startAt);
  if ("endAt" in input) patch.endAt = readIsoDate(input.endAt);
  if ("locationName" in input) patch.locationName = readRequiredText(input.locationName, 191);
  if ("locationAddress" in input) patch.locationAddress = readLocationAddress(input.locationAddress);

  if (patch.startAt && patch.endAt && patch.endAt.getTime() <= patch.startAt.getTime()) {
    invalidInput();
  }

  return patch;
}

export function readMerchantEventsQuery(value: unknown): ListMerchantEventsQuery {
  const query = readObject(value);
  rejectUnexpectedFields(query, ["status", "q", "page", "limit"]);

  let status: EventStatus | undefined;
  if (query.status !== undefined && query.status !== "") {
    if (query.status !== "DRAFT" && query.status !== "PUBLISHED") invalidInput();
    status = query.status;
  }

  let q: string | undefined;
  if (query.q !== undefined && query.q !== "") {
    if (typeof query.q !== "string") invalidInput();
    const trimmed = query.q.trim();
    if (trimmed.length > 191) invalidInput();
    if (trimmed.length > 0) q = trimmed;
  }

  const page = readPositiveInt(query.page, 1);
  const limit = readPositiveInt(query.limit, 20, 100);
  return { status, q, page, limit };
}

export function readPublicEventsQuery(value: unknown): ListPublicEventsQuery {
  const query = readObject(value);
  rejectUnexpectedFields(query, ["scope", "page", "limit"]);

  let scope: PublicEventScope = "upcoming";
  if (query.scope !== undefined && query.scope !== "") {
    if (query.scope !== "upcoming" && query.scope !== "past" && query.scope !== "all") {
      invalidInput();
    }
    scope = query.scope;
  }

  const page = readPositiveInt(query.page, 1);
  const limit = readPositiveInt(query.limit, 20, 100);
  return { scope, page, limit };
}
