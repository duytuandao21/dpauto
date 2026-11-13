import { recordTypes } from "../src/legacy-contracts";
import { emptyTotals } from "../src/legacy-file";
export function legacyFixture(phone = "0909999999", source = "CRM_TEST") {
  return {
    format: "DPAUTO_LEGACY_V1",
    stationCode: "TOAN_TRUNG",
    sourceSystem: source,
    scopeMode: "REFERENCE_ONLY",
    exportedAt: "2026-11-12T00:00:00+07:00",
    cutoffAt: "2026-11-11T23:59:59+07:00",
    expected: {
      counts: {
        CUSTOMER: 1,
        VEHICLE: 1,
        LINK: 1,
        HISTORY: 1,
        STOCK: 0,
        FINANCE: 0,
        ACTIVE_ORDER: 0,
        MEDIA: 0,
      },
      totals: {
        ...emptyTotals(),
        quoteTotal: "100000",
        received: "90000",
        outstanding: "10000",
      },
    },
    records: [
      {
        type: "CUSTOMER",
        key: "c-1",
        sourceVersion: "1",
        data: { name: "Khách nguồn", phone },
      },
      {
        type: "VEHICLE",
        key: "v-1",
        sourceVersion: "1",
        data: { model: "Toyota Vios", plate: "51Z-" + phone.slice(-5) },
      },
      {
        type: "LINK",
        key: "l-1",
        sourceVersion: "1",
        data: {
          customerKey: "c-1",
          vehicleKey: "v-1",
          validFrom: "2020-01-01T00:00:00+07:00",
          validTo: null,
        },
      },
      {
        type: "HISTORY",
        key: "h-1",
        sourceVersion: "1",
        data: {
          customerKey: "c-1",
          vehicleKey: "v-1",
          code: "CRM-H001",
          occurredAt: "2026-11-01T09:00:00+07:00",
          status: "CLOSED",
          summary: "Kiểm tra xe trước chuyển đổi",
          quoteTotal: "100000",
          received: "90000",
          refunded: "0",
          outstanding: "10000",
          currency: "VND",
        },
      },
    ] as {
      type: string;
      key: string;
      sourceVersion: string;
      data: Record<string, unknown>;
    }[],
  };
}
