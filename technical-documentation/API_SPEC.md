# DPAuto – API SPECIFICATION

> **Mã:** DPA-API-001  
> **Phiên bản:** 1.0 – Dự thảo thiết kế, 10/11/2026  
> **Đối tượng:** Web công khai, Admin Manager/Advisor, API NestJS/Fastify  
> **Cơ sở:** `DPAuto_Booking_Requirements.md`, `BUSINESS_RULES.md`, `USER_FLOW.md`, `DATABASE_DESIGN.md`  
> **Trạng thái:** Chưa khóa hợp đồng API; D01–D14 vẫn cần duyệt.

## 1. Phạm vi và quy ước

API phục vụ hệ thống DPAuto **độc lập** với phần mềm lịch cũ và cơ sở dữ liệu Xe Lướt Toàn Trung. MVP gồm đặt lịch không đăng nhập, quản trị lịch và phân công, sức chứa, tiếp nhận và tiến độ xe, lịch sử dịch vụ có xác minh, thông báo nội bộ, báo cáo cơ bản. Không bao gồm ERP sửa chữa, kho, thanh toán, hóa đơn hoặc gửi Zalo OA thực tế.

Nhãn: **[CHỐT]** yêu cầu nghiệp vụ đã thống nhất; **[REQ]** chi tiết trong Requirements chưa được duyệt riêng; **[ĐỀ XUẤT]** hợp đồng kỹ thuật; **[Dxx]** cần quyết định nghiệp vụ. Đường dẫn, field, mã lỗi và giới hạn là đề xuất, không phải API đang hoạt động.

- Base path đề xuất: `/api/v1`; HTTPS bắt buộc trên production; JSON UTF-8; thời gian ISO 8601 có timezone; lưu DB `timestamptz`, hiển thị `Asia/Ho_Chi_Minh`.
- Phân tách `/public/*`, `/customer-access/*`, `/admin/*`; không tin role, advisor ID hoặc quyền do client truyền lên.
- Mã lịch `code` chỉ là mã tham chiếu, **không** phải bằng chứng cấp quyền truy cập.
- Pagination mặc định `limit=20`, tối đa 100; `cursor` ưu tiên danh sách lớn; sort whitelist; không trả tất cả lịch qua một request.
- Tạo/sửa quan trọng hỗ trợ `Idempotency-Key` và/hoặc `version` chống thao tác lặp, race condition.

## 2. Kiến trúc hợp đồng và module

| Module API | Chức năng | Phân hệ DB | Phase |
|---|---|---|---|
| Public Content | Dịch vụ, bài viết, thông tin trạm | `services`, CMS nếu được duyệt | P1 / CMS riêng |
| Public Booking | Lấy khung giờ, gửi yêu cầu | `bookings`, `booking_services`, `idempotency_keys` | P1 |
| Auth & Staff | Phiên nhân viên, hồ sơ, quyền | `users`, `staff_profiles`, `user_roles` | P1 |
| Admin Booking | Lịch, lọc, xác nhận, đổi/hủy | `bookings`, `booking_events` | P2–P3 |
| Assignment | Giao/chuyển cố vấn | `booking_assignments` | P2 |
| Capacity | Giờ làm, nghỉ, giới hạn | `business_hours`, `calendar_blocks`, `capacity_rules` | P3 |
| Service Visits | Tiếp nhận, tiến độ, bàn giao | `service_visits`, `service_progress_events` | P3 |
| Customer Access | Xác minh và lịch sử | `verification_challenges`, `access_grants` | P4 |
| Notifications | Việc cần xử lý, outbox | `notification_jobs` | P5 |
| Reporting/Audit | Thống kê, sự kiện | `audit_logs`, booking events | P5 |

## 3. Xác thực và phân quyền

**[CHỐT]** Admin có đúng hai vai trò nghiệp vụ: `MANAGER`, `ADVISOR`; khách công khai không là role Admin. **[ĐỀ XUẤT]** dùng cookie phiên `HttpOnly; Secure; SameSite=Lax` cho Admin trên domain phù hợp; CSRF protection cho mutation dùng cookie; API-to-API nếu cần dùng token ngắn hạn, tuyệt đối không lưu token trong URL hoặc log. Quyết định nhà cung cấp identity và chi tiết session nằm ở `SYSTEM_ARCHITECTURE.md`.

| Quyền | Manager | Advisor | Khách chưa xác minh | Khách đã xác minh |
|---|---|---|---|---|
| Xem/tạo lịch toàn trạm | Có | Không | Chỉ gửi yêu cầu | Chỉ xem lịch được cấp |
| Xem/sửa lịch hiện phụ trách | Có | Có | Không | Không |
| Lịch đã chuyển khỏi mình | Có | Chỉ đọc phần lịch sử được phép | Không | Theo grant |
| Giao/chuyển cố vấn | Có | Không | Không | Không |
| Cấu hình sức chứa, tài khoản | Có | Không | Không | Không |
| Cập nhật tiến độ xe | Có | Lịch được giao | Không | Chỉ xem tiến độ công khai |
| Báo cáo/audit toàn trạm | Có | Không | Không | Không |

**Backend bắt buộc kiểm tra ở từng bản ghi**: `booking.assigned_advisor_id == actor.id` cho thao tác Advisor; sau chuyển giao quyền ghi bị thu hồi ngay. Advisor không được liệt kê toàn bộ khách/xe. Không dựa vào ẩn nút UI. Mọi danh sách phải áp dụng scope tại truy vấn DB trước khi phân trang.

## 4. Mẫu request/response chuẩn [ĐỀ XUẤT]

Thành công:

```json
{"data":{"id":"uuid","status":"PENDING"},"meta":{"requestId":"req_..."}}
```

Lỗi:

```json
{"error":{"code":"CAPACITY_FULL","message":"Khung giờ đã đủ lịch tiếp nhận.","details":{},"requestId":"req_..."}}
```

| HTTP | Ý nghĩa | Mã ứng dụng ví dụ |
|---|---|---|
| 400 | Request sai cấu trúc | `BAD_REQUEST` |
| 401 | Chưa xác thực / phiên hết hạn | `UNAUTHENTICATED` |
| 403 | Không có quyền | `FORBIDDEN` |
| 404 | Không tìm thấy trong phạm vi được phép | `NOT_FOUND` |
| 409 | Xung đột phiên bản/trạng thái | `VERSION_CONFLICT`, `INVALID_TRANSITION` |
| 422 | Không hợp lệ về nghiệp vụ | `VALIDATION_FAILED`, `SLOT_CLOSED` |
| 429 | Quá giới hạn | `RATE_LIMITED` |
| 503 | Dịch vụ phụ thuộc tạm thời lỗi | `SERVICE_UNAVAILABLE` |

**[ĐỀ XUẤT]** dùng `409 CAPACITY_FULL` khi slot vừa hết do race; `422 SLOT_CLOSED` khi slot đã bị đóng từ cấu hình. Response công khai không xác nhận sự tồn tại của SĐT/biển số trước xác minh.

## 5. Danh mục endpoint công khai

| Method | Endpoint | Nội dung | Auth | Ghi chú |
|---|---|---|---|---|
| GET | `/public/services` | Danh mục đang hoạt động | Không | Chỉ trường công khai |
| GET | `/public/services/:slug` | Chi tiết dịch vụ | Không | CMS nếu được duyệt |
| GET | `/public/availability?date=YYYY-MM-DD&serviceIds=...` | Khung giờ được phép yêu cầu | Không | Không lộ tên khách/số lịch nội bộ |
| POST | `/public/bookings` | Gửi yêu cầu đặt lịch | Không | Chống spam, idempotency, recheck slot |
| GET | `/public/site-info` | Giờ mở cửa, hotline, địa chỉ | Không | Nội dung được duyệt |

### 5.1 POST `/public/bookings` [CHỐT + REQ]

```json
{
  "customer":{"fullName":"Nguyễn Văn A","phone":"09xxxxxxxx"},
  "vehicle":{"brand":"Toyota","model":"Vios","plateNumber":""},
  "serviceIds":["service-uuid"],
  "requestedStartAt":"2026-11-12T09:00:00+07:00",
  "note":"Kiểm tra bảo dưỡng định kỳ",
  "source":"WEBSITE",
  "privacyNoticeAcknowledged":true,
  "marketingConsent":false,
  "turnstileToken":"token-if-enabled"
}
```

**Validation:** họ tên/SĐT/dịch vụ/giờ bắt buộc; chuẩn hóa SĐT Việt Nam; biển số tùy chọn; giới hạn ký tự và whitelist `source`; thời gian không trong quá khứ, không rơi ngày đóng, không vượt sức chứa theo chính sách. `source` thực tế nên xác định/kiểm chứng ở server từ kênh đáng tin cậy, không tin chuỗi tự khai. Consent khuyến mãi tách riêng, không tích sẵn.

**Response 201:** `bookingCode`, `status: PENDING` (theo Requirements, chờ duyệt chi tiết), `requestedStartAt`, thông điệp **“Đã nhận yêu cầu – đang chờ xác nhận”**. Không trả token truy cập lịch sử dài hạn. Nếu chính sách D04 chưa chốt, không hứa đã giữ suất.

**Bất biến:** transaction ghi booking + services + event + idempotency; kiểm tra lại availability trên server. Duplicate cùng idempotency key và payload trả kết quả cũ; cùng key khác payload trả conflict. Không cho tạo hai lịch do double-click.

### 5.2 GET `/public/availability` [D03–D05]

Response đề xuất: `date`, `slots:[{startAt,endAt,available,reasonCode}]`, `timezone`. `available` là khả năng **tiếp nhận yêu cầu** theo cấu hình, không phải lời cam kết hoàn tất sửa chữa. Chính sách pending giữ suất hay không và nhóm dịch vụ ảnh hưởng thuật toán phải duyệt D04–D05.

## 6. Admin – đăng nhập, người dùng và dashboard

| Method | Endpoint | Role | Mô tả |
|---|---|---|---|
| POST | `/admin/auth/login` | Public nhân viên | Tùy auth provider, có rate limit |
| POST | `/admin/auth/logout` | Nhân viên | Thu hồi phiên |
| GET | `/admin/auth/me` | Nhân viên | ID, role, profile, permissions |
| GET | `/admin/dashboard?date=...` | Cả hai | Scope toàn trạm/của tôi |
| GET | `/admin/staff` | Manager | Danh sách cố vấn để phân công |
| POST | `/admin/staff` | Manager | Tạo/mời tài khoản theo auth đã chọn |
| PATCH | `/admin/staff/:id` | Manager | Kích hoạt/vô hiệu hóa, vai trò |

Không trả hash/token/password; thay đổi role hoặc vô hiệu hóa tài khoản phải ảnh hưởng đến quyền truy cập các request tiếp theo. `GET /admin/auth/me` không phải bằng chứng đủ quyền cho mutation; API phải kiểm tra lại.

## 7. Admin – lịch hẹn và phân công

| Method | Endpoint | Quyền | Kết quả |
|---|---|---|---|
| GET | `/admin/bookings?from=&to=&status=&advisorId=&cursor=` | Manager toàn trạm; Advisor scoped | Danh sách phân trang |
| GET | `/admin/bookings/:id` | Manager/Advisor được phép | Chi tiết + hành động khả dụng |
| POST | `/admin/bookings` | Manager/Advisor | Tạo lịch cho điện thoại/Fanpage/walk-in |
| PATCH | `/admin/bookings/:id` | Manager/Advisor đang phụ trách | Sửa trường được whitelist |
| POST | `/admin/bookings/:id/confirm` | Manager/Advisor được giao | Xác nhận và chiếm suất |
| POST | `/admin/bookings/:id/reschedule` | Manager/Advisor được giao | Chuyển giờ có kiểm tra slot |
| POST | `/admin/bookings/:id/cancel` | Manager/Advisor được giao | Hủy có lý do |
| POST | `/admin/bookings/:id/no-show` | Manager/Advisor được giao | Không đến, kiểm tra giờ chờ |
| POST | `/admin/bookings/:id/arrive` | Manager/Advisor được giao | Đánh dấu xe đến |
| POST | `/admin/bookings/:id/assign` | Manager | Phân công lần đầu |
| POST | `/admin/bookings/:id/transfer` | Manager | Chuyển A → B |
| GET | `/admin/bookings/:id/events` | Theo scope | Audit nghiệp vụ có lọc trường |
| GET | `/admin/my-history` | Advisor | Các lịch từng phụ trách, chỉ đọc phần cho phép |

**[D01, D02]** Chỉ Manager thấy hàng đợi chưa phân công là **đề xuất**. Không triển khai Advisor tự nhận lịch khi chưa phê duyệt.

### 7.1 POST `/admin/bookings/:id/confirm` [D04–D05]

```json
{"confirmedStartAt":"2026-11-12T09:00:00+07:00","expectedVersion":3}
```

Trong một transaction: khóa/serialize slot, xác minh quyền và trạng thái, kiểm tra phiên bản, kiểm tra sức chứa, cập nhật `CONFIRMED`, tăng version, ghi event và notification outbox. Nếu không còn suất: `409 CAPACITY_FULL`; không xác nhận một phần. Với booking chưa phân công, cần chính sách D01 trước khi cho confirm.

### 7.2 POST `/admin/bookings/:id/reschedule`

```json
{"newStartAt":"2026-11-12T10:00:00+07:00","reason":"Khách đồng ý đổi giờ","customerAgreed":true,"expectedVersion":4}
```

Kiểm tra quyền, giờ mới, bằng chứng đã liên hệ/đồng ý; chuyển suất **nguyên tử** (không giải phóng suất cũ nếu không chiếm được suất mới), lưu old/new, actor, timestamp. Không tự đổi giờ chỉ vì slot trống.

### 7.3 POST `/admin/bookings/:id/transfer`

```json
{"toAdvisorId":"uuid","reason":"Điều phối nhân sự","expectedVersion":5}
```

Manager only; một cố vấn chính tại một thời điểm; transaction cập nhật `assigned_advisor_id`, đóng assignment cũ, mở assignment mới, ghi audit, tăng version. A mất quyền sửa ngay; A chỉ xem được dữ liệu lịch sử được phép [D11]. Không cho Advisor tự sửa `assigned_advisor_id` qua PATCH chung.

### 7.4 POST `/admin/bookings/:id/no-show` [D14]

Chỉ với `CONFIRMED`, đã quá giờ hẹn cộng ngưỡng cấu hình và có kiểm tra thủ công; ghi lý do, actor. Hủy/không đến giải phóng sức chứa; trạng thái đã `ARRIVED` không được dùng hủy thông thường [D10].

## 8. Admin – tiếp nhận, tiến độ và lịch sử dịch vụ

| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/admin/bookings/:id/service-visit` | Theo scope | Chỉ lượt thực tế |
| POST | `/admin/bookings/:id/service-visit` | Manager/Advisor được giao | Khởi tạo khi `ARRIVED` |
| POST | `/admin/service-visits/:id/progress` | Manager/Advisor được giao | Thêm event tiến độ |
| PATCH | `/admin/service-visits/:id/summary` | Manager/Advisor được giao | Tóm tắt dịch vụ/ODO nếu có |
| POST | `/admin/service-visits/:id/hand-over` | Manager/Advisor được giao | Bàn giao, kiểm tra điều kiện hoàn thành |
| POST | `/admin/bookings/:id/reopen` | Manager | Ngoại lệ có lý do [D06, D10] |

Progress đề xuất: `RECEIVED`, `INSPECTING`, `WAITING_APPROVAL`, `IN_SERVICE`, `QUALITY_CHECK`, `READY_FOR_PICKUP`, `HANDED_OVER`. Danh mục và bước được bỏ qua cần duyệt [D07, D12].

```json
{"progress":"IN_SERVICE","publicUpdate":"Xe đang được thực hiện dịch vụ","internalNote":"Ghi chú chỉ nhân viên thấy","expectedCompletionAt":null,"expectedVersion":2}
```

**Bảo mật:** tách `publicUpdate` và `internalNote` ngay từ DTO, query và serializer; API khách **không bao giờ** select/serialize `internalNote`. Tiến độ chỉ được tạo cho booking đã đến. Bàn giao có event `HANDED_OVER`, điều kiện chuyển `COMPLETED` phụ thuộc D06; không tạo lịch sử dịch vụ chỉ từ `CONFIRMED`/`ARRIVED`.

## 9. Admin – sức chứa, điều phối và khách chờ

| Method | Endpoint | Quyền | Chức năng |
|---|---|---|---|
| GET | `/admin/capacity/calendar?from=&to=` | Manager | Lịch và mức tiếp nhận |
| GET/PUT | `/admin/capacity/business-hours` | Manager | Giờ làm/giờ nghỉ |
| GET/POST | `/admin/capacity/blocks` | Manager | Ngày nghỉ/đóng slot |
| PATCH/DELETE | `/admin/capacity/blocks/:id` | Manager | Sửa/xóa block có audit |
| GET/PUT | `/admin/capacity/rules` | Manager | Số suất theo slot/ngày [D05] |
| GET | `/admin/waitlist` | Manager | Danh sách chờ [D03] |
| POST | `/admin/waitlist/:id/contact` | Manager | Ghi nhận liên hệ/đồng ý |
| POST | `/admin/bookings/:id/contact-events` | Theo scope | Lưu kết quả trao đổi |

Thay đổi giờ làm/giới hạn không được âm thầm hủy lịch đã xác nhận; trả cảnh báo xung đột để Manager xử lý. Khi slot được giải phóng, chỉ **gợi ý** khách chờ; không tự chuyển lịch. Các thao tác override quá tải nếu được duyệt phải có quyền Manager, lý do và audit.

## 10. Customer Access – tra cứu an toàn [CHỐT + D08, D09]

| Method | Endpoint | Auth | Ý nghĩa |
|---|---|---|---|
| POST | `/customer-access/challenges` | Công khai, rate limit | Khởi tạo xác minh SĐT/biển số |
| POST | `/customer-access/challenges/verify` | Challenge | Xác minh OTP/token |
| POST | `/customer-access/logout` | Customer grant | Kết thúc phiên tra cứu |
| GET | `/customer-access/bookings` | Customer grant | Lịch thuộc phạm vi cấp quyền |
| GET | `/customer-access/bookings/:id` | Customer grant | Lịch và trạng thái công khai |
| GET | `/customer-access/vehicles` | Customer grant | Xe đã xác minh quan hệ |
| GET | `/customer-access/vehicles/:id/history` | Customer grant | Lịch sử dịch vụ đã công bố |

**Không mở các endpoint tra cứu lịch sử theo SĐT/biển số nếu chưa có OTP hoặc cơ chế tương đương an toàn.** Nếu chưa triển khai OTP, phương án tạm thời [D08] là link ngẫu nhiên, khó đoán, hết hạn, **chỉ cho một lịch**. Không dùng mã lịch hay biển số làm token.

Ví dụ khởi tạo:

```json
{"lookup":{"phone":"09xxxxxxxx"}}
```

Trả cùng thông điệp trung tính dù hồ sơ có tồn tại hay không; không tiết lộ danh sách xe, tên khách, số điện thoại đã che trước khi xác minh. OTP hash khi lưu, TTL và số lần thử giới hạn; grant ngắn hạn, thu hồi được, scope theo customer/vehicle/booking đã xác minh; chống enumeration và rate-limit theo IP/định danh đã băm. Dữ liệu lịch sử chỉ gồm dịch vụ DPAuto ghi nhận hoặc import đã xác thực [D09].

## 11. Admin – khách hàng, báo cáo, thông báo và audit

| Method | Endpoint | Role | Giới hạn |
|---|---|---|---|
| GET | `/admin/customers?query=` | Manager | Phân trang, tìm kiếm có kiểm soát |
| GET | `/admin/customers/:id` | Manager | Hồ sơ đầy đủ theo nghiệp vụ |
| GET | `/admin/vehicles/:id` | Manager hoặc Advisor trong lịch được giao | Scope record-level |
| GET | `/admin/reports/bookings?from=&to=` | Manager | Theo trạng thái/nguồn/cố vấn |
| GET | `/admin/reports/my-bookings?from=&to=` | Advisor | Chỉ thống kê cá nhân |
| GET | `/admin/notifications` | Nhân viên | Việc được phép xem |
| POST | `/admin/notifications/:id/read` | Nhân viên | Chỉ notification của mình |
| GET | `/admin/audit-logs` | Manager | Có phân trang, lọc, bảo vệ PII |

Quyền chỉnh sửa/gộp khách trùng phải xác minh quan hệ xe và audit; không gộp theo biển số đơn thuần. Danh mục CMS/quản lý bài viết là module riêng **chưa chốt chi tiết** [D13]; không mặc định cấp cho Advisor.

## 12. Trạng thái và bảng chuyển hợp lệ [REQ, chờ duyệt]

| Hiện tại | Hành động | Trạng thái mới | Điều kiện |
|---|---|---|---|
| `PENDING` | Confirm | `CONFIRMED` | Có người xử lý, còn suất |
| `PENDING` | Cancel | `CANCELLED` | Có quyền và lý do |
| `CONFIRMED` | Arrive | `ARRIVED` | Xe/khách đến thực tế |
| `CONFIRMED` | Cancel | `CANCELLED` | Theo chính sách |
| `CONFIRMED` | No-show | `NO_SHOW` | Đã quá ngưỡng chờ [D14] |
| `ARRIVED` | Hand-over/complete | `COMPLETED` | Có lượt phục vụ và điều kiện kết thúc [D06] |
| Terminal | Reopen | Theo ngoại lệ | Chỉ Manager, audit [D10] |

`contact_outcome` như “đang đề xuất giờ khác” không nhất thiết là booking status. Cấm API cập nhật `status` tùy ý bằng PATCH; sử dụng action endpoint để enforce state machine.

## 13. Quy tắc concurrency và transaction

| Mã | Tác vụ | Bất biến bắt buộc |
|---|---|---|
| TX-01 | Tạo booking | Booking + services + event + idempotency nguyên tử |
| TX-02 | Confirm | Lock/serialize slot; không vượt sức chứa |
| TX-03 | Reschedule | Giữ suất cũ nếu không chiếm được suất mới |
| TX-04 | Transfer | Đổi owner và assignment history nguyên tử |
| TX-05 | Progress/hand-over | Đúng trạng thái, đúng quyền, không mất event |
| TX-06 | Cancel/no-show | Giải phóng suất một lần, audit đầy đủ |
| TX-07 | Verify | OTP một lần, TTL/attempt limit, grant đúng scope |

Dùng transaction DB + row lock/slot counter hoặc cơ chế tương đương đã chứng minh; `version` cho optimistic concurrency. Outbox notification ghi trong transaction nhưng gửi ngoài transaction. Trả `409` khi client dùng phiên bản cũ; UI phải refresh trước khi thử lại, không retry mù quáng mutation.

## 14. Validation, rate limit và an toàn

- DTO schema strict; whitelist field; không cho mass assignment `role`, `assigned_advisor_id`, `status`, `capacityOverride`, `internalNote` qua API công khai.
- Rate limit riêng cho public booking, availability, login, OTP send/verify, search; giá trị số phải benchmark rồi chốt, không gán ngưỡng tùy tiện thành yêu cầu.
- Turnstile cho biểu mẫu công khai nếu triển khai; xác thực token server-side; idempotency và chống trùng vẫn cần dù có Turnstile.
- CORS chỉ origin được phép; CSRF với cookie; HTTPS; giới hạn body size; chuẩn hóa input; escape khi render; không tin header IP nếu không đến từ reverse proxy tin cậy.
- Không log OTP, token, cookie, nội dung ghi chú nhạy cảm; PII được che trong logs; phân quyền audit.
- API không trả stack trace, SQL hay cấu hình nội bộ; lỗi 5xx có requestId để đối soát.
- Thao tác nguy hiểm cần lý do và audit; lưu tối thiểu dữ liệu cần thiết.

## 15. Performance và caching

- Chỉ cache công khai `services`, `site-info`, bài viết theo TTL/invalidation được phê duyệt; **không cache công khai** booking cá nhân, lịch sử, OTP, session, Admin.
- `availability` có thể cache rất ngắn hoặc không cache; response chỉ mang tính tham khảo, mọi mutation recheck trong DB.
- List endpoints dùng index, cursor pagination, chọn cột cần thiết, không N+1; tách dashboard aggregate khỏi danh sách chi tiết.
- `Cache-Control: no-store` cho auth, customer access và dữ liệu Admin nhạy cảm. CDN không được cache theo URL chung dữ liệu cá nhân.

## 16. Hợp đồng kiểm thử API (AC)

| Mã | Kịch bản | Kỳ vọng |
|---|---|---|
| API-01 | Khách gửi booking hợp lệ | 201, `PENDING`, mã lịch không cấp quyền |
| API-02 | Double-click cùng idempotency key | Một booking duy nhất |
| API-03 | Khách gửi vào slot đóng/đầy | Không tạo booking thành công |
| API-04 | Hai cố vấn confirm suất cuối đồng thời | Chỉ một transaction thành công |
| API-05 | Advisor A đọc/sửa lịch chỉ thuộc B | 403/404 không rò dữ liệu |
| API-06 | Manager chuyển A → B | A mất quyền ghi, B có quyền |
| API-07 | A xem lịch sử đã chuyển | Chỉ thấy phần lịch sử được phép |
| API-08 | Đổi lịch sang slot đầy | Giữ nguyên giờ và suất cũ |
| API-09 | No-show trước ngưỡng | Bị từ chối |
| API-10 | Progress trước `ARRIVED` | Bị từ chối |
| API-11 | Customer API chưa xác minh | Không lộ lịch sử/tiến độ cá nhân |
| API-12 | OTP sai/hết hạn/thử quá giới hạn | Không cấp grant |
| API-13 | Customer grant xe A truy cập xe B | Bị từ chối |
| API-14 | Ghi chú nội bộ trong public serializer | Không xuất hiện |
| API-15 | Bàn giao thành công | Có event, visit, booking nhất quán |
| API-16 | Retry gửi notification lỗi | Không rollback booking, không gửi trùng ngoài chính sách |
| API-17 | Request có version cũ | 409, không ghi đè |
| API-18 | Advisor gọi endpoint Manager trực tiếp | 403 |

## 17. Ma trận traceability theo User Flow

| Flow | Endpoint chính |
|---|---|
| UF-01–03 | Public services, availability, bookings, waitlist [D03] |
| UF-04–08 | Admin bookings, confirm, reschedule, cancel, assign, transfer |
| UF-09–11 | Arrive, service visit, progress, hand-over |
| UF-12 | Customer challenges, verify, bookings, history |
| UF-13–14 | Dashboard, calendar, capacity |
| UF-15–17 | Customers, vehicles, notifications, staff, audit, reports |
| UF-18 | Version conflict, idempotency, transaction error contracts |

## 18. D01–D14: điểm khóa hợp đồng

| Mã | API bị ảnh hưởng |
|---|---|
| D01–D02 | Queue, assign, confirm, quyền tự nhận lịch |
| D03 | Waitlist public/Admin |
| D04 | Availability, pending reservation, confirm |
| D05 | Capacity rules và thuật toán slot |
| D06 | Hand-over, complete, reopen |
| D07 | Progress transition validation |
| D08 | OTP/token và customer-access |
| D09 | History scope và import provenance |
| D10 | Cancel/exception sau arrive |
| D11 | My-history serializer sau transfer |
| D12 | Progress catalog theo nhóm dịch vụ |
| D13 | CMS permission endpoints |
| D14 | No-show validation |

## 19. Điều kiện bàn giao Codex

1. Duyệt D01–D14 hoặc ghi rõ phần chưa duyệt là feature-disabled.
2. Khóa DTO, state machine, permission matrix, error codes, timezone và auth/session.
3. So khớp bảng/cột với `DATABASE_DESIGN.md`; tạo migration trước implementation.
4. Sinh OpenAPI từ DTO/schema; cập nhật khi thay đổi hợp đồng; test tích hợp DB thật và E2E browser.
5. Kiểm thử concurrency, record-level authorization, OTP enumeration, public/internal serialization, backup/restore.
6. Không tự triển khai Zalo OA hay đồng bộ hệ thống cũ.

**Kết luận:** Tài liệu là đặc tả API để review và triển khai theo phase, **không khẳng định endpoint đã tồn tại**. Các phương án chưa duyệt phải được giữ dưới feature flag hoặc hoãn đến khi chốt nghiệp vụ.
