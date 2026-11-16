import { HttpError } from "../../lib/http-error.js";
import type {
  StorefrontAllowedLink,
  StorefrontBrandingConfig,
  StorefrontConfig,
  StorefrontOpeningHoursDay,
  StorefrontWeekday,
  StorefrontSectionConfig,
  StorefrontSectionKey,
} from "./storefront.types.js";

export const STOREFRONT_SECTION_KEYS: readonly StorefrontSectionKey[] = [
  "hero",
  "featured_products",
  "categories",
  "upcoming_events",
  "store_info",
  "footer",
] as const;

const SECTION_KEY_SET = new Set<string>(STOREFRONT_SECTION_KEYS);
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIVE_STORE_LINK_REGEX = /^\/s\/[a-z0-9]+(?:-[a-z0-9]+)*(?:[/?#][^\s<>]*)?$/;
const SAFE_LOCAL_IMAGE_REGEX = /^\/(?:images|uploads)\/[^\s<>"{}|\\^`]+$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function containsHtmlOrScript(value: string): boolean {
  return /<script/i.test(value) || /<[^>]*>/.test(value);
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}

function readRequiredText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength || containsHtmlOrScript(trimmed)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return trimmed;
}

function readNullableText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength || containsHtmlOrScript(trimmed)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return trimmed;
}

export function isValidImageUrl(url: string): boolean {
  if (url.length > 2048 || /[\s<>"{}|\\^`]/.test(url)) return false;
  if (SAFE_LOCAL_IMAGE_REGEX.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function readNullableImageUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!isValidImageUrl(trimmed)) throw new HttpError(400, "INVALID_INPUT");
  return trimmed;
}

function readOpeningHours(value: unknown): StorefrontOpeningHoursDay[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== 7) throw new HttpError(400, "INVALID_INPUT");
  const days = new Set<number>();
  return value.map((item) => {
    const record = readObject(item);
    if (typeof record.day !== "number" || !Number.isInteger(record.day) || record.day < 1 || record.day > 7 || days.has(record.day)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    const day = record.day as StorefrontWeekday;
    days.add(day);
    if (typeof record.closed !== "boolean") throw new HttpError(400, "INVALID_INPUT");
    if (record.closed) return { day, closed: true, openTime: null, closeTime: null };
    if (
      typeof record.openTime !== "string" || !TIME_REGEX.test(record.openTime) ||
      typeof record.closeTime !== "string" || !TIME_REGEX.test(record.closeTime)
    ) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    return {
      day,
      closed: false,
      openTime: record.openTime,
      closeTime: record.closeTime,
    };
  });
}

export function isValidStorefrontLink(url: string): boolean {
  if (url.length > 2048) return false;
  const lowered = url.toLowerCase();
  if (
    lowered.startsWith("//") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return false;
  }
  if (RELATIVE_STORE_LINK_REGEX.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readNullableStorefrontLink(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "INVALID_INPUT");
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!isValidStorefrontLink(trimmed)) throw new HttpError(400, "INVALID_INPUT");
  return trimmed;
}

function readAllowedLinks(value: unknown): StorefrontAllowedLink[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 8) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return value.map((item) => {
    const record = readObject(item);
    const label = readRequiredText(record.label, 60);
    if (typeof record.url !== "string") throw new HttpError(400, "INVALID_INPUT");
    const url = record.url.trim();
    if (!url || !isValidStorefrontLink(url)) throw new HttpError(400, "INVALID_INPUT");
    return { label, url };
  });
}

function readBranding(value: unknown): StorefrontBrandingConfig {
  const input = readObject(value);
  const primaryColor = input.primaryColor === undefined
    ? "#335e3d"
    : typeof input.primaryColor === "string" && HEX_COLOR_REGEX.test(input.primaryColor.trim())
      ? input.primaryColor.trim()
      : (() => { throw new HttpError(400, "INVALID_INPUT"); })();

  const contactEmail = readNullableText(input.contactEmail, 191);
  if (contactEmail !== null && !EMAIL_REGEX.test(contactEmail)) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  return {
    logoUrl: readNullableImageUrl(input.logoUrl),
    storeImageUrl: readNullableImageUrl(input.storeImageUrl),
    bannerUrl: readNullableImageUrl(input.bannerUrl),
    primaryColor,
    heroTitle: readRequiredText(input.heroTitle, 120),
    heroDescription: readNullableText(input.heroDescription, 500),
    heroImageUrl: readNullableImageUrl(input.heroImageUrl),
    heroCtaText: readNullableText(input.heroCtaText, 60),
    heroCtaLink: readNullableStorefrontLink(input.heroCtaLink),
    footerDescription: readNullableText(input.footerDescription, 500),
    contactEmail,
    contactPhone: readNullableText(input.contactPhone, 40),
    address: readNullableText(input.address, 255),
    openingHours: readOpeningHours(input.openingHours),
    allowedLinks: readAllowedLinks(input.allowedLinks),
  };
}

function readSections(value: unknown): StorefrontSectionConfig[] {
  if (!Array.isArray(value) || value.length !== STOREFRONT_SECTION_KEYS.length) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  const seenKeys = new Set<string>();
  const seenOrders = new Set<number>();

  const normalized = value.map((item) => {
    const record = readObject(item);
    if (typeof record.key !== "string" || !SECTION_KEY_SET.has(record.key) || seenKeys.has(record.key)) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    seenKeys.add(record.key);

    if (typeof record.enabled !== "boolean") {
      throw new HttpError(400, "INVALID_INPUT");
    }

    if (
      typeof record.order !== "number" ||
      !Number.isInteger(record.order) ||
      record.order < 0 ||
      record.order > 5 ||
      seenOrders.has(record.order)
    ) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    seenOrders.add(record.order);

    const title = readNullableText(record.title, 120);
    const subtitle = readNullableText(record.subtitle, 255);

    return {
      key: record.key as StorefrontSectionKey,
      enabled: record.enabled,
      order: record.order,
      ...(title !== null ? { title } : { title: null }),
      ...(subtitle !== null ? { subtitle } : { subtitle: null }),
    };
  });

  if (seenKeys.size !== STOREFRONT_SECTION_KEYS.length || seenOrders.size !== STOREFRONT_SECTION_KEYS.length) {
    throw new HttpError(400, "INVALID_INPUT");
  }

  return normalized.sort((a, b) => a.order - b.order);
}

function readFeaturedProductIds(value: unknown, maxItems: number): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const uniqueIds: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1 || item > 2_147_483_647) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    if (!seen.has(item)) {
      seen.add(item);
      uniqueIds.push(item);
    }
  }
  return uniqueIds;
}

export function readStorefrontConfig(value: unknown): StorefrontConfig {
  const input = readObject(value);
  return {
    branding: readBranding(input.branding),
    sections: readSections(input.sections),
    featuredProductIds: readFeaturedProductIds(input.featuredProductIds, 12),
  };
}

export function readStorefrontNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const input = readObject(value);
  return readNullableText(input.note, 255);
}

export function readVersionId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  return id;
}

export function defaultStorefrontConfig(merchantName: string, slug: string): StorefrontConfig {
  const trimmedName = merchantName.trim();
  const safeHeroTitle = (trimmedName && !containsHtmlOrScript(trimmedName)
    ? trimmedName
    : "Cửa hàng"
  ).slice(0, 120);

  return {
    branding: {
      logoUrl: null,
      storeImageUrl: null,
      bannerUrl: null,
      primaryColor: "#335e3d",
      heroTitle: safeHeroTitle,
      heroDescription: null,
      heroImageUrl: null,
      heroCtaText: "Khám phá sản phẩm",
      heroCtaLink: `/s/${slug}`,
      footerDescription: null,
      contactEmail: null,
      contactPhone: null,
      address: null,
      openingHours: null,
      allowedLinks: [],
    },
    sections: [
      { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
      { key: "featured_products", enabled: true, order: 1, title: "Sản phẩm nổi bật", subtitle: null },
      { key: "categories", enabled: true, order: 2, title: "Danh mục", subtitle: null },
      { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện sắp tới", subtitle: null },
      { key: "store_info", enabled: true, order: 4, title: "Thông tin cửa hàng", subtitle: null },
      { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
    ],
    featuredProductIds: [],
  };
}
