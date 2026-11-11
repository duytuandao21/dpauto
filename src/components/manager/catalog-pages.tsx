"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { staffWorkload } from "@/lib/manager/operations";
import { ManagerStaffSchedule } from "./staff-schedule";
import { PageHeading } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import type { ManagerService, ManagerStaff } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import {
  ManagerPanel,
  ManagerTable,
  ManagerSearch,
  FilterSelect,
  ManagerPager,
  ManagerEmpty,
  ManagerField,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";

export function ManagerServicesPage() {
  const { data, theme, update, ask } = useManager();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagerService | null>(null);
  const [error, setError] = useState("");
  const filtered = data.services.filter(
    (service) =>
      service.name
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")) &&
      (!filter || (filter === "active" ? service.active : !service.active)),
  );
  function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (
      !editing.name.trim() ||
      !Number.isInteger(editing.duration) ||
      editing.duration < 15 ||
      editing.duration > 1440
    ) {
      setError("Nhập tên dịch vụ và thời lượng từ 15 đến 1440 phút.");
      return;
    }
    const value = { ...editing, name: editing.name.trim() };
    update(
      (previous) => ({
        ...previous,
        services: previous.services.some((item) => item.id === value.id)
          ? previous.services.map((item) =>
              item.id === value.id ? value : item,
            )
          : [...previous.services, value],
      }),
      "Đã lưu dịch vụ",
      value.name,
    );
    setEditing(null);
  }
  return (
    <>
      <PageHeading
        title="Danh mục dịch vụ"
        description="Nhóm dịch vụ và thời lượng tham khảo để chuẩn bị lịch hẹn."
      >
        <button
          className="adm-btn adm-primary"
          onClick={() => {
            setEditing({
              id: `MSV-${Date.now()}`,
              name: "",
              group: "Bảo dưỡng",
              duration: 60,
              active: true,
            });
            setError("");
          }}
        >
          <AdminIcon name="plus" />
          Thêm dịch vụ
        </button>
      </PageHeading>
      <ManagerPanel title={`${filtered.length} dịch vụ`}>
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Tìm dịch vụ…"
          />
          <FilterSelect
            label="Trạng thái"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
          </FilterSelect>
        </div>
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Nhóm</th>
                <th>Thời lượng dự kiến</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 6, page * 6).map((service) => (
                <tr key={service.id}>
                  <td>
                    <strong>{service.name}</strong>
                    <small>{service.id}</small>
                  </td>
                  <td>{service.group}</td>
                  <td>{service.duration} phút</td>
                  <td>
                    <span
                      className={`mgr-pill ${service.active ? "mgr-pill-success" : ""}`}
                    >
                      {service.active ? "Đang hoạt động" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td>
                    <div className="mgr-row-actions">
                      <button
                        className="adm-btn"
                        onClick={() => {
                          setEditing({ ...service });
                          setError("");
                        }}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        className="adm-text-link"
                        onClick={() =>
                          ask({
                            title: service.active
                              ? "Tạm ngưng dịch vụ?"
                              : "Mở lại dịch vụ?",
                            message:
                              "Xác nhận thay đổi trạng thái dịch vụ trong danh mục?",
                            danger: service.active,
                            action: () =>
                              update(
                                (previous) => ({
                                  ...previous,
                                  services: previous.services.map((item) =>
                                    item.id === service.id
                                      ? { ...item, active: !item.active }
                                      : item,
                                  ),
                                }),
                                "Đã đổi trạng thái dịch vụ",
                                service.name,
                              ),
                          })
                        }
                      >
                        {service.active ? "Tạm ngưng" : "Mở lại"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
        {!filtered.length && (
          <ManagerEmpty
            onReset={() => {
              setQuery("");
              setFilter("");
            }}
          />
        )}
        <ManagerPager page={page} total={filtered.length} onChange={setPage} />
      </ManagerPanel>
      {editing && (
        <ManagerModal
          title={
            data.services.some((item) => item.id === editing.id)
              ? "Chỉnh sửa dịch vụ"
              : "Thêm dịch vụ"
          }
          theme={theme}
          onClose={() => setEditing(null)}
        >
          <form className="mgr-form" onSubmit={save} noValidate>
            <ManagerField label="Tên dịch vụ *">
              <input
                autoFocus
                maxLength={120}
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField label="Nhóm dịch vụ">
              <select
                value={editing.group}
                onChange={(event) =>
                  setEditing({ ...editing, group: event.target.value })
                }
              >
                {["Bảo dưỡng", "Chăm sóc xe", "Phụ kiện"].map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </select>
            </ManagerField>
            <ManagerField label="Thời lượng dự kiến (phút) *">
              <input
                type="number"
                min="15"
                max="1440"
                value={editing.duration}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    duration: Number(event.target.value),
                  })
                }
              />
            </ManagerField>
            <label className="adm-toggle-row">
              <span>Đang hoạt động</span>
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(event) =>
                  setEditing({ ...editing, active: event.target.checked })
                }
              />
            </label>
            {error && (
              <p className="adm-error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="adm-btn adm-primary">
              Lưu dịch vụ
            </button>
          </form>
        </ManagerModal>
      )}
    </>
  );
}

export function ManagerStaffPage() {
  const { data, theme, update, ask, now } = useManager();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<ManagerStaff | null>(null);
  const [error, setError] = useState("");
  const staff = data.staff.filter(
    (item) =>
      (!role || item.role === role) &&
      `${item.name} ${item.phone} ${item.email}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (
      !editing.name.trim() ||
      !/^0\d{9}$/.test(editing.phone) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)
    ) {
      setError("Nhập họ tên, số điện thoại 10 số và email hợp lệ.");
      return;
    }
    const value = { ...editing, name: editing.name.trim() };
    ask({
      title: "Lưu hồ sơ nhân sự?",
      message: "Xác nhận lưu thông tin hồ sơ nhân sự?",
      action: () => {
        update(
          (previous) => ({
            ...previous,
            staff: previous.staff.some((item) => item.id === value.id)
              ? previous.staff.map((item) =>
                  item.id === value.id ? value : item,
                )
              : [...previous.staff, value],
          }),
          "Đã lưu nhân sự",
          value.name,
        );
        setEditing(null);
      },
    });
  }
  return (
    <>
      <PageHeading
        title="Nhân sự & ca làm"
        description="Theo dõi khối lượng công việc, phân công và khả dụng của nhân viên."
      >
        <button
          className="adm-btn adm-primary"
          onClick={() => {
            setEditing({
              id: `STAFF-${Date.now()}`,
              name: "",
              role: "advisor",
              phone: "",
              email: "",
              active: true,
            });
            setError("");
          }}
        >
          <AdminIcon name="plus" />
          Thêm nhân sự
        </button>
      </PageHeading>
      <ManagerPanel title={`${staff.length} nhân sự`}>
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm tên, số điện thoại, email…"
          />
          <FilterSelect label="Vai trò" value={role} onChange={setRole}>
            <option value="">Tất cả vai trò</option>
            <option value="manager">Quản lý cửa hàng</option>
            <option value="advisor">Cố vấn dịch vụ</option>
            <option value="technician">Kỹ thuật viên</option>
          </FilterSelect>
        </div>
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Vai trò</th>
                <th>Liên hệ</th>
                <th>Khối lượng công việc</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="mgr-person-cell">
                      <span className="adm-avatar">
                        {item.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`mgr-pill ${item.role === "manager" ? "mgr-pill-brand" : "mgr-pill-blue"}`}
                    >
                      {item.role === "manager"
                        ? "Quản lý cửa hàng"
                        : item.role === "technician"
                          ? "Kỹ thuật viên"
                          : "Cố vấn dịch vụ"}
                    </span>
                  </td>
                  <td>
                    <span>{item.phone}</span>
                    <small>{item.email}</small>
                  </td>
                  <td>
                    <div className="mgr-staff-load">
                      <strong>
                        {staffWorkload(data, item.id, now).orders.length} xe ·{" "}
                        {staffWorkload(data, item.id, now).tasks} việc chưa xong
                      </strong>
                      <small>
                        {staffWorkload(data, item.id, now).bookings} lịch đang
                        phụ trách · {staffWorkload(data, item.id, now).overdue}{" "}
                        xe quá hạn
                      </small>
                      <Link
                        className="adm-text-link"
                        href={`/dieu-hanh/dieu-phoi?${item.role === "technician" ? "technician" : "advisor"}=${item.id}`}
                      >
                        Xem phân công ↗
                      </Link>
                      {staffWorkload(data, item.id, now).orders.length > 3 && (
                        <span className="mgr-pill mgr-pill-warning">
                          ⚠ Tải cao
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`mgr-pill ${item.active ? "mgr-pill-success" : ""}`}
                    >
                      {item.active ? "Hoạt động" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="adm-btn"
                      onClick={() => {
                        setEditing({ ...item });
                        setError("");
                      }}
                    >
                      Quản lý
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
        {!staff.length && (
          <ManagerEmpty
            onReset={() => {
              setQuery("");
              setRole("");
            }}
          />
        )}
      </ManagerPanel>
      <ManagerStaffSchedule />
      <div className="mgr-role-cards">
        <ManagerPanel title="Quản lý cửa hàng">
          <p className="adm-muted">
            Theo dõi toàn trạm, phân công, xem báo cáo và cấu hình vận hành.
          </p>
        </ManagerPanel>
        <ManagerPanel title="Cố vấn dịch vụ">
          <p className="adm-muted">
            Xử lý lịch được giao, tiếp nhận xe và cập nhật công việc trong phạm
            vi phụ trách.
          </p>
        </ManagerPanel>
      </div>
      {editing && (
        <ManagerModal
          title="Hồ sơ nhân sự"
          theme={theme}
          onClose={() => setEditing(null)}
        >
          <form className="mgr-form" onSubmit={save} noValidate>
            <ManagerField label="Họ tên *">
              <input
                autoFocus
                maxLength={100}
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField label="Số điện thoại *">
              <input
                type="tel"
                maxLength={10}
                value={editing.phone}
                onChange={(event) =>
                  setEditing({ ...editing, phone: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField label="Email *">
              <input
                type="email"
                maxLength={120}
                value={editing.email}
                onChange={(event) =>
                  setEditing({ ...editing, email: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField label="Vai trò">
              <select
                value={editing.role}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    role: event.target.value as ManagerStaff["role"],
                  })
                }
              >
                <option value="advisor">Cố vấn dịch vụ</option>
                <option value="manager">Quản lý cửa hàng</option>
                <option value="technician">Kỹ thuật viên</option>
              </select>
            </ManagerField>
            <label className="adm-toggle-row">
              <span>Đang hoạt động</span>
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(event) =>
                  setEditing({ ...editing, active: event.target.checked })
                }
              />
            </label>
            {error && (
              <p className="adm-error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="adm-btn adm-primary">
              Lưu hồ sơ
            </button>
          </form>
        </ManagerModal>
      )}
    </>
  );
}
