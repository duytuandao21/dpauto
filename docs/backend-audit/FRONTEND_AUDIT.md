# Khảo sát frontend DPAuto

Ngày khảo sát: 11/11/2026. Phương pháp: đọc source, component con và sáu tài liệu kỹ thuật; không thao tác dữ liệu CRM cũ, không chạy browser, test hoặc build. Đây là kiểm kê tĩnh, không phải chứng nhận chạy đúng trên production.

## 1. Kết luận điều hành

- **47 route template** có `page.tsx`: public 11, cố vấn 15, điều hành 20, admin website 1. Trong đó có một route chuyển hướng và một placeholder. Không đếm slug cụ thể, layout, loading/error, sitemap hoặc alias redirect thành trang nghiệp vụ mới.
- **40 nhóm chức năng F01–F40**, bao gồm các hành động/modal con. Mỗi nhóm có dữ liệu và validation ở bảng dưới; không phải 40 endpoint hay 40 nút.
- Public đang hiển thị nội dung static; luồng đặt lịch gửi thành công chỉ mô phỏng. Cố vấn có lưu dữ liệu trên thiết bị; điều hành giữ state trong phiên. Chưa có nguồn dữ liệu nghiệp vụ dùng chung.
- Năm quy tắc booking trong yêu cầu audit mới là **đã xác nhận**: theo loại dịch vụ/tài nguyên; tạo PENDING; PENDING giữ chỗ ngay; không vượt năng lực; chống tranh chấp đồng thời. Những chi tiết thuật toán, thời lượng và tài nguyên vẫn **cần làm rõ**.
- Số API/bảng dự kiến và thứ tự triển khai: xem [kế hoạch](BACKEND_IMPLEMENTATION_PLAN.md). Toàn bộ hợp đồng/schema trong bộ báo cáo là **đề xuất**, chưa phải backend đã tồn tại.

## 2. Cấu trúc và trạng thái kỹ thuật

| Khu vực | Hiện trạng và bằng chứng |
|---|---|
| Framework | Next.js 16.4.3, React/React DOM 19.3.1, TypeScript; dependencies gồm motion, không có Nest/ORM/auth backend trong manifest khảo sát. [package.json:1](../../package.json#L1) |
| Router | App Router dưới src/app; public route group và 3 workspace nội bộ. [src/app/(public)/layout.tsx:1](../../src/app/(public)/layout.tsx#L1), [src/app/co-van/layout.tsx:1](../../src/app/co-van/layout.tsx#L1), [src/app/dieu-hanh/layout.tsx:1](../../src/app/dieu-hanh/layout.tsx#L1), [src/app/admin/layout.tsx:1](../../src/app/admin/layout.tsx#L1) |
| Public data | src/data/site-content.json được import bởi content.ts; có 10 dịch vụ marketing, 6 bài, 6 project trong snapshot hiện tại. [src/lib/content.ts:1](../../src/lib/content.ts#L1); số lượng đếm trực tiếp các mảng trong JSON, không phải số danh mục booking. |
| Component | sections/pages/layout/ui phục vụ public; admin + advisor phục vụ cố vấn; manager phục vụ điều hành; internal phục vụ placeholder. Các route ở mục 3 dẫn component nhập tương ứng. |
| State | React context/useState; repository localStorage cố vấn, store phiếu riêng, manager seed state. [src/components/admin/booking-provider.tsx:72](../../src/components/admin/booking-provider.tsx#L72), [src/components/advisor/advisor-provider.tsx:18](../../src/components/advisor/advisor-provider.tsx#L18), [src/components/manager/manager-provider.tsx:43](../../src/components/manager/manager-provider.tsx#L43) |
| API client | Luồng nghiệp vụ đọc được dùng adapter giả định/state, không gọi business HTTP API. Không tìm thấy route.ts/route.js, middleware/proxy hoặc client auth trong cây src được kiểm kê. Không kết luận về server bên ngoài repo. Fetch shader có thật, không phải API nghiệp vụ: [src/lib/shader-renderer.ts:142](../../src/lib/shader-renderer.ts#L142). |
| Auth/RBAC | Layout chỉ bọc shell; provider không có identity/record guard. robots noindex không là auth. [src/app/co-van/layout.tsx:14](../../src/app/co-van/layout.tsx#L14), [src/app/dieu-hanh/layout.tsx:15](../../src/app/dieu-hanh/layout.tsx#L15), [src/components/admin/booking-provider.tsx:146](../../src/components/admin/booking-provider.tsx#L146), [src/components/advisor/advisor-provider.tsx:79](../../src/components/advisor/advisor-provider.tsx#L79). |
| Runtime config | dev/start port4001 trong package; env example chỉ site URL, chưa có business API URL. Đây là thiếu cấu hình tích hợp, không phải khẳng định deploy đang lỗi. [package.json:1](../../package.json#L1), [.env.example:1](../../.env.example#L1) |
| Redirect | /quanly và đường dẫn cố vấn cũ có aliases; không phải khu quản lý thứ tư. [next.config.ts:1](../../next.config.ts#L1) |

## 3. Kiểm kê từng route

Mỗi hàng là một file page; link trỏ vị trí bắt đầu khai báo/import component. Chi tiết đọc/ghi của component dùng Fxx ở mục 4.

| Route | Nhóm | Bằng chứng |
|---|---|---|
| `/` | Public | [src/app/(public)/page.tsx:1](../../src/app/(public)/page.tsx#L1) |
| `/404` | Public | [src/app/(public)/404/page.tsx:1](../../src/app/(public)/404/page.tsx#L1) |
| `/about` | Public | [src/app/(public)/about/page.tsx:1](../../src/app/(public)/about/page.tsx#L1) |
| `/contact` | Public | [src/app/(public)/contact/page.tsx:1](../../src/app/(public)/contact/page.tsx#L1) |
| `/news` | Public | [src/app/(public)/news/page.tsx:1](../../src/app/(public)/news/page.tsx#L1) |
| `/news/[slug]` | Public | [src/app/(public)/news/[slug]/page.tsx:1](../../src/app/(public)/news/[slug]/page.tsx#L1) |
| `/our-work` | Public | [src/app/(public)/our-work/page.tsx:1](../../src/app/(public)/our-work/page.tsx#L1) |
| `/privacy` | Public | [src/app/(public)/privacy/page.tsx:1](../../src/app/(public)/privacy/page.tsx#L1) |
| `/services` | Public | [src/app/(public)/services/page.tsx:1](../../src/app/(public)/services/page.tsx#L1) |
| `/services/[slug]` | Public | [src/app/(public)/services/[slug]/page.tsx:1](../../src/app/(public)/services/[slug]/page.tsx#L1) |
| `/terms` | Public | [src/app/(public)/terms/page.tsx:1](../../src/app/(public)/terms/page.tsx#L1) |
| `/admin` | Placeholder website | [src/app/admin/page.tsx:1](../../src/app/admin/page.tsx#L1) |
| `/co-van` | Cố vấn | [src/app/co-van/page.tsx:1](../../src/app/co-van/page.tsx#L1) |
| `/co-van/khach-hang` | Cố vấn | [src/app/co-van/khach-hang/page.tsx:1](../../src/app/co-van/khach-hang/page.tsx#L1) |
| `/co-van/khach-hang/[id]` | Cố vấn | [src/app/co-van/khach-hang/[id]/page.tsx:1](../../src/app/co-van/khach-hang/[id]/page.tsx#L1) |
| `/co-van/lich-hen` | Cố vấn | [src/app/co-van/lich-hen/page.tsx:1](../../src/app/co-van/lich-hen/page.tsx#L1) |
| `/co-van/lich-hen/tao-moi` | Cố vấn | [src/app/co-van/lich-hen/tao-moi/page.tsx:1](../../src/app/co-van/lich-hen/tao-moi/page.tsx#L1) |
| `/co-van/lich-hen/[id]` | Cố vấn | [src/app/co-van/lich-hen/[id]/page.tsx:1](../../src/app/co-van/lich-hen/[id]/page.tsx#L1) |
| `/co-van/phieu-dich-vu` | Cố vấn | [src/app/co-van/phieu-dich-vu/page.tsx:1](../../src/app/co-van/phieu-dich-vu/page.tsx#L1) |
| `/co-van/phieu-dich-vu/[id]` | Cố vấn | [src/app/co-van/phieu-dich-vu/[id]/page.tsx:1](../../src/app/co-van/phieu-dich-vu/[id]/page.tsx#L1) |
| `/co-van/phieu-dich-vu/[id]/in-bao-gia` | Cố vấn | [src/app/co-van/phieu-dich-vu/[id]/in-bao-gia/page.tsx:1](../../src/app/co-van/phieu-dich-vu/[id]/in-bao-gia/page.tsx#L1) |
| `/co-van/phieu-dich-vu/[id]/in-nghiem-thu` | Cố vấn | [src/app/co-van/phieu-dich-vu/[id]/in-nghiem-thu/page.tsx:1](../../src/app/co-van/phieu-dich-vu/[id]/in-nghiem-thu/page.tsx#L1) |
| `/co-van/tai-khoan` | Cố vấn | [src/app/co-van/tai-khoan/page.tsx:1](../../src/app/co-van/tai-khoan/page.tsx#L1) |
| `/co-van/tiep-nhan/[id]` | Cố vấn | [src/app/co-van/tiep-nhan/[id]/page.tsx:1](../../src/app/co-van/tiep-nhan/[id]/page.tsx#L1) |
| `/co-van/tuy-chon` | Cố vấn | [src/app/co-van/tuy-chon/page.tsx:1](../../src/app/co-van/tuy-chon/page.tsx#L1) |
| `/co-van/website` | Cố vấn | [src/app/co-van/website/page.tsx:1](../../src/app/co-van/website/page.tsx#L1) |
| `/co-van/xe/[id]` | Cố vấn | [src/app/co-van/xe/[id]/page.tsx:1](../../src/app/co-van/xe/[id]/page.tsx#L1) |
| `/dieu-hanh` | Điều hành | [src/app/dieu-hanh/page.tsx:1](../../src/app/dieu-hanh/page.tsx#L1) |
| `/dieu-hanh/bao-cao` | Điều hành | [src/app/dieu-hanh/bao-cao/page.tsx:1](../../src/app/dieu-hanh/bao-cao/page.tsx#L1) |
| `/dieu-hanh/bao-gia` | Điều hành | [src/app/dieu-hanh/bao-gia/page.tsx:1](../../src/app/dieu-hanh/bao-gia/page.tsx#L1) |
| `/dieu-hanh/canh-bao` | Điều hành | [src/app/dieu-hanh/canh-bao/page.tsx:1](../../src/app/dieu-hanh/canh-bao/page.tsx#L1) |
| `/dieu-hanh/cau-hinh` | Điều hành | [src/app/dieu-hanh/cau-hinh/page.tsx:1](../../src/app/dieu-hanh/cau-hinh/page.tsx#L1) |
| `/dieu-hanh/dich-vu` | Điều hành | [src/app/dieu-hanh/dich-vu/page.tsx:1](../../src/app/dieu-hanh/dich-vu/page.tsx#L1) |
| `/dieu-hanh/dieu-phoi` | Điều hành | [src/app/dieu-hanh/dieu-phoi/page.tsx:1](../../src/app/dieu-hanh/dieu-phoi/page.tsx#L1) |
| `/dieu-hanh/khach-hang` | Điều hành | [src/app/dieu-hanh/khach-hang/page.tsx:1](../../src/app/dieu-hanh/khach-hang/page.tsx#L1) |
| `/dieu-hanh/kho` | Điều hành | [src/app/dieu-hanh/kho/page.tsx:1](../../src/app/dieu-hanh/kho/page.tsx#L1) |
| `/dieu-hanh/lich-hen` | Điều hành | [src/app/dieu-hanh/lich-hen/page.tsx:1](../../src/app/dieu-hanh/lich-hen/page.tsx#L1) |
| `/dieu-hanh/nang-luc` | Điều hành | [src/app/dieu-hanh/nang-luc/page.tsx:1](../../src/app/dieu-hanh/nang-luc/page.tsx#L1) |
| `/dieu-hanh/nhan-su` | Điều hành | [src/app/dieu-hanh/nhan-su/page.tsx:1](../../src/app/dieu-hanh/nhan-su/page.tsx#L1) |
| `/dieu-hanh/nhat-ky` | Điều hành | [src/app/dieu-hanh/nhat-ky/page.tsx:1](../../src/app/dieu-hanh/nhat-ky/page.tsx#L1) |
| `/dieu-hanh/phieu-dich-vu` | Điều hành | [src/app/dieu-hanh/phieu-dich-vu/page.tsx:1](../../src/app/dieu-hanh/phieu-dich-vu/page.tsx#L1) |
| `/dieu-hanh/tai-chinh` | Điều hành | [src/app/dieu-hanh/tai-chinh/page.tsx:1](../../src/app/dieu-hanh/tai-chinh/page.tsx#L1) |
| `/dieu-hanh/thong-bao` | Điều hành | [src/app/dieu-hanh/thong-bao/page.tsx:1](../../src/app/dieu-hanh/thong-bao/page.tsx#L1) |
| `/dieu-hanh/website/bai-viet` | Điều hành | [src/app/dieu-hanh/website/bai-viet/page.tsx:1](../../src/app/dieu-hanh/website/bai-viet/page.tsx#L1) |
| `/dieu-hanh/website/hinh-anh` | Điều hành | [src/app/dieu-hanh/website/hinh-anh/page.tsx:1](../../src/app/dieu-hanh/website/hinh-anh/page.tsx#L1) |
| `/dieu-hanh/website/noi-dung` | Điều hành | [src/app/dieu-hanh/website/noi-dung/page.tsx:1](../../src/app/dieu-hanh/website/noi-dung/page.tsx#L1) |
| `/dieu-hanh/website/seo` | Điều hành | [src/app/dieu-hanh/website/seo/page.tsx:1](../../src/app/dieu-hanh/website/seo/page.tsx#L1) |

/404 là trang lỗi chủ động. /co-van/website chỉ redirect. /admin chưa có quản trị CMS thực: [src/app/co-van/website/page.tsx:3](../../src/app/co-van/website/page.tsx#L3), [src/app/admin/page.tsx:3](../../src/app/admin/page.tsx#L3). Sitemap là metadata endpoint ở [src/app/sitemap.ts:1](../../src/app/sitemap.ts#L1); không tạo API sitemap riêng.

## 4. Phân tích 40 nhóm chức năng

Ký hiệu: * bắt buộc theo validation UI hiện tại; các validation này cần server thực hiện lại, không tự trở thành chính sách đã duyệt. Cột “backend” mô tả nhu cầu, không nói đã triển khai. Ánh xạ endpoint/table cụ thể nằm trong [FEATURE_API_MAPPING](FEATURE_API_MAPPING.md).

| ID / tên và route | Thao tác / dữ liệu hiển thị | Nhập / validation hiện tại | Backend / khoảng trống | Vị trí |
|---|---|---|---|---|
| F01 — Nội dung trang chủ, about, contact, pháp lý<br>`/; /about; /contact; /privacy; /terms` | static JSON và nội dung trực tiếp; link gọi/maps/email; không có form liên hệ gửi backend | không nhập; đọc nội dung/giờ/địa chỉ | CMS công khai khi được duyệt; chưa cần API liên hệ | [src/lib/content.ts:1](../../src/lib/content.ts#L1) |
| F02 — Dịch vụ public<br>`/services; /services/[slug]` | list/detail từ JSON; slug tĩnh | slug bắt buộc tồn tại; CTA mở đặt lịch/liên hệ | danh mục bookable phải ánh xạ dịch vụ marketing | [src/app/(public)/services/[slug]/page.tsx:6](../../src/app/(public)/services/[slug]/page.tsx#L6) |
| F03 — Tin tức public<br>`/news; /news/[slug]` | bài nổi bật, list, nội dung/ảnh/ngày | slug tồn tại; không có bình luận/đăng bài public | chỉ bài published; rich HTML cần sanitize nếu chuyển CMS | [src/app/(public)/news/[slug]/page.tsx:10](../../src/app/(public)/news/[slug]/page.tsx#L10) |
| F04 — Công trình và ảnh trước/sau<br>`/our-work` | 6 project từ JSON, kéo so sánh ảnh | chỉ thao tác hình ảnh; không ghi dữ liệu | giữ static trong MVP; không sinh CRUD project chưa có UI | [src/app/(public)/our-work/page.tsx:1](../../src/app/(public)/our-work/page.tsx#L1) |
| F05 — Phụ kiện, thương hiệu, đánh giá, FAQ<br>`/` | phụ kiện giả định; thẻ dẫn /contact; FAQ mở/đóng | không giỏ hàng, thanh toán hoặc tải review Google trực tiếp | không thêm API bán hàng/Google review thiếu cơ sở | [src/components/sections/accessories.tsx:44](../../src/components/sections/accessories.tsx#L44) |
| F06 — Popup thông tin khách và xe<br>`CTA đặt lịch toàn public` | name/phone bắt buộc; plate/vehicle tùy chọn; validate FE | tên min2 max100; phone max24 regex VN; plate20/model100 | thêm DTO chuẩn, consent và server validation; khách không đăng nhập | [src/components/public-booking/booking-steps.tsx:27](../../src/components/public-booking/booking-steps.tsx#L27) |
| F07 — Chọn nhiều dịch vụ<br>`popup bước dịch vụ` | 7 ID public + durationLabel, checkbox | ít nhất 1 active ID, loại trùng; duration hiện là chuỗi | catalog/version/resource requirement định lượng | [src/lib/public-booking/mock.ts:35](../../src/lib/public-booking/mock.ts#L35) |
| F08 — Lịch và availability<br>`popup bước ngày/giờ` | 60 ngày; full/limited/unavailable giả định; retry/abort | ngày trong range, chọn time còn dùng được | server giờ trạm/lead/maxadvance/resources; không dùng modulo ngày | [src/components/public-booking/booking-schedule.tsx:131](../../src/components/public-booking/booking-schedule.tsx#L131) |
| F09 — Gửi và thành công đặt lịch<br>`popup xác nhận` | note max1000; submit bằng timeout; thành công minh họa | validate đủ bước, disable gửi; không tạo booking thật | POST nguyên tử PENDING+giữ chỗ+idempotency+event+consent | [src/components/public-booking/booking-dialog.tsx:192](../../src/components/public-booking/booking-dialog.tsx#L192) |
| F10 — Tổng quan cố vấn<br>`/co-van` | lịch hôm nay, KPI, việc báo giá/thi công/nghiệm thu | không nhập; bấm KPI mở danh sách | scope current advisor; aggregates backend, ngày trạm | [src/components/admin/bookings-workspace.tsx:101](../../src/components/admin/bookings-workspace.tsx#L101) |
| F11 — Danh sách và chi tiết lịch cố vấn<br>`/co-van/lich-hen; /co-van/lich-hen/[id]` | lọc/tìm, card, chi tiết, event; dữ liệu repository | query/date/status và ID; query không phải quyền | list phân trang scoped + detail/actions/events | [src/components/admin/booking-detail.tsx:16](../../src/components/admin/booking-detail.tsx#L16) |
| F12 — Tạo/sửa lịch cố vấn<br>`/co-van/lich-hen/tao-moi; chi tiết/sửa` | khách cũ/mới, xe, dịch vụ, ngày/giờ, cố vấn, nguồn, notes | tên>=2, phone, model,dịch vụ,date,time,advisor*; plate/notes optional; cảnh báo vẫn cho vượt tải | backend tự actor/owner, cấm override; consent nhân viên cần chốt | [src/components/admin/booking-form.tsx:121](../../src/components/admin/booking-form.tsx#L121) |
| F13 — Xác nhận, hủy, không đến<br>`chi tiết/card cố vấn` | dialog xác nhận; no-show theo giờ, không có field lý do | state machine FE; complete UI kiểm tra order.done nhưng provider chỉ status | server reason/threshold/scope/version; không PATCH status tùy ý | [src/components/admin/booking-actions.tsx:22](../../src/components/admin/booking-actions.tsx#L22) |
| F14 — Đổi giờ cố vấn<br>`chi tiết lịch` | dialog ngày giờ, xác nhận old/new | ngày>=today, HH:mm; không lý do/customerAgreed/capacity server | đổi reservations nguyên tử, thêm lý do và đồng ý | [src/components/admin/booking-actions.tsx:102](../../src/components/admin/booking-actions.tsx#L102) |
| F15 — Khách và hồ sơ xe cố vấn<br>`/co-van/khach-hang; /[id]; /co-van/xe/[id]` | tìm danh sách, xe, lịch hẹn vs lịch sử phục vụ | ID và query; không CRUD độc lập | scope từ assignment; không lấy toàn bộ customers về client | [src/components/admin/customers-workspace.tsx:134](../../src/components/admin/customers-workspace.tsx#L134) |
| F16 — Tiếp nhận và nháp<br>`/co-van/tiep-nhan/[id]` | ODO/request*, tình trạng 5 phần, checks, note, ảnh; sessionStorage draft | ODO số nguyên>=0, request nonempty; confirmed/arrived; tối đa6 ảnh, serialize<=2MB | arrive+visit một transaction; validate bytes/MIME/quyền; draft có thể local | [src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) |
| F17 — Danh sách/chi tiết phiếu<br>`/co-van/phieu-dich-vu; /[id]` | search/filter; tab tiếp nhận/báo giá/work/acceptance/history | ID, filter; dữ liệu advisor store | visit là gốc; CRM chi tiết giai đoạn mở rộng | [src/components/advisor/order-detail-page.tsx:32](../../src/components/advisor/order-detail-page.tsx#L32) |
| F18 — Soạn báo giá và quyết định khách<br>`tab báo giá` | service/part/manual lines; qty,price,unit,discount,VAT,note; draft/waiting/confirmed/rejected | ít nhất1 dòng; name/unit*, qty>0,price>=0,%0..100; confirmed khóa sửa | revision immutable, Decimal tính server; decision ghi bằng chứng; không suy ra thanh toán | [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) |
| F19 — Thi công và nhật ký<br>`tab thi công` | KTV text,dueAt,progress,checklist,note,log | start cần quote confirmed+KTV+dueAt; finish100%+allchecks; log nonempty | KTV dùng staffID; optimistic version; mốc nội bộ khác public progress | [src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) |
| F20 — Nghiệm thu và chờ bàn giao<br>`tab nghiệm thu` | inspector,result,checks,note; hoàn tất rồi khóa | stage acceptance,100%,checks không rỗng/allpassed,inspector*,không thiếu part theo stock snapshot | nghiệm thu done chưa chứng minh bàn giao; tồn ảnh chụp không phải xuất kho | [src/components/advisor/acceptance-editor.tsx:20](../../src/components/advisor/acceptance-editor.tsx#L20) |
| F21 — In báo giá/biên bản<br>`/co-van/phieu-dich-vu/[id]/in-bao-gia; /in-nghiem-thu` | bản in từ order, browser print | chỉ ID; không nhập | tải revision theo quyền; không cần PDF service trong MVP | [src/components/advisor/print-page.tsx:11](../../src/components/advisor/print-page.tsx#L11) |
| F22 — Tài khoản và tùy chọn<br>`/co-van/tai-khoan; /tuy-chon` | profile cố định, thông báo pending, theme local | theme light/dark; không có đổi mật khẩu/logout thật | auth/me; theme có thể giữ local; không dựng API resetpassword không có cơ sở | [src/components/admin/secondary-pages.tsx:8](../../src/components/admin/secondary-pages.tsx#L8) |
| F23 — Dashboard/báo cáo quản lý<br>`/dieu-hanh; /bao-cao` | KPI lịch/ops, chart, kỳ1/7/30, export CSV local | date/range; backend range/sort whitelist | định nghĩa mẫu số, ngày theo booking/visit/payment; CSV scoped/chống formula injection | [src/components/manager/dashboard.tsx:20](../../src/components/manager/dashboard.tsx#L20) |
| F24 — Lịch quản lý và drawer hành động<br>`/dieu-hanh/lich-hen` | ngày/tuần/range, search/status/service/advisor, pagination6; confirm/resched/cancel | reason*, customerAgreed cho confirm/đổi, date/hours/holiday/groupcapacity | dùng cùng Booking API với cố vấn, backend authority | [src/components/manager/booking-list.tsx:106](../../src/components/manager/booking-list.tsx#L106) |
| F25 — Phân/chuyển cố vấn<br>`drawer lịch và phiếu` | chọn staff, lý do; có chặn inactive/leave | advisor ID hợp lệ, reason*, chống giữ owner cũ | 1 owner hiện hành, history+thu hồi quyền cùng transaction | [src/components/manager/order-drawer.tsx:46](../../src/components/manager/order-drawer.tsx#L46) |
| F26 — Năng lực phục vụ<br>`/dieu-hanh/nang-luc` | ngày/group/total/reserved, init ngày, chỉnh phút, đóng/mở/nghỉ | total integer0..1440 + reason; giữ lịch cũ khi giảm thấp | phút tổng trong startwindow chưa đủ chứng minh khả năng thực thi liên tục | [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| F27 — Danh mục dịch vụ quản lý<br>`/dieu-hanh/dich-vu` | search/active, modal thêm/sửa nhóm/thời lượng/trạng thái | name*, duration integer15..1440; group chọn từ danh mục trong form, save không kiểm tra group riêng | catalog canonical + pool mapping/version không có trong form | [src/components/manager/catalog-pages.tsx:22](../../src/components/manager/catalog-pages.tsx#L22) |
| F28 — Nhân sự quản lý<br>`/dieu-hanh/nhan-su` | search/role, modal profile/active, workload | name*, phone0+9số,email*; role manager/advisor/technician | job role KTV không mặc nhiên role đăng nhập; offboard cần chuyển lịch | [src/components/manager/catalog-pages.tsx:277](../../src/components/manager/catalog-pages.tsx#L277) |
| F29 — Ca làm và nghỉ<br>`nhân sự / phần ca làm` | lọc ngày/role, thêm/sửa present/scheduled/leave | staff,date,start<end,note*; chặn ca không nghỉ bị chồng | cần duyệt cách ca làm ảnh hưởng pool thực; không chỉ cấm giao staff | [src/components/manager/staff-schedule.tsx:22](../../src/components/manager/staff-schedule.tsx#L22), [type:54](../../src/lib/manager/operations.ts#L54) |
| F30 — Khách/xe toàn trạm<br>`/dieu-hanh/khach-hang` | 2 tab, tìm kiếm, paginate6, drawer lịch và phiếu | query/ID; read-only | flattened customer+vehicle cần chuẩn hóa many-to-many; không auto-merge phone | [src/components/manager/customers-page.tsx:24](../../src/components/manager/customers-page.tsx#L24) |
| F31 — Điều phối công việc<br>`/dieu-hanh/dieu-phoi` | board booking +5stage, date/staff/urgency filters, drawer | chỉ điều phối assignment; không drag-drop backend | read model nối booking+visit; public progress không map máy móc stage | [src/components/manager/operations-page.tsx:31](../../src/components/manager/operations-page.tsx#L31) |
| F32 — Theo dõi phiếu và báo giá quản lý<br>`/dieu-hanh/phieu-dich-vu; /bao-gia` | list paginate8, stage/quote/date/staff/changed filters; drawer5tabs | đọc/assign qua F25; quote chưa editor manager | dùng chung visit/quote canonical; timestamps cho quote changed | [src/components/manager/operations-page.tsx:31](../../src/components/manager/operations-page.tsx#L31) |
| F33 — Kho và yêu cầu phụ tùng<br>`/dieu-hanh/kho` | tồn/cảnh báo, movement, cần xuất/đã xuất/còn thiếu | search/low filter; không form nhập/xuất kho | đề xuất chỉ API đọc cho UI hiện có; mutation kho là phase riêng | [src/components/manager/resource-pages.tsx:208](../../src/components/manager/resource-pages.tsx#L208) |
| F34 — Tài chính tổng hợp<br>`/dieu-hanh/tai-chinh` | quote approved/deposit/collected/debt; date/staff/debtonly filters | read-only; không thu tiền hoặc gateway | không gọi tổng báo giá là doanh thu thực thu; nguồn ledger cần chốt | [src/components/manager/resource-pages.tsx:15](../../src/components/manager/resource-pages.tsx#L15) |
| F35 — Trung tâm cảnh báo<br>`/dieu-hanh/canh-bao; dashboard` | priority/typefilters, deep link; pending/late/full/overdue/stock | không tự sửa state hoặc no-show | threshold hiện trong selector; cần cấu hình và policy duyệt | [src/lib/manager/operations.ts:133](../../src/lib/manager/operations.ts#L133) |
| F36 — Cấu hình trạm<br>`/dieu-hanh/cau-hinh` | hotline/address/hours/lead/advance và flags | open<close, lead0..1440,advance1..365; phone validation | stationinfo canonical; không lưu secrets Zalo qua form chung | [src/components/manager/system-pages.tsx:17](../../src/components/manager/system-pages.tsx#L17) |
| F37 — Thông báo và nhật ký<br>`/dieu-hanh/thong-bao; /nhat-ky` | events, markread, hàng đợi Zalo disconnected; search/pagination audit | đánh dấu đọc; nút thử lại không gửi Zalo thật | notification recipient/read state; audit actor/time thực; OA ngoàiMVP | [src/components/manager/system-pages.tsx:184](../../src/components/manager/system-pages.tsx#L184) |
| F38 — CMS nội dung/bài/ảnh/SEO<br>`/dieu-hanh/website/*` | search/edit/preview/publish; thêm bài; media sửa mô tả | title<=120,desc<=160,body<=5000 đều*; media không có upload mới | 4 kind cùngContentItem chưa modelCMS đầy đủ, không đổi JSON public; roleCMS cầnchốt | [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| F39 — Admin website và route cũ<br>`/admin; /co-van/website; /quanly/*` | admin placeholder; advisorwebsite redirect; aliases | không input/database | chưa có admin CMS thực; route không phải permission | [src/app/admin/page.tsx:1](../../src/app/admin/page.tsx#L1) |
| F40 — Auth, tra cứu an toàn, waitlist và vận hành backend còn thiếu<br>`toàn bộ khu nội bộ; customer portal chưa có route` | tài liệu yêu cầu auth/RBAC/OTP/outbox, không hiện thực bởi local UI | scope/consent/challenge/session/retention cần server | đây là yêu cầu tài liệu/đề xuất kỹ thuật, không ghi đã có UI | [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |

## 5. Loading, empty, error, success theo luồng

| Nhóm | Hiện có trong source | Khoảng trống khi nối API |
|---|---|---|
| Public nội dung F01–05 | render static, slug sai notFound; không có fetch/loading/error HTTP của CMS. [src/app/(public)/news/[slug]/page.tsx:10](../../src/app/(public)/news/[slug]/page.tsx#L10) | Khi CMS chạy cần trạng thái không tồn tại/unpublished, lỗi origin và cache invalidation; FAQ/slider không cần request. |
| Popup F06–09 | field errors; lịch loading skeleton, abort khi đổi lựa chọn, empty/closed, error/retry; submitting và success bằng timer. [src/components/public-booking/booking-schedule.tsx:157](../../src/components/public-booking/booking-schedule.tsx#L157), [src/components/public-booking/booking-dialog.tsx:192](../../src/components/public-booking/booking-dialog.tsx#L192) | Mất mạng sau commit: giữ idempotency key; 409 refresh slot nhưng giữ form; 429 cooldown; không báo thành công trước server commit. |
| Cố vấn F10–22 | AdminLoading khi provider chưa ready, NotFoundState/EmptyState, toast khi lưu local, confirm/dirty guard, validation editor. [src/components/admin/primitives.tsx:90](../../src/components/admin/primitives.tsx#L90), [src/components/admin/booking-provider.tsx:133](../../src/components/admin/booking-provider.tsx#L133), [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) | Chưa có 401/403/network/retry/version-conflict; lỗi localStorage không tương đương DB rollback. Khi mất quyền phải xóa dữ liệu chi tiết khỏi cache. |
| Điều hành F23–38 | table/cards, reset filter, pager, modal error, confirm, toast trong session. [src/components/manager/manager-ui.tsx:161](../../src/components/manager/manager-ui.tsx#L161), [src/components/manager/manager-provider.tsx:43](../../src/components/manager/manager-provider.tsx#L43) | Empty phải tách lỗi tải; disable mutation đang gửi; cập nhật sau commit và invalidate list/KPI; aggregate toàn bộ kết quả, không tính trên một page. |
| Placeholder F39 | chưa có workflow hoàn chỉnh. [src/app/admin/page.tsx:3](../../src/app/admin/page.tsx#L3) | Không suy ra tính năng hay quyền chỉ từ route. |
| Yêu cầu tài liệu F40 | chưa có màn đăng nhập/OTP/portal trong route inventory | Chưa được gắn nhãn “hoàn thiện”; yêu cầu auth tối thiểu trước khi mở nội bộ. |

## 6. Nguồn dữ liệu và rủi ro hợp nhất

| Nguồn | Lưu ở đâu | Tác động trực tiếp API/DB |
|---|---|---|
| Marketing services/articles | JSON, [src/lib/content.ts:1](../../src/lib/content.ts#L1) | slug marketing không phải ID dịch vụ booking; cần mapping do trạm duyệt. |
| Public booking | catalog + availability fixtures, [src/lib/public-booking/mock.ts:35](../../src/lib/public-booking/mock.ts#L35), [src/lib/public-booking/mock.ts:183](../../src/lib/public-booking/mock.ts#L183) | Không có bookingId thật, không tạo reservation/consent. |
| Advisor booking | `dpauto.booking-ui.v1`, [src/lib/booking/repository.ts:3](../../src/lib/booking/repository.ts#L3) | seed/local ID không tự import thành dữ liệu khách thật. Không sync giữa máy/nhân viên. |
| Advisor orders | `dpauto.advisor-ui.v1`, [src/components/advisor/advisor-provider.tsx:8](../../src/components/advisor/advisor-provider.tsx#L8) | Nhận xe ghi order rồi mới đổi booking ở store khác, không atomic (dòng67). |
| Reception draft | sessionStorage theo booking ID; ảnh dataURL, [src/components/advisor/reception-page.tsx:66](../../src/components/advisor/reception-page.tsx#L66) | Nháp không là phiếu chính thức; cần chính sách PII/ảnh và xóa sau submit/logout. |
| Manager | createManagerData/useState; theme localStorage, [src/components/manager/manager-provider.tsx:43](../../src/components/manager/manager-provider.tsx#L43) | Không đọc advisor store; thao tác điều hành không hiện ở cố vấn; canonical DB phải dùng chung. |
| Theme | advisor.theme.v2; manager.theme; internal shell theme | Lựa chọn giao diện không cần bảng nghiệp vụ riêng; đừng đồng bộ PII bằng localStorage. |

## 7. Các vấn đề ưu tiên trước tích hợp

1. **P0 / API+DB:** provider cố vấn cho chọn người khác, merge theo phone và vượt tải qua “Vẫn lưu lịch”: [src/components/admin/booking-provider.tsx:171](../../src/components/admin/booking-provider.tsx#L171), [src/components/admin/booking-form.tsx:134](../../src/components/admin/booking-form.tsx#L134). Đây là giới hạn prototype, không phải bằng chứng một backend production đang có lỗ hổng.
2. **P0 / API+DB:** manager giữ resource-minutes của pending nhưng chỉ tính trong cửa sổ bắt đầu, chưa phân bổ liên tục nhiều khung: [src/lib/manager/mock.ts:485](../../src/lib/manager/mock.ts#L485), [src/lib/manager/rules.ts:3](../../src/lib/manager/rules.ts#L3).
3. **P0 / API:** public dùng ngày trạm nhưng advisor dùng ngày browser và ghép datetime thiếu offset: [src/lib/public-booking/mock.ts:106](../../src/lib/public-booking/mock.ts#L106), [src/lib/booking/logic.ts:44](../../src/lib/booking/logic.ts#L44), [src/components/admin/booking-provider.tsx:192](../../src/components/admin/booking-provider.tsx#L192).
4. **P0 / API+DB:** booking COMPLETED, order.done và nghiệm thu chưa là một transaction bàn giao; [src/components/advisor/acceptance-editor.tsx:29](../../src/components/advisor/acceptance-editor.tsx#L29), [src/lib/booking/logic.ts:62](../../src/lib/booking/logic.ts#L62). Không đồng nhất hoàn thành với đã trả tiền.
5. **P1 / API+DB:** tiền dùng Number và snapshot tồn kho; cần quote revision, rounding, actual issue source trước khi ghi tài chính thật: [src/lib/advisor/seed.ts:146](../../src/lib/advisor/seed.ts#L146), [src/components/advisor/acceptance-editor.tsx:14](../../src/components/advisor/acceptance-editor.tsx#L14).
6. **P1 / API:** CMS local publish không cập nhật public JSON; nội dung HTML dùng dangerouslySetInnerHTML: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49), [src/components/sections/shared.tsx:85](../../src/components/sections/shared.tsx#L85). Nếu cho nhập nội dung từ CMS phải sanitize tại boundary phù hợp.

## 8. Các thao tác con không cần endpoint riêng

- Gọi điện, mở Zalo và sao chép thông tin dùng link/clipboard của thiết bị, không phải gửi Zalo OA từ server: [order-common.tsx:18](../../src/components/advisor/order-common.tsx#L18), [OrderPerson:45](../../src/components/advisor/order-common.tsx#L45). Nếu muốn lưu kết quả cuộc gọi, nhân viên ghi contact event riêng; không suy khách đã đồng ý chỉ vì bấm link.
- Nút in gọi browser print, không có PDF generation service: [print-page.tsx:40](../../src/components/advisor/print-page.tsx#L40). Dữ liệu in vẫn phải tải đúng revision và scope khi nối API.
- Đóng modal, hủy chỉnh sửa, reset filter, mở tab, đổi theme và cảnh báo rời form chưa lưu chỉ thay trạng thái giao diện; không ghi nghiệp vụ cho tới submit hợp lệ. Ví dụ: [booking-form.tsx:81](../../src/components/admin/booking-form.tsx#L81), [reception-page.tsx:88](../../src/components/advisor/reception-page.tsx#L88), [content-page.tsx:36](../../src/components/manager/content-page.tsx#L36).

## 9. Giới hạn và kết quả khảo sát

Đã đọc route, shell/provider, các form/editor/selector liên quan và tài liệu; không kiểm chứng API thực, không khảo sát dữ liệu DB/live CRM, không đo tải hay thiết bị thật trong nhiệm vụ này. Chưa có căn cứ khẳng định các API/bảng đề xuất đã tồn tại. Chỉ tạo bảy báo cáo trong thư mục này; không sửa source hoặc technical-documentation gốc.

