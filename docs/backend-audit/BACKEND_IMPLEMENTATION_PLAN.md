# Kế hoạch backend DPAuto và Executive Summary

Ngày: 11/11/2026. **Báo cáo khảo sát/đề xuất**, chưa triển khai backend. Stack ưu tiên theo yêu cầu: **NestJS + Fastify + Drizzle ORM + PostgreSQL**, modular monolith. Giữ nguyên UI/design system hiện tại khi tích hợp sau này.

## Executive Summary

| Chỉ tiêu | Kết quả và cách đếm |
|---|---|
| Trang khảo sát | **47 route template page.tsx**: public11, cố vấn15, điều hành20, website admin1. Gồm1 redirect và1 placeholder; không cộng aliases, sitemap, layout hoặc mỗi slug thành template mới. |
| Chức năng khảo sát | **40 nhóm F01–F40**, gồm modal, form, filter/search/paging, drawer, editor, print và các chức năng tài liệu chưa có UI. Không phải40 endpoint hoặc40 tính năng backend đã hoàn thiện. |
| API dự kiến | **94 cặp method/path**: Public9 (gồm waitlist tùy chọn), Admin76, Customer Access7, Internal2. Bao gồm các phần hoãn P3–P5; không phải94 API MVP bắt buộc. |
| Database dự kiến | **50 bảng logic baseline**: P1=26, P2=4, P3=15, P4=2, P5=3. Có bảng kỹ thuật và mở rộng có điều kiện; chưa là schema khóa/migration. |
| MVP P1+P2 theo catalog | **51 endpoint /30 bảng** theo phân nhóm hiện tại, có thể tinh gọn sau khóa auth và semantics arrive/reception. Capacity phải đi cùng create, không hoãn P3. |
| Backend hiện tại trong source khảo sát | Chưa có business API/auth/DB implementation; public booking timer, advisor localStorage, manager state độc lập. Không xác nhận tình trạng server bên ngoài repo. |
| Quy tắc mới đã chốt | Dịch vụ/tài nguyên; tạo PENDING; PENDING giữ chỗ ngay; hard no-overbooking; concurrency-safe. |
| Blocker lớn nhất | Catalog/resource/units/duration/continuity chưa khóa; tài liệu cũ pending không giữ chỗ; role/session/scope; điều kiện handover và nguồn dữ liệu kho/tài chính. |

Bằng chứng kiểm kê route/chức năng và trạng thái source: [FRONTEND_AUDIT](FRONTEND_AUDIT.md); API [API_REQUIREMENTS](API_REQUIREMENTS.md); DB [DATABASE_REQUIREMENTS](DATABASE_REQUIREMENTS.md). Chưa chạy API, DB, test, build hoặc browser trong audit; không lấy kết quả test UI từ nhiệm vụ trước làm bằng chứng backend.

## 1. Các module và ownership đề xuất

| Module | Trách nhiệm | Phạm vi |
|---|---|---|
| Identity/Staff | Session, roles, account active, staff profile, assignment actor | P1; ca/KTV chi tiết P3 |
| Catalog | Service/category canonical, requirement version, marketing mapping | P1; CMS service content P4 |
| Customers/Vehicles | Liên hệ, xe, quan hệ có thời gian/verification, projection theo quyền | P1/P2; không auto-merge |
| Booking/Assignment | Tạo pending, confirm/reschedule/cancel/no-show, phân/chuyển cố vấn, events | P1 |
| Capacity | Pools, policy, hours, blocks, bucket locking, reservation/allocation | **P1 bắt buộc**, nguồn quyết định chỗ |
| Service Visits/Progress | Arrive/receive, tiến độ thực tế, notes riêng, bàn giao/history | P2 |
| Notifications/Audit | Outbox cùngTX, inbox đúng recipient, actor/time, audit append-only | Foundation P1, UI/read P2 |
| Reporting | Scoped aggregates và định nghĩa chỉ số, CSV bảo vệ dữ liệu | P2 cơ bản, ops/export P3 |
| Workshop/Quotes | Phiếu chi tiết, revision báo giá, thi công/checklist, nghiệm thu, KTV | P3, ngoài MVP booking cơ bản |
| Inventory/Finance | Read models UI hiện có; nguồn ledger cần duyệt riêng | P3 có điều kiện; không ERP/payment gateway |
| CMS/Public Content | Draft/revision/publish/SEO/media metadata và invalidation | P4 khi chốt D13; public static vẫn dùng được |
| Customer Access/Waitlist | OTP/token/grants, public history an toàn, chờ liên hệ | P5 có điều kiện D03/D08/D09 |
| Infrastructure | Validation/errors/requestId, health/readiness, DB/migration, metrics, backup | Từ P1; production gate trước go-live |

Modular monolith cho phép cùng transaction booking/capacity/assignment. Chưa cần microservices, message broker hoặc Redis; worker có thể cùng codebase nhưng tiến trình riêng khi cần. Cơ sở: [SYSTEM_ARCHITECTURE:96](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L96), [transactional core:233](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L233).

## 2. Phase và thứ tự phụ thuộc

| Phase | Endpoint / bảng trong catalog | Công việc chính | Điều kiện ra phase |
|---|---|---|---|
| P1 | 37 API /26 bảng | Core booking an toàn: DB riêng, identity/scope, canonical catalog và resource policies; capacity rows/holds; public và staff create; confirm/reschedule/cancel/no-show/assignment; outbox/audit foundation; probes | Hai request tạo PENDING tranh suất cuối không cùng thành công; idempotency; role/record scope; transfer thu hồi quyền; config impact; backup/restore gate trước mở thật. |
| P2 | 14 API /4 bảng | Visit tối thiểu, arrive/reception, progress công khai/nội bộ, handover, hồ sơ xe/history nội bộ, inbox/audit/báo cáo cơ bản; chuyển consumers khỏi local stores | Receive/hand-over atomic, không visit trùng hoặc lịch sử giả; A chỉ scope; không lộ internalNote; UI chỉ báo lưu sau server commit. |
| P3 | 22 API /15 bảng | CRM mở rộng: quote revisions/decision, work/KTV/checklist, acceptance, private media, staff shifts, board/alerts, kho/tài chính đọc, CSV | Chốt nguồn stock/payment trước dùng số thật; Decimal/rounding đúng; confirmed quote immutable; nghiệm thu khác handover; private media có quyền. |
| P4 | 11 API /2 bảng | CMS quyền riêng, public content endpoints, draft/publish/revision/metadata; cache invalidation | D13 được duyệt; không publish draft nhầm; sanitize nội dung; cập nhật public thật thay local state. |
| P5 | 10 API /3 bảng | Portal xác minh khách, OTP/token/grants/history; waitlist nếu duyệt | D03/D08/D09 và provider được duyệt; anti-enumeration/scope/TTL/one-use; không history công khai chỉ bằng phone/plate. |

### P0 — Chốt trước coding, không nằm trong94 endpoint

1. Trạm duyệt danh mục canonical và bảng ánh xạ IDs hiện tại: [public:35](../../src/lib/public-booking/mock.ts#L35), [advisor:15](../../src/lib/booking/seed.ts#L15), [manager:152](../../src/lib/manager/mock.ts#L152), [marketing:1](../../src/lib/content.ts#L1).
2. Chốt C01–C12 trong [capacity](BOOKING_CAPACITY_ANALYSIS.md#3-dữ-liệu-bắt-buộc-trước-khi-khóa-thiết-kế), đặc biệt intake vs execution, units, thời lượng/offset, continuity, nghỉ trưa, pending TTL và arrived overrun.
3. Chốt identity/session và RBAC, D01/D02/D11/D13; không suy role từ URL/job role. Mẫu bảng user_roles/sessions có thể đổi theo provider.
4. Chốt DTO/customer model/ODO/consent, state transitions D06/D07/D10/D12/D14, phản hồi lỗi và idempotency key lifecycle.
5. Cập nhật có phiên bản sáu tài liệu gốc sau phê duyệt; audit này không thay chúng. Sinh OpenAPI/schema contract được review trước implementation.

### Thứ tự kỹ thuật trong P1

- Tạo skeleton NestJS với Fastify adapter, config/validation/errors/requestId; Drizzle schema/migration đã review; PostgreSQL role/runtime riêng. Không mặc định chuyển cả Next repo sang monorepo; layout repo cần quyết định riêng.
- Auth/session và record scope; catalog/pool/hours/policy canonical seed do trạm duyệt, không seed khách demo ra production.
- Capacity allocator + transaction lock protocol + DB constraints; idempotency/audit/outbox foundation.
- Public availability và create gọi allocator. Staff create/action dùng **cùng** service, không tạo thuật toán carsPerSlot riêng.
- Assignment/transfer, list/detail scoped, counters/KPI đúng toàn scope. Config/buckets/blocks có impact kiểm tra đối với holds.
- Nối public modal trước, tiếp theo queue/assignment manager và list/action advisor. Không mở public booking thật trước khi nhân viên có luồng xử lý và auth hoạt động.

P1 có thể phát triển tuần tự nhiều PR nhưng không go-live nửa chừng ở trạng thái create chưa giữ chỗ. P2 là MVP phục vụ cơ bản; quote/work/acceptance chi tiết P3 không là điều kiện bắt buộc bàn giao khi chưa bật workflow đó.

## 3. Thay data adapter, bảo toàn giao diện

| Consumer hiện tại | Cách chuyển sau khi hợp đồng duyệt | Điều kiện tránh mất dữ liệu |
|---|---|---|
| Public dialog + availability fixture | Adapter GET catalog/availability, POST booking thật; giữ bước/form hiện có | Thêm notice/consent theo DTO, success theo commit; 409 giữ form, refresh slot; key giữ xuyên timeout. [dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192) |
| BookingProvider/repository cố vấn | Query scoped list/detail và command mutation, session actor | Không load seed khi HTTP lỗi; localStorage không làm nguồn dữ liệu thật. [provider:72](../../src/components/admin/booking-provider.tsx#L72), [repository:3](../../src/lib/booking/repository.ts#L3) |
| AdvisorProvider orders | Visit/quote/work/acceptance APIs theo phase; private media references | Receive và ARRIVED mộtTX; không nhập orders demo như dữ liệu khách thật. [receive:67](../../src/components/advisor/advisor-provider.tsx#L67) |
| ManagerProvider | Dùng cùng backend booking/visit/catalog; aggregate API cho dashboard | Không còn store manager tách dữ liệu advisor; scope M được backend xác thực. [manager-provider:43](../../src/components/manager/manager-provider.tsx#L43) |
| Manager CMS local | Ghi draft/revision/publication; Next đọc API public hoặc cơ chế server đã chọn | Publish invalidate cache, không chỉ đổi boolean trong state. [content-page:49](../../src/components/manager/content-page.tsx#L49) |

Không import fixtures/localStorage vào PostgreSQL. Nếu có dữ liệu thật cần chuyển từ CRM cũ, phải là nhiệm vụ import riêng có bản đồ trường, nguồn, dedup/verification, backup và đối soát được duyệt. Audit hiện không có quyền hoặc kế hoạch đồng bộ tự động CRM cũ.

## 4. Bảo mật và toàn vẹn — cần hiện thực khi coding

| Phạm vi | Yêu cầu thiết kế / failure case |
|---|---|
| Authentication | Cookie HttpOnly/Secure/SameSite phù hợp domain; session rotation/revocation; TTL và provider cần chốt. Không token trên URL/log/localStorage. Khóa account có hiệu lực request kế tiếp. |
| Authorization | Guard role + scope từng record ở query/mutation/search/count/export. A không truyền advisorId để mở rộng quyền; transfer lock booking và đổi owner/history atomic. Cố vấn cũ chỉ projection lịch sử D11. |
| CSRF/CORS/proxy | Mutation cookie có CSRF và origin checks; CORS allowlist; chỉ trust reverse proxy đã cấu hình; không tin X-Forwarded-For từ Internet trực tiếp. |
| Input/XSS/SQL | Strict DTO whitelist, bound lengths, schema numeric/time/enum; parameterized queries. Rich HTML hiện có [shared:85](../../src/components/sections/shared.tsx#L85), phải sanitize khi chuyển sang nội dung chỉnh sửa CMS. |
| Concurrency | DB transaction + ổn định lock order; version conflict; idempotency unique; policy version đồng bộ allocator; không SELECT COUNT rồi ghi ngoài lock. |
| Anti-spam | Rate limit public create/availability/login/challenge theo IP tin cậy và định danh đã băm; Turnstile nếu bật phải verify server. Threshold/TTL duyệt theo tải; không coi idempotency là chống spam key mới. |
| Privacy | Tách public/internal DTO và query; không SELECT* rồi lọc browser. Phone/plate không là khóa cấp quyền; customer/vehicle link không tự xác minh ownership. |
| Media | Server kiểm tra bytes/MIME/decode, giới hạn size/dimensions/count; private ảnh xe, signed access có hạn; không public dataURL/PII và không nhận URL tùy ý để server fetch. |
| Audit | Actor user thật, UTC time, reason, before/after allowlist, requestId; append-only role DB phù hợp; không secrets/OTP/token/ghi chú thừa trong log. |
| Outbox | Ghi cùngTX; gửi saucommit, retry/backoff/lease/dedupe; worker down không rollback lịch. Chưa gửi Zalo OA thật ở MVP. |
| Pagination/cache | Cursor ổn định, query giới hạn/sort whitelist; scope trước counts/paging; no-store nhạy cảm; CDN không cache URL chung chứa dữ liệu cá nhân. |
| Finance/inventory | Decimal snapshots và ledger nhất quán; nguồn viết cần phê duyệt; không đếm completed làm doanh thu hoặc quote confirmed làm đã xuất kho. |
| Infra/DB | DB riêng, không expose port public, least privilege runtime/migration/backup; secrets riêng bán xe; health/readiness không lộ cấu hình. |

Đây là yêu cầu kiến trúc và các khoảng trống quan sát source, không kết luận hệ thống công ty đang vận hành có lỗ hổng đã khai thác. Nguồn yêu cầu an toàn: [API_SPEC:276](../../technical-documentation/API_SPEC.md#L276), [architecture:170](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L170), [DB read model:440](../../technical-documentation/DATABASE_DESIGN.md#L440).

## 5. Kế hoạch kiểm thử tương lai theo Minimal Testing

**Không chạy trong audit này.** Khi triển khai API/database/auth cần test liên quan đủ để chứng minh tính toàn vẹn; vẫn tuân thủ AGENTS.md: phạm vi hẹp, không chạy trùng check đã pass, tối đa2 lần sửa/chạy lại sau lần lỗi đầu. Full suite/E2E/browser/Lighthouse/benchmark/production build cần yêu cầu hoặc duyệt riêng.

| Thay đổi sẽ triển khai | Kiểm thử liên quan cần có |
|---|---|
| Create/confirm/reschedule/cancel | Integration với PostgreSQL thật cho pending hold, multi-bucket/multi-pool, double-click/idempotency, last-unit race, rollback, confirm không trừ lần2, release một lần. |
| Auth/transfer | Role/record negative tests; filter/search/count/export không rò; transfer đồng thời với save; account revoked; CSRF. |
| Policy/shift/catalog | Policy thay đổi đồng thời submit; capacity giảm dưới held, đóng ngày, dịch vụ tắt, qua trưa/timezone; không sửa snapshot cũ. |
| Receive/progress/hand-over | Unique visit, TX arrive+visit; không progress trước arrived; public không internalNote; acceptance không tự complete; handover nhất quán. |
| Quote/work/inventory/finance | Decimal/rounding, revision conflict/approval đúng bản, start/finish guards, tồn/issued và thu tiền không bị suy từ stage. |
| OTP/grant | Enumeration, TTL/attempt/one-use đồng thời, token scope, đổi ID xe/booking, logout/revoke. |
| CMS/media | Publish revision/invalidation, HTML sanitation, scope, bytes/MIME/size/private asset access. |

Test core concurrency cần vào phase trước go-live; kiểm thử toàn diện, restore rehearsal hoặc load test là gate production phải được tổ chức trong nhiệm vụ được duyệt, không tự chạy vì có nhắc trong lộ trình này.

## 6. Mở rộng có chủ đích

| Hướng sau này | Chuẩn bị hợp lý từ đầu | Chưa đưa vào MVP |
|---|---|---|
| Lịch sử bảo dưỡng | Vehicle ID, visit thực tế, completedAt, summary có provenance; nextServiceDue optional | Tự suy lịch sử cũ, import không kiểm chứng, warranty workflow |
| Phân KTV | Staff profile ID tách user/role, service resource requirements; P3 assignments/shift | Chấm công/lương/tối ưu lịch tự động |
| Báo giá | Visit là aggregate gốc, các stage độc lập; P3 revisions/Decimal | Invoice/accounting/payment gateway |
| Zalo OA | Event/outbox, consent, dedupe/eventkey, adapter boundary | OA credentials/tự gửi/webhook production khi chưa phê duyệt |
| Android/iOS | API versioning, DTO/error/idempotency/record scope ổn định | App/native auth/token flows cụ thể chưa chọn |
| Nhiều chi nhánh | Station scope ở booking/resource/config, ID bền vững; xác định dữ liệu dùng chung | Branch switching/cross-branch ACL/capacity pooling; cần yêu cầu riêng trước bật |

Chưa cần đánh đổi MVP để xây hết khả năng tương lai; ID, version, timestamps, module boundaries và event/audit là nền đủ để mở rộng có kiểm soát.

## 7. Hồ sơ bàn giao và bước tiếp theo

1. [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md) —47 route,40 nhóm, stores/fields/validation/states.
2. [FEATURE_API_MAPPING.md](FEATURE_API_MAPPING.md) — trace UI↔API↔dữ liệu, reverse mapping94 endpoint.
3. [API_REQUIREMENTS.md](API_REQUIREMENTS.md) —94 endpoint, role/input/output/validation/error/phase/consumer.
4. [DATABASE_REQUIREMENTS.md](DATABASE_REQUIREMENTS.md) —50 bảng, field/types/FK/unique/index/invariants/provenance.
5. [BOOKING_CAPACITY_ANALYSIS.md](BOOKING_CAPACITY_ANALYSIS.md) — pending holds, thuật toán/resource/locks/TX và thông số còn thiếu.
6. [DOCUMENT_GAP_ANALYSIS.md](DOCUMENT_GAP_ANALYSIS.md) —24 điểm đối chiếu, D01–D14 và blocker.
7. Tài liệu hiện tại — thứ tự implementation, bảo mật, phase và production gates.

**Việc tiếp theo nên làm:** duyệt P0 (catalog/resource/time/pending lifecycle, identity/RBAC và handover) rồi khóa OpenAPI/schema P1 trước khi giao coding. Không cần quay lại quyết định pending có giữ chỗ hay không — điều đó đã được xác nhận trong yêu cầu audit mới.

**Kết quả nhiệm vụ này:** chỉ thêm bảy file Markdown; không sửa source/tài liệu kỹ thuật gốc, không cài package, tạo API/database hoặc chạy migration. Chỉ rà tĩnh phạm vi và các tham chiếu báo cáo; không báo cáo test/build/browser “pass” khi không chạy.

