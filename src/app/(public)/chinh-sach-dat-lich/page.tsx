import Link from "next/link";
import type { Metadata } from "next";
import { publicMetadata } from "@/lib/public-cms";
export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/chinh-sach-dat-lich", { title: "Thông tin đặt lịch" });
export default function BookingNoticePage() {
  return (
    <section className="legal-page">
      <div className="legal-reading">
        <header className="legal-header">
          <div className="rich-content legal-heading">
            <h1>Thông tin đặt lịch dịch vụ</h1>
          </div>
        </header>
        <div className="rich-content legal-prose">
          <p>
            Trạm dịch vụ Toàn Trung sử dụng họ tên, số điện thoại, thông tin xe
            và dịch vụ bạn chọn để liên hệ, xác nhận lịch và chuẩn bị tiếp nhận.
          </p>
          <p>
            Yêu cầu gửi thành công ở trạng thái chờ xác nhận. Nhân viên sẽ trao
            đổi với bạn trước khi xác nhận lịch.
          </p>
          <p>
            Việc đặt lịch không đăng ký nhận nội dung quảng cáo. Bạn có thể liên
            hệ <a href="tel:0772584279">0772 584 279</a> để cập nhật hoặc hủy
            yêu cầu.
          </p>
          <Link href="/">Quay về trang chủ</Link>
        </div>
      </div>
    </section>
  );
}
