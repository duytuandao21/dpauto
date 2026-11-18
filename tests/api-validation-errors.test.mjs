import test from "node:test";
import assert from "node:assert/strict";
import renderer from "./helpers/service-ticket-render.cjs";

test("API errors preserve validation paths and ignore malformed field entries", async () => {
  let fields = [
    {
      path: "intake.odometer",
      code: "too_big",
      message: "Giá trị không hợp lệ.",
    },
    { path: "", code: "unrecognized_keys" },
    null,
    "invalid",
    { path: 5, code: "invalid_type" },
    { path: "vehicle" },
  ];
  const { request, ApiFailure } = renderer.load(
    "lib/api/client.ts",
    {},
    {
      process: { env: {} },
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Vui lòng kiểm tra dữ liệu.",
              fields,
            },
          },
          { status: 400 },
        ),
    },
  );
  await assert.rejects(request("admin/bookings/example/receive"), (error) => {
    assert.ok(error instanceof ApiFailure);
    assert.equal(error.message, "Vui lòng kiểm tra dữ liệu.");
    assert.deepEqual(
      JSON.parse(JSON.stringify(error.fields)),
      fields.slice(0, 2),
    );
    return true;
  });
  fields = null;
  await assert.rejects(
    request("admin/service-visits"),
    (error) => error.fields.length === 0,
  );
  assert.equal(
    new ApiFailure(400, "VALIDATION_FAILED", "Invalid").fields.length,
    0,
  );
});
