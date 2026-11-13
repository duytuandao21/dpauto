import test from "node:test";
import assert from "node:assert/strict";
import { intakePayload } from "../src/lib/api/visits.ts";
import { bookingFromApi } from "../src/lib/api/booking-adapter.ts";
import { allowedActions } from "../src/lib/booking/logic.ts";
import { command, ApiFailure } from "../src/lib/api/client.ts";

test("reception adapters preserve zero odometer, missing reasons and booking/visit separation", () => {
  const value = intakePayload({
    request: "  Kiểm tra xe  ",
    odometer: 0,
    odometerMissingReason: "Không dùng",
    conditions: {
      exterior: "",
      interior: "",
      engine: "",
      dashboard: "",
      tires: "",
      operation: [],
    },
    receptionNote: "",
    photos: [],
  });
  assert.equal(value.odometer, 0);
  assert.equal(value.odometerMissingReason, undefined);
  assert.equal(value.request, "Kiểm tra xe");
  assert.equal(
    intakePayload({
      ...value,
      odometer: null,
      odometerMissingReason: "  Không đọc được  ",
    }).odometerMissingReason,
    "Không đọc được",
  );
  const booking = bookingFromApi({
    id: "b",
    code: "BK",
    customerId: "c",
    status: "CONFIRMED",
    source: "PHONE",
    customer: { name: "Khách", phone: "0901234567" },
    vehicle: null,
    services: [],
    requestedStartAt: "2026-11-12T03:00:00Z",
    scheduledStartAt: "2026-11-12T03:00:00Z",
    confirmedStartAt: "2026-11-12T03:00:00Z",
    assignedAdvisor: { id: "a", name: "Cố vấn" },
    changeKind: "NEW",
    version: 1,
    serviceVisitId: null,
  });
  assert.ok(allowedActions(booking).includes("arrive"));
  const arrived = bookingFromApi({
    ...{
      id: "b",
      code: "BK",
      customerId: "c",
      status: "ARRIVED",
      source: "PHONE",
      customer: { name: "Khách", phone: "0901234567" },
      vehicle: null,
      services: [],
      requestedStartAt: "2026-11-12T03:00:00Z",
      scheduledStartAt: "2026-11-12T03:00:00Z",
      confirmedStartAt: "2026-11-12T03:00:00Z",
      assignedAdvisor: { id: "a", name: "Cố vấn" },
      changeKind: "NEW",
      version: 2,
    },
    serviceVisitId: "visit",
  });
  assert.equal(arrived.serviceVisitId, "visit");
  assert.deepEqual(allowedActions(arrived), []);
});

test("walk-in retries retain original key and payload across metadata refresh after unknown outcome", async () => {
  const oldFetch = globalThis.fetch,
    calls: { headers: Headers; body: any }[] = [];
  globalThis.fetch = async (_url, options) => {
    if (String(_url).endsWith("/auth/csrf"))
      return new Response(
        JSON.stringify({ data: { csrfToken: "csrf" }, meta: {} }),
        { status: 200 },
      );
    calls.push({
      headers: new Headers(options?.headers),
      body: JSON.parse(String(options?.body)),
    });
    if (calls.length === 1) throw new TypeError("Network interrupted");
    return new Response(
      JSON.stringify({ data: { visitId: "visit", bookingId: null }, meta: {} }),
      { status: 201 },
    );
  };
  try {
    const input = {
      customer: { name: "Khách", phone: "0901234567" },
      vehicle: { model: "Vios" },
      policyVersion: 1,
      catalogVersion: 1,
    };
    await assert.rejects(
      command("admin/service-visits", input),
      (e: unknown) => e instanceof ApiFailure && e.status === 0,
    );
    await command("admin/service-visits", {
      ...input,
      policyVersion: 2,
      catalogVersion: 2,
    });
    assert.equal(
      calls[0].headers.get("idempotency-key"),
      calls[1].headers.get("idempotency-key"),
    );
    assert.deepEqual(calls[0].body, calls[1].body);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
