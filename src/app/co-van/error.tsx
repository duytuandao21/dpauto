"use client";
import Link from "next/link";
export default function AdminError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="adm-empty">
      <h1>Chưa thể hiển thị nội dung</h1>
      <p>
        Đã có lỗi khi tải giao diện quản lý. Dữ liệu website công khai không bị
        ảnh hưởng.
      </p>
      <button className="adm-btn adm-primary" onClick={retry}>
        Thử lại
      </button>
      <Link href="/co-van" className="adm-btn">
        Về tổng quan
      </Link>
    </div>
  );
}
