import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { HttpError } from "../src/lib/http-error.js";
import { readRouteId } from "../src/modules/products/products.validation.js";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../src/app.js"),
  import("../src/lib/prisma.js"),
  import("../src/lib/access-token.js"),
]);

const suffix = randomUUID();
const merchantAEmail = `m3-merchant-a-${suffix}@test.local`;
const merchantBEmail = `m3-merchant-b-${suffix}@test.local`;
const memberEmail = `m3-member-${suffix}@test.local`;
const inactiveMerchantEmail = `m3-inactive-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberEmail, inactiveMerchantEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let inactiveMerchantId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;

before(async () => {
  const [merchantAOwner, merchantBOwner, member, inactiveMerchantOwner] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: inactiveMerchantEmail, passwordHash: "fixture", role: "MERCHANT" } }),
  ]);

  const [merchantA, merchantB, inactiveMerchant] = await Promise.all([
    prisma.merchant.create({ data: { ownerId: merchantAOwner.id, name: "Merchant A", slug: `m3-a-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: merchantBOwner.id, name: "Merchant B", slug: `m3-b-${suffix}` } }),
    prisma.merchant.create({ data: { ownerId: inactiveMerchantOwner.id, name: "Inactive Merchant", slug: `m3-inactive-${suffix}`, isActive: false } }),
  ]);

  merchantAId = merchantA.id;
  inactiveMerchantId = inactiveMerchant.id;
  merchantAToken = await signAccessToken(merchantAOwner.id);
  merchantBToken = await signAccessToken(merchantBOwner.id);
  memberToken = await signAccessToken(member.id);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  }
  const users = await prisma.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
  const userIds = users.map(({ id }) => id);
  const merchants = await prisma.merchant.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const merchantIds = merchants.map(({ id }) => id);
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
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
  return { response, json: await response.json() as Record<string, any> };
}

test("route IDs reject repeated path parameter values", () => {
  assert.throws(
    () => readRouteId(["12"]),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});

test("merchant manages its own catalog", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Demo Coffee",
    price: "150000",
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.product.price, "150000");

  const memberCreate = await request("/api/merchant/products", "POST", memberToken, {
    name: "Member Product",
    price: "1000",
  });
  assert.equal(memberCreate.response.status, 403);

  const otherMerchantUpdate = await request(
    `/api/merchant/products/${created.json.product.id}`,
    "PATCH",
    merchantBToken,
    { name: "Not yours" },
  );
  assert.equal(otherMerchantUpdate.response.status, 404);

  const updated = await request(
    `/api/merchant/products/${created.json.product.id}`,
    "PATCH",
    merchantAToken,
    { name: "Demo Coffee Large", price: "160000" },
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.product.name, "Demo Coffee Large");
  assert.equal(updated.json.product.price, "160000");
});

test("catalog rejects invalid input", async () => {
  const invalidPrice = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Invalid Coffee",
    price: "0",
  });
  assert.equal(invalidPrice.response.status, 400);
  assert.equal(invalidPrice.json.error, "INVALID_INPUT");

  const emptyPatch = await request("/api/merchant/products/1", "PATCH", merchantAToken, {});
  assert.equal(emptyPatch.response.status, 400);
  assert.equal(emptyPatch.json.error, "INVALID_INPUT");

  const invalidMerchantId = await request("/api/merchants/0/products", "GET");
  assert.equal(invalidMerchantId.response.status, 400);
  assert.equal(invalidMerchantId.json.error, "INVALID_INPUT");
});

test("public catalog filters hidden products", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    name: "Catalog Coffee",
    price: "150000",
  });
  assert.equal(created.response.status, 201);
  const productId = created.json.product.id as number;

  const visible = await request(`/api/merchants/${merchantAId}/products`, "GET");
  assert.ok(visible.json.products.some((product: { id: number }) => product.id === productId));

  const hidden = await request(`/api/merchant/products/${productId}`, "PATCH", merchantAToken, { status: "HIDDEN" });
  assert.equal(hidden.response.status, 200);

  const publicList = await request(`/api/merchants/${merchantAId}/products`, "GET");
  assert.equal(publicList.json.products.some((product: { id: number }) => product.id === productId), false);

  const ownList = await request("/api/merchant/products", "GET", merchantAToken);
  assert.equal(ownList.json.products.find((product: { id: number }) => product.id === productId).status, "HIDDEN");

  const inactiveStore = await request(`/api/merchants/${inactiveMerchantId}/products`, "GET");
  assert.equal(inactiveStore.response.status, 404);
});
