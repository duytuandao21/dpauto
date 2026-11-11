# Popup đặt lịch dịch vụ — bàn giao UI

## Phạm vi

- Mở từ nút **Đặt lịch hẹn** hiện có ở hero trang chủ, tại `http://localhost:4001/`.
- Ba bước: thông tin khách/xe → chọn nhiều dịch vụ → ngày, giờ, ghi chú và kiểm tra thông tin.
- Màn hình kết quả có nhãn minh họa, trạng thái chờ xác nhận và nút Hoàn tất.
- Giữ bản nháp trong bộ nhớ khi quay lại hoặc đóng rồi mở lại; Hoàn tất xóa bản nháp. Tải lại trang cũng xóa dữ liệu.
- Không gọi API đặt lịch, không lưu localStorage, không ghi vào quản lý và không giữ công suất thật.

## UI được tái sử dụng

- `Button`, `Icon`, Inter và Barlow Condensed hiện có.
- Các token `--brand-red`, `--brand-red-deep`, `--brand-red-soft`, `--surface`, `--raised`, `--background`, `--border-light`, `--muted-light`.
- Giữ nguyên hiệu ứng button có sẵn. Bổ sung props tùy chọn cho submit, disabled và sự kiện click; các chỗ dùng cũ giữ hành vi mặc định.
- CSS popup được giới hạn bằng tiền tố `pb-`; không chỉnh token, header, footer, routing hoặc admin.

## Tệp triển khai

- `src/components/public-booking/booking-dialog.tsx`: điểm mở, native dialog, trạng thái form, focus/scroll, kết quả mẫu.
- `src/components/public-booking/booking-steps.tsx`: thông tin khách, thẻ dịch vụ, tóm tắt.
- `src/components/public-booking/booking-schedule.tsx`: lịch tháng, khung giờ, loading, empty, error/retry.
- `src/components/public-booking/booking-dialog.css`: giao diện và responsive riêng cho popup.
- `src/lib/public-booking/mock.ts`: kiểu dữ liệu, danh mục và bộ lịch mẫu, kiểm tra thông tin đầu vào.
- `src/components/sections/hero.tsx`: thay nút chờ bằng điểm mở popup.
- `src/components/ui/button.tsx`: mở rộng props tùy chọn.
- `scripts/check-public-booking.cjs`: kiểm tra trình duyệt có thể chạy lại.

## Kiểm tra đã thực hiện

- TypeScript: `tsc --noEmit --incremental false` — đạt.
- Production build: `npm run build` — đạt, 35 trang được tạo.
- Không chạy lint vì dự án chưa cấu hình lint/script lint; không thêm dependency.
- Chrome: 390 × 844, 768 × 1000, 1440 × 1000. WebKit: 390 × 844.
- Đã xem ảnh chụp bước nhập, dịch vụ, lịch, tóm tắt và kết quả. Không có tràn ngang; thanh thao tác nằm trong viewport.
- Kiểm tra trường bắt buộc, số điện thoại sai/đúng, chọn nhiều dịch vụ, giữ dữ liệu khi quay lại, khung giờ đầy/nghỉ bị khóa, tất cả giờ đầy, lỗi tải và Thử lại.
- Kiểm tra summary, kết quả, reset sau Hoàn tất, focus trap, Escape, khôi phục focus và mở lại bản nháp.
- Kịch bản trình duyệt xác nhận không có mutation request hoặc thay đổi localStorage trong luồng đặt lịch mẫu.
- Kiểm tra bổ sung Chrome/WebKit với motion bật: loading, đổi ngày xóa giờ cũ, nút loading và viewport thấp 390 × 480 khi focus input.
- `prefers-reduced-motion` tắt hiệu ứng popup/chuyển bước; các bài kiểm tra chính chạy ở chế độ này.
- Không có page error trong kịch bản chính; không có console error trong kịch bản motion/mobile bổ sung.
- Chưa kiểm tra trên điện thoại vật lý hoặc bàn phím iOS thật. WebKit và viewport thấp chỉ là kiểm tra mô phỏng.

Kết quả tự động: `verification.json`; ảnh chụp nằm cùng thư mục.

Chạy lại với Playwright đã cài sẵn:

```powershell
$env:PLAYWRIGHT_MODULE = '<đường dẫn package Playwright đang có>'
$env:CHECK_ORIGIN = 'http://localhost:4001'
node scripts/check-public-booking.cjs
```

## Tích hợp sau

- Thay danh mục, thời lượng và availability fixtures bằng API, có kiểm tra lại khả năng phục vụ theo dịch vụ và công suất thực tế ở backend.
- Giới hạn 60 ngày, trạng thái ngày, khung giờ và thời lượng hiện tại chỉ là dữ liệu minh họa; không phải cấu hình nghiệp vụ đã chốt.
- API gửi yêu cầu cần validation phía server, chống trùng/idempotency, kiểm soát đồng thời và kết quả giữ chỗ có căn cứ từ backend.
- Chỉ thay thông báo minh họa thành thông báo thật sau khi nhận kết quả API. Chưa có database, OTP hoặc Zalo OA.
