"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { PageHeading } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import type { ContentItem } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import {
  ManagerPanel,
  ManagerTable,
  ManagerSearch,
  ManagerEmpty,
  ManagerField,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";

const descriptions = {
  content: {
    title: "Nội dung website",
    description: "Biên tập các khối nội dung trang chủ.",
  },
  news: {
    title: "Tin tức & bài viết",
    description: "Quản lý bài viết và bản nháp.",
  },
  media: {
    title: "Thư viện hình ảnh",
    description: "Quản lý hình ảnh và nội dung mô tả.",
  },
  seo: {
    title: "SEO & hiển thị",
    description: "Quản lý tiêu đề và mô tả kết quả tìm kiếm.",
  },
};
export function ManagerContentPage({ kind }: { kind: ContentItem["kind"] }) {
  const { data, theme, update, ask } = useManager();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [preview, setPreview] = useState<ContentItem | null>(null);
  const [error, setError] = useState("");
  const items = data.content.filter(
    (item) =>
      item.kind === kind &&
      item.title
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (
      !editing.title.trim() ||
      !editing.description.trim() ||
      !editing.body.trim()
    ) {
      setError("Điền tiêu đề, mô tả và nội dung.");
      return;
    }
    const value = { ...editing, title: editing.title.trim() };
    update(
      (previous) => ({
        ...previous,
        content: previous.content.some((item) => item.id === value.id)
          ? previous.content.map((item) =>
              item.id === value.id ? value : item,
            )
          : [...previous.content, value],
      }),
      "Đã lưu nội dung",
      value.title,
    );
    setEditing(null);
  }
  function publication(item: ContentItem) {
    ask({
      title: item.published
        ? "Chuyển thành bản nháp?"
        : "Đổi trạng thái xuất bản?",
      message: "Xác nhận thay đổi trạng thái nội dung này?",
      action: () =>
        update(
          (previous) => ({
            ...previous,
            content: previous.content.map((content) =>
              content.id === item.id
                ? { ...content, published: !content.published }
                : content,
            ),
          }),
          "Đã đổi trạng thái nội dung",
          item.title,
        ),
    });
  }
  const heading = descriptions[kind];
  return (
    <>
      <PageHeading title={heading.title} description={heading.description}>
        {kind === "news" && (
          <button
            className="adm-btn adm-primary"
            onClick={() => {
              setEditing({
                id: `CT-${Date.now()}`,
                kind,
                title: "",
                description: "",
                body: "",
                published: false,
                image: "/images/garage-team.jpg",
              });
              setError("");
            }}
          >
            <AdminIcon name="plus" />
            Thêm bài viết
          </button>
        )}
      </PageHeading>
      <ManagerPanel
        title={`${items.length} ${kind === "media" ? "hình ảnh" : "nội dung"}`}
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm tiêu đề nội dung…"
          />
        </div>
        {kind === "media" ? (
          <div className="mgr-media-grid">
            {items.map((item) => (
              <article className="mgr-media-card" key={item.id}>
                <div className="mgr-media-image">
                  <Image
                    src={item.image!}
                    alt={item.description}
                    fill
                    sizes="(max-width: 767px) 90vw, 400px"
                    unoptimized
                  />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="mgr-row-actions">
                    <button
                      className="adm-btn"
                      onClick={() => setPreview(item)}
                    >
                      Xem ảnh
                    </button>
                    <button
                      className="adm-text-link"
                      onClick={() => {
                        setEditing({ ...item });
                        setError("");
                      }}
                    >
                      Sửa mô tả
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mgr-table-scroll">
            <ManagerTable className="mgr-table">
              <thead>
                <tr>
                  <th>{kind === "seo" ? "Trang / Tiêu đề SEO" : "Tiêu đề"}</th>
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.id}</small>
                    </td>
                    <td className="mgr-content-excerpt">{item.description}</td>
                    <td>
                      <span
                        className={`mgr-pill ${item.published ? "mgr-pill-success" : ""}`}
                      >
                        {item.published ? "Xuất bản" : "Bản nháp"}
                      </span>
                    </td>
                    <td>
                      <div className="mgr-row-actions">
                        <button
                          className="adm-btn"
                          onClick={() => {
                            setEditing({ ...item });
                            setError("");
                          }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          className="adm-text-link"
                          onClick={() => setPreview(item)}
                        >
                          Preview
                        </button>
                        <button
                          className="adm-text-link"
                          onClick={() => publication(item)}
                        >
                          {item.published ? "Ẩn" : "Xuất bản"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ManagerTable>
          </div>
        )}
        {!items.length && <ManagerEmpty onReset={() => setQuery("")} />}
      </ManagerPanel>
      {editing && (
        <ManagerModal
          title={kind === "media" ? "Chỉnh sửa mô tả ảnh" : "Biên tập nội dung"}
          theme={theme}
          onClose={() => setEditing(null)}
        >
          <form className="mgr-form" onSubmit={save} noValidate>
            <ManagerField label="Tiêu đề *">
              <input
                maxLength={120}
                autoFocus
                value={editing.title}
                onChange={(event) =>
                  setEditing({ ...editing, title: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField
              label={
                kind === "seo" ? "Tiêu đề tìm kiếm *" : "Mô tả / Alt ảnh *"
              }
            >
              <input
                maxLength={160}
                value={editing.description}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
              />
            </ManagerField>
            <ManagerField
              label={kind === "seo" ? "Meta description *" : "Nội dung *"}
            >
              <textarea
                rows={5}
                maxLength={5000}
                value={editing.body}
                onChange={(event) =>
                  setEditing({ ...editing, body: event.target.value })
                }
              />
            </ManagerField>
            {error && (
              <p className="adm-error-text" role="alert">
                {error}
              </p>
            )}
            <div className="mgr-row-actions">
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  setPreview(editing);
                  setEditing(null);
                }}
              >
                Xem trước
              </button>
              <button type="submit" className="adm-btn adm-primary">
                Lưu nội dung
              </button>
            </div>
          </form>
        </ManagerModal>
      )}
      {preview && (
        <ManagerModal
          title="Xem trước nội dung"
          theme={theme}
          onClose={() => setPreview(null)}
          footer={
            <>
              <button className="adm-btn" onClick={() => setPreview(null)}>
                Đóng
              </button>
              <button
                className="adm-btn adm-primary"
                onClick={() => {
                  setEditing(preview);
                  setPreview(null);
                }}
              >
                Chỉnh sửa
              </button>
            </>
          }
        >
          {kind === "seo" ? (
            <div className="mgr-seo-preview">
              <small>DPAuto · {preview.title}</small>
              <h3>{preview.description}</h3>
              <p>{preview.body}</p>
            </div>
          ) : (
            <article className="mgr-content-preview">
              {preview.image && (
                <div className="mgr-preview-image">
                  <Image
                    src={preview.image}
                    alt={preview.description}
                    fill
                    sizes="600px"
                    unoptimized
                  />
                </div>
              )}
              <h2>{preview.title}</h2>
              <p>{preview.description}</p>
              <div>{preview.body}</div>
            </article>
          )}
        </ManagerModal>
      )}
    </>
  );
}
