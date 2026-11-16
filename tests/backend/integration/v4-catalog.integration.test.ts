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

const suffix = randomUUID();
const merchantAEmail = `v4-cat-a-${suffix}@test.local`;
const merchantBEmail = `v4-cat-b-${suffix}@test.local`;
const inactiveMerchantEmail = `v4-cat-inactive-${suffix}@test.local`;
const memberEmail = `v4-cat-member-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, inactiveMerchantEmail, memberEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let merchantASlug: string;
let merchantBSlug: string;
let inactiveMerchantSlug: string;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;

before(async () => {
  const [ownerA, ownerB, inactiveOwner, member] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: inactiveMerchantEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
  ]);

  merchantASlug = `v4-cat-a-${suffix}`;
  merchantBSlug = `v4-cat-b-${suffix}`;
  inactiveMerchantSlug = `v4-cat-inactive-${suffix}`;

  const [merchantA] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: ownerA.id, name: "Tiệm A", slug: merchantASlug } }),
    prisma.merchant.create({ data: { ownerId: ownerB.id, name: "Tiệm B", slug: merchantBSlug } }),
    prisma.merchant.create({
      data: { ownerId: inactiveOwner.id, name: "Tiệm Ẩn", slug: inactiveMerchantSlug, isActive: false },
    }),
  ]);

  merchantAId = merchantA.id;
  merchantAToken = await signAccessToken(ownerA.id);
  merchantBToken = await signAccessToken(ownerB.id);
  memberToken = await signAccessToken(member.id);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((err) => (err ? reject(err) : resolve())));
  }
  const users = await prisma.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
  const userIds = users.map(({ id }) => id);
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const merchantIds = merchants.map(({ id }) => id);

  const orders = await prisma.order.findMany({
    where: { OR: [{ memberId: { in: userIds } }, { merchantId: { in: merchantIds } }] },
    select: { id: true },
  });
  const orderIds = orders.map(({ id }) => id);

  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.productImage.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.productCategory.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function request(path: string, method: string, token?: string, body?: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, json: (await response.json()) as Record<string, any> };
}

test("categories CRUD, Vietnamese auto-slug, merchant isolation, and safe product detachment on delete", async () => {
  const created = await request("/api/merchant/categories", "POST", merchantAToken, {
    name: "Cà phê đặc biệt",
    description: "Rang xay tại xưởng",
    sortOrder: 1,
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.category.slug, "ca-phe-dac-biet");
  assert.equal(created.json.category.sortOrder, 1);
  const categoryId = created.json.category.id as number;

  // Duplicate name or slug in same merchant -> 409 CATEGORY_ALREADY_EXISTS
  const dupName = await request("/api/merchant/categories", "POST", merchantAToken, {
    name: "Cà phê đặc biệt",
    slug: "other-slug",
  });
  assert.equal(dupName.response.status, 409);
  assert.equal(dupName.json.error, "CATEGORY_ALREADY_EXISTS");

  const dupSlug = await request("/api/merchant/categories", "POST", merchantAToken, {
    name: "Tên khác",
    slug: "ca-phe-dac-biet",
  });
  assert.equal(dupSlug.response.status, 409);
  assert.equal(dupSlug.json.error, "CATEGORY_ALREADY_EXISTS");

  // Same name/slug in Merchant B is allowed
  const merchantBCat = await request("/api/merchant/categories", "POST", merchantBToken, {
    name: "Cà phê đặc biệt",
  });
  assert.equal(merchantBCat.response.status, 201);
  const merchantBCatId = merchantBCat.json.category.id as number;

  // Cross-merchant PATCH/DELETE -> 404 CATEGORY_NOT_FOUND
  const crossPatch = await request(`/api/merchant/categories/${categoryId}`, "PATCH", merchantBToken, {
    name: "Hacked",
  });
  assert.equal(crossPatch.response.status, 404);
  assert.equal(crossPatch.json.error, "CATEGORY_NOT_FOUND");

  const crossDelete = await request(`/api/merchant/categories/${categoryId}`, "DELETE", merchantBToken);
  assert.equal(crossDelete.response.status, 404);

  // Assign category to product, then delete category -> product categoryId becomes null
  const prod = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Latte Muối",
    price: "55000",
    categoryId,
  });
  assert.equal(prod.response.status, 201);
  assert.equal(prod.json.product.categoryId, categoryId);
  assert.equal(prod.json.product.category.slug, "ca-phe-dac-biet");

  // Cross-merchant categoryId on product create/update -> 404 CATEGORY_NOT_FOUND
  const crossProd = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Bad Category Product",
    price: "25000",
    categoryId: merchantBCatId,
  });
  assert.equal(crossProd.response.status, 404);
  assert.equal(crossProd.json.error, "CATEGORY_NOT_FOUND");

  const deleted = await request(`/api/merchant/categories/${categoryId}`, "DELETE", merchantAToken);
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleted.json, { deleted: true });

  const listAfter = await request(`/api/merchant/products?q=${encodeURIComponent("Latte Muối")}`, "GET", merchantAToken);
  assert.equal(listAfter.json.items[0].categoryId, null);
  assert.equal(listAfter.json.items[0].category, null);
});

test("SKU uniqueness per merchant, gallery sync, and lowStockThreshold flag", async () => {
  const first = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Espresso",
    price: "40000",
    sku: "ESP-001",
    initialQuantity: 3,
    lowStockThreshold: 5,
    richDescription: "Đậm vị hạt Robusta\nThủ công.",
    images: [
      { url: "/uploads/merchant-1/second.jpg", altText: "Góc 2", sortOrder: 2 },
      { url: "/images/espresso-main.jpg", altText: "Chính", sortOrder: 0 },
    ],
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.json.product.sku, "ESP-001");
  assert.equal(first.json.product.imageUrl, "/images/espresso-main.jpg");
  assert.equal(first.json.product.images.length, 2);
  assert.equal(first.json.product.images[0].url, "/images/espresso-main.jpg");
  assert.equal(first.json.product.isLowStock, true);
  assert.equal(first.json.product.lowStockThreshold, 5);

  // Duplicate SKU in same merchant -> 409 SKU_ALREADY_EXISTS
  const dupSku = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Espresso 2",
    price: "42000",
    sku: "ESP-001",
  });
  assert.equal(dupSku.response.status, 409);
  assert.equal(dupSku.json.error, "SKU_ALREADY_EXISTS");

  // Same SKU in Merchant B -> 201
  const otherMerchantSameSku = await request("/api/merchant/products", "POST", merchantBToken, {
    name: "B Espresso",
    price: "45000",
    sku: "ESP-001",
    imageUrl: "/images/b-espresso.jpg",
  });
  assert.equal(otherMerchantSameSku.response.status, 201);
  assert.equal(otherMerchantSameSku.json.product.images.length, 1);
  assert.equal(otherMerchantSameSku.json.product.images[0].url, "/images/b-espresso.jpg");

  // Update gallery & threshold
  const updated = await request(`/api/merchant/products/${first.json.product.id}`, "PATCH", merchantAToken, {
    lowStockThreshold: 2,
    images: [{ url: "https://cdn.example.com/new-espresso.jpg", altText: "Mới", sortOrder: 0 }],
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.product.isLowStock, false);
  assert.equal(updated.json.product.imageUrl, "https://cdn.example.com/new-espresso.jpg");
  assert.equal(updated.json.product.images.length, 1);
});

test("pagination, filtering, sorting, and public slug routes", async () => {
  const cat = await request("/api/merchant/categories", "POST", merchantAToken, {
    name: "Trà trái cây",
    sortOrder: 0,
  });
  const catId = cat.json.category.id as number;

  const p1 = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Trà Đào Cam Sả",
    price: "45000",
    sku: "TEA-01",
    categoryId: catId,
    initialQuantity: 20,
    lowStockThreshold: 5,
  });
  const p2 = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Trà Vải",
    price: "35000",
    sku: "TEA-02",
    categoryId: catId,
    initialQuantity: 2,
    lowStockThreshold: 5,
  });
  const hiddenProd = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Trà Bí Mật",
    price: "99000",
    sku: "TEA-99",
    categoryId: catId,
    initialQuantity: 1,
  });
  await request(`/api/merchant/products/${hiddenProd.json.product.id}`, "PATCH", merchantAToken, {
    status: "HIDDEN",
  });
  const rewardProd = await request("/api/merchant/products", "POST", merchantAToken, {
    kind: "REWARD",
    name: "Bình giữ nhiệt",
    categoryId: catId,
    initialQuantity: 10,
  });

  // Merchant filter by category + q + pagination
  const filtered = await request(
    `/api/merchant/products?categoryId=${catId}&sort=price_asc&page=1&limit=2`,
    "GET",
    merchantAToken,
  );
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.json.items.length, 2);
  assert.equal(filtered.json.pagination.totalItems, 4);
  assert.equal(filtered.json.pagination.totalPages, 2);
  assert.equal(filtered.json.items[0].id, rewardProd.json.product.id); // price 0
  assert.equal(filtered.json.items[1].id, p2.json.product.id); // price 35000

  // Merchant lowStock=true filter
  const lowStockList = await request(
    `/api/merchant/products?categoryId=${catId}&lowStock=true`,
    "GET",
    merchantAToken,
  );
  assert.equal(lowStockList.response.status, 200);
  const lowIds = lowStockList.json.items.map((item: { id: number }) => item.id);
  assert.ok(lowIds.includes(p2.json.product.id));
  assert.ok(lowIds.includes(hiddenProd.json.product.id));
  assert.equal(lowIds.includes(p1.json.product.id), false);

  // Search by SKU
  const bySku = await request("/api/merchant/products?q=TEA-01", "GET", merchantAToken);
  assert.equal(bySku.json.items.length, 1);
  assert.equal(bySku.json.items[0].id, p1.json.product.id);

  // Public slug catalog: only SALE + ACTIVE
  const publicStore = await request(
    `/api/public/stores/${merchantASlug}/products?categoryId=${catId}&sort=price_desc`,
    "GET",
  );
  assert.equal(publicStore.response.status, 200);
  assert.equal(publicStore.json.items.length, 2);
  assert.equal(publicStore.json.items[0].id, p1.json.product.id);
  assert.equal(publicStore.json.items[1].id, p2.json.product.id);
  assert.ok(publicStore.json.categories.some((c: { id: number }) => c.id === catId));

  // Public slug product detail
  const detail = await request(`/api/public/stores/${merchantASlug}/products/${p1.json.product.id}`, "GET");
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.product.sku, "TEA-01");

  // Hidden / Reward / Inactive store -> 404
  const hiddenDetail = await request(
    `/api/public/stores/${merchantASlug}/products/${hiddenProd.json.product.id}`,
    "GET",
  );
  assert.equal(hiddenDetail.response.status, 404);
  assert.equal(hiddenDetail.json.error, "PRODUCT_NOT_FOUND");

  const rewardDetail = await request(
    `/api/public/stores/${merchantASlug}/products/${rewardProd.json.product.id}`,
    "GET",
  );
  assert.equal(rewardDetail.response.status, 404);

  const inactiveStoreRes = await request(`/api/public/stores/${inactiveMerchantSlug}/products`, "GET");
  assert.equal(inactiveStoreRes.response.status, 404);
  assert.equal(inactiveStoreRes.json.error, "MERCHANT_NOT_FOUND");

  // Legacy merchantId endpoint returns { items, pagination }
  const legacyPublic = await request(`/api/merchants/${merchantAId}/products?limit=1&page=1`, "GET");
  assert.equal(legacyPublic.response.status, 200);
  assert.equal(legacyPublic.json.items.length, 1);
  assert.ok(legacyPublic.json.pagination.totalItems >= 2);
});

test("order snapshots remain preserved after product V2 edits", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Gốm Sứ Cổ",
    price: "250000",
    sku: "CERAMIC-1",
    initialQuantity: 10,
  });
  const productId = created.json.product.id as number;

  const orderRes = await request("/api/orders", "POST", memberToken, {
    productId,
    quantity: 2,
  });
  assert.equal(orderRes.response.status, 201);
  const orderId = orderRes.json.order.id as number;

  const patchRes = await request(`/api/merchant/products/${productId}`, "PATCH", merchantAToken, {
    name: "Gốm Sứ Mới",
    price: "390000",
    sku: "CERAMIC-2",
  });
  assert.equal(patchRes.response.status, 200);

  const orderRead = await request(`/api/member/orders/${orderId}`, "GET", memberToken);
  assert.equal(orderRead.response.status, 200);
  assert.equal(orderRead.json.order.items[0].productName, "Gốm Sứ Cổ");
  assert.equal(orderRead.json.order.items[0].unitPrice, "250000");
  assert.equal(orderRead.json.order.total, "500000");
});
