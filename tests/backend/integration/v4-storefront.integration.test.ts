import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

let tempUploadDir: string;
let server: Server;
let baseUrl: string;

const suffix = randomUUID();
const adminEmail = `v4-sf-admin-${suffix}@test.local`;
const memberEmail = `v4-sf-member-${suffix}@test.local`;
const merchantAEmail = `v4-sf-ma-${suffix}@test.local`;
const merchantBEmail = `v4-sf-mb-${suffix}@test.local`;
const merchantCEmail = `v4-sf-mc-${suffix}@test.local`;
const password = `v4-test-${suffix}-password`;

const [{ app }, { prisma }, { hashPassword }, { defaultStorefrontConfig }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/password.js"),
  import("../../../apps/backend/src/modules/storefront/storefront.validation.js"),
]);

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

before(async () => {
  tempUploadDir = await mkdtemp(path.join(os.tmpdir(), "incomsg-v4-uploads-"));
  process.env.UPLOAD_DIR = tempUploadDir;

  await prisma.user.createMany({
    data: [
      {
        email: adminEmail,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        accountStatus: "ACTIVE",
      },
      {
        email: memberEmail,
        passwordHash: await hashPassword(password),
        role: "MEMBER",
        accountStatus: "ACTIVE",
      },
    ],
  });

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  const users = await prisma.user.findMany({
    where: { email: { in: [adminEmail, memberEmail, merchantAEmail, merchantBEmail, merchantCEmail] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const merchants = await prisma.merchant.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const merchantIds = merchants.map((m) => m.id);
  if (merchantIds.length > 0) {
    await prisma.merchantEvent.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.productImage.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.productCategory.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.storefrontConfigVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.storefrontDraft.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  }
  await prisma.merchantApplication.deleteMany({ where: { applicantId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await rm(tempUploadDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

test("merchant slug creation, collision, approval init, draft/preview/publish/rollback, isolation, and media upload", async () => {
  const adminToken = await loginAs(adminEmail);
  const memberToken = await loginAs(memberEmail);

  // 1. Register merchant A with Vietnamese name and omitted slug -> auto-slugifies
  const uniqueBaseName = `Cà Phê Mộc ${suffix.slice(0, 6)}`;
  const regA = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: merchantAEmail,
      password,
      storeName: uniqueBaseName,
    }),
  });
  assert.equal(regA.status, 201);
  const regABody = (await regA.json()) as {
    application: { id: number; slug: string | null; storeName: string };
  };
  const expectedSlugA = `ca-phe-moc-${suffix.slice(0, 6).toLowerCase()}`;
  assert.equal(regABody.application.slug, expectedSlugA);

  // 2. Reject reserved slug or colliding explicit slug against pending application
  const reservedReg = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `reserved-${suffix}@test.local`,
      password,
      storeName: "Reserved Shop",
      slug: "admin",
    }),
  });
  assert.equal(reservedReg.status, 400);

  const collidingAppReg = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `collide-${suffix}@test.local`,
      password,
      storeName: "Another Shop",
      slug: expectedSlugA,
    }),
  });
  assert.equal(collidingAppReg.status, 409);
  assert.equal((await collidingAppReg.json()).error, "SLUG_TAKEN");

  // 3. Register merchant B with same storeName & omitted slug -> auto-suffix "-2"
  const regB = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: merchantBEmail,
      password,
      storeName: uniqueBaseName,
    }),
  });
  assert.equal(regB.status, 201);
  const regBBody = (await regB.json()) as { application: { id: number; slug: string } };
  assert.equal(regBBody.application.slug, `${expectedSlugA}-2`);

  // 4. Approve both merchants -> initializes StorefrontConfigVersion v1 + StorefrontDraft
  const approveA = await fetch(`${baseUrl}/api/admin/merchants/${regABody.application.id}/approve`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(approveA.status, 200);
  const merchantA = (await approveA.json()).merchant as { id: number; slug: string; name: string };
  assert.equal(merchantA.slug, expectedSlugA);

  const approveB = await fetch(`${baseUrl}/api/admin/merchants/${regBBody.application.id}/approve`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(approveB.status, 200);
  const merchantB = (await approveB.json()).merchant as { id: number; slug: string };

  // 5. Explicit slug colliding with approved Merchant.slug -> 409 SLUG_TAKEN
  const collidingMerchantReg = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: merchantCEmail,
      password,
      storeName: "Shop C",
      slug: merchantA.slug,
    }),
  });
  assert.equal(collidingMerchantReg.status, 409);
  assert.equal((await collidingMerchantReg.json()).error, "SLUG_TAKEN");

  const tokenA = await loginAs(merchantAEmail);
  const tokenB = await loginAs(merchantBEmail);

  // 6. Seed products, category, and events (1 published upcoming, 1 draft, 1 published past) for merchant A + 1 product for B
  const [prodARes, prodBRes] = await Promise.all([
    fetch(`${baseUrl}/api/merchant/products`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: "Cà phê sữa đá", price: "45000", kind: "SALE", initialQuantity: 10 }),
    }),
    fetch(`${baseUrl}/api/merchant/products`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: "Trà đào B", price: "50000", kind: "SALE", initialQuantity: 10 }),
    }),
  ]);
  assert.equal(prodARes.status, 201);
  assert.equal(prodBRes.status, 201);
  const productA = (await prodARes.json()).product as { id: number };
  const productB = (await prodBRes.json()).product as { id: number };

  await prisma.productCategory.create({
    data: { merchantId: merchantA.id, name: "Cà phê pha phin", slug: "ca-phe-pha-phin", sortOrder: 1 },
  });
  const now = Date.now();
  await prisma.merchantEvent.createMany({
    data: [
      {
        merchantId: merchantA.id,
        title: "Workshop Rang Xay",
        slug: "workshop-rang-xay",
        description: "Trải nghiệm rang cà phê",
        startAt: new Date(now + 86_400_000),
        endAt: new Date(now + 2 * 86_400_000),
        locationName: "Quán Mộc",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      {
        merchantId: merchantA.id,
        title: "Sự kiện nháp",
        slug: "su-kien-nhap",
        description: "Chưa công bố",
        startAt: new Date(now + 86_400_000),
        endAt: new Date(now + 2 * 86_400_000),
        locationName: "Quán Mộc",
        status: "DRAFT",
      },
      {
        merchantId: merchantA.id,
        title: "Sự kiện đã qua",
        slug: "su-kien-da-qua",
        description: "Đã kết thúc",
        startAt: new Date(now - 3 * 86_400_000),
        endAt: new Date(now - 2 * 86_400_000),
        locationName: "Quán Mộc",
        status: "PUBLISHED",
        publishedAt: new Date(now - 4 * 86_400_000),
      },
    ],
  });

  // 7. Authorization checks: guest & member cannot access merchant storefront or media endpoints
  assert.equal((await fetch(`${baseUrl}/api/merchant/storefront`)).status, 401);
  assert.equal(
    (await fetch(`${baseUrl}/api/merchant/storefront/preview`, { headers: { authorization: `Bearer ${memberToken}` } })).status,
    403,
  );
  assert.equal(
    (await fetch(`${baseUrl}/api/merchant/media/upload`, { method: "POST", headers: { authorization: `Bearer ${memberToken}` } })).status,
    403,
  );

  // 8. Media upload validation & static serving with X-Content-Type-Options: nosniff
  const boundary = "----V4UploadTest";
  const fakePngBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="evil.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from("<script>alert(1)</script>"),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const fakeUploadRes = await fetch(`${baseUrl}/api/merchant/media/upload`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenA}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body: fakePngBody,
  });
  assert.equal(fakeUploadRes.status, 400);
  assert.equal((await fakeUploadRes.json()).error, "INVALID_FILE_TYPE");

  const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validUploadBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`),
    validPngBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const uploadRes = await fetch(`${baseUrl}/api/merchant/media/upload`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenA}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body: validUploadBody,
  });
  assert.equal(uploadRes.status, 201);
  const uploaded = (await uploadRes.json()) as { url: string; mimeType: string; size: number };
  assert.ok(uploaded.url.startsWith(`/uploads/merchant-${merchantA.id}/`));
  assert.equal(uploaded.mimeType, "image/png");
  assert.equal(uploaded.size, validPngBytes.length);

  const staticFileRes = await fetch(`${baseUrl}${uploaded.url}`);
  assert.equal(staticFileRes.status, 200);
  assert.equal(staticFileRes.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await staticFileRes.arrayBuffer()), validPngBytes);

  // 9. Cross-merchant featuredProductIds rejected on draft save
  const crossDraftConfig = defaultStorefrontConfig(merchantA.name, merchantA.slug);
  crossDraftConfig.featuredProductIds = [productB.id];
  const crossDraftRes = await fetch(`${baseUrl}/api/merchant/storefront/draft`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
    body: JSON.stringify(crossDraftConfig),
  });
  assert.equal(crossDraftRes.status, 400);
  assert.equal((await crossDraftRes.json()).error, "INVALID_FEATURED_PRODUCTS");

  // 10. Save valid draft -> public storefront still returns v1 until published
  const updatedConfig = defaultStorefrontConfig(merchantA.name, merchantA.slug);
  updatedConfig.branding.logoUrl = uploaded.url;
  updatedConfig.branding.heroTitle = "Cà phê rang mộc chuẩn vị";
  updatedConfig.branding.primaryColor = "#24452f";
  updatedConfig.featuredProductIds = [productA.id];
  updatedConfig.sections = [
    { key: "featured_products", enabled: true, order: 0, title: "Món đặc trưng", subtitle: null },
    { key: "hero", enabled: true, order: 1, title: null, subtitle: null },
    { key: "categories", enabled: true, order: 2, title: "Danh mục", subtitle: null },
    { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện", subtitle: null },
    { key: "store_info", enabled: true, order: 4, title: "Liên hệ", subtitle: null },
    { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
  ];

  const saveDraftRes = await fetch(`${baseUrl}/api/merchant/storefront/draft`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
    body: JSON.stringify(updatedConfig),
  });
  assert.equal(saveDraftRes.status, 200);

  const previewRes = await fetch(`${baseUrl}/api/merchant/storefront/preview`, {
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert.equal(previewRes.status, 200);
  const previewBody = (await previewRes.json()) as {
    isDraftPreview: boolean;
    config: { branding: { heroTitle: string } };
    featuredProducts: { id: number }[];
  };
  assert.equal(previewBody.isDraftPreview, true);
  assert.equal(previewBody.config.branding.heroTitle, "Cà phê rang mộc chuẩn vị");
  assert.deepEqual(previewBody.featuredProducts.map((p) => p.id), [productA.id]);

  const publicBeforePublish = await fetch(`${baseUrl}/api/public/stores/${merchantA.slug}`);
  assert.equal(publicBeforePublish.status, 200);
  const publicV1 = (await publicBeforePublish.json()) as {
    version: { id: number; version: number };
    config: { branding: { heroTitle: string } };
    categories: { name: string }[];
    upcomingEvents: { slug: string }[];
    featuredProducts: { id: number }[];
  };
  assert.equal(publicV1.version.version, 1);
  assert.equal(publicV1.config.branding.heroTitle, uniqueBaseName);
  assert.equal(publicV1.featuredProducts.length, 0);
  assert.deepEqual(publicV1.categories.map((c) => c.name), ["Cà phê pha phin"]);
  assert.deepEqual(publicV1.upcomingEvents.map((e) => e.slug), ["workshop-rang-xay"]);

  // 11. Publish v2 -> public storefront updates; merchant B cannot rollback merchant A's version; merchant A rolls back to v1 -> creates v3
  const publishRes = await fetch(`${baseUrl}/api/merchant/storefront/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ note: "Ra mắt giao diện mới" }),
  });
  assert.equal(publishRes.status, 201);
  const publishedV2 = (await publishRes.json()) as { published: { id: number; version: number } };
  assert.equal(publishedV2.published.version, 2);

  const publicAfterPublish = await fetch(`${baseUrl}/api/public/stores/${merchantA.slug}`);
  const publicV2 = (await publicAfterPublish.json()) as {
    version: { version: number };
    config: { branding: { heroTitle: string; logoUrl: string | null } };
    featuredProducts: { id: number }[];
  };
  assert.equal(publicV2.version.version, 2);
  assert.equal(publicV2.config.branding.heroTitle, "Cà phê rang mộc chuẩn vị");
  assert.equal(publicV2.config.branding.logoUrl, uploaded.url);
  assert.deepEqual(publicV2.featuredProducts.map((p) => p.id), [productA.id]);

  const crossRollbackRes = await fetch(
    `${baseUrl}/api/merchant/storefront/versions/${publicV1.version.id}/rollback`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({}),
    },
  );
  assert.equal(crossRollbackRes.status, 404);
  assert.equal((await crossRollbackRes.json()).error, "VERSION_NOT_FOUND");

  const rollbackRes = await fetch(
    `${baseUrl}/api/merchant/storefront/versions/${publicV1.version.id}/rollback`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ note: "Quay lại bản gốc" }),
    },
  );
  assert.equal(rollbackRes.status, 201);
  const rolledBack = (await rollbackRes.json()) as {
    published: { version: number; source: string; sourceVersionId: number };
  };
  assert.equal(rolledBack.published.version, 3);
  assert.equal(rolledBack.published.source, "ROLLBACK");
  assert.equal(rolledBack.published.sourceVersionId, publicV1.version.id);

  // Unknown slug returns 404 MERCHANT_NOT_FOUND
  const missingStore = await fetch(`${baseUrl}/api/public/stores/nonexistent-store-slug-999`);
  assert.equal(missingStore.status, 404);
});
