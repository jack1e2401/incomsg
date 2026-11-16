import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../../../../apps/backend/src/lib/http-error.js";
import {
  MAX_MEDIA_FILE_BYTES,
  detectImageFormat,
  parseSingleFileMultipartBuffer,
} from "../../../../../apps/backend/src/modules/media/media.multipart.js";
import {
  fallbackSlug,
  slugifyStoreName,
  validateExplicitSlug,
} from "../../../../../apps/backend/src/modules/storefront/storefront.slug.js";
import {
  defaultStorefrontConfig,
  readStorefrontConfig,
} from "../../../../../apps/backend/src/modules/storefront/storefront.validation.js";

test("slugifyStoreName transliterates Vietnamese characters and avoids reserved words", () => {
  assert.equal(slugifyStoreName("Cà Phê Mộc Đỏ"), "ca-phe-moc-do");
  assert.equal(slugifyStoreName("Đồ Gỗ Mỹ Nghệ"), "do-go-my-nghe");
  assert.equal(slugifyStoreName("!!!"), "store");
  assert.equal(slugifyStoreName("Admin"), "admin-store");
  assert.equal(slugifyStoreName("S"), "s-store");
  assert.equal(fallbackSlug("Tiệm Trà Sữa", 42), "tiem-tra-sua-42");
});

test("validateExplicitSlug accepts valid slugs and rejects reserved or malformed ones", () => {
  assert.equal(validateExplicitSlug("ca-phe-moc"), "ca-phe-moc");
  assert.equal(validateExplicitSlug("shop123"), "shop123");

  for (const invalid of ["ab", "a".repeat(64), "My-Shop", "my_shop", "-shop", "shop-", "a--b", "admin", "merchant", "member", "login", "register", "api", "uploads", "s"]) {
    assert.throws(
      () => validateExplicitSlug(invalid),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && error.code === "INVALID_INPUT",
    );
  }
});

test("readStorefrontConfig validates branding, safe links, sections, and featuredProductIds", () => {
  const valid = defaultStorefrontConfig("Cà Phê Mộc", "ca-phe-moc");
  valid.branding.logoUrl = "/uploads/merchant-1/logo.png";
  valid.branding.bannerUrl = "https://cdn.example.com/banner.webp";
  valid.branding.heroCtaLink = "/s/ca-phe-moc/events";
  valid.branding.allowedLinks = [
    { label: "Trang chủ", url: "/s/ca-phe-moc" },
    { label: "Website", url: "https://example.com" },
  ];
  valid.featuredProductIds = [10, 20];

  const parsed = readStorefrontConfig(valid);
  assert.equal(parsed.branding.primaryColor, "#335e3d");
  assert.deepEqual(parsed.featuredProductIds, [10, 20]);
  assert.equal(parsed.sections.length, 6);

  // Reject HTML / script injection in text fields
  const withScript = structuredClone(valid);
  withScript.branding.heroTitle = "<script>alert(1)</script>";
  assert.throws(() => readStorefrontConfig(withScript), (e: unknown) => e instanceof HttpError && e.statusCode === 400);

  const withTagInSection = structuredClone(valid);
  withTagInSection.sections[0].title = "<b>Xin chào</b>";
  assert.throws(() => readStorefrontConfig(withTagInSection), (e: unknown) => e instanceof HttpError && e.statusCode === 400);

  // Reject unsafe CTA & footer links
  for (const badLink of ["javascript:alert(1)", "data:text/html,hi", "//evil.com", "http://insecure.example.com", "/admin"]) {
    const bad = structuredClone(valid);
    bad.branding.heroCtaLink = badLink;
    assert.throws(() => readStorefrontConfig(bad), (e: unknown) => e instanceof HttpError && e.statusCode === 400);
  }

  // Reject invalid hex color
  const badColor = structuredClone(valid);
  badColor.branding.primaryColor = "green";
  assert.throws(() => readStorefrontConfig(badColor), (e: unknown) => e instanceof HttpError && e.statusCode === 400);

  // Reject duplicate section order
  const dupOrder = structuredClone(valid);
  dupOrder.sections[1].order = 0;
  assert.throws(() => readStorefrontConfig(dupOrder), (e: unknown) => e instanceof HttpError && e.statusCode === 400);

  // Reject > 12 featured products
  const tooManyFeatured = structuredClone(valid);
  tooManyFeatured.featuredProductIds = Array.from({ length: 13 }, (_, idx) => idx + 1);
  assert.throws(() => readStorefrontConfig(tooManyFeatured), (e: unknown) => e instanceof HttpError && e.statusCode === 400);
});

test("detectImageFormat and parseSingleFileMultipartBuffer enforce magic bytes and 5MB limit", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  assert.deepEqual(detectImageFormat(pngHeader, "image/png"), { mimeType: "image/png", ext: "png" });

  const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  assert.deepEqual(detectImageFormat(jpgHeader, "image/jpeg"), { mimeType: "image/jpeg", ext: "jpg" });

  const webpHeader = Buffer.from("RIFF\x00\x00\x00\x00WEBP", "latin1");
  assert.deepEqual(detectImageFormat(webpHeader, "image/webp"), { mimeType: "image/webp", ext: "webp" });

  assert.throws(
    () => detectImageFormat(Buffer.from("<svg><script>alert(1)</script></svg>"), "image/png"),
    (e: unknown) => e instanceof HttpError && e.code === "INVALID_FILE_TYPE",
  );

  const boundary = "----TestBoundary123";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`, "latin1"),
    pngHeader,
    Buffer.from(`\r\n--${boundary}--\r\n`, "latin1"),
  ]);
  const parsed = parseSingleFileMultipartBuffer(body, boundary);
  assert.equal(parsed.detected.ext, "png");
  assert.deepEqual(parsed.buffer, pngHeader);

  const oversized = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.png"\r\nContent-Type: image/png\r\n\r\n`, "latin1"),
    pngHeader,
    Buffer.alloc(MAX_MEDIA_FILE_BYTES, 0x00),
    Buffer.from(`\r\n--${boundary}--\r\n`, "latin1"),
  ]);
  assert.throws(
    () => parseSingleFileMultipartBuffer(oversized, boundary),
    (e: unknown) => e instanceof HttpError && e.statusCode === 413 && e.code === "FILE_TOO_LARGE",
  );
});
