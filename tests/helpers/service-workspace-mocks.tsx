import React, { useSyncExternalStore } from "react";

declare global {
  interface Window {
    workspaceTest: any;
  }
}
const state = window.workspaceTest;
export const apiEnabled = true;
export const newRequestKey = () => crypto.randomUUID();
export class ApiFailure extends Error {}
export const useSession = () => state.session;
const subscribe = (fn: () => void) => {
  addEventListener("popstate", fn);
  return () => removeEventListener("popstate", fn);
};
export const useSearchParams = () =>
  new URLSearchParams(useSyncExternalStore(subscribe, () => location.search));
export const usePathname = () => "/co-van/phieu-dich-vu/visit";
export default function Link({
  children,
  scroll,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        if (e.defaultPrevented || props.target === "_blank") return;
        e.preventDefault();
        if (props.href?.includes("?tab=")) {
          history.pushState({}, "", props.href);
          dispatchEvent(new PopStateEvent("popstate"));
        } else state.destination = props.href;
      }}
    >
      {children}
    </a>
  );
}
export async function request(path: string): Promise<any> {
  if (state.loadError) throw Error("Không tải được phiếu, vui lòng thử lại.");
  return {
    data: path.endsWith("/workflow")
      ? state.workflow
      : path.includes("/events")
        ? [
            {
              id: "event",
              type: "VISIT_CREATED",
              occurredAt: state.visit.receivedAt,
              reason: "Tiếp nhận xe tại trạm",
              data: {},
            },
          ]
        : path.startsWith("admin/visit-media/")
          ? { dataUrl: state.photo }
          : state.visit,
    page: { nextCursor: null },
  };
}
export async function collection(path: string): Promise<any[]> {
  return path === "admin/services"
    ? [state.service]
    : path.startsWith("admin/staff")
      ? [state.technician]
      : [];
}
export async function command(path: string, body: any, method: string) {
  state.calls.push({ path, body, method });
  await new Promise((r) => setTimeout(r, 30));
  if (state.fail)
    throw Error("Dữ liệu đã thay đổi. Vui lòng kiểm tra và thử lại.");
  const w = state.workflow;
  if (path.endsWith("/work/start")) {
    w.stage = "IN_PROGRESS";
    w.work.status = "IN_PROGRESS";
  }
  if (path.endsWith("/work/pause")) {
    w.isPaused = true;
    w.pauseReason = body.reason;
    w.work.status = "PAUSED";
  }
  if (path.endsWith("/work/resume")) {
    w.isPaused = false;
    w.work.status = "IN_PROGRESS";
  }
  if (path.endsWith("/work/finish")) {
    w.stage = "HANDOVER";
    w.work.status = "FINISHED";
  }
  if (path.endsWith("/handover")) {
    w.stage = "COMPLETED";
    w.allowedActions = [];
    w.handover = {
      recipientName: body.recipientName,
      evidenceNote: body.evidenceNote,
      handedOverAt: state.visit.receivedAt,
    };
  }
  if (path.endsWith("/intake")) state.visit.intake = body.intake;
  state.visit.stage = w.stage;
  state.visit.version++;
  w.version++;
  return { data: {} };
}
