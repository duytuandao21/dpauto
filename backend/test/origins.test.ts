import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import { loadConfig } from "../src/config";
import { Auth } from "../src/auth";
import { ApiError } from "../src/common";
import type { Database } from "../src/database";

const primary = "http://localhost:4001";
const lan = "http://192.168.100.209:4001";
const env = {
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/unused",
  API_SECRET: "s".repeat(48),
  APP_ORIGIN: primary,
};
const config = loadConfig({ ...env, APP_ALLOWED_ORIGINS: lan });
const auth = new Auth({} as Database, config);
const request = (headers: FastifyRequest["headers"]) =>
  ({ headers }) as FastifyRequest;
const session = { csrf_token: "test-csrf-token" };
const denied = (code: string) => (error: unknown) =>
  error instanceof ApiError && error.status === 403 && error.code === code;

test("origin configuration remains compatible and deduplicates additional exact origins", () => {
  assert.deepEqual(loadConfig(env).allowedOrigins, [primary]);
  assert.deepEqual(
    loadConfig({ ...env, APP_ALLOWED_ORIGINS: "  " }).allowedOrigins,
    [primary],
  );
  const multiple = loadConfig({
    ...env,
    APP_ALLOWED_ORIGINS: ` ${lan}, ${primary}, ${lan}, http://127.0.0.1:4001 `,
  });
  assert.equal(multiple.origin, primary);
  assert.deepEqual(multiple.allowedOrigins, [
    primary,
    lan,
    "http://127.0.0.1:4001",
  ]);
});

test("origin configuration rejects wildcards, credentials, paths and invalid protocols", () => {
  for (const origin of [
    "*",
    "http://*.example.com",
    "null",
    "invalid",
    "file:///tmp",
    "ftp://example.com",
    "http://user:password@example.com",
    "http://example.com/",
    "http://example.com/path",
    "http://example.com?query=1",
    "http://example.com#fragment",
    `${lan},`,
  ]) {
    assert.throws(
      () => loadConfig({ ...env, APP_ALLOWED_ORIGINS: origin }),
      /Invalid environment: APP_ALLOWED_ORIGINS/,
      origin,
    );
  }
  assert.throws(
    () => loadConfig({ ...env, APP_ORIGIN: "ftp://example.com" }),
    /Invalid environment: APP_ORIGIN/,
  );
});

test("production requires HTTPS for both primary and additional origins", () => {
  const production = { ...env, NODE_ENV: "production" };
  assert.throws(() => loadConfig(production), /HTTPS APP_ORIGIN/);
  assert.throws(
    () =>
      loadConfig({
        ...production,
        APP_ORIGIN: "https://dpauto.example",
        APP_ALLOWED_ORIGINS: lan,
      }),
    /HTTPS APP_ALLOWED_ORIGINS/,
  );
  assert.deepEqual(
    loadConfig({
      ...production,
      APP_ORIGIN: "https://dpauto.example",
      APP_ALLOWED_ORIGINS: "https://crm.dpauto.example",
    }).allowedOrigins,
    ["https://dpauto.example", "https://crm.dpauto.example"],
  );
});

test("origin and CSRF guards accept localhost and LAN with a valid session and token", () => {
  for (const origin of [primary, lan]) {
    const req = request({
      origin,
      "sec-fetch-site": "same-origin",
      "x-csrf-token": session.csrf_token,
    });
    assert.doesNotThrow(() => auth.origin(req));
    assert.doesNotThrow(() => auth.csrf(req, session));
    assert.doesNotThrow(() =>
      auth.csrf(
        request({
          referer: `${origin}/co-van?tab=today`,
          "x-csrf-token": session.csrf_token,
        }),
        session,
      ),
    );
  }
});

test("origin and CSRF guards reject unlisted origins and cross-site requests", () => {
  for (const origin of [
    "https://evil.example",
    `${primary}.evil.example`,
    "http://192.168.100.209:4002",
    "https://192.168.100.209:4001",
    "null",
    `${lan},${primary}`,
  ]) {
    const req = request({
      origin,
      referer: `${primary}/co-van`,
      "x-csrf-token": session.csrf_token,
    });
    assert.throws(() => auth.origin(req), denied("FORBIDDEN"), origin);
    assert.throws(
      () => auth.csrf(req, session),
      denied("CSRF_INVALID"),
      origin,
    );
  }
  const crossSite = request({
    origin: lan,
    "sec-fetch-site": "cross-site",
    "x-csrf-token": session.csrf_token,
  });
  assert.throws(() => auth.origin(crossSite), denied("FORBIDDEN"));
  assert.throws(() => auth.csrf(crossSite, session), denied("CSRF_INVALID"));
});

test("an allowed origin still requires a valid CSRF token, session and origin or referer", () => {
  for (const headers of [
    { origin: lan },
    { origin: lan, "x-csrf-token": "wrong-token" },
    { "x-csrf-token": session.csrf_token },
    { referer: "invalid", "x-csrf-token": session.csrf_token },
    {
      referer: "https://evil.example/co-van",
      "x-csrf-token": session.csrf_token,
    },
  ]) {
    assert.throws(
      () => auth.csrf(request(headers), session),
      denied("CSRF_INVALID"),
    );
  }
  assert.throws(
    () =>
      auth.csrf(request({ origin: lan, "x-csrf-token": session.csrf_token })),
    denied("CSRF_INVALID"),
  );
});
