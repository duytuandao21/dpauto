# Đặt lịch V1 — giới hạn theo khung giờ

Áp dụng từ 13/11/2026, thay thế phần lập kế hoạch tài nguyên trong thiết kế Phase 1–6.

## Quy tắc

- Giờ mặc định lấy từ hero trang chủ: **07:30–17:30, cả bảy ngày**.
- Khung mặc định 60 phút: 07:30, 08:30, …, 16:30. Mỗi khung tối đa 5 lịch, dùng chung cho mọi dịch vụ và nguồn đặt lịch.
- `PENDING`, `CONFIRMED`, `ARRIVED`, `COMPLETED` chiếm một chỗ theo `scheduled_start_at`. Chuyển sang đã tiếp nhận/hoàn tất không tự mở thêm chỗ.
- `CANCELLED`, `NO_SHOW` không chiếm chỗ. Không tự hủy lịch chờ hoặc tự kết luận khách không đến.
- Hủy trả chỗ ngay; đổi giờ thành công trả khung cũ và chiếm khung mới. Nếu khung mới đầy, transaction rollback toàn bộ, giữ lịch cũ.
- Xác nhận cùng giờ không chiếm thêm chỗ. Đặt nhiều dịch vụ vẫn là một lịch, một chỗ.
- Khóa hàng trạm trong transaction mutation hiện có; kiểm tra số lịch và ghi booking cùng transaction. Giữ idempotency, CSRF, scope cố vấn và audit hiện có.
- Khách đến trực tiếp/thi công không phụ thuộc cấu hình tài nguyên hoặc chiếm thêm chỗ đặt lịch. Kiểm tra phân công KTV, phạm vi báo giá, nghiệm thu, tồn kho và tiền trước bàn giao vẫn giữ.
- Giờ đã qua không nhận lịch mới. Khoảng đặt trước mặc định 30 ngày, múi giờ `Asia/Ho_Chi_Minh`.

Thời lượng dịch vụ dùng để tham khảo và lưu hồ sơ, **không khóa các khung tiếp theo theo thời gian thi công**.

## Cấu hình và giao diện

- `/dieu-hanh/nang-luc`: **Khung giờ đặt lịch**, hiện giờ bắt đầu/kết thúc, lịch chờ, lịch đã nhận, số chỗ còn lại và đóng/mở nhận lịch.
- `/dieu-hanh/cau-hinh`: **Thiết lập nhận lịch**, chỉ gồm bật/tắt nhận lịch, độ dài khung, giới hạn mỗi khung và giờ làm từng ngày.
- Đóng khung/ngày chỉ ngừng nhận mới, giữ nguyên lịch hiện hữu. Một ngày có nhiều lệnh đóng thì phải mở hết các lệnh còn hiệu lực mới nhận lại được.
- Đổi độ dài khung khi còn lịch tương lai bị chặn để tránh đổi nhóm lịch âm thầm; cần xử lý/đổi lịch trước. Giảm giới hạn dưới số lịch đang giữ cũng bị chặn.
- Danh mục dịch vụ nhập thời lượng trực tiếp, bỏ nhóm tài nguyên/số lượng/offset. Form khách có nút cập nhật khung giờ để lấy lại chỗ vừa mở.
- Dùng lại `ManagerPanel`, `ManagerTable`, `ManagerField`, `ManagerModal`, token CoreUI, theme và quy tắc responsive hiện có.

## Danh mục đã cấu hình

Migration `0007_booking_slots.sql` bổ sung các mã chưa có, không ghi đè dịch vụ cùng mã, không tạo khách/lịch/phiếu kiểm thử trong database đang sử dụng.

| Dịch vụ                       | Phút |
| ----------------------------- | ---: |
| Bảo dưỡng định kỳ             |  120 |
| Thay dầu / Lọc dầu            |   45 |
| Kiểm tra, sửa chữa            |   60 |
| Lốp / Phanh / Gầm             |   90 |
| Điện / Điều hòa               |   90 |
| Rửa xe và chăm sóc ngoại thất |   60 |
| Vệ sinh nội thất              |  180 |
| Phủ ceramic                   |  240 |
| Dán phim cách nhiệt           |  150 |
| Lắp đặt phụ kiện ô tô         |   90 |
| Khác / Cần tư vấn             |   30 |

## Hợp đồng API hiện tại

Giữ các đường dẫn để hạn chế thay đổi callers; cấu trúc cấu hình đã đơn giản hóa.

- `GET /admin/capacity/policy`: `stationId`, `configurationVersion`, `bookingEnabled`, `slotMinutes`, `maxBookingsPerSlot`, `hours`, `leadMinutes`, `advanceDays`.
- `PUT /admin/capacity/policy`: `expectedVersion`, `reason`, `bookingEnabled`, `slotMinutes` (15–120), `maxBookingsPerSlot` (1–100), `hours: [{weekday, opensAt, closesAt}]`. Không nhận `pools`, `resources`, policy tương lai hoặc cấu hình bucket riêng.
- `GET /admin/capacity/calendar?from&to`: mỗi bucket là một khung nhận lịch, gồm `id`, `startAt`, `endAt`, `capacityLimit`, `heldUnits`, `pendingCount`, `confirmedCount`, `freeUnits`, `closed`, `version`, `holdRefs`. `confirmedCount` gồm lịch đã xác nhận/tiếp nhận/hoàn thành; giao diện gọi là “Đã nhận”.
- `PATCH /admin/capacity/buckets/:id`: thêm `startAt` bắt buộc, `expectedVersion`, `reason`, và `closed` hoặc `capacityLimit`. ID ổn định theo trạm/giờ bắt đầu; không cần khởi tạo ngày.
- `POST/DELETE /admin/capacity/blocks`: đóng/mở khoảng thời gian toàn trạm, không nhận `poolId`/`resourceId`.
- `GET /public/availability`: giờ bắt đầu theo giờ mở cửa, `endAt` là cuối khung nhận lịch; thêm `remaining`. Dịch vụ dài không làm mất khung cuối ngày.
- Tạo/sửa dịch vụ dùng `estimatedDurationMinutes` (15–1440), bỏ input `requirements`. Các bản ghi và snapshot tài nguyên lịch sử được giữ để bảo toàn dữ liệu.
- Endpoint gia hạn tài nguyên trả `410 RESOURCE_SCHEDULING_REMOVED`; giao diện thi công không còn form tài nguyên. Các bảng lịch sử không bị xóa.

## Quản trị website

- Nội dung, bài viết, hình ảnh, SEO nằm tại `/admin?tab=content|news|media|seo`, không có trong sidebar `/dieu-hanh`.
- Các route cũ `/dieu-hanh/website/*` chuyển hướng tới tab tương ứng ở `/admin`.
- Giữ quyền `cms.read/write/publish`. Tài khoản CMS không có quyền vận hành, lịch hẹn, kho hay tài chính.
- Chủ tài khoản có role MANAGER cùng `roles.manage` và `staff.manage` được vào `/admin` để tạo tài khoản CMS; không tự có quyền đọc/biên tập nội dung nếu thiếu quyền CMS. Form cấp tài khoản đã chuyển khỏi trang nhân sự điều hành.
- Bỏ thông báo bản xem thử/dữ liệu giả định trong giao diện; giữ thông báo lỗi và quyền truy cập thực tế. Nút xem trước nội dung CMS vẫn là chức năng biên tập.

## Triển khai và kiểm tra

Đã áp dụng migration 0007 vào database cấu hình trong `backend/.env`; đã đọc lại xác nhận 60 phút/5 lịch, giờ 07:30–17:30 đủ 7 ngày và 11 dịch vụ hoạt động/cho phép đặt lịch (30–240 phút).

Kiểm tra tập trung:

- TypeScript frontend và backend đạt ở lượt kiểm tra của nhiệm vụ; các thay đổi trình bày nhỏ sau đó được đối chiếu tĩnh với types/callers.
- **6 ca API/DB đạt** trên PostgreSQL tạm: catalog không có tài nguyên, 6 yêu cầu đồng thời/5 chỗ và replay, xác nhận/hủy/đổi giờ rollback, tiếp nhận và giữ chỗ sau hoàn thành, đóng/mở khung/ngày và validation, quyền cố vấn/CMS.
- **1 ca UI permission đạt**: tách quyền đọc CMS khỏi quyền tạo tài khoản, không cho cố vấn hoặc quản lý thiếu quyền vào khu vực này.
- Fixture của các bộ kiểm thử Phase được chuyển sang cấu hình khung giờ; các ca chỉ kiểm tra phân bổ tài nguyên vật lý đã được thay bằng kiểm thử V1. Không chạy lại toàn bộ suite Phase 1–6.
- Chưa xác nhận trực quan phiên bản này trong trình duyệt hoặc trên điện thoại thật. Không tự chạy build, E2E, Playwright, Lighthouse hay benchmark. Không mở lại dev ở cổng 4003.

Chạy riêng kiểm thử liên quan từ `backend`:

```powershell
npm.cmd run test:booking
```

Nếu chạy bản build bằng `npm start`, cần build lại frontend/backend tương ứng rồi khởi động lại để nhận source mới. Không bootstrap lại tài khoản. Với môi trường khác chưa nâng cấp database, chạy `npm.cmd run db:migrate` trong `backend` trước.
