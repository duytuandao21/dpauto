# Thu gọn khu vực quản lý đặt lịch

## Thay đổi

- `src/components/admin/admin-shell.tsx`: menu gồm Tổng quan, Lịch hẹn, Khách hàng, Tài khoản; bỏ nhóm Nội dung & hệ thống, đồng bộ menu desktop/mobile và trạng thái đang chọn.
- `src/components/admin/secondary-pages.tsx`: bỏ giao diện CMS, cấu hình giờ/ngày nghỉ/công suất, Zalo OA, khôi phục và đặt lại dữ liệu; mục Tài khoản giữ thông báo và liên kết website công khai; tùy chọn cá nhân dùng chức năng sáng/tối hiện có.
- `src/app/quanly/website/page.tsx`: đường dẫn cũ chuyển về `/quanly`.
- `scripts/check-booking.cjs`: cập nhật các kiểm tra phụ thuộc menu và cấu hình đã bỏ.

Tái sử dụng toàn bộ layout, panel, icon, nút và token admin hiện có, không sửa CSS. Luồng lịch hẹn, dữ liệu khách và phương tiện được giữ nguyên. Đây là thu gọn giao diện; chưa triển khai đăng nhập hoặc phân quyền theo bản ghi.

## Kiểm tra

- TypeScript và production build: đạt.
- Prettier và cú pháp script kiểm tra: đạt. Dự án chưa có cấu hình lint.
- Kiểm tra trình duyệt trên bản production chạy tạm ở cổng 4002: Chrome 390/768/1440px, WebKit 390px.
- Rà Tổng quan, Lịch hẹn, Khách hàng, Tài khoản, Tùy chọn cá nhân: không tràn ngang; menu không còn Quản lý website; không còn các trường cấu hình vận hành và đặt lại dữ liệu.
- Kiểm tra chuyển hướng URL cũ; mục Tài khoản được chọn đúng khi vào tùy chọn; sáng/tối lưu sau tải lại; dữ liệu lịch hẹn trong localStorage không bị thay đổi.
- Không có page error trong các kịch bản này. Đã xem ảnh mobile và desktop của các trang được sửa.
- Đã tắt tiến trình kiểm tra cổng 4002 sau khi hoàn tất. Không mở lại dev server cổng 4001.

Ảnh chụp và `verification.json` nằm cùng thư mục. Không chạy toàn bộ bộ kiểm tra nghiệp vụ.
