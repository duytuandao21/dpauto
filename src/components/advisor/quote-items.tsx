"use client";
import type { Part } from "@/lib/api/stock-finance";
import type { ApiService } from "@/lib/api/types";
import {
  vnd,
  formatQuantity,
  type QuoteLine,
  type QuoteRevision,
} from "@/lib/api/workflow";
import { quotePreview } from "@/lib/advisor/quote-preview";

export type EditableQuoteLine = Omit<
  QuoteLine,
  "id" | "subtotal" | "discountTotal" | "taxTotal" | "total"
>;

export function QuoteItems({
  revision,
  previous = [],
  lines,
  discount,
  services,
  parts = [],
  partsLoading = false,
  editable,
  edit,
  remove,
  add,
}: {
  revision: QuoteRevision;
  previous?: QuoteRevision[];
  lines: EditableQuoteLine[];
  discount: string;
  services: ApiService[];
  parts?: Part[];
  partsLoading?: boolean;
  editable: boolean;
  edit: (index: number, patch: Partial<EditableQuoteLine>) => void;
  remove: (index: number) => void;
  add: (kind: "SERVICE" | "PART") => void;
}) {
  const rows = [
    ...previous.flatMap((quote) =>
      quote.lines.map((line) => ({ line, quote, index: -1 })),
    ),
    ...lines.map((line, index) => ({ line, quote: revision, index })),
  ];
  return (
    <div className="adv-quote-items">
      {(["SERVICE", "PART"] as const).map((kind) => (
        <section className="adv-quote-group" key={kind}>
          <h3>
            {kind === "SERVICE"
              ? "I. Công việc dịch vụ"
              : "II. Phụ tùng, vật tư"}
          </h3>
          <div
            className="adv-quote-scroll"
            role="region"
            aria-label={
              kind === "SERVICE" ? "Bảng dịch vụ" : "Bảng phụ tùng, vật tư"
            }
            tabIndex={0}
          >
            <table className="adv-quote-table">
              <caption className="adv-sr-only">
                {kind === "SERVICE"
                  ? "Hạng mục dịch vụ"
                  : "Hạng mục phụ tùng, vật tư"}
              </caption>
              <colgroup>
                {[23, 12, 6, 7, 15, 8, 8, 16, 5].map((width, i) => (
                  <col key={i} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {[
                    kind === "SERVICE" ? "Dịch vụ" : "Phụ tùng",
                    "Diễn giải",
                    "ĐVT",
                    "SL",
                    "Đơn giá (₫)",
                    "CK (%)",
                    "VAT (%)",
                    "Thành tiền",
                    "",
                  ].map((title, i) => (
                    <th
                      scope="col"
                      key={i}
                      className={
                        i === 4
                          ? "adv-money-cell"
                          : i === 7
                            ? "adv-quote-amount"
                            : undefined
                      }
                    >
                      {title || <span className="adv-sr-only">Thao tác</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(({ line }) => line.kind === kind)
                  .map(({ line, quote, index }, number) => {
                    const canEdit = editable && index >= 0;
                    const cancelled =
                      quote.status === "VOIDED" ||
                      ("id" in line &&
                        quote.voidedLineIds?.includes(line.id as string));
                    const declined =
                      quote.status === "REJECTED" ||
                      ("id" in line &&
                        quote.decision?.approvedLineIds &&
                        !quote.decision.approvedLineIds.includes(
                          line.id as string,
                        ));
                    const amount = canEdit
                      ? quotePreview([line], discount)?.total
                      : (line as QuoteLine).total;
                    return (
                      <tr
                        key={
                          index >= 0 ? `draft-${index}` : (line as QuoteLine).id
                        }
                        className={
                          cancelled || declined ? "is-inactive" : undefined
                        }
                      >
                        <td className="adv-quote-name">
                          <span className="adv-quote-cell-label">
                            {number + 1}. Hạng mục
                          </span>
                          {canEdit ? (
                            <label className="adm-field">
                              <span className="adv-sr-only">
                                {kind === "SERVICE" ? "Dịch vụ" : "Phụ tùng"}{" "}
                                dòng {number + 1}
                              </span>
                              {kind === "SERVICE" ? (
                                <select
                                  required
                                  value={line.serviceId || ""}
                                  title={line.name}
                                  onChange={(e) => {
                                    const service = services.find(
                                      (s) => s.id === e.target.value,
                                    );
                                    edit(index, {
                                      serviceId: service?.id,
                                      name: service?.name || "",
                                      code: service?.code || "",
                                    });
                                  }}
                                >
                                  <option value="">Chọn dịch vụ</option>
                                  {services
                                    .filter(
                                      (s) =>
                                        (s.active && s.bookable) ||
                                        s.id === line.serviceId,
                                    )
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <select
                                  required
                                  disabled={partsLoading}
                                  title={line.name}
                                  value={
                                    parts.find((p) => p.code === line.code)
                                      ?.id || (line.name ? "existing" : "")
                                  }
                                  onChange={(e) => {
                                    const part = parts.find(
                                      (p) => p.id === e.target.value,
                                    );
                                    edit(index, {
                                      name: part?.name || "",
                                      code: part?.code || "",
                                      unit: part?.unit || "",
                                    });
                                  }}
                                >
                                  <option value="">
                                    {partsLoading
                                      ? "Đang tải phụ tùng…"
                                      : parts.some((p) => p.active)
                                        ? "Chọn phụ tùng"
                                        : "Chưa có phụ tùng trong danh mục"}
                                  </option>
                                  {line.name &&
                                    !parts.some(
                                      (p) => p.code === line.code,
                                    ) && (
                                      <option value="existing" disabled>
                                        {line.name}
                                      </option>
                                    )}
                                  {parts
                                    .filter(
                                      (p) => p.active || p.code === line.code,
                                    )
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                </select>
                              )}
                            </label>
                          ) : (
                            <strong title={line.name}>{line.name}</strong>
                          )}
                        </td>
                        <td className="adv-quote-description">
                          <label className="adm-field">
                            <span className="adv-quote-cell-label">
                              Diễn giải
                            </span>
                            {canEdit ? (
                              <input
                                type="text"
                                title={line.description || ""}
                                maxLength={500}
                                value={line.description || ""}
                                onChange={(e) =>
                                  edit(index, { description: e.target.value })
                                }
                              />
                            ) : (
                              <span title={line.description || ""}>
                                {line.description || "—"}
                              </span>
                            )}
                          </label>
                        </td>
                        {(
                          [
                            ["unit", "Đơn vị", {}],
                            [
                              "quantity",
                              "Số lượng",
                              {
                                type: "number",
                                min: "0.001",
                                max: "9999999.999",
                                step: "0.001",
                              },
                            ],
                            [
                              "unitPrice",
                              "Đơn giá (₫)",
                              { inputMode: "numeric", pattern: "[0-9.]{1,19}" },
                            ],
                            [
                              "discountPercent",
                              "Chiết khấu (%)",
                              {
                                type: "number",
                                min: "0",
                                max: "100",
                                step: "0.01",
                              },
                            ],
                            [
                              "vatPercent",
                              "VAT (%)",
                              {
                                type: "number",
                                min: "0",
                                max: "100",
                                step: "0.01",
                              },
                            ],
                          ] as const
                        ).map(([key, title, attributes]) => (
                          <td
                            key={key}
                            className={
                              key === "unitPrice" ? "adv-money-cell" : undefined
                            }
                          >
                            <label className="adm-field">
                              <span className="adv-quote-cell-label">
                                {title}
                              </span>
                              {canEdit ? (
                                <input
                                  {...attributes}
                                  required
                                  maxLength={
                                    key === "unit"
                                      ? 30
                                      : key === "unitPrice"
                                        ? 19
                                        : undefined
                                  }
                                  aria-label={`${title} dòng ${number + 1}`}
                                  value={
                                    key === "unitPrice" &&
                                    /^\d+$/.test(line[key])
                                      ? BigInt(line[key]).toLocaleString(
                                          "vi-VN",
                                        )
                                      : line[key]
                                  }
                                  onChange={(e) =>
                                    edit(index, {
                                      [key]:
                                        key === "unitPrice"
                                          ? e.target.value.replace(/\./g, "")
                                          : e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <span>
                                  {key === "unitPrice"
                                    ? vnd(line[key])
                                    : key === "quantity"
                                      ? formatQuantity(line[key])
                                      : line[key]}
                                </span>
                              )}
                            </label>
                          </td>
                        ))}
                        <td className="adv-quote-amount">
                          <span className="adv-quote-cell-label">
                            Thành tiền
                          </span>
                          <strong>{amount == null ? "—" : vnd(amount)}</strong>
                        </td>
                        <td className="adv-quote-remove">
                          {canEdit && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-subtle-danger"
                              aria-label={`Xóa ${line.name || `dòng ${number + 1}`}`}
                              onClick={() => remove(index)}
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!rows.some(({ line }) => line.kind === kind) && (
            <p className="adm-muted">
              Chưa có {kind === "SERVICE" ? "dịch vụ" : "phụ tùng, vật tư"}.
            </p>
          )}
          {editable && (
            <button
              type="button"
              className="adm-btn adm-btn-sm"
              disabled={lines.length >= 100}
              onClick={() => add(kind)}
            >
              + {kind === "SERVICE" ? "Thêm dịch vụ" : "Thêm phụ tùng"}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
