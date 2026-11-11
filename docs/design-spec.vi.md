# Thông số giao diện HyperAuto Care để dựng lại DPAuto

Khảo sát ngày 30/10/2026 bằng Chrome DevTools trên https://hyperautocare.framer.website/. Tài liệu này tổng hợp CSS đang khớp với phần tử, font thực tế Chrome render, JavaScript đã tải và source map công khai. Chưa thay đổi mã nguồn dự án DPAuto.

## Font và typography

Tiêu đề dùng **Barlow Condensed 700**. Nội dung dùng **Inter 400/500/600/700**. DevTools xác nhận font render thực tế là BarlowCondensed-Bold và Inter-Regular, không chỉ tên khai báo trong CSS.

| Thành phần                           |      Kích thước | Line-height | Letter-spacing |
| ------------------------------------ | --------------: | ----------: | -------------: |
| H1, màn hình từ 1610px               |            90px |      0.96em |         -1.4px |
| H1, 1140–1609px                      |            76px |      1.06em |         -1.4px |
| H1, 768–1139px                       |            60px |      1.06em |         -1.4px |
| H1, tối đa 767px                     |            44px |       1.1em |         -1.4px |
| H2, desktop/tablet/phone             |  54 / 44 / 36px |      1.05em |         -0.7px |
| Tên dịch vụ H3, desktop/tablet/phone |  24 / 22 / 21px |       1.2em |         normal |
| Nội dung thẻ dịch vụ                 | Inter 16px, 400 |      1.55em |        -0.01em |
| Đoạn giới thiệu hero                 | Inter 18px, 400 |       1.6em |        -0.02em |
| Nhãn nút                             | Inter 14px, 700 |        14px |          0.2px |
| Menu desktop                         | Inter 14px, 600 |        14px |        -0.28px |
| Câu hỏi FAQ                          | Inter 18px, 700 |      1.55em |        -0.02em |

H2/H3 đổi cỡ ở 1200px và 810px. H1 có breakpoint typography riêng; không dùng một bộ breakpoint chung cho tất cả chữ.

Đã lưu 9 file WOFF2: Barlow Condensed 700 và các subset Latin/Vietnamese của Inter 400/500/600/700. Xem [font-manifest.json](font-manifest.json) để biết URL và khai báo @font-face đầy đủ.

Nguồn: [H1](sources/13-3-iDidfo7HM.js), [H2](sources/14-0-MKNjtCsje.js), [H3](sources/25-0-q4g10rEtI.js), [body](sources/13-0-BDqiuNcU5.js), [CSS khớp phần tử](matched-rules.json).

## Bảng màu

| Vai trò                    | Màu                                   |
| -------------------------- | ------------------------------------- |
| Nền tối chính              | #0B0D0F                               |
| Lớp nội dung tối           | #15181B                               |
| Khung thẻ / nền nổi        | #202428                               |
| Một số trạng thái nền phụ  | #24282C                               |
| Nền sáng ấm                | #F4F1EA                               |
| Chữ/nền trắng              | #FFFFFF                               |
| Cam thương hiệu, CTA, icon | #FF5A1F                               |
| Cam phụ trong token        | #FF7B4A                               |
| Chữ phụ trên nền tối       | #979DA3 hoặc trắng 70% tùy thành phần |
| Chữ phụ trên nền sáng      | #5F666D                               |
| Viền tối                   | #2D3237                               |
| Viền sáng                  | #E4E9EB                               |
| Nội dung hero              | Trắng 80%                             |

Nút Explore Our Services giữ nền #FF5A1F trong lần đối chiếu hover. Không mặc định biến mọi nút thành màu cam phụ khi hover; mỗi variant có cấu hình riêng.

Nguồn: [token CSS gốc](css-extracted.json), [trạng thái nút đã đo](button-hover-verified.json).

## Bố cục và khoảng cách

- Desktop: từ 1200px; tablet: 810–1199.98px; phone: tối đa 809.98px.
- Khung nội dung tối đa 1280px, đã bao gồm padding hai bên.
- Phần dịch vụ dùng padding 120px 32px trên desktop, 100px 32px trên tablet, 80px 20px trên phone.
- Khoảng cách tiêu đề–nội dung phần dịch vụ lần lượt 54px / 40px / 32px.
- Lưới thẻ dịch vụ: 4 / 2 / 1 cột.
- Header sticky ở top 0; cao 76 / 72 / 68px.
- Thẻ dịch vụ: cao cơ sở 500px, min-height 300px, padding 5px, gap nội bộ 4px, radius 16px.
- Nút CTA mẫu: cao 52px, padding 14px 18px, radius 12px, không có shadow.
- Nhiều khung dùng corner-shape: superellipse(2), có hệ số radius fallback 0.566 khi trình duyệt không hỗ trợ. Cần giữ cách bo góc này nếu muốn giống sát.
- Ảnh chủ yếu dùng object-fit: cover và khung overflow được cắt.

Các giá trị trên là cấu hình cơ sở; vị trí/kích thước nhìn thấy có thể thay đổi khi scroll transform đang hoạt động. Xem [responsive-styles-verified.json](responsive-styles-verified.json) và CSS gốc theo trang.

## Hiệu ứng và tương tác

| Thành phần                     | Cách hoạt động và thông số                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thẻ dịch vụ hover              | Spring: stiffness 254, damping 24, mass 1. Khung/nền đổi trạng thái, CTA mũi tên mở rộng để hiện View Service.                                                    |
| FAQ                            | Spring 0.3s, bounce 0.2; icon chuyển plus/minus với rotation 90 → 180. Cho phép mở nhiều câu trả lời.                                                             |
| Menu điện thoại                | Variant đóng/mở dùng spring 0.4s, bounce 0.2.                                                                                                                     |
| Nhãn menu desktop              | Spring 0.3s, bounce 0.2; trạng thái hover đổi màu theo variant.                                                                                                   |
| Một số đoạn chữ vào màn hình   | Tween 0.65s, cubic-bezier(0.44,0,0.56,1), delay 0/0.2/0.4/0.6s; offset Y 20/40/60px.                                                                              |
| Một số đoạn chữ spring         | Duration 0.75–0.85s, bounce 0.2; có preset offset X 40px.                                                                                                         |
| Ảnh nền hero                   | Hiệu ứng theo scroll; scale 1 → 1.4, tham số parallax speed 30 của Framer.                                                                                        |
| Nội dung hero                  | Có cấu hình theo scroll target tới scale 1.4 và rotateY 50°; các khối khác có fade/scale riêng.                                                                   |
| Thẻ dịch vụ vào màn hình       | RotateX 6°, rotateY 20°, translate(24px,48px) về trạng thái trung tính; spring stiffness 500/damping 60/mass 1.                                                   |
| Ảnh quy trình                  | Theo scroll, scale 1.15 → 1; Y -40 → 160px.                                                                                                                       |
| Đánh giá khách hàng            | Hai hàng ticker chạy ngược chiều; velocity 40, gap 12px, cho kéo; hover modifier được cấu hình là 100.                                                            |
| Carousel trước–sau             | Auto-play mỗi 5.5s; spring stiffness 200/damping 40/mass 1; drag chuyển slide tắt; slide không active scale 0.95, opacity 0.1; chỉ chạy khi ở màn hình.           |
| Điều khiển carousel            | Mũi tên 48px, dot 8px, gap dot 10px.                                                                                                                              |
| So sánh ảnh                    | Dùng clip-path inset để cắt lớp ảnh trước; divider 2px, nút kéo 44px; vị trí ban đầu 50%.                                                                         |
| Tự quét trước–sau              | Desktop từ 1024px, khi hiện ít nhất 35%: chạy 100% → 10% trong 1500ms theo easeInOutCubic. Reduced motion nhảy thẳng đến 10%.                                     |
| Hover-follow của ảnh trước–sau | Component có hỗ trợ nhưng homepage cấu hình tắt; homepage dùng kéo và tự quét desktop.                                                                            |
| Touch/keyboard so sánh ảnh     | touch-action: pan-y; phím trái/phải đổi 2%, Shift đổi 10%, Home/End về 0/100%.                                                                                    |
| Cuộn mượt                      | Component AnthLayerSmoothScroll riêng, intensity 11; nội suy mỗi frame với hệ số 0.154, dừng khi sai số dưới 0.4px. Tắt trên Safari/iOS và màn hình tối đa 767px. |
| Lightbox ảnh                   | Cấu hình overlay đen 88%, max-width 1600px, padding 20px; tween 0.35s theo (0.44,0,0.56,1).                                                                       |
| Video                          | AnthLayerVideoPlayer chạy inline; có play/pause, seek, mute, fullscreen.                                                                                          |

Spring có tham số vật lý không nên chuyển thành một transition CSS tuyến tính có cùng số giây. Các hiệu ứng onScroll, onScrollTarget và onInView cũng cần giữ đúng loại trigger.

Nguồn chính: [homepage](sources/22-33-augiA20Il.js), [service card](sources/22-24-nU2snJNAe.js), [FAQ](sources/29-2-vNEOT6JA7.js), [header](sources/36-7-UL7k4hzeD.js), [slideshow](sources/22-20-SlideShow.js), [before–after](sources/39-0-AnthLayer_BeforeAfter.js), [smooth scroll](sources/13-2-AnthLayer_Smooth_Scroll.js), [video](sources/26-0-AnthLayer_VideoPlayer.js).

## Tài liệu đã lưu

- [design-tokens-and-motion.json](design-tokens-and-motion.json): thông số đã tổng hợp, kèm dấu vết nguồn.
- [source-index.json](source-index.json): URL và đường dẫn các mô đun JavaScript/stylesheet.
- [map-index.json](map-index.json): ánh xạ source map về file nguồn đọc được.
- [matched-rules.json](matched-rules.json): CSS rule khớp với các phần tử đã chọn.
- [font-face-rules.json](font-face-rules.json), [font-manifest.json](font-manifest.json), thư mục fonts/.
- Thư mục css/, js/, maps/, sources/ lưu các bản tham chiếu đã đọc.
- Ảnh/video và ảnh chụp màn hình từ lượt khảo sát trước nằm trong thư mục cha.

Đã thu thập 51 mô đun/đoạn JavaScript, 42 bản stylesheet qua các trang mẫu, 44 source map tương ứng 137 file nguồn, và 9 file font. Các stylesheet có phần dùng chung hoặc do runtime tạo; con số này không phải 42 thiết kế CSS độc lập.

Các trang mẫu đã đối chiếu mã riêng gồm homepage, chi tiết dịch vụ, Our Work, About, News, bài tin chi tiết và Contact. Những effect chỉ tồn tại trong thư viện, editor hoặc badge Framer không được xem là hiệu ứng website nếu chưa có cấu hình sử dụng trên phần tử tương ứng.
