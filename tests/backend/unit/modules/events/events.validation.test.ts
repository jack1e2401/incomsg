import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readCreateEventInput,
  readEventId,
  readMerchantEventsQuery,
  readPublicEventsQuery,
  readUpdateEventInput,
  slugifyVietnamese,
} from "../../../../../apps/backend/src/modules/merchants/events/events.validation.js";

const invalidInput = { statusCode: 400, code: "INVALID_INPUT" };

test("slugifyVietnamese transliterates Vietnamese characters and strips symbols", () => {
  assert.equal(
    slugifyVietnamese("Đêm Nhạc Acoustic & Thử Cà Phê Đặc Sản!"),
    "dem-nhac-acoustic-thu-ca-phe-dac-san",
  );
  assert.equal(slugifyVietnamese("  Workshop   Đổi   Thưởng   2026  "), "workshop-doi-thuong-2026");
  assert.equal(slugifyVietnamese("!!!🎉!!!"), "su-kien");
  const longSlug = slugifyVietnamese("a ".repeat(120));
  assert.ok(longSlug.length <= 170);
  assert.ok(!longSlug.endsWith("-"));
});

test("readCreateEventInput accepts valid minimal event without slug", () => {
  const result = readCreateEventInput({
    title: "  Workshop Pha Chế  ",
    description: "Dòng 1\nDòng 2",
    startAt: "2026-12-01T09:00:00+07:00",
    endAt: "2026-12-01T11:30:00+07:00",
    locationName: "  Quán Mộc  ",
  });
  assert.equal(result.title, "Workshop Pha Chế");
  assert.equal(result.slug, undefined);
  assert.equal(result.description, "Dòng 1\nDòng 2");
  assert.equal(result.bannerUrl, null);
  assert.equal(result.locationName, "Quán Mộc");
  assert.equal(result.locationAddress, null);
  assert.ok(result.endAt.getTime() > result.startAt.getTime());
});

test("readCreateEventInput accepts allowed bannerUrl schemes and paths", () => {
  for (const bannerUrl of [
    "https://cdn.example.com/banner.jpg",
    "http://localhost:3000/uploads/a.png",
    "/images/independent-cafe.jpg",
    "/uploads/merchant-1/banner.webp",
    null,
  ]) {
    const result = readCreateEventInput({
      title: "Event",
      slug: "event-1",
      description: "Mô tả hợp lệ",
      bannerUrl,
      startAt: "2026-12-01T09:00:00Z",
      endAt: "2026-12-01T10:00:00Z",
      locationName: "Quận 1",
    });
    assert.equal(result.bannerUrl, bannerUrl);
  }
});

test("readCreateEventInput rejects unsafe bannerUrl, bad slugs, and invalid schedule", () => {
  const base = {
    title: "Event",
    description: "Mô tả",
    startAt: "2026-12-01T09:00:00Z",
    endAt: "2026-12-01T10:00:00Z",
    locationName: "Quận 1",
  };

  for (const bannerUrl of [
    "javascript:alert(1)",
    "data:image/png;base64,AAA",
    "vbscript:msgbox(1)",
    "//evil.example.com/img.png",
    "/images/../secret.png",
    "/uploads/",
    "/other/path.png",
    "https://example.com/has space.png",
    "",
  ]) {
    assert.throws(() => readCreateEventInput({ ...base, bannerUrl }), invalidInput);
  }

  for (const slug of ["", "Bad-Slug", "has space", "-leading", "trailing-", "a--b", "a_b"]) {
    assert.throws(() => readCreateEventInput({ ...base, slug }), invalidInput);
  }

  assert.throws(
    () => readCreateEventInput({ ...base, startAt: "2026-12-01T10:00:00Z", endAt: "2026-12-01T10:00:00Z" }),
    invalidInput,
  );
  assert.throws(
    () => readCreateEventInput({ ...base, startAt: "2026-12-01T11:00:00Z", endAt: "2026-12-01T10:00:00Z" }),
    invalidInput,
  );
  assert.throws(
    () => readCreateEventInput({ ...base, startAt: "2026-02-30T10:00:00Z" }),
    invalidInput,
  );
  assert.throws(() => readCreateEventInput({ ...base, description: "   " }), invalidInput);
  assert.throws(() => readCreateEventInput({ ...base, description: "a".repeat(5001) }), invalidInput);
  assert.throws(() => readCreateEventInput({ ...base, merchantId: 99 }), invalidInput);
});

test("readUpdateEventInput validates partial patches and rejects empty or protected fields", () => {
  assert.throws(() => readUpdateEventInput({}), invalidInput);
  assert.throws(() => readUpdateEventInput({ status: "PUBLISHED" }), invalidInput);
  assert.throws(() => readUpdateEventInput({ slug: null }), invalidInput);
  assert.throws(
    () => readUpdateEventInput({ startAt: "2026-12-02T10:00:00Z", endAt: "2026-12-01T10:00:00Z" }),
    invalidInput,
  );

  const patch = readUpdateEventInput({
    title: "Cập nhật",
    bannerUrl: null,
    locationAddress: "   ",
  });
  assert.deepEqual(patch, {
    title: "Cập nhật",
    bannerUrl: null,
    locationAddress: null,
  });
});

test("query and route id validators handle defaults and reject invalid values", () => {
  assert.deepEqual(readMerchantEventsQuery({ status: "", q: "", page: "", limit: "" }), {
    status: undefined,
    q: undefined,
    page: 1,
    limit: 20,
  });
  assert.deepEqual(readMerchantEventsQuery({ status: "PUBLISHED", q: " workshop ", page: "2", limit: "10" }), {
    status: "PUBLISHED",
    q: "workshop",
    page: 2,
    limit: 10,
  });
  assert.throws(() => readMerchantEventsQuery({ status: "ARCHIVED" }), invalidInput);
  assert.throws(() => readMerchantEventsQuery({ limit: "101" }), invalidInput);

  assert.deepEqual(readPublicEventsQuery({}), { scope: "upcoming", page: 1, limit: 20 });
  assert.deepEqual(readPublicEventsQuery({ scope: "past", page: "3", limit: "5" }), {
    scope: "past",
    page: 3,
    limit: 5,
  });
  assert.throws(() => readPublicEventsQuery({ scope: "unknown" }), invalidInput);

  assert.equal(readEventId("42"), 42);
  assert.throws(() => readEventId("0"), invalidInput);
  assert.throws(() => readEventId("abc"), invalidInput);
});
