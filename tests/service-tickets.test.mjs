import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, Children, isValidElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import renderer from "./helpers/service-ticket-render.cjs";
const { load, tickets, link, ServiceTicketsTable } = renderer;
const {
  ticketAction,
  ticketStage,
  ticketAmount,
  ticketLabels,
  localTicketStage,
} = tickets;
const permissions = [
  "visits.update",
  "quotes.write",
  "quotes.decide",
  "work.write",
  "acceptance.record",
  "visits.handover",
];
const pricing = {
  approvedTotal: null,
  estimateTotal: null,
  payableTotal: null,
  hasOpenQuote: false,
  hasExemption: false,
};
const visit = {
  id: "visit",
  code: "DV-20261114-001",
  stage: "RECEIVED",
  pricing,
};

test("service ticket status mapping preserves inspection, paused/rework and terminal stages", () => {
  assert.equal(ticketStage(visit), "QUOTE");
  assert.equal(ticketAction("QUOTE", permissions, true).tab, "tong-quan");
  assert.equal(
    ticketAction("QUOTE", permissions, true).label,
    "Tiếp tục xử lý",
  );
  assert.equal(
    ticketStage({
      ...visit,
      stage: "INSPECTED",
      work: { status: "NOT_STARTED" },
    }),
    "QUOTE",
  );
  assert.equal(
    ticketStage({
      ...visit,
      stage: "INSPECTED",
      work: { status: "NOT_STARTED" },
      pricing: { ...pricing, approvedTotal: "0" },
    }),
    "WAITING_WORK",
  );
  assert.equal(
    ticketStage({
      ...visit,
      stage: "INSPECTED",
      work: { status: "NOT_STARTED" },
      pricing: { ...pricing, approvedTotal: "100", hasOpenQuote: true },
    }),
    "QUOTE",
  );
  assert.equal(
    ticketStage({ ...visit, stage: "IN_PROGRESS", work: { status: "PAUSED" } }),
    "PAUSED",
  );
  for (const stage of [
    "REWORK",
    "ABORTED",
    "HANDED_OVER",
    "READY",
    "QUALITY_CHECK",
  ]) {
    assert.equal(ticketStage({ ...visit, ticketStage: stage }), stage);
  }
  const local = { stage: "done", acceptance: { result: "passed" } };
  assert.equal(localTicketStage(local), "READY");
  assert.equal(
    localTicketStage({ ...local, stage: "acceptance" }),
    "QUALITY_CHECK",
  );
});

test("service ticket actions respect permissions and navigate to the matching workflow tab", () => {
  const tabs = {
    QUOTE: "bao-gia",
    WAITING_WORK: "thi-cong",
    IN_PROGRESS: "thi-cong",
    PAUSED: "thi-cong",
    REWORK: "thi-cong",
    QUALITY_CHECK: "nghiem-thu",
    READY: "nghiem-thu",
    HANDED_OVER: "tong-quan",
    ABORTED: "tong-quan",
  };
  for (const [stage, tab] of Object.entries(tabs)) {
    assert.equal(ticketAction(stage, permissions).tab, tab);
    assert.equal(ticketAction(stage, []).label, "Xem phiếu");
  }
});

test("service ticket money distinguishes missing, estimated, approved, free and payable amounts", () => {
  assert.equal(ticketAmount(visit).value, null);
  assert.equal(ticketAmount({ ...visit, pricing: undefined }).value, null);
  assert.equal(
    ticketAmount({
      ...visit,
      pricing: { ...pricing, estimateTotal: "4500000", hasOpenQuote: true },
    }).label,
    "Dự kiến",
  );
  assert.equal(
    ticketAmount({
      ...visit,
      pricing: {
        ...pricing,
        approvedTotal: "4500000",
        estimateTotal: "500000",
        payableTotal: "4300000",
        hasOpenQuote: true,
      },
    }).value,
    "4500000",
  );
  const ready = {
    ...visit,
    stage: "READY",
    pricing: { ...pricing, approvedTotal: "4500000", payableTotal: "4300000" },
  };
  assert.equal(ticketAmount(ready).value, "4300000");
  assert.equal(ticketAmount(ready).label, "Phải thanh toán");
  assert.equal(
    ticketAmount({
      ...visit,
      pricing: { ...pricing, hasExemption: true, payableTotal: "0" },
    }).value,
    "0",
  );
});

test("service ticket table has seven ordered columns, accurate money and direct action links", () => {
  const rows = Object.keys(ticketLabels).map((stage, index) => ({
    id: `id-${index}`,
    code: `DV-${index}`,
    plate: "",
    model: "Toyota Vios",
    customer: "Nguyễn Văn An",
    phone: "0772584279",
    stage,
    label: ticketLabels[stage],
    amount:
      index === 0
        ? { value: null, label: "Chưa có báo giá" }
        : { value: index === 1 ? "4500000" : "0", label: "Báo giá đã duyệt" },
    action: ticketAction(stage, permissions),
  }));
  const html = renderToStaticMarkup(h(ServiceTicketsTable, { rows }));
  const headers = [...html.matchAll(/<th scope="col">(.*?)<\/th>/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(headers, [
    "Mã phiếu",
    "Biển số",
    "Tên xe",
    "Khách hàng",
    "Thành tiền",
    "Trạng thái",
    "Thao tác",
  ]);
  assert.match(html, /4\.500\.000 đ/);
  assert.match(html, /Chưa có báo giá/);
  assert.match(html, /Chưa có/);
  assert.match(html, /href="\/co-van\/phieu-dich-vu\/id-0\?tab=bao-gia"/);
  assert.match(html, /href="\/co-van\/phieu-dich-vu\/id-0"/);
  assert.doesNotMatch(html, /<details|Thao tác khác|adv-ticket-menu/);
  const ready = rows.find((row) => row.stage === "READY");
  assert.ok(
    html.includes(`href="/co-van/phieu-dich-vu/${ready.id}?tab=nghiem-thu"`),
  );
  assert.equal(
    (html.match(/class="adm-btn adm-primary"/g) || []).length,
    rows.length,
  );
  assert.match(
    renderToStaticMarkup(h(ServiceTicketsTable, { rows: [] })),
    /Không có phiếu phù hợp/,
  );
});

test("service ticket deletion shares the action row, explains blocked deletion and honors busy/readonly states", () => {
  const row = {
    id: "visit",
    code: "DV-001",
    version: 4,
    stage: "QUOTING",
    label: "Báo giá",
    customer: "Khách",
    phone: "",
    model: "Vios",
    plate: "",
    amount: { value: null, label: "Chưa có báo giá" },
    action: { label: "Chốt báo giá", tab: "bao-gia" },
    canDelete: true,
  };
  const deleted = [];
  const tree = ServiceTicketsTable({
    rows: [row],
    onDelete: (r) => deleted.push(r.id),
  });
  const actions = find(
    tree,
    (node) => node.props.className === "adv-ticket-actions",
  );
  const remove = find(actions, (node) => node.type === "button");
  assert.equal(remove.props.children, "Xóa");
  assert.equal(remove.props.disabled, false);
  assert.equal(remove.props["aria-label"], "Xóa phiếu DV-001");
  assert.equal(remove.props.title, "Xóa phiếu dịch vụ");
  assert.ok(find(actions, (node) => node.props.href?.includes("tab=bao-gia")));
  remove.props.onClick();
  assert.deepEqual(deleted, ["visit"]);
  for (const stage of Object.keys(ticketLabels)) {
    const stageButton = find(
      ServiceTicketsTable({ rows: [{ ...row, stage }], onDelete() {} }),
      (node) => node.type === "button",
    );
    assert.equal(stageButton.props.disabled, false, stage);
  }
  const blocked = ServiceTicketsTable({
    rows: [
      { ...row, canDelete: false, deleteBlockedReason: "Phiếu đã thi công" },
    ],
    onDelete() {},
  });
  const blockedButton = find(blocked, (node) => node.type === "button");
  assert.equal(blockedButton.props.disabled, true);
  assert.equal(blockedButton.props.title, "Phiếu đã thi công");
  const busy = ServiceTicketsTable({
    rows: [row],
    onDelete() {},
    deletingId: "visit",
  });
  assert.equal(
    find(busy, (node) => node.type === "button").props.disabled,
    true,
  );
  assert.match(renderToStaticMarkup(busy), /Đang xóa/);
  assert.doesNotMatch(
    renderToStaticMarkup(h(ServiceTicketsTable, { rows: [row] })),
    /Xóa phiếu/,
  );
});

test("service ticket deletion confirms booking cancellation, sends version and preserves rows on errors", async () => {
  const visit = {
    id: "visit",
    code: "DV-001",
    version: 4,
    bookingId: "booking",
    stage: "QUOTING",
    canDelete: true,
    customer: { name: "Khách", phone: "0901234567" },
    vehicle: { model: "Vios", plate: "51A12345" },
  };
  const view = page({ visits: [visit] });
  view.tree();
  await view.flush();
  const table = () =>
    find(view.tree(), (node) => node.type === ServiceTicketsTable);
  let props = table().props;
  const row = props.rows[0];
  view.confirm(false);
  await props.onDelete(row);
  assert.equal(view.commands.length, 0);
  assert.match(view.confirmations[0], /DV-001/);
  assert.match(
    view.confirmations[0],
    /lịch sử và dữ liệu tài chính vẫn được giữ/,
  );
  assert.match(view.confirmations[0], /Lịch hẹn đang tiếp nhận sẽ bị hủy/);
  view.confirm(true);
  view.failDelete(true);
  const failed = props.onDelete(row);
  assert.equal(table().props.deletingId, "visit");
  await failed;
  assert.equal(table().props.rows.length, 1);
  assert.match(renderToStaticMarkup(view.tree()), /Không thể xóa phiếu/);
  assert.equal(view.events.length, 0);
  assert.equal(view.commands[0].method, "DELETE");
  assert.equal(view.commands[0].path, "admin/service-visits/visit");
  assert.equal(view.commands[0].body.expectedVersion, 4);
  props = table().props;
  await props.onDelete({ ...row, canDelete: false });
  await props.onDelete({ ...row, version: undefined });
  assert.equal(view.commands.length, 1);
  view.failDelete(false);
  await table().props.onDelete(row);
  assert.equal(table().props.rows.length, 0);
  assert.equal(view.events[0], "dpauto-data-updated");
  const readonly = page({ visits: [visit], permissions: ["visits.read"] });
  readonly.tree();
  await readonly.flush();
  const readonlyTable = find(
    readonly.tree(),
    (node) => node.type === ServiceTicketsTable,
  );
  assert.equal(readonlyTable.props.onDelete, undefined);
});

test("finance keeps deleted visits accessible without granting account access to collect-only users", async () => {
  const account = {
    id: "archived",
    code: "DV-ARCHIVED",
    version: 5,
    stage: "COMPLETED",
    deletedAt: "2026-11-16T03:00:00Z",
    customer: { name: "Khách", phone: "0901234567" },
    vehicle: { model: "Vios", plate: "51A12345" },
    balance: {
      assessed: true,
      total: "810000",
      netReceived: "810000",
      outstanding: "0",
      paymentStatus: "PAID",
    },
  };
  const closed = ["HANDED_OVER", "COMPLETED", "ABORTED"].map((stage) => ({
    ...account,
    id: `closed-${stage}`,
    code: `CLOSED-${stage}`,
    deletedAt: null,
    stage,
  }));
  const active = {
    ...account,
    id: "active",
    code: "DV-ACTIVE",
    deletedAt: null,
    stage: "IN_PROGRESS",
  };
  const view = finance({ account, accounts: [account, ...closed, active] });
  let content = view.render(view.root);
  const accounts = find(content, (node) => node.type.name === "AccountList");
  const html = renderToStaticMarkup(view.render(accounts.type, accounts.props));
  assert.match(html, /Phiếu đã xóa/);
  assert.match(html, /href="\/dieu-hanh\/tai-chinh\?visitId=archived"/);
  assert.doesNotMatch(html, /phieu-dich-vu\/archived/);
  find(
    content,
    (node) =>
      node.type === "button" && node.props.children === "Thu tiền / cọc",
  ).props.onClick();
  content = view.render(view.root);
  const form = find(content, (node) => node.type.name === "CollectForm");
  view.render(form.type, form.props);
  await view.flush(form.type);
  const formTree = view.render(form.type, form.props);
  const picker = find(formTree, (node) => node.type.name === "SubjectPicker");
  assert.equal(picker.props.value.id, "archived");
  assert.equal(picker.props.value.version, 5);
  assert.equal(view.requests[0], "admin/finance/accounts?visitId=archived");
  let pickerTree = view.render(picker.type, picker.props);
  assert.match(view.pages.at(-1), /^admin\/finance\/accounts\?/);
  assert.doesNotMatch(view.pages.at(-1), /activeOnly/);
  assert.match(renderToStaticMarkup(pickerTree), /Phiếu đã xóa/);
  assert.match(renderToStaticMarkup(pickerTree), /DV-ARCHIVED/);
  assert.match(renderToStaticMarkup(pickerTree), /DV-ACTIVE/);
  for (const visit of closed) {
    assert.doesNotMatch(
      renderToStaticMarkup(pickerTree),
      new RegExp(visit.code),
    );
  }
  find(pickerTree, (node) => node.type === "input").props.onChange({
    target: { value: "DV-ARCHIVED" },
  });
  view.render(picker.type, picker.props);
  assert.match(view.pages.at(-1), /q=DV-ARCHIVED/);
  const collectOnly = finance({ account, permissions: ["payments.collect"] });
  content = collectOnly.render(collectOnly.root);
  const limitedForm = find(content, (node) => node.type.name === "CollectForm");
  collectOnly.render(limitedForm.type, limitedForm.props);
  await collectOnly.flush(limitedForm.type);
  const limitedTree = collectOnly.render(limitedForm.type, limitedForm.props);
  const limitedPicker = find(
    limitedTree,
    (node) => node.type.name === "SubjectPicker",
  );
  collectOnly.render(limitedPicker.type, limitedPicker.props);
  assert.equal(collectOnly.requests[0], "admin/service-visits/archived");
  assert.match(collectOnly.pages.at(-1), /^admin\/service-visits\?/);
  assert.match(collectOnly.pages.at(-1), /activeOnly=true/);
});

function finance(options) {
  const states = new Map();
  let current, index;
  const pages = [],
    requests = [];
  const { LiveFinance } = load("components/manager/live-finance.tsx", {
    react: {
      ...React,
      useState(initial) {
        const state = current.values,
          i = index++;
        if (!(i in state))
          state[i] = typeof initial === "function" ? initial() : initial;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
      useEffect(fn) {
        current.effects.push(fn);
      },
    },
    "next/link": link,
    "next/navigation": {
      useSearchParams: () => new URLSearchParams("visitId=archived"),
    },
    "@/components/admin/auth-gate": {
      useSession: () => ({
        permissions: options.permissions || [
          "finance.read",
          "payments.collect",
        ],
      }),
    },
    "@/lib/api/client": {
      newRequestKey: () => "command",
      request: async (path) => {
        requests.push(path);
        return {
          data: path.startsWith("admin/finance/accounts")
            ? [options.account]
            : options.account,
        };
      },
    },
    "@/lib/api/use-page": {
      useApiPage(path) {
        pages.push(path);
        return {
          data: options.accounts || [options.account],
          loading: false,
          error: "",
        };
      },
    },
    "@/lib/api/stock-finance": {
      paymentLabels: { PAID: "Đã thu đủ" },
      methods: { CASH: "Tiền mặt" },
    },
    "@/lib/api/workflow": { vnd: String, workflowTime: String },
    "@/lib/api/types": { stationTime: String },
    "@/components/admin/primitives": { PageHeading: () => null },
    "./manager-ui": {
      ManagerTable: ({ children, ...props }) => h("table", props, children),
    },
    "./live-stock": { PageButtons: () => null },
  });
  return {
    root: LiveFinance().props.children.type,
    pages,
    requests,
    render(component, props) {
      if (!states.has(component))
        states.set(component, { values: [], effects: [] });
      current = states.get(component);
      current.effects = [];
      index = 0;
      return component(props);
    },
    async flush(component) {
      for (const effect of states.get(component).effects) effect();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

function find(element, predicate) {
  if (!isValidElement(element)) return;
  if (predicate(element)) return element;
  for (const child of Children.toArray(element.props.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
function page(options = {}) {
  let index = 0;
  const state = [];
  const effects = [];
  const calls = [];
  const commands = [],
    confirmations = [],
    events = [];
  let confirmDelete = true,
    rejectDelete = false;
  let reject = false;
  const { ServiceTicketsPage } = load(
    "components/advisor/service-tickets-page.tsx",
    {
      react: {
        ...React,
        useState(initial) {
          const i = index++;
          if (!(i in state)) state[i] = initial;
          return [
            state[i],
            (value) => {
              state[i] = typeof value === "function" ? value(state[i]) : value;
            },
          ];
        },
        useEffect(fn) {
          effects.push(fn);
        },
      },
      "next/link": link,
      "next/navigation": { useSearchParams: () => new URLSearchParams() },
      "@/components/admin/admin-icon": { AdminIcon: () => null },
      "@/components/admin/primitives": {
        AdminLoading: () => h("p", null, "Đang tải"),
        PageHeading: ({ title, children }) =>
          h("header", null, h("h1", null, title), children),
      },
      "@/components/admin/booking-provider": {
        useBookings: () => ({ data: { customers: [], vehicles: [] } }),
      },
      "@/components/admin/auth-gate": {
        useSession: () => ({ permissions: options.permissions || permissions }),
      },
      "@/lib/api/client": {
        apiEnabled: true,
        request: async (path) => {
          calls.push(path);
          if (reject) throw Error("Không thể tải");
          return {
            data: options.visits || [],
            page: { nextCursor: "next-page" },
          };
        },
        command: async (path, body, method) => {
          commands.push({ path, body, method });
          if (rejectDelete) throw Error("Không thể xóa phiếu");
          return { data: { visitId: options.visits?.[0]?.id } };
        },
      },
      "@/lib/api/types": { stationTime: (value) => value },
      "@/lib/advisor/seed": { quoteTotals: () => ({ total: 0 }) },
      "@/lib/advisor/service-tickets": tickets,
      "./advisor-provider": { useAdvisor: () => ({ orders: [], ready: true }) },
      "./service-tickets-table": { ServiceTicketsTable },
    },
    {
      Error,
      Event,
      window: {
        confirm(message) {
          confirmations.push(message);
          return confirmDelete;
        },
        dispatchEvent(event) {
          events.push(event.type);
        },
      },
    },
  );
  return {
    calls,
    commands,
    confirmations,
    events,
    confirm(value) {
      confirmDelete = value;
    },
    failDelete(value) {
      rejectDelete = value;
    },
    tree() {
      index = 0;
      effects.length = 0;
      return ServiceTicketsPage();
    },
    async flush() {
      effects[0]();
      await new Promise((resolve) => setImmediate(resolve));
    },
    fail() {
      reject = true;
    },
  };
}
test("service tickets page uses server filters/pagination, resets cursor, and renders loading/error states", async () => {
  const view = page();
  assert.match(renderToStaticMarkup(view.tree()), /Đang tải/);
  await view.flush();
  let tree = view.tree();
  const pagination = renderToStaticMarkup(tree);
  assert.match(pagination, /aria-label="Phân trang phiếu dịch vụ"/);
  assert.match(pagination, /aria-current="page" aria-live="polite">Trang 1/);
  assert.match(view.calls[0], /limit=20/);
  assert.match(view.calls[0], /activeOnly=true/);
  find(
    tree,
    (node) =>
      node.type === "button" && node.props["aria-label"] === "Trang sau",
  ).props.onClick();
  view.tree();
  await view.flush();
  assert.match(view.calls.at(-1), /cursor=next-page/);
  tree = view.tree();
  assert.match(
    renderToStaticMarkup(tree),
    /aria-current="page" aria-live="polite">Trang 2/,
  );
  find(
    tree,
    (node) => node.type === "button" && node.props.children === "Bàn giao",
  ).props.onClick();
  view.tree();
  await view.flush();
  assert.match(view.calls.at(-1), /ticketStage=HANDOVER/);
  assert.doesNotMatch(view.calls.at(-1), /cursor=|activeOnly=/);
  tree = view.tree();
  find(
    tree,
    (node) =>
      node.type === "input" && node.props["aria-label"] === "Tìm phiếu dịch vụ",
  ).props.onChange({ target: { value: "Toyota Vios" } });
  view.tree();
  await view.flush();
  assert.match(view.calls.at(-1), /q=Toyota\+Vios/);
  view.fail();
  view.tree();
  await view.flush();
  assert.match(renderToStaticMarkup(view.tree()), /role="alert"/);
  assert.match(renderToStaticMarkup(view.tree()), /Tải lại danh sách/);
});
