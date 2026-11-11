# Kết quả kiểm tra

Ngày kiểm tra: 30/10/2026.

## Đã đạt

- `npm run typecheck`: không có lỗi TypeScript.
- `npm test`: 4/4 kiểm tra đạt — dữ liệu trang, tài nguyên nội bộ, FAQ/ảnh so sánh và liên kết bài viết.
- `npm run build`: build production thành công; tạo đủ các trang tĩnh và route động từ dữ liệu.
- `npm run check:routes`: 25 URL của bản tham chiếu trả đúng nội dung/trạng thái; đường dẫn không tồn tại trả 404. Xem `routes.json`.
- Chrome: 29/29 mục kiểm tra đạt. Xem `browser-check.json`.
- Không ghi nhận lỗi JavaScript trong lượt kiểm tra Chrome.
- Hover thẻ dịch vụ chuyển đúng sang `rgb(255, 90, 31)` và mở rộng nhãn View Service.
- H1 tại 768px dùng 60px, không tràn ngang.

## Kiểm tra bằng Chrome

- Font Barlow Condensed/Inter.
- Menu Services desktop và điều hướng đến trang dịch vụ.
- FAQ hiển thị nguyên văn câu trả lời, mở đồng thời nhiều mục.
- Kéo ảnh trước–sau và điều khiển bằng bàn phím.
- Nút Next của carousel.
- Mở lightbox, đóng bằng Escape.
- Phát video gốc.
- Trang chủ không tràn ngang tại 320, 390, 768, 810, 1024 và 1440px.
- Menu mobile mở/đóng và chuyển đến About.
- Các trang desktop đại diện: Services, Ceramic Coating, Our Work, News, bài viết, About, Contact, Privacy.
- Hai hiệu ứng footer khởi tạo thành công bằng WebGL2.

Ảnh chụp desktop/mobile và một số trạng thái tương tác nằm cùng thư mục này.

## Giới hạn xác minh

Đây là kiểm tra các luồng và màn hình đại diện, không phải chứng nhận trùng tuyệt đối từng pixel trên mọi trình duyệt. Shader sử dụng fragment gốc và renderer WebGL riêng; heightmap logo, thời điểm animation và cách render có thể khác Framer. Thông tin liên hệ, địa chỉ, nội dung tin và đánh giá hiện giữ nguyên từ website mẫu.

## Chạy lại

Chạy `npm run dev` trước. `npm run check:routes` kiểm tra HTTP. `npm run check:browser` cần Chrome có remote debugging tại `127.0.0.1:9229`; script dùng tab `http://localhost:3000` trong cửa sổ Chrome đó và lưu kết quả vào đây.
