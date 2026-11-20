import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");

const [{ app }, { prisma }, { hashPassword }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/password.js"),
]);
const { hashRefreshToken } = await import("../../../apps/backend/src/modules/platform/auth/refresh-session.js");

const suffix = randomUUID();
const memberEmail = `m2-member-${suffix}@test.local`;
const refreshEmail = `m2-refresh-${suffix}@test.local`;
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
      accountStatus: "ACTIVE",
    },
  });
  await prisma.user.create({
    data: {
      email: refreshEmail,
      passwordHash: await hashPassword("refresh-session-password"),
      role: "MEMBER",
      accountStatus: "ACTIVE",
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
    where: { email: { in: [memberEmail, refreshEmail, merchantEmail, rejectedMerchantEmail, adminEmail] } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const merchants = await prisma.merchant.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const merchantIds = merchants.map(({ id }) => id);
  if (merchantIds.length > 0) {
    await prisma.storefrontConfigVersion.deleteMany({ where: { merchantId: { in: merchantIds } } });
    await prisma.storefrontDraft.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }
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

test("login rotates refresh sessions and rejects token reuse", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: refreshEmail, password: "refresh-session-password" }),
  });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get("set-cookie") ?? "";
  assert.match(loginCookie, /incomsg_refresh=/);
  assert.match(loginCookie, /HttpOnly/i);
  assert.match(loginCookie, /SameSite=Lax/i);
  assert.match(loginCookie, /Path=\/api\/auth/i);

  const originalToken = loginCookie.match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(originalToken);
  const firstRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${originalToken}` },
  });
  assert.equal(firstRefresh.status, 200);
  const firstRefreshBody = await firstRefresh.json();
  assert.equal(typeof firstRefreshBody.accessToken, "string");
  const rotatedCookie = firstRefresh.headers.get("set-cookie") ?? "";
  const rotatedToken = rotatedCookie.match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(rotatedToken);
  assert.notEqual(rotatedToken, originalToken);

  const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${originalToken}` },
  });
  assert.equal(replay.status, 401);

  const revokedSuccessor = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${rotatedToken}` },
  });
  assert.equal(revokedSuccessor.status, 401);
});

test("logout revokes the refresh session and clears its cookie", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: refreshEmail, password: "refresh-session-password" }),
  });
  const cookie = login.headers.get("set-cookie") ?? "";
  const token = cookie.match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(token);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${token}` },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") ?? "", /incomsg_refresh=;/);
  assert.match(logout.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i);

  const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${token}` },
  });
  assert.equal(refresh.status, 401);
});

test("expired refresh sessions are rejected and revoked", async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: refreshEmail, password: "refresh-session-password" }),
  });
  const cookie = login.headers.get("set-cookie") ?? "";
  const token = cookie.match(/incomsg_refresh=([^;]+)/)?.[1];
  assert.ok(token);

  await prisma.refreshSession.update({
    where: { tokenHash: hashRefreshToken(token) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const response = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `incomsg_refresh=${token}` },
  });
  assert.equal(response.status, 401);

  const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
  assert.ok(session?.revokedAt);
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

test("merchant can securely check their pending application status", async () => {
  const response = await fetch(`${baseUrl}/api/auth/application-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "merchant-password-123" }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.application.id, applicationId);
  assert.equal(result.application.applicantId > 0, true);
  assert.equal(result.application.storeName, "Demo Store");
  assert.equal(result.application.status, "PENDING");

  const wrongPassword = await fetch(`${baseUrl}/api/auth/application-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "wrong-password" }),
  });
  assert.equal(wrongPassword.status, 401);

  const memberLookup = await fetch(`${baseUrl}/api/auth/application-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password: "member-password-123" }),
  });
  assert.equal(memberLookup.status, 404);
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
  assert.equal((await fetch(`${baseUrl}/api/admin/merchants/history`, { headers })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/merchants/history`)).status, 401);
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
  const historyBeforeReview = await fetch(`${baseUrl}/api/admin/merchants/history`, { headers });
  assert.equal(historyBeforeReview.status, 200);
  assert.ok(!(await historyBeforeReview.json()).applications.some((application: { id: number }) => application.id === applicationId));

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

  const applicationStatus = await fetch(`${baseUrl}/api/auth/application-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "merchant-password-123" }),
  });
  const statusResult = await applicationStatus.json();
  assert.equal(applicationStatus.status, 200);
  assert.equal(statusResult.application.status, "APPROVED");
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

  const applicationStatus = await fetch(`${baseUrl}/api/auth/application-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: rejectedMerchantEmail, password: "merchant-password-123" }),
  });
  const statusResult = await applicationStatus.json();
  assert.equal(applicationStatus.status, 200);
  assert.equal(statusResult.application.status, "REJECTED");

  const historyResponse = await fetch(`${baseUrl}/api/admin/merchants/history`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert.equal(historyResponse.status, 200);
  const { applications } = await historyResponse.json() as {
    applications: { id: number; status: string; reviewedAt: string | null }[];
  };
  const reviewed = applications.filter((item) => item.id === application.id || item.id === applicationId);
  assert.deepEqual(reviewed.map((item) => [item.id, item.status]), [
    [application.id, "REJECTED"],
    [applicationId, "APPROVED"],
  ]);
  assert.ok(reviewed.every((item) => item.reviewedAt !== null));
});
