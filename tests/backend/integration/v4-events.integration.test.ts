import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);

const suffix = randomUUID().slice(0, 8);
const emails = [
  `events-merchant-a-${suffix}@test.local`,
  `events-merchant-b-${suffix}@test.local`,
  `events-merchant-inactive-${suffix}@test.local`,
  `events-member-${suffix}@test.local`,
];
const slugA = `events-store-a-${suffix}`;
const slugB = `events-store-b-${suffix}`;
const slugInactive = `events-store-inactive-${suffix}`;

let server: Server | undefined;
let baseUrl = "";
let merchantAToken = "";
let merchantBToken = "";
let memberToken = "";

before(async () => {
  const [ownerA, ownerB, ownerInactive, member] = await Promise.all([
    prisma.user.create({ data: { email: emails[0], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[1], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[2], passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: emails[3], passwordHash: "fixture", role: "MEMBER" } }),
  ]);

  await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Tiệm Cà Phê A", slug: slugA } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Tiệm Bánh B", slug: slugB } }),
    prisma.merchant.create({
      data: { ownerId: ownerInactive.id, name: "Tiệm Ngưng", slug: slugInactive, isActive: false },
    }),
  ]);

  [merchantAToken, merchantBToken, memberToken] = await Promise.all([
    signAccessToken(ownerA.id),
    signAccessToken(ownerB.id),
    signAccessToken(member.id),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;

    const merchants = await prisma.merchant.findMany({
      where: { ownerId: { in: userIds } },
      select: { id: true },
    });
    const merchantIds = merchants.map((m) => m.id);
    if (merchantIds.length > 0) {
      await prisma.merchantEvent.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function request(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { response, json: (await response.json()) as Record<string, any> };
}

test("merchant event auth & CRUD lifecycle, draft privacy, publish/unpublish, delete rules, and isolation", async () => {
  // 1. Auth checks
  assert.equal((await request("/api/merchant/events")).response.status, 401);
  assert.equal((await request("/api/merchant/events", { token: memberToken })).response.status, 403);

  const now = Date.now();
  const futureStart1 = new Date(now + 48 * 3600_000).toISOString();
  const futureEnd1 = new Date(now + 52 * 3600_000).toISOString();
  const futureStart2 = new Date(now + 24 * 3600_000).toISOString();
  const futureEnd2 = new Date(now + 26 * 3600_000).toISOString();
  const pastStart = new Date(now - 72 * 3600_000).toISOString();
  const pastEnd = new Date(now - 68 * 3600_000).toISOString();

  // 2. Create without slug -> auto-slugify Vietnamese title (starts DRAFT)
  const created1 = await request("/api/merchant/events", {
    method: "POST",
    token: merchantAToken,
    body: {
      title: "Đêm Nhạc Cà Phê",
      description: "Dòng 1\nDòng 2",
      bannerUrl: "/images/independent-cafe.jpg",
      startAt: futureStart1,
      endAt: futureEnd1,
      locationName: "Quán Mộc",
      locationAddress: "123 Lê Lợi, Q.1",
    },
  });
  assert.equal(created1.response.status, 201);
  assert.equal(created1.json.event.status, "DRAFT");
  assert.equal(created1.json.event.slug, "dem-nhac-ca-phe");
  assert.equal(created1.json.event.publishedAt, null);
  const event1Id = created1.json.event.id as number;

  // 3. Auto-slug suffix when omitted for duplicate Vietnamese title
  const created2 = await request("/api/merchant/events", {
    method: "POST",
    token: merchantAToken,
    body: {
      title: "Đêm Nhạc Cà Phê",
      description: "Sự kiện thứ hai",
      startAt: futureStart2,
      endAt: futureEnd2,
      locationName: "Quán Mộc",
    },
  });
  assert.equal(created2.response.status, 201);
  assert.equal(created2.json.event.slug, "dem-nhac-ca-phe-2");
  const event2Id = created2.json.event.id as number;

  // 4. Explicit slug collision within same merchant -> 409 EVENT_SLUG_TAKEN
  const duplicateSlug = await request("/api/merchant/events", {
    method: "POST",
    token: merchantAToken,
    body: {
      title: "Khác tiêu đề",
      slug: "dem-nhac-ca-phe",
      description: "Trùng slug",
      startAt: futureStart1,
      endAt: futureEnd1,
      locationName: "Quán Mộc",
    },
  });
  assert.equal(duplicateSlug.response.status, 409);
  assert.equal(duplicateSlug.json.error, "EVENT_SLUG_TAKEN");

  // 5. Same slug allowed on Merchant B
  const merchantBEvent = await request("/api/merchant/events", {
    method: "POST",
    token: merchantBToken,
    body: {
      title: "Sự kiện B",
      slug: "dem-nhac-ca-phe",
      description: "Cửa hàng khác cùng slug",
      startAt: futureStart1,
      endAt: futureEnd1,
      locationName: "Tiệm Bánh B",
    },
  });
  assert.equal(merchantBEvent.response.status, 201);
  const merchantBEventId = merchantBEvent.json.event.id as number;

  // Publish Merchant B's event to test cross-merchant public isolation too
  assert.equal(
    (await request(`/api/merchant/events/${merchantBEventId}/publish`, { method: "POST", token: merchantBToken }))
      .response.status,
    200,
  );

  // 6. Draft cannot be read publicly
  const publicListBefore = await request(`/api/public/stores/${slugA}/events?scope=all`);
  assert.equal(publicListBefore.response.status, 200);
  assert.equal(publicListBefore.json.items.length, 0);

  const publicDraftDetail = await request(`/api/public/stores/${slugA}/events/dem-nhac-ca-phe`);
  assert.equal(publicDraftDetail.response.status, 404);
  assert.equal(publicDraftDetail.json.error, "EVENT_NOT_FOUND");

  // 7. Cross-merchant isolation for Merchant B accessing Merchant A's event
  assert.equal(
    (await request(`/api/merchant/events/${event1Id}`, { token: merchantBToken })).response.status,
    404,
  );
  assert.equal(
    (
      await request(`/api/merchant/events/${event1Id}`, {
        method: "PATCH",
        token: merchantBToken,
        body: { title: "Hijack" },
      })
    ).response.status,
    404,
  );
  assert.equal(
    (await request(`/api/merchant/events/${event1Id}/publish`, { method: "POST", token: merchantBToken }))
      .response.status,
    404,
  );
  assert.equal(
    (await request(`/api/merchant/events/${event1Id}`, { method: "DELETE", token: merchantBToken })).response.status,
    404,
  );

  // 8. Partial update validation against existing endAt
  const invalidPartial = await request(`/api/merchant/events/${event1Id}`, {
    method: "PATCH",
    token: merchantAToken,
    body: { startAt: new Date(now + 60 * 3600_000).toISOString() },
  });
  assert.equal(invalidPartial.response.status, 400);
  assert.equal(invalidPartial.json.error, "INVALID_INPUT");

  const validPatch = await request(`/api/merchant/events/${event1Id}`, {
    method: "PATCH",
    token: merchantAToken,
    body: { title: "Đêm Nhạc Cà Phê Mộc" },
  });
  assert.equal(validPatch.response.status, 200);
  assert.equal(validPatch.json.event.title, "Đêm Nhạc Cà Phê Mộc");

  // 9. Create a past event and publish events
  const pastCreated = await request("/api/merchant/events", {
    method: "POST",
    token: merchantAToken,
    body: {
      title: "Sự kiện đã qua",
      slug: "su-kien-da-qua",
      description: "Đã diễn ra",
      startAt: pastStart,
      endAt: pastEnd,
      locationName: "Quán Mộc",
    },
  });
  assert.equal(pastCreated.response.status, 201);
  const pastEventId = pastCreated.json.event.id as number;

  const pub1 = await request(`/api/merchant/events/${event1Id}/publish`, {
    method: "POST",
    token: merchantAToken,
  });
  assert.equal(pub1.response.status, 200);
  assert.equal(pub1.json.event.status, "PUBLISHED");
  assert.ok(pub1.json.event.publishedAt);

  assert.equal(
    (await request(`/api/merchant/events/${event2Id}/publish`, { method: "POST", token: merchantAToken }))
      .response.status,
    200,
  );
  assert.equal(
    (await request(`/api/merchant/events/${pastEventId}/publish`, { method: "POST", token: merchantAToken }))
      .response.status,
    200,
  );

  // 10. Public upcoming, past, all & detail
  const upcomingRes = await request(`/api/public/stores/${slugA}/events?scope=upcoming`);
  assert.equal(upcomingRes.response.status, 200);
  assert.deepEqual(
    upcomingRes.json.items.map((e: { id: number }) => e.id),
    [event2Id, event1Id], // ordered startAt asc
  );

  const pastRes = await request(`/api/public/stores/${slugA}/events?scope=past`);
  assert.equal(pastRes.response.status, 200);
  assert.deepEqual(
    pastRes.json.items.map((e: { id: number }) => e.id),
    [pastEventId],
  );

  const publicDetail = await request(`/api/public/stores/${slugA}/events/dem-nhac-ca-phe`);
  assert.equal(publicDetail.response.status, 200);
  assert.equal(publicDetail.json.event.id, event1Id);
  assert.equal(publicDetail.json.merchant.slug, slugA);

  // 11. Inactive merchant returns 404 MERCHANT_NOT_FOUND
  const inactiveRes = await request(`/api/public/stores/${slugInactive}/events`);
  assert.equal(inactiveRes.response.status, 404);
  assert.equal(inactiveRes.json.error, "MERCHANT_NOT_FOUND");

  // 12. Delete published event fails with 409 EVENT_NOT_DRAFT
  const deletePublished = await request(`/api/merchant/events/${event1Id}`, {
    method: "DELETE",
    token: merchantAToken,
  });
  assert.equal(deletePublished.response.status, 409);
  assert.equal(deletePublished.json.error, "EVENT_NOT_DRAFT");

  // 13. Unpublish returns to DRAFT and hides from public
  const unpub = await request(`/api/merchant/events/${event1Id}/unpublish`, {
    method: "POST",
    token: merchantAToken,
  });
  assert.equal(unpub.response.status, 200);
  assert.equal(unpub.json.event.status, "DRAFT");

  const detailAfterUnpublish = await request(`/api/public/stores/${slugA}/events/dem-nhac-ca-phe`);
  assert.equal(detailAfterUnpublish.response.status, 404);
  assert.equal(detailAfterUnpublish.json.error, "EVENT_NOT_FOUND");

  // 14. Merchant list filter & pagination
  const filtered = await request("/api/merchant/events?status=DRAFT&q=Nh%E1%BA%A1c&page=1&limit=10", {
    token: merchantAToken,
  });
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.json.items.length, 1);
  assert.equal(filtered.json.items[0].id, event1Id);
  assert.equal(filtered.json.pagination.totalItems, 1);
  assert.equal(filtered.json.pagination.totalPages, 1);

  // 15. Delete draft succeeds
  const deleteDraft = await request(`/api/merchant/events/${event1Id}`, {
    method: "DELETE",
    token: merchantAToken,
  });
  assert.equal(deleteDraft.response.status, 200);
  assert.deepEqual(deleteDraft.json, { deleted: true });

  const afterDelete = await request(`/api/merchant/events/${event1Id}`, { token: merchantAToken });
  assert.equal(afterDelete.response.status, 404);
});
