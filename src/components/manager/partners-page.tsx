"use client";
import { useState, type FormEvent } from "react";
import { command } from "@/lib/api/client";
import { formatPhone } from "@/lib/advisor/formats";
import { usePartners, type Partner, type PartnerSale } from "@/lib/api/partners";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import { useManager } from "./manager-provider";
import {
  ManagerDeleteButton,
  ManagerEmpty,
  ManagerField,
  ManagerPanel,
  ManagerTable,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";

// Same layout as "Danh mục dịch vụ": table per partner, edits in a modal.
type Editing =
  | { kind: "partner"; partner: Partner; name: string; phone: string; active: boolean }
  | {
      kind: "sale";
      partner: Partner;
      sale?: PartnerSale;
      name: string;
      phone: string;
      active: boolean;
    };

export function ManagerPartnersPage() {
  const { theme, ask } = useManager();
  const [reload, setReload] = useState(0);
  const { partners: all, loading, error } = usePartners(reload);
  // Deleted partners/sales stay in the API payload for old tickets; hide them here.
  const partners = all
    .filter((p) => !p.deletedAt)
    .map((p) => ({ ...p, sales: p.sales.filter((s) => !s.deletedAt) }));
  const [editing, setEditing] = useState<Editing | null>(null),
    [formError, setFormError] = useState(""),
    [busy, setBusy] = useState(false);
  const done = () => setReload((n) => n + 1);
  const phoneOrNull = (v: string) => (v.trim() ? formatPhone(v) : null);
  function editSale(partner: Partner, sale?: PartnerSale) {
    setFormError("");
    setEditing({
      kind: "sale",
      partner,
      sale,
      name: sale?.name || "",
      phone: formatPhone(sale?.phone),
      active: sale?.active ?? true,
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    if (!editing.name.trim()) return setFormError("Nhập tên.");
    if (editing.kind === "partner" && !editing.phone.trim())
      return setFormError("Nhập số điện thoại đối tác.");
    setBusy(true);
    setFormError("");
    try {
      if (editing.kind === "partner")
        await command(
          `admin/partners/${editing.partner.id}`,
          {
            expectedVersion: editing.partner.version,
            name: editing.name.trim(),
            phone: phoneOrNull(editing.phone),
            active: editing.active,
          },
          "PATCH",
        );
      else if (editing.sale)
        await command(
          `admin/partner-sales/${editing.sale.id}`,
          {
            expectedVersion: editing.sale.version,
            name: editing.name.trim(),
            phone: phoneOrNull(editing.phone),
            active: editing.active,
          },
          "PATCH",
        );
      else
        await command(`admin/partners/${editing.partner.id}/sales`, {
          name: editing.name.trim(),
          ...(editing.phone.trim() ? { phone: formatPhone(editing.phone) } : {}),
        });
      setEditing(null);
      done();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Chưa thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  const main = partners[0];
  return (
    <>
      <PageHeading
        title="Đối tác"
        description="Đơn vị gửi xe làm dịch vụ và các sale mang xe đến trạm."
      >
        {main && (
          <button className="adm-btn adm-primary" onClick={() => editSale(main)}>
            <AdminIcon name="plus" />
            Thêm sale
          </button>
        )}
      </PageHeading>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <AdminLoading />
      ) : (
        partners.map((p) => (
          <ManagerPanel
            key={p.id}
            title={p.name}
            description={`SĐT: ${p.phone ? formatPhone(p.phone) : "Chưa có"} · ${p.active ? "Đang hợp tác" : "Tạm ngưng"} · ${p.sales.filter((s) => s.active).length} sale đang làm`}
            action={
              <div className="mgr-row-actions">
                <button
                  className="adm-btn"
                  onClick={() => {
                    setFormError("");
                    setEditing({
                      kind: "partner",
                      partner: p,
                      name: p.name,
                      phone: formatPhone(p.phone),
                      active: p.active,
                    });
                  }}
                >
                  Sửa thông tin đối tác
                </button>
                <ManagerDeleteButton
                  path={`admin/partners/${p.id}`}
                  version={p.version}
                  message={`Xóa đối tác ${p.name} cùng toàn bộ sale? Đối tác sẽ không còn trong ô chọn. Lịch hẹn, phiếu cũ vẫn giữ tên.`}
                  label="Xóa đối tác"
                  onDeleted={done}
                />
              </div>
            }
          >
            {!p.phone && (
              <p className="adm-error-text" role="alert">
                Chưa có số điện thoại: cố vấn chưa tạo được phiếu cho xe của đối tác này.
              </p>
            )}
            {p.sales.length ? (
              <div className="mgr-table-scroll">
                <ManagerTable className="mgr-table">
                  <thead>
                    <tr>
                      <th>Sale</th>
                      <th>Số điện thoại</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.sales.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>{s.phone ? formatPhone(s.phone) : "—"}</td>
                        <td>
                          <span
                            className={`mgr-pill ${s.active ? "mgr-pill-success" : ""}`}
                          >
                            {s.active ? "Đang làm" : "Đã nghỉ"}
                          </span>
                        </td>
                        <td>
                          <div className="mgr-row-actions">
                            <button className="adm-btn" onClick={() => editSale(p, s)}>
                              Chỉnh sửa
                            </button>
                            <button
                              className="adm-text-link"
                              onClick={() =>
                                ask({
                                  title: s.active ? "Ngừng sale này?" : "Mở lại sale này?",
                                  message: s.active
                                    ? "Sale sẽ không còn trong ô chọn khi tạo lịch, tiếp nhận xe. Phiếu cũ vẫn giữ tên sale."
                                    : "Sale sẽ xuất hiện lại trong ô chọn.",
                                  danger: s.active,
                                  action: () =>
                                    command(
                                      `admin/partner-sales/${s.id}`,
                                      {
                                        expectedVersion: s.version,
                                        name: s.name,
                                        phone: s.phone,
                                        active: !s.active,
                                      },
                                      "PATCH",
                                    ).then(done),
                                })
                              }
                            >
                              {s.active ? "Ngừng" : "Mở lại"}
                            </button>
                            <ManagerDeleteButton
                              className="adm-text-link adm-subtle-danger"
                              path={`admin/partner-sales/${s.id}`}
                              version={s.version}
                              message={`Xóa sale ${s.name}? Sale sẽ không còn trong ô chọn. Lịch hẹn, phiếu cũ vẫn giữ tên sale.`}
                              onDeleted={done}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ManagerTable>
              </div>
            ) : (
              <ManagerEmpty message="Chưa có sale nào" />
            )}
          </ManagerPanel>
        ))
      )}
      {editing && (
        <ManagerModal
          title={
            editing.kind === "partner"
              ? "Sửa thông tin đối tác"
              : editing.sale
                ? "Chỉnh sửa sale"
                : `Thêm sale · ${editing.partner.name}`
          }
          theme={theme}
          onClose={() => setEditing(null)}
        >
          <form className="mgr-form" onSubmit={save} noValidate>
            <ManagerField label={editing.kind === "partner" ? "Tên đối tác *" : "Tên sale *"}>
              <input
                required
                maxLength={editing.kind === "partner" ? 120 : 100}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </ManagerField>
            <ManagerField
              label={
                editing.kind === "partner"
                  ? "Số điện thoại * (dùng làm hồ sơ khách của xe đối tác)"
                  : "Số điện thoại (không bắt buộc)"
              }
            >
              <input
                type="tel"
                inputMode="tel"
                value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                onBlur={() =>
                  setEditing({ ...editing, phone: formatPhone(editing.phone) })
                }
              />
            </ManagerField>
            {(editing.kind === "partner" || editing.sale) && (
              <label className="adm-toggle-row">
                <span>{editing.kind === "partner" ? "Đang hợp tác" : "Đang làm"}</span>
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
              </label>
            )}
            {formError && (
              <p className="adm-error-text" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="adm-btn adm-primary" disabled={busy}>
              {busy ? "Đang lưu…" : editing.kind === "partner" ? "Lưu đối tác" : "Lưu sale"}
            </button>
          </form>
        </ManagerModal>
      )}
    </>
  );
}
