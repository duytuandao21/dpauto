"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  addDays,
  stationToday,
  validateCustomer,
  type CustomerFields,
  type CustomerErrors,
} from "@/lib/public-booking/mock";
import {
  BookingSummary,
  CustomerStep,
  ServicesStep,
  StepIntro,
} from "./booking-steps";
import { BookingSchedule } from "./booking-schedule";
import "./booking-dialog.css";

const initialCustomer: CustomerFields = {
  name: "",
  phone: "",
  plate: "",
  vehicle: "",
};
const steps = ["Thông tin", "Dịch vụ", "Thời gian"];

export function BookingLauncher() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button
        onClick={(event) => {
          // Safari does not focus a button on pointer activation by default.
          event.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        }}
      >
        Đặt lịch hẹn
      </Button>
      <BookingDialog open={open} onClose={close} />
    </>
  );
}

function BookingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [customer, setCustomer] = useState<CustomerFields>(initialCustomer);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const onReady = useCallback((value: boolean) => setReady(value), []);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !open || !dialog.current) return;
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const currentToday = stationToday();
    setToday(currentToday);
    setDate((value) =>
      !value || value < currentToday ? addDays(currentToday, 1) : value,
    );
    setClosing(false);
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    element.showModal();
    const viewport = window.visualViewport;
    function resize() {
      element.style.setProperty(
        "--pb-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      element.style.setProperty(
        "--pb-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        /INPUT|TEXTAREA|SELECT/.test(active.tagName)
      )
        active.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    const frame = requestAnimationFrame(() =>
      element
        .querySelector<HTMLElement>("[data-step-heading]")
        ?.focus({ preventScroll: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      if (submitTimer.current) clearTimeout(submitTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setSubmitting(false);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      element.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open, mounted]);

  function reset() {
    setStep(1);
    setCustomer(initialCustomer);
    setErrors({});
    setServiceIds([]);
    setServiceError("");
    setTimeError("");
    setTime("");
    setNote("");
    setReady(false);
    setDate(addDays(stationToday(), 1));
    setSuccess(false);
  }
  function requestClose() {
    if (closing) return;
    if (submitTimer.current) clearTimeout(submitTimer.current);
    setSubmitting(false);
    setClosing(true);
    closeTimer.current = setTimeout(
      () => {
        onClose();
        if (success) reset();
      },
      reduced ? 0 : 180,
    );
  }
  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }
  function focusStep() {
    content.current?.scrollTo({ top: 0, behavior: "instant" });
    content.current
      ?.querySelector<HTMLElement>("[data-step-heading]")
      ?.focus({ preventScroll: true });
  }
  function changeCustomer(field: keyof CustomerFields, value: string) {
    const next = { ...customer, [field]: value };
    setCustomer(next);
    if (errors[field])
      setErrors((previous) => ({
        ...previous,
        [field]: validateCustomer(next)[field],
      }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || closing || success) return;
    if (step === 1) {
      const nextErrors = validateCustomer(customer);
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      if (first) {
        dialog.current?.querySelector<HTMLElement>(`#pb-${first}`)?.focus();
        return;
      }
      goTo(2);
    } else if (step === 2) {
      if (!serviceIds.length) {
        setServiceError("Chọn ít nhất một dịch vụ để tiếp tục.");
        dialog.current
          ?.querySelector<HTMLElement>('input[name="services"]')
          ?.focus();
        return;
      }
      goTo(3);
    } else {
      if (!time || !ready) {
        setTimeError("Bạn vui lòng chọn một khung giờ còn chỗ.");
        return;
      }
      // Deliberately no fetch, persistence, admin booking mutation or analytics payload.
      setSubmitting(true);
      submitTimer.current = setTimeout(
        () => {
          setSubmitting(false);
          setSuccess(true);
          requestAnimationFrame(focusStep);
        },
        reduced ? 100 : 650,
      );
    }
  }
  const count = serviceIds.length;
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className={`pb-dialog ${closing ? "is-closing" : ""}`}
      lang="vi"
      aria-labelledby="pb-dialog-title"
      aria-describedby="pb-demo-notice"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]',
          ) ?? [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 && !element.closest("[inert]"),
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <form className="pb-shell" onSubmit={submit} noValidate>
        <header className="pb-header">
          <div className="pb-title-icon">
            <Icon name="clock" />
          </div>
          <div className="pb-title-copy">
            <span className="pb-brand">DPAUTO · TOÀN TRUNG</span>
            <h2 id="pb-dialog-title">Đặt lịch dịch vụ</h2>
          </div>
          <button
            type="button"
            className="pb-icon-button pb-close"
            aria-label="Đóng đặt lịch"
            onClick={requestClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {!success && (
          <nav className="pb-progress" aria-label="Các bước đặt lịch">
            <ol>
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={
                    step === index + 1
                      ? "is-current"
                      : step > index + 1
                        ? "is-complete"
                        : ""
                  }
                  aria-current={step === index + 1 ? "step" : undefined}
                >
                  <button
                    type="button"
                    disabled={index + 1 >= step || submitting}
                    onClick={() => goTo(index + 1)}
                    aria-label={`Bước ${index + 1}: ${label}${step > index + 1 ? ", chỉnh sửa" : ""}`}
                  >
                    <span className="pb-progress-number">
                      {step > index + 1 ? <Icon name="check" /> : index + 1}
                    </span>
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="pb-scroll" ref={content} data-native-scroll>
          <div className="pb-demo-notice" id="pb-demo-notice">
            <span>Bản xem thử</span>
            <p>Chưa tạo lịch hẹn thực tế.</p>
          </div>
          <AnimatePresence
            initial={false}
            mode="wait"
            onExitComplete={focusStep}
          >
            <motion.div
              key={success ? "success" : step}
              className="pb-step"
              initial={{ opacity: 0, x: reduced ? 0 : direction * 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : direction * -10 }}
              transition={{ duration: reduced ? 0 : 0.15, ease: "easeOut" }}
              onAnimationComplete={focusStep}
            >
              {success ? (
                <div className="pb-success">
                  <motion.div
                    className="pb-success-icon"
                    initial={reduced ? false : { scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Icon name="check" />
                  </motion.div>
                  <span className="pb-status-badge">
                    <Icon name="clock" />
                    Chờ xác nhận · Minh họa
                  </span>
                  <h3 tabIndex={-1} data-step-heading>
                    Đã tiếp nhận yêu cầu đặt lịch!
                  </h3>
                  <BookingSummary
                    customer={customer}
                    serviceIds={serviceIds}
                    date={date}
                    time={time}
                    note={note}
                    success
                  />
                </div>
              ) : step === 1 ? (
                <CustomerStep
                  customer={customer}
                  errors={errors}
                  onChange={changeCustomer}
                  onBlur={(field) =>
                    setErrors((previous) => ({
                      ...previous,
                      [field]: validateCustomer(customer)[field],
                    }))
                  }
                />
              ) : step === 2 ? (
                <ServicesStep
                  selected={serviceIds}
                  error={serviceError}
                  onChange={(ids) => {
                    setServiceIds(ids);
                    setServiceError("");
                    setTime("");
                    setReady(false);
                  }}
                />
              ) : (
                <>
                  <StepIntro title="Chọn thời gian phù hợp" />
                  <BookingSchedule
                    today={today}
                    date={date}
                    serviceIds={serviceIds}
                    selectedTime={time}
                    error={timeError}
                    onDate={setDate}
                    onTime={(value) => {
                      setTime(value);
                      setTimeError("");
                    }}
                    onReady={onReady}
                  />
                  <div className="pb-field pb-note">
                    <label htmlFor="pb-note">
                      Ghi chú{" "}
                      <span className="pb-optional">(không bắt buộc)</span>
                    </label>
                    <textarea
                      id="pb-note"
                      name="note"
                      rows={3}
                      maxLength={1000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Mô tả tình trạng xe hoặc yêu cầu thêm…"
                    />
                  </div>
                  <BookingSummary
                    customer={customer}
                    serviceIds={serviceIds}
                    date={date}
                    time={time}
                    note={note}
                    onEdit={goTo}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <footer className="pb-footer">
          {!success && (
            <div className="pb-footer-meta">
              <span>Bước {step}/3</span>
              <span aria-live="polite">
                {step === 1
                  ? "* Thông tin bắt buộc"
                  : step === 2
                    ? count
                      ? `Đã chọn ${count} dịch vụ`
                      : "Có thể chọn nhiều dịch vụ"
                    : time
                      ? `${time} · ${date.split("-").reverse().join("/")}`
                      : "Chọn một khung giờ để tiếp tục"}
              </span>
            </div>
          )}
          <div className="pb-footer-actions">
            {success ? (
              <Button className="pb-next" onClick={requestClose}>
                Hoàn tất
              </Button>
            ) : (
              <>
                {step > 1 && (
                  <Button
                    className="pb-back"
                    variant="secondary"
                    onClick={() => goTo(step - 1)}
                    disabled={submitting}
                  >
                    Quay lại
                  </Button>
                )}
                <Button
                  type="submit"
                  className="pb-next"
                  disabled={
                    submitting || closing || (step === 3 && (!time || !ready))
                  }
                >
                  {submitting ? (
                    <>
                      <span className="pb-spinner" aria-hidden="true" />
                      Đang xác nhận mẫu…
                    </>
                  ) : step === 3 ? (
                    "Xác nhận đặt lịch"
                  ) : (
                    "Tiếp tục"
                  )}
                </Button>
              </>
            )}
          </div>
        </footer>
      </form>
    </dialog>,
    document.body,
  );
}
