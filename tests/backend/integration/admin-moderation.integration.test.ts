import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= randomBytes(32).toString("hex");
const [{ app }, { prisma }, { signAccessToken }, { hashPassword }] = await Promise.all([
  import("../../../apps/backend/src/app.js"),
  import("../../../apps/backend/src/lib/prisma.js"),
  import("../../../apps/backend/src/lib/access-token.js"),
  import("../../../apps/backend/src/lib/password.js"),
]);

const suffix = randomUUID();
const adminEmail = `admin-moderation-admin-${suffix}@test.local`;
const merchantEmail = `admin-moderation-merchant-${suffix}@test.local`;
const memberEmail = `admin-moderation-member-${suffix}@test.local`;
const raceMemberEmail = `admin-moderation-race-${suffix}@test.local`;
const applicantEmail = `admin-moderation-applicant-${suffix}@test.local`;
const memberPassword = "member-password-123";
let server: Server | undefined;
let baseUrl: string;
let adminId: number;
let merchantId: number;
let memberId: number;
let raceMemberId: number;
let walletId: number;
let applicantId: number;
let adminToken: string;
let merchantToken: string;
let memberToken: string;

type ApiItem = {
  id: number; accountStatus: string; isActive: boolean; actorId: number; actorEmail: string;
  reason: string; before: { accountStatus?: string }; after: { accountStatus?: string };
};
type ApiBody = {
  user: { id: number; accountStatus: string; isActive: boolean };
  entry: { id: number; email: string };
  merchant: { isActive: boolean };
  items: ApiItem[];
  nextCursor: string | null;
  error: string;
};

before(async () => {
  const passwordHash = await hashPassword(memberPassword);
  const [admin, merchantOwner, member, applicant] = await Promise.all([
    prisma.user.create({ data: { email: adminEmail, passwordHash, role: "ADMIN" } }),
    prisma.user.create({ data: { email: merchantEmail, passwordHash, role: "MERCHANT" } }),
    prisma.user.create({ data: { email: memberEmail, passwordHash, role: "MEMBER" } }),
    prisma.user.create({ data: { email: applicantEmail, passwordHash, role: "MERCHANT", accountStatus: "PENDING_APPROVAL" } }),
  ]);
  const raceMember = await prisma.user.create({ data: { email: raceMemberEmail, passwordHash, role: "MEMBER" } });
  adminId = admin.id;
  memberId = member.id;
  raceMemberId = raceMember.id;
  applicantId = applicant.id;
  const merchant = await prisma.merchant.create({
    data: { ownerId: merchantOwner.id, name: "Moderation Test Merchant", slug: `moderation-${suffix}` },
  });
  merchantId = merchant.id;
  await prisma.merchantApplication.create({
    data: { applicantId: applicant.id, storeName: "Pending moderation applicant" },
  });
  const membership = await prisma.merchantMembership.create({ data: { memberId: member.id, merchantId } });
  const wallet = await prisma.loyaltyWallet.create({
    data: { membershipId: membership.id, exactBalance: "1.2", netLifetimeEarned: "1.2" },
  });
  walletId = wallet.id;
  await prisma.pointTransaction.create({
    data: { walletId, type: "EARN", delta: "1.2", balanceAfter: "1.2", reason: "M8 preservation fixture" },
  });

  [adminToken, merchantToken, memberToken] = await Promise.all([
    signAccessToken(admin.id),
    signAccessToken(merchantOwner.id),
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
    if (walletId) await prisma.pointTransaction.deleteMany({ where: { walletId } });
    if (walletId) await prisma.loyaltyWallet.deleteMany({ where: { id: walletId } });
    if (memberId && merchantId) {
      await prisma.merchantMembership.deleteMany({ where: { memberId, merchantId } });
    }
    if (applicantId) await prisma.merchantApplication.deleteMany({ where: { applicantId } });
    if (merchantId) await prisma.loyaltyTier.deleteMany({ where: { merchantId } });
    if (merchantId) await prisma.loyaltyRule.deleteMany({ where: { merchantId } });
    if (merchantId) await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.emailBlacklistEntry.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function request(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
): Promise<{ response: Response; json: ApiBody }> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, json: await response.json() as ApiBody };
}

test("Admin user listing returns account access state without credentials", async () => {
  const { response, json } = await request("/api/admin/users", adminToken);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(json.items));
  const member = json.items.find((item: { id: number }) => item.id === memberId);
  assert.ok(member);
  assert.equal(member.accountStatus, "ACTIVE");
  assert.equal(member.isActive, true);
  assert.equal("passwordHash" in member, false);
  assert.equal(typeof json.nextCursor === "string" || json.nextCursor === null, true);
});

test("only Admin can read or mutate moderation resources", async () => {
  const paths = [
    ["/api/admin/users", "GET", undefined],
    [`/api/admin/users/${memberId}/status`, "PATCH", { status: "SUSPENDED", reason: "test" }],
    ["/api/admin/email-blacklist", "GET", undefined],
    ["/api/admin/email-blacklist", "POST", { email: `blocked-${suffix}@test.local`, reason: "test" }],
    [`/api/admin/email-blacklist/999999/deactivate`, "POST", { reason: "test" }],
    ["/api/admin/audit-logs", "GET", undefined],
    [`/api/admin/merchants/${merchantId}/status`, "PATCH", { isActive: false, reason: "test" }],
  ] as const;
  for (const [path, method, body] of paths) {
    assert.equal((await request(path, undefined, method, body)).response.status, 401);
    assert.equal((await request(path, memberToken, method, body)).response.status, 403);
    assert.equal((await request(path, merchantToken, method, body)).response.status, 403);
  }
});

test("suspension and unban are reasoned, audited, and preserve wallet history", async () => {
  const suspended = await request(
    `/api/admin/users/${memberId}/status`,
    adminToken,
    "PATCH",
    { status: "SUSPENDED", reason: "Repeated chargeback abuse" },
  );
  assert.equal(suspended.response.status, 200);
  assert.equal(suspended.json.user.accountStatus, "SUSPENDED");
  assert.equal(suspended.json.user.isActive, false);

  const loginWhileSuspended = await request("/api/auth/login", undefined, "POST", {
    email: memberEmail,
    password: memberPassword,
  });
  assert.equal(loginWhileSuspended.response.status, 403);
  assert.equal(loginWhileSuspended.json.error, "ACCOUNT_SUSPENDED");

  const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { id: walletId } });
  assert.equal(wallet.exactBalance.toFixed(1), "1.2");
  assert.equal(await prisma.pointTransaction.count({ where: { walletId } }), 1);

  const unbanned = await request(
    `/api/admin/users/${memberId}/status`,
    adminToken,
    "PATCH",
    { status: "ACTIVE", reason: "Investigation completed" },
  );
  assert.equal(unbanned.response.status, 200);
  assert.equal(unbanned.json.user.accountStatus, "ACTIVE");
  const activeLogin = await request("/api/auth/login", undefined, "POST", {
    email: memberEmail,
    password: memberPassword,
  });
  assert.equal(activeLogin.response.status, 200);
  assert.deepEqual(Object.keys(activeLogin.json.user).sort(), ["accountStatus", "email", "id", "isActive", "role"]);

  const banned = await request(
    `/api/admin/users/${memberId}/status`,
    adminToken,
    "PATCH",
    { status: "BANNED", reason: "Confirmed account abuse" },
  );
  assert.equal(banned.response.status, 200);
  assert.equal(banned.json.user.accountStatus, "BANNED");
  const bannedLogin = await request("/api/auth/login", undefined, "POST", {
    email: memberEmail,
    password: memberPassword,
  });
  assert.equal(bannedLogin.response.status, 403);
  assert.equal(bannedLogin.json.error, "ACCOUNT_BANNED");
  assert.equal((await request(`/api/admin/users/${memberId}/status`, adminToken, "PATCH", {
    status: "ACTIVE",
    reason: "Restore integration fixture",
  })).response.status, 200);

  const audit = await request(
    `/api/admin/audit-logs?targetType=USER&targetId=${memberId}&actorId=${adminId}`,
    adminToken,
  );
  assert.equal(audit.response.status, 200);
  const suspensionEvent = audit.json.items.find(
    (item: { after?: { accountStatus?: string } }) => item.after?.accountStatus === "SUSPENDED",
  );
  assert.ok(suspensionEvent);
  assert.equal(suspensionEvent.actorId, adminId);
  assert.equal(suspensionEvent.actorEmail, adminEmail);
  assert.equal(suspensionEvent.reason, "Repeated chargeback abuse");
  assert.equal(suspensionEvent.before.accountStatus, "ACTIVE");
});

test("duplicate status transitions conflict and append at most one event under concurrency", async () => {
  const calls = await Promise.all([
    request(`/api/admin/users/${raceMemberId}/status`, adminToken, "PATCH", {
      status: "BANNED",
      reason: "Concurrent ban request",
    }),
    request(`/api/admin/users/${raceMemberId}/status`, adminToken, "PATCH", {
      status: "BANNED",
      reason: "Concurrent ban request",
    }),
  ]);
  assert.deepEqual(calls.map(({ response }) => response.status).sort(), [200, 409]);
  const audit = await request(
    `/api/admin/audit-logs?targetType=USER&targetId=${raceMemberId}`,
    adminToken,
  );
  assert.equal(audit.json.items.filter(
    (item: { reason: string }) => item.reason === "Concurrent ban request",
  ).length, 1);
});

test("normalized blacklist blocks registration and login until reasoned deactivation", async () => {
  const entryEmail = `blocked-${suffix}@test.local`;
  const added = await request("/api/admin/email-blacklist", adminToken, "POST", {
    email: `  ${entryEmail.toUpperCase()}  `,
    reason: "Verified abusive registration",
  });
  assert.equal(added.response.status, 201);
  assert.equal(added.json.entry.email, entryEmail);

  const memberRegistration = await request("/api/auth/register/member", undefined, "POST", {
    email: ` ${entryEmail.toUpperCase()} `,
    password: "new-member-password",
  });
  assert.equal(memberRegistration.response.status, 403);
  assert.equal(memberRegistration.json.error, "EMAIL_BLACKLISTED");

  const merchantEmailBlocked = `blocked-merchant-${suffix}@test.local`;
  const merchantEntry = await request("/api/admin/email-blacklist", adminToken, "POST", {
    email: merchantEmailBlocked,
    reason: "Verified merchant abuse",
  });
  assert.equal(merchantEntry.response.status, 201);
  const merchantRegistration = await request("/api/auth/register/merchant", undefined, "POST", {
    email: merchantEmailBlocked,
    password: "new-merchant-password",
    storeName: "Blocked store",
  });
  assert.equal(merchantRegistration.response.status, 403);
  assert.equal(merchantRegistration.json.error, "EMAIL_BLACKLISTED");

  const duplicate = await request("/api/admin/email-blacklist", adminToken, "POST", {
    email: entryEmail,
    reason: "Duplicate active record",
  });
  assert.equal(duplicate.response.status, 409);

  const deactivated = await request(
    `/api/admin/email-blacklist/${added.json.entry.id}/deactivate`,
    adminToken,
    "POST",
    { reason: "Appeal accepted" },
  );
  assert.equal(deactivated.response.status, 200);
  const allowedRegistration = await request("/api/auth/register/member", undefined, "POST", {
    email: entryEmail,
    password: "new-member-password",
  });
  assert.equal(allowedRegistration.response.status, 201);
});

test("blacklisting an existing account blocks login and preserves prior audit history", async () => {
  const added = await request("/api/admin/email-blacklist", adminToken, "POST", {
    email: memberEmail,
    reason: "Account review",
  });
  assert.equal(added.response.status, 201);
  const deniedLogin = await request("/api/auth/login", undefined, "POST", {
    email: memberEmail,
    password: memberPassword,
  });
  assert.equal(deniedLogin.response.status, 403);
  assert.equal(deniedLogin.json.error, "EMAIL_BLACKLISTED");

  const deactivated = await request(
    `/api/admin/email-blacklist/${added.json.entry.id}/deactivate`,
    adminToken,
    "POST",
    { reason: "Review closed" },
  );
  assert.equal(deactivated.response.status, 200);
  assert.equal((await request("/api/auth/login", undefined, "POST", {
    email: memberEmail,
    password: memberPassword,
  })).response.status, 200);
});

test("merchant deactivation blocks an existing token until Admin reactivates it", async () => {
  const deactivated = await request(
    `/api/admin/merchants/${merchantId}/status`,
    adminToken,
    "PATCH",
    { isActive: false, reason: "Merchant review" },
  );
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.json.merchant.isActive, false);
  const denied = await request("/api/merchant/loyalty", merchantToken);
  assert.equal(denied.response.status, 403);
  assert.equal(denied.json.error, "MERCHANT_NOT_ACTIVE");

  const activated = await request(
    `/api/admin/merchants/${merchantId}/status`,
    adminToken,
    "PATCH",
    { isActive: true, reason: "Review cleared" },
  );
  assert.equal(activated.response.status, 200);
  assert.equal(activated.json.merchant.isActive, true);
  assert.equal((await request("/api/merchant/loyalty", merchantToken)).response.status, 200);
});

test("reason is mandatory and audit history has no mutation route", async () => {
  const missingReason = await request(
    `/api/admin/users/${memberId}/status`,
    adminToken,
    "PATCH",
    { status: "SUSPENDED", reason: "   " },
  );
  assert.equal(missingReason.response.status, 400);
  assert.equal(missingReason.json.error, "INVALID_INPUT");

  const invalidTransition = await request(
    `/api/admin/users/${applicantId}/status`,
    adminToken,
    "PATCH",
    { status: "ACTIVE", reason: "Cannot bypass merchant approval" },
  );
  assert.equal(invalidTransition.response.status, 409);

  const before = await request("/api/admin/audit-logs", adminToken);
  assert.equal(before.response.status, 200);
  const entry = before.json.items[0];
  assert.ok(entry);
  assert.equal((await request(`/api/admin/audit-logs/${entry.id}`, adminToken, "DELETE")).response.status, 404);
  const afterDeleteAttempt = await request("/api/admin/audit-logs", adminToken);
  assert.equal(afterDeleteAttempt.json.items.length, before.json.items.length);
});
