# Thiết kế lại khu quản lý DPAuto theo tham khảo CRM

## Tham khảo trực tiếp

Đã mở tab Chrome người dùng cung cấp: [Agentic UI Kit — CRM Contacts](https://agentic-ui-kit.com/live/template/crm-contacts). Đã xem mobile, desktop, theme sáng/tối và sidebar mobile; đo computed styles trong DOM.

Mẫu sử dụng chữ chính của hàng danh sách 14px, chữ phụ 12px, avatar 32px, viền mảnh, nền trung tính và header gọn. DPAuto áp dụng cách phân cấp này cho nghiệp vụ lịch hẹn, dùng font Inter local có tiếng Việt thay vì thêm font hoặc thư viện mới.

## Thay đổi

- Header quản lý gọn; sidebar dùng logo thật, nhóm điều hướng và nút Tạo lịch hẹn. Desktop có breadcrumb; mobile có nút tạo lịch kèm chữ.
- Viết lại stylesheet có namespace riêng cho toàn bộ khu quản lý: tổng quan, lịch hẹn, hồ sơ khách, form, cài đặt, menu Thêm và quản lý website.
- Nền tối dùng các màu than có sẵn trong project; nền sáng trắng/xám nhạt; đỏ DPAuto là accent. Card, badge, input, dialog và toast thống nhất ở cả hai theme.
- KPI 2×2 trên điện thoại, 4 cột trên tablet/desktop. Giảm nền màu lớn và khoảng trống; giữ sự phân biệt trạng thái bằng icon, badge và nội dung.
- Danh sách lịch dùng các hàng có viền phân cách, avatar nhỏ, nhóm khách/xe/dịch vụ rõ ràng. Nút xử lý trên hàng gọn, thao tác tạo lịch là nút đỏ chính.
- Desktop có tổng hợp 7 ngày và dịch vụ phổ biến trong ngày, lấy từ cùng store. Bấm cột ngày cập nhật ngày, KPI và danh sách. Mobile ưu tiên danh sách lịch, không đưa biểu đồ lên trước công việc chính.
- Tablet giữ bố cục danh sách–chi tiết. Mobile giữ trang chi tiết riêng, bottom navigation và khoảng đệm cuối nội dung.
- Dữ liệu, localStorage, các route và luồng trạng thái booking giữ cơ chế hiện tại. Không sửa giao diện website công khai, API hoặc dependencies.

## Kích thước đã đo

| Thành phần | Mobile |
| --- | --- |
| Header | 64px |
| Tiêu đề trang | 24px / line-height 32px |
| Tên khách | 14px / line-height 20px |
| Xe, dịch vụ, cố vấn | 12px / line-height 18px |
| Badge | 11px / line-height 16px |
| Form/input trên mobile | 16px, chiều cao tối thiểu 44px |
| Thẻ/hàng lịch mẫu | Khoảng 176px |
| Lề nội dung | 16px |

Các kích thước của thẻ có thể tăng với tên, ghi chú hoặc danh sách dịch vụ dài; không đặt chiều cao cứng cho nội dung.

## Kiểm tra

- `npm run typecheck`: đạt.
- Prettier cho các file sửa/tạo: đạt.
- Kiểm tra trực quan 7 route × 5 kích thước (360, 390, 768, 1024, 1440): không có tràn ngang. Có ảnh cho tổng quan, lịch, khách hàng, chi tiết, tạo lịch, cài đặt, quản lý website.
- Chạy lại các luồng booking trên Chromium và WebKit có mô phỏng cảm ứng: 12 nhóm kiểm tra đạt, không có page error ứng dụng. Có một cảnh báo endpoint debug `__nextjs_original-stack-frames` của Next dev trên WebKit, ghi riêng trong báo cáo.
- Kiểm tra tương tác mới: bấm biểu đồ đổi ngày → KPI và danh sách khớp; trang chủ vẫn có header/footer công khai và không có shell admin.
- Đây là kiểm tra bằng trình duyệt trên máy tính/mô phỏng kích thước, chưa phải kiểm tra điện thoại vật lý.
- Không chạy production build hoặc toàn bộ test suite cho đợt thay đổi UI này. Dùng dev server đang chạy, không khởi động lại server.

## File

```text
src/styles/admin.css
src/components/admin/admin-shell.tsx
src/components/admin/bookings-workspace.tsx
src/components/admin/overview-insights.tsx (mới)
src/components/admin/secondary-pages.tsx
docs/qa/booking-redesign.md
docs/qa/booking-redesign/*.png
docs/qa/booking-redesign/*.json
```

## Ảnh và dữ liệu kiểm tra

- [Tổng quan mobile tối](booking-redesign/quanly-390-dark.png)
- [Tổng quan mobile sáng](booking-redesign/quanly-390-light.png)
- [Desktop sáng](booking-redesign/quanly-1440-light.png)
- [Tablet tối](booking-redesign/quanly-768-dark.png)
- [Khách hàng mobile](booking-redesign/quanly-khach-hang-390-dark.png)
- [Tạo lịch mobile](booking-redesign/quanly-lich-hen-tao-moi-390-dark.png)
- [Kiểm tra trực quan](booking-redesign/visual-check.json)
- [Luồng thao tác](booking-redesign/workflows.json)
- [Đo lần cuối](booking-redesign/final-check.json)

Preview: `http://localhost:4002/quanly`.
