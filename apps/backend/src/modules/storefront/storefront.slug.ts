import { HttpError } from "../../lib/http-error.js";

export const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "merchant",
  "member",
  "login",
  "register",
  "api",
  "uploads",
  "s",
]);

export const STORE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MIN_STORE_SLUG_LENGTH = 3;
export const MAX_STORE_SLUG_LENGTH = 63;

export function isValidStoreSlug(slug: string): boolean {
  return (
    slug.length >= MIN_STORE_SLUG_LENGTH &&
    slug.length <= MAX_STORE_SLUG_LENGTH &&
    STORE_SLUG_REGEX.test(slug) &&
    !RESERVED_STORE_SLUGS.has(slug)
  );
}

export function validateExplicitSlug(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const normalized = raw.trim();
  if (!isValidStoreSlug(normalized)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return normalized;
}

export function slugifyStoreName(storeName: string): string {
  const ascii = storeName
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let base = ascii || "store";
  if (base.length > 55) {
    base = base.slice(0, 55).replace(/-+$/g, "") || "store";
  }
  if (base.length < MIN_STORE_SLUG_LENGTH || RESERVED_STORE_SLUGS.has(base)) {
    base = `${base}-store`;
  }
  if (base.length > 55) {
    base = base.slice(0, 55).replace(/-+$/g, "") || "store";
  }
  return base;
}

export function fallbackSlug(storeName: string, applicationId: number): string {
  const suffix = `-${applicationId}`;
  const maxBaseLen = Math.max(3, MAX_STORE_SLUG_LENGTH - suffix.length);
  const rawBase = slugifyStoreName(storeName).slice(0, maxBaseLen).replace(/-+$/g, "") || "store";
  const candidate = `${rawBase}${suffix}`;
  return isValidStoreSlug(candidate) ? candidate : `store-${applicationId}`;
}
