import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRefreshCookieOptions,
  hashRefreshToken,
  parseRefreshTokenCookie,
  generateRefreshToken,
} from "../../../../../apps/backend/src/modules/auth/refresh-session.js";

describe("refresh session tokens", () => {
  it("generates high-entropy opaque tokens and stores only a stable SHA-256 digest", () => {
    const token = generateRefreshToken();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(hashRefreshToken(token).length, 64);
    assert.match(hashRefreshToken(token), /^[a-f0-9]{64}$/);
    assert.equal(hashRefreshToken(token), hashRefreshToken(token));
    assert.notEqual(hashRefreshToken(token), hashRefreshToken(generateRefreshToken()));
  });

  it("reads only the refresh cookie and safely decodes its value", () => {
    assert.equal(
      parseRefreshTokenCookie("theme=dark; incomsg_refresh=opaque%2Etoken; locale=vi"),
      "opaque.token",
    );
    assert.equal(parseRefreshTokenCookie("theme=dark"), null);
    assert.equal(parseRefreshTokenCookie("incomsg_refresh="), null);
    assert.equal(parseRefreshTokenCookie(undefined), null);
  });

  it("uses HttpOnly, scoped cookies with secure cross-site attributes in production", () => {
    const development = getRefreshCookieOptions(false);
    assert.equal(development.httpOnly, true);
    assert.equal(development.path, "/api/auth");
    assert.equal(development.secure, false);
    assert.equal(development.sameSite, "lax");

    const production = getRefreshCookieOptions(true);
    assert.equal(production.httpOnly, true);
    assert.equal(production.secure, true);
    assert.equal(production.sameSite, "none");
    assert.ok((production.maxAge ?? 0) >= 30 * 24 * 60 * 60 * 1000);
  });
});
