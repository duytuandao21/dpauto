import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingFromApi,
  vehicleFromApi,
} from "../src/lib/api/booking-adapter.ts";
import { stationTime } from "../src/lib/api/types.ts";
import {
  command,
  request,
  ApiFailure,
  newRequestKey,
} from "../src/lib/api/client.ts";

test("booking adapter preserves requested origin, scheduled time, scope and snapshots", () => {
  const b = bookingFromApi({
    id: "booking",
    code: "DP-BOOKING",
    customerId: "customer",
    version: 2,
    status: "PENDING",
    source: "WEBSITE",
    customer: { name: "Nguyễn Văn An", phone: "+84901234567" },
    vehicle: null,
    services: [{ id: "service", name: "Tên lúc đặt" }],
    requestedStartAt: "2026-11-12T02:00:00Z",
    scheduledStartAt: "2026-11-13T03:00:00Z",
    confirmedStartAt: null,
    assignedAdvisor: null,
    changeKind: "RESCHEDULED",
  });
  assert.equal(b.requestedAt, "2026-11-12T09:00:00+07:00");
  assert.equal(b.scheduledAt, "2026-11-13T10:00:00+07:00");
  assert.equal(b.customerId, "customer");
  assert.equal(b.serviceNames?.service, "Tên lúc đặt");
  assert.deepEqual(b.allowedActions, ["cancel"]);
  assert.equal(b.vehicleId, "");
  assert.equal(stationTime("2026-11-12T20:00:00Z").slice(0, 10), "2026-11-13");
  assert.deepEqual(
    vehicleFromApi({
      id: "v",
      model: null,
      plate: null,
      year: null,
      customerContacts: [
        { customerId: "one", name: "One" },
        { customerId: "two", name: "Two" },
      ],
    }).customerIds,
    ["one", "two"],
  );
});
test("client retains idempotency key after an unknown network outcome", async () => {
  const original = globalThis.fetch;
  const keys: string[] = [];
  let call = 0;
  globalThis.fetch = async (_url, options) => {
    keys.push((options!.headers as Record<string, string>)["Idempotency-Key"]);
    if (++call === 1) throw new TypeError("Disconnected");
    return Response.json({
      data: { bookingId: "one" },
      meta: { replayed: true },
    });
  };
  try {
    await assert.rejects(
      command("public/bookings", { example: true }),
      (e) => e instanceof ApiFailure && e.code === "NETWORK_ERROR",
    );
    const receipt = await command<{ bookingId: string }>("public/bookings", {
      example: true,
    });
    assert.equal(receipt.data.bookingId, "one");
    assert.equal(keys[0], keys[1]);
    assert.match(
      newRequestKey(),
      /^[\da-f]{8}(-[\da-f]{4})-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("request retries freeze uncertain create metadata and never cache auth commands", async () => {
  const original = globalThis.fetch,
    creates: { key: string; body: unknown }[] = [],
    authKeys: string[] = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("auth/csrf"))
      return Response.json({ data: { csrfToken: "test-context" }, meta: {} });
    const key = (options!.headers as Record<string, string>)["Idempotency-Key"];
    if (String(url).endsWith("public/bookings")) {
      creates.push({ key, body: JSON.parse(String(options!.body)) });
      if (creates.length === 1) throw new TypeError("Unknown outcome");
    } else {
      authKeys.push(key);
      if (authKeys.length === 1) throw new TypeError("Unknown outcome");
    }
    return Response.json({ data: { id: "one" }, meta: {} });
  };
  try {
    await assert.rejects(
      command("public/bookings", {
        marker: "metadata",
        catalogVersion: 1,
        policyVersion: 1,
      }),
    );
    await command("public/bookings", {
      marker: "metadata",
      catalogVersion: 2,
      policyVersion: 3,
    });
    assert.equal(creates[0].key, creates[1].key);
    assert.deepEqual(creates[0].body, creates[1].body);
    await assert.rejects(
      command("admin/auth/login", {
        email: "staff@example.test",
        password: "Temporary test password",
      }),
    );
    await command("admin/auth/login", {
      email: "staff@example.test",
      password: "Temporary test password",
    });
    assert.notEqual(authKeys[0], authKeys[1]);
  } finally {
    globalThis.fetch = original;
  }
});
