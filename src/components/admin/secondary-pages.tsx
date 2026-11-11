"use client";

import Link from "next/link";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import { AdminLoading, PageHeading } from "./primitives";

export function MorePage() {
  const { ask, data } = useBookings();
  return (
    <>
      <PageHeading
        eyebrow="CỐ VẤN DỊCH VỤ"
        title="Tài khoản"
        description="Thông tin và các tùy chọn cá nhân."
      />
      <div className="adm-more-profile adm-panel">
        <span className="adm-avatar adm-avatar-lg">CV</span>
        <div>
          <h2>Cố vấn dịch vụ</h2>
          <p className="adm-muted">Trạm dịch vụ Toàn Trung</p>
        </div>
      </div>
      <div className="adm-more-menu adm-panel">
        <Link href="/co-van/tuy-chon">
          <AdminIcon name="settings" />
          <span>
            <strong>Tùy chọn cá nhân</strong>
            <small>Giao diện sáng và tối</small>
          </span>
          <AdminIcon name="arrow" />
        </Link>
        <button
          onClick={() =>
            ask({
              title: "Thông báo lịch hẹn",
              message: `Có ${data.bookings.filter((booking) => booking.status === "pending").length} lịch đang chờ xác nhận. Bạn có thể xem và xử lý tại mục Lịch hẹn.`,
              label: "Đã hiểu",
              onConfirm: () => {},
            })
          }
        >
          <AdminIcon name="bell" />
          <span>
            <strong>Thông báo</strong>
            <small>Cập nhật lịch hẹn và nhắc tiếp nhận</small>
          </span>
          <AdminIcon name="arrow" />
        </button>
        <Link href="/">
          <AdminIcon name="logout" />
          <span>
            <strong>Xem website công khai</strong>
            <small>Trạm dịch vụ Toàn Trung</small>
          </span>
          <AdminIcon name="arrow" />
        </Link>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { ready, theme, toggleTheme } = useBookings();
  if (!ready) return <AdminLoading />;
  return (
    <>
      <PageHeading
        eyebrow="CỐ VẤN DỊCH VỤ"
        title="Tùy chọn cá nhân"
        description="Điều chỉnh giao diện phù hợp với bạn."
      >
        <Link href="/co-van/tai-khoan" className="adm-btn">
          <AdminIcon name="back" />
          Tài khoản
        </Link>
      </PageHeading>
      <div className="adm-settings-grid">
        <section className="adm-panel">
          <h2>Giao diện</h2>
          <p className="adm-muted">Lựa chọn được lưu trên thiết bị này.</p>
          <label className="adm-toggle-row">
            <span>
              <strong>Chế độ sáng</strong>
              <small>
                {theme === "light"
                  ? "Đang dùng giao diện sáng"
                  : "Đang dùng giao diện tối"}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={theme === "light"}
              onChange={toggleTheme}
            />
          </label>
        </section>
      </div>
    </>
  );
}
