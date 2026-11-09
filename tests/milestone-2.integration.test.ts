import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { hashPassword }] = await Promise.all([
  import("../src/app.js"),
  import("../src/lib/prisma.js"),
  import("../src/lib/password.js"),
]);

const suffix = randomUUID();
const memberEmail = `m2-member-${suffix}@test.local`;
const merchantEmail = `m2-merchant-${suffix}@test.local`;
const rejectedMerchantEmail = `m2-rejected-${suffix}@test.local`;
const adminEmail = `m2-admin-${suffix}@test.local`;
const adminPassword = `admin-${suffix}-password`;
let server: Server;
let baseUrl: string;
let applicationId: number;

before(async () => {
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      isActive: true,
    },
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const users = await prisma.user.findMany({
    where: { email: { in: [memberEmail, merchantEmail, rejectedMerchantEmail, adminEmail] } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.merchant.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.merchantApplication.deleteMany({ where: { applicantId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("member registers and logs in", async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register/member`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  const registered = await registration.json();

  assert.equal(registration.status, 201);
  assert.equal(registered.user.email, memberEmail);
  assert.equal(registered.user.role, "MEMBER");
  assert.equal(registered.user.isActive, true);
  assert.equal("passwordHash" in registered.user, false);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  const authenticated = await login.json();

  assert.equal(login.status, 200);
  assert.equal(typeof authenticated.accessToken, "string");
  assert.equal(authenticated.user.role, "MEMBER");
});

test("merchant applies and cannot log in before approval", async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: merchantEmail,
      password: "merchant-password-123",
      storeName: "  Demo Store  ",
    }),
  });
  const registered = await registration.json();

  assert.equal(registration.status, 201);
  assert.equal(registered.user.role, "MERCHANT");
  assert.equal(registered.user.isActive, false);
  assert.equal("application" in registered.user, false);
  assert.equal(registered.application.status, "PENDING");
  assert.equal(registered.application.storeName, "Demo Store");
  applicationId = registered.application.id;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "merchant-password-123" }),
  });

  assert.equal(login.status, 403);
});

test("member cannot access admin or merchant routes", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}` };

  const adminResponse = await fetch(`${baseUrl}/api/admin/merchants/pending`, { headers });
  const merchantResponse = await fetch(`${baseUrl}/api/merchant/me`, { headers });
  const anonymousResponse = await fetch(`${baseUrl}/api/admin/merchants/pending`);

  assert.equal(adminResponse.status, 403);
  assert.equal(merchantResponse.status, 403);
  assert.equal(anonymousResponse.status, 401);
});

test("admin lists and approves a pending merchant", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}` };

  const pendingResponse = await fetch(`${baseUrl}/api/admin/merchants/pending`, { headers });
  assert.equal(pendingResponse.status, 200);
  const { applications } = await pendingResponse.json();
  assert.ok(applications.some((application: { id: number }) => application.id === applicationId));

  const approval = await fetch(`${baseUrl}/api/admin/merchants/${applicationId}/approve`, {
    method: "PATCH",
    headers,
  });
  assert.equal(approval.status, 200);
  const result = await approval.json();
  assert.equal(result.application.status, "APPROVED");
  assert.equal(result.application.reviewedById, (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id);
  assert.equal(result.merchant.name, "Demo Store");

  const merchantLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "merchant-password-123" }),
  });
  assert.equal(merchantLogin.status, 200);
  const merchantSession = await merchantLogin.json();
  const storeResponse = await fetch(`${baseUrl}/api/merchant/me`, {
    headers: { authorization: `Bearer ${merchantSession.accessToken}` },
  });
  assert.equal(storeResponse.status, 200);
  assert.equal((await storeResponse.json()).merchant.id, result.merchant.id);
});

test("admin rejects a pending merchant", async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: rejectedMerchantEmail, password: "merchant-password-123", storeName: "Rejected Store" }),
  });
  assert.equal(registration.status, 201);
  const { application } = await registration.json();

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const { accessToken } = await login.json();
  const rejection = await fetch(`${baseUrl}/api/admin/merchants/${application.id}/reject`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(rejection.status, 200);
  assert.equal((await rejection.json()).application.status, "REJECTED");

  const merchantLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: rejectedMerchantEmail, password: "merchant-password-123" }),
  });
  assert.equal(merchantLogin.status, 403);
});
