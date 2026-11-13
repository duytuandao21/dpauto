"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { cashKinds, methods, type CashPayment } from "@/lib/api/stock-finance";
import { vnd, workflowTime } from "@/lib/api/workflow";
import { AdminLoading } from "@/components/admin/primitives";
export function CashReceipt({ id }: { id: string }) {
  const [data, setData] = useState<CashPayment | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    request<CashPayment>("admin/finance/payments/" + id, { signal: a.signal })
      .then((r) => setData(r.data))
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [id]);
  if (error)
    return (
      <section className="adm-panel">
        <p role="alert">{error}</p>
        <Link className="adm-btn" href="/dieu-hanh/tai-chinh">
          Về tài chính
        </Link>
      </section>
    );
  if (!data) return <AdminLoading />;
  const outgoing = ["REFUND", "REVERSAL"].includes(data.kind);
  return (
    <div className="adv-print-wrap">
      <div className="adv-print-actions">
        <Link className="adm-btn" href="/dieu-hanh/tai-chinh">
          Về sổ thu/chi
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
        </header>
        <h1>{outgoing ? "PHIẾU CHI" : "PHIẾU THU"}</h1>
        <p>
          {data.id} · {workflowTime(data.occurredAt)}
        </p>
        <dl className="adv-print-info">
          <div>
            <dt>Người {outgoing ? "nhận" : "nộp"} tiền</dt>
            <dd>{data.payerName}</dd>
          </div>
          <div>
            <dt>Khách hàng</dt>
            <dd>{data.snapshot.customer.name}</dd>
          </div>
          <div>
            <dt>Nội dung</dt>
            <dd>
              {cashKinds[data.kind as keyof typeof cashKinds]} · {data.reason}
            </dd>
          </div>
          <div>
            <dt>Phương thức</dt>
            <dd>{methods[data.method as keyof typeof methods]}</dd>
          </div>
          <div>
            <dt>Mã giao dịch / căn cứ</dt>
            <dd>{data.reference}</dd>
          </div>
          <div>
            <dt>Số tiền (VND)</dt>
            <dd>
              <strong>{vnd(data.amount)}</strong>
            </dd>
          </div>
          {data.snapshot.visitCode && (
            <div>
              <dt>Phiếu dịch vụ</dt>
              <dd>{data.snapshot.visitCode}</dd>
            </div>
          )}
          {data.originalId && (
            <div>
              <dt>Chứng từ thu gốc</dt>
              <dd>{data.originalId}</dd>
            </div>
          )}
        </dl>
        <div className="adv-print-signatures">
          <div>Người lập phiếu</div>
          <div>Người {outgoing ? "nhận" : "nộp"} tiền</div>
        </div>
      </article>
    </div>
  );
}
