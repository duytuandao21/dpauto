"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="adm-panel mgr-panel" role="alert">
      <h2>Không tải được nội dung</h2>
      <p>Thử tải lại màn hình. Nếu lỗi tiếp diễn, liên hệ quản trị hệ thống.</p>
      <button className="adm-btn adm-primary" onClick={reset}>
        Thử lại
      </button>
    </section>
  );
}
