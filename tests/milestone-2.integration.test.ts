import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const suffix = randomUUID();
const memberEmail = `m2-member-${suffix}@test.local`;
const merchantEmail = `m2-merchant-${suffix}@test.local`;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const users = await prisma.user.findMany({
    where: { email: { in: [memberEmail, merchantEmail] } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
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
  assert.equal(registered.application.status, "PENDING");
  assert.equal(registered.application.storeName, "Demo Store");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: merchantEmail, password: "merchant-password-123" }),
  });

  assert.equal(login.status, 403);
});

