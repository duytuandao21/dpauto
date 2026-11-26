import { command } from "./client";

/**
 * Shared soft delete used by /co-van and /dieu-hanh: asks first, then hides the record.
 * Returns false when the user cancels; API errors are thrown for the caller to show.
 */
export async function confirmDelete(
  path: string,
  expectedVersion: number,
  message: string,
) {
  if (!window.confirm(message)) return false;
  await command(path, { expectedVersion }, "DELETE");
  window.dispatchEvent(new Event("dpauto-data-updated"));
  return true;
}

export const visitDeleteMessage = (v: {
  code: string;
  bookingId?: string | null;
}) =>
  `Xóa phiếu ${v.code}? Phiếu sẽ được ẩn khỏi danh sách, lịch sử và dữ liệu tài chính vẫn được giữ.${v.bookingId ? " Lịch hẹn đang tiếp nhận sẽ bị hủy." : ""}`;
