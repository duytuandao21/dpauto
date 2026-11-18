import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const source = fs.readFileSync(
    new URL(`../src/${file}`, import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      imports[name] ??
      (name === "@/lib/advisor/formats"
        ? load("lib/advisor/formats.ts")
        : name === "@/components/advisor/date-input"
          ? {
              DateInput: ({ value, onValueChange, withTime, ...props }) =>
                React.createElement("input", {
                  ...props,
                  value,
                  type: withTime ? "datetime-local" : "date",
                  onChange: (e) => onValueChange(e.target.value),
                }),
            }
          : require(name)),
    URLSearchParams,
    Date,
  });
  return module.exports;
}
const logic = load("lib/booking/logic.ts");
const queue = load("lib/booking/queue.ts");
const today = logic.localDate();
const make = (
  id,
  status,
  date = today,
  createdAt = "2026-11-01T00:00:00Z",
) => ({
  id,
  status,
  requestedAt: `${date}T09:00:00`,
  createdAt,
  customerId: id,
  vehicleId: id,
  serviceIds: ["service"],
  advisorId: "advisor",
  customerSnapshot: { name: `Khách ${id}`, phone: "0772584279" },
  vehicleSnapshot: { model: "Toyota Vios", plate: "51A-12345" },
});
const bookings = [
  make("new", "pending", today, "2026-11-02T00:00:00Z"),
  make("old", "pending"),
  make("future", "pending", logic.shiftDate(today, 30)),
  make("soon", "confirmed"),
  make("tomorrow", "confirmed", logic.shiftDate(today, 1)),
  make("arrived", "arrived", logic.shiftDate(today, -20)),
  make("done", "completed"),
];
const data = {
  bookings,
  customers: [],
  vehicles: [],
  services: [{ id: "service", name: "Phủ ceramic" }],
  advisors: [],
};
const h = React.createElement;
function workspace(search = "", bookingsData = data) {
  let params = new URLSearchParams(search);
  let cursor = 0;
  const state = [];
  const imports = {
    react: {
      ...React,
      useEffect() {},
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [
          state[index],
          (value) => {
            state[index] = value;
          },
        ];
      },
    },
    "next/link": {
      default: ({ children, scroll, ...props }) => h("a", props, children),
    },
    "next/navigation": {
      useSearchParams: () => params,
      useRouter: () => ({
        replace: (url) => {
          params = new URLSearchParams(url.split("?")[1]);
        },
      }),
    },
    "@/lib/booking/seed": { advisors: [], bookingServices: [] },
    "@/lib/booking/logic": logic,
    "@/lib/booking/queue": queue,
    "@/lib/api/client": { apiEnabled: false },
    "./booking-provider": {
      useBookings: () => ({
        data: bookingsData,
        ready: true,
        selectedDate: today,
        setSelectedDate() {},
      }),
    },
    "./admin-icon": { AdminIcon: () => null },
    "./primitives": {
      AdminLoading: () => null,
      NotFoundState: () => null,
      EmptyState: () => h("p", null, "Trống"),
      PageHeading: ({ title, children }) =>
        h("header", null, h("h1", null, title), children),
      StatusBadge: ({ status }) => h("span", null, status),
    },
    "./booking-actions": {
      BookingReasonButton: ({ action }) =>
        h(
          "button",
          { className: "adm-btn adm-danger" },
          logic.actionLabels[action],
        ),
      BookingActions: ({ secondaryOnly }) =>
        secondaryOnly ? null : h("button", null, "Chốt lịch"),
      EditBookingLink: () => null,
      RescheduleButton: () => null,
    },
    "./booking-detail": {
      BookingDetail: ({ booking }) =>
        h("section", { "data-detail": booking.id }, booking.id),
    },
    "./booking-form": { BookingForm: () => null },
    "@/components/advisor/overview-tasks": { OverviewTasks: () => null },
    "@/components/advisor/workspace-drawer": {
      WorkspaceDrawer: ({ children }) => h("dialog", { open: true }, children),
    },
  };
  const { BookingsWorkspace, BookingCard, BookingTable } = load(
    "components/admin/bookings-workspace.tsx",
    imports,
  );
  return {
    imports,
    card(booking, compact = true) {
      return renderToStaticMarkup(
        h(BookingCard, {
          booking,
          compact,
          href: "/co-van?booking=" + booking.id,
        }),
      );
    },
    table(bookings) {
      return renderToStaticMarkup(
        h(BookingTable, { bookings, params, date: today }),
      );
    },
    tree(overview = true) {
      cursor = 0;
      return BookingsWorkspace({ overview });
    },
    html(overview = true) {
      return renderToStaticMarkup(this.tree(overview));
    },
  };
}
function find(element, predicate) {
  if (!React.isValidElement(element)) return;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}

test("booking table shows two services and links to the full list with an accurate remaining count", () => {
  const view = workspace("q=An&view=all");
  const booking = {
    ...make("multi", "pending"),
    serviceIds: ["a", "b", "c", "d", "e"],
    serviceNames: {
      a: "Bảo dưỡng định kỳ",
      b: "Lắp đặt phụ kiện ô tô",
      c: "Dán phim cách nhiệt",
      d: "Vệ sinh nội thất",
      e: "Phủ ceramic",
    },
  };
  const html = view.table([booking]);
  assert.match(html, /class="adv-data-table adv-bookings-table" role="table"/);
  assert.equal((html.match(/role="cell"/g) || []).length, 6);
  assert.match(html, /title="Bảo dưỡng định kỳ"/);
  assert.match(html, /title="Lắp đặt phụ kiện ô tô"/);
  assert.match(html, /\+3 dịch vụ khác/);
  assert.match(html, /aria-label="Xem tất cả 5 dịch vụ"/);
  assert.match(
    html,
    /href="\/co-van\/lich-hen\/multi\?q=An&amp;view=all&amp;date=/,
  );
  assert.doesNotMatch(html, /Dán phim cách nhiệt|Vệ sinh nội thất|Phủ ceramic/);
  for (const count of [1, 2]) {
    const limited = view.table([
      { ...booking, serviceIds: booking.serviceIds.slice(0, count) },
    ]);
    assert.doesNotMatch(limited, /dịch vụ khác/);
  }
});

test("booking service summary keeps catalog names and counts items with unavailable names", () => {
  const view = workspace();
  const booking = {
    ...make("catalog", "pending"),
    serviceIds: ["service", "unknown", "another"],
  };
  const html = view.table([booking]);
  assert.match(html, /Phủ ceramic/);
  assert.match(html, /Chưa có tên dịch vụ/);
  assert.match(html, /\+1 dịch vụ khác/);
  assert.match(
    view.table([{ ...booking, serviceIds: [] }]),
    /Chưa chọn dịch vụ/,
  );
});

test("overview card summarizes multiple services inside its existing detail link", () => {
  const view = workspace();
  const booking = {
    ...make("multi", "pending"),
    serviceIds: ["a", "b", "c", "d", "e"],
    serviceNames: {
      a: "Bảo dưỡng định kỳ",
      b: "Lắp đặt phụ kiện ô tô",
      c: "Dán phim cách nhiệt",
      d: "Vệ sinh nội thất",
      e: "Phủ ceramic",
    },
  };
  const html = view.card(booking);
  assert.match(html, /title="Bảo dưỡng định kỳ"/);
  assert.match(html, /title="Lắp đặt phụ kiện ô tô"/);
  assert.match(html, /\+3 dịch vụ khác/);
  assert.doesNotMatch(html, /Dán phim cách nhiệt|Vệ sinh nội thất|Phủ ceramic/);
  const detailLink = html.match(
    /<a[^>]*class="adm-card-main"[^>]*>([\s\S]*?)<\/a>/,
  )[0];
  assert.match(detailLink, /href="\/co-van\?booking=multi"/);
  assert.match(detailLink, /\+3 dịch vụ khác/);
  assert.equal((detailLink.match(/<a\b/g) || []).length, 1);
  for (const count of [1, 2])
    assert.doesNotMatch(
      view.card({ ...booking, serviceIds: booking.serviceIds.slice(0, count) }),
      /dịch vụ khác/,
    );
  assert.match(view.card({ ...booking, serviceIds: [] }), /Chưa chọn dịch vụ/);
});

test("compact card opens booking details instead of offering cancellation in every group", () => {
  const view = workspace();
  for (const booking of [
    make("pending", "pending"),
    make("confirmed", "confirmed"),
    make("arrived", "arrived"),
    { ...make("restricted", "pending"), allowedActions: ["confirm"] },
  ]) {
    const html = view.card(booking);
    assert.match(
      html,
      new RegExp(
        `href="/co-van\\?booking=${booking.id}" class="adm-btn">Chi tiết</a>`,
      ),
    );
    assert.doesNotMatch(html, /Hủy lịch|adm-danger/);
    assert.match(html, /href="tel:0772584279"/);
    assert.doesNotMatch(html, /adm-booking-menu/);
  }
  assert.match(
    view.card(make("standard", "pending"), false),
    /adm-booking-menu/,
  );
});

test("cancellation button opens the existing reason dialog without immediately cancelling", () => {
  const { imports } = workspace();
  let opened = 0;
  let cancelled = 0;
  const { BookingReasonButton } = load("components/admin/booking-actions.tsx", {
    ...imports,
    react: {
      ...React,
      useState: (initial) => [initial, () => {}],
      useRef: () => ({ current: { showModal: () => opened++, close() {} } }),
    },
    "./booking-provider": {
      useBookings: () => ({ theme: "light", act: () => cancelled++ }),
    },
    "@/components/advisor/advisor-provider": {
      useAdvisor: () => ({ orders: [] }),
    },
    "./auth-gate": { useSession: () => null },
    "./booking-time-form": { BookingTimeForm: () => null },
  });
  const tree = BookingReasonButton({
    booking: make("pending", "pending"),
    action: "cancel",
  });
  const button = find(
    tree,
    (node) => node.type === "button" && node.props.onClick,
  );
  button.props.onClick();
  assert.equal(opened, 1);
  assert.equal(cancelled, 0);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Lý do thực tế/);
  assert.match(html, /<textarea[^>]*required=""/);
  assert.match(
    html,
    /<button class="adm-btn adm-danger" disabled="">Hủy lịch<\/button>/,
  );
});

test("confirmation form keeps the requested period, exact time and optional collapsed note; rescheduling keeps its fields", () => {
  const { imports } = workspace();
  const { BookingTimeForm } = load("components/admin/booking-time-form.tsx", {
    ...imports,
    react: React,
    "@/components/ui/icon": { Icon: () => null },
  });
  const props = {
    booking: {
      ...make("confirm", "pending"),
      originalPeriod: "morning",
      serviceNames: { service: "Phủ ceramic" },
      customerSnapshot: { name: "Anh Văn", phone: "+84901234567" },
    },
    advisors: [{ id: "advisor", name: "Cố vấn An" }],
    onSave: async () => {},
    onCancel() {},
  };
  const html = renderToStaticMarkup(
    h(BookingTimeForm, { ...props, confirm: true, pickAdvisor: true }),
  );
  assert.match(html, /href="tel:0901234567" aria-label="Gọi Anh Văn"/);
  assert.match(html, /Toyota Vios · 51A-123.45/);
  assert.match(html, /Phủ ceramic/);
  assert.match(html, /Buổi sáng/);
  assert.match(html, /Thời gian đã thống nhất/);
  assert.match(html, /Giờ hẹn \(24h\)<input required="" type="time" value=""/);
  assert.match(html, /Cố vấn phụ trách/);
  const notes = html.match(/<details[^>]*>[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(notes, /<details[^>]*\bopen/);
  assert.match(notes, /không bắt buộc/);
  assert.match(notes, /maxLength="1000"/);
  assert.match(html, />Hủy<\/button>/);
  assert.match(html, /Xác nhận lịch hẹn/);
  const multiple = renderToStaticMarkup(
    h(BookingTimeForm, {
      ...props,
      confirm: true,
      booking: {
        ...props.booking,
        serviceIds: ["a", "b", "c"],
        serviceNames: { a: "Bảo dưỡng", b: "Rửa xe", c: "Phủ ceramic" },
      },
    }),
  );
  const services = multiple.match(
    /<details class="adv-booking-confirm-services">[\s\S]*?<\/details>/,
  )[0];
  assert.match(services, /Bảo dưỡng, Rửa xe/);
  assert.match(services, /\+1 dịch vụ khác/);
  assert.match(services, /<li>Phủ ceramic<\/li>/);
  assert.doesNotMatch(services, /<details[^>]*\bopen/);
  const reschedule = renderToStaticMarkup(
    h(BookingTimeForm, {
      ...props,
      booking: { ...props.booking, period: "afternoon" },
    }),
  );
  assert.match(reschedule, /Buổi chiều/);
  assert.match(reschedule, /Lý do đổi giờ \(nếu có\)/);
  assert.match(reschedule, /maxLength="400"/);
  assert.match(reschedule, /Lưu giờ mới/);
  assert.doesNotMatch(reschedule, /<details|adv-booking-confirm/);
});

test("confirmation dialog resolves missing snapshots from existing data without replacing booking snapshots", () => {
  const { imports } = workspace();
  let passed;
  const { RescheduleButton } = load("components/admin/booking-actions.tsx", {
    ...imports,
    "@/components/advisor/advisor-provider": {
      useAdvisor: () => ({ orders: [] }),
    },
    react: {
      ...React,
      useState: () => [true, () => {}],
      useRef: () => ({ current: null }),
    },
    "./auth-gate": { useSession: () => ({ roles: ["MANAGER"] }) },
    "./booking-time-form": {
      BookingTimeForm: (props) => {
        passed = props;
        return null;
      },
    },
    "./booking-provider": {
      useBookings: () => ({
        data: {
          ...data,
          customers: [
            {
              id: "confirm",
              name: "Khách trong danh sách",
              phone: "0901234567",
            },
          ],
          vehicles: [
            { id: "confirm", model: "Honda Civic", plate: "79A12345" },
          ],
        },
      }),
    },
  });
  const booking = {
    ...make("confirm", "pending"),
    advisorId: "",
    customerSnapshot: undefined,
    vehicleSnapshot: undefined,
  };
  const html = renderToStaticMarkup(
    h(RescheduleButton, { booking, confirm: true }),
  );
  assert.match(html, /adv-booking-confirm-dialog/);
  assert.match(html, /Xác nhận giờ tiếp nhận với khách/);
  assert.match(html, /autofocus="" aria-label="Đóng form chốt lịch"/);
  assert.equal(passed.booking.customerSnapshot.name, "Khách trong danh sách");
  assert.equal(passed.booking.vehicleSnapshot.model, "Honda Civic");
  assert.equal(passed.booking.serviceNames.service, "Phủ ceramic");
  assert.equal(passed.pickAdvisor, true);
  renderToStaticMarkup(
    h(RescheduleButton, {
      booking: {
        ...booking,
        customerSnapshot: { name: "Khách đã lưu", phone: "0977393913" },
        serviceNames: { service: "Tên dịch vụ đã lưu" },
      },
      confirm: true,
    }),
  );
  assert.equal(passed.booking.customerSnapshot.name, "Khách đã lưu");
  assert.equal(passed.booking.serviceNames.service, "Tên dịch vụ đã lưu");
});

test("booking details contact buttons use the current customer's domestic phone and keep existing actions", () => {
  const { imports } = workspace();
  const detailImports = {
    ...imports,
    react: React,
    "./booking-provider": {
      useBookings: () => ({
        data: {
          ...data,
          customers: [
            { id: "details", name: "Old contact", phone: "+84901234567" },
          ],
        },
      }),
    },
    "@/components/advisor/advisor-provider": {
      useAdvisor: () => ({ orders: [] }),
    },
    "./auth-gate": { useSession: () => null },
    "./booking-time-form": { BookingTimeForm: () => null },
  };
  const actions = load("components/admin/booking-actions.tsx", detailImports);
  const { BookingDetail } = load("components/admin/booking-detail.tsx", {
    ...detailImports,
    "./booking-actions": actions,
  });
  const booking = {
    ...make("details", "pending"),
    events: [],
    customerSnapshot: { name: "Anh Văn", phone: "+84977393913" },
  };
  const html = renderToStaticMarkup(h(BookingDetail, { booking }));
  assert.match(
    html,
    /class="adm-btn" href="tel:0977393913" aria-label="Gọi Anh Văn"/,
  );
  assert.match(
    html,
    /href="https:\/\/zalo.me\/0977393913" target="_blank" rel="noopener noreferrer"/,
  );
  for (const label of ["Chốt lịch", "Hủy lịch", "Đổi giờ", "Sửa thông tin"])
    assert.ok(html.includes(label));
  const withoutPhone = renderToStaticMarkup(
    h(BookingDetail, {
      booking: { ...booking, customerSnapshot: { name: "Anh Văn", phone: "" } },
    }),
  );
  assert.doesNotMatch(
    withoutPhone,
    /adm-booking-contact-actions|https:\/\/zalo.me/,
  );
});

test("overview reuses the booking table and mobile cards without losing the pending backlog", () => {
  const html = workspace().html();
  assert.match(html, /5 lịch/);
  for (const label of ["Chờ xử lý (3)", "Sắp đến (1)", "Đã đến (1)"]) {
    assert.ok(html.includes(label), label);
  }
  assert.equal((html.match(/class="adm-kpi adm-kpi-/g) || []).length, 3);
  assert.equal((html.match(/<tr role="row"/g) || []).length - 1, 3);
  assert.match(html, /class="adv-data-table adv-bookings-table"/);
  assert.ok(html.indexOf("Khách old") < html.indexOf("Khách new"));
  assert.match(html, /Khách future/);
  assert.match(html, /href="tel:0772584279"/);
  assert.doesNotMatch(html, /<h2>Cần xử lý<\/h2>/);
  assert.doesNotMatch(html, /adm-booking-card is-selected/);
  assert.doesNotMatch(html, /Chưa liên hệ|Cần gọi lại|Ghi nhận liên hệ/);
});

test("selecting a booking keeps overview and changes the detail panel; groups clear the old selection", () => {
  const view = workspace("booking=new");
  assert.match(view.html(), /data-detail="new"/);
  assert.equal(
    (view.html().match(/<tr role="row" class="is-selected"/g) || []).length,
    1,
  );
  assert.match(view.html(), /href="\/co-van\?booking=old"/);
  const tab = find(
    view.tree(),
    (node) => node.type === "button" && node.props.children === "Sắp đến (1)",
  );
  tab.props.onClick();
  const html = view.html();
  assert.doesNotMatch(html, /data-detail=/);
  assert.doesNotMatch(html, /adm-booking-card is-selected/);
  assert.doesNotMatch(html, /booking=new/);
  assert.equal((html.match(/<tr role="row"/g) || []).length - 1, 1);
  assert.doesNotMatch(html, /Khách tomorrow/);
});

test("task count is static and the list stays visible; full booking page uses a table and keeps groups", () => {
  const view = workspace("booking=new");
  const heading = find(
    view.tree(),
    (node) => node.props.className === "adm-task-heading",
  );
  assert.equal(
    find(heading, (node) => node.type === "button"),
    undefined,
  );
  const html = view.html();
  assert.match(html, /id="advisor-task-list">/);
  assert.doesNotMatch(html, /aria-controls="advisor-task-list"/);
  assert.match(html, /data-detail="new"/);
  const full = workspace().html(false);
  assert.doesNotMatch(full, /adm-task-card/);
  assert.match(full, /Tất cả lịch/);
  assert.match(
    full,
    /<table class="adv-data-table adv-bookings-table" role="table">/,
  );
  assert.match(full, /href="\/co-van\/lich-hen\/old\?/);
});

test("overview caps each booking group at five priorities and keeps the full booking list accessible", () => {
  for (const [status, search] of [
    ["pending", "sort=desc"],
    ["confirmed", "view=today&sort=desc"],
  ]) {
    const bookings = Array.from({ length: 9 }, (_, i) => ({
      ...make(`booking-${i}`, status, today, `2026-11-0${i + 1}T00:00:00Z`),
      requestedAt: `${today}T${String(i + 8).padStart(2, "0")}:00:00`,
    })).reverse();
    const view = workspace(search, { ...data, bookings });
    const html = view.html();
    assert.match(html, /Lịch cần xử lý/);
    assert.equal((html.match(/<tr role="row"/g) || []).length - 1, 5);
    assert.match(html, /Khách booking-0/);
    assert.doesNotMatch(html, /Khách booking-8/);
    assert.match(html, /Hiển thị 5 \/ 9 lịch ưu tiên/);
    assert.match(html, /href="\/co-van\/lich-hen">Xem tất cả lịch hẹn/);
    assert.match(view.html(false), /Khách booking-8/);
  }
});

function taskView({
  visits = [],
  orders = [],
  loading = false,
  error = "",
} = {}) {
  const { imports } = workspace();
  const tickets = load("lib/advisor/service-tickets.ts");
  let index = 0;
  const { OverviewTasks } = load("components/advisor/overview-tasks.tsx", {
    ...imports,
    react: {
      ...imports.react,
      useState: () => [[visits, error, loading, 0][index++], () => {}],
    },
    "@/lib/api/client": { apiEnabled: true },
    "@/components/admin/booking-provider": imports["./booking-provider"],
    "@/lib/advisor/seed": { quoteTotals: () => ({ total: 0 }) },
    "./advisor-provider": { useAdvisor: () => ({ orders }) },
    "@/lib/api/visits": load("lib/api/visits.ts"),
    "@/lib/api/types": load("lib/api/types.ts"),
    "@/lib/advisor/service-tickets": tickets,
    "./service-tickets-table": load(
      "components/advisor/service-tickets-table.tsx",
      {
        "next/link": imports["next/link"],
        "@/lib/advisor/service-tickets": tickets,
        "@/components/admin/primitives": imports["./primitives"],
      },
    ),
    "@/components/admin/admin-icon": imports["./admin-icon"],
    "@/components/admin/primitives": imports["./primitives"],
  });
  return renderToStaticMarkup(h(OverviewTasks));
}

test("service follow-ups reuse the service ticket table and stay expanded", () => {
  assert.match(taskView(), /Phiếu dịch vụ cần xử lý/);
  const html = taskView({
    orders: [
      {
        id: "visit",
        stage: "quote",
        openedAt: "2026-11-16T02:00:00Z",
        quote: { status: "waiting" },
        acceptance: { result: "" },
      },
    ],
  });
  assert.match(html, /<section class="adv-tasks"/);
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /class="adv-ticket-table"/);
  assert.match(html, /Báo giá chờ xác nhận/);
  assert.doesNotMatch(html, /Liên hệ khách để xác nhận giờ/);
});

test("service follow-ups select five priorities, favor overdue and older visits, and skip closed tickets", () => {
  const visits = [
    "newest",
    "new",
    "middle",
    "older",
    "oldest",
    "overdue",
    "closed",
  ].map((id, i) => ({
    id,
    code: `DV-${id}`,
    stage:
      id === "overdue"
        ? "IN_PROGRESS"
        : id === "closed"
          ? "COMPLETED"
          : "QUOTING",
    receivedAt: `2026-11-${String(16 - i).padStart(2, "0")}T01:00:00Z`,
    customer: { name: `Khách ${id}`, phone: "+84772584279" },
    vehicle: { model: "Toyota Vios", plate: "51A12345" },
    work:
      id === "overdue"
        ? { status: "IN_PROGRESS", dueAt: "2026-11-01T01:00:00Z" }
        : null,
  }));
  const html = taskView({ visits });
  assert.equal((html.match(/<tr>/g) || []).length - 1, 5);
  assert.ok(html.indexOf("DV-overdue") < html.indexOf("DV-oldest"));
  assert.ok(html.indexOf("DV-oldest") < html.indexOf("DV-older"));
  assert.doesNotMatch(html, /DV-newest|DV-closed/);
  assert.match(html, /Hiển thị 5 \/ 6 phiếu ưu tiên/);
  assert.match(html, /href="tel:0772584279"/);
  assert.match(html, /51A-123\.45/);
  assert.match(html, /\/co-van\/phieu-dich-vu\/overdue\?tab=thi-cong/);
  assert.match(html, /Xem tất cả phiếu dịch vụ/);
  assert.match(taskView({ loading: true }), /role="status"/);
  assert.match(taskView({ error: "Mất kết nối" }), /role="alert"/);
});
