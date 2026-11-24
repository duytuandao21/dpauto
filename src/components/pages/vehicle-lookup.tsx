"use client";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useSite } from "@/components/site/site-content";
import { site as staticSite } from "@/lib/content";
import { HomeSectionHeading } from "@/components/sections/home-motion";
import { typePlate } from "@/lib/advisor/formats";

type Status = {
  code: string;
  model: string | null;
  plate: string | null;
  step: "QUOTING" | "WAITING_FOR_WORK" | "IN_PROGRESS" | "HANDOVER" | "COMPLETED";
  waitingCustomer: boolean;
  receivedAt: string;
  handedOverAt: string | null;
  advisorName: string;
};

const steps: { key: Status["step"]; label: string; note: string }[] = [
  { key: "QUOTING", label: "Tiếp nhận & báo giá", note: "Cố vấn đang kiểm tra xe và lập báo giá." },
  { key: "WAITING_FOR_WORK", label: "Chờ thi công", note: "Báo giá đã duyệt, xe đang chờ đến lượt làm." },
  { key: "IN_PROGRESS", label: "Đang thi công", note: "Kỹ thuật viên đang thực hiện các hạng mục." },
  { key: "HANDOVER", label: "Sẵn sàng bàn giao", note: "Xe đã làm xong và kiểm tra, mời anh/chị đến nhận xe." },
  { key: "COMPLETED", label: "Đã bàn giao", note: "Xe đã được bàn giao. Cảm ơn anh/chị đã tin tưởng DPAuto!" },
];

const time = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));

/** /tra-cuu: plate + phone → the car's current step. No history, prices or staff details. */
export function VehicleLookup() {
  const { settings } = useSite();
  const phone = settings.custom ? settings.phone : staticSite.phone;
  const phoneHref = settings.custom ? settings.phoneHref : staticSite.phoneHref;
  const [plate, setPlate] = useState(""),
    [mobile, setMobile] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState<Status | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // POST body: plate and phone never go into the URL or browser history.
      const r = await fetch("/api/v1/public/vehicle-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plate, phone: mobile }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok)
        throw new Error(
          r.status === 400
            ? "Vui lòng nhập đúng biển số và số điện thoại."
            : body?.error?.message || "Chưa thể tra cứu lúc này, vui lòng thử lại.",
        );
      setStatus(body.data);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Chưa thể tra cứu.");
    } finally {
      setBusy(false);
    }
  }
  const current = status ? steps.findIndex((s) => s.key === status.step) : -1;
  return (
    <section className="section lookup-section">
      <div className="container lookup-container">
        <HomeSectionHeading pageTitle title="Tra cứu tiến độ xe" />
        {!status ? (
          <form className="lookup-card lookup-form" onSubmit={submit} noValidate>
            <label className="lookup-field">
              <span>Biển số xe</span>
              <input
                value={plate}
                onChange={(e) => setPlate(typePlate(e.target.value))}
                placeholder="Ví dụ: 51K-123.45"
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                required
              />
            </label>
            <label className="lookup-field">
              <span>Số điện thoại</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Ví dụ: 0901 234 567"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                required
              />
            </label>
            {error && (
              <p className="lookup-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              icon="search"
              className="lookup-submit"
              disabled={busy || !plate.trim() || !mobile.trim()}
            >
              {busy ? "Đang tra cứu…" : "Tra cứu"}
            </Button>
            <p className="lookup-hint">
              Chỉ hiển thị xe đang làm dịch vụ tại trạm (và trong 24 giờ sau khi bàn giao).
            </p>
          </form>
        ) : (
          <div className="lookup-card lookup-result" aria-live="polite">
            <div className="lookup-car">
              <div>
                <strong>{status.plate || "Chưa có biển số"}</strong>
                <span>
                  {status.model || "Xe của anh/chị"} · {status.code}
                </span>
              </div>
            </div>
            <div className="lookup-now">
              <span>Trạng thái hiện tại</span>
              <strong>{steps[current]?.label}</strong>
              <p>{steps[current]?.note}</p>
              {status.waitingCustomer && (
                <p className="lookup-attention">
                  Báo giá đang chờ anh/chị xác nhận. Vui lòng liên hệ cố vấn để
                  xe được làm sớm nhất.
                </p>
              )}
            </div>
            <ol className="lookup-steps">
              {steps.map((s, i) => (
                <li
                  key={s.key}
                  className={i < current ? "is-done" : i === current ? "is-current" : ""}
                  aria-current={i === current ? "step" : undefined}
                >
                  <i aria-hidden="true">{i < current ? <Icon name="check" /> : i + 1}</i>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>
            <dl className="lookup-facts">
              <div>
                <dt>Tiếp nhận lúc</dt>
                <dd>{time(status.receivedAt)}</dd>
              </div>
              {status.handedOverAt && (
                <div>
                  <dt>Bàn giao lúc</dt>
                  <dd>{time(status.handedOverAt)}</dd>
                </div>
              )}
              <div>
                <dt>Cố vấn phụ trách</dt>
                <dd>{status.advisorName}</dd>
              </div>
            </dl>
            <div className="lookup-actions">
              <Button href={phoneHref} icon="phone">
                Gọi trạm
              </Button>
              <Button
                href={`https://zalo.me/${phone.replace(/\D/g, "")}`}
                variant="secondary"
                icon="zalo"
              >
                Nhắn Zalo
              </Button>
              <button
                type="button"
                className="lookup-again"
                onClick={() => {
                  setStatus(null);
                  setError("");
                }}
              >
                Tra cứu xe khác
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
