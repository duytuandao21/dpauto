# Báo cáo mở rộng giao diện Cố vấn dịch vụ (`/co-van`)

Ngày rà soát: 11/11/2026.

## A. Khảo sát ban đầu

| Chức năng | Hiện trạng trước khi thực hiện | File liên quan đã khảo sát | Thiếu gì | Hướng xử lý |
| --- | --- | --- | --- | --- |
| Lịch hẹn | Có tổng quan theo ngày, danh sách, bộ lọc, tạo/sửa, chi tiết và thao tác trạng thái | `bookings-workspace.tsx`, `booking-detail.tsx`, `booking-actions.tsx` | Lối vào tiếp nhận và việc ưu tiên | Mở rộng màn hình hiện có |
| Khách hàng | Có danh sách và hồ sơ khách, phương tiện gắn với khách | `customers-workspace.tsx`, `booking-form.tsx` | Lịch sử phiếu, hồ sơ xe, tìm theo mã | Mở rộng tìm kiếm và hồ sơ |
| Tiếp nhận xe | Có trạng thái “đã đến” | `booking-actions.tsx`, `booking-provider.tsx` | Biên bản tiếp nhận | Thêm form kiểm tra xe, ODO, yêu cầu, ảnh và tạo phiếu |
| Phiếu dịch vụ | Chưa có luồng riêng sau tiếp nhận | Các route `/co-van`, `booking-detail.tsx` | Danh sách, chi tiết, lọc, lịch sử | Thêm route và dữ liệu phiếu tách khỏi lịch |
| Báo giá | Chưa có bảng dịch vụ/phụ tùng và biểu mẫu in | Các route `/co-van`, kiểu dữ liệu booking | Hạng mục, tính tiền, duyệt, bản in | Thêm UI báo giá theo phiếu |
| Thi công/nghiệm thu | Chưa có nơi theo dõi và bàn giao sau báo giá | Các route `/co-van`, shell admin | Phân công, tiến độ, checklist, kết quả | Thêm tab trong chi tiết phiếu và bản in |
| Thiết kế | Đã có shell, token sáng/tối, card, form, status, điều hướng mobile | `admin-shell.tsx`, `admin.css`, `primitives.tsx` | Bố cục các nghiệp vụ mới | Tái sử dụng mẫu và token hiện có |

Tham khảo luồng nghiệp vụ được ghi trong [khảo sát CRM hiện tại](../../research/KHAO-SAT-CRM-DPAUTO.md). Phạm vi triển khai là frontend của vai trò cố vấn dịch vụ.

## B. Những gì đã thực hiện

- Tổng quan: thêm danh sách việc cần xử lý theo mức ưu tiên, liên kết đến lịch, tiếp nhận, báo giá, thi công và nghiệm thu; có đường tắt hôm nay/ngày mai/tuần này ở trang lịch.
- Tiếp nhận: kiểm tra điều kiện từ lịch đã xác nhận/đã đến, ghi nhận tình trạng xe, ODO, checklist vận hành, yêu cầu của khách, ghi chú và ảnh; lưu nháp trong phiên; cảnh báo khi rời form có thay đổi.
- Xe dịch vụ: danh sách phiếu có tìm kiếm theo khách, số điện thoại, biển số, mã lịch, mã phiếu/báo giá; lọc giai đoạn, cố vấn và khoảng ngày; chi tiết theo tab.
- Báo giá: tách dịch vụ/phụ tùng, quản lý hạng mục và số lượng, tính tổng với chiết khấu/VAT, theo dõi trạng thái; khóa chỉnh sửa khi phiếu đã chuyển giai đoạn; in hoặc lưu PDF bằng trình duyệt.
- Thi công và nghiệm thu: phân công, hạn hoàn thành, tiến độ, checklist, nhật ký, đánh giá kết quả và bản in biên bản.
- Hồ sơ khách/xe: liên kết lịch hẹn, phiếu, phụ tùng đã thay và thông tin liên hệ. Có thao tác gọi, sao chép số điện thoại, mở Zalo và mẫu nội dung liên hệ.
- Điều hướng: thêm mục Xe dịch vụ; giữ thanh điều hướng mobile gọn bốn mục, trang tài khoản vẫn truy cập từ avatar. Các route mới nằm trong shell `/co-van` hiện hữu.
- Bỏ các nhãn/chú thích về dữ liệu minh họa, bản xem trước và API khỏi giao diện người dùng trong phạm vi `/co-van`.

Luồng thao tác: lịch hẹn đã xác nhận → tiếp nhận xe → phiếu dịch vụ → báo giá → thi công → nghiệm thu/bàn giao. Dữ liệu mới hiện được giữ trên thiết bị bằng `localStorage`; nháp tiếp nhận dùng `sessionStorage`. Các thao tác in dựa trên hộp thoại in của trình duyệt.

## C. Danh sách file thay đổi

| File | Mục đích |
| --- | --- |
| `src/lib/advisor/types.ts`, `seed.ts` | Kiểu dữ liệu phiếu, báo giá, thi công, nghiệm thu và dữ liệu khởi tạo liên kết lịch |
| `src/components/advisor/advisor-provider.tsx` | Trạng thái và lưu phiếu dịch vụ trên thiết bị |
| `src/components/advisor/reception-page.tsx` | Form tiếp nhận, ảnh và kiểm tra dữ liệu |
| `src/components/advisor/orders-page.tsx`, `order-detail-page.tsx`, `order-common.tsx` | Danh sách, chi tiết, nhãn trạng thái, liên hệ và thông tin chung |
| `src/components/advisor/quote-editor.tsx`, `work-editor.tsx`, `acceptance-editor.tsx` | Ba bước xử lý sau tiếp nhận |
| `src/components/advisor/print-page.tsx` | Mẫu in báo giá và nghiệm thu |
| `src/components/advisor/overview-tasks.tsx`, `vehicle-profile.tsx` | Việc cần làm và hồ sơ xe |
| `src/styles/advisor.css` | Kiểu giao diện cục bộ, responsive và in, sử dụng token admin hiện có |
| `src/app/co-van/phieu-dich-vu/**`, `tiep-nhan/[id]/page.tsx`, `xe/[id]/page.tsx` | Các route mới cho phiếu, bản in, tiếp nhận và xe |
| `src/app/co-van/layout.tsx` | Nạp stylesheet cho phạm vi cố vấn |
| `src/components/admin/admin-shell.tsx` | Gắn provider, điều hướng và nhận diện route mới |
| `src/components/admin/booking-actions.tsx`, `booking-detail.tsx`, `bookings-workspace.tsx` | Liên kết lịch với tiếp nhận/phiếu, việc cần làm và lọc ngày |
| `src/components/admin/customers-workspace.tsx` | Hồ sơ khách, xe, lịch sử dịch vụ và tìm kiếm |
| `src/components/admin/booking-form.tsx`, `booking-provider.tsx`, `secondary-pages.tsx`, `primitives.tsx` | Điều chỉnh lời văn hiển thị và nhãn trạng thái lưu |
| `src/lib/booking/seed.ts`, `repository.ts`, `logic.ts` | Dữ liệu lịch khởi tạo, chuẩn hóa biển số cũ và lời văn lỗi |

Không thêm thư viện hay thay đổi route ngoài `/co-van`. Không sửa API, cơ sở dữ liệu hoặc cơ chế phân quyền.

## D. Kiểm tra

| Hạng mục | Kết quả |
| --- | --- |
| TypeScript `tsc --noEmit` | Đạt một lần |
| Build Next.js 16.4.3 | Đạt một lần trên bản sao cô lập; tất cả route `/co-van` mới được tạo |
| Lint | `package.json` không có lệnh lint; không chạy lint toàn dự án |
| Trình duyệt | Kiểm tra trực tiếp tổng quan desktop/mobile, danh sách phiếu mobile ở theme sáng/tối, tiếp nhận mobile, báo giá mobile, hồ sơ xe, mẫu in báo giá, thi công và nghiệm thu; lọc trạng thái từ 3 còn 1 phiếu đúng; tablet 820 px hiển thị không tràn ngang |
| Kiểm tra tĩnh cuối | Định dạng/parse các file vừa chỉnh sau build; không lặp lại build đã đạt theo quy tắc Minimal Testing |

Trình duyệt được kiểm tra trên bản chạy riêng ở cổng 4002, nên không can thiệp bản người dùng đang chạy ở cổng 4001. Ba điều chỉnh cuối (thu gọn bộ lọc nâng cao, màu nút xử lý phiếu và sao chép số trên kết nối LAN) được rà tĩnh sau build; chưa có vòng build/trình duyệt riêng cho ba điều chỉnh này.

Giới hạn hiện tại: chưa có kiểm thử tự động cho toàn bộ chuỗi thao tác, dữ liệu rỗng/dài và mọi trạng thái lỗi; chưa có xác nhận trực tiếp trên Safari/iPhone thật. Dữ liệu phiếu, báo giá và ảnh trên thiết bị không đồng bộ giữa cố vấn hoặc thiết bị; giới hạn dung lượng trình duyệt có thể ảnh hưởng khi lưu nhiều ảnh. Các thao tác xác nhận báo giá, hoàn thành và in hiện là trạng thái giao diện, chưa phải giao dịch nghiệp vụ tập trung.

## E. Nhu cầu API và cơ sở dữ liệu ở giai đoạn tiếp theo

| Chức năng | Đầu vào/đầu ra cần có | Quy tắc cần chốt |
| --- | --- | --- |
| Lịch và tiếp nhận | Mã lịch, khách, xe, giờ hẹn, trạng thái; trả về phiếu, thời điểm tiếp nhận | Vai trò nào được tiếp nhận; chống tạo hai phiếu từ một lịch; sửa lịch sau khi tiếp nhận |
| Hồ sơ khách/xe | Số điện thoại, biển số, mẫu xe, ODO, lịch sử; trả hồ sơ hợp nhất | Chuẩn hóa số điện thoại/biển số, chống trùng khách/xe, quyền xem dữ liệu cá nhân |
| Ảnh tiếp nhận | File, loại ảnh, người tải, thời gian; trả URL/metadata | Dung lượng/định dạng, lưu trữ, thời hạn giữ, quyền truy cập/xóa ảnh |
| Báo giá | Hạng mục, đơn giá, số lượng, chiết khấu, VAT, người duyệt; trả phiên bản và tổng tiền | Nguồn bảng giá, thuế, quyền sửa/duyệt, trạng thái chờ/đồng ý/từ chối, versioning |
| Phụ tùng | Mã phụ tùng, tồn kho, số lượng; trả tình trạng và giá | Thời điểm giữ/trừ kho, xuất kho, xử lý thiếu hàng, hoàn trả |
| Thi công | Kỹ thuật viên, checklist, hạn, tiến độ, nhật ký; trả lịch sử thay đổi | Ai được giao/cập nhật, điều kiện bắt đầu, thay đổi sau duyệt báo giá |
| Nghiệm thu/bàn giao | Hạng mục kiểm tra, kết quả, chữ ký/người nghiệm thu, thời gian; trả biên bản | Điều kiện đóng phiếu, xử lý chưa đạt, xác nhận của khách, mở lại phiếu |
| Thu tiền | Tiền cọc, số đã thu, phương thức, chứng từ; trả công nợ | Quyền ghi thu, hoàn tiền, tách từng lần thu, đối soát |
| Liên hệ khách | Kênh, mẫu tin, người gửi, thời điểm; trả trạng thái gửi | Đồng ý nhận tin, tích hợp Zalo/SMS, tránh gửi trùng, nhật ký liên hệ |
| In/PDF | Mã phiếu và phiên bản tài liệu; trả PDF hoặc mẫu in | Số chứng từ, mẫu pháp lý, chữ ký, dữ liệu công khai trên bản khách hàng |
| Đồng bộ và phân quyền | Tài khoản, vai trò, chi nhánh, quyền thao tác; trả dữ liệu theo phạm vi | Cố vấn/cửa hàng/admin được xem và sửa gì, xung đột cập nhật, audit log |

Trước khi kết nối API cần chốt trạng thái nghiệp vụ và hợp đồng dữ liệu với đặc tả tại `technical-documentation/API_SPEC.md`.
