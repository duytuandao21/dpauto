import type { ManagerBooking, ManagerService } from "./mock";
import type {
  ManagerOrder,
  OperationsData,
  OperationStage,
} from "./operations";

export function createOperationsSeed(
  today: string,
  bookings: ManagerBooking[],
  services: ManagerService[],
): OperationsData {
  const stages: OperationStage[] = [
    "reception",
    "quote",
    "work",
    "acceptance",
    "done",
    "work",
    "quote",
    "acceptance",
  ];
  const orders = stages.map((stage, i): ManagerOrder => {
    const booking = bookings[i];
    const line = services.find((s) => s.id === booking.serviceIds[0])!;
    const at = `${today}T${i % 2 ? "08:00" : "07:30"}:00+07:00`;
    const price = [
      500000, 350000, 900000, 4500000, 4200000, 1500000, 1200000, 600000,
    ][i];
    return {
      id: `DV-TT-${String(i + 1).padStart(4, "0")}`,
      bookingId: booking.id,
      customerId: booking.customerId,
      vehicleId: booking.customerId,
      advisorId: booking.advisorId,
      openedAt: at,
      stage,
      stageChangedAt: at,
      request: line.name,
      odo: "45000",
      exterior: "Kiểm tra cùng khách khi tiếp nhận",
      interior: "Không ghi nhận bất thường",
      engine: "Đề nổ bình thường",
      dashboard: "Không báo lỗi",
      tires: "Đã kiểm tra",
      operation: ["Phanh", "Điều hòa"],
      receptionNote: "Liên hệ trước khi phát sinh hạng mục.",
      photos: [],
      priority: i === 5,
      holdReason: i === 5 ? "Chờ vật tư từ nhà cung cấp" : "",
      quoteUpdatedAt: at,
      quoteCreatedBy: booking.advisorId || "MS-2",
      quote: {
        id: `BG-TT-${i + 1}`,
        status:
          stage === "reception"
            ? "draft"
            : stage === "quote"
              ? i === 6
                ? "rejected"
                : "waiting"
              : "confirmed",
        lines: [
          {
            id: `QL-${i}`,
            kind: "service",
            code: line.id,
            name: line.name,
            unit: "Lần",
            quantity: 1,
            price,
            discount: 0,
            vat: 0,
          },
          ...(i === 2
            ? [
                {
                  id: "QL-PART",
                  kind: "part" as const,
                  code: "PT-1",
                  name: "Dầu động cơ 5W-30",
                  unit: "Lít",
                  quantity: 4,
                  price: 200000,
                  discount: 0,
                  vat: 0,
                },
              ]
            : []),
        ],
        discount: 0,
        note: "",
      },
      work: {
        technician: i === 0 || i === 6 ? "" : `MS-${5 + (i % 2)}`,
        startedAt:
          stage === "work" || stage === "acceptance" || stage === "done"
            ? at
            : "",
        dueAt: `${today}T${i === 5 ? "08:00" : "16:30"}:00+07:00`,
        progress:
          stage === "done" || stage === "acceptance"
            ? 100
            : stage === "work"
              ? 50
              : 0,
        checklist: [
          {
            id: "JOB-1",
            label: line.name,
            done: stage === "done" || stage === "acceptance",
          },
        ],
        note: "",
        logs: [],
      },
      acceptance: {
        inspector: stage === "done" ? "Quản lý" : "",
        checkedAt: stage === "done" ? `${today}T10:30:00+07:00` : "",
        result: stage === "done" ? "passed" : "pending",
        note: "",
        checks: [
          {
            id: "CHECK-1",
            label: "Kiểm tra chất lượng hạng mục",
            passed: stage === "done",
          },
          {
            id: "CHECK-2",
            label: "Kiểm tra tình trạng xe khi bàn giao",
            passed: stage === "done",
          },
        ],
      },
      finance: {
        deposit: i % 2 ? 100000 : 0,
        collected: i === 4 ? 2000000 : 0,
      },
      events: [
        {
          id: `RECEIVE-${i}`,
          at,
          label: "Tiếp nhận xe",
          detail: "Ghi nhận yêu cầu dịch vụ",
        },
      ],
      quoteHistory:
        i === 2
          ? [
              {
                id: "QH-1",
                at,
                actor: "Minh Anh",
                before: 900000,
                after: 1700000,
                detail: "Bổ sung 4 lít dầu động cơ; chiết khấu 0%, VAT 0%",
              },
            ]
          : [],
    };
  });
  return {
    orders,
    parts: [
      {
        id: "PT-1",
        name: "Dầu động cơ 5W-30",
        unit: "Lít",
        stock: 12,
        minimum: 20,
        supplier: "Nhà cung cấp dầu nhớt",
      },
      {
        id: "PT-2",
        name: "Lọc dầu động cơ",
        unit: "Cái",
        stock: 18,
        minimum: 5,
        supplier: "Phụ tùng ô tô Việt",
      },
      {
        id: "PT-3",
        name: "Dung dịch vệ sinh nội thất",
        unit: "Chai",
        stock: 3,
        minimum: 5,
        supplier: "Thiết bị chăm sóc xe",
      },
    ],
    movements: [
      {
        id: "NK-001",
        partId: "PT-1",
        kind: "in",
        quantity: 16,
        at: `${today}T07:00:00+07:00`,
        orderId: "",
        warehouse: "Kho chính",
      },
      {
        id: "XK-001",
        partId: "PT-1",
        kind: "out",
        quantity: 4,
        at: `${today}T09:00:00+07:00`,
        orderId: orders[2].id,
        warehouse: "Kho chính",
      },
    ],
    shifts: ["MS-2", "MS-3", "MS-4", "MS-5", "MS-6"].map((staffId, i) => ({
      id: `SHIFT-${i}`,
      staffId,
      date: today,
      start: "07:30",
      end: "17:30",
      state: i === 2 ? "leave" : "present",
      note: i === 2 ? "Nghỉ phép" : "",
    })),
    holidays: [],
  };
}
