"use client";
import { DateInput } from "@/components/advisor/date-input";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { formatDate, validDate } from "@/lib/booking/logic";
import { command, collection } from "@/lib/api/client";
import { useManager } from "./manager-provider";
import {
  ManagerPanel,
  ManagerTable,
  ManagerEmpty,
  ManagerField,
} from "./manager-ui";
import { ManagerPolicyEditor } from "./policy-editor";

type DayClose = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  version: number;
};
export function ManagerCapacityPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Slots />
    </Suspense>
  );
}
function Slots() {
  const { data, today, now, setRange, refresh, ask, policy } = useManager(),
    params = useSearchParams();
  const requested = params.get("date") || today;
  const [date, setDate] = useState(validDate(requested) ? requested : today),
    [closures, setClosures] = useState<DayClose[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    setRange?.(date);
  }, [date, setRange]);
  useEffect(() => {
    const a = new AbortController();
    collection<DayClose>(
      `admin/capacity/blocks?from=${date}&to=${date}`,
      a.signal,
    )
      .then((v) => {
        if (!a.signal.aborted) {
          setClosures(v);
          setError("");
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [date, data]);
  const slots = data.capacity.filter((s) => s.date === date);
  async function run(path: string, body: unknown, method = "POST") {
    try {
      await command(path, body, method);
      await refresh?.();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật.");
      throw e;
    }
  }
  return (
    <>
      <PageHeading
        title="Khung giờ đặt lịch"
        description="Theo dõi lịch chờ xác nhận, lịch đã nhận và số chỗ còn lại."
      />
      <ManagerPolicyEditor />
      <ManagerPanel
        title={formatDate(date)}
        action={
          <ManagerField label="Ngày">
            <DateInput
              value={date}
              onValueChange={(v) => setDate(v || today)}
            />
          </ManagerField>
        }
      >
        <div className="mgr-section-toolbar">
          <span className="adm-muted">
            Khách đặt theo buổi, không giới hạn · Cảnh báo khi quá{" "}
            {policy?.maxBookingsPerSlot || 5} lịch đã xác nhận mỗi khung{" "}
            {policy?.slotMinutes || 60} phút
          </span>
          <button
            className="adm-btn adm-danger"
            disabled={date < today || closures.length > 0}
            onClick={() =>
              ask({
                title: "Đóng nhận lịch cả ngày?",
                message:
                  "Các lịch đã đặt được giữ nguyên. Khách sẽ không thể đặt thêm trong ngày này.",
                label: "Đóng nhận lịch",
                danger: true,
                action: () =>
                  run("admin/capacity/blocks", {
                    startsAt: date + "T00:00:00+07:00",
                    endsAt: date + "T23:59:59.999+07:00",
                    kind: "MANUAL_CLOSE",
                    reason: "Đóng nhận lịch ngày " + date,
                  }),
              })
            }
          >
            Đóng nhận lịch cả ngày
          </button>
        </div>
        {error && (
          <p role="alert" className="adm-error-text">
            {error}
          </p>
        )}
        {closures.map((c) => (
          <div className="adm-action-row" key={c.id}>
            <span>{c.reason}</span>
            <button
              className="adm-btn"
              onClick={() =>
                ask({
                  title: "Mở lại nhận lịch?",
                  message: "Các khung còn chỗ sẽ nhận lịch trở lại.",
                  label: "Mở lại",
                  action: () =>
                    run(
                      "admin/capacity/blocks/" + c.id,
                      {
                        expectedVersion: c.version,
                        reason: "Mở lại nhận lịch",
                      },
                      "DELETE",
                    ),
                })
              }
            >
              Mở lại nhận lịch
            </button>
          </div>
        ))}
        {slots.length ? (
          <div className="mgr-table-scroll">
            <ManagerTable className="mgr-table">
              <thead>
                <tr>
                  <th>Khung giờ</th>
                  <th>Chờ xác nhận</th>
                  <th>Đã nhận</th>
                  <th>Còn chỗ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => {
                  const past =
                      Date.parse(`${s.date}T${s.time}:00+07:00`) <= now,
                    free = s.free ?? Math.max(0, s.total - s.reserved);
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>
                          {s.time}
                          {s.endTime ? " – " + s.endTime : ""}
                        </strong>
                        <small>
                          {s.confirmed ?? s.reserved}/{s.total} đã xác nhận
                        </small>
                      </td>
                      <td>{s.pending ?? 0}</td>
                      <td>{s.confirmed ?? s.reserved}</td>
                      <td>
                        {s.locked || past || !policy?.bookingEnabled ? 0 : free}
                      </td>
                      <td>
                        <span
                          className={`mgr-pill mgr-pill-${past ? "brand" : s.locked || !policy?.bookingEnabled ? "danger" : free ? "success" : "warning"}`}
                        >
                          {past
                            ? "Đã qua giờ"
                            : s.locked || !policy?.bookingEnabled
                              ? "Đóng nhận lịch"
                              : free
                                ? "Còn chỗ"
                                : "Đạt ngưỡng"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="adm-btn"
                          disabled={past || closures.length > 0}
                          onClick={() =>
                            ask({
                              title: s.locked
                                ? "Mở khung giờ?"
                                : "Đóng khung giờ?",
                              message: "Lịch đã đặt được giữ nguyên.",
                              label: s.locked
                                ? "Mở nhận lịch"
                                : "Đóng nhận lịch",
                              danger: !s.locked,
                              action: () =>
                                run(
                                  "admin/capacity/buckets/" + s.id,
                                  {
                                    startAt: `${s.date}T${s.time}:00+07:00`,
                                    expectedVersion: s.version,
                                    closed: !s.locked,
                                    reason: s.locked
                                      ? "Mở lại khung giờ"
                                      : "Đóng nhận lịch khung giờ",
                                  },
                                  "PATCH",
                                ),
                            })
                          }
                        >
                          {s.locked ? "Mở nhận lịch" : "Đóng nhận lịch"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ManagerTable>
          </div>
        ) : (
          <ManagerEmpty message="Không có khung nhận lịch trong ngày này" />
        )}
      </ManagerPanel>
    </>
  );
}
