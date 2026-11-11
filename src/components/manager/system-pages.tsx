"use client";

import { useState, type FormEvent } from "react";
import { PageHeading } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import type { ManagerSettings } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import {
  ManagerPanel,
  ManagerTable,
  ManagerField,
  ManagerSearch,
  ManagerEmpty,
  ManagerPager,
} from "./manager-ui";

export function ManagerSettingsPage() {
  const { data, update, ask } = useManager();
  const [value, setValue] = useState<ManagerSettings>({ ...data.settings });
  const [error, setError] = useState("");
  function set<K extends keyof ManagerSettings>(
    key: K,
    field: ManagerSettings[K],
  ) {
    setValue((previous) => ({ ...previous, [key]: field }));
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !value.name.trim() ||
      !value.address.trim() ||
      !/^0\d{9}$/.test(value.phone.replaceAll(" ", "")) ||
      !value.open ||
      !value.close ||
      value.open >= value.close ||
      !Number.isInteger(value.leadMinutes) ||
      value.leadMinutes < 0 ||
      value.leadMinutes > 1440 ||
      !Number.isInteger(value.advanceDays) ||
      value.advanceDays < 1 ||
      value.advanceDays > 365
    ) {
      setError(
        "Kiểm tra thông tin trạm, số điện thoại, giờ đóng/mở, thời gian báo trước (0–1440 phút) và số ngày đặt trước (1–365).",
      );
      return;
    }
    ask({
      title: "Lưu cấu hình?",
      message: "Xác nhận lưu thông tin trạm và thiết lập vận hành?",
      label: "Lưu cấu hình",
      action: () =>
        update(
          (previous) => ({ ...previous, settings: { ...value } }),
          "Đã lưu cấu hình",
        ),
    });
  }
  return (
    <>
      <PageHeading
        title="Cấu hình hệ thống"
        description="Thông tin trạm và thiết lập vận hành."
      />
      <form className="mgr-settings-form" onSubmit={submit} noValidate>
        <div className="mgr-settings-grid">
          <ManagerPanel title="Thông tin trạm">
            <div className="mgr-form">
              <ManagerField label="Tên trạm dịch vụ *">
                <input
                  value={value.name}
                  maxLength={120}
                  onChange={(event) => set("name", event.target.value)}
                />
              </ManagerField>
              <ManagerField label="Số điện thoại *">
                <input
                  type="tel"
                  value={value.phone}
                  maxLength={20}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </ManagerField>
              <ManagerField label="Địa chỉ *">
                <textarea
                  rows={2}
                  maxLength={250}
                  value={value.address}
                  onChange={(event) => set("address", event.target.value)}
                />
              </ManagerField>
            </div>
          </ManagerPanel>
          <ManagerPanel title="Giờ hoạt động">
            <div className="mgr-form">
              <div className="mgr-form-columns">
                <ManagerField label="Giờ mở cửa">
                  <input
                    type="time"
                    value={value.open}
                    onChange={(event) => set("open", event.target.value)}
                  />
                </ManagerField>
                <ManagerField label="Giờ đóng cửa">
                  <input
                    type="time"
                    value={value.close}
                    onChange={(event) => set("close", event.target.value)}
                  />
                </ManagerField>
              </div>
            </div>
          </ManagerPanel>
          <ManagerPanel title="Thiết lập đặt lịch">
            <div className="mgr-form">
              <ManagerField label="Thời gian báo trước (phút)">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={value.leadMinutes}
                  onChange={(event) =>
                    set("leadMinutes", Number(event.target.value))
                  }
                />
              </ManagerField>
              <ManagerField label="Khoảng đặt lịch trước (ngày)">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={value.advanceDays}
                  onChange={(event) =>
                    set("advanceDays", Number(event.target.value))
                  }
                />
              </ManagerField>
            </div>
          </ManagerPanel>
          <ManagerPanel title="Tùy chọn thông báo">
            <label className="adm-toggle-row">
              <span>
                <strong>Lịch hẹn mới</strong>
                <small>Thông báo khi có yêu cầu đặt lịch</small>
              </span>
              <input
                type="checkbox"
                checked={value.notifyNew}
                onChange={(event) => set("notifyNew", event.target.checked)}
              />
            </label>
            <label className="adm-toggle-row">
              <span>
                <strong>Nhắc lịch sắp đến</strong>
                <small>Hỗ trợ chuẩn bị tiếp nhận xe</small>
              </span>
              <input
                type="checkbox"
                checked={value.notifyUpcoming}
                onChange={(event) =>
                  set("notifyUpcoming", event.target.checked)
                }
              />
            </label>
          </ManagerPanel>
        </div>
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        <div className="mgr-form-save">
          <button type="submit" className="adm-btn adm-primary">
            <AdminIcon name="check" />
            Lưu cấu hình
          </button>
        </div>
      </form>
    </>
  );
}

export function ManagerNotificationsPage() {
  const { data, notify } = useManager();
  const [read, setRead] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [retried, setRetried] = useState(false);
  const notifications = data.events.map((event) => ({
    id: event.id,
    title: event.action,
    description: event.target,
    time: event.time,
    icon: "bell" as const,
  }));
  const filtered = notifications.filter(
    (item) => filter !== "unread" || !read.includes(item.id),
  );
  return (
    <>
      <PageHeading
        title="Thông báo & Zalo OA"
        description="Theo dõi thông báo và cảnh báo vận hành."
      />
      <div className="mgr-settings-grid">
        <ManagerPanel
          title="Thông báo vận hành"
          action={
            <div className="mgr-tabs">
              <button
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                Tất cả
              </button>
              <button
                aria-pressed={filter === "unread"}
                onClick={() => setFilter("unread")}
              >
                Chưa đọc
              </button>
            </div>
          }
        >
          <div className="mgr-notifications">
            {filtered.map((item) => (
              <div
                className={read.includes(item.id) ? "is-read" : ""}
                key={item.id}
              >
                <span className="adm-feature-icon">
                  <AdminIcon name={item.icon} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{item.time}</small>
                </div>
                <button
                  className="adm-text-link"
                  disabled={read.includes(item.id)}
                  onClick={() => {
                    setRead((previous) => [...previous, item.id]);
                    notify("Đã đánh dấu đã đọc.");
                  }}
                >
                  {read.includes(item.id) ? "Đã đọc" : "Đánh dấu đã đọc"}
                </button>
              </div>
            ))}
          </div>
          {!filtered.length && (
            <ManagerEmpty message="Bạn đã đọc hết thông báo" />
          )}
        </ManagerPanel>
        <ManagerPanel
          title="Zalo Official Account"
          action={<span className="mgr-pill">Chưa kết nối</span>}
        >
          <div className="mgr-integration">
            <span className="mgr-zalo-mark">Zalo</span>
            <h3>Chuẩn bị kết nối Zalo OA</h3>
            <button
              className="adm-btn"
              onClick={() => notify("Zalo OA chưa được kết nối.")}
            >
              Thông tin kết nối
            </button>
          </div>
        </ManagerPanel>
      </div>
      <ManagerPanel title="Hàng đợi gửi thông báo">
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Nội dung</th>
                <th>Kênh dự kiến</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Xác nhận lịch TT-0002</td>
                <td>Zalo OA</td>
                <td>
                  <span className="mgr-pill mgr-pill-warning">
                    Chờ tích hợp
                  </span>
                </td>
                <td>—</td>
              </tr>
              <tr>
                <td>Nhắc lịch TT-0006</td>
                <td>Zalo OA</td>
                <td>
                  <span className="mgr-pill mgr-pill-danger">
                    {retried ? "Chưa kết nối" : "Lỗi"}
                  </span>
                </td>
                <td>
                  <button
                    className="adm-btn"
                    disabled={retried}
                    onClick={() => {
                      setRetried(true);
                      notify(
                        "Zalo OA chưa kết nối. Chưa gửi yêu cầu ra ngoài.",
                      );
                    }}
                  >
                    Thử lại
                  </button>
                </td>
              </tr>
            </tbody>
          </ManagerTable>
        </div>
      </ManagerPanel>
    </>
  );
}

export function ManagerAuditPage() {
  const { data } = useManager();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = data.events.filter((event) =>
    `${event.actor} ${event.action} ${event.target}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeading
        title="Nhật ký hoạt động"
        description="Theo dõi các thao tác và thay đổi trong hệ thống."
      />
      <ManagerPanel title={`${filtered.length} sự kiện`}>
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Tìm nhân sự, thao tác, đối tượng…"
          />
        </div>
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 6, page * 6).map((event) => (
                <tr key={event.id}>
                  <td>{event.time}</td>
                  <td>{event.actor}</td>
                  <td>
                    <strong>{event.action}</strong>
                  </td>
                  <td>{event.target}</td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
        {!filtered.length && <ManagerEmpty onReset={() => setQuery("")} />}
        <ManagerPager page={page} total={filtered.length} onChange={setPage} />
      </ManagerPanel>
    </>
  );
}
