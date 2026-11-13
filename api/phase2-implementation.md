# Phase 2 — Tiếp nhận và phiếu dịch vụ

Triển khai ngày 12/11/2026, kế tiếp [hợp đồng nền](api-design.md). Áp dụng cho backend và giao diện khi `NEXT_PUBLIC_API_ENABLED=true`. Không tự bật flag hoặc migrate database doanh nghiệp.

## Luồng nghiệp vụ

- **Có lịch:** chỉ nhận lịch `CONFIRMED` thuộc cố vấn hiện hành hoặc manager. Đối chiếu xe thực tế, ghi tình trạng/ODO/yêu cầu/ảnh; tạo một visit duy nhất và đổi booking sang `ARRIVED` cùng transaction. Booking giữ thông tin xe và thời gian đặt ban đầu; phiếu có snapshot xe thực nhận riêng.
- **Không lịch:** tạo `service_visit` với `booking_id=NULL`, nguồn `WALK_IN`. Cố vấn tự phụ trách; manager phải chọn một cố vấn có tài khoản hợp lệ. Không tạo booking giả. Khách/xe có sẵn phải thuộc scope và có liên kết hiện hành; khách/xe mới không gộp tự động theo SĐT/biển số.
- **Thời gian cấp phát:** `receivedAt` là giờ server. Điểm bắt đầu tài nguyên là mốc lưới kế tiếp tính từ giờ nhận. Bỏ qua thời gian báo trước của booking; vẫn kiểm tra giờ làm việc, pool, tài nguyên, buckets, lịch khóa và phiên bản cấu hình. Khi không đủ năng lực, từ chối và rollback toàn bộ; không có nút bỏ qua.
- **Giữ chỗ:** nếu footprint cùng thời gian thì chuyển chính reservation sang visit, không trừ lần nữa. Nếu nhận sớm/trễ, replan có bỏ qua giữ chỗ cũ, release/persist cùng transaction. Reservation có đúng một subject booking hoặc visit, với FK và partial unique.
- **Tình trạng:** `RECEIVED → INSPECTED` chỉ sau khi có ghi nhận kiểm tra và thao tác xác nhận thực tế. Không tự suy thi công, báo giá, nghiệm thu, thanh toán hoặc bàn giao. Các bước đó thuộc Phase 3–4.
- **Xe quay lại:** tạo visit mới, không reopen phiếu cũ. Backend nhận `followUpOfVisitId/followUpReason` khi phiếu trước của cùng xe đã `HANDED_OVER/ABORTED` và người tạo có quyền đọc. Phase 2 chưa có thao tác đóng phiếu; các trạng thái kết thúc dành cho luồng Phase 3.
- **Chuyển cố vấn:** manager chuyển visit; nếu có booking liên quan thì đổi owner booking, kết thúc/mở cả hai assignment và ghi events cùng transaction. Người cũ mất quyền detail, ảnh, mutation và replay ngay sau commit. Lịch sử riêng chỉ có mã phiếu, mốc thời gian và trạng thái snapshot, không có thông tin khách/ảnh.

## API bổ sung

Prefix `/api/v1`. Mutation dùng session, CSRF, `Idempotency-Key`, strict DTO; chỉnh sửa dùng `expectedVersion`. API list dùng cursor ký và limit 1–100. Quản lý chỉ xem dữ liệu trạm mình; cố vấn chỉ xem hồ sơ đang phụ trách.

| Method/path                                     | Input chính                                                                                                                                  | Output / quyền                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET `/admin/service-visits`                     | `q,from,to,stage,advisorId,bookingId,customerId,vehicleId,limit,cursor`                                                                      | List summary theo scope, không ảnh hoặc ghi chú; `visits.read`                                                |
| GET `/admin/service-visits/:id`                 | UUID                                                                                                                                         | Snapshot khách/xe/dịch vụ, intake, metadata ảnh, reservation, progress, allowedActions; `visits.read`         |
| POST `/admin/service-visits`                    | Customer/vehicle ID hoặc mới, `vehicleVerified:true`, advisor, serviceIds, catalogVersion, policyVersion, notice, intake, follow-up tùy chọn | 201 VisitReceipt; `visits.receive`                                                                            |
| POST `/admin/bookings/:id/receive`              | `expectedVersion,vehicle,vehicleVerified:true,vehicleChangeReason?,policyVersion,intake`                                                     | 201 VisitReceipt; retry hoặc request mới tới booking đã nhận trả cùng visit, không nhận lại; `visits.receive` |
| PATCH `/admin/service-visits/:id/intake`        | `expectedVersion,reason,intake`                                                                                                              | VisitReceipt; `visits.update`                                                                                 |
| POST `/admin/service-visits/:id/inspection`     | `expectedVersion,reason`                                                                                                                     | VisitReceipt, stage INSPECTED; `visits.update`                                                                |
| POST `/admin/service-visits/:id/transfer`       | `expectedVersion,reason,toAdvisorId`                                                                                                         | VisitReceipt; manager + `visits.assign`                                                                       |
| POST `/admin/service-visits/:id/contact-events` | `expectedVersion,channel,outcome,note?`                                                                                                      | 201 VisitReceipt; `visits.contact`                                                                            |
| GET `/admin/service-visits/:id/events`          | `limit,cursor`                                                                                                                               | Timeline phân trang gồm các lần sửa và liên hệ; chủ phiếu hiện hành/manager                                   |
| GET `/admin/my-visit-history`                   | `limit,cursor`                                                                                                                               | Phân công của chính người gọi, snapshot giới hạn sau chuyển                                                   |
| GET `/admin/visit-media/:id`                    | UUID                                                                                                                                         | `{id,name,dataUrl}` JPEG sau kiểm tra scope, `Cache-Control:no-store`; không có URL public                    |
| DELETE `/admin/visit-media/:id`                 | `expectedVersion,reason`                                                                                                                     | VisitReceipt, soft delete và event; chủ phiếu hiện hành/manager                                               |

`VisitReceipt = {visitId,code,bookingId,stage,version,eventId?}`. Receipt không chứa tên/SĐT, tình trạng xe hoặc ảnh. Response vẫn dùng envelope `data/meta`; list thêm `page`. Replay kiểm tra lại quyền trên visit trước khi trả receipt.

### Intake

```json
{
  "request": "Kiểm tra điều hòa và vệ sinh nội thất",
  "odometer": 38250,
  "conditions": {
    "exterior": "Trầy nhẹ cửa trước",
    "interior": "Đã kiểm tra",
    "engine": "",
    "dashboard": "",
    "tires": "",
    "operation": []
  },
  "receptionNote": "Khách gửi chìa khóa",
  "photos": []
}
```

ODO là số nguyên 0–9.999.999, hoặc `null` kèm `odometerMissingReason`. Không tự lấy ODO cũ làm số đo mới. Xe chưa có biển số phải có `plateMissingReason`. Đổi/bổ sung xe khác thông tin booking phải có `vehicleChangeReason`. `photos` là các ảnh **bổ sung**, mỗi phần tử `{name,dataUrl}`; ảnh đã có chỉ gỡ qua API DELETE.

Lỗi chính: 400 `VALIDATION_FAILED/CURSOR_INVALID`; 401/403 phiên/quyền/CSRF; 404 không có trong scope; 409 `CAPACITY_FULL/VERSION_CONFLICT/POLICY_VERSION_CONFLICT/CATALOG_VERSION_CONFLICT/INVALID_TRANSITION/VEHICLE_ALREADY_IN_SERVICE/ASSIGNMENTS_REMAIN`; 413 `PAYLOAD_TOO_LARGE`; 422 thiếu xác minh xe, lý do, plan, giờ hoạt động hoặc ảnh không hợp lệ; 503 chưa cấu hình/allocator không giải được. UI giữ nội dung đang sửa khi version conflict, cho phép tải lại có xác nhận bỏ thay đổi.

## Database và bảo mật ảnh

Migration mới `backend/migrations/0002_reception.sql` thêm 6 bảng: `service_visits`, `visit_services`, `visit_assignments`, `visit_events`, `visit_contact_events`, `visit_media`. Tổng hiện tại 39 bảng nghiệp vụ, 1 bảng metadata migration. Không sửa migration Phase 1.

- Booking nullable/unique trên visit; một phiếu mở cho mỗi xe trong cùng trạm. Visit có owner bắt buộc, snapshot, giờ nhận và actor thực.
- Reservation và consent thêm FK visit, booking nullable, CHECK XOR đúng một subject. Không tạo ID đa hình thiếu FK.
- Lịch sử visit/contact append-only. Intake sửa có before/after trong event, audit và outbox cùng transaction. Không log nội dung form/ảnh vào console.
- JPEG tối đa 200 KB, 6 ảnh/phiếu, kích thước tối đa 4096 mỗi chiều và 12 triệu pixels. Server kiểm tra mã hóa base64, marker JPEG, độ dài và kích thước; không nhận SVG/HTML hoặc đường dẫn file.
- Client dùng canvas thu nhỏ và mã hóa lại JPEG; ảnh không được lưu vào localStorage/sessionStorage khi dùng API. Không có dịch vụ lưu ảnh bên ngoài hoặc biến môi trường mới.
- PostgreSQL lưu bytes, checksum SHA-256, người tải và thời gian. Gỡ ảnh thu hồi quyền đọc nhưng giữ bytes để phục vụ lịch sử; chính sách purge/retention/backup cần thống nhất trước production. Chưa có antivirus hoặc pipeline giải mã/mã hóa lại ảnh ở server.

## Giao diện

- `/co-van/tiep-nhan/[id]`: nhận lịch; `/co-van/tiep-nhan/truc-tiep`: walk-in.
- `/co-van/phieu-dich-vu` và `/:id`: list có tìm kiếm, lọc, paging; detail intake/ảnh, kiểm tra ban đầu, liên hệ, timeline.
- `/dieu-hanh/phieu-dich-vu`, `/:id`, `/dieu-hanh/tiep-nhan/[id]`, `/truc-tiep`: cùng nguồn dữ liệu, thêm lọc và chuyển cố vấn.
- Hồ sơ khách/xe có danh sách visit đúng scope; lịch sử phụ trách hiển thị tại `/co-van/lich-su`.
- Nút tiếp nhận/mở phiếu được nối từ lịch; lịch ARRIVED không còn sửa/phân công qua command booking cũ.
- Dùng lại `adm-*`, `adv-*`, các nút, form, cards, timeline và breakpoint hiện có. Manager dùng stylesheet bố cục advisor cùng token manager; không đổi palette, font, animation hoặc thêm UI library. Các màn báo giá/thi công/nghiệm thu/in chưa được mở trong chế độ API.

## Giới hạn và đưa vào sử dụng

1. Chưa áp dụng migration thật hoặc bật API. Chạy migration mới theo [README backend](../backend/README.md) trên môi trường được chuẩn bị.
2. Phase 2 chưa có bàn giao/abort/settlement nên phiếu tiếp tục giữ tài nguyên. Khi đã qua giờ kết thúc dự kiến mà phiếu vẫn mở, planner chặn các tài nguyên liên quan; không tự thả chỗ hoặc báo xe đã xong. Phase 3 bổ sung actual occupancy/release và xử lý lịch bị ảnh hưởng. Chưa dùng để cutover CRM.
3. Tắt feature gate không xóa visit/ảnh đã tạo; schema là migration tiến. Không chạy down migration xóa dữ liệu khi rollback ứng dụng.
4. Ảnh nằm trong database nên cần tính cả dung lượng ảnh khi backup và đặt quyền runtime; UI thu nhỏ không thay chính sách lưu giữ.
5. Chưa chạy production build, browser, thiết bị thật, E2E hoặc kiểm thử toàn diện. Chỉ chạy các kiểm tra liên quan Phase 2 theo AGENTS.md.

## Kiểm tra đã thực hiện

- 11 ca API/DB Phase 2 đã đạt trên PostgreSQL tạm: schema/XOR, retry/nhận cạnh tranh, walk-in tranh tài nguyên, rollback khi đầy, scope khách/xe, sửa intake/ODO/version, event/contact append-only, đồng bộ owner, quyền ảnh/replay/gỡ ảnh, validation/quyền/offboard, tài nguyên quá giờ, giới hạn body. Một test có nhiều điều kiện kiểm tra, số ca không phải số assertion.
- 2 ca adapter/client đạt: ODO bằng 0/missing reason, liên kết booking–visit/nút tiếp nhận; giữ key và payload sau mất mạng khi metadata đổi.
- Typecheck backend/frontend đạt. Không chạy lại các ca đã thành công. Fixture chuyển cố vấn được làm mới phiên sau khi tăng thời gian để kiểm tra đúng quyền, không nhầm với hết phiên.
