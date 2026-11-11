# DPAuto — UI quản lý cửa hàng

## Màn hình và đường dẫn

| Màn hình | Đường dẫn |
|---|---|
| Dashboard | `/dieu-hanh` |
| Quản lý lịch hẹn — bảng, lịch ngày/tuần, drawer chi tiết | `/dieu-hanh/lich-hen` |
| Báo cáo và tải CSV mẫu | `/dieu-hanh/bao-cao` |
| Khung giờ và năng lực nguồn lực mẫu | `/dieu-hanh/nang-luc` |
| Danh mục dịch vụ | `/dieu-hanh/dich-vu` |
| Nhân sự và vai trò mẫu | `/dieu-hanh/nhan-su` |
| Khách hàng, phương tiện, lịch sử đặt lịch | `/dieu-hanh/khach-hang` |
| Nội dung landing page | `/dieu-hanh/website/noi-dung` |
| Tin tức và bản nháp | `/dieu-hanh/website/bai-viet` |
| Hình ảnh và mô tả ảnh | `/dieu-hanh/website/hinh-anh` |
| Preview tiêu đề và mô tả SEO | `/dieu-hanh/website/seo` |
| Thông báo và giao diện Zalo OA | `/dieu-hanh/thong-bao` |
| Cấu hình trạm, giờ hoạt động, tùy chọn đặt lịch | `/dieu-hanh/cau-hinh` |
| Nhật ký thao tác trong phiên mẫu | `/dieu-hanh/nhat-ky` |

## Tệp và component

- `src/app/dieu-hanh/`: layout quản lý riêng, dashboard và các route ở bảng trên.
- `src/lib/manager/mock.ts`: kiểu dữ liệu, danh mục menu và fixtures có cấu trúc.
- `src/styles/manager.css`: CSS giới hạn vào các lớp `mgr-*`; không thay token hoặc CSS của cố vấn.
- `src/components/manager/manager-shell.tsx`: sidebar theo nhóm, thu gọn desktop, drawer mobile, breadcrumb, menu tài khoản và sáng/tối.
- `manager-provider.tsx`: state mẫu trong bộ nhớ, xác nhận thao tác và toast.
- `manager-modal.tsx`, `manager-ui.tsx`: native dialog, focus/scroll, panel, search, filter, field, pagination và trạng thái mẫu.
- `manager-charts.tsx`: biểu đồ SVG, phân bố trạng thái và thanh năng lực nguồn lực; không thêm thư viện chart.
- `booking-list.tsx`, `bookings-page.tsx`, `dashboard.tsx`: danh sách, chi tiết, phân công mẫu, lịch ngày/tuần, KPI và báo cáo.
- `capacity-page.tsx`, `catalog-pages.tsx`, `customers-page.tsx`, `content-page.tsx`, `system-pages.tsx`: các màn hình chức năng.

Tái sử dụng `AdminIcon`, `PageHeading`, `StatusBadge`, `AdminLoading`, kiểu trạng thái lịch, các hàm định dạng ngày; font Inter, button, form, panel và token màu sáng/tối của admin hiện tại. CoreUI chỉ là tham khảo cách tổ chức thông tin. Không cài dependency mới. Không sửa `/co-van`, `/admin` hoặc các trang public.

## Tương tác mẫu

- Lọc thời gian dashboard, đổi dữ liệu biểu đồ, tìm kiếm/lọc/phân trang và xem lịch theo ngày/tuần.
- Drawer lịch hẹn có phân công cố vấn mẫu kèm xác nhận; lịch đã kết thúc chỉ đọc phân công.
- Thêm/sửa dịch vụ, đổi trạng thái dịch vụ; hồ sơ nhân sự có kiểm tra đầu vào và xác nhận khi lưu vai trò mẫu.
- Hồ sơ khách có phương tiện và lịch sử đặt lịch, phân biệt với lịch sử dịch vụ đã thực hiện.
- Chỉnh sửa nội dung, preview, bản nháp/xuất bản mẫu, mô tả ảnh và SEO. Không cập nhật website thật, không upload tệp.
- Lưu cấu hình trạm mẫu, tùy chọn thông báo, đánh dấu đã đọc, mô phỏng thử lại và ghi nhật ký phiên.
- Có skeleton khi khởi tạo; dashboard có mục thu gọn để xem trạng thái loading/empty/error và Thử lại.
- Form có validation; dialog hỗ trợ Escape, giữ focus, khôi phục focus và khóa cuộn nền. Mobile dùng dialog toàn màn hình.
- Dữ liệu quản lý không được ghi localStorage hoặc gửi ra mạng. Chỉ giao diện sáng/tối lưu ở `dpauto.manager.theme`, độc lập với cố vấn.

## Năng lực phục vụ

Bảng dùng fixtures theo nhóm dịch vụ, nguồn lực và số phút nguồn lực. Không xây dựng thuật toán phân bổ, không giữ chỗ và không dùng giới hạn số xe làm công thức công suất. Đổi ngày vẫn xem cùng bộ dữ liệu mẫu và có nhãn giải thích. Form cấu hình năng lực chỉ ghi nhận phản hồi đề xuất mẫu, không tính lại bảng hoặc thay đổi lịch.

## Kiểm tra theo Minimal Testing

- Đã đọc cấu trúc, pattern và tài liệu Next.js liên quan trước khi triển khai.
- Đã khảo sát trực tiếp tab CoreUI mà người dùng mở.
- Một lượt `npm run build` thành công, bao gồm TypeScript. Không chạy thêm lệnh typecheck trùng mục đích.
- Chỉ định dạng các tệp mới/được sửa trong tính năng. Dự án chưa có lint nên không thêm công cụ hoặc cấu hình lint.
- Đã xem trực tiếp ảnh dashboard desktop 1440 × 1000; dashboard và danh sách lịch mobile 390 × 844. Các ảnh nằm trong thư mục này.
- Tablet được rà qua CSS ở breakpoint 768/1024; chưa chụp tablet, chưa thử điện thoại vật lý.
- Các tương tác được rà tĩnh theo luồng state và event handler; chưa chạy kiểm thử E2E hoặc ma trận thao tác tự động.
- Không chạy toàn bộ test suite, Lighthouse hoặc benchmark.

## Phần cần tích hợp tiếp

- API lịch toàn trạm, phân công, bộ lọc/phân trang, danh mục dịch vụ, nhân sự và hồ sơ khách.
- Xác thực và phân quyền ở backend; các lựa chọn vai trò hiện tại chỉ là UI mẫu, không cấp quyền thật.
- API availability theo dịch vụ/thời lượng/nguồn lực và kiểm tra đồng thời ở server.
- CMS, xuất bản, media và SEO thật; các thay đổi hiện tại chỉ tác động bản preview.
- Lưu cấu hình vận hành, audit phía server, báo cáo và thông báo/Zalo OA có outbox.

Các cấu hình thời lượng, đặt trước và số liệu cảnh báo hiện tại chỉ là dữ liệu minh họa; không phải quyết định thay đổi business rules.
