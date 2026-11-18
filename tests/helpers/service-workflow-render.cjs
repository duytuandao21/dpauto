const { load, link } = require("./service-ticket-render.cjs");
const React = require("react");
const workflow = load("lib/api/workflow.ts", {
  "./types": load("lib/api/types.ts"),
});
const preview = load("lib/advisor/quote-preview.ts");
let tab = "",
  permissions = [
    "quotes.read",
    "quotes.write",
    "quotes.decide",
    "work.write",
    "acceptance.record",
    "visits.handover",
  ];
const session = {
  staff: { id: "advisor", name: "Trần Minh Khang", jobRole: "ADVISOR" },
  roles: ["ADVISOR"],
  get permissions() {
    return permissions;
  },
};
const imports = {
  "next/link": link,
  "next/navigation": {
    usePathname: () => "/co-van/phieu-dich-vu/visit",
    useSearchParams: () => new URLSearchParams(tab ? "tab=" + tab : ""),
  },
  "@/components/admin/auth-gate": { useSession: () => session },
  "@/lib/api/workflow": workflow,
  "@/lib/api/types": load("lib/api/types.ts"),
  "@/lib/api/visits": load("lib/api/visits.ts"),
  "@/lib/advisor/quote-preview": preview,
  "@/lib/api/client": { collection: async () => [] },
  "@/lib/api/stock-finance": {
    paymentLabels: { SETTLED: "Đã thu đủ", UNPAID: "Chưa thu" },
  },
};
const quoteItems = load("components/advisor/quote-items.tsx", imports);
const quote = load("components/advisor/workflow-quote.tsx", {
  ...imports,
  "./quote-items": quoteItems,
});
const work = load("components/advisor/workflow-work.tsx", imports);
const settlement = load("components/advisor/visit-settlement.tsx", imports);
const legacy = load("components/advisor/live-workflow.tsx", {
  ...imports,
  "./workflow-quote": quote,
  "./workflow-work": work,
  "./visit-settlement": settlement,
  "./service-workflow-panel": {},
  "./order-common": {},
  "@/components/admin/primitives": {},
});
const { ServiceWorkflowPanel } = load(
  "components/advisor/service-workflow-panel.tsx",
  {
    ...imports,
    "./workflow-quote": quote,
    "./workflow-work": work,
    "./visit-settlement": settlement,
    "./live-workflow": legacy,
  },
);
const visit = {
  id: "visit",
  code: "DV-16112026-001",
  stage: "QUOTING",
  workflowVersion: 2,
  receivedAt: "2026-11-16T01:00:00Z",
  customer: { name: "Nguyễn Thị Ngọc Phương Anh", phone: "0772584279" },
  vehicle: { model: "Mercedes-Benz GLC 300 4MATIC", plate: "51K-123.45" },
  assignedAdvisor: { id: "advisor", name: "Trần Minh Khang" },
  media: [],
  services: [],
};
function fixture(stage = "QUOTING", paused = false) {
  const line = {
    id: "line",
    kind: "SERVICE",
    serviceId: "service",
    name: "Bảo dưỡng định kỳ và kiểm tra vận hành",
    description:
      "Kiểm tra động cơ, hệ thống phanh và các hạng mục khách yêu cầu",
    code: "BD",
    unit: "Lần",
    quantity: "1",
    unitPrice: "1000000",
    discountPercent: "0",
    vatPercent: "10",
    subtotal: "1000000",
    discountTotal: "0",
    taxTotal: "100000",
    total: "1100000",
  };
  const closed = ["COMPLETED", "ABORTED"].includes(stage);
  const data = {
    visitId: "visit",
    version: 1,
    workflowVersion: 2,
    stage,
    isPaused: paused,
    pauseReason: paused ? "Chờ phụ tùng theo yêu cầu khách" : null,
    pausedAt: paused ? "2026-11-16T03:00:00Z" : null,
    quotes: [
      {
        id: "quote",
        revisionNo: 1,
        kind: "INITIAL",
        status: stage === "QUOTING" ? "DRAFT" : "APPROVED",
        calculationPolicy: "VND_LINE_HALF_UP_V1",
        discountPercent: "0",
        note: "",
        lines: [line],
        subtotal: "1000000",
        discountTotal: "0",
        taxTotal: "100000",
        total: "1100000",
        approvedTotal: stage === "QUOTING" ? null : "1100000",
        decision: null,
      },
    ],
    quoteTotals: {
      proposed: "1100000",
      original: "1100000",
      pending: "0",
      extras: "0",
    },
    approvedLines: stage === "QUOTING" ? [] : [line],
    requiredChecks: [
      { key: "line:0", label: "Kiểm tra vận hành và an toàn sau bảo dưỡng" },
    ],
    obligation: { assessed: stage !== "QUOTING", total: "1100000" },
    settlement: {
      assessed: true,
      total: "1100000",
      netReceived: "1100000",
      outstanding: "0",
      credit: "0",
      paymentStatus: "SETTLED",
    },
    stock: { fulfilled: true, lines: [] },
    financialCredits: [],
    exemptions: [],
    acceptances: [],
    occupancies: [],
    handover:
      stage === "COMPLETED"
        ? {
            recipientName: visit.customer.name,
            handedOverAt: "2026-11-16T03:00:00Z",
            evidenceNote: "Đã giao xe và chìa khóa",
          }
        : null,
    allowedActions: closed ? [] : ["quote", "work", "acceptance"],
    work: {
      id: "work",
      status:
        stage === "WAITING_FOR_WORK"
          ? "NOT_STARTED"
          : paused
            ? "PAUSED"
            : ["HANDOVER", "COMPLETED"].includes(stage)
              ? "FINISHED"
              : "IN_PROGRESS",
      scopeVersion: 1,
      items: [],
      logs: [],
    },
  };
  return { ...visit, stage, data };
}
function panel(stage, options = {}) {
  const f = fixture(stage, options.paused);
  if (options.extra) {
    const original = f.data.quotes[0];
    f.data.quotes.push({
      ...original,
      id: "extra",
      revisionNo: 2,
      kind: "CHANGE_ORDER",
      status: "DRAFT",
      approvedTotal: null,
      lines: [
        {
          ...original.lines[0],
          id: "part",
          kind: "PART",
          serviceId: null,
          name: "Bộ lọc điều hòa than hoạt tính theo yêu cầu khách hàng",
          description: "Thay sau khi kiểm tra và thống nhất với khách",
          code: "LOC-DH",
          unit: "Cái",
          quantity: "2",
          unitPrice: "250000",
          subtotal: "500000",
          taxTotal: "50000",
          total: "550000",
        },
      ],
      subtotal: "500000",
      taxTotal: "50000",
      total: "550000",
    });
  }
  tab = options.tab || "";
  permissions = options.permissions || [
    "quotes.read",
    "quotes.write",
    "quotes.decide",
    "work.write",
    "acceptance.record",
    "visits.handover",
  ];
  return React.createElement(ServiceWorkflowPanel, {
    visit: f,
    root: options.root || "/co-van",
    data: f.data,
    services: [
      {
        id: "service",
        name: "Bảo dưỡng định kỳ",
        active: true,
        bookable: true,
      },
    ],
    staff: [],
    run: async () => true,
    busy: options.busy || false,
    vehicleContent: React.createElement(
      "section",
      null,
      "Thông tin tiếp nhận đầy đủ",
    ),
    historyContent: React.createElement(
      "section",
      null,
      "Lịch sử xử lý đầy đủ",
    ),
    onDirty() {},
    error: "",
    onReload() {},
  });
}
function printQuote(combined = false) {
  const f = fixture("HANDOVER"),
    revision = {
      ...f.data.quotes[0],
      subtotal: "1500000",
      taxTotal: "150000",
      total: "1650000",
      lines: [
        f.data.quotes[0].lines[0],
        {
          ...f.data.quotes[0].lines[0],
          id: "declined",
          name: "D\u1ecbch v\u1ee5 b\u1ed5 sung ch\u01b0a \u0111\u1ed3ng \u00fd",
          unitPrice: "500000",
          subtotal: "500000",
          taxTotal: "50000",
          total: "550000",
        },
      ],
      approvedTotal: "1100000",
      decision: {
        customerName: f.customer.name,
        recordedAt: "2026-11-16T03:00:00Z",
        evidenceNote: "Khách chỉ duyệt một phần",
        approvedLineIds: ["line"],
      },
    };
  const snapshot = {
    station: {
      name: "Trạm dịch vụ Toàn Trung",
      phone: "0772 584 279",
      address: "TP. Hồ Chí Minh",
    },
    visitCode: f.code,
    customer: f.customer,
    vehicle: f.vehicle,
  };
  let hook = 0;
  const states = [
    {
      kind: "quote",
      snapshot,
      revision,
      ...(combined
        ? {
            combined: {
              quotes: [
                revision,
                {
                  ...revision,
                  id: "extra",
                  revisionNo: 2,
                  kind: "CHANGE_ORDER",
                  status: "DRAFT",
                  decision: null,
                  approvedTotal: null,
                  lines: [
                    {
                      ...revision.lines[1],
                      id: "extra-line",
                      name: "Phụ tùng phát sinh",
                      kind: "PART",
                      description: "Phụ tùng đang chờ khách đồng ý",
                    },
                  ],
                  subtotal: "500000",
                  taxTotal: "50000",
                  total: "550000",
                },
              ],
              approvedTotal: "1100000",
            },
          }
        : {}),
    },
    "",
    false,
  ];
  const print = load("components/advisor/workflow-print.tsx", {
    ...imports,
    react: {
      ...React,
      useState: () => [states[hook++], () => {}],
      useEffect() {},
    },
    "@/lib/api/client": {},
    "@/components/admin/primitives": { AdminLoading: () => null },
  });
  return React.createElement(print.WorkflowPrint, {
    id: "visit",
    kind: "quote",
  });
}
module.exports = {
  panel,
  fixture,
  preview,
  workflow,
  printQuote,
  quoteItems,
  imports,
};
