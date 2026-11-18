import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const file = ts.createSourceFile(
  "booking-dialog.tsx",
  fs.readFileSync(
    new URL(
      "../src/components/public-booking/booking-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const functions = [];
function collect(node) {
  if (
    ts.isFunctionDeclaration(node) &&
    ["submit", "goTo"].includes(node.name?.text)
  )
    functions.push(node.getText(file));
  ts.forEachChild(node, collect);
}
collect(file);
assert.equal(functions.length, 2);
// Exercise the real handlers without mounting the popup or sending any network requests.
const handlers = ts.transpileModule(functions.join("\n"), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
  },
}).outputText;
class ApiFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function form(overrides = {}) {
  const calls = [];
  const state = {
    step: 3,
    submitting: false,
    closing: false,
    success: false,
    apiEnabled: true,
    time: "morning",
    ready: true,
    acknowledged: false,
    customer: {
      name: "Nguyễn Văn An",
      phone: "0772584279",
      vehicle: "Toyota Vios",
      plate: "51G-123.45",
    },
    serviceIds: ["wash"],
    date: "2026-11-20",
    note: "Kiểm tra phanh",
    catalog: {
      catalogVersion: 1,
      bookingPolicy: { privacyNoticeVersion: "BOOKING_V1" },
    },
    catalogRetry: 0,
    dialog: { current: null },
    validateCustomer: () => ({}),
    window: { location: { search: "" } },
    URLSearchParams,
    Error,
    ApiFailure,
    requestAnimationFrame: () => 0,
    focusStep() {},
    command: async (path, payload) => {
      calls.push({ path, payload });
      return { data: { bookingCode: "DP-DV14112026-001" } };
    },
    ...overrides,
  };
  for (const name of [
    "step",
    "submitting",
    "timeError",
    "serviceError",
    "catalogRetry",
    "time",
    "ready",
    "acknowledged",
    "success",
    "direction",
    "errors",
  ]) {
    state[`set${name[0].toUpperCase()}${name.slice(1)}`] = (value) => {
      state[name] = typeof value === "function" ? value(state[name]) : value;
    };
  }
  vm.createContext(state);
  vm.runInContext(handlers, state);
  return { state, calls, submit: () => state.submit({ preventDefault() {} }) };
}

test("time selection advances to review without consent or sending a booking", async () => {
  const f = form();
  await f.submit();
  assert.equal(f.state.step, 4);
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.time, "morning");
  assert.equal(f.state.note, "Kiểm tra phanh");
  const incomplete = form({ time: "" });
  await incomplete.submit();
  assert.equal(incomplete.state.step, 3);
  assert.ok(incomplete.state.timeError);
  assert.equal(incomplete.calls.length, 0);
});

test("review requires consent; only final confirmation sends the original booking payload", async () => {
  const f = form({ step: 4 });
  await f.submit();
  assert.equal(f.calls.length, 0);
  assert.ok(f.state.timeError);
  f.state.acknowledged = true;
  await f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].path, "public/bookings");
  assert.equal(f.calls[0].payload.requestedDate, "2026-11-20");
  assert.equal(f.calls[0].payload.requestedPeriod, "MORNING");
  assert.equal(f.calls[0].payload.notice.privacyNoticeAcknowledged, true);
  assert.equal(f.calls[0].payload.note, "Kiểm tra phanh");
  assert.equal(f.state.success, true);
  assert.equal(f.state.submitting, false);
});

test("editing review keeps the draft and asks for consent again", () => {
  const f = form({ step: 4, acknowledged: true });
  f.state.goTo(3);
  assert.equal(f.state.step, 3);
  assert.equal(f.state.acknowledged, false);
  assert.equal(f.state.time, "morning");
  assert.equal(f.state.note, "Kiểm tra phanh");
});

test("expired availability returns to time selection; other API errors stay on review", async () => {
  const f = form({
    step: 4,
    acknowledged: true,
    command: async () => {
      throw new ApiFailure("PERIOD_UNAVAILABLE");
    },
  });
  await f.submit();
  assert.equal(f.state.step, 3);
  assert.equal(f.state.time, "");
  assert.equal(f.state.ready, false);
  assert.equal(f.state.acknowledged, false);
  assert.equal(f.state.success, false);
  const failed = form({
    step: 4,
    acknowledged: true,
    command: async () => {
      throw Error("Mất kết nối");
    },
  });
  await failed.submit();
  assert.equal(failed.state.step, 4);
  assert.equal(failed.state.time, "morning");
  assert.equal(failed.state.timeError, "Mất kết nối");
  assert.equal(failed.state.success, false);
  const missingServices = form({ step: 4, acknowledged: true, serviceIds: [] });
  await missingServices.submit();
  assert.equal(missingServices.state.step, 2);
  assert.equal(missingServices.calls.length, 0);
});
