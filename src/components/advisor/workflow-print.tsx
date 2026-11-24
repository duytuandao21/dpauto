"use client";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import {
  vnd,
  formatQuantity,
  workflowTime,
  quoteLabels,
  type Workflow,
  type QuoteRevision,
} from "@/lib/api/workflow";
import { AdminLoading } from "@/components/admin/primitives";
import { moneyWords } from "@/lib/money-words";
import { partnerLabel, type PartnerSnapshot } from "@/lib/api/partners";
import type { QuoteLine } from "@/lib/api/workflow";

// Layout follows the shop's paper quote (bao-gia-mau.pdf), without the bank-transfer block.
const num = (v: string) => BigInt(v).toLocaleString("vi-VN");
const pct = (v: string) =>
  Number(v).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
const longDate = (iso: string) => {
  const d = workflowTime(iso);
  return `Ngày ${d.slice(0, 2)} tháng ${d.slice(3, 5)} năm ${d.slice(6, 10)}`;
};
function LinesTable({
  title,
  nameLabel,
  totalLabel,
  rows,
}: {
  title: string;
  nameLabel: string;
  totalLabel: string;
  rows: { line: QuoteLine; quote: QuoteRevision }[];
}) {
  if (!rows.length) return null;
  return (
    <section className="adv-print-lines">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{nameLabel}</th>
            <th>Diễn giải</th>
            <th>DVT</th>
            <th>SL</th>
            <th>Đơn giá</th>
            <th>CK %</th>
            <th>CK tiền</th>
            <th>VAT %</th>
            <th>VAT tiền</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line: l, quote }, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td>
              <td>{l.name}</td>
              <td>
                {l.description && (
                  <span className="adv-print-description">{l.description}</span>
                )}
                {quote.status === "DRAFT" && <small>Đang soạn, chưa chốt</small>}
                {["SUBMITTED", "PENDING_APPROVAL"].includes(quote.status) && (
                  <small>Chờ khách đồng ý</small>
                )}
                {quote.voidedLineIds?.includes(l.id) && (
                  <small>Đã hủy phạm vi</small>
                )}
                {quote.decision?.approvedLineIds &&
                  !quote.decision.approvedLineIds.includes(l.id) && (
                    <small>Không duyệt</small>
                  )}
              </td>
              <td>{l.unit}</td>
              <td>{formatQuantity(l.quantity)}</td>
              <td>{num(l.unitPrice)}</td>
              <td>{pct(l.discountPercent)}</td>
              <td>{num(l.discountTotal)}</td>
              <td>{pct(l.vatPercent)}</td>
              <td>{num(l.taxTotal)}</td>
              <td>{num(l.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={10}>{totalLabel}</th>
            <th>
              {num(
                rows
                  .reduce((sum, r) => sum + BigInt(r.line.total), BigInt(0))
                  .toString(),
              )}
            </th>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
type Snapshot = {
  station: { name: string; phone: string; address: string };
  visitCode: string;
  customer: { name: string; phone: string };
  vehicle: { model: string; plate: string };
};
type PrintData =
  | {
      kind: "quote";
      snapshot: Snapshot;
      partner?: PartnerSnapshot | null;
      revision: QuoteRevision;
      combined?: { quotes: QuoteRevision[]; approvedTotal: string | null };
    }
  | {
      kind: "acceptance";
      snapshot: Snapshot;
      partner?: PartnerSnapshot | null;
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
      if (kind === "quote" && !selected && w.workflowVersion === 2) {
        const quotes = w.quotes.filter(
          (q) => !["REJECTED", "VOIDED"].includes(q.status),
        );
        if (!quotes.length) throw new Error("Chưa có hạng mục báo giá để in.");
        const printed = await request<Extract<PrintData, { kind: "quote" }>>(
          `admin/quote-revisions/${quotes[0].id}/print`,
          { signal: a.signal },
        );
        if (!a.signal.aborted)
          setData({
            ...printed.data,
            combined: {
              quotes,
              approvedTotal: w.obligation.assessed ? w.obligation.total : null,
            },
          });
        return;
      }
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
  const quotes =
    data.kind === "quote" ? data.combined?.quotes || [data.revision] : [];
  const amounts =
    data.kind === "quote" && data.combined
      ? {
          ...data.revision,
          ...Object.fromEntries(
            (["subtotal", "discountTotal", "taxTotal", "total"] as const).map(
              (key) => [
                key,
                quotes
                  .reduce((sum, q) => sum + BigInt(q[key]), BigInt(0))
                  .toString(),
              ],
            ),
          ),
          approvedTotal: data.combined.approvedTotal,
        }
      : data.kind === "quote"
        ? data.revision
        : null;
  const docDate =
    data.kind === "quote"
      ? data.revision.submittedAt || data.revision.createdAt
      : data.acceptance.checkedAt;
  const quoteCode =
    data.kind === "quote"
      ? `${data.snapshot.visitCode}-BG${!data.combined && data.revision.revisionNo > 1 ? data.revision.revisionNo : ""}`
      : "";
  const rows = quotes.flatMap((quote) =>
    quote.lines.map((line) => ({ line, quote })),
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
            <strong className="adv-print-company">
              {data.snapshot.station.name}
            </strong>
            {data.snapshot.station.address && (
              <p>Đ/C: {data.snapshot.station.address}</p>
            )}
            {data.snapshot.station.phone && (
              <p>ĐT: {formatPhone(data.snapshot.station.phone)}</p>
            )}
          </div>
          <div className="adv-print-meta">
            <p>
              {kind === "quote" ? "Mã báo giá" : "Mã phiếu DV"}:{" "}
              <strong>
                {kind === "quote" ? quoteCode : data.snapshot.visitCode}
              </strong>
            </p>
            <p>Ngày: {workflowTime(docDate)}</p>
          </div>
        </header>
        <h1>
          {kind === "quote" ? "BÁO GIÁ DỊCH VỤ" : "BIÊN BẢN NGHIỆM THU DỊCH VỤ"}
        </h1>
        <dl className="adv-print-info">
          <div>
            <dt>Mã phiếu DV:</dt>
            <dd>{data.snapshot.visitCode}</dd>
          </div>
          <div>
            <dt>Biển số:</dt>
            <dd>{formatPlate(data.snapshot.vehicle.plate) || "Chưa có"}</dd>
          </div>
          <div>
            <dt>Khách hàng:</dt>
            <dd>{data.snapshot.customer.name}</dd>
          </div>
          <div>
            <dt>SĐT:</dt>
            <dd>{formatPhone(data.snapshot.customer.phone)}</dd>
          </div>
          <div>
            <dt>Loại xe:</dt>
            <dd>{data.snapshot.vehicle.model}</dd>
          </div>
          {data.partner && (
            <div>
              <dt>Đối tác:</dt>
              <dd>{partnerLabel(data.partner)}</dd>
            </div>
          )}
        </dl>
        {data.kind === "quote" ? (
          <>
            {!data.combined && data.revision.kind === "CHANGE_ORDER" && (
              <p>
                Báo giá phát sinh bổ sung · Bản {data.revision.revisionNo} ·{" "}
                {quoteLabels[data.revision.status]}
              </p>
            )}
            <LinesTable
              title="I. Công việc dịch vụ"
              nameLabel="Tên dịch vụ"
              totalLabel="Cộng dịch vụ"
              rows={rows.filter((r) => r.line.kind !== "PART")}
            />
            <LinesTable
              title="II. Phụ tùng vật tư"
              nameLabel="Tên phụ tùng"
              totalLabel="Cộng phụ tùng"
              rows={rows.filter((r) => r.line.kind === "PART")}
            />
            <dl className="adv-print-totals">
              <div>
                <dt>Tổng tiền gốc:</dt>
                <dd>{vnd(amounts!.subtotal)}</dd>
              </div>
              <div>
                <dt>
                  Tổng chiết khấu
                  {!data.combined && Number(data.revision.discountPercent) > 0
                    ? ` (gồm CK tổng ${pct(data.revision.discountPercent)}%)`
                    : ""}
                  :
                </dt>
                <dd>-{vnd(amounts!.discountTotal)}</dd>
              </div>
              <div>
                <dt>Tổng VAT:</dt>
                <dd>{vnd(amounts!.taxTotal)}</dd>
              </div>
              <div className="adv-print-grand">
                <dt>Thành tiền:</dt>
                <dd>{vnd(amounts!.total)}</dd>
              </div>
              {amounts!.approvedTotal != null && (
                <div>
                  <dt>
                    {data.combined
                      ? "Tổng đã chốt sau điều chỉnh:"
                      : data.revision.voidedLineIds?.length
                        ? "Giá trị được duyệt ban đầu:"
                        : "Giá trị được duyệt:"}
                  </dt>
                  <dd>{vnd(amounts!.approvedTotal!)}</dd>
                </div>
              )}
            </dl>
            <p className="adv-print-words">
              <strong>Bằng chữ:</strong> <em>{moneyWords(amounts!.total)}</em>
            </p>
            {quotes.map((quote) => (
              <section key={quote.id}>
                {quote.note && <p>{quote.note}</p>}
                {quote.decision && (
                  <p>
                    Khách xác nhận: {quote.decision.customerName} ·{" "}
                    {workflowTime(quote.decision.recordedAt)} ·{" "}
                    {quote.decision.evidenceNote}
                  </p>
                )}
              </section>
            ))}
          </>
        ) : (
          <>
            <section className="adv-print-lines">
              <h2>I. Hạng mục kiểm tra</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Hạng mục</th>
                    <th>Kết quả</th>
                    <th>Nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {data.acceptance.checks.map((c, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{c.label}</td>
                      <td>{c.passed ? "Đạt" : "Cần làm lại"}</td>
                      <td>{c.note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Số hạng mục đạt</th>
                    <th>
                      {data.acceptance.checks.filter((c) => c.passed).length}/
                      {data.acceptance.checks.length}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </section>
            <dl className="adv-print-totals">
              <div>
                <dt>Người kiểm tra:</dt>
                <dd>{data.acceptance.inspectorName}</dd>
              </div>
              <div>
                <dt>Thời điểm kiểm tra:</dt>
                <dd>{workflowTime(data.acceptance.checkedAt)}</dd>
              </div>
              <div className="adv-print-grand">
                <dt>Kết quả nghiệm thu:</dt>
                <dd>
                  {data.acceptance.result === "PASSED"
                    ? "Đạt yêu cầu"
                    : "Cần làm lại"}
                </dd>
              </div>
            </dl>
            {data.acceptance.note && (
              <p className="adv-print-words">
                <strong>Nhận xét chung:</strong>{" "}
                <em>{data.acceptance.note}</em>
              </p>
            )}
          </>
        )}
        <p className="adv-print-date">{longDate(docDate)}</p>
        <div className="adv-print-signatures">
          <div>
            <strong>Khách hàng</strong>
            <small>(Ký, họ tên)</small>
          </div>
          <div>
            <strong>Tư vấn dịch vụ</strong>
            <small>(Ký, họ tên)</small>
          </div>
          <div>
            <strong>Đại diện cửa hàng</strong>
            <small>(Ký, họ tên, đóng dấu)</small>
          </div>
        </div>
        <p className="adv-print-stamp">
          In lúc: {workflowTime(new Date().toISOString())}
        </p>
      </article>
    </div>
  );
}
