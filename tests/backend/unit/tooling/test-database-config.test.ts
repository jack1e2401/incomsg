import assert from "node:assert/strict";
import { test } from "node:test";
import { testDatabaseUrl } from "../../../../scripts/test-database-config.mjs";

test("DB QA derives only incomsg-test from local app configuration", () => {
  const result = new URL(testDatabaseUrl({ DATABASE_URL: "mysql://qa:example@localhost:3306/incomsg" }));
  assert.equal(result.pathname, "/incomsg-test");
  assert.equal(result.username, "qa");
  assert.equal(result.port, "3306");
});

test("DB QA rejects remote servers and an explicit application database", () => {
  assert.throws(() => testDatabaseUrl({ DATABASE_URL: "mysql://db.example/incomsg" }), /local MySQL/);
  assert.throws(() => testDatabaseUrl({ TEST_DATABASE_URL: "mysql://localhost/incomsg" }), /must target incomsg-test/);
  assert.throws(() => testDatabaseUrl({ TEST_DATABASE_URL: "mysql://db.example/incomsg-test" }), /local MySQL/);
  assert.throws(() => testDatabaseUrl({ DATABASE_URL: "postgres://localhost/incomsg" }), /local MySQL/);
});

test("DB QA honors an explicit local test connection without using the app credentials", () => {
  const result = new URL(testDatabaseUrl({ DATABASE_URL: "mysql://app@localhost/incomsg", TEST_DATABASE_URL: "mysql://test@127.0.0.1/incomsg-test" }));
  assert.equal(result.username, "test");
  assert.equal(result.hostname, "127.0.0.1");
  assert.throws(() => testDatabaseUrl({}), /DATABASE_URL/);
});
