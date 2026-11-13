"use client";
import { useApiPage } from "@/lib/api/use-page";
import { useSession } from "@/components/admin/auth-gate";
import { PageButtons } from "@/components/manager/live-stock";
import { vnd, workflowTime } from "@/lib/api/workflow";
type RecordItem = {
  id: string;
  sourceSystem: string;
  sourceId: string;
  sourceVersion: string;
  ownership: string;
  kind: string;
  data: {
    code: string;
    summary?: string;
    occurredAt?: string;
    asOf?: string;
    status?: string;
    quoteTotal?: string;
    amount?: string;
    kind?: string;
  };
  media: { id: string; name: string }[];
};
export function LegacyHistory({
  id,
  vehicle = false,
  financial = false,
}: {
  id: string;
  vehicle?: boolean;
  financial?: boolean;
}) {
  const session = useSession();
  return financial && !session?.permissions.includes("finance.read") ? null : (
    <Records id={id} vehicle={vehicle} financial={financial} />
  );
}
function Records({
  id,
  vehicle,
  financial,
}: {
  id: string;
  vehicle: boolean;
  financial: boolean;
}) {
  const p = useApiPage<RecordItem>(
    `admin/${vehicle ? "vehicles" : "customers"}/${id}/legacy-records?kind=${financial ? "FINANCE" : "ALL"}`,
    0,
  );
  if (!p.data.length && !p.error) return null;
  return (
    <section className="adm-panel adv-stack">
      <h2>
        {financial
          ? "Số dư và chứng từ trước chuyển đổi"
          : "Lịch sử trước chuyển đổi"}
      </h2>
      {p.error && (
        <p className="adm-error-text" role="alert">
          {p.error}
        </p>
      )}
      {p.data.map((r) => (
        <article key={r.id} className="adm-panel">
          <strong>{r.data.code}</strong>
          <p>
            {r.data.summary ||
              {
                DEBT: "Công nợ",
                DEPOSIT: "Tiền cọc",
                COLLECT: "Thu tiền",
                REFUND: "Hoàn tiền",
              }[r.data.kind || ""] ||
              "Phiếu dịch vụ"}
          </p>
          <p>
            {workflowTime(r.data.occurredAt || r.data.asOf || "")}{" "}
            {r.data.quoteTotal !== undefined &&
              ` · Báo giá: ${vnd(r.data.quoteTotal)}`}
            {r.data.amount !== undefined && ` · ${vnd(r.data.amount)}`}
          </p>
          <p className="adm-muted">
            Nguồn: {r.sourceSystem} · {r.sourceId}
            {r.ownership === "LEGACY" ? " · Tiếp tục xử lý trên CRM cũ" : ""}
          </p>
          {r.media.map((m) => (
            <a
              className="adm-btn"
              key={m.id}
              href={`/api/v1/admin/legacy-media/${m.id}`}
            >
              Tải {m.name}
            </a>
          ))}
        </article>
      ))}
      <PageButtons page={p} />
    </section>
  );
}
