export const apiEnabled = process.env.NEXT_PUBLIC_API_ENABLED === "true";
export type Envelope<T> = {
  data: T;
  page?: { nextCursor: string | null; hasMore: boolean };
  meta: Record<string, unknown>;
};
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: { path: string; code: string }[] = [],
  ) {
    super(message);
  }
}
// The API often answers with one generic sentence; these codes get a message staff can act on.
const generic = "Không thể thực hiện yêu cầu.";
const codeMessages: Record<string, string> = {
  VERSION_CONFLICT: "Dữ liệu vừa được người khác cập nhật. Vui lòng tải lại.",
  INVALID_TRANSITION:
    "Trạng thái lịch hẹn đã thay đổi nên thao tác này không còn phù hợp. Vui lòng tải lại.",
  ADVISOR_REQUIRED: "Lịch hẹn cần có cố vấn phụ trách trước khi xác nhận.",
  ADVISOR_UNAVAILABLE: "Cố vấn được chọn hiện không hoạt động.",
  OUTSIDE_BOOKING_WINDOW:
    "Thời gian hẹn phải sau hiện tại và nằm trong khoảng ngày trạm nhận lịch.",
  TIME_UNCHANGED: "Thời gian mới trùng với thời gian hiện tại.",
  PERIOD_UNAVAILABLE: "Trạm không nhận lịch buổi này. Vui lòng chọn buổi khác.",
  POLICY_VERSION_CONFLICT:
    "Cấu hình nhận lịch vừa thay đổi. Vui lòng tải lại rồi thử lại.",
  TOO_EARLY: "Chưa hết thời gian chờ để đánh dấu khách không đến.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu, có thể lịch đã được người khác nhận.",
  VALIDATION_FAILED: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
};
let csrf = "";
const pending = new Map<string, { key: string; body: unknown }>();
export function newRequestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<Envelope<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: { ...options.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiFailure(
      0,
      "NETWORK_ERROR",
      "Chưa nhận được phản hồi. Vui lòng thử lại để kiểm tra kết quả.",
    );
  }
  if (response.status === 204) return { data: undefined as T, meta: {} };
  const value = await response.json().catch(() => null);
  if (!response.ok) throw failure(response.status, value);
  if (value?.data?.csrfToken) csrf = value.data.csrfToken;
  return value;
}
// value is the parsed error body, whose shape the server does not guarantee.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function failure(status: number, value: any) {
  if (status === 401) {
    csrf = "";
    window.dispatchEvent(new Event("dpauto-session-expired"));
  }
  const code = value?.error?.code || "SERVICE_UNAVAILABLE",
    message: string | undefined = value?.error?.message;
  return new ApiFailure(
    status,
    code,
    (message === generic && codeMessages[code]) ||
      message ||
      "Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.",
    Array.isArray(value?.error?.fields)
      ? value.error.fields.filter(
          (field: unknown): field is { path: string; code: string } =>
            !!field &&
            typeof field === "object" &&
            "path" in field &&
            typeof field.path === "string" &&
            "code" in field &&
            typeof field.code === "string",
        )
      : [],
  );
}
/** Sends a file as the raw request body; XHR is used because fetch cannot report upload progress. */
export async function uploadFile<T>(
  path: string,
  file: Blob,
  query: Record<string, string>,
  onProgress?: (fraction: number) => void,
) {
  if (!csrf) await request("admin/auth/csrf");
  return new Promise<Envelope<T>>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", `/api/v1/${path}?${new URLSearchParams(query)}`);
    x.setRequestHeader("Content-Type", "application/octet-stream");
    x.setRequestHeader("X-CSRF-Token", csrf);
    x.setRequestHeader("Idempotency-Key", newRequestKey());
    x.upload.onprogress = (e) =>
      e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onerror = () =>
      reject(
        new ApiFailure(
          0,
          "NETWORK_ERROR",
          "Chưa nhận được phản hồi. Vui lòng thử lại để kiểm tra kết quả.",
        ),
      );
    x.onload = () => {
      let value = null;
      try {
        value = JSON.parse(x.responseText);
      } catch {}
      if (x.status >= 200 && x.status < 300) return resolve(value);
      const error = failure(x.status, value);
      if (error.code === "CSRF_INVALID") csrf = "";
      reject(error);
    };
    x.send(file);
  });
}
export async function command<T>(
  path: string,
  body?: unknown,
  method = "POST",
  key?: string,
) {
  if (path.startsWith("admin/") && !csrf) await request("admin/auth/csrf");
  const auth = path.startsWith("admin/auth/");
  const create =
    method === "POST" &&
    (["public/bookings", "admin/bookings", "admin/service-visits"].includes(
      path,
    ) ||
      /^admin\/bookings\/[a-f\d-]+\/receive$/.test(path));
  const identity =
    create && body && typeof body === "object"
      ? Object.fromEntries(
          Object.entries(body).filter(
            ([k]) => !["catalogVersion", "policyVersion"].includes(k),
          ),
        )
      : body;
  const fingerprint = `${method}:${path}:${JSON.stringify(identity ?? {})}`;
  if (!key && !auth) {
    const existing = pending.get(fingerprint);
    if (!existing && pending.size >= 50)
      throw new Error(
        "Còn quá nhiều yêu cầu chưa xác định kết quả. Vui lòng kiểm tra lại lịch hẹn.",
      );
    const attempt = existing || { key: newRequestKey(), body: body ?? {} };
    key = attempt.key;
    body = attempt.body;
    pending.set(fingerprint, attempt);
  }
  key ||= newRequestKey();
  try {
    const result = await request<T>(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        "Idempotency-Key": key,
      },
      body: JSON.stringify(body ?? {}),
    });
    pending.delete(fingerprint);
    return result;
  } catch (error) {
    if (
      error instanceof ApiFailure &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429 &&
      error.code !== "REQUEST_IN_PROGRESS"
    )
      pending.delete(fingerprint);
    if (error instanceof ApiFailure && error.code === "CSRF_INVALID") csrf = "";
    throw error;
  }
}
export async function collection<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | null = null;
  do {
    const url: string =
      path +
      (path.includes("?") ? "&" : "?") +
      "limit=100" +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    const response: Envelope<T[]> = await request<T[]>(url, { signal });
    result.push(...response.data);
    cursor = response.page?.nextCursor || null;
    // shortcut: legacy screens filter their loaded range locally; use server search/paging before exceeding 2,000 records per view.
    if (cursor && result.length >= 2000)
      throw new Error(
        "Danh sách quá lớn. Vui lòng thu hẹp khoảng thời gian hoặc từ khóa.",
      );
  } while (cursor);
  return result;
}
