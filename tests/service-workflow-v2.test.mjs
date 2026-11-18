import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./helpers/service-workflow-render.cjs";
import ticketFixture from "./helpers/service-ticket-render.cjs";
import React, { createElement, Children, isValidElement } from "react";

test("Quote footer groups cancel, save and close after totals with the original form association", () => {
  const html = renderToStaticMarkup(fixture.panel("QUOTING"));
  const formId = html.match(/<form id="([^"]+)" class="adm-booking-form"/)[1];
  const footer = html.match(
    /<div class="adv-quote-actions"[^>]*>(.*?)<\/div>/s,
  )[1];
  assert.equal((footer.match(/<button /g) || []).length, 3);
  assert.equal((html.match(/>In \/ lưu PDF báo giá</g) || []).length, 1);
  assert.match(
    footer,
    /href="\/co-van\/phieu-dich-vu\/visit\/in-bao-gia" target="_blank">In \/ lưu PDF báo giá</,
  );
  assert.equal((html.match(/>Hủy báo giá</g) || []).length, 1);
  assert.ok(footer.indexOf("Hủy báo giá") < footer.indexOf("Lưu nháp"));
  assert.ok(footer.indexOf("Hủy báo giá") < footer.indexOf("In / lưu PDF"));
  assert.ok(footer.indexOf("In / lưu PDF") < footer.indexOf("Lưu nháp"));
  assert.ok(footer.indexOf("Lưu nháp") < footer.indexOf("Chốt báo giá"));
  assert.equal((footer.match(/form="([^"]+)"/g) || []).length, 2);
  assert.equal((footer.match(/type="submit"/g) || []).length, 2);
  assert.ok(footer.includes(`value="draft" form="${formId}"`));
  assert.ok(footer.includes(`value="close" form="${formId}"`));
  assert.match(
    html,
    /Khách đã đồng ý toàn bộ hạng mục đang soạn và chi phí trên/,
  );
  assert.doesNotMatch(
    html,
    /Xác nhận chốt báo giá|Người xác nhận|Kênh xác nhận|Nội dung xác nhận/,
  );
  assert.ok(
    html.indexOf("Tổng dự kiến") < html.indexOf('class="adv-quote-actions"'),
  );
  const busy = renderToStaticMarkup(
    fixture.panel("QUOTING", { busy: true }),
  ).match(/<div class="adv-quote-actions"[^>]*>(.*?)<\/div>/s)[1];
  assert.equal((busy.match(/disabled=""/g) || []).length, 3);
  const readOnly = renderToStaticMarkup(
    fixture.panel("QUOTING", { permissions: ["quotes.read"] }),
  );
  assert.doesNotMatch(readOnly, /adv-quote-actions/);
  assert.match(readOnly, /In \/ lưu PDF báo giá/);
});

test("Quote closes in one submit with explicit consent, keeps draft saving and resets consent after edits", () => {
  const state = [],
    calls = [];
  let cursor = 0;
  const session = { permissions: ["quotes.write", "quotes.decide"] };
  const { WorkflowQuote } = ticketFixture.load(
    "components/advisor/workflow-quote.tsx",
    {
      ...fixture.imports,
      "./quote-items": fixture.quoteItems,
      "@/components/admin/auth-gate": { useSession: () => session },
      react: {
        ...React,
        useEffect() {},
        useId: () => "quote-form",
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = initial;
          return [
            state[index],
            (value) => {
              state[index] =
                typeof value === "function" ? value(state[index]) : value;
            },
          ];
        },
      },
    },
  );
  const revision = fixture.fixture("QUOTING").data.quotes[0];
  revision.lines[0].quantity = "1.000";
  const props = {
    revision,
    services: [],
    workflowV2: true,
    root: "/co-van",
    visitId: "visit",
    busy: false,
    closed: false,
    customerName: "Nguyễn Văn An",
    media: [],
    onDirty() {},
    run: async (path, body, method) => {
      calls.push({ path, body, method });
      return false;
    },
  };
  const render = () => {
    cursor = 0;
    return WorkflowQuote(props);
  };
  const find = (node, predicate) =>
    Children.toArray(node).flatMap((child) =>
      isValidElement(child)
        ? [
            ...(predicate(child) ? [child] : []),
            ...find(child.props.children, predicate),
          ]
        : [],
    );
  const form = (tree) => find(tree, (e) => e.type === "form")[0];
  const submit = (tree, value) =>
    form(tree).props.onSubmit({
      preventDefault() {},
      nativeEvent: { submitter: { getAttribute: () => value } },
    });
  let tree = render();
  assert.equal(
    find(tree, (e) => e.type === fixture.quoteItems.QuoteItems)[0].props
      .lines[0].quantity,
    "1",
  );
  assert.equal(
    find(tree, (e) => e.type === "button" && e.props.value === "close")[0].props
      .disabled,
    true,
  );
  submit(tree, "close");
  assert.equal(calls.length, 0);
  submit(tree, "draft");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.ok(!("evidence" in calls[0].body));
  find(
    tree,
    (e) => e.type === "input" && e.props.type === "checkbox",
  )[0].props.onChange({ target: { checked: true } });
  tree = render();
  assert.equal(
    find(tree, (e) => e.type === "button" && e.props.value === "close")[0].props
      .disabled,
    false,
  );
  submit(tree, "close");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, "admin/quote-revisions/quote/close");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].body.evidence.customerName, props.customerName);
  assert.equal(calls[1].body.evidence.channel, "OTHER");
  assert.match(calls[1].body.evidence.note, /khách đã đồng ý/);
  assert.equal(calls[1].body.lines.length, 1);
  tree = render();
  assert.equal(
    find(tree, (e) => e.type === "input" && e.props.type === "checkbox")[0]
      .props.checked,
    true,
  );
  find(tree, (e) => e.type === fixture.quoteItems.QuoteItems)[0].props.edit(0, {
    quantity: "1.5",
  });
  tree = render();
  submit(tree, "close");
  assert.equal(calls.length, 2);
  assert.equal(
    find(tree, (e) => e.type === "button" && e.props.value === "close")[0].props
      .disabled,
    true,
  );
  submit(tree, "draft");
  assert.equal(calls.length, 3);
  assert.equal(calls[2].body.lines[0].quantity, "1.5");
  assert.equal(
    fixture.preview.quotePreview(calls[2].body.lines, "0").total,
    "1650000",
  );
  session.permissions = ["quotes.write"];
  tree = render();
  submit(tree, "close");
  assert.equal(calls.length, 3);
  assert.equal(
    find(tree, (e) => e.type === "button" && e.props.value === "close").length,
    0,
  );
});

test("Quantity fields edit both services and parts and readonly rows use Vietnamese decimals", () => {
  const revision = fixture.fixture("QUOTING").data.quotes[0];
  const lines = [
    { ...revision.lines[0], quantity: "2.500" },
    {
      ...revision.lines[0],
      id: "part",
      kind: "PART",
      serviceId: null,
      quantity: "1.000",
    },
  ];
  const edits = [];
  const props = {
    revision,
    lines,
    discount: "0",
    services: [],
    parts: [],
    editable: true,
    edit: (index, patch) => edits.push({ index, patch }),
    remove() {},
    add() {},
  };
  const find = (node) =>
    Children.toArray(node).flatMap((child) =>
      isValidElement(child)
        ? [
            ...(child.type === "input" &&
            child.props["aria-label"]?.startsWith("Số lượng")
              ? [child]
              : []),
            ...find(child.props.children),
          ]
        : [],
    );
  const inputs = find(fixture.quoteItems.QuoteItems(props));
  assert.equal(inputs.length, 2);
  for (const input of inputs) {
    assert.ok(!input.props.readOnly);
    assert.equal(input.props.min, "0.001");
    assert.equal(input.props.max, "9999999.999");
    assert.equal(input.props.step, "0.001");
  }
  inputs[0].props.onChange({ target: { value: "2" } });
  inputs[1].props.onChange({ target: { value: "1.5" } });
  assert.deepEqual(JSON.parse(JSON.stringify(edits)), [
    { index: 0, patch: { quantity: "2" } },
    { index: 1, patch: { quantity: "1.5" } },
  ]);
  const html = renderToStaticMarkup(
    createElement(fixture.quoteItems.QuoteItems, { ...props, editable: false }),
  );
  assert.match(html, /<span>2,5<\/span>/);
  assert.match(html, /<span>1<\/span>/);
  assert.doesNotMatch(html, /<input|2\.500|>1\.000</);
});

test("Quantity formatting removes database padding without rounding valid fractions", () => {
  for (const [raw, expected] of [
    ["1.000", "1"],
    ["1.500", "1,5"],
    ["0.125", "0,125"],
    ["1000.000", "1.000"],
    ["9999999.999", "9.999.999,999"],
  ])
    assert.equal(fixture.workflow.formatQuantity(raw), expected);
  assert.equal(
    fixture.preview.quotePreview(
      [
        {
          quantity: "2",
          unitPrice: "100000",
          discountPercent: "0",
          vatPercent: "8",
        },
      ],
      "0",
    ).total,
    "216000",
  );
  assert.equal(
    fixture.preview.quotePreview(
      [
        {
          quantity: "1.5",
          unitPrice: "100000",
          discountPercent: "0",
          vatPercent: "8",
        },
      ],
      "0",
    ).total,
    "162000",
  );
});

test("Unified quote shows approved and draft items together without revision navigation", () => {
  const html = renderToStaticMarkup(
    fixture.panel("IN_PROGRESS", {
      extra: true,
      tab: "bao-gia&revision=quote",
    }),
  );
  assert.match(html, /I\. Công việc dịch vụ/);
  assert.match(html, /II\. Phụ tùng, vật tư/);
  assert.doesNotMatch(
    html,
    /placeholder="Tên hạng mục"|placeholder="Mã hạng mục"/,
  );
  assert.match(html, /Bộ lọc điều hòa than hoạt tính/);
  assert.match(html, /value="250\.000"/);
  assert.match(html, /Chốt báo giá/);
  assert.match(html, /Lưu nháp/);
  assert.doesNotMatch(html, /Bản [12]|Báo giá lần|Gửi khách xác nhận/);
  assert.match(html, /href="\/co-van\/phieu-dich-vu\/visit\/in-bao-gia"/);
  assert.match(html, /1\.650\.000/);
  assert.doesNotMatch(
    renderToStaticMarkup(
      fixture.panel("IN_PROGRESS", {
        extra: true,
        permissions: ["quotes.read"],
      }),
    ),
    /Chốt báo giá|Lưu nháp|aria-label="Xóa/,
  );
});

test("Quote item selectors use service/part catalogs and keep snapshot fields out of text inputs", () => {
  const revision = fixture.fixture("QUOTING").data.quotes[0];
  const partLine = {
    ...revision.lines[0],
    id: "part-line",
    kind: "PART",
    serviceId: null,
    name: "",
    code: "",
    unit: "",
  };
  const part = {
    id: "part",
    code: "LOC",
    name: "Lọc dầu",
    unit: "Cái",
    active: true,
  };
  const service = {
    id: "service",
    code: "BD",
    name: "Bảo dưỡng",
    active: true,
    bookable: true,
  };
  const edits = [];
  const props = {
    revision,
    lines: [revision.lines[0], partLine],
    discount: "0",
    services: [service],
    parts: [part, { ...part, id: "inactive", code: "OLD", active: false }],
    editable: true,
    edit: (index, patch) => edits.push({ index, patch }),
    remove() {},
    add() {},
  };
  const tree = fixture.quoteItems.QuoteItems(props);
  function find(node, type) {
    return Children.toArray(node).flatMap((child) =>
      isValidElement(child)
        ? [
            ...(child.type === type ? [child] : []),
            ...find(child.props.children, type),
          ]
        : [],
    );
  }
  const selects = find(tree, "select");
  assert.equal(selects.length, 2);
  selects[0].props.onChange({ target: { value: "service" } });
  selects[1].props.onChange({ target: { value: "part" } });
  assert.deepEqual(JSON.parse(JSON.stringify(edits)), [
    {
      index: 0,
      patch: { serviceId: "service", name: "Bảo dưỡng", code: "BD" },
    },
    { index: 1, patch: { name: "Lọc dầu", code: "LOC", unit: "Cái" } },
  ]);
  const html = renderToStaticMarkup(
    createElement(fixture.quoteItems.QuoteItems, props),
  );
  assert.doesNotMatch(
    html,
    /<textarea|adm-badge|Đang soạn|Đã chốt|Mã hạng mục|Tên hạng mục/,
  );
  assert.doesNotMatch(html, /value="inactive"/);
  assert.match(html, /value="part">Lọc dầu/);
});

test("Quote item catalog preserves old part snapshots and inactive selected parts", () => {
  const revision = fixture.fixture("QUOTING").data.quotes[0];
  const line = {
    ...revision.lines[0],
    kind: "PART",
    serviceId: null,
    code: "OLD",
    name: "Phụ tùng đã lưu",
  };
  const props = {
    revision,
    lines: [line],
    discount: "0",
    services: [],
    editable: true,
    edit() {},
    remove() {},
    add() {},
  };
  const old = renderToStaticMarkup(
    createElement(fixture.quoteItems.QuoteItems, props),
  );
  assert.match(old, /value="existing" disabled="" selected="">Phụ tùng đã lưu/);
  const inactive = renderToStaticMarkup(
    createElement(fixture.quoteItems.QuoteItems, {
      ...props,
      parts: [
        { id: "old", code: "OLD", name: line.name, unit: "Cái", active: false },
      ],
    }),
  );
  assert.match(inactive, /value="old" selected="">Phụ tùng đã lưu/);
  const loading = renderToStaticMarkup(
    createElement(fixture.quoteItems.QuoteItems, {
      ...props,
      partsLoading: true,
    }),
  );
  assert.match(loading, /select required="" disabled=""/);
  assert.match(loading, /Đang tải phụ tùng/);
});

test("Unified quote payload retains descriptions and old callers default to empty description", () => {
  const q = fixture.fixture("QUOTING").data.quotes[0];
  assert.equal(
    fixture.workflow.quoteDraftBody(q).lines[0].description,
    q.lines[0].description,
  );
  const line = { ...q.lines[0] };
  delete line.description;
  assert.equal(
    fixture.workflow.quoteDraftBody({ ...q, lines: [line] }).lines[0]
      .description,
    "",
  );
});

test("Unified quote print includes original and extra items, preserves decisions and distinguishes pending cost", () => {
  const html = renderToStaticMarkup(fixture.printQuote(true));
  assert.match(html, /Báo giá · DV-16112026-001/);
  assert.match(html, /Phụ tùng phát sinh/);
  assert.match(html, /Đang soạn, chưa chốt/);
  assert.match(html, /Không duyệt/);
  assert.match(html, /Kiểm tra động cơ/);
  assert.match(html, /2\.200\.000/);
  assert.match(html, /1\.100\.000/);
  assert.doesNotMatch(html, /Bản [12]/);
});
test("V2 cancellation controls follow separate financial adjustment permission", () => {
  const limited = renderToStaticMarkup(
    fixture.panel("IN_PROGRESS", {
      permissions: ["quotes.read", "quotes.write", "visits.abort"],
      tab: "bao-gia",
    }),
  );
  assert.doesNotMatch(limited, /Hủy hạng mục chưa thực hiện|Hủy báo giá/);
  const allowed = renderToStaticMarkup(
    fixture.panel("IN_PROGRESS", {
      permissions: [
        "quotes.read",
        "quotes.write",
        "visits.abort",
        "payments.refund",
      ],
      tab: "bao-gia",
    }),
  );
  assert.match(allowed, /Hủy hạng mục chưa thực hiện/);
  assert.match(allowed, /Lý do và căn cứ/);
});
test("V2 list uses exactly five Vietnamese phases and matching action labels", () => {
  const { tickets, load } = ticketFixture;
  const expected = [
    "QUOTING",
    "WAITING_FOR_WORK",
    "IN_PROGRESS",
    "HANDOVER",
    "COMPLETED",
  ];
  assert.deepEqual(
    Array.from(tickets.ticketTabs.slice(2), (item) => item[0]),
    expected,
  );
  const visits = load("lib/api/visits.ts");
  for (const [stage, label] of [
    ["QUOTING", "Báo giá"],
    ["WAITING_FOR_WORK", "Chờ thi công"],
    ["HANDOVER", "Bàn giao"],
    ["COMPLETED", "Hoàn thành"],
  ]) {
    assert.equal(visits.visitStages[stage], label);
    assert.equal(tickets.ticketLabels[stage], label);
  }
  assert.equal(
    tickets.ticketAction("QUOTING", ["quotes.decide"]).label,
    "Chốt báo giá",
  );
  assert.equal(
    tickets.ticketAction("IN_PROGRESS", ["work.write"]).label,
    "Hoàn tất thi công",
  );
  assert.equal(
    tickets.ticketAction("PAUSED", ["work.write"]).label,
    "Tiếp tục thi công",
  );
  assert.equal(
    tickets.ticketAction("HANDOVER", ["visits.handover"]).label,
    "Hoàn thành phiếu",
  );
  const print = renderToStaticMarkup(
    ticketFixture.load ? fixture.printQuote() : null,
  );
  assert.match(print, /Dịch vụ bổ sung chưa đồng ý/);
  assert.match(print, /Không duyệt/);
  assert.match(print, /1\.650\.000/);
  assert.match(print, /1\.100\.000/);
});
const render = (stage, options) =>
  renderToStaticMarkup(fixture.panel(stage, options));
test("Service workspace keeps recorded quote decisions only in payment history", () => {
  const withHistory = (tab, root = "/co-van") => {
    const element = fixture.panel("IN_PROGRESS", { tab, root });
    const quote = element.props.data.quotes[0];
    quote.decision = {
      decision: "APPROVED",
      customerName: "Khách đồng ý báo giá gốc",
      recordedAt: "2026-11-16T03:00:00Z",
      evidenceNote: "Đã đồng ý chi phí",
    };
    element.props.data.quotes.push({
      ...quote,
      id: "rejected-extra",
      kind: "CHANGE_ORDER",
      status: "REJECTED",
      approvedTotal: "0",
      decision: {
        ...quote.decision,
        decision: "REJECTED",
        customerName: "Khách từ chối phần phát sinh",
      },
    });
    return renderToStaticMarkup(element);
  };
  const cost = withHistory("bao-gia");
  assert.match(cost, /Bảo dưỡng định kỳ/);
  assert.doesNotMatch(
    cost,
    /Quyết định đã ghi nhận|Lịch sử xác nhận và hủy hạng mục/,
  );
  const payment = withHistory("doi-soat");
  assert.match(payment, /Lịch sử xác nhận và hủy hạng mục/);
  assert.match(payment, /Khách đồng ý báo giá gốc/);
  assert.match(payment, /Khách từ chối phần phát sinh/);
  assert.match(payment, /Lịch sử xử lý đầy đủ/);
  assert.equal((payment.match(/Quyết định đã ghi nhận/g) || []).length, 2);
  const manager = withHistory("bao-gia", "/dieu-hanh");
  assert.match(manager, /Quyết định đã ghi nhận/);
  assert.match(manager, /Lịch sử xác nhận và hủy hạng mục/);
  const pending = fixture.panel("IN_PROGRESS", { tab: "doi-soat" });
  pending.props.data.quotes[0].status = "PENDING_APPROVAL";
  assert.doesNotMatch(
    renderToStaticMarkup(pending),
    /Lịch sử xác nhận và hủy hạng mục|Ghi nhận quyết định của khách/,
  );
});

test("Service workspace removes manual work and journals from advisor while retaining manager tools", () => {
  for (const stage of ["WAITING_FOR_WORK", "IN_PROGRESS", "COMPLETED"]) {
    const html = render(stage, { tab: "thi-cong" });
    assert.match(html, /Phạm vi đã duyệt|Hạng mục thực hiện/);
    assert.match(html, /Bảo dưỡng định kỳ/);
    assert.doesNotMatch(
      html,
      /Thêm công việc|Công việc mới|Danh sách công việc|Nhật ký thi công|Lưu nhật ký|Dự kiến xong|Lưu công việc/,
    );
  }
  assert.match(render("WAITING_FOR_WORK"), /Bắt đầu thi công/);
  assert.match(render("IN_PROGRESS"), /Hoàn tất thi công/);
  const manager = render("IN_PROGRESS", { root: "/dieu-hanh" });
  assert.match(manager, /Thêm công việc/);
  assert.match(manager, /Nhật ký thi công/);
});

test("Service workspace prevents completion of unfinished tracked work without inventing completion data", () => {
  for (const status of ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]) {
    const states = [false, "PASSED", "Kiểm tra đạt", true, { "line:0": true }];
    const { ServiceWorkflowPanel } = ticketFixture.load(
      "components/advisor/service-workflow-panel.tsx",
      {
        ...fixture.imports,
        "next/navigation": {
          usePathname: () => "/co-van/phieu-dich-vu/visit",
          useSearchParams: () => new URLSearchParams("tab=thi-cong"),
        },
        react: {
          ...React,
          useState: () => [states.shift(), () => {}],
        },
        "./workflow-quote": {},
        "./workflow-work": {},
        "./visit-settlement": {},
        "./live-workflow": {},
      },
    );
    const element = fixture.panel("IN_PROGRESS");
    element.props.data.work.items = [{ id: "old-work", status }];
    const html = renderToStaticMarkup(
      createElement(ServiceWorkflowPanel, element.props),
    );
    if (["PENDING", "IN_PROGRESS"].includes(status)) {
      assert.match(html, /Quản lý cần cập nhật/);
      assert.match(html, /value="finish" disabled/);
    } else {
      assert.doesNotMatch(html, /Quản lý cần cập nhật/);
      assert.doesNotMatch(html, /value="finish" disabled/);
    }
    assert.equal(element.props.data.work.items[0].status, status);
  }
});

test("Service workspace groups work actions and toggles completion without unmounting its form", () => {
  let completionOpen = false;
  const { ServiceWorkflowPanel } = ticketFixture.load(
    "components/advisor/service-workflow-panel.tsx",
    {
      ...fixture.imports,
      "next/navigation": {
        usePathname: () => "/co-van/phieu-dich-vu/visit",
        useSearchParams: () => new URLSearchParams("tab=thi-cong"),
      },
      react: {
        ...React,
        useState: () => [completionOpen, (value) => (completionOpen = value)],
      },
      "./workflow-quote": {},
      "./workflow-work": {},
      "./visit-settlement": {},
      "./live-workflow": {},
    },
  );
  const props = fixture.panel("IN_PROGRESS").props;
  const find = (node, predicate) =>
    Children.toArray(node).flatMap((child) =>
      isValidElement(child)
        ? [
            ...(predicate(child) ? [child] : []),
            ...find(child.props.children, predicate),
          ]
        : [],
    );
  const render = () => ServiceWorkflowPanel(props);
  const toggle = (tree) =>
    find(tree, (e) => e.props["aria-controls"] === "hoan-tat-thi-cong")[0];
  const form = (tree) =>
    find(
      tree,
      (e) => e.props.className === "adm-panel adv-service-completion",
    )[0];
  let tree = render();
  const actions = find(tree, (e) => e.props.className === "adm-action-row")[0];
  assert.equal(find(actions, (e) => e.type === "button").length, 2);
  assert.ok(find(actions, (e) => e.props.children === "Tạm dừng").length);
  assert.ok(find(actions, (e) => e.props.href?.endsWith("tab=bao-gia")).length);
  assert.equal(toggle(actions).props.children, "Hoàn tất thi công");
  assert.equal(toggle(tree).props["aria-expanded"], false);
  assert.equal(form(tree).props.hidden, true);
  const content = form(tree).props.children.type;
  toggle(tree).props.onClick();
  tree = render();
  assert.equal(toggle(tree).props["aria-expanded"], true);
  assert.equal(form(tree).props.hidden, false);
  assert.equal(form(tree).props.children.type, content);
  toggle(tree).props.onClick();
  tree = render();
  assert.equal(form(tree).props.hidden, true);
  assert.equal(form(tree).props.children.type, content);
  const busy = ServiceWorkflowPanel({ ...props, busy: true });
  assert.equal(toggle(busy).props.disabled, true);
  props.data.isPaused = true;
  tree = render();
  assert.equal(toggle(tree), undefined);
  assert.equal(form(tree), undefined);
});

test("Service workspace has four areas, state defaults and valid primary actions", () => {
  for (const stage of [
    "QUOTING",
    "WAITING_FOR_WORK",
    "IN_PROGRESS",
    "HANDOVER",
    "COMPLETED",
  ]) {
    const html = render(stage);
    assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /Báo giá &amp; Phát sinh/);
    assert.match(html, /Thông tin xe/);
    assert.match(html, /Thanh toán &amp; Lịch sử/);
  }
  assert.match(render("QUOTING"), />Chốt báo giá</);
  assert.match(render("WAITING_FOR_WORK"), />Bắt đầu thi công</);
  assert.match(render("IN_PROGRESS"), />Hoàn tất thi công</);
  assert.match(render("IN_PROGRESS", { paused: true }), /Tiếp tục thi công/);
  assert.doesNotMatch(
    render("IN_PROGRESS", { paused: true }),
    /id="hoan-tat-thi-cong"/,
  );
  assert.match(render("HANDOVER"), /Hoàn thành phiếu/);
  assert.doesNotMatch(render("COMPLETED"), /Hoàn thành phiếu/);
  assert.match(
    render("IN_PROGRESS"),
    /href="[^"]*tab=thi-cong"[^>]*aria-current="page"/,
  );
  assert.doesNotMatch(
    render("IN_PROGRESS", { extra: true }),
    /Chốt báo giá|Lưu nháp|adv-quote-editor/,
  );
  assert.match(
    render("IN_PROGRESS", { tab: "tong-quan" }),
    /Thông tin tiếp nhận đầy đủ/,
  );
  assert.doesNotMatch(
    render("IN_PROGRESS", { tab: "tong-quan" }),
    /Lịch sử xử lý đầy đủ/,
  );
  assert.match(render("COMPLETED"), /Lịch sử xử lý đầy đủ/);
  assert.match(render("ABORTED"), /Phiếu đã dừng/);
  assert.doesNotMatch(render("ABORTED"), /aria-current="step"/);
  assert.match(
    render("IN_PROGRESS", { root: "/dieu-hanh" }),
    /Hạng mục &amp; Chi phí/,
  );
});
test("Service workspace retains quality gates, permissions and disabled operations", () => {
  const html = render("IN_PROGRESS");
  assert.match(html, /id="hoan-tat-thi-cong"/);
  assert.match(html, /Kiểm tra vận hành và an toàn sau bảo dưỡng/);
  assert.match(html, /Lưu kết quả kiểm tra/);
  assert.match(html, /value="finish" disabled/);
  assert.doesNotMatch(
    render("IN_PROGRESS", { permissions: ["visits.read"] }),
    /id="hoan-tat-thi-cong"|Thêm công việc|Lưu nhật ký|>Tạm dừng</,
  );
  assert.match(
    render("WAITING_FOR_WORK", { busy: true }),
    /disabled="">Bắt đầu thi công/,
  );
});
test("V2 read-only rendering offers no state mutation or quote editing", () => {
  const html = render("QUOTING", { permissions: ["visits.read"] });
  assert.doesNotMatch(html, /Chốt báo giá|Lưu báo giá|Gửi khách xác nhận/);
  assert.doesNotMatch(
    render("WAITING_FOR_WORK", { permissions: [] }),
    />Bắt đầu thi công</,
  );
  assert.doesNotMatch(
    render("HANDOVER", { permissions: [] }),
    />Hoàn thành phiếu</,
  );
});
test("Advisor V2 completes with payment confirmation while preserving handover gates and form after API failure", () => {
  const state = [],
    calls = [],
    session = { permissions: ["visits.handover"] };
  let cursor = 0;
  const { Quality } = ticketFixture.load(
    "components/advisor/live-workflow.tsx",
    {
      ...fixture.imports,
      "@/components/admin/auth-gate": { useSession: () => session },
      "./workflow-quote": {},
      "./workflow-work": {},
      "./visit-settlement": {},
      "./service-workflow-panel": {},
      "./order-common": {},
      "@/components/admin/primitives": {},
      react: {
        ...React,
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = initial;
          return [state[index], (value) => (state[index] = value)];
        },
      },
    },
  );
  const data = fixture.fixture("HANDOVER").data;
  data.settlement.outstanding = "810000";
  data.settlement.netReceived = "290000";
  const props = {
    data,
    staff: [],
    root: "/co-van",
    busy: false,
    customerName: "Nguyễn Văn An",
    onDirty() {},
    run: async (path, body) => {
      calls.push({ path, body });
      return false;
    },
  };
  const render = () => {
    cursor = 0;
    return Quality(props);
  };
  const find = (node, predicate) =>
    Children.toArray(node).flatMap((child) =>
      isValidElement(child)
        ? [
            ...(predicate(child) ? [child] : []),
            ...find(child.props.children, predicate),
          ]
        : [],
    );
  const complete = (tree) => find(tree, (e) => e.type === "button")[0];
  let tree = render();
  assert.equal(complete(tree).props.disabled, false);
  assert.match(renderToStaticMarkup(tree), /khách đã thanh toán đủ 100%/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Cần thu đủ và phân bổ tiền/);
  const proof = "Khách đã kiểm tra, nhận xe và thanh toán đủ";
  find(tree, (e) => e.type === "textarea")[0].props.onChange({
    target: { value: proof },
  });
  find(
    tree,
    (e) => e.type === "input" && e.props.type === "checkbox",
  )[0].props.onChange({ target: { checked: true } });
  tree = render();
  find(tree, (e) => e.type === "form")[0].props.onSubmit({
    preventDefault() {},
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "admin/service-visits/visit/handover");
  assert.equal(calls[0].body.paymentReceived, true);
  assert.equal(calls[0].body.paymentBasis, "SETTLED");
  assert.equal(calls[0].body.recipientName, props.customerName);
  assert.equal(calls[0].body.evidenceNote, proof);
  assert.equal(calls[0].body.vehicleMoved, true);
  assert.ok(!("amount" in calls[0].body));
  tree = render();
  assert.equal(find(tree, (e) => e.type === "textarea")[0].props.value, proof);
  assert.equal(
    find(tree, (e) => e.type === "input" && e.props.type === "checkbox")[0]
      .props.checked,
    true,
  );
  data.stock.fulfilled = false;
  assert.equal(complete(render()).props.disabled, true);
  data.stock.fulfilled = true;
  data.obligation.assessed = false;
  assert.equal(complete(render()).props.disabled, true);
  data.obligation.assessed = true;
  props.busy = true;
  assert.equal(
    find(render(), (e) => e.type === "fieldset")[0].props.disabled,
    true,
  );
  props.busy = false;
  props.root = "/dieu-hanh";
  tree = render();
  assert.equal(complete(tree).props.disabled, true);
  assert.match(renderToStaticMarkup(tree), /Cần thu đủ và phân bổ tiền/);
  data.settlement.outstanding = "0";
  tree = render();
  assert.equal(complete(tree).props.disabled, false);
  find(tree, (e) => e.type === "form")[0].props.onSubmit({
    preventDefault() {},
  });
  assert.ok(!("paymentReceived" in calls[1].body));
  props.root = "/co-van";
  data.workflowVersion = 1;
  data.settlement.outstanding = "810000";
  tree = render();
  assert.equal(complete(tree).props.disabled, true);
  assert.equal(complete(tree).props.children, "Hoàn tất bàn giao");
  session.permissions = [];
  assert.equal(find(render(), (e) => e.type === "form").length, 0);
});
test("V2 quote preview rounds VND per line, handles VAT and discounts once, rejects incomplete input", () => {
  const p = fixture.preview.quotePreview;
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        p(
          [
            {
              quantity: "1",
              unitPrice: "100000",
              discountPercent: "0",
              vatPercent: "10",
            },
          ],
          "10",
        ),
      ),
    ),
    {
      subtotal: "100000",
      discountTotal: "10000",
      taxTotal: "9000",
      total: "99000",
    },
  );
  assert.equal(
    p(
      [
        {
          quantity: "0.125",
          unitPrice: "999",
          discountPercent: "12.5",
          vatPercent: "8",
        },
      ],
      "10",
    ).total,
    "106",
  );
  assert.equal(
    p(
      [{ quantity: "1", unitPrice: "", discountPercent: "0", vatPercent: "0" }],
      "0",
    ),
    null,
  );
  assert.equal(
    p(
      [
        {
          quantity: "1",
          unitPrice: "999999999999999",
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
      "0",
    ).total,
    "999999999999999",
  );
  assert.equal(
    fixture.workflow.workflowTime("2026-11-15T18:30:00Z"),
    "16/11/2026 01:30",
  );
});
