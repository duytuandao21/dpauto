import { collection } from "@/lib/api/client";
import type { Visit } from "@/lib/api/visits";
import { workflowTime } from "@/lib/api/workflow";
import { ticketAmount, ticketLabels, ticketStage } from "./service-tickets";
import { monthRange, toCsv } from "@/lib/csv";

/** Monthly partner statement (one row per ticket). */
export function partnerCsv(visits: Visit[]) {
  const head = [
    "Mã phiếu",
    "Ngày nhận",
    "Biển số",
    "Dòng xe",
    "Đối tác",
    "Sale",
    "Cố vấn",
    "Trạng thái",
    "Thành tiền (đ)",
  ];
  const lines = visits.map((v) => [
    v.code,
    workflowTime(v.receivedAt).slice(0, 10),
    v.vehicle.plate || "",
    v.vehicle.model || "",
    v.partner?.partnerName || "",
    v.partner?.saleName || "",
    v.assignedAdvisor?.name || "",
    ticketLabels[ticketStage(v)],
    ticketAmount(v).value || "",
  ]);
  return toCsv([head, ...lines]);
}

export async function downloadPartnerMonth(month: string, saleId = "") {
  const { from, to } = monthRange(month);
  const visits = await collection<Visit>(
    `admin/service-visits?partner=true&from=${from}&to=${to}${saleId ? `&partnerSaleId=${saleId}` : ""}`,
  );
  const url = URL.createObjectURL(
    new Blob([partnerCsv(visits)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `doi-tac-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return visits.length;
}
