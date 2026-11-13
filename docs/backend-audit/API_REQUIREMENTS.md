# Yêu cầu API đề xuất

Ngày: 11/11/2026. **94 cặp method + path đề xuất**, chưa có API nghiệp vụ được triển khai trong phạm vi source đã khảo sát. Đây là catalog phục vụ review, không phải hợp đồng đã khóa. Không cộng từng query filter hoặc từng role thành endpoint mới.

## 1. Phạm vi và quy ước

- Base path đề xuất `/api/v1`; mọi path bên dưới đều tương đối với base này. `Internal` chỉ dành hạ tầng, không expose Internet. Worker outbox chạy service nội bộ, không cần endpoint công khai “run job”.
- **M** = Manager; **A** = Advisor có assignment hợp lệ; **CMS** = quyền quản trị nội dung còn cần chốt D13, không mặc định là M/A. Customer grant là phạm vi xác minh khách, không role Admin. Tài liệu cũ chỉ có2 role [API_SPEC:36](../../technical-documentation/API_SPEC.md#L36), còn `/admin` mới là [placeholder:1](../../src/app/admin/page.tsx#L1).
- P1: core booking/auth/capacity; P2: xử lý và tiến độ cơ bản; P3: mở rộng CRM/điều hành đã có UI; P4: CMS khi duyệt; P5: portal xác minh/waitlist tùy chọn. **MVP đặt lịch không bao gồm toàn bộ94 API**. Chi tiết gate ở kế hoạch.
- Danh sách/paging là response `{data:[...],page:{nextCursor,hasMore},meta:{requestId,asOf}}`. Mặc định20, tối đa100 là **đề xuất**, không lấy page6/page8 UI làm giới hạn API cố định.
- GET/PATCH/PUT/action POST mặc định200; endpoint tạo mới ghi rõ201; logout/delete204; gửi challenge202. Header `Cache-Control:no-store` cho nội bộ, auth và customer access. Nội dung public cache có invalidation.
- Mỗi hàng bên dưới có request, response, validation/business rule, lỗi riêng và consumer Fxx kèm vị trí. Các profile lỗi/validation chung ở mục2–3 áp dụng **thêm** cho từng hàng.

## 2. Validation và hợp đồng chung

**DTO tạo lịch đề xuất**:

| Trường | Bắt buộc | Quy tắc server |
|---|---|---|
| customer.name | Có | Trim, min2/max100 phù hợp UI; không mất dấu tiếng Việt. |
| customer.phone | Có | Chuẩn hóa VN về một dạng canonical; max24 raw theo UI; kiểm tra số thực hợp lệ về định dạng. Định dạng không là xác minh chủ thuê bao. |
| vehicle.model / plate | Không với public | Model max100, plate max20 theo UI; normalize plate, không dùng làm quyền hoặc unique toàn DB. Nhân viên đang bắt model, cần thống nhất trước khóa DTO. |
| serviceIds | Có | Mảng không rỗng, UUID canonical, loại trùng, active/bookable, có resource requirement hợp lệ. Không nhận ID fixture từ browser như m1/maintenance làm UUID thật. |
| requestedStartAt | Có | ISO8601 có offset; server quy đổi giờ trạm, kiểm tra slotgrid, lead/advance, giờ mở, nghỉ và capacity. |
| note | Không | Max1000 theo popup; plain text, không tin HTML. Internal note có DTO và quyền riêng. |
| privacyNoticeVersion/acknowledged | Có theo tài liệu, UI cần bổ sung | Phiên bản notice tồn tại, acknowledgement đúng; tách marketingConsent tùy chọn mặc địnhfalse. |
| source/status/actor/owner | Server hoặc DTO staff được kiểm soát | Public không mass-assign role/owner/status/capacityOverride; source từ kênh tin cậy. A tự tạo không được mạo danh A khác. |
| Idempotency-Key | Có với create/action dễ lặp | Key giới hạn độ dài; scope server; fingerprint canonical payload; cùng key khác payload409. TTL cần chốt. |

Nguồn field/limits: [booking-steps:27](../../src/components/public-booking/booking-steps.tsx#L27), [dialog:414](../../src/components/public-booking/booking-dialog.tsx#L414), [validateCustomer:134](../../src/lib/public-booking/mock.ts#L134), [booking-form:121](../../src/components/admin/booking-form.tsx#L121), [API_SPEC:89](../../technical-documentation/API_SPEC.md#L89). Các mức chưa được duyệt vẫn là đề xuất; không tự coi regex FE là đủ backend.

**Mọi mutation nội bộ:** session+CSRF/origin hợp lệ, strict object schema không field lạ, UUID/FK tồn tại trong scope, expectedVersion với hồ sơ trọng yếu, kiểm tra trạng thái hiện hành sau lock. Reason bắt buộc cho chuyển người, đổi/hủy, cấu hình và ngoại lệ. Cấm generic PATCH status/role/owner ngoài action tương ứng.

**Mọi list:** from<=to, timezone station, range tối đa cần chốt theo tải; limit/cursor hợp lệ; sort và enum whitelist; query độ dài giới hạn; scope DB trước search/count/paging. Sắp xếp có tie-break ID để cursor ổn định. Không tính KPI trên page đang trả. SQL parameterized, không đưa tên cột sort từ client trực tiếp vào SQL.

## 3. Lỗi và bảo mật bắt buộc

Response thành công `{data,meta:{requestId}}`; lỗi `{error:{code,message,fields?,requestId}}`. Không trả stack trace/SQL/token. Lỗi 5xx log requestId và dữ liệu đã che.

| Profile áp dụng mọi endpoint liên quan | HTTP / mã |
|---|---|
| JSON/schema/query sai; semantic validation | 400 BAD_REQUEST; 422 VALIDATION_FAILED |
| Admin/customer session hoặc quyền không hợp lệ | 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND trong scope nếu cần chống dò |
| Version/status/unique/idempotency | 409 VERSION_CONFLICT / INVALID_TRANSITION / IDEMPOTENCY_CONFLICT |
| Capacity thay đổi trong lúc submit | 409 CAPACITY_FULL; 422 SLOT_CLOSED / OUTSIDE_BUSINESS_HOURS |
| Abuse/size/media | 429 RATE_LIMITED (+Retry-After phù hợp); 413 PAYLOAD_TOO_LARGE; 415 UNSUPPORTED_MEDIA_TYPE |
| Phụ thuộc/hạ tầng | 503 SERVICE_UNAVAILABLE; 500 INTERNAL_ERROR đã che chi tiết |

Các lỗi ở từng hàng là lỗi đặc thù **bổ sung**, không thay profile chung. Mọi endpoint ngoài probe có thể gặp503; mọi endpoint nội bộ có401/403. Không retry mù quáng mutation sau timeout: gửi lại cùng key hoặc refresh version theo tình huống.

## 4. Catalog endpoint


### Public

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| PUB01<br>**GET** `/public/services` | Public; P1 | không | Dịch vụ active, ID/code, thời lượng, version | Chỉ bookable; không có PII | 503 | F07: [src/lib/public-booking/mock.ts:35](../../src/lib/public-booking/mock.ts#L35) |
| PUB02<br>**GET** `/public/services/:slug` | Public; P4 | slug | Nội dung/ảnh dịch vụ published | Slug tồn tại; ánh xạ marketing sang catalog | 404 | F02: [src/app/(public)/services/[slug]/page.tsx:6](../../src/app/(public)/services/[slug]/page.tsx#L6) |
| PUB03<br>**GET** `/public/availability` | Public; P1 | date,serviceIds[] | Timezone, policyVersion, slots(startAt,endAt,status,reasonCode) | Ngày trong cửa sổ; dịch vụ active; kiểm tra mọi tài nguyên; không trả lịch khách | 422,429 | F08: [src/components/public-booking/booking-schedule.tsx:131](../../src/components/public-booking/booking-schedule.tsx#L131) |
| PUB04<br>**POST** `/public/bookings` | Public; P1 | customer{name,phone},vehicle?{model,plate},serviceIds[],requestedStartAt,note?,noticeVersion,acknowledged,marketingConsent?; Idempotency-Key | 201 bookingCode,PENDING,requestedStartAt,HELD | Transaction tạo lịch và giữ chỗ ngay; server xác định source; DTO mục2 | 409 CAPACITY_FULL/IDEMPOTENCY_CONFLICT,422,429 | F09: [src/components/public-booking/booking-dialog.tsx:192](../../src/components/public-booking/booking-dialog.tsx#L192) |
| PUB05<br>**GET** `/public/site-info` | Public; P4 | không | Tên trạm, hotline, địa chỉ, giờ, mapsLink | Chỉ trường công khai đã duyệt | 503 | F01: [src/lib/content.ts:1](../../src/lib/content.ts#L1) |
| PUB06<br>**GET** `/public/posts` | Public; P4 | cursor,limit,q? | Danh sách bài published + page | Không trả draft, sort publishedAt/id | 422 | F03: [src/app/(public)/news/[slug]/page.tsx:10](../../src/app/(public)/news/[slug]/page.tsx#L10) |
| PUB07<br>**GET** `/public/posts/:slug` | Public; P4 | slug | Bài published, SEO, media | Slug tồn tại, sanitize nội dung, invalidate sau publish | 404 | F03: [src/app/(public)/news/[slug]/page.tsx:10](../../src/app/(public)/news/[slug]/page.tsx#L10) |
| PUB08<br>**GET** `/public/pages/:key` | Public; P4 | key whitelist | Blocks/revision published | Home/about/contact/privacy/terms; không nội dung nội bộ | 404 | F01: [src/lib/content.ts:1](../../src/lib/content.ts#L1) |

### Admin — API nội bộ nghiệp vụ

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| AUTH01<br>**POST** `/admin/auth/login` | Nhân viên chưa đăng nhập; P1 | Credential theo identity provider cần chốt | Phiên HttpOnly và hồ sơ tối thiểu | Account active, rate limit, lỗi trung tính; không tự chốt password auth | 401,429 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| AUTH02<br>**POST** `/admin/auth/logout` | M/A/CMS nếu duyệt; P1 | session,CSRF | 204 thu hồi phiên | Idempotent, xóa cookie, không chỉ quay về public | 401 | F22: [src/components/admin/secondary-pages.tsx:8](../../src/components/admin/secondary-pages.tsx#L8) |
| AUTH03<br>**GET** `/admin/auth/me` | M/A/CMS nếu duyệt; P1 | session | ID, roles, profile, permissions | Không password/hash; từng API vẫn kiểm tra quyền | 401 | F22: [src/components/admin/secondary-pages.tsx:8](../../src/components/admin/secondary-pages.tsx#L8) |
| STF01<br>**GET** `/admin/staff` | M; A projection bản thân; P1 | role?,active?,date?,cursor,limit | Nhân sự, khả dụng, workload | Job role không là auth role; A không duyệt mọi hồ sơ | 403,422 | F28: [src/components/manager/catalog-pages.tsx:277](../../src/components/manager/catalog-pages.tsx#L277) |
| STF02<br>**POST** `/admin/staff` | M; P1 | name,phone,email,jobRole,active; invite nếu duyệt | 201 hồ sơ nhân sự | Tên/phone/email hợp lệ; email đăng nhập unique; không tự cấp CMS role | 409 EMAIL_CONFLICT,422 | F28: [src/components/manager/catalog-pages.tsx:277](../../src/components/manager/catalog-pages.tsx#L277) |
| STF03<br>**PATCH** `/admin/staff/:id` | M; P1 | profile,active,reason,expectedVersion; authRole whitelist nếu duyệt | Hồ sơ/version | Khóa phải thu hồi quyền; lịch còn phụ trách cần chuyển giao; audit | 409 ASSIGNMENTS_REMAIN/VERSION_CONFLICT,422 | F28: [src/components/manager/catalog-pages.tsx:277](../../src/components/manager/catalog-pages.tsx#L277) |
| STF04<br>**GET** `/admin/staff-shifts` | M; P3 | from,to,role?,staffId?,cursor,limit | Ca và trạng thái khả dụng | Range hợp lệ; ca không là chấm công | 422 | F29: [src/components/manager/staff-schedule.tsx:22](../../src/components/manager/staff-schedule.tsx#L22) |
| STF05<br>**POST** `/admin/staff-shifts` | M; P3 | staffId,startAt,endAt,state,reason | 201 ca | Nhân sự hợp lệ, start<end, reason; kiểm tra overlap và capacity impact | 409 SHIFT_OVERLAP/CAPACITY_IMPACT,422 | F29: [src/components/manager/staff-schedule.tsx:22](../../src/components/manager/staff-schedule.tsx#L22) |
| STF06<br>**PATCH** `/admin/staff-shifts/:id` | M; P3 | Trường ca được phép,expectedVersion | Ca/version/impact | Không tự bỏ pending hold khi đổi ca | 409,422 | F29: [src/components/manager/staff-schedule.tsx:22](../../src/components/manager/staff-schedule.tsx#L22) |
| CAT01<br>**GET** `/admin/services` | M/A readonly; P1 | q?,active?,categoryId?,cursor,limit | Services, categories, requirements, version | Không PII; một catalog dùng chung | 422 | F27: [src/components/manager/catalog-pages.tsx:22](../../src/components/manager/catalog-pages.tsx#L22) |
| CAT02<br>**POST** `/admin/services` | M; P1 | code,name,categoryId,durationMinutes,active,requirements[] | 201 dịch vụ | Duration/units>0, pool tồn tại; 15..1440 hiện chỉ giới hạn UI | 409 CODE_CONFLICT,422 | F27: [src/components/manager/catalog-pages.tsx:22](../../src/components/manager/catalog-pages.tsx#L22) |
| CAT03<br>**PATCH** `/admin/services/:id` | M; P1 | patch whitelist,reason,expectedVersion | Dịch vụ/version/impact | Không sửa snapshot lịch cũ; requirement có hiệu lực/version | 409 CAPACITY_IMPACT,422 | F27: [src/components/manager/catalog-pages.tsx:22](../../src/components/manager/catalog-pages.tsx#L22) |
| BKG01<br>**GET** `/admin/bookings` | M/A scoped; P1 | from,to,q?,status?,serviceId?,categoryId?,advisorId?,source?,changeKind?,sort?,cursor,limit | Items,nextCursor,scoped counts | Scope trước paging; checkedin là tập status; advisorId không mở rộng quyền | 422 | F11: [src/components/admin/booking-detail.tsx:16](../../src/components/admin/booking-detail.tsx#L16) |
| BKG02<br>**GET** `/admin/bookings/:id` | M/A scoped; P1 | id | Lịch, customer/vehicle projection, services, holds, version, allowedActions | Scope tại DB; không lấy permission từ client | 404 | F11: [src/components/admin/booking-detail.tsx:16](../../src/components/admin/booking-detail.tsx#L16) |
| BKG03<br>**POST** `/admin/bookings` | M/A; P1 | customerId hoặc contact mới,vehicleId hoặc xe?,serviceIds,startAt,source,notes?; Idempotency-Key | 201 PENDING,holds,version | A tự giao mình; M theo D01; kiểm tra capacity như public; không confirm ngầm | 409 CAPACITY_FULL,422 | F12: [src/components/admin/booking-form.tsx:121](../../src/components/admin/booking-form.tsx#L121) |
| BKG04<br>**PATCH** `/admin/bookings/:id` | M/A hiện phụ trách; P1 | contact/vehicle/notes/serviceIds? whitelist,reason,expectedVersion | Lịch/version | Cấm status/owner; đổi dịch vụ replan hold trong TX; không auto-merge phone | 409 CAPACITY_FULL/INVALID_TRANSITION,422 | F12: [src/components/admin/booking-form.tsx:121](../../src/components/admin/booking-form.tsx#L121) |
| BKG05<br>**POST** `/admin/bookings/:id/confirm` | M/A hiện phụ trách; P1 | confirmedStartAt,customerAgreed,reason?,expectedVersion | CONFIRMED,holds,version | Cùng giờ không trừ lần2; khác giờ chuyển hold atomic; đồng ý khách | 409 INVALID_TRANSITION/CAPACITY_FULL,422 | F13: [src/components/admin/booking-actions.tsx:22](../../src/components/admin/booking-actions.tsx#L22) |
| BKG06<br>**POST** `/admin/bookings/:id/reschedule` | M/A hiện phụ trách; P1 | newStartAt,reason,customerAgreed,expectedVersion | Giờ mới,hold,version,old/new event | Pending/confirmed; lỗi giữ nguyên toàn bộ giờ/hold cũ | 409 CAPACITY_FULL,422 | F14: [src/components/admin/booking-actions.tsx:102](../../src/components/admin/booking-actions.tsx#L102) |
| BKG07<br>**POST** `/admin/bookings/:id/cancel` | M/A hiện phụ trách; P1 | reason,expectedVersion; Idempotency-Key | CANCELLED,version | Pending/confirmed; release một lần; sau arrived cần ngoại lệ riêng | 409 INVALID_TRANSITION,422 | F13: [src/components/admin/booking-actions.tsx:22](../../src/components/admin/booking-actions.tsx#L22) |
| BKG08<br>**POST** `/admin/bookings/:id/no-show` | M/A hiện phụ trách; P1 | reason,expectedVersion | NO_SHOW,version | Confirmed, sau giờ+grace, kiểm tra nhân viên; không tự động | 409 INVALID_TRANSITION,422 TOO_EARLY | F13: [src/components/admin/booking-actions.tsx:22](../../src/components/admin/booking-actions.tsx#L22) |
| BKG09<br>**POST** `/admin/bookings/:id/arrive` | M/A hiện phụ trách; P2 | actualArrivalAt?,expectedVersion; Idempotency-Key | ARRIVED,visitId,RECEIVED | Một TX tạo visit tối thiểu; form tiếp nhận dùng VIS03 không tạo bản2 | 409 INVALID_TRANSITION,422 | F16: [src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) |
| BKG10<br>**POST** `/admin/bookings/:id/assign` | M; P1 | advisorId,reason,expectedVersion | Owner và assignment | Chưa giao mới assign; staff active/khả dụng theo policy; một owner | 409 ALREADY_ASSIGNED,422 ADVISOR_UNAVAILABLE | F25: [src/components/manager/order-drawer.tsx:46](../../src/components/manager/order-drawer.tsx#L46) |
| BKG11<br>**POST** `/admin/bookings/:id/transfer` | M; P1 | toAdvisorId,reason,expectedVersion | Owner và assignment history | Đóng cũ/mở mới atomic; advisor cũ mất quyền ghi; visit liên quan nhất quán | 409,422 | F25: [src/components/manager/order-drawer.tsx:46](../../src/components/manager/order-drawer.tsx#L46) |
| BKG12<br>**GET** `/admin/bookings/:id/events` | M/A scoped; P1 | cursor,limit | Events,actor,time,old/new | Advisor cũ chỉ projection được duyệt D11 | 404 | F11: [src/components/admin/booking-detail.tsx:16](../../src/components/admin/booking-detail.tsx#L16) |
| BKG13<br>**GET** `/admin/my-history` | A; P2 | from,to,q?,cursor,limit | Lịch từng phụ trách, readonly | Không trả ghi chú mới sau transfer; D11 cần duyệt | 422 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| BKG14<br>**POST** `/admin/bookings/:id/contact-events` | M/A scoped; P2 | channel,outcome,proposedStartAt?,customerAccepted?,note? | 201 event liên hệ | Enum/độ dài; proposal không tự đổi slot; actor server | 409,422 | F14: [src/components/admin/booking-actions.tsx:102](../../src/components/admin/booking-actions.tsx#L102) |
| CAP01<br>**GET** `/admin/capacity/calendar` | M; P1 | from,to,poolId?,categoryId? | Buckets,capacity,held,free,blocks,refs | Đơn vị rõ ràng; không suy ra giờ hoàn tất xe | 422 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP02<br>**GET** `/admin/capacity/policy` | M; P1 | không | Giờ làm,pools,requirements,rules,version | Pool khác category; một read model cấu hình | 403 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP03<br>**PUT** `/admin/capacity/policy` | M; P1 | intervals,pools,effectiveDates,lead,maxAdvance,noShowGrace,reason,expectedVersion | Policy/version/impact | Không chồng hiệu lực; không xóa hold; từ chối giảm dưới held | 409 CAPACITY_IMPACT,422 | F36: [src/components/manager/system-pages.tsx:17](../../src/components/manager/system-pages.tsx#L17) |
| CAP04<br>**POST** `/admin/capacity/days` | M; P1 | date,templateVersion,reason; Idempotency-Key | Buckets cho ngày | Lý do kỹ thuật: hàng khóa phải tồn tại; unique pool/start; không copy reserved | 409 DAY_ALREADY_INITIALIZED,422 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP05<br>**PATCH** `/admin/capacity/buckets/:id` | M; P1 | capacityUnits,closed?,reason,expectedVersion | Bucket/version/impact | Units đúng pool, >=0; khóa hàng; held không vượt limit | 409 CAPACITY_IMPACT,422 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP06<br>**GET** `/admin/capacity/blocks` | M; P1 | from,to,poolId? | Ngày nghỉ/đóng slot | Range hợp lệ, không ghi khi xem | 422 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP07<br>**POST** `/admin/capacity/blocks` | M; P1 | startsAt,endsAt,poolId?,reason | 201 block/impact | Start<end; giải quyết lịch bị ảnh hưởng, không hủy âm thầm | 409 CAPACITY_IMPACT,422 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CAP08<br>**DELETE** `/admin/capacity/blocks/:id` | M; P1 | reason,expectedVersion | 204 | Audit mở lại; không tự kích hoạt dịch vụ đã tắt | 404,409 | F26: [src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) |
| CUS01<br>**GET** `/admin/customers` | M/A scoped; P1 | q?,cursor,limit | Tóm tắt khách và xe được phép | A chỉ liên quan assignment; phone không unique | 422 | F15: [src/components/admin/customers-workspace.tsx:134](../../src/components/admin/customers-workspace.tsx#L134) |
| CUS02<br>**GET** `/admin/customers/:id` | M/A scoped; P1 | id,cursor? | Hồ sơ, xe/lịch/visit được phép | Tách lịch hẹn và lịch sử làm dịch vụ; không lộ sau transfer | 404 | F30: [src/components/manager/customers-page.tsx:24](../../src/components/manager/customers-page.tsx#L24) |
| CUS03<br>**GET** `/admin/vehicles/:id` | M/A scoped; P2 | id,historyCursor? | Xe, verified links, visits được phép | Plate không là PK/grant; chuyển chủ không tự cấp quyền history | 404 | F15: [src/components/admin/customers-workspace.tsx:134](../../src/components/admin/customers-workspace.tsx#L134) |
| VIS01<br>**GET** `/admin/service-visits` | M/A scoped; P2 | q,from,to,stage,advisorId?,technicianId?,overdue?,quoteStatus?,cursor,limit | Phiếu và summaries | Filter trước paging, dateBasis=receivedAt | 422 | F17: [src/components/advisor/order-detail-page.tsx:32](../../src/components/advisor/order-detail-page.tsx#L32) |
| VIS02<br>**GET** `/admin/service-visits/:id` | M/A scoped; P2 | id | Visit,reception,version,actions | Public progress riêng; nội bộ chỉ staff được phép | 404 | F17: [src/components/advisor/order-detail-page.tsx:32](../../src/components/advisor/order-detail-page.tsx#L32) |
| VIS03<br>**POST** `/admin/bookings/:id/service-visit` | M/A scoped; P2 | odo?,request,conditions?,checks?,note?,mediaIds[],expectedVersion; Idempotency-Key | Visit,ARRIVED,RECEIVED | Confirmed→arrived mộtTX; bổ sung visit tối thiểu nếu đã arrive; ODO UI bắt buộc nhưng docs optional cần chốt | 409 VISIT_EXISTS/INVALID_TRANSITION,422 | F16: [src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) |
| VIS04<br>**PATCH** `/admin/service-visits/:id/summary` | M/A scoped; P2 | publicSummary?,internalSummary?,odo?,nextServiceDueAt?,expectedVersion | Visit/version | Whitelist; ODO>=0; không công bố nội bộ | 409,422 | F16: [src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) |
| VIS05<br>**POST** `/admin/service-visits/:id/progress` | M/A scoped; P2 | progressCode,publicMessage?,internalNote?,estimatedFinishAt?,expectedVersion | Event/currentProgress/version | Arrived; catalog D07/D12; serializer public riêng | 409 INVALID_TRANSITION,422 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| VIS06<br>**POST** `/admin/service-visits/:id/hand-over` | M/A scoped; P2 | summary,actualAt?,reason?,expectedVersion; Idempotency-Key | Visit đóng + booking COMPLETED + events | Bàn giao thật; MVP chưa bật CRM không bắt quote/work; không suy ra đã trả tiền | 409 NOT_READY/INVALID_TRANSITION,422 | F20: [src/components/advisor/acceptance-editor.tsx:20](../../src/components/advisor/acceptance-editor.tsx#L20) |
| VIS07<br>**POST** `/admin/service-visits/:id/assignment` | M; P3 | advisorId?,technicianId?,reason,expectedVersion | Assignment,event,version | Advisor chuyển bằng booking TX; KTV dùng staff ID; kiểm tra nghỉ/active | 409,422 STAFF_UNAVAILABLE | F25: [src/components/manager/order-drawer.tsx:46](../../src/components/manager/order-drawer.tsx#L46) |
| MED01<br>**POST** `/admin/service-visits/:id/media` | M/A scoped; P3 | multipart file,kind=reception | 201 mediaId,previewURL có quyền | Đề xuất kỹ thuật thay dataURL; decode/MIME/size/max6 cần duyệt; object private | 403,413,415,422 | F16: [src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) |
| QTE01<br>**GET** `/admin/service-visits/:id/quote` | M/A scoped; P3 | revision? | Quote/revision/lines/totals/status/version | Server Decimal, không lộ giá vốn | 404 | F18: [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) |
| QTE02<br>**PUT** `/admin/service-visits/:id/quote` | M/A scoped; P3 | lines[kind,serviceId?/partId?,name,unit,qty,price,discountPct,vatPct],discountPct,note?,expectedVersion | Draft revision + totals | Nonempty lines,qty>0,price>=0,%0..100; confirmed immutable | 409 QUOTE_LOCKED,422 | F18: [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) |
| QTE03<br>**POST** `/admin/service-visits/:id/quote/submit` | M/A scoped; P3 | revisionId,expectedVersion | WAITING revision | Validate snapshot; cố định revision khách đang xem | 409 INVALID_TRANSITION,422 | F18: [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) |
| QTE04<br>**POST** `/admin/service-visits/:id/quote/decision` | M/A scoped; P3 | revisionId,decision,evidence,expectedVersion | CONFIRMED/REJECTED và audit | Nhân viên ghi nhận khách đồng ý, không phải chữ ký số; bằng chứng cần chốt | 409 REVISION_CONFLICT,422 | F18: [src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) |
| WRK01<br>**PATCH** `/admin/service-visits/:id/work` | M/A scoped; P3 | technicianId?,dueAt?,progress?,checklist[],note?,expectedVersion | Work/version | Progress0..100, ID hợp lệ, stage guard server | 409,422 | F19: [src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) |
| WRK02<br>**POST** `/admin/service-visits/:id/work/start` | M/A scoped; P3 | technicianId,dueAt,expectedVersion | startedAt,WORK | Quote confirmed, staff active, thời điểm hợp lệ, allocation nếu áp dụng | 409 QUOTE_NOT_CONFIRMED,422 | F19: [src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) |
| WRK03<br>**POST** `/admin/service-visits/:id/work/logs` | M/A scoped; P3 | message,expectedVersion | 201 log/time/actor | Nonempty bounded, append-only | 409,422 | F19: [src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) |
| WRK04<br>**POST** `/admin/service-visits/:id/work/finish` | M/A scoped; P3 | expectedVersion | ACCEPTANCE | Progress100 và checklist đủ; quote được duyệt còn hiệu lực | 409 WORK_INCOMPLETE | F19: [src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) |
| ACP01<br>**PUT** `/admin/service-visits/:id/acceptance` | M/A scoped; P3 | inspectorStaffId?,result,checks[],note?,expectedVersion | Checklist/version | Result/IDs hợp lệ; tồn kho thực khác snapshot | 409,422 | F20: [src/components/advisor/acceptance-editor.tsx:20](../../src/components/advisor/acceptance-editor.tsx#L20) |
| ACP02<br>**POST** `/admin/service-visits/:id/acceptance/complete` | M/A scoped; P3 | expectedVersion | Acceptance PASSED,readyAt | Stage đúng,100%,checks không rỗng/allpassed,inspector; chưa bàn giao | 409 ACCEPTANCE_INCOMPLETE/PARTS_MISSING | F20: [src/components/advisor/acceptance-editor.tsx:20](../../src/components/advisor/acceptance-editor.tsx#L20) |
| OPS01<br>**GET** `/admin/operations` | M; P3 | from,to,stage?,staff?,priority?,quoteStatus?,changed?,cursor,limit | Board counts và paged cards | Nối booking/visit/quote; count toàn bộ scope, không chỉ page | 422 | F31: [src/components/manager/operations-page.tsx:31](../../src/components/manager/operations-page.tsx#L31) |
| OPS02<br>**GET** `/admin/alerts` | M; A alerts scoped; P3 | date?,priority?,type?,cursor,limit | Cảnh báo/reason/target/asOf | Threshold được duyệt; alert không tự sửa booking | 422 | F35: [src/lib/manager/operations.ts:133](../../src/lib/manager/operations.ts#L133) |
| INV01<br>**GET** `/admin/parts` | M; A quote projection; P3 | q?,lowOnly?,cursor,limit | Code,name,unit,price?,onHand,reorderPoint | Tồn từ ledger, không snapshot; A không giá vốn | 422 | F33: [src/components/manager/resource-pages.tsx:208](../../src/components/manager/resource-pages.tsx#L208) |
| INV02<br>**GET** `/admin/inventory/movements` | M; P3 | from,to,partId?,cursor,limit | Loại,qty,source,actor,time | Read-only theo UI; nguồn ghi kho cần chốt riêng | 422 | F33: [src/components/manager/resource-pages.tsx:208](../../src/components/manager/resource-pages.tsx#L208) |
| INV03<br>**GET** `/admin/inventory/requests` | M; P3 | visitId?,status?,cursor,limit | Required,issued,remaining | Issued khác reserved; không xuất kho khi confirm quote | 422 | F33: [src/components/manager/resource-pages.tsx:208](../../src/components/manager/resource-pages.tsx#L208) |
| FIN01<br>**GET** `/admin/finance/summary` | M; P3 | from,to,advisorId?,q?,debtOnly?,dateBasis,cursor,limit | Approved quote,deposit,collected,outstanding,rows,asOf | Quote không là thực thu; Decimal; nguồn payment cần chốt | 422 UNSUPPORTED_DATE_BASIS | F34: [src/components/manager/resource-pages.tsx:15](../../src/components/manager/resource-pages.tsx#L15) |
| RPT01<br>**GET** `/admin/reports` | M/A own scoped; P2 | from,to,report=bookings/operations,groupBy?,dateBasis? | Counts,rates,series,definitions,asOf | A chỉ báo cáo mình; mẫu số và cơ sở ngày rõ ràng | 422 | F23: [src/components/manager/dashboard.tsx:20](../../src/components/manager/dashboard.tsx#L20) |
| RPT02<br>**GET** `/admin/reports/export` | M; P3 | Filters hợp quyền,format=csv | CSV snapshot | Escape formula injection, giới hạn range, audit export | 422,429 | F23: [src/components/manager/dashboard.tsx:20](../../src/components/manager/dashboard.tsx#L20) |
| NOT01<br>**GET** `/admin/notifications` | M/A recipient; P2 | unreadOnly?,cursor,limit | Inbox/readAt/entityLink | Recipient scope; mở target kiểm tra quyền hiện tại | 422 | F37: [src/components/manager/system-pages.tsx:184](../../src/components/manager/system-pages.tsx#L184) |
| NOT02<br>**POST** `/admin/notifications/:id/read` | M/A recipient; P2 | không hoặc read=true | readAt | Idempotent; không mark inbox người khác | 404 | F37: [src/components/manager/system-pages.tsx:184](../../src/components/manager/system-pages.tsx#L184) |
| AUD01<br>**GET** `/admin/audit-logs` | M; P2 | from,to,actorId?,action?,entity?,cursor,limit | Events đã che PII | Append-only; không secrets; scope bảo vệ audit | 403,422 | F37: [src/components/manager/system-pages.tsx:184](../../src/components/manager/system-pages.tsx#L184) |
| SET01<br>**GET** `/admin/site-settings` | M/CMS nếu duyệt; P1 | không | Thông tin public/version | Không provider secrets; capacity dùng CAP02 | 403 | F36: [src/components/manager/system-pages.tsx:17](../../src/components/manager/system-pages.tsx#L17) |
| SET02<br>**PUT** `/admin/site-settings` | M; CMS content nếu duyệt; P1 | name,address,phone,publicLinks?,reason,expectedVersion | Settings/version | Normalize phone, URL allowlist; không mass-assign capacity | 409,422 | F36: [src/components/manager/system-pages.tsx:17](../../src/components/manager/system-pages.tsx#L17) |
| CMS01<br>**GET** `/admin/content` | CMS/M nếu D13 duyệt; P4 | kind,q?,cursor,limit | Draft/published metadata/revision | A không được cấp; route /admin không chứng minh role | 403,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| CMS02<br>**POST** `/admin/content` | CMS/M nếu D13 duyệt; P4 | kind=news,title,slug,description,body,mediaId? | 201 draft | UI limits120/160/5000; slug unique; sanitize | 409 SLUG_CONFLICT,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| CMS03<br>**PATCH** `/admin/content/:id` | CMS/M nếu D13 duyệt; P4 | Fields whitelist,expectedVersion | Draft revision | Kind immutable; media dùng MEDCMS02; kiểm tra URL/references | 409,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| CMS04<br>**POST** `/admin/content/:id/publication` | CMS/M nếu D13 duyệt; P4 | published,revisionId,expectedVersion | Published revision/state | Publish atomic+invalidation/revalidate; không tự ghi JSON nguồn | 409,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| MEDCMS01<br>**GET** `/admin/media` | CMS/M nếu D13 duyệt; P4 | q?,cursor,limit | Media public và metadata | Không trộn ảnh tiếp nhận private | 403,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |
| MEDCMS02<br>**PATCH** `/admin/media/:id` | CMS/M nếu D13 duyệt; P4 | title,alt,description?,expectedVersion | Metadata/version | Theo UI chỉ sửa mô tả, không tự thêm CMS upload | 409,422 | F38: [src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) |

### Customer Access — public challenge / grant

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| CAC01<br>**POST** `/customer-access/challenges` | Public; P5 | phone hoặc lookup đã duyệt,purpose | 202 neutral,challenge handle | Rate limit, không lộ tồn tại; chưa có provider thì disabled | 429,503 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC02<br>**POST** `/customer-access/challenges/verify` | Challenge; P5 | challengeId,otp/token | Scoped grant,HttpOnly,expiresAt | Hash/TTL/attempt cap/one-use; không cấp admin role | 401 INVALID_CHALLENGE,429 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC03<br>**POST** `/customer-access/logout` | Customer grant; P5 | session | 204 revoke | Thu hồi idempotent | 401 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC04<br>**GET** `/customer-access/bookings` | Customer grant; P5 | cursor,limit | Public booking projections | Scope grant, không tự suy từ phone | 401,403 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC05<br>**GET** `/customer-access/bookings/:id` | Customer grant; P5 | id | Booking/public progress | Không internal notes; một booking grant không mở lịch khác | 404 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC06<br>**GET** `/customer-access/vehicles` | Customer grant; P5 | cursor,limit | Verified vehicle projections | Quan hệ/quãng thời gian đã xác minh; plate không là quyền | 401,403 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| CAC07<br>**GET** `/customer-access/vehicles/:id/history` | Customer grant; P5 | id,cursor,limit | Completed published visits | Provenance được xác minh; không tự import CRM | 404 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |

### Public

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| WAI01<br>**POST** `/public/waitlist` | Public; P5 | contact,serviceIds,desiredRange,contactPermission | 201 WAITING/code | UF03 đề xuất; D03 gate; không giữ slot, không fallback overbook | 422,429 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |

### Admin — API nội bộ nghiệp vụ

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| WAI02<br>**GET** `/admin/waitlist` | M; P5 | range,status,cursor,limit | Waitlist requests | D03 gate; PENDING đã giữ chỗ không phải waitlist | 422 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| WAI03<br>**POST** `/admin/waitlist/:id/contact` | M; P5 | outcome,customerAccepted,proposedAt?,note? | Event/status | Không tự convert confirmed; tạo booking qua capacity TX | 409,422 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |

### Internal — đề xuất kỹ thuật

| ID / method / endpoint | Quyền / ưu tiên | Request | Response / mục đích | Validation và business rule | Lỗi riêng | Consumer và căn cứ |
|---|---|---|---|---|---|---|
| INT01<br>**GET** `/internal/health/live` | Probe hạ tầng allowlist; P1 | không | 200 up | Kỹ thuật theo architecture §13, không public secrets | 503 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |
| INT02<br>**GET** `/internal/health/ready` | Probe hạ tầng allowlist; P1 | không | 200 ready | DB/migration tương thích; không trả SQL/connection string | 503 | F40: [technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) |

## 5. Các điểm cần khóa trước coding

- PENDING giữ chỗ ngay: PUB04 và BKG03 cùng gọi transactional capacity service; BKG05 cùng giờ không trừ lần2. Xem [phân tích capacity](BOOKING_CAPACITY_ANALYSIS.md).
- BKG09 và VIS03 là hai entry point cho tiếp nhận nhanh/form đầy đủ; không được tạo2 visit. Đề xuất unique booking_id và thao tác bổ sung visit tối thiểu. Chốt rõ semantics create/enrich trước OpenAPI; nếu chọn chỉ một entry point thì bỏ endpoint còn lại khi khóa hợp đồng và cập nhật số lượng.
- `GET /admin/reports?report=bookings` có thể phục vụ KPI /co-van và /dieu-hanh; không tạo endpoint riêng mỗi thẻ. Operations/quote/finance read models tách để không tải mọi PII cùng dashboard.
- Nhóm F40 tham chiếu yêu cầu tài liệu, không khẳng định có trang login/OTP/waitlist. Nguồn chi tiết: [API_SPEC:115](../../technical-documentation/API_SPEC.md#L115), [API_SPEC:177](../../technical-documentation/API_SPEC.md#L177), [API_SPEC:211](../../technical-documentation/API_SPEC.md#L211), [API_SPEC:196](../../technical-documentation/API_SPEC.md#L196), [SYSTEM_ARCHITECTURE:256](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L256).
- CAT02/03 là nơi cấu hình requirements/resource pools qua DTO đề xuất; UI hiện chưa nhập đầy đủ. CAP02/03 là read/write aggregate cấu hình, không nhất thiết CRUD riêng mỗi bảng.
- INV*/FIN01 chỉ đọc theo UI hiện tại. Nguồn ghi inventory/payment phải được duyệt: module nhập liệu hoặc tích hợp có kiểm soát, không mặc định đồng bộ CRM cũ. Không có payment gateway, xuất hóa đơn hay endpoint thu tiền trong catalog này.
- Chưa đề xuất CMS upload mới, PDF generation service, ecommerce, Google Reviews scraper, drag-drop hoặc auto no-show vì UI/source không yêu cầu. Reception media upload là nhu cầu kỹ thuật cụ thể từ F16; có thể hoãn P3 và giữ MVP không upload.
- Reopen sau arrived/completed được nhắc trong API_SPEC cũ nhưng chưa có flow/policy UI rõ; hoãn dưới D10, không mở generic status patch để lách. OTP và waitlist có cơ sở tài liệu nhưng disabled cho tới duyệt/provider sẵn sàng.

## 6. Tiêu chí tích hợp frontend

Tạo adapter HTTP chung sau khi hợp đồng được duyệt, thay repository/timer/state mutation từng luồng; giữ UI đang có. Không đưa JWT/PII store vào localStorage. Mutation thành công invalidate detail/list/KPI liên quan; 409 giữ form và cho tải lại; 401 clear session cache; 403/404 sau transfer không hiện dữ liệu cũ. UI loading/empty/error/success được phân biệt như [FRONTEND_AUDIT](FRONTEND_AUDIT.md#5-loading-empty-error-success-theo-luồng).

Không có endpoint nào được tạo hoặc gọi trong nhiệm vụ audit.

