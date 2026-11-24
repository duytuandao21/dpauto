"use client";
import { useState } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Youtube from "@tiptap/extension-youtube";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { MediaPicker } from "./media";
import { Button, Dialog, Field, Input } from "./ui";

// Library images keep their asset id so the backend can track where each image is used.
const LibraryImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), assetId: { default: null } };
  },
});
const safeLink = (v: string) =>
  /^(https:\/\/|tel:|mailto:|#|\/(?!\/))/i.test(v.trim());

function Toolbar({ editor }: { editor: Editor }) {
  const [picker, setPicker] = useState(false),
    [link, setLink] = useState<string | null>(null),
    [video, setVideo] = useState<string | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 })
        ? "h2"
        : e.isActive("heading", { level: 3 })
          ? "h3"
          : e.isActive("heading", { level: 4 })
            ? "h4"
            : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      table: e.isActive("table"),
      align:
        (["left", "center", "right", "justify"] as const).find((a) =>
          e.isActive({ textAlign: a }),
        ) || "left",
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const btn = (
    label: string,
    title: string,
    active: boolean | undefined,
    run: () => void,
    disabled?: boolean,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );
  return (
    <div
      className="cms-rte-toolbar"
      role="toolbar"
      aria-label="Định dạng văn bản"
    >
      {btn("↶", "Hoàn tác", false, () => c().undo().run(), !s.undo)}
      {btn("↷", "Làm lại", false, () => c().redo().run(), !s.redo)}
      <span className="cms-rte-sep" />
      <select
        aria-label="Kiểu đoạn"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") c().setParagraph().run();
          else
            c()
              .setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 })
              .run();
        }}
      >
        <option value="p">Đoạn văn</option>
        <option value="h2">Tiêu đề lớn</option>
        <option value="h3">Tiêu đề vừa</option>
        <option value="h4">Tiêu đề nhỏ</option>
      </select>
      <span className="cms-rte-sep" />
      {btn("B", "In đậm", s.bold, () => c().toggleBold().run())}
      {btn("I", "In nghiêng", s.italic, () => c().toggleItalic().run())}
      {btn("U", "Gạch chân", s.underline, () => c().toggleUnderline().run())}
      {btn("S", "Gạch ngang", s.strike, () => c().toggleStrike().run())}
      {btn("H", "Tô sáng", s.highlight, () => c().toggleHighlight().run())}
      {btn("🔗", s.link ? "Sửa liên kết" : "Chèn liên kết", s.link, () =>
        setLink(editor.getAttributes("link").href || ""),
      )}
      <span className="cms-rte-sep" />
      {btn("•", "Danh sách", s.bullet, () => c().toggleBulletList().run())}
      {btn("1.", "Danh sách đánh số", s.ordered, () =>
        c().toggleOrderedList().run(),
      )}
      {btn("☑", "Danh sách việc", s.task, () => c().toggleTaskList().run())}
      {btn("❝", "Trích dẫn", s.quote, () => c().toggleBlockquote().run())}
      {btn("—", "Đường kẻ ngang", false, () => c().setHorizontalRule().run())}
      <span className="cms-rte-sep" />
      {btn("⇤", "Căn trái", s.align === "left", () =>
        c().setTextAlign("left").run(),
      )}
      {btn("↔", "Căn giữa", s.align === "center", () =>
        c().setTextAlign("center").run(),
      )}
      {btn("⇥", "Căn phải", s.align === "right", () =>
        c().setTextAlign("right").run(),
      )}
      {btn("☰", "Căn đều", s.align === "justify", () =>
        c().setTextAlign("justify").run(),
      )}
      <span className="cms-rte-sep" />
      {btn("🖼", "Chèn ảnh từ thư viện", false, () => setPicker(true))}
      {btn("▶", "Chèn video YouTube", false, () => setVideo(""))}
      {btn("▦", "Chèn bảng", false, () =>
        c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      )}
      {s.table && (
        <>
          {btn("+cột", "Thêm cột", false, () => c().addColumnAfter().run())}
          {btn("+hàng", "Thêm hàng", false, () => c().addRowAfter().run())}
          {btn("−cột", "Xóa cột", false, () => c().deleteColumn().run())}
          {btn("−hàng", "Xóa hàng", false, () => c().deleteRow().run())}
          {btn("✕bảng", "Xóa bảng", false, () => c().deleteTable().run())}
        </>
      )}
      <span className="cms-rte-sep" />
      {btn("⌫", "Xóa định dạng", false, () =>
        c().unsetAllMarks().clearNodes().run(),
      )}
      {picker && (
        <MediaPicker
          onClose={() => setPicker(false)}
          onPick={(a) => {
            c()
              .insertContent({
                type: "image",
                attrs: { src: a.src, alt: a.alt, assetId: a.id },
              })
              .run();
            setPicker(false);
          }}
        />
      )}
      {link !== null && (
        <Dialog
          title="Liên kết"
          onClose={() => setLink(null)}
          footer={
            <>
              {s.link && (
                <Button
                  variant="ghost"
                  onClick={() => (
                    c().extendMarkRange("link").unsetLink().run(),
                    setLink(null)
                  )}
                >
                  Bỏ liên kết
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!safeLink(link)}
                onClick={() => {
                  c()
                    .extendMarkRange("link")
                    .setLink({ href: link.trim() })
                    .run();
                  setLink(null);
                }}
              >
                Lưu liên kết
              </Button>
            </>
          }
        >
          <Field
            label="Đường dẫn"
            help="Trang trong website (/services), số điện thoại (tel:…), email (mailto:…) hoặc https://…"
          >
            <Input
              autoFocus
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
            />
          </Field>
        </Dialog>
      )}
      {video !== null && (
        <Dialog
          title="Chèn video YouTube"
          onClose={() => setVideo(null)}
          footer={
            <Button
              variant="primary"
              disabled={
                !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(video)
              }
              onClick={() => {
                c().setYoutubeVideo({ src: video.trim() }).run();
                setVideo(null);
              }}
            >
              Chèn video
            </Button>
          }
        >
          <Field label="Link video YouTube">
            <Input
              autoFocus
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
        </Dialog>
      )}
    </div>
  );
}

/** Rich text stored as Tiptap JSON. `initial` may be JSON or the built-in default HTML. */
export function RichText({
  label,
  initial,
  onChange,
  placeholder = "Bắt đầu viết nội dung…",
  disabled,
  help,
}: {
  label: string;
  initial: JSONContent | string | undefined;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  disabled?: boolean;
  help?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (u) => safeLink(u),
        },
      }),
      LibraryImage,
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Youtube.configure({ nocookie: true, modestBranding: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: initial || "",
    editorProps: {
      attributes: { class: "cms-rte-content", "aria-label": label },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });
  const count = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            words: e.storage.characterCount.words(),
            chars: e.storage.characterCount.characters(),
          }
        : null,
  });
  return (
    <div className="cms-field cms-span-2">
      <span>{label}</span>
      {help && <small className="cms-help">{help}</small>}
      <div className="cms-rte">
        {editor && !disabled && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
        <div className="cms-rte-foot">
          {count
            ? `${count.words.toLocaleString("vi-VN")} từ · ${count.chars.toLocaleString("vi-VN")} ký tự`
            : "Đang tải trình soạn thảo…"}
        </div>
      </div>
    </div>
  );
}
