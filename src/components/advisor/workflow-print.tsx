"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import {
  vnd,
  workflowTime,
  quoteLabels,
  type Workflow,
  type QuoteRevision,
} from "@/lib/api/workflow";
import { AdminLoading } from "@/components/admin/primitives";
type Snapshot = {
  station: { name: string; phone: string; address: string };
  visitCode: string;
  customer: { name: string; phone: string };
  vehicle: { model: string; plate: string };
};
type PrintData =
  | { kind: "quote"; snapshot: Snapshot; revision: QuoteRevision }
  | {
      kind: "acceptance";
      snapshot: Snapshot;
      acceptance: {
        id: string;
        result: string;
        inspectorName: string;
        checkedAt: string;
        note: string;
        checks: { label: string; passed: boolean; note: string }[];
      };
    };
export function WorkflowPrint(props: {
  id: string;
  kind: "quote" | "acceptance";
  root?: string;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <PrintContent {...props} />
    </Suspense>
  );
}
function PrintContent({
  id,
  kind,
  root = "/co-van",
}: {
  id: string;
  kind: "quote" | "acceptance";
  root?: string;
}) {
  const params = useSearchParams(),
    selected = params.get(kind === "quote" ? "revision" : "acceptance");
  const [data, setData] = useState<PrintData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const a = new AbortController();
    setData(null);
    setLoading(true);
    const load = async () => {
      const w = (
        await request<Workflow>(`admin/service-visits/${id}/workflow`, {
          signal: a.signal,
        })
      ).data;
      const candidate =
        kind === "quote"
          ? selected
            ? w.quotes.find((q) => q.id === selected)
            : w.quotes.filter((q) => q.status !== "DRAFT").at(-1)
          : selected
            ? w.acceptances.find((x) => x.id === selected)
            : w.acceptances[0];
      if (!candidate) throw new Error("Không tìm thấy bản cần in.");
      const value = await request<PrintData>(
        kind === "quote"
          ? `admin/quote-revisions/${candidate.id}/print`
          : `admin/acceptances/${candidate.id}/print`,
        { signal: a.signal },
      );
      if (!a.signal.aborted) setData(value.data);
    };
    load()
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [id, kind, selected]);
  if (loading) return <AdminLoading />;
  if (!data)
    return (
      <section className="adm-panel">
        <p role="alert">{error}</p>
        <Link className="adm-btn" href={`${root}/phieu-dich-vu/${id}`}>
          Về phiếu dịch vụ
        </Link>
      </section>
    );
  return (
    <div className="adv-print-wrap">
      <div className="adv-print-actions">
        <Link
          className="adm-btn"
          href={`${root}/phieu-dich-vu/${id}?tab=${kind === "quote" ? "bao-gia" : "nghiem-thu"}`}
        >
          Quay lại phiếu
        </Link>
        <button className="adm-btn adm-primary" onClick={() => window.print()}>
          In / lưu PDF
        </button>
      </div>
      <article className="adv-print-document">
        <header>
          <div>
            <strong>{data.snapshot.station.name}</strong>
            <p>{data.snapshot.station.address}</p>
            <p>{data.snapshot.station.phone}</p>
          </div>
          <span>{data.snapshot.visitCode}</span>
        </header>
        <h1>
          {kind === "quote" ? "BÁO GIÁ DỊCH VỤ" : "BIÊN BẢN NGHIỆM THU DỊCH VỤ"}
        </h1>
        <dl className="adv-print-info">
          <div>
            <dt>Khách hàng</dt>
            <dd>{data.snapshot.customer.name}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>{data.snapshot.customer.phone}</dd>
          </div>
          <div>
            <dt>Xe</dt>
            <dd>{data.snapshot.vehicle.model}</dd>
          </div>
          <div>
            <dt>Biển số</dt>
            <dd>{data.snapshot.vehicle.plate || "Chưa có"}</dd>
          </div>
        </dl>
        {data.kind === "quote" ? (
          <>
            <p>
              Bản {data.revision.revisionNo} ·{" "}
              {quoteLabels[data.revision.status]} ·{" "}
              {data.revision.submittedAt
                ? workflowTime(data.revision.submittedAt)
                : ""}
            </p>
            {data.revision.kind === "CHANGE_ORDER" && (
              <p>Báo giá phát sinh bổ sung</p>
            )}
            <table>
              <thead>
                <tr>
                  <th>Hạng mục</th>
                  <th>Đơn vị</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>CK / thuế (%)</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {data.revision.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.unit}</td>
                    <td>{l.quantity.replace(/\.0+$/, "")}</td>
                    <td>{vnd(l.unitPrice)}</td>
                    <td>
                      {l.discountPercent} / {l.vatPercent}
                    </td>
                    <td>{vnd(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="adv-print-totals">
              <div>
                <span>Cộng tiền</span>
                <strong>{vnd(data.revision.subtotal)}</strong>
              </div>
              <div>
                <span>Chiết khấu</span>
                <strong>{vnd(data.revision.discountTotal)}</strong>
              </div>
              <div>
                <span>Thuế</span>
                <strong>{vnd(data.revision.taxTotal)}</strong>
              </div>
              <div>
                <span>Tổng cộng</span>
                <strong>{vnd(data.revision.total)}</strong>
              </div>
            </div>
            <p>{data.revision.note}</p>
          </>
        ) : (
          <>
            <p>
              Kiểm tra lúc {workflowTime(data.acceptance.checkedAt)} ·{" "}
              {data.acceptance.inspectorName}
            </p>
            <p>
              Kết quả:{" "}
              {data.acceptance.result === "PASSED"
                ? "Đạt yêu cầu"
                : "Cần làm lại"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Hạng mục</th>
                  <th>Kết quả</th>
                  <th>Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {data.acceptance.checks.map((c, i) => (
                  <tr key={i}>
                    <td>{c.label}</td>
                    <td>{c.passed ? "Đạt" : "Cần làm lại"}</td>
                    <td>{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{data.acceptance.note}</p>
          </>
        )}
        <div className="adv-print-signatures">
          <div>Đại diện trạm dịch vụ</div>
          <div>Khách hàng</div>
        </div>
      </article>
    </div>
  );
}
