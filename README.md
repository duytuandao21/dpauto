# HyperAuto Care — Next.js

Bản dựng lại giao diện [HyperAuto Care](https://hyperautocare.framer.website/) bằng **Next.js App Router, TypeScript, React và Motion** trong dự án DPAuto.

## Chạy local

Yêu cầu Node.js 20.9 trở lên.

```bash
npm install
npm run dev
```

Mở **http://localhost:3000**. Trên Windows PowerShell có chặn script, dùng `npm.cmd` thay cho `npm`.

```bash
npm run typecheck
npm test
npm run build
npm start
```

Khi dev server đang chạy, kiểm tra các route bằng `npm run check:routes`.

Kết quả kiểm tra và ảnh đối chiếu: [docs/qa/verification.md](docs/qa/verification.md).

## Khu vực nội bộ

- `/co-van`: quản lý lịch hẹn dành cho cố vấn dịch vụ; có lịch hẹn, khách hàng, `/co-van/tai-khoan` và `/co-van/tuy-chon`.
- `/dieu-hanh`: trang chờ để phát triển khu vực Quản lý cửa hàng.
- `/admin`: trang chờ để phát triển khu vực Admin quản trị website.
- `/quanly/...` chuyển hướng sang đường dẫn mới, giữ nguyên query. Hai đường dẫn cũ `/quanly/them` và `/quanly/cai-dat` lần lượt chuyển sang `/co-van/tai-khoan` và `/co-van/tuy-chon`.

Các khu vực hiện chưa tích hợp đăng nhập hoặc phân quyền. Dữ liệu đặt lịch vẫn là dữ liệu mẫu trên trình duyệt; việc đổi URL không thay đổi khóa lưu trữ hiện có.

## Cây thư mục

```text
public/
  images/              82 ảnh/SVG gốc
  videos/              3 video gốc
  fonts/               9 file WOFF2 gốc
  effects/             GLSL và ảnh fallback của hiệu ứng footer
src/
  app/                 Next.js App Router, metadata và các trang
    services/[slug]/   10 trang chi tiết dịch vụ
    news/[slug]/       6 bài viết
    our-work/          6 dự án trước–sau
    about/
    contact/
    privacy/
    terms/
    404/
  components/
    layout/            Header, footer, giờ mở cửa
    ui/                Button, ảnh tối ưu, icon
    motion/            Reveal, parallax, cuộn mượt, reduced motion
    media/             Slider so sánh, carousel, lightbox, video, shader
    sections/          Các phần nội dung dùng chung
    pages/             Bố cục About và chi tiết dịch vụ
  data/                Nội dung có cấu trúc, độc lập với component
  lib/                 Kiểu dữ liệu, thông tin website, renderer WebGL
  styles/              Font, design tokens và CSS responsive
reference/             Nội dung lưu từ website tham chiếu để đối chiếu/import
scripts/               Nhập nội dung và kiểm tra route
tests/                 Kiểm tra tài nguyên, dữ liệu và liên kết
docs/                  Thông số thiết kế và kết quả kiểm tra
```

## Nội dung và tài nguyên

- Dữ liệu chính: `src/data/site-content.json`.
- Logo, điện thoại, email, địa chỉ, menu: `src/lib/content.ts`.
- Màu sắc: `src/styles/tokens.css`.
- Font: Barlow Condensed 700; Inter 400/500/600/700, có subset tiếng Việt cho Inter.
- Ảnh/video/font được phục vụ nội bộ từ `public/`, giữ file gốc. Ảnh giao diện được tối ưu bằng `next/image`.
- `npm run content:import` tạo lại JSON từ nội dung đã lưu trong `reference/`.
- Pricing, Training và Service Process là anchor trên trang chủ, theo website gốc.
- Địa chỉ, số điện thoại, email, bài viết và đánh giá giữ nguyên nội dung của website mẫu. Thay thông tin doanh nghiệp tại các file dữ liệu trước khi dùng cho DPAuto thực tế.

## Chuyển động và tương tác

- Header sticky, menu dịch vụ desktop, menu mobile có submenu.
- Reveal khi vào viewport, card hover dùng spring, hero và ảnh có parallax.
- Thẻ dịch vụ xếp chồng khi cuộn ở trang Services.
- FAQ mở độc lập nhiều câu trả lời.
- So sánh ảnh kéo bằng chuột/touch; phím mũi tên, Shift, Home và End.
- Carousel tự chuyển mỗi 5,5 giây khi đang xuất hiện; có nút và dots.
- Hai hàng đánh giá chạy ngược chiều, kéo được bằng chuột.
- Gallery có lightbox, chuyển ảnh bằng phím, Escape, quản lý focus.
- Video có play/pause, seek, mute và fullscreen.
- Footer sử dụng fragment shader Logo Spectrum và Liquid Gradient công khai của trang tham chiếu, với tham số được đối chiếu. WebGL dùng renderer riêng; hình fallback gốc được dùng khi không có WebGL hoặc bật reduced motion. Cách tạo heightmap logo và môi trường render khác Framer nên hiệu ứng không được khẳng định trùng từng pixel/frame.
- Hiệu ứng tôn trọng thiết lập `prefers-reduced-motion` của trình duyệt.

## Phạm vi

Website giữ luồng liên hệ bằng điện thoại/email/bản đồ như bản mẫu. Google Maps và mạng xã hội cần kết nối Internet. Không có form đặt lịch hoặc API tiếp nhận thông tin trong website tham chiếu.

Đây là bản triển khai Next.js độc lập. UI đã được đối chiếu qua Chrome; mức độ trùng khớp tuyệt đối từng pixel hoặc chuyển động ở mọi thiết bị chưa được chứng nhận.

Tài liệu khảo sát chi tiết: `docs/design-spec.vi.md`, `docs/design-tokens-and-motion.json`. Kết quả kiểm tra được lưu ở `docs/qa/`.

Nếu triển khai lên domain riêng, đặt `NEXT_PUBLIC_SITE_URL` để tạo sitemap với domain đó. Dự án chưa được publish/deploy.
