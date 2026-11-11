# DPAuto — Giao diện quản lý lịch hẹn

Ngày thực hiện: 07/11/2026. Tham chiếu: `DPAuto_Codex_UI_QuanLy_Booking.md` và 5 ảnh người dùng gửi.

## 1. Khảo sát trước triển khai

- Next.js 16.4.3, App Router; React 19.3.1; TypeScript 5.9; npm/package-lock.
- CSS riêng, font Inter và Barlow Condensed có sẵn tại local; Motion 14.8.0; icon SVG dùng chung.
- Tái sử dụng font Inter có tiếng Việt, logo `/images/logo-dpauto.png`, màu đỏ `--brand-red: #e20000`, breakpoint 768/1200 và kiểu card, border, button của project. Bổ sung token riêng có namespace `adm-` cho nền tối/sáng và badge trạng thái; không cài thư viện mới.
- Đã xem trực tiếp trang chủ ở 390, 768, 1024, 1440 px; xem các trang dịch vụ, tin tức, liên hệ. Website công khai có header/footer marketing, hiệu ứng cuộn và ảnh nền lớn. Khu vận hành cần layout và cơ chế cuộn riêng.
- Chưa có route `/quanly`, kho dữ liệu booking hoặc API booking trong frontend. Form quản lý dùng kiểm tra dữ liệu TypeScript riêng; không thay đổi form công khai.
- Project có Node test runner; chưa có script lint/ESLint. Playwright có sẵn trong môi trường, không thêm dependency vào project.

## 2. Kết quả triển khai

| Route | Nội dung |
| --- | --- |
| `/quanly` | Tổng quan, KPI tính theo ngày đang chọn, dải ngày vuốt ngang, trạng thái nhanh, thao tác trên card |
| `/quanly/lich-hen` | Ngày/tuần, tìm tên/SĐT/biển số/mã lịch, lọc trạng thái/dịch vụ/cố vấn/nguồn, sắp xếp giờ và xóa lọc |
| `/quanly/lich-hen/tao-moi` | Chọn khách và xe có sẵn hoặc nhập mới; validation, cảnh báo trùng, lưu demo |
| `/quanly/lich-hen/[id]` | Chi tiết, ghi chú, gọi điện, timeline, các hành động đúng trạng thái; deep-link/refresh hoạt động |
| `/quanly/lich-hen/[id]?edit=1` | Sửa thông tin lịch chưa kết thúc |
| `/quanly/khach-hang` | Tìm kiếm/lọc hồ sơ, số xe và lịch hẹn tính từ cùng nguồn dữ liệu |
| `/quanly/khach-hang/[id]` | Xe, lịch liên quan, tạo lịch mới điền sẵn thông tin khách |
| `/quanly/cai-dat` | Giờ làm việc, ngày nghỉ, khung tiếp nhận, giới hạn xe, tùy chọn thông báo, khôi phục cấu hình, reset demo |
| `/quanly/website` | 7 nhóm quản lý nội dung có nhãn Sắp phát triển và phản hồi rõ khi bấm |
| `/quanly/them` | Quản lý website, Cài đặt, Thông báo, Xem website công khai |

Có chế độ sáng/tối, nhớ lựa chọn trên trình duyệt. Có skeleton, empty/not-found state, error boundary, toast, dialog xác nhận, cảnh báo thay đổi chưa lưu khi hủy form hoặc rời/tải lại tài liệu trình duyệt.

### Dữ liệu và trạng thái

- 18 lịch, 8 khách, 9 xe, 6 dịch vụ, 3 cố vấn; seed theo ngày hiện tại ± vài ngày.
- Model chung: Booking, Customer, Vehicle, Service, Advisor, BookingStatus, BookingEvent, CapacityConfig.
- Xác nhận → tiếp nhận → hoàn thành; hủy; không đến chỉ khi đã qua giờ xác nhận. Trạng thái kết thúc không có thao tác sửa/chuyển tiếp.
- Đổi lịch có log thời gian cũ/mới; danh sách, chi tiết, hồ sơ khách và KPI dùng chung store.
- Local repository và model tách khỏi màn hình; namespace dữ liệu `dpauto.booking-ui.v1`, theme `dpauto.admin.theme`.
- Có fallback tạo ID cho điện thoại truy cập qua HTTP/IP LAN, nơi `crypto.randomUUID` có thể không khả dụng.
- Lỗi đọc bộ nhớ dùng lại seed và thông báo rõ; lỗi ghi giữ dữ liệu trong phiên và không báo đã lưu thành công trên trình duyệt.

### Layout công khai

Các trang khách hàng chuyển nguyên nội dung vào route group `src/app/(public)/`. URL, metadata và thiết kế của các trang không đổi. Header/footer và SiteEffects nằm tại `(public)/layout.tsx`; `/quanly` dùng layout riêng. `sitemap.ts` vẫn ở root; khu quản lý có `noindex, nofollow`.

## 3. Responsive và ảnh kiểm tra

- Điện thoại: một cột, bottom navigation cố định, safe-area và khoảng đệm cuối trang; chi tiết thành trang riêng. Tổng quan giảm các điều khiển để danh sách xuất hiện sớm; bộ lọc đầy đủ ở trang Lịch hẹn.
- Tablet 768–1199: sidebar icon, danh sách–chi tiết hai cột, vùng chi tiết cuộn riêng; chọn card cập nhật URL.
- Desktop ≥1200: sidebar có nhãn và nút thu gọn, nội dung có giới hạn chiều rộng, panel chi tiết bên phải.
- Đã kiểm tra 360×800, 390×844, 768×1024, 1024×768, 1440×900; không tràn ngang. Cuộn tới cuối danh sách không bị bottom nav che card cuối.

Ảnh tiêu biểu:

- [Tổng quan mobile tối](booking/quanly-390-dark.png)
- [Lịch hẹn mobile sáng](booking/quanly-lich-hen-390-light.png)
- [Lịch hẹn tablet tối](booking/quanly-lich-hen-768-dark.png)
- [Lịch hẹn desktop sáng](booking/quanly-lich-hen-1440-light.png)
- [Khách hàng tablet hai cột](booking/quanly-khach-hang-768-dark.png)
- [Quản lý website mobile](booking/quanly-website-390-dark.png)
- [Quản lý website desktop](booking/quanly-website-1440-dark.png)

## 4. Kiểm thử thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `next typegen` và `npm run typecheck` | Đạt |
| `node --test tests/booking.test.mjs` | 4/4 đạt: seed/quan hệ/ngày, lifecycle, điều kiện không đến, validation |
| `npm test` | 7/8 đạt; test cũ đếm chính xác 82 mục ảnh thất bại vì thư mục hiện có 88 mục. Không thay đổi test ngoài phạm vi |
| Prettier cho file tạo/sửa | Đạt sau định dạng |
| Lint | Không có script hay cấu hình lint trong project; không cài thêm |
| `npm run build` | Đạt với Turbopack, tạo 35 trang tĩnh và các route động |
| Chromium + WebKit, mô phỏng cảm ứng | Đạt các luồng nghiệp vụ và điều hướng |
| Production Chromium smoke + WebKit workflows | Đạt; không có page error |
| Keyboard / recovery | Tab tới skip link; focus không vào điều khiển nền khi dialog mở; Escape hủy; validation focus trường lỗi; bộ nhớ hỏng phục hồi có feedback |
| Reduced motion | Các lượt browser chạy với `reducedMotion: reduce`; CSS tắt animation/transition trong admin |
| Website công khai | Smoke test `/`, `/services`, `/news`, `/about`, `/contact`, một dịch vụ, một bài viết và URL không tồn tại; header/footer đúng, không có shell admin |

Build chạy trên bản sao riêng, dùng cùng source và node_modules. Chỉ bản sao có `turbopack.root` để giải quyết junction thư viện; **không sửa next.config.ts chính**. Không ghi đè `.next` production đang phục vụ cổng 4001. Server kiểm tra production dùng cổng 4003 rồi đã tắt; preview dev cổng 4002 giữ nguyên.

WebKit ở chế độ dev có một cảnh báo truy cập endpoint `__nextjs_original-stack-frames` của công cụ debug Next. Báo cáo lưu riêng cảnh báo này; các luồng production WebKit không có cảnh báo/lỗi tương ứng. Đây là kiểm tra engine WebKit trên máy tính, chưa phải kiểm tra Safari trên iPhone thật.

Kết quả máy đọc được:

- [Browser và 30 tổ hợp route/kích thước](booking/browser-results.json)
- [Production smoke](booking/production-smoke.json)
- [Production WebKit workflows](booking/production-webkit.json)
- [Keyboard và recovery](booking/keyboard-recovery.json)

Chạy lại browser script bằng `node scripts/check-booking.cjs`; đặt `PLAYWRIGHT_MODULE` tới package Playwright có sẵn và `CHECK_ORIGIN` tới server cần kiểm tra. Có tùy chọn `CHECK_ENGINES=webkit`, `CHECK_WORKFLOW_ONLY=1`, `CHECK_REPORT_NAME=...` để kiểm tra có mục tiêu.

## 5. File tạo/sửa

### Routes quản lý mới

```text
src/app/quanly/layout.tsx
src/app/quanly/page.tsx
src/app/quanly/loading.tsx
src/app/quanly/error.tsx
src/app/quanly/lich-hen/page.tsx
src/app/quanly/lich-hen/tao-moi/page.tsx
src/app/quanly/lich-hen/[id]/page.tsx
src/app/quanly/khach-hang/page.tsx
src/app/quanly/khach-hang/[id]/page.tsx
src/app/quanly/cai-dat/page.tsx
src/app/quanly/website/page.tsx
src/app/quanly/them/page.tsx
```

### Component, model, style và kiểm thử mới

```text
src/components/admin/admin-shell.tsx
src/components/admin/admin-icon.tsx
src/components/admin/booking-provider.tsx
src/components/admin/bookings-workspace.tsx
src/components/admin/booking-detail.tsx
src/components/admin/booking-actions.tsx
src/components/admin/booking-form.tsx
src/components/admin/customers-workspace.tsx
src/components/admin/secondary-pages.tsx
src/components/admin/primitives.tsx
src/lib/booking/types.ts
src/lib/booking/seed.ts
src/lib/booking/logic.ts
src/lib/booking/repository.ts
src/styles/admin.css
tests/booking.test.mjs
scripts/check-booking.cjs
docs/qa/booking-implementation.md
docs/qa/booking/*.png
docs/qa/booking/*.json
```

### Tách layout

- Sửa `src/app/layout.tsx`, `src/app/not-found.tsx`.
- Tạo `src/app/(public)/layout.tsx`.
- Chuyển các file gốc `src/app/page.tsx`, `about/page.tsx`, `contact/page.tsx`, `news/page.tsx`, `news/[slug]/page.tsx`, `our-work/page.tsx`, `privacy/page.tsx`, `services/page.tsx`, `services/[slug]/page.tsx`, `terms/page.tsx`, `404/page.tsx`, `not-found.tsx` vào vị trí tương ứng dưới `src/app/(public)/`, giữ nội dung trang.

## 6. Giới hạn và API giai đoạn sau

Đây là frontend dùng dữ liệu minh họa, lưu trên trình duyệt từng máy. Không có backend, DB, endpoint, xác thực hay phân quyền mới. Cấu hình thông báo chỉ là tùy chọn demo; Zalo OA chưa kết nối. Các nhóm quản lý website chưa có editor/CMS/CRUD và luôn thông báo giai đoạn phát triển tiếp theo.

Giai đoạn sau có thể thêm adapter bất đồng bộ cho danh sách/chi tiết/tạo/sửa lịch, chuyển trạng thái, đổi lịch, timeline, khách/xe và cấu hình tiếp nhận. Các endpoint đề xuất: `GET/POST /bookings`, `GET/PATCH /bookings/:id`, `POST /bookings/:id/actions`, `POST /bookings/:id/reschedule`, `GET /customers`, `GET /customers/:id`, `GET/PATCH /booking-settings`. Bổ sung loading/error cho thao tác mạng trong provider; dùng lại model và màn hình hiện tại. Chưa triển khai những endpoint này.
