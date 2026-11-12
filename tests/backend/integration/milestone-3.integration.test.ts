import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { HttpError } from "../../../apps/backend/src/lib/http-error.js";
import { readRouteId } from "../../../apps/backend/src/modules/products/products.validation.js";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { signAccessToken }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
]);

const suffix = randomUUID();
const merchantAEmail = `m3-merchant-a-${suffix}@test.local`;
const merchantBEmail = `m3-merchant-b-${suffix}@test.local`;
const memberEmail = `m3-member-${suffix}@test.local`;
const secondMemberEmail = `m3-member-b-${suffix}@test.local`;
const inactiveMerchantEmail = `m3-inactive-${suffix}@test.local`;
const fixtureEmails = [merchantAEmail, merchantBEmail, memberEmail, secondMemberEmail, inactiveMerchantEmail];

let server: Server | undefined;
let baseUrl: string;
let merchantAId: number;
let inactiveMerchantId: number;
let merchantAToken: string;
let merchantBToken: string;
let memberToken: string;
let secondMemberToken: string;

before(async () => {
  const [merchantAOwner, merchantBOwner, member, secondMember, inactiveMerchantOwner] = await Promise.all([
    prisma.user.create({ data: { email: merchantAEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: merchantBEmail, passwordHash: "fixture", role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash: "fixture", role: "MEMBER" } }),
    prisma.user.create({ data: { email: secondMemberEmail, passwordHash: "fixture", role: "MEMBER" } }),
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
  secondMemberToken = await signAccessToken(secondMember.id);

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
  const memberships = await prisma.merchantMembership.findMany({
    where: { merchantId: { in: merchantIds }, memberId: { in: userIds } },
    select: { id: true },
  });
  const membershipIds = memberships.map(({ id }) => id);
  const wallets = await prisma.loyaltyWallet.findMany({ where: { membershipId: { in: membershipIds } }, select: { id: true } });
  const walletIds = wallets.map(({ id }) => id);
  await prisma.inventoryMovement.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.pointTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.loyaltyWallet.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.merchantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const orders = await prisma.order.findMany({ where: { memberId: { in: userIds } }, select: { id: true } });
  const orderIds = orders.map(({ id }) => id);
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.inventoryBalance.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyTier.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await prisma.loyaltyPolicyVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
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

async function createTestProduct(name = "Demo Coffee", price = "150000") {
  const result = await request("/api/merchant/products", "POST", merchantAToken, { name, price, initialQuantity: 100 });
  assert.equal(result.response.status, 201);
  return result.json.product as { id: number; name: string; price: string };
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
  assert.equal(created.json.product.kind, "SALE");
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

test("reward products are visible to the owning merchant and cannot be purchased", async () => {
  const created = await request("/api/merchant/products", "POST", merchantAToken, {
    kind: "REWARD",
    name: "Loyalty Mug",
    description: "A blue ceramic mug",
    imageUrl: "https://example.com/mug.png",
  });
  assert.equal(created.response.status, 201);
  const productId = created.json.product.id as number;
  assert.equal(created.json.product.kind, "REWARD");
  assert.equal(created.json.product.price, "0");
  assert.equal(created.json.product.status, "ACTIVE");
  assert.equal(created.json.product.description, "A blue ceramic mug");
  assert.equal(created.json.product.imageUrl, "https://example.com/mug.png");

  const [own, foreign, publicCatalog, checkout] = await Promise.all([
    request("/api/merchant/products", "GET", merchantAToken),
    request("/api/merchant/products", "GET", merchantBToken),
    request(`/api/merchants/${merchantAId}/products`, "GET"),
    request("/api/orders", "POST", memberToken, { productId, quantity: 1 }),
  ]);
  assert.equal(own.response.status, 200);
  assert.equal(own.json.products.find((product: { id: number }) => product.id === productId)?.kind, "REWARD");
  assert.equal(foreign.response.status, 200);
  assert.equal(foreign.json.products.some((product: { id: number }) => product.id === productId), false);
  assert.equal(publicCatalog.response.status, 200);
  assert.equal(publicCatalog.json.products.some((product: { id: number }) => product.id === productId), false);
  assert.equal(checkout.response.status, 404);
  assert.equal(checkout.json.error, "PRODUCT_NOT_FOUND");
});

test("buy now snapshots price and name", async () => {
  const product = await createTestProduct();
  const created = await request("/api/orders", "POST", memberToken, { productId: product.id, quantity: 2 });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.order.status, "PENDING");
  assert.equal(created.json.order.subtotal, "300000");
  assert.equal(created.json.order.discountAmount, "0");
  assert.equal(created.json.order.total, "300000");
  assert.equal(created.json.order.paidAt, null);
  assert.equal(created.json.order.items[0].unitPrice, "150000");
  assert.equal(created.json.order.items[0].productName, "Demo Coffee");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: created.json.order.id } })).voucherId, null);

  const updated = await request(`/api/merchant/products/${product.id}`, "PATCH", merchantAToken, {
    name: "Renamed Coffee",
    price: "160000",
    status: "HIDDEN",
  });
  assert.equal(updated.response.status, 200);

  const paid = await request(`/api/orders/${created.json.order.id}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.status, "PAID");
  assert.equal(paid.json.order.total, "300000");
  assert.equal(paid.json.order.items[0].productName, "Demo Coffee");

  const hiddenProductOrder = await request("/api/orders", "POST", memberToken, { productId: product.id, quantity: 1 });
  assert.equal(hiddenProductOrder.response.status, 404);
});

test("one checkout snapshots multiple products and rejects mixing stores", async () => {
  const coffee = await createTestProduct();
  const cake = await createTestProduct("Demo Cake", "25000");
  const otherStore = await request("/api/merchant/products", "POST", merchantBToken, { name: "Other Coffee", price: "20000" });
  assert.equal(otherStore.response.status, 201);
  const items = [{ productId: coffee.id, quantity: 2 }, { productId: cake.id, quantity: 1 }];

  const created = await request("/api/orders", "POST", memberToken, { items });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.order.status, "PENDING");
  assert.equal(created.json.order.subtotal, "325000");
  assert.deepEqual(
    created.json.order.items,
    [
      { productId: coffee.id, productName: coffee.name, unitPrice: coffee.price, quantity: 2, lineTotal: "300000" },
      { productId: cake.id, productName: cake.name, unitPrice: cake.price, quantity: 1, lineTotal: "25000" },
    ],
  );
  const otherItem = { productId: otherStore.json.product.id, quantity: 1 };
  const mixed = await request("/api/orders", "POST", memberToken, { items: [items[0], otherItem] });
  assert.equal(mixed.response.status, 400);
  const duplicate = await request("/api/orders", "POST", memberToken, { items: [items[0], items[0]] });
  assert.equal(duplicate.response.status, 400);
});

test("buy now validates the payload", async () => {
  const product = await createTestProduct();
  const zeroQuantity = await request("/api/orders", "POST", memberToken, { productId: product.id, quantity: 0 });
  assert.equal(zeroQuantity.response.status, 400);
  assert.equal(zeroQuantity.json.error, "INVALID_INPUT");

  const clientTotal = await request("/api/orders", "POST", memberToken, {
    productId: product.id,
    quantity: 1,
    total: "1",
  });
  assert.equal(clientTotal.response.status, 400);
  assert.equal(clientTotal.json.error, "INVALID_INPUT");

  const expensiveProduct = await createTestProduct("Very Expensive Coffee", "999999999999999");
  const overflow = await request("/api/orders", "POST", memberToken, { productId: expensiveProduct.id, quantity: 2 });
  assert.equal(overflow.response.status, 400);
  assert.equal(overflow.json.error, "INVALID_INPUT");
});

test("only the member who owns the order can pay once", async () => {
  const product = await createTestProduct();
  const created = await request("/api/orders", "POST", memberToken, { productId: product.id, quantity: 1 });
  assert.equal(created.response.status, 201);
  const orderId = created.json.order.id as number;

  const merchantOrder = await request("/api/orders", "POST", merchantAToken, { productId: product.id, quantity: 1 });
  assert.equal(merchantOrder.response.status, 403);

  const otherMemberPay = await request(`/api/orders/${orderId}/pay`, "POST", secondMemberToken);
  assert.equal(otherMemberPay.response.status, 404);

  const paid = await request(`/api/orders/${orderId}/pay`, "POST", memberToken);
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.order.status, "PAID");
  assert.ok(paid.json.order.paidAt);
  const originalPaidAt = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paidAt;

  const paidAgain = await request(`/api/orders/${orderId}/pay`, "POST", memberToken);
  assert.equal(paidAgain.response.status, 409);
  assert.equal(paidAgain.json.error, "ORDER_ALREADY_PAID");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paidAt?.getTime(), originalPaidAt?.getTime());
});
