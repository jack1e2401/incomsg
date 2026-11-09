import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("password hash verifies the original password only", async () => {
  const hash = await hashPassword("a-long-admin-password");
  assert.notEqual(hash, "a-long-admin-password");
  assert.equal(await verifyPassword("a-long-admin-password", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("same password receives a different salt each time", async () => {
  const first = await hashPassword("a-long-admin-password");
  const second = await hashPassword("a-long-admin-password");
  assert.notEqual(first, second);
});
