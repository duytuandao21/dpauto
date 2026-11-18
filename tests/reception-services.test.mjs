import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import renderer from "./helpers/service-ticket-render.cjs";

const { load, link } = renderer;
const { ApiFailure } = load("lib/api/client.ts", {}, { process: { env: {} } });
function find(node, predicate) {
  if (!React.isValidElement(node)) return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

test("booking reception preselects booked services, saves added/removed checks, and preserves edits on retry", async () => {
  let stateIndex = 0,
    refIndex = 0,
    effectIndex = 0,
    reject = true;
  const states = [],
    refs = [],
    dependencies = [],
    effects = [],
    calls = [],
    destinations = [];
  const booking = {
    id: "booking",
    version: 3,
    status: "CONFIRMED",
    customerId: "customer",
    customer: { name: "Anh Văn", phone: "0777393913" },
    vehicle: { id: "vehicle", model: "Honda Civic", plate: "79A12345" },
    assignedAdvisor: { id: "advisor", name: "Cố vấn" },
    services: [
      { id: "original", name: "Bảo dưỡng" },
      { id: "retired", name: "Dịch vụ đã đặt trước" },
    ],
    customerNote: "Khách chờ lấy xe",
  };
  let failure = new ApiFailure(409, "VERSION_CONFLICT", "Lịch hẹn đã thay đổi");
  const { LiveReception } = load(
    "components/advisor/live-reception.tsx",
    {
      react: {
        ...React,
        useState(initial) {
          const index = stateIndex++;
          if (!(index in states))
            states[index] = typeof initial === "function" ? initial() : initial;
          return [
            states[index],
            (value) => {
              states[index] =
                typeof value === "function" ? value(states[index]) : value;
            },
          ];
        },
        useRef(initial) {
          const index = refIndex++;
          return (refs[index] ??= { current: initial });
        },
        useEffect(effect, next) {
          const index = effectIndex++;
          if (
            !dependencies[index] ||
            next.some((value, i) => value !== dependencies[index][i])
          ) {
            dependencies[index] = next;
            effects.push(effect);
          }
        },
      },
      "next/link": link,
      "next/navigation": {
        useSearchParams: () => new URLSearchParams(),
        useRouter: () => ({ push: (path) => destinations.push(path) }),
      },
      "@/components/admin/auth-gate": {
        useSession: () => ({ staff: { id: "advisor" }, roles: ["ADVISOR"] }),
      },
      "@/components/admin/primitives": {
        AdminLoading: () => null,
        PageHeading: () => null,
      },
      "@/components/admin/admin-icon": { AdminIcon: () => null },
      "@/lib/booking/logic": {
        formatDate: () => "17/11/2026",
        timeLabel: () => "09:00",
      },
      "@/lib/api/visits": load("lib/api/visits.ts"),
      "./visit-intake-fields": {
        VisitIntakeFields: () => null,
        VisitInspectionFields: () => null,
      },
      "@/lib/api/client": {
        apiEnabled: true,
        ApiFailure,
        request: async (path) => ({
          data: path.startsWith("admin/services")
            ? [
                {
                  id: "original",
                  name: "Bảo dưỡng",
                  active: true,
                  bookable: true,
                },
                { id: "extra", name: "Rửa xe", active: true, bookable: true },
              ]
            : path.startsWith("admin/bookings")
              ? booking
              : [],
          meta: { catalogVersion: 7, policyVersion: 2 },
        }),
        collection: async (path) =>
          path.startsWith("admin/vehicles") ? [booking.vehicle] : [],
        command: async (path, body) => {
          calls.push({ path, body: JSON.parse(JSON.stringify(body)) });
          if (reject) throw failure;
          return { data: { visitId: "visit" } };
        },
      },
    },
    {
      window: {
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {},
      },
      Event,
    },
  );
  const Component = LiveReception({ id: "booking" }).props.children.type;
  const tree = () => {
    stateIndex = refIndex = effectIndex = 0;
    return Component({ id: "booking" });
  };
  const flush = async () => {
    for (const effect of effects.splice(0)) effect();
    await new Promise((resolve) => setImmediate(resolve));
  };
  const fields = () => find(tree(), (node) => !!node.props.serviceSummary);
  const checkbox = (name) =>
    find(
      fields().props.serviceSummary,
      (node) => node.type === "label" && node.props.children[1] === name,
    ).props.children[0];
  const toggle = (name, checked) =>
    checkbox(name).props.onChange({ target: { checked } });
  tree();
  await flush();
  assert.equal(checkbox("Bảo dưỡng").props.checked, true);
  assert.equal(checkbox("Dịch vụ đã đặt trước").props.checked, true);
  assert.equal(checkbox("Rửa xe").props.checked, false);
  toggle("Rửa xe", true);
  toggle("Bảo dưỡng", false);
  toggle("Dịch vụ đã đặt trước", false);
  assert.equal(fields().props.value.request, "Rửa xe\nKhách chờ lấy xe");
  fields().props.onChange({
    ...fields().props.value,
    request: "Ghi chú cố vấn đã nhập",
  });
  toggle("Rửa xe", false);
  assert.equal(
    find(
      tree(),
      (node) =>
        node.type === "button" && node.props.children === "Hoàn tất tiếp nhận",
    ).props.disabled,
    true,
  );
  toggle("Rửa xe", true);
  assert.equal(fields().props.value.request, "Ghi chú cố vấn đã nhập");
  find(
    find(tree(), (node) => node.props.className === "adv-reception-verify"),
    (node) => node.type === "input",
  ).props.onChange({ target: { checked: true } });
  const submit = () =>
    find(tree(), (node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
  await submit();
  tree();
  await flush();
  assert.equal(checkbox("Rửa xe").props.checked, true);
  assert.equal(checkbox("Bảo dưỡng").props.checked, false);
  assert.equal(fields().props.value.request, "Ghi chú cố vấn đã nhập");
  failure = new ApiFailure(
    400,
    "VALIDATION_FAILED",
    "Vui lòng kiểm tra dữ liệu.",
    [
      { path: "intake.odometer", code: "too_big" },
      { path: "serviceIds.0", code: "invalid_format" },
    ],
  );
  await submit();
  assert.match(
    find(tree(), (node) => node.props.role === "alert").props.children,
    /ODO.*Dịch vụ đã chọn/,
  );
  assert.equal(fields().props.value.request, "Ghi chú cố vấn đã nhập");
  failure = new ApiFailure(
    400,
    "VALIDATION_FAILED",
    "Vui lòng kiểm tra dữ liệu.",
    [{ path: "", code: "unrecognized_keys" }],
  );
  await submit();
  assert.match(
    find(tree(), (node) => node.props.role === "alert").props.children,
    /không cùng phiên bản/,
  );
  reject = false;
  await submit();
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[3].body.serviceIds, ["extra"]);
  assert.equal(calls[3].body.catalogVersion, 7);
  assert.equal(calls[3].body.intake.request, "Ghi chú cố vấn đã nhập");
  assert.equal(calls[3].path, "admin/bookings/booking/receive");
  assert.deepEqual(
    booking.services.map((s) => s.id),
    ["original", "retired"],
  );
  assert.deepEqual(destinations, ["/co-van/phieu-dich-vu/visit"]);
});
