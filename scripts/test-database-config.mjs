/** Resolve DB QA configuration before spawning any process that could write data. */
export function testDatabaseUrl(environment) {
  const source = environment.TEST_DATABASE_URL ?? environment.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL or TEST_DATABASE_URL is required for DB QA");
  const url = new URL(source);
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("DB tests require a local MySQL server");
  }
  if (!environment.TEST_DATABASE_URL) url.pathname = "/incomsg-test";
  if (decodeURIComponent(url.pathname.slice(1)) !== "incomsg-test") {
    throw new Error("DB tests must target incomsg-test; application databases are forbidden");
  }
  return url.toString();
}
