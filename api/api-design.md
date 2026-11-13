> Cập nhật 13/11/2026: [Đặt lịch V1 theo số chỗ mỗi khung giờ](booking-slots-v1.md) thay thế cơ chế phân bổ tài nguyên và cấu hình năng lực trong tài liệu này. Quản trị website nằm tại `/admin`.

# DPAuto — API Design theo từng Phase

> **Phiên bản:** 1.1 — Thiết kế chi tiết và bản triển khai Phase 1  
> **Ngày:** 12/11/2026 — Asia/Saigon  
> **Phạm vi lượt này:** hợp đồng API và schema Phase 1 — Identity, catalog, customers, booking & capacity.  
> **Trạng thái:** khuyến nghị Phase 0 đã được chủ dự án duyệt ngày 12/11/2026; Phase 1 contract-ready, chưa triển khai backend.  
> **Đầu ra:** chỉ cập nhật `api/api-design.md`. Đề bài gốc được giữ cuối file để tiếp tục các phase sau.

> **Cập nhật implementation 13/11/2026:** đã triển khai mã backend Phase 1–6 và adapter frontend có feature gate; 130 endpoint, 76 bảng nghiệp vụ + metadata migration. Chủ dự án chọn giá vốn bình quân gia quyền sau mỗi lần nhập; không có quyền bỏ qua tiền phải thu. Phase 5 thêm operations/CMS/inbox; Phase 6 thêm staging/đối soát lịch sử CRM, khóa ghi, backup/restore và gate cutover. **Chưa có export CRM thật nên chưa nhập/chuyển dữ liệu hoặc cutover.** Xem [Phase 2](phase2-implementation.md), [Phase 3](phase3-implementation.md), [Phase 4](phase4-implementation.md), [Phase 5](phase5-implementation.md), [Phase 6](phase6-implementation.md), [hướng dẫn chạy](../backend/README.md). Các ghi chú “chưa implementation”/“proposed” phía dưới là trạng thái ở lượt thiết kế. Chưa deploy/migrate DB công ty hoặc cấu hình thay thông số vận hành thật; OTP/customer portal/waitlist/native vẫn ngoài phạm vi đã duyệt.

## 1. Executive Summary & Scope

### 1.1. Quyết định đã có và quy ước đọc

- **confirmed business decision:** DPAuto mới thay toàn bộ CRM cũ; một backend/PostgreSQL phục vụ public, `/co-van`, `/dieu-hanh` và quyền website admin; DB độc lập hệ thống bán xe.
- **confirmed business decision:** public create tạo `PENDING` và giữ chỗ ngay cùng transaction; giới hạn theo dịch vụ/tài nguyên thực; không overbooking ở public, nội bộ, walk-in allocation, đổi giờ hoặc sửa cấu hình.
- **confirmed business decision:** walk-in tạo visit không booking; các trục lịch hẹn, lượt phục vụ, thi công, nghiệm thu, thanh toán và tiến độ công khai độc lập.
- **confirmed business decision:** hướng stack NestJS + Fastify + TypeScript + Drizzle + PostgreSQL, modular monolith; giữ UI hiện có.
- **confirmed in source:** chức năng/field quan sát trong code, có link vị trí; có thể vẫn là prototype.
- **proposed:** thiết kế kỹ thuật hoặc quy tắc khuyến nghị trong tài liệu này; chưa là quyết định vận hành được duyệt.
- **needs approval:** lựa chọn ảnh hưởng schema, quyền, thời lượng, chứng từ hoặc go-live; tra mục 16.

Nguồn của quyết định mới là đề bài gốc được chủ dự án giao thực hiện Phase 0 trong lượt12/11/2026. Các ý kiến cũ “pending không giữ chỗ”, “walk-in tạo booking”, “kho/tài chính chỉ đọc và có thể hoãn sau thay CRM” không còn là target. Approval hướng không tự cung cấp số cầu, định mức từng dịch vụ, giờ vận hành, giá hoặc dữ liệu legacy; chúng là input cấu hình thực, không dùng fixtures.

**Kết quả hiện tại:** Phase 0 đã được duyệt. Thiết kế Phase 1 có **46 endpoint, 33 bảng**, DTO/response profiles, critical-flow JSON, scope/transactions/allocator và test specifications. Đây là đầu ra thiết kế của api-design; chưa tạo backend, database hoặc migration. Phần P2–P6 vẫn là target roadmap để tiếp tục thiết kế.

### 1.2. Nguồn đã đối chiếu và giới hạn

| Nguồn | Vai trò / kết luận |
|---|---|
| [FRONTEND_AUDIT](../docs/backend-audit/FRONTEND_AUDIT.md) | 47 template/40 nhóm; kiểm tra lại provider/types/form hiện hành. |
| [FEATURE_API_MAPPING](../docs/backend-audit/FEATURE_API_MAPPING.md) | Trace F01–F40 và old endpoint IDs; mục2 dưới phân kỳ lại40 nhóm. |
| [API_REQUIREMENTS](../docs/backend-audit/API_REQUIREMENTS.md) | 94 endpoint là baseline đề xuất; mục8 rà lại toàn bộ theo ID và module. |
| [DATABASE_REQUIREMENTS](../docs/backend-audit/DATABASE_REQUIREMENTS.md) | 50 bảng baseline; mục11 giải thích thay đổi trọng yếu, chưa khóa số bảng mới. |
| [BOOKING_CAPACITY_ANALYSIS](../docs/backend-audit/BOOKING_CAPACITY_ANALYSIS.md) | C01–C12, nhiều pool/bucket, pending hold, locking và giới hạn pool đồng nhất. |
| [DOCUMENT_GAP_ANALYSIS](../docs/backend-audit/DOCUMENT_GAP_ANALYSIS.md) | D01–D14, các mâu thuẫn chính; giữ nguyên các quyết định chưa duyệt. |
| [BACKEND_IMPLEMENTATION_PLAN](../docs/backend-audit/BACKEND_IMPLEMENTATION_PLAN.md) | Roadmap cũ booking MVP; thay phân kỳ theo target thay CRM toàn phần. |
| [REQUIREMENTS](../technical-documentation/REQUIREMENTS.md), [BUSINESS_RULES](../technical-documentation/BUSINESS_RULES.md), [USER_FLOW](../technical-documentation/USER_FLOW.md) | Nền nghiệp vụ; pending/no-overbook/walk-in dùng quyết định mới. |
| [DATABASE_DESIGN](../technical-documentation/DATABASE_DESIGN.md), [API_SPEC](../technical-documentation/API_SPEC.md), [SYSTEM_ARCHITECTURE](../technical-documentation/SYSTEM_ARCHITECTURE.md) | Thiết kế cũ để đối chiếu, không là backend đang chạy. |
| [Khảo sát CRM cũ](../docs/research/KHAO-SAT-CRM-DPAUTO.md) | Chỉ các màn mở được với tài khoản CVDV; form/chứng từ đã đọc, server mutation/export/DB chưa kiểm chứng. |
| Source hiện hành | Các bằng chứng theo từng mục; kiểm kê lại vẫn47 page.tsx; không thấy business route handler/auth trong cây source khảo sát. |

Không thiếu file nào trong bảy audit và sáu tài liệu yêu cầu đọc. Những tài liệu handoff/requirements tên khác được metadata cũ nhắc tới không tự được coi là nguồn mới hơn. **Còn thiếu bằng chứng:** schema/export/API/khóa ngoại/khối lượng dữ liệu CRM thật; phạm vi ngoài quyền CVDV; các quyết định nghiệp vụ trong mục 16. Không truy cập CRM trực tiếp, không đọc secrets hoặc thử ghi dữ liệu trong Phase 0.

### 1.3. Ba mốc bàn giao

| Mốc | Phải có | Chưa phải kết luận được phép thay CRM |
|---|---|---|
| **must-have for first go-live** | Auth và scope; catalog/resource đã duyệt; capacity transaction; public + advisor + manager chung nguồn; queue liên hệ/assignment; audit/outbox, xử lý timeout, backup/restore và vận hành hỗ trợ. | Chỉ được mở các dịch vụ có footprint đã duyệt. Luồng mới có thể chạy pilot hạn chế; hồ sơ đang làm tiếp tục ở hệ thống sở hữu đã chỉ định. |
| **must-have before CRM cutover** | Walk-in/visit/media; quote revisions và duyệt; thi công/checklist; nghiệm thu/bàn giao; nhập/xuất/trả/kiểm kê; cọc/thu/hoàn/nợ; báo cáo/chứng từ cần dùng; scope quản trị; chuyển và đối soát dữ liệu; training/runbook/rollback. | Mục tiêu thay CRM đầy đủ chỉ đạt khi gate P2–P6 tương ứng được nghiệm thu. Chức năng cũ chưa rõ phải khảo sát/quyết định, không âm thầm bỏ. |
| **post-cutover, nếu duyệt** | OTP/portal khách, waitlist, app native, automation Zalo, đa chi nhánh, gateway/e-invoice và các tích hợp chưa chốt. | Nếu chủ trạm xác định mục nào cần ngay cutover, phải chuyển gate trước khi khóa release. |

CMS/website nội dung đang static có thể phục vụ first go-live; nếu nhân viên cần tự quản trị nội dung tại cutover thì CMS là gate P5. Chưa coi Zalo, e-invoice hoặc sổ kế toán pháp định là điều kiện mặc định của cutover.

### 1.4. Hiệu lực phê duyệt và phạm vi thay đổi

Chủ dự án đã duyệt toàn bộ khuyến nghị Phase 0 bằng tin nhắn ngày 12/11/2026 và yêu cầu thực hiện Phase 1. Mục7,8.3,9,10.5,11.4,12.1,14.1 và 16.3 là hợp đồng Phase 1 chi tiết; các mô tả baseline/target ở phần còn lại không thay thế những quy tắc này. Không coi approval khuyến nghị là approval mọi option đối nghịch hoặc đã có dữ liệu vận hành thực.

Phạm vi edit chỉ api/api-design.md; không có caller source/tests/fixtures/config/export cần sửa trong lượt **thiết kế**. Callers sẽ phải đổi khi implementation được liệt kê ở12.1. api không còn bị .gitignore loại trừ theo thay đổi bạn đã thực hiện; nhiệm vụ này không sửa .gitignore.


## 2. Current State vs Target State

### 2.1. Những sai khác ảnh hưởng schema ngay

| Hiện trạng có bằng chứng | Target / ảnh hưởng Phase 0 |
|---|---|
| Public submit bằng timer: [src/components/public-booking/booking-dialog.tsx:192](../src/components/public-booking/booking-dialog.tsx#L192) | Create có receipt/idempotency/hold server; thành công sau commit. |
| Booking lưu localStorage, phiếu ở store riêng: [src/lib/booking/repository.ts:3](../src/lib/booking/repository.ts#L3), [src/components/advisor/advisor-provider.tsx:18](../src/components/advisor/advisor-provider.tsx#L18) | Một DB; nhận xe và booking arrival cùng transaction. |
| Visit hiện bắt bookingId và receive tra booking: [src/lib/advisor/types.ts:24](../src/lib/advisor/types.ts#L24), [src/components/advisor/advisor-provider.tsx:67](../src/components/advisor/advisor-provider.tsx#L67) | Visit.booking_id nullable; visit có customer/vehicle/station/owner riêng; walk-in có quyền và idempotency độc lập. |
| Manager state khởi tạo seed: [src/components/manager/manager-provider.tsx:43](../src/components/manager/manager-provider.tsx#L43) | Advisor và manager đọc cùng aggregate, khác projection/scope. |
| Cố vấn được “Vẫn lưu lịch” khi overlap: [src/components/admin/booking-form.tsx:134](../src/components/admin/booking-form.tsx#L134) | Bỏ đường bypass khi tích hợp; allocator server từ chối thiếu tài nguyên. |
| Catalog public/advisor/manager khác ID và thời lượng: [src/lib/public-booking/mock.ts:35](../src/lib/public-booking/mock.ts#L35), [src/lib/booking/seed.ts:15](../src/lib/booking/seed.ts#L15), [src/lib/manager/mock.ts:152](../src/lib/manager/mock.ts#L152) | Canonical service IDs do DB tạo; mapping thủ công được duyệt, snapshot giữ lịch sử. |
| Kho và finance mới đọc dữ liệu mẫu: [src/components/manager/resource-pages.tsx:15](../src/components/manager/resource-pages.tsx#L15), [src/components/manager/resource-pages.tsx:208](../src/components/manager/resource-pages.tsx#L208) | Trước cutover có write commands và ledger; source chứng từ/cost/receipt được duyệt. |
| Quote dùng Number, stock snapshot và done nghiệm thu: [src/lib/advisor/seed.ts:146](../src/lib/advisor/seed.ts#L146), [src/components/advisor/acceptance-editor.tsx:14](../src/components/advisor/acceptance-editor.tsx#L14) | Decimal và revision bất biến, issued thực từ kho; nghiệm thu/ready/handed-over/payment tách riêng. |
| CMS local publish và public JSON: [src/components/manager/content-page.tsx:49](../src/components/manager/content-page.tsx#L49), [src/lib/content.ts:1](../src/lib/content.ts#L1) | Publish có revision và invalidation; quyền CMS rõ ràng. |

### 2.2. Đối chiếu CRM cũ

Theo [docs/research/KHAO-SAT-CRM-DPAUTO.md:61](../docs/research/KHAO-SAT-CRM-DPAUTO.md#L61), CRM cũ có booking, walk-in, phiếu, báo giá, thi công, xuất phụ tùng, nghiệm thu và thu/cọc. Có checklist công việc dự kiến tách báo giá; nhiều KTV; bản in khách không hiện giá nhập. Khảo sát [docs/research/KHAO-SAT-CRM-DPAUTO.md:475](../docs/research/KHAO-SAT-CRM-DPAUTO.md#L475) nêu chưa xác minh cách ghi/sửa tiền, stock consistency hoặc API/export.

Target cần bảo toàn các khả năng công việc thực sự cần, chưa sao chép nguyên schema/UI cũ. Đưa quick quote chưa visit, công việc dự kiến riêng, giá vốn, cờ đối tác/công nợ Toàn Trung, mẫu in, Excel import/export và bảo hành vào Q08 để xác định cần tại cutover hay chấp nhận khác. Không coi chúng đã được miễn trừ.

### 2.3. Rà lại40 nhóm chức năng

Fxx giữ nguyên định danh từ audit. Bảng ghi đích và dependency; không khẳng định đã viết lại API.

| ID / nhóm audit | Phase target | Giữ / thay đổi |
|---|---|---|
| F01 — Nội dung trang chủ, about, contact, pháp lý | P5 | Public content/site info; giữ static đến khi CMS được duyệt |
| F02 — Dịch vụ public | P1/P5 | Catalog booking chung, marketing detail tách published content |
| F03 — Tin tức public | P5 | CMS revision/publish và public posts |
| F04 — Công trình và ảnh trước/sau | Giữ hiện tại | Project slider/static, chưa CRUD nếu không có yêu cầu cutover |
| F05 — Phụ kiện, thương hiệu, đánh giá, FAQ | Giữ hiện tại | FAQ/brand/review/accessory links; không ecommerce trong Phase 0 |
| F06 — Popup thông tin khách và xe | P1 | Contact/vehicle DTO và consent, không merge theo phone |
| F07 — Chọn nhiều dịch vụ | P1 | Canonical service/requirement version |
| F08 — Lịch và availability | P1 | Availability theo footprint, chỉ gợi ý trước submit |
| F09 — Gửi và thành công đặt lịch | P1 | Create PENDING+hold+idempotency cùng TX |
| F10 — Tổng quan cố vấn | P1/P5 | Today list/scoped counts; ops KPI đầy đủ P5 |
| F11 — Danh sách và chi tiết lịch cố vấn | P1 | Booking list/detail/actions/events scoped |
| F12 — Tạo/sửa lịch cố vấn | P1 | Staff create/edit dùng chung allocator |
| F13 — Xác nhận, hủy, không đến | P1/P3 | Confirm/cancel/no-show P1; handover thật P3 |
| F14 — Đổi giờ cố vấn | P1 | Reschedule/contact outcome, giữ hold cũ nếu lỗi |
| F15 — Khách và hồ sơ xe cố vấn | P1/P2 | Customer/vehicle scope có visit ownership khi walk-in |
| F16 — Tiếp nhận và nháp | P2 | Thêm walk-in và nullable booking; intake/media private |
| F17 — Danh sách/chi tiết phiếu | P2 | Visit aggregate độc lập, mỗi lần quay lại là visit mới liên kết |
| F18 — Soạn báo giá và quyết định khách | P3 | Revision/decision/change order bất biến; quick quote cần Q08 |
| F19 — Thi công và nhật ký | P3 | Work items tách quote lines nếu thực tế cần; KTV ID/assignment |
| F20 — Nghiệm thu và chờ bàn giao | P3/P4 | Acceptance/ready/handover tách riêng, payment gate cần duyệt |
| F21 — In báo giá/biên bản | P3/P4 | In đúng revision; thêm chứng từ kho/thu trước cutover nếu cần |
| F22 — Tài khoản và tùy chọn | P1 | Session actor thật; theme tiếp tục local |
| F23 — Dashboard/báo cáo quản lý | P5 | KPI date basis/mẫu số; cash/quote/debt khác nhau |
| F24 — Lịch quản lý và drawer hành động | P1 | Manager queue/list/actions cùng Booking API |
| F25 — Phân/chuyển cố vấn | P1/P2/P3 | Booking và walk-in visit transfer có quyền/owner hiện hành |
| F26 — Năng lực phục vụ | P1 | Pool/bucket/allocation; giảm dưới holds trả impact |
| F27 — Danh mục dịch vụ quản lý | P1 | Catalog và mapping, snapshot/version |
| F28 — Nhân sự quản lý | P1 | Staff profile khác user/auth role; không tự cấp job role quyền |
| F29 — Ca làm và nghỉ | P5 | Ca/availability; nếu capacity phụ thuộc ca thì kéo input tối thiểu lên P1 |
| F30 — Khách/xe toàn trạm | P1/P2 | Chuẩn hóa khách/xe, history visit có provenance |
| F31 — Điều phối công việc | P5 | Operations read model trên booking/visit/work/stock/payment |
| F32 — Theo dõi phiếu và báo giá quản lý | P2/P3 | Phiếu/quote canonical, không nhân bản manager store |
| F33 — Kho và yêu cầu phụ tùng | P4 | Bổ sung receipt/issue/return/reservation/stocktake write+ledger |
| F34 — Tài chính tổng hợp | P4 | Bổ sung collect/deposit/refund/reversal/receipt và đối soát |
| F35 — Trung tâm cảnh báo | P5 | Alert policy và asOf rõ ràng, không tự no-show |
| F36 — Cấu hình trạm | P1/P5 | Capacity/hours tối thiểu P1; settings public/CMS P5 |
| F37 — Thông báo và nhật ký | P1/P5 | Audit/outbox foundation P1, inbox/notification adapter P5 |
| F38 — CMS nội dung/bài/ảnh/SEO | P5 | CMS scope/revision/publication/invalidation |
| F39 — Admin website và route cũ | P1/P5 | Routes không cấp quyền; /admin vẫn placeholder tới khi CMS xây |
| F40 — Auth, tra cứu an toàn, waitlist và vận hành backend còn thiếu | P1/P6+ | Auth/security core P1; verified portal/waitlist sau cutover nếu duyệt |

## 3. Architecture & Module Boundaries

**Đề xuất dùng để khóa thiết kế:** một API modular monolith và PostgreSQL transaction chung. Frontend public/cố vấn/manager dùng HTTP API; scope và serializer theo actor. Dùng ASCII để trình bày ngay trong file:

```text
Public / co-van / dieu-hanh / admin
                 |
           API /api/v1
                 |
  Identity + permissions + station scope
                 |
 Catalog ---- Booking <----> Capacity
                 |              ^
 Customers ---- Visits ---------|
                 |
      Quotes / Work / Acceptance / Handover
                 |                 |
          Inventory ledger    Payment ledger
                 |                 |
            Reports / Operations
                 |
      Audit + transactional outbox
                 |
      Worker / notification adapters
                 |
           PostgreSQL DPAuto
```

Sơ đồ biểu diễn dependency nghiệp vụ; worker cũng dùng DB, không chạy transaction booking qua HTTP nội bộ. Kho/tài chính có aggregate riêng nhưng cùng DB, có thể tham gia transaction với visit khi cần. Notification provider chạy sau commit.

| Module sở hữu dữ liệu | Aggregate / trách nhiệm | Dependency được phép |
|---|---|---|
| Identity/Staff | User, session, staff, permission assignment | Module khác nhận actor xác thực, không tin client role. |
| Catalog | Service, category, resource requirement version | Booking/visit lấy snapshot, không sửa catalog từ command giao dịch. |
| Customers/Vehicles | Contact, vehicle, relationship/history | Booking/visit tham chiếu ID; thay ownership cần audit/xác minh. |
| Booking/Assignment | Requested appointment và advisor assignment | Capacity allocator trong cùng TX; khách/xe/catalog qua kiểm tra domain. |
| Capacity | Policy, pool/resources, bucket, reservation/allocation | Booking hoặc visit là chủ reservation; giữ/release/replan API service chung. |
| Visits | Intake, visit owner, stage, public progress, handover | Booking optional; work/quote/stock/payment cung cấp guard. |
| Quotes/Workshop/Acceptance | Revision và decision; work items/logs; inspection | Visit cần tồn tại hoặc quick quote đã được duyệt làm nhánh riêng; không tự ghi kho/thu. |
| Inventory | Chứng từ/kho/stock reservation/immutable ledger | Visit/approved requirements tham chiếu; command xuất có phiên bản và stock lock. |
| Payments | Payment/allocations/refund/reversal/receipt | Booking deposit chưa có visit phải có subject hợp lệ; visit không tự suy ra đã trả. |
| CMS/Reporting/Notifications | Public content, read models, inbox/outbox adapters | Không thành nguồn quyết định capacity hoặc số tiền thực thu. |
| Migration | Mapping/provenance/batch/reconciliation | Dùng command/import boundary có validation; không ghi thẳng bypass invariant. |

Không chọn microservices/broker/Redis làm prerequisite. Cấu trúc package/thư mục backend, identity provider và endpoint chi tiết quyết định ở Phase 1 sau Q01; không tạo skeleton trong Phase 0.

## 4. Actors, Roles, Permissions

### 4.1. Persona và scope

- **Persona đã có căn cứ:** khách, cố vấn dịch vụ, quản lý cửa hàng, admin website.
- **Job role trong mô hình mục tiêu:** KTV, kho, thu ngân; có thể do một người kiêm nhiệm. Không mặc nhiên tạo tài khoản hoặc auth role tương ứng.
- **Đề xuất auth:** `MANAGER`, `ADVISOR`; `CMS_ADMIN` chỉ sau D13. Quyền kho/thu tiền/KTV gắn permission bundle được Q02 duyệt; không mặc định manager được tạo mọi quyền.
- **Customer grant:** quyền đọc một booking/vehicle history đã xác minh; không là staff role.
- **System worker/migration operator:** danh tính kỹ thuật riêng, quyền giới hạn; không mượn session nhân viên.

**Scope đề xuất:** actor được phép tại station hiện hành; A đọc/ghi booking đang giao cho mình và visit đang phụ trách. Walk-in visit phải có advisor owner ngay hoặc vào queue Manager nhìn thấy theo Q03. Query khách/xe của A dùng hợp các assignment booking/visit được phép; không gắn quyền walk-in qua booking không tồn tại. Bàn giao owner giữa booking/visit đang hoạt động có một command kiểm soát và history, không hai dropdown ghi độc lập.

### 4.2. Ma trận quyền theo hướng đã duyệt

Dấu * = cần permission chuyên biệt/Q02; “scope” là record/station scope từ server.

| Resource/action | Public/customer | Advisor | Manager | KTV/kho/thu ngân được cấp quyền | CMS admin |
|---|---|---|---|---|---|
| Public services/availability/create | Public tối thiểu; create không lộ record khác | Có thể dùng read public | Có thể dùng read public | Không cần quyền staff | Không tự cấp quyền lịch |
| Booking list/detail/search/count | Customer grant đúng lịch nếu bật | Scope hiện phụ trách | Toàn station được giao | Chỉ projection liên quan công việc nếu duyệt | Không |
| Staff create/confirm/reschedule/cancel/no-show | Không public mutation ngoài create | Scope; tạo tự giao mình đề xuất D01 | Theo station/policy | Không mặc định | Không |
| Booking/visit assign/transfer, queue chưa giao | Không | Không tự nhận khi D02 chưa duyệt | Có, reason+history | Không | Không |
| Walk-in receive và visit notes/progress | Không | Visit tự phụ trách theo Q03 | Có trong station | KTV chỉ work/public update khi cấp cụ thể | Không |
| Quote soạn/submit/ghi nhận khách duyệt | Khách xem bản được cấp nếu có grant | Scope, quyền quote được duyệt | Scope | Không mặc định; giá vốn cần permission riêng* | Không |
| Work/checklist/log | Không | Scope | Scope | KTV chỉ assignment được giao* | Không |
| Stock post receipt/issue/return/stocktake | Không | Chỉ request/đọc availability nếu duyệt* | Không mặc nhiên thay quyền kho* | Inventory permission* | Không |
| Collect/deposit/refund/reversal | Không | Nếu được cấp cashier permission* | Duyệt điều chỉnh theo policy* | Cashier permission*, refund/reversal approval riêng | Không |
| Acceptance/ready/handover | Không | Scope và guard D06/Q06 | Scope và guard | Inspector permission* nếu có | Không |
| Station capacity/policy/user permission | Không | Không | Capacity; quản trị quyền cần authority Q02 | Không | Không mặc định |
| CMS draft/publish/public media | Chỉ published | Không | Chỉ nếu có permission CMS | Không | Theo D13 |
| Audit/export/report | Không | Báo cáo/history scope được duyệt | Station scope, PII projection | Chỉ sổ/read model chức năng được giao* | Chỉ CMS audit nếu duyệt |

Không kiểm tra quyền chỉ từ URL hoặc `advisorId` gửi lên. Account disable/revoke phải có hiệu lực request sau commit. Mutation khóa aggregate rồi kiểm tra scope/version hiện hành để transfer không bị race với editor cũ.

**Negative cases cần test khi triển khai:** A truy cập ID của B; thay advisorId query/body; mở visit walk-in chưa được giao; KTV tự nâng quyền thu; CMS đọc giá vốn; customer grant sửa URL sang xe khác; export/count làm lộ record ngoài scope; session cũ sau disable; A lưu tab cũ sau transfer.

## 5. Canonical Domain Model

### 5.1. Thuật ngữ và cardinality dùng cho Phase 0

| Thuật ngữ | Ý nghĩa / ID | Quan hệ và invariant |
|---|---|---|
| User | Danh tính đăng nhập | 0/1 staff profile theo mô hình được Q01 duyệt; không đồng nhất với mã nhân viên cũ. |
| Staff | Nhân sự/job role | Có thể không login; advisor/technician assignment tham chiếu staff ID. |
| Station | Phạm vi vận hành | Một trạm hiện tại; không xây branch switching/ACL đa trạm nếu chưa duyệt. |
| Customer/vehicle | Liên hệ và xe UUID riêng | N–M qua liên hệ có thời gian; phone/plate không unique mặc định, không chứng minh quyền lịch sử. |
| Service | Công việc canonical | Category, code, marketing mapping; requirement và snapshot version, không lấy giá/thời lượng fixture thành thực tế. |
| Booking | Cuộc hẹn trước khi nhận xe | Có thể không có visit. Một booking nhiều service; pending có reservation ngay. |
| Service visit | Một lần tiếp nhận thực tế/phiếu | `bookingId: uuid|null`; có customerId,vehicleId,stationId,assignedAdvisorId,origin riêng. Walk-in không tạo booking giả. |
| Booking–visit | Quan hệ tùy chọn | Đề xuất0..1 visit cho booking bằng unique booking_id khi nonnull; PostgreSQL cho nhiều NULL. Quay lại = visit mới, optionally followUpOfVisitId, không tái dùng visit cũ. |
| Resource reservation | Kế hoạch sử dụng tài nguyên | Đề xuất đúng một subject booking **hoặc** visit; footprint nhiều pool/bucket. Arrive không nhân đôi allocation khi chuyển chủ từ booking sang visit. |
| Quote/revision | Báo giá và bản khách duyệt | Một visit có quote với nhiều revisions; approved snapshot bất biến. Quick quote chưa visit cần Q08, không ép booking/visit giả. |
| Work item | Công việc dự kiến/thi công | Có thể tham chiếu quote line nhưng không buộc mọi item xuất phát từ quote; nhiều KTV qua assignments nếu trạm cần. |
| Acceptance/handover | Kiểm tra chất lượng / giao xe thực tế | Acceptance PASSED, READY và HANDED_OVER là các mốc khác nhau. |
| Stock document/ledger | Chứng từ và sự kiện thay đổi kho | Dòng document, stock reservation, immutable movement; reference theo visit/part/warehouse. |
| Payment entry/allocation | Bút toán tiền thực / áp vào nghĩa vụ | Có thể cọc booking trước visit; không duplicate payment khi arrive; refund/reversal liên kết gốc. |
| External identity/provenance | Liên kết bản ghi nguồn CRM | Unique(sourceSystem,entityType,externalId); không dùng phone/plate thay externalId. |

Visit độc lập cần mở rộng **mọi** FK/query/permission/report/event hiện bám booking, không chỉ đổi nullable field. Dữ liệu receipt/ảnh/quote cần scope qua visit khi bookingId=NULL. Chưa đủ bằng chứng để biến tất cả mã phiếu cũ thành booking mới.

### 5.2. Canonical catalog — mapping ứng viên, chưa là dữ liệu đã duyệt

Nguồn: [src/lib/public-booking/mock.ts:35](../src/lib/public-booking/mock.ts#L35), [src/lib/booking/seed.ts:15](../src/lib/booking/seed.ts#L15), [src/lib/manager/mock.ts:152](../src/lib/manager/mock.ts#L152), [src/data/site-content.json:1](../src/data/site-content.json#L1).

| Nhóm mục tiêu ứng viên | ID public hiện tại | ID cố vấn | ID manager | Slug marketing liên quan | Chưa được tự suy |
|---|---|---|---|---|---|
| Bảo dưỡng định kỳ | maintenance | — | m1 | — | Có thể là gói gồm nhiều service, không lấy120 phút fixture làm chuẩn. |
| Thay dầu/lọc | oil | — | m2 | — | Định nghĩa công việc, vật tư và resource duration. |
| Kiểm tra/sửa chữa | repair | — | — | — | Chưa biết duration; có thể chỉ book khâu chẩn đoán an toàn nếu duyệt. |
| Lốp/phanh/gầm | chassis | — | — | underbody-coating-protection không tương đương sửa gầm | Không match bằng từ “gầm”. |
| Điện/điều hòa | electrical | — | m7 inactive | — | Nhóm rộng khác một dịch vụ; m7 không tự active. |
| Rửa/chăm sóc | detailing (nhóm rộng) | wash | — | detail-wash | Nhóm detailing không phải một ID dịch vụ thay thế mọi gói. |
| Nội thất | detailing | interior | m3 | interior-detailing | Cần xác nhận gói/định mức. |
| Ceramic | detailing | ceramic | m4 | ceramic-coating | Thời gian chờ/thi công/bảo dưỡng cần pool/interval riêng nếu có. |
| PPF | detailing | ppf | — | paint-protection-film-(ppf) | Không lấy240 phút fixture làm cam kết. |
| Cách nhiệt | detailing hoặc nhóm mới cần duyệt | tint | m5 | window-tint | Advisor120 vs manager150 phút: chưa thống nhất. |
| Phụ kiện/camera | chưa có dedicated ID public | accessories | m6 | — | Lắp camera chỉ là phần của accessories; không merge mất dịch vụ khác. |
| Tư vấn/chưa rõ | consultation | — | — | — | Cần resource tiếp nhận/ước lượng được duyệt, không slot vô hạn. |
| Marketing còn lại | chưa có mapping | — | — | paint-correction; engine-bay-detailing; headlight-restoration; glass-water-spot-removal; underbody-coating-protection | Tồn tại landing page không tự làm service bookable. |

Mapping này là ứng viên để Manager duyệt, không script seed. Đề xuất giữ code service bền vững; UUID dùng join, code hiển thị nội bộ, slug phục vụ nội dung. Thời lượng tiếp nhận, thi công, chờ máy, buffer là field/requirement có nghĩa rõ, không một duration dùng cho mọi mục đích.

### 5.3. ID, phiên bản và provenance

- UUID cho PK internal; display code không là token truy cập. Giữ legacy code ở external identity hoặc snapshot, không đổi PK mới thành mã nhập tay.
- `version` cho aggregate trọng yếu; `catalogVersion/policyVersion/revisionId` cho snapshot được áp dụng.
- `createdAt/occurredAt/recordedAt` tách khi import dữ liệu quá khứ. Không gán ngày import thành ngày thu hoặc ngày làm dịch vụ.
- Audit và external mapping không chứa bản sao mật khẩu/OTP/token. Media provenance không đồng nghĩa ảnh được phép public.

## 6. State Machines & Business Invariants

**Các tên trạng thái dưới đây là proposed**, trừ bất biến public create=PENDING+hold đã confirmed business decision. Không cập nhật trực tiếp `status` qua PATCH chung. UI hiện dùng chữ thường được adapter ánh xạ; không đổi nhãn UX trong Phase 0.

| Trục | Từ | Action / sang | Actor | Guard | Side effect cùng TX / lỗi |
|---|---|---|---|---|---|---|
| Booking | Chưa có | create → PENDING | Public/staff hợp quyền | Dịch vụ active, input/lead/hours/capacity | Tạo booking+snapshots+ACTIVE hold+events; CAPACITY_FULL/VALIDATION_FAILED. |
| Booking | PENDING | confirm → CONFIRMED | Owner/M | Contact agreement, version, active hold | Cùng giờ không tăng hold; khác giờ replan atomic; INVALID_TRANSITION/VERSION_CONFLICT. |
| Booking | PENDING/CONFIRMED | reschedule → giữ status | Owner/M | Giờ mới hợp lệ, reason, khách đồng ý | Thay footprint; lỗi giữ toàn bộ cũ; CAPACITY_FULL. |
| Booking | PENDING/CONFIRMED | cancel → CANCELLED | Owner/M | Reason, version | Release đúng một lần, event; INVALID_TRANSITION. |
| Booking | CONFIRMED | no-show → NO_SHOW | Owner/M | Sau giờ+grace D14, nhân viên xác minh | Release một lần; TOO_EARLY. Không timer tự đổi status. |
| Booking | CONFIRMED | receive → ARRIVED | Owner/M | Xe đến thực, chưa có visit, version | Tạo visit+intake+event atomic; chuyển reservation ownership, không double-hold; VISIT_EXISTS. |
| Booking | ARRIVED | handover visit → COMPLETED | Owner/M theo D06 | Visit thực sự bàn giao, đủ policy Q06 | Visit và booking cùng hoàn tất; HANDOVER_BLOCKED. |
| Reservation | Chưa có | reserve → ACTIVE | Domain service | Footprint đủ mọi pool/bucket | Allocation+counter+subject cùng TX; CAPACITY_FULL. |
| Reservation | ACTIVE | confirm same time → ACTIVE | Domain service | Booking version đúng | Không cộng counter. |
| Reservation | ACTIVE | replan → ACTIVE thế hệ mới | Domain service | Tất cả nhu cầu mới hợp lệ, trừ hold chính mình khi tính free | Replace atomic, không partial; CAPACITY_FULL. |
| Reservation | ACTIVE | release → RELEASED | Domain service | Đúng event cancel/no-show/giải phóng nguồn lực thực | Không decrement lần2; release lý do/đoạn thực. Chưa tự TTL. |
| Visit | Chưa có | walk-in/receive → RECEIVED | Owner/M theo Q03 | Customer/vehicle/owner thật; allocation nếu cần bắt đầu chiếm tài nguyên | bookingId=NULL cho walk-in; không phải booking status; INTAKE_BLOCKED/CAPACITY_FULL. |
| Visit | RECEIVED/IN_PROGRESS | ready → READY | Owner/M | Acceptance và dữ liệu tối thiểu D06/Q06 | Event readyAt; chưa là đã giao/thu đủ. |
| Visit | READY | handover → HANDED_OVER | Theo handover permission | Tình trạng kỹ thuật, thu tiền/nợ theo policy đã duyệt | handedOverAt; booking liên quan COMPLETED; HANDOVER_BLOCKED. |
| Visit | RECEIVED/IN_PROGRESS | abort → ABORTED | M theo D10 | Reason, xử lý tiền/phụ tùng/công việc đã làm | Không xóa ledger hoặc giả hoàn tất; ABORT_SETTLEMENT_REQUIRED. |
| Quote | DRAFT | submit → SUBMITTED | Người được quyền quote | Lines/totals/rounding hợp lệ, expectedVersion | Snapshot revision cố định, event; VALIDATION_FAILED. |
| Quote | SUBMITTED | approve/reject → APPROVED/REJECTED | Nhân viên ghi nhận quyết định khách theo Q05 | Đúng revision, evidence, scope | Không tự xuất kho/thu tiền; QUOTE_REVISION_CONFLICT. |
| Quote | APPROVED | change order → DRAFT revision mới | Người được quyền quote | Lý do và tham chiếu approved revision gốc | Giữ nguyên bản cũ; không hủy công việc đã làm/ledger; QUOTE_LOCKED nếu sửa đè. |
| Work | NOT_STARTED | start → IN_PROGRESS | Owner/M hoặc KTV theo quyền | Approved phạm vi thực hiện, hoặc exemption miễn phí đã duyệt Q05; resource hợp lệ | startedAt, assignment/items; WORK_NOT_AUTHORIZED/CAPACITY_FULL. |
| Work | IN_PROGRESS/PAUSED | pause/resume → PAUSED/IN_PROGRESS | Người được quyền work | Lý do, actual resource impact | Không tự giải phóng cầu đang bị xe chiếm; INVALID_TRANSITION. |
| Work | IN_PROGRESS | finish → FINISHED | Người được quyền work | Items thực cần làm đã xong, evidence đủ | Gửi acceptance, không tự handover; WORK_INCOMPLETE. |
| Acceptance | PENDING/NEEDS_WORK | check → PASSED/NEEDS_WORK | Inspector được phép | Checklist/inspector/kết quả, stock issue policy nếu áp dụng | NEEDS_WORK quay work với lịch sử, không reset quote/tiền; ACCEPTANCE_INCOMPLETE. |
| Inventory document | DRAFT | post → POSTED | Quyền kho | Line/warehouse/qty/stock và doc version | Ledger+balance+stock reservation+event atomic; INSUFFICIENT_STOCK. |
| Inventory document | POSTED | correct/return/reverse → chứng từ mới | Quyền kho/duyệt điều chỉnh | Chứng từ gốc, lượng còn được trả/đảo, reason | Không sửa/xóa ledger cũ; STOCK_CONFLICT/RETURN_EXCEEDS_ISSUED. |
| Stock reservation | REQUESTED | reserve → RESERVED/PARTIAL | Quyền kho | Available đủ phần được giữ | Counter/ledger reservation lock; không giảm on_hand. |
| Stock reservation | RESERVED/PARTIAL | issue/return/cancel | Quyền kho | Số thực xuất/trả không vượt phần hợp lệ | Issued giảm on_hand, return tăng kho đúng condition; không double issue. |
| Payment entry | Chưa có | collect/deposit → POSTED | Cashier permission | Amount>0, method/currency/subject, permission | Ledger+allocation+receipt+event atomic; PAYMENT_CONFLICT. |
| Payment entry | POSTED | refund/reverse → entry bù mới | Quyền thu/duyệt riêng Q07 | Không vượt refundable còn lại, liên kết original, reason | Original giữ nguyên; PAYMENT_CONFLICT/REFUND_EXCEEDS_BALANCE. |

**Payment status** là projection từ approved obligation, posted allocation và refund/reversal: UNASSESSED khi chưa có số phải thu; UNPAID/PARTIAL/SETTLED/CREDIT khi tính được. Tên enum/formula Q07 cần duyệt; không đồng nhất booking/visit/work status với paid.

**Public progress** là danh sách sự kiện thực được phép công bố, gợi ý RECEIVED/INSPECTING/WAITING_APPROVAL/IN_SERVICE/QUALITY_CHECK/READY_FOR_PICKUP/HANDED_OVER. Không bắt buộc tạo đủ mọi bước, không tự suy phần trăm work thành mốc. D07/D12 duyệt danh mục/skip rules; DTO khách chỉ select public fields.

**Ngoại lệ cần policy trước bật:** nhận pending chưa confirm; khách đổi xe so với booking; free/no-quote work; partial fulfillment/change order; abort sau nhận; reopen đã handover; bù phụ tùng sau done. Mặc định chưa cho đường đi tắt chưa duyệt; giữ hồ sơ hiện hành và báo lỗi rõ, không tự sửa status.

## 7. API Standards

### 7.1. Quy ước đã chọn cho Phase 1

Phase 1 dùng `/api/v1`, JSON UTF-8/camelCase, UUID, enum UPPER_SNAKE_CASE, ISO8601 có offset ở request, UTC Z ở response. Giờ vận hành dùng `Asia/Ho_Chi_Minh`; khoảng `[startAt,endAt)`. Không nhận `Date.parse` tự sửa ngày sai hoặc timestamp thiếu offset. Mọi ID/field/enum/query phải whitelist. Unknown field400; sai kiểu/format400; dữ liệu đúng cấu trúc nhưng vi phạm domain422; tranh tài nguyên/state/version 409.

GET/PATCH/PUT/action200; tạo201; logout/delete204. Không dùng202 cho booking chưa commit. Mọi response JSON có `meta.requestId,correlationId`; list có `page.nextCursor,hasMore`; các read models có `meta.asOf`. Header no-store cho auth/admin/public booking catalog/availability trong P1. Không đưa PII vào URL ngoài query search nội bộ được che log, không log query search raw.

Mutation nghiệp vụ ngoài auth cần `Idempotency-Key` UUID v4 và expectedVersion khi sửa aggregate. Phiên bản v1 chọn expectedVersion, không thêm ETag/If-Match song song. GET không đổi status kinh doanh. Các con số giới hạn kỹ thuật sau là cấu hình khởi đầu của contract, không phải số cầu/giờ/dịch vụ thực tế.

| Giới hạn kỹ thuật v1 | Quy tắc |
|---|---|
| Paging | default20,max100; cursor opaque có signature, gắn filter/sort/station/scope, tie-break ID; cursor không hợp query400 CURSOR_INVALID. |
| Query range | Booking/history/customer related filters<=93 ngày; capacity<=31 ngày. Search q trim<=100 ký tự, không q toàn DB public. |
| Body | JSON<=256KiB; note<=1000; internalNote/reason<=1000/400; serviceIds1..10 duy nhất, giữ thứ tự. |
| Plan/config | Services1..16 requirements; pools<=64, resources<=256 cho một station. Planner giới hạn10000 search nodes; hết budget trả503 CAPACITY_CHECK_UNAVAILABLE, không trả giả FULL. |
| Idempotency | Lưu receipt tối thiểu ít nhất7 ngày; unique(scope,key_hash), fingerprint HMAC payload canonical; auth không cache password/token response. |
| Session | PREAUTH15 phút; AUTH idle30 phút, absolute12 giờ; không remember-me P1. Mỗi lần request authenticated cập nhật lastSeen phù hợp nhưng không vượt absolute. |
| Rate limit khởi đầu | Login5 lần thất bại/15 phút theo account hash và20/15 phút/IP; create public5/10 phút/IP và3/30 phút/contact hash; availability60/phút/IP; bootstrap CSRF30/10 phút/IP; staff mutation120/phút/user. |
| Hạ tầng | Threshold có cấu hình server; test liên quan và đo tải trước production, không tự hạ mật mã hoặc bỏ invariant khi có tải. Rate-limit persistent PostgreSQL, không prerequisite Redis. |

API lỗi trả `{error:{code,message,fields:[{path,code,message}]},meta:{requestId,correlationId}}`; success `{data,meta}`. 204 không JSON. Thông điệp đăng nhập/public luôn trung tính; không stack/SQL/raw input/secret.

### 7.2. Identity/session đã chọn

**Lựa chọn triển khai từ quyền duyệt Phase 0:** local account DPAuto độc lập, login bằng email chuẩn hóa; web cùng origin với reverse proxy `/api/v1` về NestJS/Fastify. Không phụ thuộc provider/SMTP/account bán xe. Runtime domain là cấu hình triển khai, không hardcode tên miền staging.

Password mới15..128 Unicode code points, UTF-8<=512 bytes, cho phép dấu/cách; không trim/normalize/truncate password. Dùng asynchronous `node:crypto.scrypt`, N=131072,r=8,p=1,random salt32 bytes,key64 bytes,maxmem256MiB. Lưu algorithm/version/params/salt/hash, compare constant-time đúng độ dài; hash dummy cùng work factor khi email không tồn tại. Semaphore hash khởi đầu1/process, bounded queue; đầy trả429/503 thay vì giữ DB transaction trong lúc hash. Khi triển khai phải verify trên Node runtime được chọn, không chạy crypto sync chặn event loop.

Tham chiếu kỹ thuật: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) cho profile scrypt; [Node crypto.scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) cho salt/maxmem/async. P1 chọn scrypt có sẵn trong platform, không thêm package chỉ để băm password.

Cookie production `__Host-dpauto-session`: token ngẫu nhiên32 bytes, Secure,HttpOnly,SameSite=Lax,Path=/,không Domain. DB chỉ SHA-256 token hash. Session có kind PREAUTH/AUTH, csrfToken ngẫu nhiên32 bytes riêng lưu server-side; userId NULL chỉ với PREAUTH. Local HTTP dev dùng tên cookie khác không prefix __Host, bật rõ môi trường; production từ chối cấu hình insecure. Không JWT/localStorage token.

`GET /admin/auth/csrf` tạo PREAUTH context nếu chưa có, trả cùng CSRF token của context hiện tại; không thay token mỗi tab. Login cần header X-CSRF-Token khớp context + exact Origin/Referer được cấu hình + JSON content type; sau login rotate session/context. Authenticated mutation kiểm tra CSRF tương tự. Logout/revoke/change-password rotate hoặc xóa phiên và CSRF. XSS vẫn có thể đánh cắp CSRF; không coi cookie/CSRF thay output encoding. Mẫu được chọn: [OWASP synchronizer token](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern).

Không public registration/password recovery. First Manager và hai permission `staff.manage,roles.manage` được provision qua tác vụ offline có audit, không HTTP bootstrap mở. Sau đó S02 tạo account tùy chọn cùng staff; S04 đặt password tạm, mustChangePassword=true. A02 cho đăng nhập limited session khi mustChangePassword; chỉ A01/A03/A04/A05 được gọi, API khác403 PASSWORD_CHANGE_REQUIRED. A05 xác minh current password, đổi credential/authVersion, revoke mọi session cũ và tạo phiên mới. S04 không trả password trong response, không ghi vào audit/outbox.

Session valid chỉ khi kind AUTH, user/staff active, expires/idle chưa hết và authVersion khớp. Các request đọc kiểm tra lại; business writer recheck sau station/user locks. Role change/account lock/reset password tăng authVersion và revoke sessions trong cùng TX. Không vô hiệu hóa authority cuối có roles.manage; kiểm tra dưới station governance lock. Người quản lý không mặc nhiên được sensitive permission chỉ vì có jobRole=manager.

### 7.3. Scope và permission bundle Phase 1

Một staff thuộc một station P1; actor/station lấy session. Public resolve station duy nhất từ host/config, không nhận tùy ý stationId. Role MANAGER/ADVISOR là quyền nghiệp vụ; CMS_ADMIN được giữ cho phase CMS, chưa cấp quyền lịch/kho/tiền. User không có role vận hành được phép dùng auth account nhưng không tự đọc booking.

- ADVISOR: booking.create + read/update/confirm/reschedule/cancel/no_show/contact **own current assignment**; customers/vehicles chỉ từ booking hiện phụ trách. Không list queue, chuyển owner, cấu hình hoặc sửa account.
- MANAGER: booking scope toàn station, assign/transfer; catalog.manage,capacity.manage,station.manage,audit.read và staff.read theo bundle vận hành.
- `staff.manage` và `roles.manage` là grant tường minh do bootstrap authority/quyền roles.manage cấp. S01 account/grant projection theo permission, không lộ credential. P1 không triển khai arbitrary dynamic permissions builder.
- P4 stock/cash/cost/refund permissions vẫn tách như Q02 đã duyệt; chưa sinh endpoint tiền/kho trong P1.
- Former advisor dùng B12 để xem bookingCode, serviceNames, start/status **tại thời điểm transfer** và assignment interval. B11 chỉ trả event của chính người đó trong assignment đã đóng, loại bỏ PII và notes hiện tại. B02 trả 404 khi không còn scope hiện tại; B11 trả 404 nếu không có assignment lịch sử phù hợp.
- List/search/count/dashboard/cursor/export đều scope trước filtering và paging. Query advisorId của A khác chính mình trả403, không lặng lẽ trả booking khác.

### 7.4. Transaction profiles dùng trong catalog

| Profile | Bắt buộc |
|---|---|
| READ | Projection đúng scope; read models counts/items/asOf trong consistent snapshot; không raw SELECT* serialize. |
| AUTH | Hash/verify ngoài transaction; khóa user rồi recheck credential version/status khi commit session; audit login/revoke không secrets. Password change/reset và session revocation atomic. Không idempotency receipt chứa cookie/CSRF/password. |
| GOV | Claim idempotency → station row → actor/target users sorted → staff/role rows; recheck current authority; update profile/account/roles/grants+authVersion+sessions+audit/outbox+receipt một TX. |
| CFG | Claim key → station coordination row → actor user/permission → entity/version → policy/resource/buckets sorted; impact-check toàn bộ holds; version/snapshot/config/audit/outbox/receipt một TX. |
| CREATE | Claim key → station → actor nếu staff → catalog/config current → contacts/vehicle/link → new booking → buckets/resources sorted; plan/reservations/allocations/counters/snapshots/assignment/consent/events/audit/outbox/receipt một TX. |
| EDIT/CONFIRM/REPLAN/RELEASE/ASSIGN/CONTACT | Claim key → station → actor user → booking → related assignments/reservations → union buckets/resources sorted nếu cần. Recheck scope/version/state; ghi hết side effects hoặc rollback. CONTACT/ASSIGN không tự đổi holds. |

Station lock exclusive là baseline đơn giản cho một trạm, serialize các write ảnh hưởng core. Mọi writer kể cả catalog/config/offboard phải tuân thứ tự; auth password/session writer không chạm station/capacity sau user lock. Không gọi provider/crypto/network dưới business lock.

Idempotency response chỉ là receipt không PII. Retry sau timeout cùng key/payload trả status/body receipt ban đầu với meta.replayed=true; **recheck identity/scope hiện hành trước replay**. Cùng key khác payload409 IDEMPOTENCY_CONFLICT; request đầu chưa xong chờ bounded rồi409 REQUEST_IN_PROGRESS+Retry-After. 4xx/rollback trước commit không tạo successful receipt; cùng key chỉ retry cùng payload, người dùng sửa form tạo key mới. Password/auth commands không dùng replay token cache; login timeout lấy lại csrf/me trước thử đăng nhập lại.

Ngoài ID key TTL, state transition+version+active-hold uniqueness vẫn chặn double release/confirm/assign. Không dùng key mới để bypass lỗi. Public input fingerprint HMAC có server secret, raw note/phone không vào logs. Cấu hình/role thay đổi trong lúc request chạy phải được recheck sau lock.

### 7.5. Nhóm lỗi chung

401 UNAUTHENTICATED;403 FORBIDDEN/CSRF_INVALID/PASSWORD_CHANGE_REQUIRED;404 NOT_FOUND;409 VERSION_CONFLICT/INVALID_TRANSITION/IDEMPOTENCY_CONFLICT/CAPACITY_FULL/CAPACITY_IMPACT;422 VALIDATION_FAILED/SLOT_CLOSED/OUTSIDE_BUSINESS_HOURS/SERVICE_INACTIVE;429 RATE_LIMITED;503 SERVICE_UNAVAILABLE/BOOKING_NOT_CONFIGURED/CAPACITY_CHECK_UNAVAILABLE. Chi tiết code riêng ở từng dòng catalog bổ sung nhóm chung, không thay auth/status/rate errors.

Header requestId/correlationId do server validate/generate; không tin actor/source/IP từ header bên ngoài proxy tin cậy. Public create không lộ booking khác khi CAPACITY_FULL. Readiness hạ tầng không đòi có dịch vụ kinh doanh, nhưng create bị đóng BOOKING_NOT_CONFIGURED khi policy/catalog chưa publish đủ.


**Chọn serializer envelope:** field tùy chọn được liệt kê không xuất hiện nếu không áp dụng; field nullable luôn trả NULL khi chưa có. DTO public không tái sử dụng class nội bộ rồi dùng client hide field. Các companion của Page<T> ởmeta, không đổi data thành object tùy endpoint. Các khoảng số kỹ thuật v1 có cấu hình, không đồng nghĩa resource/schedule dữ liệu thật đã có.

## 8. API Catalog by Phase

### 8.1. Truy vết catalog baseline Phase 0

Catalog toàn target P2–P6 chưa khóa đầy đủ. Hợp đồng Phase 1 đã được cụ thể hóa ở 8.3; bảng8.1 giữ trace baseline theo module và phase. **Không tuyên bố94 endpoint/50 bảng là số lượng target.** Bảng dưới rà soát đủ94 old IDs theo hướng reuse/modified/new/deferred và phân kỳ mới; prefix/module là vị trí dự kiến, không API đang chạy.

“reused” = giữ ý nghĩa candidate, không là code backend được tái dùng. “modified” = cần sửa contract hoặc dependency. Phase mới không lấy số P1–P5 cũ làm thứ tự mặc định.

| Old endpoint ID / module | Số baseline | Hướng target / phase | Trạng thái và thay đổi |
|---|---:|---|---|
| AUTH01–03 | 3 | Identity/session P1 | modified; login theo provider Q01, không tự đóng password contract. |
| STF01–03 | 3 | Staff/profile/permissions P1 | modified; job role tách quyền; A không list mọi nhân sự. |
| STF04–06 | 3 | Shifts/availability P5, input capacity tối thiểu P1 nếu cần | modified; ca không là chấm công; C09 quyết định dependency. |
| CAT01–03 | 3 | Canonical catalog/resource requirements P1 | modified; code/UUID/mapping/version được duyệt. |
| PUB01,PUB03,PUB04 | 3 | Public catalog/availability/create P1 | modified; PENDING hold atomic, DTO/source/notice. |
| PUB02,PUB05–08 | 5 | Public content/site info P5 | reused candidate; static vẫn có thể phục vụ trước CMS. |
| BKG01–08,BKG10–12 | 11 | Booking/assignment/history P1 | modified; không staff walk-in giả, scope/version/hold invariants. |
| BKG09,VIS03 | 2 | Booking arrival/intake P2 | **hợp nhất candidate** POST /admin/bookings/:id/receive; một TX tạo visit đầy đủ hoặc trả visit cũ cùng idempotency. Bỏ hai thao tác tạo visit cạnh tranh trong target candidate. |
| BKG13 | 1 | Advisor historical projection P1/P2 | modified; gồm lịch sử visit sau D11, không tự cấp detail hiện tại. |
| BKG14 | 1 | Booking contact events P1 | reused candidate; cần cho liên hệ pending đầu tiên. |
| CAP01–08 | 8 | Capacity policy/calendar/blocks/buckets P1 | modified; allocator chung cho booking/visit, capacity impact không override. |
| CUS01–03 | 3 | Customer/vehicle và history P1/P2 | modified; ownership từ booking hoặc walk-in visit. |
| VIS01–02,VIS04–05 | 4 | Visit list/detail/intake/progress P2 | modified; bookingId nullable, visit owner/history riêng. |
| VIS06 | 1 | Handover P3, payment guard P4 | modified; kỹ thuật, đã giao và đã thu tách trục. |
| VIS07 | 1 | Assignment P2/P3 | modified; advisor visit transfer P2, technician assignment P3; không sửa booking owner ngầm độc lập. |
| MED01 | 1 | Private reception media P2 | modified; ảnh là nhu cầu tiếp nhận/cutover, không hoãn vô thời hạn. |
| QTE01–04 | 4 | Quote/revisions/submit/decision/change order P3 | modified; quick quote/evidence/money Q05/Q08. |
| WRK01–04,ACP01–02 | 6 | Work/acceptance/rework P3 | modified; checklist không buộc nguồn quote, multiple KTV nếu cần. |
| OPS01–02,RPT01–02 | 4 | Operations/reports/export P5 | modified; booking KPI thiết yếu có thể đọc từ core; cash/debt definitions theo P4. |
| INV01–03,FIN01 | 4 | Kho/finance reads P4 | modified; có write ledger đi kèm trước cutover. |
| NOT01–02 | 2 | Inbox P5; outbox nền P1 | reused candidate; recipient scope, chuyển owner không lộ notification cũ. |
| AUD01 | 1 | Audit P1 | reused candidate; không để audit integrity chờ P5. |
| SET01–02 | 2 | Station P1, public metadata P5 | modified; policy capacity ở module Capacity, auth secrets riêng. |
| CMS01–04,MEDCMS01–02 | 6 | CMS P5 | modified; D13 permission, metadata khác reception private assets. |
| CAC01–07,WAI01–03 | 10 | Customer access/waitlist sau cutover nếu duyệt | deferred, không prerequisite của cutover CRM. |
| INT01–02 | 2 | Hạ tầng P1 | reused candidate, không expose secrets. |

Tổng cột baseline=94; chỉ dùng kiểm tra không bỏ sót old IDs. Receive hợp nhất2 candidate thành1 là thay đổi đầu tiên; target còn bổ sung write commands nên chưa tính tổng cuối.

### 8.2. Các capability mới bắt buộc phải đưa vào catalog chi tiết tiếp theo

| Capability / path ứng viên | Phase | Consumer / actor | Contract tối thiểu cần đặc tả | Tx / failure / trạng thái |
|---|---|---|---|---|
| POST /admin/service-visits | P2 | Nhánh walk-in, A/M theo Q03 | Customer/vehicle IDs,request,conditions?,ODO?,owner theo quyền,origin=WALK_IN,expected resource plan?,Idempotency-Key; trả201 visitId,bookingId=NULL,version | Visit+assignment+allocation nếu cần+events atomic; CAPACITY_FULL/INTAKE_BLOCKED; **new/proposed**. |
| POST /admin/bookings/:id/receive | P2 | Tiếp nhận lịch, owner/M | ExpectedVersion,vehicle xác nhận,reception fields,Idempotency-Key; trả201 visit và ARRIVED | Booking+visit+reservation ownership+events, rollback toàn bộ; **modified/proposed** từ BKG09/VIS03. |
| POST /admin/service-visits/:id/transfer | P2 | Điều phối, M | ToAdvisorId,reason,expectedVersion; trả owner/history/version | Visit và booking đang hoạt động liên quan đồng bộ, scope recheck; **new/proposed** cho walk-in. |
| Quote revision/change order command | P3 | Quote editor, quote permission | Revision/base approved ID,lines,evidence,reason/version; immutable accepted snapshot | Không sửa quote cũ/work/stock/payment history; **new/proposed**, path chi tiết Phase3. |
| Stock documents receipt/issue/return/adjustment/stocktake + post/reversal | P4 | Màn kho cần bổ sung theo UI hiện có, inventory permission | Warehouse,source refs,lines decimal,origin doc,expectedVersion,Idempotency-Key; trả document/ledger refs | Lock balances/reservations/subject, không âm kho hoặc double issue; **new/needs approval Q04**. |
| Stock requests/reservations và fulfill phần còn lại | P4 | Phiếu/kho, quyền kho | Requested/reserved/issued/returned phân biệt; partial quantities rõ | Không trừ on_hand khi reserve; không post một phần âm thầm; **new/needs approval Q04**. |
| Payments collect/deposit/refund/reversal/allocation | P4 | Thu/cọc và receipts, cashier permission | Subject booking hoặc visit,amount string,currency,method,sourceRef,originalEntryId khi hoàn,reason/version/key | Ledger/allocations/receipt cùng TX; refundable khóa chống vượt; **new/needs approval Q07**. |
| Legacy migration batch/preview/validation/reconciliation | P6, planning từP0 | Operator có quyền, không public | Source IDs/checksums,mapping,error manifest,cutover checkpoint | Có thể là offline commands, không tự tạo HTTP import endpoint; **new/needs approval Q08**. |

Mỗi capability phải tách thành các endpoint thực sự cần và viết đủ13 cột theo đề bài khi thiết kế phase tương ứng. Không đếm8 dòng capability này như8 endpoint hoàn chỉnh hoặc cho developer tự dùng làm OpenAPI đã khóa.

### 8.3. Catalog Phase 1 — 46 endpoint

Mọi dòng thuộc Phase  1 và là **contract-ready**, chưa triển khai backend/test. Base path /api/v1. DTO/response ở9; schema ở 11.4; transaction profiles ở7.4. reused/modified/new mô tả trace baseline, không nghĩa code backend đã có. Mọi API còn có lỗi auth/rate/5xx chung7.5 ngoài lỗi riêng trong bảng.

| ID / phase / method / path | Old ID / delta | Consumer / quyền / source | Mục đích | Request (path/query/header/body) | Response | Validation / guard | Lỗi riêng | Transaction / side effects | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| P1-A01<br>P1 **GET** `/admin/auth/csrf` | new; new | Login/shell; anonymous/session<br>[auth requirements](../technical-documentation/API_SPEC.md#L115) | Khởi tạo hoặc đọc CSRF context | không; cookie nếu có | 200 CsrfContext | Không cache; Origin/Fetch-Metadata khi có, không cho CORS khác origin | 429 | SESSION bootstrap/refresh, không business event | contract-ready |
| P1-A02<br>P1 **POST** `/admin/auth/login` | AUTH01; modified | Login UI cần bổ sung; PREAUTH+CSRF<br>[auth requirements](../technical-documentation/API_SPEC.md#L115) | Đăng nhập local | LoginInput; X-CSRF-Token | 200 AuthSession; rotate cookie | Credential/CSRF/rate guard; dummy hash nếu account không tồn tại; account ACTIVE | 401 INVALID_CREDENTIALS;403 CSRF_INVALID;429 | AUTH; không dùng Idempotency-Key cho password/token response | contract-ready |
| P1-A03<br>P1 **POST** `/admin/auth/logout` | AUTH02; reused | Shell; session+CSRF; expired cookie hợp lệ context thì cleanup<br>[auth requirements](../technical-documentation/API_SPEC.md#L115) | Thu hồi phiên hiện hành | không; X-CSRF-Token | 204; clear session cookie | Origin+CSRF khi phiên còn sống; cookie expired chỉ cleanup, không business mutation | 403 CSRF_INVALID | AUTH; gọi lại không phục hồi phiên | contract-ready |
| P1-A04<br>P1 **GET** `/admin/auth/me` | AUTH03; modified | Public->staff shell/route guard; AUTH<br>[auth requirements](../technical-documentation/API_SPEC.md#L115) | Hồ sơ và quyền hiện hành | cookie | 200 AuthSession | Kiểm tra user/session/authVersion mỗi request; mustChange chỉ quyền auth | 401 | READ; no-store | contract-ready |
| P1-A05<br>P1 **POST** `/admin/auth/change-password` | new; new | Account / first login; AUTH+CSRF<br>[auth requirements](../technical-documentation/API_SPEC.md#L115) | Đổi password, kết thúc reset bắt buộc | PasswordChangeInput | 200 AuthSession; rotate current cookie | Current password đúng; new password policy, không trùng current; không log body | 401 INVALID_CREDENTIALS;422 PASSWORD_POLICY;429 | AUTH; đổi credentials, authVersion, revoke tất cả session cũ, tạo phiên mới; không cache token | contract-ready |
| P1-S01<br>P1 **GET** `/admin/staff` | STF01; modified | Nhân sự; picker assign; M:staff.read; A:self projection<br>[staff modal](../src/components/manager/catalog-pages.tsx#L264) | List nhân sự/picker theo quyền | StaffQuery | 200 Page<StaffSummary>+jobRoleOptions | A không list toàn staff; account/permissions chỉ staff.manage/roles.manage | 403;422 | READ scope trước search/page | contract-ready |
| P1-S02<br>P1 **POST** `/admin/staff` | STF02; modified | Modal nhân sự; M+staff.manage; account options cần roles.manage<br>[staff modal](../src/components/manager/catalog-pages.tsx#L264) | Tạo hồ sơ; tùy chọn tài khoản local | StaffCreateInput; key | 201 StaffMutationReceipt | Email login unique; jobRole không tự cấp auth role; không tự cấp sensitive grants | 409 EMAIL_CONFLICT;422 ACCOUNT_INPUT_INVALID | GOV: staff/users/credentials/roles/grants/audit/outbox cùng TX; password hash trước lock | contract-ready |
| P1-S03<br>P1 **PATCH** `/admin/staff/:id` | STF03; modified | Modal nhân sự/quản trị account; staff.manage; role/grant fields cần roles.manage<br>[staff modal](../src/components/manager/catalog-pages.tsx#L264) | Sửa hồ sơ/account status/quyền | StaffPatchInput; key,expectedVersion | 200 StaffMutationReceipt | Field whitelist; không khóa người còn pending/confirmed chưa chuyển hoặc resource allocations chưa giải phóng; không xóa last authority | 409 ASSIGNMENTS_REMAIN/RESOURCE_ALLOCATIONS_REMAIN/LAST_ADMIN_REQUIRED/VERSION_CONFLICT;403 | GOV: revoke sessions khi account/roles đổi; locks station+users; không tự chuyển lịch | contract-ready |
| P1-S04<br>P1 **POST** `/admin/staff/:id/reset-password` | new; new | Quản trị account; roles.manage, target khác self<br>[staff modal](../src/components/manager/catalog-pages.tsx#L264) | Đặt password tạm và revoke phiên | {temporaryPassword,reason,expectedVersion}; key | 200 StaffMutationReceipt (không password) | Local account tồn tại; policy password; reason; self dùng A05 | 409 VERSION_CONFLICT;422 ACCOUNT_NOT_ENABLED | GOV: mustChangePassword=true; credentials/authVersion/sessions/audit atomic | contract-ready |
| P1-C01<br>P1 **GET** `/admin/services` | CAT01; modified | Form dịch vụ/booking; M catalog.read; A booking.create<br>[service modal](../src/components/manager/catalog-pages.tsx#L22) | Catalog nội bộ và requirements | ServiceQuery | 200 Page<ServiceAdmin>+categoryOptions | A không giá vốn/credentials; limit/sort whitelist | 422 | READ | contract-ready |
| P1-C02<br>P1 **POST** `/admin/services` | CAT02; modified | Modal dịch vụ; M+catalog.manage<br>[service modal](../src/components/manager/catalog-pages.tsx#L22) | Tạo canonical service | ServiceWriteInput; key | 201 ServiceMutationReceipt | Code unique; category tồn tại; requirements đầy đủ nếu bookable; pool/resources hợp lệ | 409 CODE_CONFLICT;422 INVALID_RESOURCE_PLAN | CFG: service+requirements version+audit/outbox, station coordination lock | contract-ready |
| P1-C03<br>P1 **PATCH** `/admin/services/:id` | CAT03; modified | Modal dịch vụ; M+catalog.manage<br>[service modal](../src/components/manager/catalog-pages.tsx#L22) | Sửa service/active/plan version | ServicePatchInput; key,expectedVersion | 200 ServiceMutationReceipt | Không sửa snapshot booking cũ; deactivate không tự hủy hold; duration phải có plan hợp lệ | 409 VERSION_CONFLICT;422 INVALID_RESOURCE_PLAN | CFG: requirements đời mới, current catalog version; giữ lịch cũ | contract-ready |
| P1-U01<br>P1 **GET** `/admin/customers` | CUS01; modified | Khách hàng/booking picker; M customers.read; A scope hiện phụ trách<br>[customer workspace](../src/components/admin/customers-workspace.tsx#L134) | Tìm khách hợp quyền | CustomerQuery | 200 Page<CustomerSummary> | q/vehicle filter không mở rộng scope; không tìm phone public | 422 | READ scoped | contract-ready |
| P1-U02<br>P1 **GET** `/admin/customers/:id` | CUS02; modified | Customer detail/booking picker; M station; A current booking scope<br>[customer workspace](../src/components/admin/customers-workspace.tsx#L134) | Hồ sơ và quan hệ xe được phép | id; relatedLimit? | 200 CustomerDetail | Chỉ xe/lịch được phép; relatedLimit default10,max20; history có cursor links | 404;422 | READ; không trả mọi related record | contract-ready |
| P1-U03<br>P1 **GET** `/admin/vehicles` | new; new | Khách/xe tab và picker; M station; A current booking scope<br>[customer workspace](../src/components/admin/customers-workspace.tsx#L134) | Tìm xe trong scope | VehicleQuery | 200 Page<VehicleSummary> | Plate không quyền truy cập; customerId filter trong scope | 422 | READ | contract-ready |
| P1-U04<br>P1 **GET** `/admin/vehicles/:id` | CUS03; modified | Hồ sơ xe; M station; A current booking scope<br>[customer workspace](../src/components/admin/customers-workspace.tsx#L134) | Xe và appointment history hợp quyền | id; relatedLimit? | 200 VehicleDetail | P1 serviceHistoryAvailable=false, không tạo lượt sửa từ booking; P2 bổ sung visit | 404;422 | READ | contract-ready |
| P1-B01<br>P1 **GET** `/admin/bookings` | BKG01; modified | co-van/dieu-hanh lists; M bookings.read.station; A bookings.read.own<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Lịch/filter/calendar | BookingQuery | 200 Page<BookingSummary>+counts scoped | from/to required; counts áp filter không bị paging; A advisorId chỉ chính mình | 422;403 | READ | contract-ready |
| P1-B02<br>P1 **GET** `/admin/bookings/:id` | BKG02; modified | Card/detail/drawer; M station; A current advisor<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Chi tiết/actions/version | id | 200 BookingDetail | Former advisor không xem detail hiện tại; history qua B12 | 404 | READ projection theo current scope | contract-ready |
| P1-B03<br>P1 **POST** `/admin/bookings` | BKG03; modified | BookingForm tạo lịch; M/A booking.create<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Tạo lịch nhân viên | StaffBookingCreate; key | 201 BookingMutationReceipt | A owner=actor; M assign hoặc null; source staff whitelist; không auto confirm khi có time | 409 CAPACITY_FULL;422 CONTACT_REFERENCE_INVALID | CREATE: contacts/vehicle/link nếu mới, booking/services/assignment/hold/events/consent/audit/outbox/key | contract-ready |
| P1-B04<br>P1 **PATCH** `/admin/bookings/:id` | BKG04; modified | BookingForm edit; M/A current owner+booking.update<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Sửa snapshot/xe/dịch vụ/notes | BookingPatchInput; key,expectedVersion | 200 BookingMutationReceipt | Chỉ pending/confirmed; không status/source/owner/time qua PATCH; đổi service phải replan; không tự sửa global contact | 409 VERSION_CONFLICT/CAPACITY_FULL/INVALID_TRANSITION;422 | EDIT: plan delta+snapshot/events; giữ requested/confirmed time | contract-ready |
| P1-B05<br>P1 **POST** `/admin/bookings/:id/confirm` | BKG05; modified | BookingActions/Manager drawer; M/A current owner+booking.confirm<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Xác nhận sau trao đổi | ConfirmInput; key,expectedVersion | 200 BookingMutationReceipt | PENDING, assigned advisor active, customerAgreed=true; giờ mới hợp lệ; time quá khứ không dùng confirm ngược | 409 INVALID_TRANSITION/CAPACITY_FULL;422 AGREEMENT_REQUIRED | CONFIRM: cùng giờ không double hold; khác giờ replan; event/contact/outbox | contract-ready |
| P1-B06<br>P1 **POST** `/admin/bookings/:id/reschedule` | BKG06; modified | Reschedule dialog; M/A current owner+booking.reschedule<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Đổi giờ | RescheduleInput; key,expectedVersion | 200 BookingMutationReceipt | Pending/confirmed; giờ khác hiện tại; reason/customerAgreed; preserve requested origin | 409 CAPACITY_FULL/VERSION_CONFLICT;422 | REPLAN: union old/new locks, rollback giữ toàn bộ hold cũ | contract-ready |
| P1-B07<br>P1 **POST** `/admin/bookings/:id/cancel` | BKG07; modified | Cancel dialog; M/A current owner+booking.cancel<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Hủy lịch | ReasonCommand; key,expectedVersion | 200 BookingMutationReceipt | Pending/confirmed; reason; arrived phải flow P2/P3, không hủy thường | 409 INVALID_TRANSITION/VERSION_CONFLICT;422 | RELEASE: hold/counters/state/event/contact outcome/audit/outbox/key cùng TX | contract-ready |
| P1-B08<br>P1 **POST** `/admin/bookings/:id/no-show` | BKG08; modified | No-show action; M/A current owner+booking.no_show<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Xác minh khách không đến | NoShowInput; key,expectedVersion | 200 BookingMutationReceipt | Confirmed, serverNow>=scheduledStart+configuredGrace,checkedManually=true | 422 TOO_EARLY;409 INVALID_TRANSITION | RELEASE đúng một lần; không background auto status | contract-ready |
| P1-B09<br>P1 **POST** `/admin/bookings/:id/assign` | BKG10; modified | Manager queue; M+booking.assign<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Giao lần đầu | AssignInput; key,expectedVersion | 200 BookingMutationReceipt | Chưa owner, target advisor active/login allowed; pending/confirmed; same station | 409 ALREADY_ASSIGNED/VERSION_CONFLICT;422 ADVISOR_UNAVAILABLE | ASSIGN: owner+history+event+outbox atomic; hold không đổi | contract-ready |
| P1-B10<br>P1 **POST** `/admin/bookings/:id/transfer` | BKG11; modified | Manager assignment drawer; M+booking.assign<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Chuyển cố vấn | TransferInput; key,expectedVersion | 200 BookingMutationReceipt | Có owner, to khác from, pending/confirmed P1; target hợp lệ; future visit transfer P2 | 409 SAME_ADVISOR/INVALID_TRANSITION;422 | ASSIGN: snapshot quyền đọc cũ tại endedAt, đóng/mở assignment+owner+events | contract-ready |
| P1-B11<br>P1 **GET** `/admin/bookings/:id/events` | BKG12; modified | Timeline; M/A current owner; former A own historical events only<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Sự kiện hiện tại được phép | cursor,limit | 200 Page<BookingEventView> | Former A chỉ events của mình trong assignment đã đóng, không PII/notes hiện tại; current projection theo scope | 404;422 | READ | contract-ready |
| P1-B12<br>P1 **GET** `/admin/my-history` | BKG13; modified | Lịch sử công việc CVDV; A own history; M không mạo danh A<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Projection trước chuyển | HistoryQuery | 200 Page<AssignmentHistoryView> | Summary snapshot không name/phone/plate/notes mới; chỉ event của actor trước endedAt | 422 | READ history snapshots; read-only | contract-ready |
| P1-B13<br>P1 **POST** `/admin/bookings/:id/contact-events` | BKG14; reused | Liên hệ pending/đổi giờ; M/A current owner+booking.contact<br>[booking form/actions](../src/components/admin/booking-form.tsx#L121) | Ghi nhận kết quả trao đổi | ContactInput; key,expectedVersion | 201 ContactMutationReceipt | Enum/maxlength; proposal không thay time/hold; accepted chỉ evidence chứ không confirm | 422;409 VERSION_CONFLICT/INVALID_TRANSITION | CONTACT: append/contact outcome+version/event/outbox/key; không allocator | contract-ready |
| P1-K01<br>P1 **GET** `/admin/capacity/calendar` | CAP01; modified | Khung giờ/năng lực; M+capacity.read<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Calendar năng lực và holds | CapacityQuery | 200 CapacityCalendar | Range<=31 ngày; refs trong scope; held_units và resource continuous khác remainingMinutes | 422 | READ consistent snapshot/asOf | contract-ready |
| P1-K02<br>P1 **GET** `/admin/capacity/policy` | CAP02; modified | Config/catalog/resource mapping; M+capacity.read<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Aggregate policy và resources hiện hành | không | 200 CapacityPolicy | Không staff secrets; includes resources/memberships/hours/version | 503 CAPACITY_NOT_CONFIGURED | READ | contract-ready |
| P1-K03<br>P1 **PUT** `/admin/capacity/policy` | CAP03; modified | Config/resource setup; M+capacity.manage<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Thay aggregate policy/hours/pools/resources/memberships | CapacityPolicyWrite; key,expectedVersion,reason | 200 PolicyMutationReceipt | Không xóa/đổi footprint cũ; impact check holds/resource/global interval; không giao ca làm giả | 409 CAPACITY_IMPACT/VERSION_CONFLICT;422 POLICY_INVALID | CFG: station lock/version mới, buckets tương lai được rebuild khi safe, audit/outbox | contract-ready |
| P1-K04<br>P1 **POST** `/admin/capacity/days` | CAP04; modified | Init ngày năng lực; M+capacity.manage<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Materialize buckets từ policy | {date,expectedPolicyVersion,reason}; key | 201 CapacityDayReceipt | Policy/date hợp lệ; repeat cùng key replay; date đã materialize kháckey trả200 existing nếu cùng policy,409 nếu stale | 409 POLICY_VERSION_CONFLICT;422 | CFG: unique buckets, không copy reserved; CREATE cũng có lazy materialize | contract-ready |
| P1-K05<br>P1 **PATCH** `/admin/capacity/buckets/:id` | CAP05; modified | Modal chỉnh/đóng capacity; M+capacity.manage<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Chỉnh local admission limit/closed | BucketPatchInput; key,expectedVersion | 200 BucketMutationReceipt | Limit0..eligible units; capacityLimit>=held, không thêm resource ảo; units nguyên | 409 CAPACITY_IMPACT;422 LIMIT_EXCEEDS_RESOURCES | CFG: không xóa allocations; effect event | contract-ready |
| P1-K06<br>P1 **GET** `/admin/capacity/blocks` | CAP06; modified | Calendar ngày nghỉ; M+capacity.read<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | List blocks | {from,to,poolId?,resourceId?,cursor?,limit?} | 200 Page<CalendarBlock> | Một trong pool/resource hoặc toàn trạm; khoảng hợp lệ | 422 | READ | contract-ready |
| P1-K07<br>P1 **POST** `/admin/capacity/blocks` | CAP07; modified | Nghỉ/khóa slots; M+capacity.manage<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Đóng interval trạm/pool/resource | BlockCreateInput; key | 201 BlockMutationReceipt | start<end; reason; không block đè active held interval chưa điều phối | 409 CAPACITY_IMPACT;422 | CFG: lockstation,impact snapshot,block/audit/outbox; không hủy booking | contract-ready |
| P1-K08<br>P1 **DELETE** `/admin/capacity/blocks/:id` | CAP08; modified | Mở lại ngày/slot; M+capacity.manage<br>[capacity page](../src/components/manager/capacity-page.tsx#L17) | Kết thúc hiệu lực block | {reason,expectedVersion}; key | 204 | Soft retire/audit, không xóa trace; repeated cùng key204; block đã retired với key mới409 | 404;409 INVALID_TRANSITION/VERSION_CONFLICT | CFG: retiredAt+event, policy version tăng để availability refresh | contract-ready |
| P1-D01<br>P1 **GET** `/admin/dashboard` | RPT01 subset; modified | Overview co-van/dieu-hanh; M station; A own<br>[overview](../src/components/admin/bookings-workspace.tsx#L101) | KPI/ngày và queue count | {date} | 200 BookingDashboard | Date station; không financial/workshop KPI khi chưa module; queue chỉ M | 422 | READ aggregate cùng snapshot; không page-limited | contract-ready |
| P1-L01<br>P1 **GET** `/admin/audit-logs` | AUD01; reused | Nhật ký; M+audit.read<br>[audit UI](../src/components/manager/system-pages.tsx#L325) | Audit theo action/actor/subject | AuditQuery | 200 Page<AuditView> | Masked PII; không password/token/CSRF hoặc raw request body | 422;403 | READ immutable history | contract-ready |
| P1-T01<br>P1 **GET** `/admin/site-settings` | SET01; modified | Config trạm; M+station.read<br>[settings](../src/components/manager/system-pages.tsx#L17) | Thông tin trạm/notice versions | không | 200 SiteSettings | Hours/resource policy tại K02; không provider secrets | 403 | READ | contract-ready |
| P1-T02<br>P1 **PUT** `/admin/site-settings` | SET02; modified | Config trạm; M+station.manage<br>[settings](../src/components/manager/system-pages.tsx#L17) | Sửa public contacts/settings | SiteSettingsWrite; key,expectedVersion,reason | 200 SiteMutationReceipt | HTTPS URL whitelist, normalized hotline; notice version phải tồn tại/được publish; timezone P1 fixed | 409 VERSION_CONFLICT;422 | CFG: station version+audit/outbox; không lách hours bằng field ngoài whitelist | contract-ready |
| P1-P01<br>P1 **GET** `/public/services` | PUB01; modified | ServicesStep/public modal; Public<br>[public modal](../src/components/public-booking/booking-dialog.tsx#L192) | Bookable catalog và public policy | không | 200 PublicBookingCatalog | Không cost/resource identities/held references; chỉ services có plan enabled hợp lệ | 503 BOOKING_NOT_CONFIGURED;429 | READ safe public; no-store policy trong P1 | contract-ready |
| P1-P02<br>P1 **GET** `/public/availability` | PUB03; modified | Calendar/time picker; Public<br>[public modal](../src/components/public-booking/booking-dialog.tsx#L192) | Khả dụng đúng plan | AvailabilityQuery | 200 AvailabilityView | Chạy cùng planner an toàn, không allocate; từ chối unknown service/empty/invalid date | 422 SLOT_CLOSED/UNKNOWN_SERVICE;503 CAPACITY_CHECK_UNAVAILABLE;429 | READ consistent snapshot, advisory only | contract-ready |
| P1-P03<br>P1 **POST** `/public/bookings` | PUB04; modified | BookingDialog submit; Public<br>[public modal](../src/components/public-booking/booking-dialog.tsx#L192) | Gửi yêu cầu và giữ chỗ thật | PublicBookingCreate; key | 201 PublicBookingReceipt | Noticeack=true, no internal fields, trusted source, approved operational config required | 409 CAPACITY_FULL/IDEMPOTENCY_CONFLICT;422;429;503 | CREATE: pending+resources+events/consent/outbox/key atomic; response không PII | contract-ready |
| P1-I01<br>P1 **GET** `/internal/health/live` | INT01; reused | Hạ tầng; Loopback/allowlist probe<br>[infrastructure requirement](../technical-documentation/SYSTEM_ARCHITECTURE.md#L256) | Liveness | không | 200 {status:up} | Không domain secrets; không authcookie cần | 503 | READ không dependency nặng | contract-ready |
| P1-I02<br>P1 **GET** `/internal/health/ready` | INT02; reused | Hạ tầng; Loopback/allowlist probe<br>[infrastructure requirement](../technical-documentation/SYSTEM_ARCHITECTURE.md#L256) | Readiness | không | 200 {status:ready} | DB reachable,migrations compatible; không mở booking khi config thiếu; readiness không đợi có data kinh doanh | 503 | READ; bookingEnabled health riêng trong station admin | contract-ready |

P1 không write arrive/receive/visit/complete; các flow đó thuộcP2/P3. New A01/A05/S04 phục vụ auth boundary, U03 phục vụ picker/tab xe có sẵn. Requirements/category/resource configuration đi qua service/policy aggregate hiện cần dùng, không thêm CRUD riêng mỗi field.


## 9. Detailed API Contracts for Critical Flows

### 9.1. Primitive types và request DTO Phase 1

Ký hiệu: **!** required; **?** optional; NULL chỉ khi ghi rõ. Mọi object strict. UUID canonical; Instant ISO8601 có offset; Date YYYY-MM-DD hợp lệ; Version integer>=1; Text(n) trim và1..n Unicode characters, trừ password. Headers key/CSRF theo mục 7. Query chỉ nhận field được liệt kê.

| DTO | Fields / type / default / validation |
|---|---|
| LoginInput | email!:email<=254 lowercase+trim; password!:string1..128 codepoints,<=512UTF-8 bytes, không normalize. Login kiểm tra credential cũ; tạo/đổi mới áp minimum15. |
| PasswordChangeInput | currentPassword!:string; newPassword!:password15..128 codepoints,<=512 bytes, không trùng current. |
| StaffCreateInput | name!:Text(100),phone!:VNPhone,email!:email<=254,jobRole!:MANAGER/ADVISOR/TECHNICIAN,active!:boolean; account?:{email!,temporaryPassword!,role!:MANAGER/ADVISOR,permissions?:[staff.manage/roles.manage]}. Có account đòi roles.manage. |
| StaffPatchInput | expectedVersion!,reason!:Text(400); ít nhất1 field name?,phone?,email?,jobRole?,active?,account?. account là một trong {enable:{email,temporaryPassword,role,permissions?}} chỉ khi chưa user hoặc {status?:ACTIVE/DISABLED,role?:MANAGER/ADVISOR,permissions?:grantCodes[]} khi đã có. Cấm vừa enable vừa update. |
| StaffQuery | q?:Text(100),jobRole?,active?:boolean,date?:Date,cursor?,limit?; sort=name:asc hoặc createdAt:desc. Workload chỉ từ bookings, shiftsAvailable=false P1. |
| ServiceWriteInput | code!:ASCII [A-Z0-9_-]3..50,name!:Text(120),categoryCode!:category option,active!:boolean,bookable!:boolean,sortOrder!:integer>=0,requirements!:[RequirementInput]; description?:Text(1000),marketingSlug?:Text(150). Requirements0..16 nếu non-bookable,1..16 nếu bookable; bookable=true đòi active=true. |
| RequirementInput | poolId!:UUID,units!:integer1..256,offsetMinutes!:integer0..1440,durationMinutes!:integer1..1440. Plan kết thúc<=1440 phút; pool active và đủ eligible units. Một requirement dùng cùng resource(s) liên tục hết đoạn. |
| ServicePatchInput | expectedVersion!,reason!,ít nhất một field ServiceWriteInput trừ code immutable. Thay requirements là replace plan trọn, tăng version, không sửa snapshots cũ. |
| ServiceQuery | q?,active?,bookable?,categoryCode?,cursor?,limit?,sort=name:asc hoặc sortOrder:asc. categoryOptions ở meta, từ seed canonical, chưa thêm category CRUD khi chưa có consumer. |
| CustomerQuery | q?,multipleVehicles?:boolean,cursor?,limit?,sort=name:asc hoặc createdAt:desc. |
| VehicleQuery | q?,customerId?:UUID,cursor?,limit?,sort=plate:asc hoặc createdAt:desc; thiếu plate xếp cuối, ID tie-break. |
| ContactInputPart | Một trong {id!:UUID} hoặc {name!:Text(100),phone!:VNPhone}. Không id kèm override global profile. VNPhone nhận raw0/84/+84 rồi normalize về +84 và 9 chữ số mobile, prefix3/5/7/8/9. Đây là định dạng, không xác minh thuê bao. |
| VehicleInputPart | NULL hoặc {id!:UUID} hoặc {model!:Text(100),plate?:Text(20),year?:integer1900..serverYear+1}. Public cho model optional nếu có plate; cả hai trống→NULL. Không dùng plate tự tìm/gộp. |
| NoticeInput | privacyNoticeVersion!:Text(40),privacyNoticeAcknowledged!:true,marketingConsent?:boolean defaultfalse. Notice version có nội dung đang áp dụng; staff ghi nhận thông báo được cung cấp cho khách. |
| PublicBookingCreate | customer!:{name,phone},vehicle?:VehicleInputPart defaultNULL,serviceIds!:orderedUUID[1..10]unique,requestedStartAt!:Instant,catalogVersion!:Version,policyVersion!:Version,note?:Text(1000),notice!:NoticeInput,channelToken?:signedString<=1024. Không actor/owner/status/stationId/internalNote/override. |
| StaffBookingCreate | customer!:ContactInputPart,vehicle?:VehicleInputPart defaultNULL,serviceIds!,requestedStartAt!,catalogVersion!,policyVersion!,source!:PHONE/AT_STATION/ZALO/OTHER,advisorId?:UUID hoặc NULL chỉ M,customerNote?,internalNote?,notice!. A owner từ identity, không gửi advisorId. AT_STATION là hẹn ghi tại quầy, không walk-in visit giả. |
| BookingPatchInput | expectedVersion!,reason!,customerContact?:{name,phone} chỉ snapshot lịch,vehicle?:VehicleInputPart,serviceIds?:orderedUUID[],catalogVersion? required khi đổi serviceIds,policyVersion? required khi replan,customerNote?,internalNote?. Ít nhất1change; không time/status/source/owner. New vehicle/link tạo cùng TX, không sửa hồ sơ xe cũ ngầm. |
| ConfirmInput | expectedVersion!,confirmedStartAt!:Instant,customerAgreed!:true,reason!,policyVersion? required nếu giờ khác scheduledStartAt. |
| RescheduleInput | expectedVersion!,newStartAt!:Instant,reason!,customerAgreed!:true,policyVersion!:Version. requestedStartAt gốc không đổi; scheduled/confirmed time và hold đổi cùng TX. |
| ReasonCommand / NoShowInput | {expectedVersion!,reason!:Text(400)}; NoShow thêm checkedManually!:true. |
| AssignInput / TransferInput | Assign={expectedVersion!,advisorId!:UUID,reason!}; Transfer dùng toAdvisorId!,không fromAdvisorId. |
| ContactInput | expectedVersion!,channel!:PHONE/ZALO/IN_PERSON/OTHER,outcome!:UNREACHED/AGREED/PROPOSED_TIME/DECLINED/OTHER,proposedStartAt?:Instant,customerAccepted?:boolean defaultNULL,note?:Text(1000). PROPOSED_TIME cần proposedStartAt; không tự confirm/reschedule. |
| BookingQuery | from/to:Date theo cặp, required khi xem calendar hoặc không có subject filter; có customerId?:UUID hoặc vehicleId?:UUID thì có thể bỏ cả hai để page history theo createdAt:desc. Khi có range vẫn<=93 ngày. q?,status?:CSV subset6bookingstatus,advisorId?:UUID hoặc unassigned chỉ M,serviceId?,categoryCode?,source?,changeKind?:NEW/RESCHEDULED/CANCELLED,sort?:scheduledStartAt:asc(default)/desc/createdAt:desc,cursor?,limit?. |
| HistoryQuery | from!:Date,to!:Date,q?:bookingCode,cursor?,limit?,sort=assignedAt:desc. q không tìm phone đã mất quyền. Historical events link B11 được scope riêng. |
| CapacityQuery | from!:Date,to!:Date,poolId?:UUID,resourceId?:UUID; capped31 ngày nên không cursor. |
| CapacityPolicyWrite | expectedVersion!,reason!,effectiveFrom!:Instant,bookingEnabled!:boolean,bucketMinutes!:integer5..120,startGridMinutes!:integer5..120,leadMinutes!:integer0..1440,advanceDays!:integer1..365,noShowGraceMinutes!:integer0..1440,hours!:[{weekday0..6,opensAt HH:mm,closesAt HH:mm}],pools!:[{id?:UUID,code,name,active,kind:INTAKE/EXECUTION/EQUIPMENT}],resources!:[{id?:UUID,code,name,active,poolCodes!:string[1..64],staffId?:UUID,weeklyAvailability!:[working intervals]}]. Codes3..50ASCII, names<=120. Resource capacity=1; nhiều units là nhiều resources thật. |
| Config IDs/version | Resource memberships write dùng poolCodes để tạo aggregate atomically, response trả IDs. Code/id đã có immutable. Thay aggregate thiếu entity đang có nghĩa retire; đụng holds→409, không xóa trace. K03 expectedVersion là station.configurationVersion, không policy.id/version cũ tùy ý. |
| BucketPatchInput | expectedVersion!,reason!,capacityLimit?:integer>=0,closed?:boolean; ít nhất một thay đổi; cap<=eligible physical units và>=heldUnits. Không nhận reserved/held client. |
| BlockCreateInput | startsAt!:Instant,endsAt!:Instant,reason!,kind!:HOLIDAY/MAINTENANCE/MANUAL_CLOSE,poolId? XOR resourceId? hoặc cả hai absent=station; end>start,range<=366 ngày. |
| AuditQuery | from!:Date,to!:Date,actorId?,action?,entityType?,entityId?,cursor?,limit?,sort=occurredAt:desc; range<=93 ngày. |
| SiteSettingsWrite | expectedVersion!,reason!,name!:Text(120),phone!:VNPhone,address!:Text(250),directionsUrl!:httpsURL<=2048, host thuộc google.com/subdomains, maps.app.goo.gl hoặc share.google (kiểm tra domain boundary),privacyNoticeVersion!:Text(40),marketingNoticeVersion?:Text(40). Notice version phải có nội dung published/static registry; không hours/timezone/resource/secrets. |

Multi-service plan v1 **tuần tự theo thứ tự serviceIds**; không sort mảng khi fingerprint. Mỗi service có offset/duration từ requirements snapshot; service kế tiếp bắt đầu sau max(offset+duration) của service trước. Requirement phải nằm trọn trong giờ cho phép của trạm/resource; v1 không tự chia một requirement qua nghỉ trưa/qua ngày. Dịch vụ cần plan khác chưa bookable đến khi hỗ trợ footprint phù hợp. Đây là giới hạn v1 đã nêu rõ, không lấy240 phút fixture làm định mức thật.

### 9.2. Response profiles Phase 1

Fields required trừ ?/NULL. Receipt là kết quả command gốc, không thay GET current detail. Page<T> là {data:T[],page:{nextCursor:string hoặc NULL,hasMore:boolean},meta:{requestId,correlationId,asOf?,counts?,categoryOptions?,jobRoleOptions?}}; companion metadata đúng loại được từng endpoint nêu.

| Profile | Schema |
|---|---|
| CsrfContext | {csrfToken:string,context:PREAUTH/AUTH,expiresAt:Instant}; không URL/log, no-store. |
| AuthSession | {user:{id,email,status:ACTIVE,authVersion},staff:{id,name,jobRole,stationId},roles:string[],permissions:string[],mustChangePassword:boolean,session:{expiresAt,idleExpiresAt},csrfToken:string}. Khi mustChange, permissions chỉ auth self-service; không bearer/hash. |
| StaffSummary | {id,name,jobRole,active,phone,email,version,accountEnabled,workload:{pending,confirmed},shiftsAvailable:false}. M+roles.manage thêm account:{userId,email,status,role,permissions,mustChangePassword}. A chỉ {id,name,jobRole,active,version} của mình. |
| ServiceAdmin | {id,code,name,description:nullable,category:{code,name},active,bookable,sortOrder,marketingSlug:nullable,requirements:[{id,poolId,units,offsetMinutes,durationMinutes}],estimatedDurationMinutes,version,catalogVersion}. categoryOptions ởmeta. |
| CustomerSummary | {id,name,phone,vehicleCount,bookingCount,version}; counts theo scope. |
| CustomerDetail | {id,name,phone,version,vehicles:VehicleSummary[],bookings:BookingSummary[],related:{vehiclesHasMore,bookingsHasMore,vehiclesUrl,bookingsUrl}}; relatedLimit default10,max20; cácURL trỏU03/B01 filter được phép. |
| VehicleSummary | {id,model:nullable,plate:nullable,year:nullable,version,customerContacts:[{customerId,name}] scoped}. |
| VehicleDetail | VehicleSummary+{bookings:BookingSummary[],bookingsHasMore,bookingsUrl,serviceHistoryAvailable:false}; P2 mới có visit history. |
| BookingSummary | {id,code,status,source,customer:{name,phone},vehicle:{id,model,plate} hoặc NULL,services:[{id,name}],requestedStartAt,scheduledStartAt,confirmedStartAt:nullable,assignedAdvisor:{id,name} hoặc NULL,changeKind,version}; không internalNote trong list. |
| BookingDetail | BookingSummary+{customerId,vehicleId:nullable,customerNote:nullable,internalNote:nullable,createdAt,requestedServiceSnapshots:[...],reservation:{id,status:ACTIVE/RELEASED,startAt,endAt,policyVersion},allowedActions:string[],lastContactOutcome:nullable}. Resource IDs/holds chi tiết chỉK01 Manager. Không thêm bookingVersion alias trùng version. |
| BookingEventView | {id,eventType,actor:{id,name} hoặc SYSTEM,occurredAt,reason:nullable,summary,fromStatus?,toStatus?,oldStartAt?,newStartAt?}. Former A chỉ event của mình trong interval assignment đã đóng, không raw PII/before-after/internal notes. |
| AssignmentHistoryView | {bookingId,bookingCode,assignmentId,assignedAt,endedAt,serviceNames,startAtSnapshot,statusAtTransfer,ownEventCount,ownEventsUrl}. ownEventsUrl=B11, được scope actor+interval trên server; không customerName/phone/plate/note/cost. |
| BookingMutationReceipt | {bookingId,bookingCode,status,requestedStartAt,scheduledStartAt,confirmedStartAt:nullable,reservation:{status,startAt,endAt},version,eventId}; không PII. |
| PublicBookingReceipt | {bookingId,bookingCode,status:PENDING,requestedStartAt,reservationStatus:ACTIVE,version}. |
| StaffMutationReceipt / ServiceMutationReceipt / SiteMutationReceipt / BucketMutationReceipt | {id,version,eventId}; Service thêm catalogVersion; không password. |
| PolicyMutationReceipt | {id,version,eventId,policyVersion,configurationVersion,effectiveFrom}; K03 expectedVersion là configurationVersion. |
| ContactMutationReceipt | {bookingId,contactEventId,version,eventId}; không tự đổi status. |
| CapacityPolicy | {stationId,bookingEnabled,configurationVersion,currentPolicy:{id,version,effectiveFrom,...configurationFields},scheduledPolicies:[{id,version,effectiveFrom}],pools:[...],resources:[...],memberships:[{poolId,resourceId}],hours:[...]}. catalogVersion là bộ đếm riêng. |
| CapacityCalendar | {stationId,timezone,from,to,policyVersion,asOf,buckets:[{id,poolId,startAt,endAt,capacityLimit,heldUnits,freeUnits,closed,version,holdRefs:[{bookingId,units}]}],resources:[{id,code,blocks:[...]}]}. freeUnits chỉ occupancy, chưa chứng minh continuous plan. |
| CapacityDayReceipt | {date,policyVersion,createdBucketCount,alreadyInitialized,eventId?}; cùng key giữ status gốc; kháckey đã cócùng policy→200. |
| CalendarBlock / BlockMutationReceipt | Block={id,kind,startsAt,endsAt,poolId:nullable,resourceId:nullable,reason,retiredAt:nullable,version}; Receipt={id,version,eventId,configurationVersion}. |
| BookingDashboard | {date,timezone,asOf,counts:{total,pending,confirmed,arrived,completed,cancelled,noShow,unassigned?},upcoming:BookingSummary[],canManageQueue}. Upcoming capped5, chưa terminal và>=serverNow; unassigned chỉ M; counts trên ngày scheduledAt, không page-limited. |
| AuditView | {id,actor:{id,name} hoặc SYSTEM,action,entityType,entityId,reason:nullable,occurredAt,requestId,correlationId,summary}; không raw secrets/PII. |
| SiteSettings | {stationId,name,phone,address,directionsUrl,timezone,privacyNoticeVersion,marketingNoticeVersion:nullable,version,bookingQrUrl}; signed channel QR không customer credential. |
| PublicBookingCatalog | {services:[{id,code,name,description,estimatedDurationLabel}],catalogVersion,policyVersion,timezone,bookingPolicy:{leadMinutes,advanceDays,startGridMinutes,privacyNoticeVersion,privacyNoticeUrl,marketingNoticeVersion:nullable},asOf}; chỉ service có plan/resources/hours enable. |
| AvailabilityView | {date,timezone,serviceIds:ordered[],catalogVersion,policyVersion,slots:[{startAt,endAt,status:AVAILABLE/FULL/UNAVAILABLE,reasonCode:nullable}],asOf,dayReasonCode?:SLOT_CLOSED}. P1 không tự phát minh ngưỡng LIMITED; adapter vẫn xử lý kiểuUI cũ khi sau này bổ sung. |

Public source do server xác định: signed channelToken hợp lệ và hiện enabled→QR, không token→WEBSITE; token sai400 CHANNEL_INVALID. SiteSettings GET tạo bookingQrUrl bằng secret riêng và station/channel version; không PII, không OTP/grant. Staff dùng source whitelist. Với customer/vehicle ID cũ phải có scope và link hợp lệ; new contact/vehicle được tạo như dữ liệu mới, không merge phone/plate.

### 9.3. Critical-flow JSON

Tất cả IDs/thời gian dưới đây minh họa, không dữ liệu trạm. Mỗi command có Idempotency-Key khác nhau; staff mutation thêm session/X-CSRF-Token. Các flow không được gọi nối tiếp với cùng example version nếu không đúng state thực.

#### Availability — P1-P02

GET query date=2026-11-16&serviceIds=10000000-0000-4000-8000-000000000001; serviceIds làCSV orderedUUID; một ngày/request.

```json
{
  "data": {
    "date": "2026-11-16",
    "timezone": "Asia/Ho_Chi_Minh",
    "serviceIds": ["10000000-0000-4000-8000-000000000001"],
    "catalogVersion": 4,
    "policyVersion": 7,
    "slots": [
      {"startAt": "2026-11-16T02:00:00Z", "endAt": "2026-11-16T03:00:00Z", "status": "AVAILABLE", "reasonCode": null},
      {"startAt": "2026-11-16T03:00:00Z", "endAt": "2026-11-16T04:00:00Z", "status": "FULL", "reasonCode": "CAPACITY_FULL"}
    ],
    "asOf": "2026-11-12T03:00:00Z"
  },
  "meta": {"requestId": "req-example", "correlationId": "flow-example"}
}
```

Không reserve. Closed day200 slots=[]+dayReasonCode; unknown service422; chưa config503; time past UNAVAILABLE. Public không thấy resource/customer giữ slot.

#### Public create — P1-P03, HTTP201

```json
{
  "customer": {"name": "Khách minh họa", "phone": "0900000000"},
  "vehicle": {"model": "Xe minh họa"},
  "serviceIds": ["10000000-0000-4000-8000-000000000001"],
  "requestedStartAt": "2026-11-16T09:00:00+07:00",
  "catalogVersion": 4,
  "policyVersion": 7,
  "note": "Kiểm tra theo yêu cầu.",
  "notice": {"privacyNoticeVersion": "privacy-v1", "privacyNoticeAcknowledged": true, "marketingConsent": false}
}
```

```json
{
  "data": {
    "bookingId": "20000000-0000-4000-8000-000000000001",
    "bookingCode": "DP-EXAMPLE-001",
    "status": "PENDING",
    "requestedStartAt": "2026-11-16T02:00:00Z",
    "reservationStatus": "ACTIVE",
    "version": 1
  },
  "meta": {"requestId": "req-create", "correlationId": "flow-example", "replayed": false}
}
```

201 chỉ sau pending+hold commit; retry cùng key meta.replayed=true. Catalog/policyversion stale409 CATALOG_CHANGED/POLICY_CHANGED, refresh trước sửa request dùng key mới. Không tự dùng thời lượng mới khác client đã xem. Optional blank plate/model từ UI được adapter bỏ; password không normalize theo quy tắc này.

#### Staff create — P1-B03

```json
{
  "customer": {"id": "30000000-0000-4000-8000-000000000001"},
  "vehicle": {"id": "40000000-0000-4000-8000-000000000001"},
  "serviceIds": ["10000000-0000-4000-8000-000000000001"],
  "requestedStartAt": "2026-11-16T09:00:00+07:00",
  "catalogVersion": 4,
  "policyVersion": 7,
  "source": "PHONE",
  "customerNote": "Hẹn qua điện thoại.",
  "internalNote": "Nhân viên đã ghi nhận yêu cầu.",
  "notice": {"privacyNoticeVersion": "privacy-v1", "privacyNoticeAcknowledged": true, "marketingConsent": false}
}
```

A owner=actor, M có advisorId/null. Trả201 BookingMutationReceipt PENDING; confirm action riêng. Không có confirmedDate/confirmedTime làm create nhảy CONFIRMED. Newcontact/vehicle/link chưa xác minh tạo cùng TX nếu dùng inlinepart; không tự cấp customer history access.

#### Assign / transfer — P1-B09/B10

```json
{"expectedVersion": 1, "advisorId": "50000000-0000-4000-8000-000000000001", "reason": "Phân công xử lý yêu cầu."}
```

```json
{"expectedVersion": 2, "toAdvisorId": "50000000-0000-4000-8000-000000000002", "reason": "Điều phối nhân sự phụ trách."}
```

200 receiptversion 2/3 tương ứng. Owner/history/snapshot summary/event/outbox atomic. Old A lưu tab cũ hoặc replay key sau transfer→404, B12/B11 chỉ historical projection cho phép. Target advisor phải ACTIVE vàcùng station.

#### Confirm — P1-B05

```json
{"expectedVersion": 3, "confirmedStartAt": "2026-11-16T09:00:00+07:00", "customerAgreed": true, "reason": "Đã thống nhất với khách."}
```

Cùng scheduledStartAt trả 200 CONFIRMEDversion 4, counter không tăng. Khácgiờ đòi policyVersion vàREPLAN. Chưa assign/target inactive không confirm. Không tạo visit/progress/work.

#### Reschedule — P1-B06

```json
{"expectedVersion": 4, "newStartAt": "2026-11-16T10:00:00+07:00", "policyVersion": 7, "customerAgreed": true, "reason": "Khách thống nhất giờ mới."}
```

200 CONFIRMEDversion 5. requestedStartAt gốc09h giữ, scheduled/confirmed10h; resource/bucket/contactsnapshot/events/audit/outbox/receipt một TX. 409 giữ nguyên 09h vàhold cũ.

#### Cancel / no-show — P1-B07/B08

```json
{"expectedVersion": 5, "reason": "Khách yêu cầu hủy."}
```

```json
{"expectedVersion": 5, "reason": "Nhân viên đã kiểm tra khách chưa đến.", "checkedManually": true}
```

Hai kịch bản riêng. Cancelpending/confirmed→CANCELLED; no-showconfirmed sau grace→NO_SHOW. Replaykey không release lần2; keykhác staleversion 409.

#### Contact — P1-B13

```json
{"expectedVersion": 4, "channel": "PHONE", "outcome": "PROPOSED_TIME", "proposedStartAt": "2026-11-16T11:00:00+07:00", "customerAccepted": false, "note": "Đang chờ phản hồi."}
```

201 event/version 5; không đổi scheduled/status/hold. Agreement không tự coi là lệnh confirm.

#### Conflict

```json
{
  "error": {"code": "CAPACITY_FULL", "message": "Khung giờ không còn đủ năng lực phục vụ.", "fields": []},
  "meta": {"requestId": "req-conflict", "correlationId": "flow-example"}
}
```

409 không data booking khác. VERSION_CONFLICT409 chỉ trả currentVersion nếu actor còn quyền. Failfield422, session401. Timeout chưa biết commit→retry cùng key; không toast thành công khi chưa xác nhận.

#### Policy impact — P1-K03/K05/K07

```json
{
  "error": {"code": "CAPACITY_IMPACT", "message": "Cấu hình ảnh hưởng lịch đã giữ chỗ.", "fields": []},
  "meta": {
    "requestId": "req-policy",
    "correlationId": "flow-example",
    "impactedBookingIds": ["20000000-0000-4000-8000-000000000001"]
  }
}
```

409 chỉ Manager thấy impacted refs. Không ghi một phần config/block. Điều phối đúng quyền hoặc thêm tài nguyên thật rồi gửi version/keymới; không force override.

### 9.4. Coverage và flow kế tiếp

P1 đã đặc tả auth/staff/catalog/customer/vehicle, public/staff create, assign/transfer, confirm/reschedule/cancel/no-show/contact, capacity/config/buckets/blocks, dashboard/audit/settings/probes. Receive/arrive/walk-in/quote/work/acceptance/handover/stock/payment thuộcP2–P4; chưa dựng endpoint statusPATCH thay thế. Full target94baseline được trace mục8.1, không coi46P1 là toàn bộCRM.


**Bổ sung input activation:** K03.bookingEnabled điều khiển nhận booking mới cho cả public và staff. Bậttrue chỉ khi policy/resources/hours và ít nhất một bookable service hợp lệ; thiếu trả422 BOOKING_CONFIG_INCOMPLETE. Tắt không tự hủy pending/holds; confirm cùng footprint và điều phối lịch cũ vẫn theo guard riêng. Client không gửi trustedsource hoặc grant truy cập khách. Consent marketing mặc định false là không cấp marketing cho booking này, không tự ghi opt-out toàn hồ sơ khách cũ.

## 10. Booking Capacity Algorithm & Concurrency

### 10.1. Điều kiện khả thi

C01–C12 ở mục 16 quyết định footprint. Không khóa duration, số unit, chiều dài bucket hoặc loại pool từ fixtures. Pool bucket chỉ đủ nếu units có thể thay thế và continuity đã được chứng minh; nếu cần đúng cầu/KTV xuyên suốt thì thêm resource-specific interval/allocation trước mở dịch vụ đó.

Một booking chứa nhiều services; service gồm nhiều requirement có offset/duration/units. Tổng hợp nhu cầu đồng thời của **cùng pool** trước kiểm tra. Bucket có phần giao interval phải giữ bảo thủ, không round xuống; `[start,end)` cho phép việc kế tiếp bắt đầu đúng lúc việc trước kết thúc khi policy buffer cho phép.

Availability là snapshot có catalogVersion/policyVersion/asOf; không tạo reservation chỉ vì khách đang xem hoặc chọn giờ. Submit luôn recheck. “Chưa biết thời lượng” không được quy đổi0 hoặc vô hạn; chỉ book giai đoạn kiểm tra/tiếp nhận nếu requirement đó được Manager duyệt.

### 10.2. Giao thức khóa đề xuất

Một transaction service chung cho booking/walk-in/đổi dịch vụ/config. Chốt thứ tự khóa thống nhất trong implementation:

1. Idempotency record/command key.
2. Station capacity-policy coordination rows, theo station/pool ID, khi command có footprint hoặc sửa policy.
3. Booking, visit và business aggregate liên quan theo thứ tự loại aggregate rồi ID.
4. Các bucket/resource interval bị ảnh hưởng theo pool/resource ID rồi startsAt.
5. Assignment/counter rows liên quan, kiểm tra scope/version sau lock.

Writer đơn giản chỉ khóa tập con nhưng không được khóa theo chiều ngược. Command transfer không capacity khóa booking trước visit; command allocation luôn lấy coordination lock trước aggregate. Luồng kiểm tra quyền trước lock chỉ là kiểm tra sớm, không đủ thay recheck.

**Điểm quan trọng:** cùng station coordination row dạng exclusive là phương án đầu tiên đơn giản, đúng nhưng serialize tất cả allocation trong một trạm. Có thể dùng nó khi tải đo được phù hợp. Nếu muốn tăng concurrency, thay bằng shared/exclusive policy version protocol hoặc lock pool/bucket được chứng minh và kiểm thử, không tự bỏ coordination để “tối ưu”. Chưa benchmark hoặc tuyên bố hiệu năng production.

### 10.3. Pseudocode transaction — thiết kế, không implementation

```text
validate request syntax, normalize identifiers and timestamps
authenticate / authorize preliminary scope, enforce rate limits
BEGIN
  claim idempotency key; verify fingerprint
  if completed replay:
    recheck current access; return permitted stored result
  lock coordination rows for affected station/pools
  lock existing booking/visit/aggregate if command updates one
  recheck current owner, permissions, state and expectedVersion
  read active catalog/policy snapshots
  build complete old/new resource footprint
  materialize missing bucket rows under unique keys, or reject unconfigured day
  lock union(old buckets, new buckets) in stable order
  verify hours, blocks, resources, capacity and policy version
  available = capacity - all active holds + this subject's old hold
  if any demand exceeds available: ROLLBACK with CAPACITY_FULL
  write aggregate + snapshots + reservation/allocation changes + counters
  append business events, audit and transactional outbox
  complete idempotency result
COMMIT
return success
```

Không gọi Zalo/OTP/storage/provider trong transaction giữ khóa. Upload trước tạo asset pending, attach/activate sau kiểm tra quyền và commit; orphan cleanup theo policy, không xóa file đang được tham chiếu.

### 10.4. Mutation boundary và failure behavior

| Command | Bất biến / rollback |
|---|---|
| Public/staff create | PENDING+ACTIVE reservation+allocations+snapshots+event/idempotency cùng TX; bất kỳ pool thiếu rollback toàn bộ. Staff cũng không override. |
| Confirm cùng giờ | State/version/owner đúng; không tăng held. Khác giờ = replan, không chỉ đổi confirmedStartAt. |
| Reschedule/service change | Khóa hợp bucket cũ/mới; cộng lại old hold chính subject khi tính free; generation mới chỉ active khi kế hoạch mới thành công. |
| Cancel/no-show | Release đúng một lần; state/audit/counter nhất quán. No-show kiểm tra grace/server clock/manual verification. |
| Receive booking | Unique booking→visit; booking ARRIVED, visit/owner/intake/event cùng TX. Chuyển ownership reservation hoặc tham chiếu cùng reservation theo model duyệt, không cấp thêm lần2. |
| Walk-in | BookingId=NULL. Nếu bắt đầu chiếm tài nguyên, allocate theo cùng footprint/locks; full thì từ chối phần tiếp nhận/khởi công yêu cầu allocation. Chỉ đăng ký chờ không thực thi nếu Q03 cho phép, không gọi đó là đã giữ chỗ. |
| Giảm capacity/đóng giờ | Kiểm tra tất cả hold bị ảnh hưởng cùng protocol; từ chối giảm dướiheld, trả impact trong scope. Emergency không được ghi counter vi phạm hoặc xóa lịch; đóng nhận mới và điều phối theo C08/C10. |
| Xe vượt giờ/ca nghỉ | Không có phần mềm nào tự tạo thêm tài nguyên vật lý. Ghi actual occupancy, chặn nhận mới bị ảnh hưởng, báo Manager điều phối các hold tương lai theo policy; không tự giữ lời hứa cũ bằng overbooking. |
| Counter reconcile | Đọc allocations từ snapshot nhất quán; phát hiện lệch đưa alert/đóng nhận mới an toàn. Không tự xóa reservation khách để khớp số. |

READ COMMITTED với khóa đầy đủ có thể đủ; SERIALIZABLE là lựa chọn cần retry serialization có giới hạn và idempotency. Không dùng cache/browser state/Redis lock làm nguồn quyết định cuối. Bất biến counter không âm/không vượt limit và SUM allocations cần transaction xuyên hàng, không chỉ CHECK DDL.

**Cần kiểm thử khi có backend:** hai create pending tranh unit cuối; multi-pool rollback; duration qua nhiều bucket/nghỉ; confirm không double-hold; reschedule dùng own hold; cancel lặp; policy đổi giữa submit; transfer trong lúc save; receive lặp; walk-in vs booking tranh tài nguyên; arrived overrun và stale availability; key retry sau timeout. Phase 0 chưa chạy các test này.

### 10.5. Đặc tả allocator Phase 1

Phần này cụ thể hóa C01–C12 theo quyền duyệt Phase 0, dùng **resource witness** để không hứa có chỗ chỉ từ tổng phút.

1. Resolve station và phiên bản catalog/config ở server. policyVersion external là station.configurationVersion; chọn capacity policy hiệu lực cho requestedStartAt. Các plan/giờ/membership của policy phải cover hết footprint, không tự lấy một policy cho ngày khác. Client versions stale trả409, không ghi theo plan khác mà khách chưa xem.
2. Services chạy tuần tự theo thứ tự serviceIds. Requirements bên trong mỗi service có offset và có thể đồng thời; mỗi requirement dùng units physical resources từ pool, liên tục trong interval của nó. Không chọn lại một cầu khác giữa các bucket để “lấp chỗ”.
3. Resource unit có capacity1, UUID/code bền vững, có thể là thiết bị hoặc nhân sự active được cấu hình; resource có nhiều pool memberships vẫn chỉ là **một** tài nguyên vật lý toàn station. Nếu gắn staffId, không được tạo hai resource đại diện cùng một KTV.
4. Tìm phép gán toàn footprint: xét requirements khó nhất trước (ít resource khả dụng rồi duration dài, tie-break requirement key); chọn resources theo code/ID ổn định và backtracking có giới hạn10000 nodes. Hai requirement thực sự chồng nhau không dùng cùng unit. Một unit có thể dùng lại trong cùng plan nếu raw intervals không chồng.
5. Làm tròn bảo thủ occupancy sang station bucket grid. Gộp intervals cho cùng resource trong cùng plan, lưu requirement_keys để không tạo hai row tự xung đột chỉ vì hai công việc nối tiếp giao cùng bucket. Giữ physical allocation trong reservation_allocations.
6. Tạo **reservation_bucket_charges** riêng cho từng pool/bucket: units là số distinct resources phục vụ requirements của pool trong bucket đó. Physical hold có thể phục vụ nhiều pool theo đoạn không chồng nhưng không nhân đôi physical allocation. admission counter=sum active charges; không SUM duration và không SUM nguyên xi số requirement.
7. Đủ điều kiện chỉ khi cả physical allocation không trùng hold khác, hours/resource availability/block hợp lệ, và pool admission held-oldOwn+newCharge<=capacityLimit ở mọi bucket. freeUnits để hiển thị=min(admission remaining,eligible resources đang thật sự rảnh qua các pool); không chỉ capacityLimit-heldUnits nếu units dùng chung pool.
8. Nếu exhaustive search hết lựa chọn không có witness→409 CAPACITY_FULL; search budget hết→503 CAPACITY_CHECK_UNAVAILABLE, không mô tả “đầy” khi chưa kết luận. Availability chạy cùng planner trên consistent read snapshot; write chạy lại dưới khóa.

**Khóa và DB guard:** station exclusive coordination lock trong7.4 bảo đảm các writer dùng cùng dữ liệu config/owner; tiếp theo khóa booking/union buckets/resources ổn định. GiST exclusion trên resource_id+tstzrange của allocation ACTIVE là guard cuối để chặn overlap kể cả khác pool/policy. [PostgreSQL range constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT) và [btree_gist UUID support](https://www.postgresql.org/docs/current/btree-gist.html) là căn cứ kỹ thuật; chưa cài extension hoặc migration trong nhiệm vụ này.

**Replan:** tính delta bằng oldOwn charges/resources; validate witness mới khi bỏ qua chính reservation hiện tại. Trong một TX sau khi đã khóa/validate đủ, đánh dấu release allocation/charges cũ rồi insert generation mới để không tự vi phạm immediate exclusion; mọi lỗi rollback khôi phục nguyên cũ. Không có giai đoạn commit giữ chỗ một phần hoặc giải phóng suất cũ trước khi thành công.

**Config impact:** sửa bucket width/grid, thay pool membership hoặc resource availability làm thay hình thức phân bổ trong interval có active holds thì trả409 để điều phối trước. Không đánh giá “an toàn” chỉ vì tổng units tăng. Thay giờ/blocks/retire staff/resource phải giữ mọi footprint cũ hợp lệ. Bucket không có active charge có thể retire/rebuild khi grid đổi, nhưng không xóa hàng đang có FK history. Khi thêm tài nguyên mới hợp lệ, bucket default limit có thể tăng; bucket is_override=true giữ admission cap đã đặt cho tới K05.

K05.closed là **ngừng nhận mới** tại bucket, giữ holds cũ và cho confirm cùng footprint; không là tuyên bố resource bị hỏng. K07 block MAINTENANCE/HOLIDAY là bất khả dụng thực, đè holds thì409. Giảm capacityLimit dưới heldUnits luôn409. Không có force/override qua bất kỳ endpoint.

**Config chưa có dữ liệu thật:** booking_enabled=false, chưa public bookable nếu requirements/resources/hours chưa publish đầy đủ. Duration/giờ/số unit/grace/lead là input vận hành, không seed từ fixtures. P1 schema và API có thể triển khai khi data còn trống; chưa cho public nhận lịch cho tới cấu hình được trạm xác nhận.

**Nội bộ và concurrency:** staff create không bypass lead/advance/hours/capacity. PENDING chưa assign vẫn giữ tài nguyên; không TTL tự release. Confirm cùng footprint không tăng counters; reschedule/service edit replan cả plan và không đổi requestedStartAt gốc. Cancel/no-show release physical+logical charges đúng một lần. Transfer chỉ đổi owner/history, không đổi capacity.

P1 chưa có visit/actual occupancy. Khi triển khai P2, arrive phải chuyển/tiếp tục reservation mà không double-hold; overrun ở P3 cần actual resource handling. Không mở flow physical occupancy chưa có dữ liệu/guard bằng statusPATCH P1.


## 11. Database Contract & Schema Change Plan

### 11.1. Hợp đồng dữ liệu nền

UUID PK; `timestamptz` cho thời điểm thực, date/time cho lịch lặp theo station timezone; FK explicit, RESTRICT mặc định với lịch/visit/ledger/audit. Mutable aggregate có version>=1; event/ledger append-only. Numeric/decimal string cho tiền và qty; precision/rounding chốt Q05/Q07. Không UNIQUE phone/plate mặc định.

Snapshot định danh khách liên hệ, service name/duration/catalog version và quote line tại thời điểm giao dịch; không nhân bản thông tin nhạy cảm thừa. Không xóa booking/visit để “xóa nợ”; retention/ẩn danh cần Q09. Station ID ở giao dịch/resource/chứng từ/ledger; quyền không chỉ dựa có cột station.

### 11.2. Delta bắt buộc so baseline50 bảng

Đây là **delta thiết kế proposed**, chưa là schema đầy đủ. Số bảng mới/đổi cuối chưa khóa vì quyết định resource-specific, identity và ledger có thể thay cấu trúc. Không copy50 bảng rồi thêm mọi ý tưởng tương lai.

| Bảng/nhóm baseline | Thay đổi đề xuất | PK/FK/unique/index/check trọng yếu | Phase / lý do |
|---|---|---|---|
| users,staff_profiles,user_roles,sessions | Chốt account↔staff và permission bundle; không lấy job_role làm auth_role | Subject/email login unique khi áp dụng, token hash, active/revoked indexes; quyền station scope | P1, Q01/Q02 trước auth schema. |
| customers,vehicles,customer_vehicle_links | Liên hệ nhiều người/xe theo thời gian, không auto-merge | Phone/plate index không mặc định unique; FK links, validTo>validFrom | P1; quyền history và migration. |
| services,categories,requirements | Canonical mapping, requirement hiệu lực/snapshot | Code unique, requirement units/duration>0, không hiệu lực chồng chưa có precedence | P1; D05/C01–12. |
| bookings,booking_services,booking_assignments | Appointment không dùng làm walk-in placeholder | Code unique; FK service snapshot; một active advisor assignment, list indexes station/owner/start/status | P1; same backend public/staff. |
| service_visits | booking_id **NULL được**; thêm station,customer,vehicle,visit owner,origin,receivedAt,followUpOfVisitId? | UNIQUE booking_id khi nonnull; FK follow-up nếu có; scope/list/history indexes owner/station/receivedAt/vehicle; nullable booking không cho null owner giả | P2; schema cũ NOT NULL tại [technical-documentation/DATABASE_DESIGN.md:235](../technical-documentation/DATABASE_DESIGN.md#L235) không còn đủ. |
| visit_assignments | Mở rộng advisor visit history và KTV job assignments; không buộc qua booking | Partial unique một primary advisor hiện hành/visit, role-kind rõ, validity interval | P2/P3; walk-in transfer không mất scope/audit. |
| capacity_reservations | Subject booking_id hoặc visit_id, **XOR đúng1 nonnull**; generation/policy snapshot | FK cả hai, CHECK XOR; unique active reservation theo từng subject, không thay bằng polymorphic ID thiếu FK | P1/P2; arrival chuyển subject atomic, không nhân hold. |
| buckets/allocations/resource pools | Hoàn thiện multi-bucket/units; thêm resource-specific tables nếu C12 yêu cầu | Unique pool/start, counter check; FK allocations; resource interval anti-overlap nếu có | P1; không chỉ phút trong start window. |
| quotes/revisions/lines | Revision và base/change-order refs; evidence; manual/free case | Unique quote/revisionNo; FK approved snapshot belongs-to, qty>0,percent0..100 | P3; quick quote nullable visit riêng chỉ khi Q08 duyệt. |
| work_orders/work_items/work_logs | Checklist không bắt buộc quoteLine; nhiều KTV nếu cần | FK quoteLine optional, immutable logs, assignment scope, progress0..100 | P3; CRM có công việc dự kiến tách quote. |
| acceptances/checks/progress | Inspection/rework/ready/handover riêng | FK visit, checked actor, actual timestamps; no false history before handover | P2/P3; Q06. |
| inventory_movements/parts/part_requests | Thêm stock document+lines, stock balances/reservations để post/reconcile đủ chứng từ | Unique command/source refs, warehouse+part balance unique, qty decimal/nonnegative available, immutable reversal refs | P4; nhập/xuất/trả/kiểm kê/write trước cutover, tên bảng chi tiết sau Q04. |
| payment_entries | Subject booking/visit hợp lệ, originalEntry/refund refs; thêm allocations/receipts khi cần | Amount>0, currency/method; unique external/command ref, locked refundable/allocatable remaining, sum kiểm traTX | P4; cọc trước nhận xe, thu nhiều lần, hoàn/đảo không xóa gốc. |
| outbox_jobs/notifications/audit | Event đúng recipient và subject, visit không booking vẫn audit được | Unique event/recipient, retry/lease indexes, actor/request/correlation IDs; không PII thừa | Nền P1, inbox/adapters P5. |
| content/media/revisions | Private intake media P2, public CMS P5, lifecycle asset | Storage key unique, visibility+subject FK; publishedRevision thuộc item; auth access | P2/P5, không trì hoãn ảnh cần nhận xe. |
| Chưa có external provenance/batches | Thêm external identities/import batches/errors/reconciliation manifest theo Q08 | Unique(sourceSystem,entityType,externalId); checksum/version; linking business record FK có type rõ | Planning P0, thiết kế mapping trước schema, thực hiện P6. |
| Customer access/waitlist | Giữ extension deferred | Scoped grants/hash/TTL/attempt, waitlist không capacity hold | Sau cutover nếu D03/D08/D09 duyệt. |

### 11.3. Toàn bộ50 tên baseline và hướng xử lý

Danh sách dưới phục vụ trace tên cũ, không tạo thêm50 bảng hoặc mô tả toàn bộDDL. Chi tiết field của baseline nằm [DATABASE_REQUIREMENTS](../docs/backend-audit/DATABASE_REQUIREMENTS.md).

| Baseline | Hướng rà soát Phase 0 |
|---|---|
| `stations`, `users`, `staff_profiles`, `user_roles`, `sessions` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `customers`, `vehicles`, `customer_vehicle_links`, `service_categories`, `services` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `resource_pools`, `service_resource_requirements`, `business_hours`, `calendar_blocks`, `capacity_policies` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `capacity_buckets`, `bookings`, `booking_services`, `capacity_reservations`, `reservation_allocations` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `booking_assignments`, `booking_events`, `consents`, `idempotency_keys`, `audit_logs` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `outbox_jobs`, `booking_contact_events`, `notifications`, `service_visits`, `service_progress_events` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `staff_shifts`, `media_assets`, `quotes`, `quote_revisions`, `quote_lines` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `work_orders`, `work_items`, `work_logs`, `acceptances`, `acceptance_checks` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `visit_assignments`, `parts`, `inventory_movements`, `part_requests`, `payment_entries` | Có bảng cần sửa contract/phase như delta trên; bảng còn lại tái dùng ý nghĩa sau review field/permission. |
| `content_items`, `content_revisions`, `verification_challenges`, `access_grants`, `waitlist_requests` | Giữ ý nghĩa baseline; rà field/phase/permission theo target. |

Chưa công bố tổng bảng target hoặc số bảng “đã chốt”. Các constraint xuyên aggregate (counter SUM, current owner/assignment, quote revision belongs-to, refundable amounts) cần transaction/service hoặc ràng buộc phù hợp; FK/CHECK đơn lẻ không đủ.

### 11.4. SQL contract Phase 1 — 33 bảng

Đây là schema thiết kế để implement bằng Drizzle/PostgreSQL, không DDL/migration được chạy. P1 có 33 bảng kể cả credentials, rate limit, resource witness và pool charges. **Không đồng nghĩa 33 bảng thay toàn CRM baseline 50 bảng**; visit/kho/finance/CMS/migration giữ phase sau.

Mặc định mỗi bảng có id uuid PK và created_at timestamptz NOT NULL, trừ PK ghép/PK user_id ghi rõ. Field không ghi NULL là NOT NULL; FK không ghi kiểu là uuid. Mutable aggregate có updated_at và version integer>=1; event/ledger/audit/contacts/consents không UPDATE lịch sử. FK ON DELETE RESTRICT, không cascade xóa lịch/audit. Chỉ uniqueness đã nêu, không tự unique phone/plate. Không tạo index trùng PK/unique; cột normalized search dùng function chuẩn hóa Unicode tiếng Việt tại ứng dụng, không chạy query raw SQL từ client.

Các PK ghép không có id: user_roles,user_permission_grants,resource_pool_members,booking_services,rate_limit_buckets. user_credentials dùng user_id PK. users/staff/catalog/counters/config/bookings/reservation/key/job là mutable theo tác vụ tương ứng; allocations/charges chỉ chuyển released_at trong TX, không sửa interval lịch sử.

| Bảng / scope Phase 1 | Cột riêng và kiểu | PK/FK/unique/check | Index cần thiết | Consumer / rule |
|---|---|---|---|---|
| `stations` | code text,name varchar(120),phone varchar(20),address varchar(250),timezone text,directions_url text,privacy_notice_version text,marketing_notice_version text NULL,configuration_version int,catalog_version int,qr_channel_version int,booking_enabled boolean | U(code); timezone='Asia/Ho_Chi_Minh' P1; versions>=1; booking_enabled=false khi chưa config | PK và U(code) đủ P1 | T01/T02; station row là coordination/governance lock |
| `users` | email_normalized varchar(254),status text,auth_version int,must_change_password boolean,last_login_at timestamptz NULL | U(email_normalized); status ACTIVE/DISABLED; auth_version>=1 | status,id | A02/A04; không password rõ |
| `user_credentials` | user_id uuid PK/FK users,password_hash text,password_salt text,algorithm text,parameters jsonb,changed_at timestamptz,version int | Không id riêng; user_id unique; algorithm=scrypt-v1; params validated allowlist | PK user_id | A05/S04; credential version recheck sau hash |
| `staff_profiles` | station_id FK stations,user_id FK users NULL,name varchar(100),phone_normalized varchar(20),email varchar(254),job_role text,active boolean | U(user_id) khi nonnull; job_role MANAGER/ADVISOR/TECHNICIAN; FK user không cấp role bằng job | station_id,active,job_role,id | S01–S03; một staff/user/station P1 |
| `user_roles` | user_id FK users,role_code text,granted_by FK users NULL,granted_at timestamptz | PK(user_id,role_code),không id; U(user_id) để một operational role P1; role MANAGER/ADVISOR | role_code,user_id | S02/S03; CMS permission phase5 không tự hiện thực role mới |
| `user_permission_grants` | user_id FK users,permission_code text,granted_by FK users NULL,granted_at timestamptz | PK(user_id,permission_code),không id; P1 chỉ staff.manage/roles.manage; chỉ MANAGER được cấp; cross-row rule trong GOV | permission_code,user_id | Quyền account không tự đi theo job_role; last authority guard |
| `sessions` | user_id FK users NULL,kind text,token_hash text,csrf_token text,auth_version int NULL,issued_at timestamptz,last_seen_at timestamptz,expires_at timestamptz,revoked_at timestamptz NULL | U(token_hash); PREAUTH→user_id/auth_version NULL; AUTH→nonnull; expiry>issued; csrf random riêng | user_id,revoked_at; expires_at | A01–A05; revoke không log token; csrf không public cookie |
| `customers` | name varchar(100),normalized_name text,phone_normalized varchar(20),origin text | Không U(phone); origin PUBLIC/STAFF/MIGRATION; phone canonical VN | phone_normalized; normalized_name,id | Chỉ create qua booking P1; không merge |
| `vehicles` | model varchar(100) NULL,normalized_model text NULL,plate_normalized varchar(20) NULL,model_year smallint NULL,origin text | Không U(plate); year nếu có>=1900; model/plate ít nhất1 khi tạo vehicle; dữ liệu chưa biết trả NULL | plate_normalized; normalized_model,id | U03/U04; id không phụ thuộc biển |
| `customer_vehicle_links` | customer_id FK customers,vehicle_id FK vehicles,relationship text,verified_at timestamptz NULL,valid_from timestamptz,valid_to timestamptz NULL,source text | U(customer_id,vehicle_id,relationship,valid_from); valid_to>valid_from; CONTACT không tự OWNERverified | customer_id,valid_to; vehicle_id,valid_to | Relation nghiệp vụ, không tự customer grant |
| `service_categories` | code text,name varchar(120),sort_order int,active boolean | U(code); seed canonical MAINTENANCE/DETAILING/ACCESSORIES/OTHER có labelVN, không seed duration/pool thật | active,sort_order,id | C01 options; loại nhóm có thể mở rộng phase sau, không gộp service theo tên |
| `services` | category_id FK service_categories,code text,name varchar(120),description text NULL,marketing_slug text NULL,active boolean,bookable boolean,sort_order int,plan_revision int | U(code); U(marketing_slug) khi nonnull; bookable→active; plan_revision>=1; bookable plan hợp lệ doCFGvalidate | category_id,active,bookable,sort_order,id | C01–C03; không copy thời lượng fixtures |
| `service_resource_requirements` | service_id FK services,plan_revision int,sequence_no int,pool_id FK resource_pools,units int,offset_minutes int,duration_minutes int | U(service_id,plan_revision,sequence_no); units1..256,duration1..1440,offset>=0,end<=1440; rows revision immutable | service_id,plan_revision; pool_id | Catalog plan giữ lịch sử; booking_services snapshot references revision |
| `resource_pools` | station_id FK stations,code text,name varchar(120),kind text | U(station_id,code); kind INTAKE/EXECUTION/EQUIPMENT; identity/code không tái dùng cho vật lý khác | station_id,code | Khác service categories; active/membership theo policy hiệu lực |
| `resource_units` | station_id FK stations,code text,name varchar(120),staff_id FK staff_profiles NULL,introduced_at timestamptz,retired_at timestamptz NULL | U(station_id,code); mỗi resource capacity1; code không reuse; retire ảnh hưởng hold→409; U(staff_id) khi nonnull; staff cùng station vàactive, tránh nhân đôi năng lực một KTV | station_id,retired_at,id | C12 giữ đúng resource xuyên requirement, không capacity ảo |
| `resource_pool_members` | policy_id FK capacity_policies,pool_id FK resource_pools,resource_id FK resource_units | PK(policy_id,pool_id,resource_id),không id; tất cả cùng station; membership immutable từng policy | resource_id,policy_id; pool_id,policy_id | Một resource có thể dùng nhiều pool nhưng global interval constraint không cho double-book |
| `business_hours` | policy_id FK capacity_policies,resource_id FK resource_units NULL,weekday smallint,opens_at time,closes_at time | weekday0..6,close>open; NULLresource=stationhours; Upartial(policy_id,weekday,opens_at)WHERE resourceNULL; Upartial(policy_id,resource_id,weekday,opens_at)WHEREnonnull; không overlap cùng scope | policy_id,resource_id,weekday | Giờtrạm và resource được publish một policy; không suyca nhân viên |
| `calendar_blocks` | station_id FK stations,pool_id FK resource_pools NULL,resource_id FK resource_units NULL,kind text,starts_at timestamptz,ends_at timestamptz,reason varchar(400),created_by FK users,retired_at timestamptz NULL | Pool/resource tốiđa1; end>start; same-station FK checks; không block đè held interval | station_id,starts_at,ends_at; pool_id,starts_at; resource_id,starts_at | K06–K08; retire có audit, không harddelete |
| `capacity_policies` | station_id FK stations,policy_version int,effective_from timestamptz,effective_to timestamptz NULL,bucket_minutes int,start_grid_minutes int,lead_minutes int,advance_days int,no_show_grace_minutes int,published_by FK users | U(station_id,policy_version); thời gian hiệu lực không chồng; bucket/startgrid5..120; lead/grace0..1440; advance1..365; config immutable khi publish | station_id,effective_from DESC | ExternalpolicyVersion=station.configurationVersion; record publish giữ snapshot params/hours/memberships |
| `capacity_buckets` | station_id FK stations,pool_id FK resource_pools,origin_policy_id FK capacity_policies,starts_at timestamptz,ends_at timestamptz,capacity_limit int,held_units int,closed boolean,is_override boolean,retired_at timestamptz NULL | PartialU(pool_id,starts_at)WHERE retiredNULL; end>start,0<=held<=limit; capacity_limit<=eligible physicalunits do TX validate; bucketinterval immutable | station_id,starts_at; pool_id,starts_at,ends_at | Counter admission theo pool, không đủ thay resource witness; retire/rebuild chỉ nếu không active allocation vàgiữFK history |
| `bookings` | station_id FK stations,code text,customer_id FK customers,vehicle_id FK vehicles NULL,contact_snapshot jsonb,vehicle_snapshot jsonb NULL,requested_start_at timestamptz,scheduled_start_at timestamptz,confirmed_start_at timestamptz NULL,status text,source text,assigned_advisor_id FK staff_profiles NULL,customer_note text NULL,internal_note text NULL,change_kind text,created_by FK users NULL,cancelled_at timestamptz NULL,cancel_reason text NULL,arrived_at timestamptz NULL,completed_at timestamptz NULL,last_contact_outcome text NULL | U(code); status6enum; confirmed/arrived/completed→confirmedStart nonnull; requestedStart immutable; createPENDING; noforce; assignedadvisor đồng bộ history | station_id,scheduled_start_at,id; assigned_advisor_id,status,scheduled_start_at,id; customer_id,created_at,id; vehicle_id,created_at,id | B01–B13; runtime datetime offset, contact sửa snapshot không âm thầm sửa globalprofile |
| `booking_services` | booking_id FK bookings,service_id FK services,sequence_no int,service_name_snapshot text,plan_revision int,plan_snapshot jsonb,catalog_version int | PK(booking_id,service_id),không id; U(booking_id,sequence_no); snapshot immutable cho mỗi bookingversion; plan allowlist cóunits/offset/duration/pool | service_id,booking_id | Service IDs order quan trọng; service edit replan replaces snapshot với event cũ giữ |
| `capacity_reservations` | booking_id FK bookings,status text,generation int,policy_version int,start_at timestamptz,end_at timestamptz,held_at timestamptz,released_at timestamptz NULL,release_reason text NULL | U(booking_id,generation); PartialU(booking_id)WHERE statusACTIVE; statusACTIVE/RELEASED; end>start; ACTIVEreleasedNULL; khôngTTL P1 | status,start_at; booking_id,generation | P1 chỉ booking; P2 mới thêm visit_id/FK và booking nullable+CHECKXOR, không tạo visit rỗng P1 |
| `reservation_allocations` | reservation_id FK capacity_reservations,resource_id FK resource_units,requirement_keys text[],start_at timestamptz,end_at timestamptz,released_at timestamptz NULL | FKs; end>start; interval phủ trọn occupancy buckets của raw requirements; requirement_keys không rỗng, thuộc booking plan snapshot; PartialU(reservation_id,resource_id,start_at,end_at)WHERE releasedNULL; EXCLUDE(resource_id WITH =,tstzrange(start_at,end_at,'[)')WITH &&)WHERE releasedNULL dùng btree_gist | resource_id,start_at,end_at; reservation_id,released_at | Giữ vật lý global xuyên pool/policy; gộp interval cùng resource trong một plan khi rawrequirements không chồng; counter dùng charges riêng |
| `reservation_bucket_charges` | reservation_id FK capacity_reservations,bucket_id FK capacity_buckets,units int,released_at timestamptz NULL | PartialU(reservation_id,bucket_id)WHERE releasedNULL; units>0; SUMactivecharges=bucket.held_units trong TX; units là distinctresources của requirementpool ởbucket, không SUMduration | bucket_id,released_at; reservation_id | Tách logicalpool admission khỏi physicalintervalallocation, tránh double-count khi resource dùng nhiều pool hoặc hai requirement kế tiếp cùng bucket |
| `booking_assignments` | booking_id FK bookings,advisor_id FK staff_profiles,assigned_by FK users,assigned_at timestamptz,ended_at timestamptz NULL,reason varchar(400),historical_snapshot jsonb NULL | PartialU(booking_id)WHERE endedNULL; ended>assigned; historicalsnapshot khiended gồm allowlist không PII; ownerhistory một TX | advisor_id,assigned_at,id; booking_id,assigned_at | B09/B10/B12, recheckscope saulock |
| `booking_events` | booking_id FK bookings,type text,actor_user_id FK users NULL,actor_type text,occurred_at timestamptz,reason text NULL,before_data jsonb NULL,after_data jsonb NULL | Append-only; actor_type PUBLIC/STAFF/SYSTEM; allowlist, không credential/rawPII; eventIdFKreceipt | booking_id,occurred_at,id; actor_user_id,occurred_at | B11 projection hiện/quá khứ, rawJSON không serialize |
| `booking_contact_events` | booking_id FK bookings,actor_user_id FK users,channel text,outcome text,proposed_start_at timestamptz NULL,customer_accepted boolean NULL,note_internal text NULL,contacted_at timestamptz | Append-only; enumcontract; proposal không đổi hold; confirmed/reschedule agreement tạoevent liênkết | booking_id,contacted_at,id | B13 và evidence B05/B06 |
| `consents` | customer_id FK customers,booking_id FK bookings,type text,notice_version text,granted boolean,source text,recorded_by FK users NULL,recorded_at timestamptz | Append-only; types SERVICE_NOTICE_ACK/MARKETING; marketingfalse ghi rõ, không opt-in mặc định; minimal evidence | customer_id,type,recorded_at; booking_id | Public/staff notices cùng booking TX, không tự hiểu xác minhcustomer |
| `idempotency_keys` | scope text,key_hash text,request_fingerprint text,state text,resource_type text NULL,resource_id uuid NULL,response_status smallint NULL,response_receipt jsonb NULL,expires_at timestamptz | U(scope,key_hash); stateIN_PROGRESS/COMPLETED; HMAC fingerprint; không auth token/passwordcache; resourcepolymorphic có service validate | expires_at; resource_type,resource_id | Claim cùng business TX; replay recheckscope; receipt không PII |
| `audit_logs` | actor_user_id FK users NULL,actor_type text,action text,entity_type text,entity_id uuid NULL,reason text NULL,occurred_at timestamptz,request_id text,correlation_id text,summary text,before_data jsonb NULL,after_data jsonb NULL | Append-only; entitypolymorphic service validate; nosecret/noOTP/CSRF | occurred_at,id; entity_type,entity_id,occurred_at; actor_user_id,occurred_at | GOV/CFG/booking/auth securityevents |
| `outbox_jobs` | event_key text,kind text,aggregate_type text,aggregate_id uuid,payload jsonb,status text,attempts int,scheduled_at timestamptz,next_attempt_at timestamptz NULL,lease_until timestamptz NULL,last_error_code text NULL | U(kind,event_key); statesPENDING/PROCESSING/SENT/FAILED; attempts>=0; payload IDs/allowlist | status,next_attempt_at,scheduled_at | Atomiccoreevent; worker sau commit; P1 chưa gửiZalo |
| `rate_limit_buckets` | scope text,subject_hash text,window_start timestamptz,window_seconds int,hits int,expires_at timestamptz | PK(scope,subject_hash,window_start),khôngid; hits>=0,window>0; atomicUPSERT+increment, không raw IP/phone | expires_at | Persistentantiabuse nhiều process, không Redis; dọn expiry cóscope |

#### Quy tắc xuyên bảng và giới hạn migration

- Same-station: staff owner, customer/vehicle reference scope, pool/resource/membership/policy/bucket phải thuộc station transaction. FK kiểm tra tồn tại; service checks dưới station lock bảo đảm quan hệ xuyên hàng, không chỉ tin UUID client.
- station.configuration_version tăng khi policy/block/admission thay đổi; catalog_version tăng khi service/requirements thay đổi. Bucket.version bảo vệ sửa một bucket; policy params/hours/membership snapshots immutable, effective_to chỉ đóng đời policy khi publish version kế tiếp trongCFG.
- capacity_buckets.origin_policy_id ghi provenance sinh hàng, **không** là nguồn authoritative thay current effective policy. Unique active pool/start và immutable interval; thay grid cần không activehold bị ảnh hưởng trước retire/rebuild.
- held_units=sum active reservation_bucket_charges.units. Physical GiST exclusion chặn resource overlap toàn station; counters không thay proof continuity. Counter/charge/allocation reconciliation đọc snapshot nhất quán; phát hiện lệch chặn nhận mới và báo Manager, không xóa hold cho khớp.
- Một current booking advisor, một active reservation/generation và receipt idempotent duy nhất. Assignment.owner/staff/account/roles hiện hành phải được recheck sau khóa. Staff disable còn lịch pending/confirmed hoặc còn active resource holds cần409 và Manager điều phối.
- requested_start_at gốc bất biến; scheduled_start_at là thời điểm dùng mọi calendar/filter hiện tại. confirmed_start_at chỉ có sau explicitconfirm, được cập nhật khi reschedule confirmed. snapshot giữ nội dung lúc đặt/sửa lịch với audit trước/sau; customerContact sửa snapshot không âm thầm mutate customer global.
- BookingServices snapshot có plan_revision/name/pools/units/offset/duration/sequence và catalog_version. Thay service xóa/insert current association trong TX nhưng event snapshot cũ được giữ; không sửa service_resource_requirements revision đã được tham chiếu.
- P1 capacity_reservations.booking_id NOT NULL. **P2 migration đã được dự kiến:** thêm visit_id FKservice_visits, alterbooking_id nullable, CHECK exactlyonebooking/visit, partialunique active theo mỗi subject. P1 không tạo service_visits rỗng hoặc FK trỏ bảng chưa có. UUID/provenance không cản legacy mapping sau.
- Role/permission/account admin là dữ liệu security, không nằm trong fields job_role. First authority setup offline có audit; khi change role/status tăng auth_version+revokesessions và không được bỏ authority cuối. Mã password không trong cache idempotency receipt, audit hayoutbox.
- Extension btree_gist được yêu cầu trong migration implementation do cầnUUID+range exclusion; migration role có quyền phù hợp, runtime không superuser. Không thêm database của hệ thống bán xe vào transaction.
- Retention chưa có số năm/ngày nghiệp vụ thật; default vận hành không hard-delete booking/consent/audit. Chỉ cleanup session/rate key/idempotency expired theo chính sách kỹ thuật, không dùng cleanup để xóa hồ sơ.

#### Thứ tự implementation schema được đề nghị

1. stations/users/credentials/staff/roles/grants/sessions và bootstrap authority.
2. Customers/vehicles/links/categories/services/resource identities.
3. Policy/hours/memberships/requirements/buckets/blocks và station versions.
4. Bookings/services/assignments/reservations/allocations/charges.
5. Contact/events/consent/idempotency/audit/outbox/rate limits; có thể tạo infrastructure tables sớm hơn để migration bootstrap ghi audit.
6. Seed **chỉ** category codes/permission names và station draft không booking; account bootstrap qua quy trình riêng, không commit mật khẩu. Catalog/resources/hours cần dữ liệu trạm, không import localStorage/fixtures.
7. Focused integration tests và migration trên DB test; go-live cần restore/ops gate theo nhiệm vụ được duyệt. Không có thao tác nào ở các bước này được chạy trong lượt thiết kế.


## 12. Frontend Integration Map

Phase 0 chỉ xác định điểm tích hợp; chưa thay source hoặc mocks. Mục2.3 bao phủ40 nhóm; bảng sau chỉ rõ các consumer chính và DTO/scope.

| Route/component | API/DTO nền | Permission/scope | Phase / UX tối thiểu cần bổ sung |
|---|---|---|---|
| Public booking launcher/dialog/schedule | Public catalog, availability, create DTO public | Public tối thiểu, không PII record khác | P1; notice/consent, success mã thật/PENDING;409 giữ form, reselect slot; timeout giữ cùng key. |
| /co-van + BookingProvider/repository | Booking list/detail/commands + session identity | Advisor current assignment hoặc history projection D11 | P1; không dropdown mở scope, không “Vẫn lưu” bypass; không seed fallback khi API lỗi. |
| /co-van/tiep-nhan/[id] + AdvisorProvider | Booking receive/intake DTO staff | Booking owner → visit owner | P2; một submit atomic, media private; file form giữ layout. |
| Nhánh walk-in chưa có route riêng trong source | POST service-visits, scoped contact/vehicle lookup | A tự phụ trách/M assign theo Q03 | P2; cần thêm entry “Tiếp nhận xe trực tiếp” dùng lại reception form, không bắt chọn booking giả. |
| /co-van/phieu-dich-vu/[id], editors | Visit/quote/work/acceptance DTO riêng | Visit owner; KTV/inspector permission nếu có | P2/P3; version conflict giữ draft; revision approved readonly; handover action rõ sau ready. |
| /dieu-hanh/lich-hen/nang-luc/nhan-su | Booking/assignment, policy/calendar, staff DTO | Manager station scope; rights admin tách | P1; impact khi config đụng holds, không tự giảm counter. |
| /dieu-hanh/dieu-phoi/phieu-dich-vu/bao-gia | Operations/visit/quote read models | Manager scope; cost permission riêng | P3/P5; aggregates có asOf, không một số đếm lấy trên page. |
| /dieu-hanh/kho | Stock documents/ledger/request-reservation DTO | Inventory permission Q02/Q04 | P4; hiện UI đọc, cần thêm luồng ghi bằng pattern hiện có trước cutover. |
| /dieu-hanh/tai-chinh | Payment ledger/collect/refund/receipt/report DTO | Cashier/approval permissions Q02/Q07 | P4; hiện UI đọc, cần form ghi và chứng từ; không lấy status done làm thực thu. |
| /dieu-hanh/website/* và /admin placeholder | CMS draft/revision/publication/media DTO | CMS permission D13 | P5; xuất bản thật và invalidation; không đổi global design. |
| Customer portal chưa có route | Challenge/grant/public history DTO | Verified customer grant | Deferred; không mở tra cứu history trước auth an toàn. |

“Giữ UI/UX” không có nghĩa giữ mô hình dữ liệu prototype gây sai nghiệp vụ. Chỉ thêm input/action tối thiểu bắt buộc: walk-in, reason/agreement, consent, actual handover, stock/payment writes. Dùng lại components/tokens/patterns tương ứng khi được giao triển khai; không redesign trong Phase 0.

### 12.1. Consumer map chi tiết Phase 1

| Consumer / caller liên quan | Contract P1 / DTO | Scope / thay đổi khi implementation |
|---|---|---|
| Public BookingDialog.submit và BookingSchedule effect | P01–P03; PublicBookingCatalog/AvailabilityQuery/PublicBookingCreate | Thay timeout/mock adapter; lưu key theo một lần submit; version catalog/policy; notice; success receipt sau commit. Không gửi internalNote/owner. |
| BookingProvider + localBookingRepository + BookingForm | B01–B08/B13,U01–U04,C01 | Thay load/save bằng scoped HTTP; bỏ “Vẫn lưu lịch” bypass; source/staff identity thực; create luôn PENDING rồi explicitconfirm, không auto CONFIRMED từ confirmedDate. |
| BookingTime và mọi caller lịch | BookingSummary.scheduledStartAt | Cập nhật shared bookingTime helper, types, BookingForm initial, BookingsWorkspace date/filter/sort, BookingDetail, BookingActions/RescheduleButton, manager list/calendar và OverviewInsights. Giữ requestedStartAt gốc; không map đè requestedAt để né việc sửa callers. |
| Header/shell/account | A01–A05 | Login context/session/CSRF, role route guard, password-change-required; không link public giả logout. Dùng pattern UI hiện có khi coding, không thay source lượt thiết kế. |
| ManagerStaff + assignment pickers | S01–S04,B09/B10 | Job role khác role; profile có thể không account; account fields chỉ permission admin, không lộ password. Target active same station; offboard phải chuyển lịch trước. |
| Service modal | C01–C03 | Basic name/category/status giữ pattern; requirements/resource plan là input vận hành bắt buộc để mở bookable. EstimatedDuration server tính từ plan, không giữ một durationlabel làm capacity. |
| CapacityPage/settings | K01–K08,T01/T02 | Giữ grid/modal/confirm, bổ sung đúng resource/plan fields; counter không editable; closed admission khác maintenance block; Impact409 không force. |
| CustomersWorkspace/VehicleProfile | U01–U04,B01 | Scoped related lists, không tải toàn customers trước auth. P1 chưa service visits thì hiển thị chưa có lịch sử dịch vụ được ghi nhận, không biến bookingcompleted thành history sửa chữa. |
| Dashboard/manager/advisor lists | D01,B01 | Querydate dùng station clock; current scope counts cùng consistent snapshot; P1 không show fake quote/revenue metrics từ seed. |
| Audit/history | L01,B11/B12 | Former A thấy historical snapshot/own events, không currentdetail;403/404 clear cache cũ. Scope không dựa filteradvisor phía FE. |

Source hiện hành để thực hiện thay adapter: [public dialog:192](../src/components/public-booking/booking-dialog.tsx#L192), [schedule:131](../src/components/public-booking/booking-schedule.tsx#L131), [booking provider:162](../src/components/admin/booking-provider.tsx#L162), [booking form:46](../src/components/admin/booking-form.tsx#L46), [bookingTime:59](../src/lib/booking/logic.ts#L59), [bookings workspace:101](../src/components/admin/bookings-workspace.tsx#L101), [manager capacity:17](../src/components/manager/capacity-page.tsx#L17), [manager settings:17](../src/components/manager/system-pages.tsx#L17).

Các UI cho account/resource config chưa có đầy đủ được xác định ở đây, không tự thêm route/framework/phong cách ở lượt thiết kế. Khi coding cần triển khai consumer cần thiết cùng contract; không công bố backend đã tích hợp nếu mới có API.


## 13. Legacy CRM Migration Strategy

### 13.1. Bằng chứng và thiếu hụt

Có bằng chứng UI về khách/xe, lịch/phiếu, dòng giá/CK/VAT, công việc dự kiến, KTV, media/thảo luận, kho/NCC/DVT, nhập/xuất, thu/cọc/chứng từ và báo cáo; [docs/research/KHAO-SAT-CRM-DPAUTO.md:27](../docs/research/KHAO-SAT-CRM-DPAUTO.md#L27), [docs/research/KHAO-SAT-CRM-DPAUTO.md:446](../docs/research/KHAO-SAT-CRM-DPAUTO.md#L446). Chưa có schema, export file mẫu, số lượng, quan hệ khóa, binary media access, API, history completeness hoặc permission ngoài CVDV. Phase 0 không gọi endpoint hoặc assume oldCRM cho export.

### 13.2. Công việc bắt đầu từP0

1. Chủ dự án chỉ định người sở hữu dữ liệu và cung cấp phương thức trích xuất được phép: DB snapshot, export hoặc API nếu thật sự có. Không tự dò/vượt quyền.
2. Lập data inventory: entity, source key/code, quan hệ, status, timezone, decimal/unit, volumes, attachment storage, created/changedAt, nguồn chứng từ, ownership/PII.
3. Chốt mức di chuyển: chỉ lịch sử đọc; hồ sơ đang làm; opening stock; opening debt/deposits; hay toàn ledger. Không nhập cả opening balances và ledger quá khứ vào cùng tổng mà không ngày chốt/loại trừ.
4. Mapping external keys trước schema; không dùng phone/plate/tên làm khóa identity. Candidate match phải manual review; giữ nhiều contact cùng phone/xe đổi chủ.
5. Xác định các mục CRM cũ cần parity trong Q08: quick quote, nhiềuKTV, cost visibility, expected-work checklist, đối tác/nợ riêng, samples in, import/export, warranty/Excel. Dữ liệu không hiểu được giữ quarantine có nguồn, không ép vào enum gần giống.

### 13.3. Dry-run và cutover P6 — proposed

- Export nguồn có checksum và thời điểm; staging hạn chế quyền/PII; manifest batch có source identity và lỗi từng record.
- Transform với bảng mapping, validation FK/enum/time/amount và provenance; trial import vào DB biệt lập, không production.
- Đối soát counts không đủ: phải thêm tổng tiền/thu/cọc/refund/công nợ theo cutoff/currency, tồn theo part/warehouse/unit, active orders/assignments, approved quote revisions và media refs.
- Duplicate import cùng sourceId/checksum không sinh thêm record/ledger. Source version thay đổi phải tạo cập nhật có kiểm soát, không ghi đè hồ sơ đã làm ở hệ thống mới.
- Parallel-run có **một hệ thống là nguồn ghi cho từng cohort/entity/chứng từ**; không cho nhân viên nhập đôi rồi “đối soát sau”. Write ownership registry có thể là quy trình/manifest, chưa buộc tạo microservice.
- Freeze window, final delta, reconcile, phê duyệt sign-off rồi switch routing/quy trình. Credentials/domain/backup đã chuẩn bị.
- Rollback trước khi có giao dịch mới có thể quay lại snapshot/cutover checkpoint; **sau khi đã có stock/payment/visit mới, không đơn giản restore DB cũ**. Dừng ghi và xuất delta để chuyển giao/forward-fix theo runbook đã diễn tập.
- Backup/restore staging phải được chứng minh trước cutover; runbook chỉ định ai dừng ghi, ai duyệt đối soát và khi nào quay lại hệ thống cũ.

## 14. Phase-by-Phase Delivery Plan

Phân kỳ target được giữ từ đề bài; không đồng nhất phase cũ trong audit. Mỗi phase gồm thiết kế chi tiết rồi implementation theo nhiệm vụ riêng được duyệt.

| Phase | Dependency / công việc theo PR logic | Acceptance / demo | Test gate / rollback |
|---|---|---|---|
| **P0 — hồ sơ hiện tại** | Đối chiếu nguồn; terminology/aggregates; draft permission/standards/state; mapping catalog; decision register; scope go-live/cutover; migration inventory từ sớm. | Chủ trạm đọc và duyệt nhóm blocker; không gắn approved khi chưa có câu trả lời. | Rà tĩnh tài liệu/tham chiếu/phạm vi; giữ đề bài gốc. |
| **P1 — core** | Q01/Q02 và D01/D02/D05/C quyết định cần thiết; auth/config foundation → catalog/customer/resource schema → allocator+idempotency/audit → public/staff create → manager assignment/commands. | Hai public create tranh suất cuối: chỉ mộtPENDING; A chỉ thấy lịch giao; transfer A→B thu hồi quyền; public/co-van/dieu-hanh cùng nguồn. | DB integration concurrency/scope/rollback/version; backup/restore và monitoring trước first go-live; feature chưa đủ bị tắt, chưa cutover. |
| **P2 — reception** | Q03 và scope walk-in/visit; nullable booking/reconciliation → receive+wakin → private media/intake/progress → visit assignment/history. | Tạo walk-in bookingId=NULL; booking receive retry trả cùng visit; A không xem walk-in củaB; đổi xe có xác minh. | Unique/idempotency/TX+private media tests; rollback release bằng feature gate tương thích schema, không xóa visit đã có. |
| **P3 — workshop** | Q05/Q06, quote revision/rounding/evidence → expected work/KTV → acceptance/rework → ready/handover guards. | Khách duyệt revision1, sửa phát sinh revision2 không đổi bản1; work/inspection/ready/handover/payment khác nhau. | Money/revision/state/scope tests; chặn transition chưa có policy, giữ snapshot/ledger khi rollback UI. |
| **P4 — stock/payments** | Q02/Q04/Q07 và legacy stock/debt strategy → documents/balances/ledger → partial issue/return/stocktake → deposit/collection/refund/reversal/receipts → reconciliation/report basis. | Hai issue tranh tồn; retry không double-issue; cọc booking chuyển nghĩa vụ khi nhận nhưng không nhân tiền; refund không vượt còn được hoàn. | Integration stock/money atomicity, currency/rounding, approval/scope; không rollback bằng xóa bút toán, dùng corrections được duyệt. |
| **P5 — operation/CMS** | Read models dùng core/visit/work/kho/tiền đã có; shifts/alerts/KPI → CSV → CMS/revision/invalidation → inbox/provider adapter. | Báo cáo ra đúng theo ngày thu và scope; publish cập nhật public; notification fail không mất giao dịch. | Aggregate/CSV/permission/cache/sanitization/outbox tests; provider chưa duyệt không gửi thật; static public fallback có chủ đích. |
| **P6 — migration/cutover** | Mapping/inventory bắt đầuP0; hoàn tất parity decisions Q08 + trial imports + opening balances/debt + restore/training/runbooks. | Counts và totals/active orders/stock/debt/media đối soát, freeze/delta/sign-off; staff thao tác ngày làm việc thật theo script. | Dry-run/reconcile/restore/cutover rehearsal được duyệt; rollback bảo toàn delta saugo-live; portal/OTP/waitlist/native riêng nếu được duyệt. |

**Definition of Done từng phase implementation:** contract đã duyệt, schema/DTO/permissions/events đồng nhất; tests liên quan chứng minh invariants; consumers tích hợp không seed fallback; lỗi giữ dữ liệu và không báo success giả; source/documentation theo đúng phạm vi được giao. Chỉ mở production sau gate của release thực tế, không vì UI đã có.

Phase 0 không chạy test/build/migration. Kiểm thử tương lai tuân AGENTS Minimal Testing; comprehensive E2E/build/benchmark/restore rehearsal tổ chức theo nhiệm vụ/approval phù hợp, không tự chạy do có nhắc ở đây.

### 14.1. Phase 1 delivery contract và test matrix

Chủ dự án đã duyệt Phase 0 ngày 12/11/2026. Thiết kế Phase 1 có 46 endpoint và 33 bảng, kèm DTO và transaction contract. **Chưa triển khai backend hoặc chạy integration tests.** Bảng dưới là yêu cầu kiểm thử khi coding, không phải kết quả đạt.

| ID | Kịch bản kiểm thử khi coding | Assertion quan trọng |
|---|---|---|
| P1-T01 | Public tạo lịch hợp lệ | Một booking PENDING và một reservation ACTIVE. Allocations, charges, counters, snapshots, consent, event, outbox và key receipt cùng commit. |
| P1-T02 | N request tranh tài nguyên cuối ở nhiều pool/bucket | Không có physical allocations chồng nhau hoặc counters vượt giới hạn. Request thua trả 409; rollback không để contact, hold hoặc receipt mồ côi. |
| P1-T03 | Cùng key/payload gửi đồng thời hoặc timeout sau commit | Chỉ một mutation được commit. Replay trả receipt/status gốc; cùng key nhưng khác payload trả 409. |
| P1-T04 | Dịch vụ nối tiếp, requirements chồng hoặc không chồng, dùng chung bucket hoặc khác pool | Mỗi requirement giữ đúng resource liên tục. Gộp physical intervals đúng; logical charges đếm distinct resources, không cộng trùng hai đoạn nối tiếp. |
| P1-T05 | Confirm cùng giờ, khác giờ hoặc pending chưa có owner | Cùng giờ không giữ chỗ lần hai. Khác giờ replan atomic; chưa owner trả 422. Lỗi giữ nguyên pending và hold cũ. |
| P1-T06 | Reschedule/service edit vào slot đầy hoặc lỗi giữa release/insert | Rollback khôi phục nguyên allocation, counters, time, snapshot và version cũ; không mất suất. |
| P1-T07 | Cancel/no-show lặp, no-show trước grace, gọi arrive trong P1 | Release một lần; trước grace trả 422. P1 không có endpoint cập nhật status tùy ý để lách guard. |
| P1-T08 | Transfer A sang B đồng thời với save/replay/list/search/count của A | Serialize theo thứ tự commit. Sau chuyển giao, A không ghi hoặc đọc detail/replay riêng tư; B có quyền hiện tại. A chỉ xem projection lịch sử được phép. |
| P1-T09 | Disable/đổi role/reset password/thu hồi authority cuối đồng thời với mutation | Recheck trạng thái sau khóa; phiên bị thu hồi trả 401/403. Không mất authority cuối; không offboard khi còn lịch hoặc physical holds chưa xử lý. |
| P1-T10 | Login CSRF, rotate PREAUTH, phiên hết hạn, mustChangePassword, dummy hash | CSRF sai trả 403; credential sai trả 401 trung tính. Không log token. Đổi password thu hồi phiên cũ; limited session không gọi API nghiệp vụ. |
| P1-T11 | Sửa config/grid/membership/block/staff resource khi pending đang giữ chỗ | Impact trả 409, giữ cấu hình và hold cũ. Admission closed chỉ ngừng nhận mới; không tăng tài nguyên ảo. |
| P1-T12 | Đủ tổng phút nhưng không có resource liên tục; planner hết search budget | Không hứa có chỗ. Trả 409 khi chứng minh không có phép gán; 503 khi chưa kết luận. Availability và write dùng cùng planner. |
| P1-T13 | Client khác timezone, ngày sai, giờ quá khứ, qua nghỉ trưa hoặc đóng cửa | Dùng server clock, offset và strict date. Footprint không hợp lệ trả 422; không dùng timezone browser để quyết định policy. |
| P1-T14 | Scope customer/vehicle/event của cố vấn cũ; cursor lệch filter | Không rò PII qua query/count/related events. Cursor sai filter trả 400; không tự gộp phone/plate. |
| P1-T15 | Scoped read, health probe, outbox, dọn idempotency | Auth/admin dùng no-store; probe không lộ secrets. Worker dừng không ngăn core commit. Reconcile phát hiện lệch counter, không tự xóa hold. |
| P1-T16 | Migration DB sạch, seed draft, bootstrap và diễn tập restore | FK/check/unique/exclusion hoạt động. Không seed khách/giờ/cầu giả. Booking mặc định đóng tới khi cấu hình thật hợp lệ. Restore thực hiện trong nhiệm vụ được duyệt trước production. |

Thứ tự implementation: (1) identity/session/config, (2) schema/catalog/customer/resource policy, (3) planner/transactions và focused DB tests, (4) public/staff commands, (5) manager queue/assignment/actions, (6) scoped reads/dashboard/audit và consumer integration. Chưa mở public create cho tới khi allocator và staff queue/auth hoạt động. Giữ toàn Phase 1 sau feature gate cho tới khi các consumer thiết yếu cùng đọc/ghi một nguồn.

Các dòng trên là test specifications, không yêu cầu tạo 16 script trùng lặp. Khi coding, chọn tập liên quan trực tiếp từng PR. Mỗi kiểm thử đạt chạy một lần; toàn suite/E2E/build/benchmark tuân theo AGENTS và phạm vi được duyệt.

## 15. Security, Reliability & Observability

| Chủ đề | Nền bắt buộc / quyết định cần duyệt |
|---|---|
| Record permission | Scope station+owner trên list/detail/search/count/export/mutation; transfer/save/disable race được xử lý sau lock. Walk-in có owner/history độc lập; CMS không quyền khách/tiền mặc định. |
| Trust boundary | Strict DTO, auth/session/CSRF/CORS đúng domain, actor/source server; phone/plate không cấp history access. Không public serializer chứa internalNote/cost. |
| Media/PII | Private intake media, bounded signed access; validate bytes/type/decode/dimensions; customer history cần grant; retention/delete/masking Q09. |
| Money/stock | Decimal source values, immutable ledgers, unique command/source refs, locked remaining amounts/available stock; không lách bằng role hoặc force flag. |
| Idempotency | Transaction key+fingerprint+business result; replay rechecks current permission; no duplicate after timeout; stable document refs tiếp tục chống double-post dù key đã dọn. |
| Audit/outbox | Actor/time/before-after allowlist/reason/requestId/correlationId cùng businessTX; external sends sau commit; inbox đúng recipient, boundedretry/lease. |
| Secrets/network | DB riêng/runtime role least privilege/migration role riêng; không public DB/internalprobes; provider credentials không trong settings/public/cache/log. |
| Reliability | Readiness kiểm tra DB/migration compatibility, liveness tối thiểu; backups mã hóa/offsite theo Q10, restore trướcgo-live; không dùng mock khi DB lỗi. |
| Observability | Request latency/error rate, forbidden/revoked attempts đã chePII, lock wait/deadlock/serialization retries, capacity conflicts/counter reconcile, stock/refund conflicts, outbox lag, disk/backup/restore status. |
| SLO | Định nghĩa availability/latency/errorbudget và RPO/RTO với Q10; chưa gán p95/TPS/uptime từ đoán. Hạ tầng VPS cũ chỉ là bối cảnh, chưa khẳng định đủ tải. |
| Legacy | Chỉ tài khoản được duyệt trích xuất/import, dữ liệu staging được bảo vệ, manifest/checksums/rollback/sign-off, không truyền credential CRM vào frontend. |

Các mục này là yêu cầu thiết kế, chưa là kết quả security test hoặc xác nhận hệ thống live đang có lỗ hổng.

## 16. Decision Register & Open Questions

### 16.1. Register Phase 0 sau phê duyệt

Chủ dự án đã duyệt toàn bộ **khuyến nghị** dưới đây ngày 12/11/2026. Gate được giữ để chỉ thời điểm cần dữ liệu/kiểm tra thực tế; không yêu cầu duyệt lại các hướng đã chọn. Options được giữ làm lịch sử, không đồng nghĩa chọn đồng thời mọi phương án. Các chi tiết Phase 1 ở16.3 và mục 7–11.

| ID | Gate | Quyết định / lý do | Options | Khuyến nghị đã duyệt | Ảnh hưởng API/DB/UX | Người quyết định | Trạng thái |
|---|---|---|---|---|---|---|---|
| D01 | BLOCKER BEFORE GO-LIVE | Ai xử lý pending chưa giao? | Manager queue / advisor queue chung | Manager nhận trách nhiệm queue, advisor tự tạo giao mình; chưa tự chọn advisor khác | API queue/create/assign; owner nullable booking; UX việc cần xử lý | Chủ trạm + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D02 | BLOCKER BEFORE GO-LIVE | Advisor có tự nhận lịch chưa giao không? | Không / claim có lock + rule | Không tự claim cho tới duyệt; không cấp quyền chỉ vì UI có dropdown | Assignment action/permission/scope | Chủ trạm + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D03 | CAN DEFER | Có waitlist khi full không? | Liên hệ thủ công / waitlist riêng | Hoãn sau cutover nếu chưa cần; waitlist không giữ capacity | API/table/UX waitlist; không thay PENDING | Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D04 | RESOLVED | Pending có giữ suất không? | Đã xác nhận giữ ngay | Create PENDING+hold cùng TX; không hỏi duyệt lại | Create/confirm/reservation; TTL riêng C07 | Chủ dự án đã xác nhận trong đề bài | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D05 | BLOCKER BEFORE SCHEMA | Công thức dịch vụ/tài nguyên cụ thể? | Pool đồng nhất / resource cụ thể / phối hợp | Hướng theo dịch vụ/tài nguyên đã xác nhận; công thức theo C01–C12 còn phải duyệt | Requirement/bucket/resource schema và availability | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D06 | BLOCKER BEFORE GO-LIVE của P3 | Ai và dữ liệu nào cho phép handover/complete? | Owner/M / inspector riêng / dual approval | Bàn giao thật, summary đủ; điều kiện kỹ thuật/thu tiền theo Q06, không đồng nhất paid | Visit/booking transition, evidence, UX action | Chủ trạm + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D07 | BLOCKER BEFORE GO-LIVE của P2 | Có bỏ qua tiến độ không áp dụng? | Cho skip có event / bộ bước bắt buộc từng service | Cho ghi mốc thực; không tạo event giả, policy theo service | Progress schema/transition và public timeline | Manager + CVDV/KTV | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D08 | CAN DEFER | Khách xác minh history bằng gì? | OTP / token từng booking / chưa mở | Chưa mở portal nếu chưa có cơ chế được duyệt | Challenge/grant/provider; public PII boundary | Chủ trạm | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D09 | BLOCKER BEFORE SCHEMA của migration | Lịch sử cũ và thông tin chủ xe nào được công bố? | Chỉ DPAuto xác minh / subset import / full history theo bằng chứng | Import có provenance; không tự public qua phone/plate hoặc chủ mới | Links/grants/import mapping/history serializer | Chủ trạm + người sở hữu dữ liệu | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D10 | BLOCKER BEFORE GO-LIVE của P2/P3 | Abort/reopen sau nhận xe hoặc đã bàn giao? | Manager exception / tạo follow-up / cấm reopen | Follow-up visit mới khi quay lại; abort có settlement và audit; không xóa tiền/kho | Visit states/reservation/stock/payment guard | Manager + người phụ trách tài chính | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D11 | BLOCKER BEFORE GO-LIVE | Advisor cũ được xem gì sau transfer? | Event bản thân / historical summary / rộng hơn có quyền | Chỉ summary/event trước chuyển trong scope đã duyệt; không notes/PII mới | Assignment history/projection/replay cache/UX readonly | Chủ trạm | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D12 | BLOCKER BEFORE GO-LIVE của P2 | Public progress theo nhóm service ra sao? | Bộ chung có skip / từng nhóm | Bộ tối thiểu theo sự kiện thực; không map máy móc từ work% | Progress catalog/serializer/UX | Manager + CVDV | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D13 | BLOCKER BEFORE SCHEMA quyền CMS | Ai quản trị/publish website? | Manager kiêm permission / CMS_ADMIN riêng | Tách permission; không cấp advisor; role cuối theo người thực dùng | User roles/permissions/CMS APIs/routes | Chủ dự án | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| D14 | BLOCKER BEFORE GO-LIVE | Grace và xác minh no-show? | Một grace trạm / theo service | Server cấu hình theo thực tế, nhân viên xác minh; chưa gán phút | Policy/no-show command/release/UX | Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C01 | BLOCKER BEFORE SCHEMA | Năng lực biểu thị tiếp nhận hay thi công? | Intake / execution / cả hai | Xác định lời hứa của từng pool, thời điểm chiếm/nhả | Requirement/availability/visit allocation | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C02 | BLOCKER BEFORE SCHEMA | Có những tài nguyên dùng chung nào? | Pool / từng cầu,máy,KTV / hỗn hợp | Inventory thực tế tài nguyên và units, không suy số mẫu | Pools/resources/service requirements | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C03 | BLOCKER BEFORE SCHEMA | Thời lượng/buffer/wait theo service/xe? | Định mức / bước chẩn đoán / khoảng bảo thủ | Duyệt từng gói; duration chưa biết không mở bookable vô điều kiện | Catalog snapshots/footprint/DTO label | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C04 | BLOCKER BEFORE SCHEMA | Nhiều dịch vụ tuần tự hay song song? | Sequential / parallel / graph đơn giản có thứ tự | Ghi thứ tự/offset cụ thể; không SUM/MAX toàn bộ một cách mặc định | Booking services sequence/requirements/allocator | KTV trưởng + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C05 | BLOCKER BEFORE SCHEMA | Bước giờ đặt và độ hạt khóa là gì? | Cùng grid / tách start grid và occupancy bucket | Chọn theo vận hành, giữ bảo thủ mọi bucket giao interval | Capacity keys/counters/index/UX slots | Manager + Backend owner | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C06 | BLOCKER BEFORE GO-LIVE | Hours/breaks/holidays/lead/advance? | Lịch tuần + exceptions / ngày riêng | Nhiều ca nếu nghỉ trưa; station server clock, không lấy60 ngày fixture | Policy/calendar/public day picker | Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C07 | BLOCKER BEFORE GO-LIVE | Pending hold có expiry không? | Không auto TTL / TTL có notification/transition rõ | Chưa tự expiry; cảnh báo pending lâu cho người xử lý; nếu TTL phải duyệt flow | Reservation expiry/job/status/UX promise | Chủ trạm + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C08 | BLOCKER BEFORE GO-LIVE | Xe trễ/vượt giờ ảnh hưởng hold sau ra sao? | Manager điều phối / buffer an toàn / actual resource occupancy | Actual occupancy không tự release; đóng nhận mới bị ảnh hưởng, không tạo capacity ảo | Resource model/replan/alerts/work deadlines | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C09 | BLOCKER BEFORE SCHEMA | Capacity có phụ thuộc KTV/ca/kỹ năng? | Static pool / shift-derived / skill resource | Xác định nguồn năng lực, không vừa đếm pool vừa trừ KTV hai lần | Staff shifts/resources/schema và dependency P1/P5 | Manager + KTV trưởng | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C10 | BLOCKER BEFORE GO-LIVE | Walk-in/full/giảm capacity xử lý sao? | Chờ chưa bắt đầu / nhận khi allocate đủ / điều phối giờ khác | Chỉ allocate khi đủ; không giảm dướihold, không override; đăng ký chờ nếu Q03 cho phép | Visit intake/policy impact/command errors/queue UX | Chủ trạm + Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C11 | BLOCKER BEFORE GO-LIVE | No-show grace theo điều kiện nào? | Rule chung / theo nhóm | Dùng cùng quyết định D14, không rule thứ2 xung đột | Policy và no-show validator | Manager | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| C12 | BLOCKER BEFORE SCHEMA | Có cần giữ đúng một cầu/KTV liên tục? | Units đồng nhất / tài nguyên cụ thể | Nếu có continuity/skills khác nhau phải model resource cụ thể trước mở service | Resource/interval allocation/constraints/availability | Manager + KTV trưởng + Backend owner | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q01 | BLOCKER BEFORE SCHEMA | Identity/session provider và domain triển khai? | Provider hiện có / local auth được review; same-origin / cross-origin | Chọn một identity; ưu tiên cùng origin cho web nếu hạ tầng cho phép; không tự mặc định dùng account bán xe | Users/session/credentials/CSRF/CORS/auth endpoints | Chủ dự án + Backend/infra owner | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q02 | BLOCKER BEFORE SCHEMA | Ai được xem giá vốn, post kho, thu/hoàn/đảo tiền, gán quyền? | Role kiêm permission / job bundles tách; approval độc lập | Least privilege; quyền refund/adjustment khác collect; manager không tự siêu quyền | Permission model/field projection/audit/action guards | Chủ trạm + phụ trách tài chính/kho | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q03 | BLOCKER BEFORE SCHEMA | Nhận walk-in cần trường/owner/queue nào? | ODO/model bắt buộc / cho chưa biết có lý do; auto-owner / manager assign | BookingId=NULL; visit owner rõ; xe/customer xác định khi nhận, reason cho dữ liệu chưa biết; chưa bắt đầu tài nguyên khi full | Visit nullable FK/owner/assignment/media/entry UX | Manager + CVDV | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q04 | BLOCKER BEFORE SCHEMA của P4 | Kho, DVT, cost method, return, adjustment, stocktake? | Một/nhiều kho; FIFO/bình quân/khác; partial/backorder rule | Không âm kho mặc định, ledger có chứng từ; phân requested/reserved/issued/returned; backorder chỉ khi duyệt | Warehouses/units/documents/lines/stock balance ledger/value | Chủ trạm + quản lý kho/tài chính | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q05 | BLOCKER BEFORE SCHEMA của P3 | Quote/money/tax/rounding/evidence/exemption? | Làm tròn dòng/tổng; %/tiền CK; quyết định staff/link/ký; noquote/free | Decimal, approved revision bất biến, evidence bản cụ thể; không tự bắt chữ ký số hoặc thuế kế toán | Quote schema/DTO/print/change order/work guard | Chủ trạm + phụ trách tài chính/CVDV | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q06 | BLOCKER BEFORE GO-LIVE của P3/P4 | Chặn bàn giao do nợ, thiếu phụ tùng hay nghiệm thu? | Không nợ / manager duyệt nợ / theo đối tác; đủissued / theo phạm vi thực | Nghiệm thu và tài chính tách; điều kiện bàn giao tường minh; không coi done=paid | Handover/acceptance/stock/payment guards; UX reason | Chủ trạm + Manager + tài chính | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q07 | BLOCKER BEFORE SCHEMA của P4 | Payment/deposit/refund/debt/cash ownership và kỳ ghi nhận? | Cọc booking / customer credit; phân bổvisit; phương thức; người duyệt refund; cash vs revenue basis | Nguồn ledger và allocations rõ; cọc chưavisit không cần booking giả; không nhânthu khi nhận; refundable khóa; e-invoice riêng | Payment subject/allocations/receipts/refund/report contracts | Chủ trạm + tài chính | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q08 | BLOCKER BEFORE SCHEMA của migration | Dữ liệu legacy, parity và nguồn export? | Opening balances+history / full ledger; DB/export/API nếu có; quick quote/multiKTV/đối tác/warranty/chứngtừ/Excel | Khảo sát mapping và cutover acceptance từP0, không giả có export hoặc mọi tính năng cũ đã được bỏ | External IDs/import batches/stock-debt cutoff/entities/UI parity | Chủ trạm + owner CRM cũ/tài chính/kho | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q09 | BLOCKER BEFORE GO-LIVE | PII/ảnh/consent/retention và lịch sử chuyển chủ? | Các kỳ lưu theo dữ liệu / selective migration / masking | Thu tối thiểu, private media, notice version; owner xác nhận thời hạn/đối tượng được xem | Consents/media/history links/audit retention/UX consent | Chủ trạm + người phụ trách dữ liệu | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |
| Q10 | BLOCKER BEFORE GO-LIVE | Go-live/cutover ownership, SLO/RPO/RTO và Git tài liệu? | Pilot cohort; backup/restore targets; quản lý api doc ởGit/ngoàiGit | Một nguồn ghi mỗi cohort; diễn tậprestore; owner phê duyệt delta/rollback; quyết định track api-design riêng | Deployment/runbook/monitoring/data handoff/versioning docs | Chủ dự án + Manager + infra owner | APPROVED recommendation — 12/11/2026; input/chi tiết phase theo 16.3 |

### 16.2. Thứ tự cấu hình và tiếp tục các phase

1. P1: canonical service IDs, resources thực và requirement duration/offset/units; hours/lead/advance/grace; notice nội dung/version, domain/secrets. Input chưa có thì booking_enabled=false, không thay bằng seed.
2. P2: vehicle intake/ODO trường thiếu có lý do, visit owner/walk-in và actual reception; dùng các hướng đã được duyệt.
3. P3/P4: evidence/rounding/thuế, work/acceptance/handover guards, stock/payment source và receipts theo nghiệp vụ thực.
4. P5/P6: report definitions/CMS/provider, legacy export/mapping/checksums, retention/restore/cutover runbook.
5. Waitlist/OTP/native giữ deferred theo quyết định đã duyệt. Không quay lại hỏi PENDING có giữ chỗ hoặc Advisor có tự claim queue.

### 16.3. Approval record và quyết định kỹ thuật Phase 1

**Người duyệt:** chủ dự án, qua tin nhắn “Duyệt mọi quyết định của bạn… Thực hiện phase 1 nhé.” ngày 12/11/2026. Phạm vi gồm toàn bộ **khuyến nghị** D01–D14, C01–C12, Q01–Q10 của Phase 0. Không chọn đồng thời các option trái nhau hoặc tự sinh thông số vận hành.

| Nhóm | Trạng thái sau duyệt / lựa chọn P1 |
|---|---|
| D01,D02,D11 | Manager quản lý queue; advisor không tự claim. Advisor tự tạo lịch sẽ phụ trách lịch đó. Former advisor chỉ xem historical snapshot và event của chính mình; không cần duyệt lại. |
| D04,C07 | PENDING giữ chỗ ngay, **không tự hết hạn trong P1**. Dùng cảnh báo và nhân viên liên hệ thay vì tự giải phóng. |
| D05,C01–C05,C09,C12 | Mô hình service/pool/resource unit, membership version, duration/offset/units; concrete continuous witness và scalar admission charges. Dịch vụ chạy theo thứ tự input, requirements có offset; chưa bookable nếu thiếu footprint thật. |
| C06,C08,C10,C11,D14 | Hours/lead/advance/grace bắt buộc cấu hình. Actual resource availability là đầu vào thực. Giảm/retire ảnh hưởng holds trả 409; no-show kiểm tra thủ công; không overbooking. |
| Q01 | Tài khoản DPAuto local, web cùng origin; DB session/CSRF và scrypt của platform. Không phụ thuộc provider/SMTP; chi tiết ở 7.2. |
| Q02,D13 | Role vận hành MANAGER/ADVISOR, sensitive grants tường minh. Chức danh KTV không tự cấp tài khoản hoặc quyền. CMS không cấp quyền advisor; kho/tiền/CMS theo phase sau. |
| Q03,D06–D07,D10,D12 | Walk-in tạo visit không bắt buộc booking; owner riêng; progress từ mốc thật; follow-up mới; abort có settlement/handover thực. API chi tiết P2/P3 thiết kế tiếp, không thêm endpoint giả P1. |
| Q04–Q07 | Ledger, immutable quote, decimal, scope riêng, kho không âm và paid độc lập done đã duyệt. Thuế, giá và thời lượng thực vẫn cần cấu hình; chi tiết P3/P4. |
| Q08,Q09,D09 | Migration provenance, rà định danh thủ công, nguồn trích xuất hợp lệ; private PII/media/history đúng scope. Cần export mẫu và thông số retention trước production/cutover. |
| Q10 | Chủ dự án đã bỏ api khỏi .gitignore. Chỉ thực hiện pilot/cutover sau các gate và diễn tập restore; không tự đặt cam kết SLO/RPO/RTO. |
| D03,D08 | Waitlist/customer portal/OTP hoãn sau cutover, trừ nhiệm vụ riêng. Không hỏi duyệt lại hướng hoãn đã chọn. |

**Đầu vào còn cần cấu hình:** service canonical thực, resource/cầu/KTV, thời lượng và buffer từng requirement, hours/ngày nghỉ, lead/advance/grace, domain/secrets, nội dung và version notice, retention/RPO/RTO và mẫu dữ liệu CRM. Đây không phải yêu cầu duyệt lại kiến trúc. Thiếu dữ liệu thì hệ thống từ chối nhận lịch; không dùng số mẫu thay thế.

Chi tiết kỹ thuật P1 (46 endpoint, 33 bảng, local session, grants, planner witness và charges) cụ thể hóa các khuyến nghị đã được giao duyệt. P2–P6 còn cần thiết kế hợp đồng và guard chi tiết; duyệt hướng không thay cho thiết kế từng phase.

## 17. Final Recommended Contract & Next Actions

### 17.1. Bàn giao thiết kế Phase 1

- **46 endpoint Phase 1**, mỗi endpoint có consumer/source, quyền, request/response profile, validation, lỗi, transaction và trace old/new ID ở 8.3.
- **33 bảng SQL contract Phase 1**, có kiểu/FK/unique/index/check và invariants xuyên hàng ở 11.4; không schema chạy thật.
- Identity local/session/CSRF, permission scope và historical advisor projection; account revoke/last-authority guard.
- Allocator physical resource continuity + logical pool charges, station write lock và GiST exclusion; pending giữ ngay, không double-hold/release, reschedule fail giữ nguyên dữ liệu cũ.
- Critical-flow JSON và 16 focused test scenarios; chưa báo test pass. UI source vẫn dùng adapter/mocks cho tới implementation được giao.
- Khuyến nghị D/C/Q Phase 0 đã ghi APPROVED; input resource/duration/hours/cutover thực chưa có không bị tự coi là số fixture được duyệt.

### 17.2. Checklist phạm vi

- [x] Ghi nhận approval của chủ dự án và api không còn bị .gitignore loại.
- [x] Thiết kế chi tiết Phase 1 và map đầy đủ các consumer cần tích hợp.
- [x] Định nghĩa auth/permission/state/idempotency/version/DTO/errors và transaction boundaries.
- [x] Có schema/config/resource model đủ để kiểm thử chống race và continuity.
- [x] Rà tĩnh tài liệu/tham chiếu/coverage; chỉ cập nhật api/api-design.md, giữ đề bài gốc.
- [ ] Implementation NestJS/Fastify/Drizzle/PostgreSQL, migrations và bootstrap theo nhiệm vụ riêng.
- [ ] Focused API/DB/auth/concurrency tests, tích hợp frontend và kiểm tra hạ tầng thực.
- [ ] Cấu hình resource/hours/requirements/notice thật và gate first go-live; không tự mở public booking.
- [ ] Thiết kế/triển khai Phase2–6, migration/cutover và các tính năng post-cutover khi cần.

### 17.3. Nhiệm vụ tiếp theo

Nếu tiếp tục **thiết kế Phase2**, chỉ cập nhật file này: reception/walk-in/visit nullablebooking, transfer/owner/history, private media/progress; kế thừa auth/capacity/input policies đã duyệt, không thêm booking giả.

Nếu giao **implementation Phase 1**, dùng mục 7–12 và14.1 làm contract: tạo backend riêng NestJS/Fastify/Drizzle/PostgreSQL theo cấu trúc repo được chọn; triển khai33 bảng ở 11.4; triển khai46 endpoints/guards/transactions và focused tests trước khi nối public/co-van/dieu-hanh. Không seed khách, resource hay giờ thật từ fixtures; booking mới mặc định đóng đến khi config hợp lệ. Code implementation, package/migration/env và UI adapter là phạm vi nhiệm vụ implementation riêng, chưa được tạo trong lượt api-design này.

Bộ đếm46/33 là scope P1 hiện tại, không tổng target CRM. Chi tiết P2–P6 cập nhật tiếp theo đúng phase, không tự triển khai toàn hệ thống vì Phase 0 đã được duyệt.

---

<details>
<summary>Đề bài gốc — giữ để tiếp tục các phase sau</summary>

# CODEX PROMPT — DPAuto API Design theo từng Phase

## Vai trò và mục tiêu

Bạn là **Principal Backend Architect / API Designer** của dự án DPAuto. Hãy khảo sát toàn bộ repository hiện tại và thiết kế **hợp đồng API có thể triển khai** để DPAuto mới **thay thế hoàn toàn CRM cũ `crm.dpauto.vn`**. Hệ thống phải phục vụ đồng nhất website công khai, khu vực cố vấn `/co-van`, khu vực điều hành `/dieu-hanh`, và các ứng dụng/ tích hợp tương lai.

**Nhiệm vụ lần này chỉ là khảo sát, phân tích, thiết kế và ghi tài liệu; tuyệt đối KHÔNG triển khai backend, migration, DB, API route, package, sửa UI, thay đổi cấu hình hay chạy thao tác tác động dữ liệu.**

**ĐẦU RA DUY NHẤT:** tạo hoặc cập nhật **`api/api-design.md`** ở thư mục gốc repository. Nếu chưa có thư mục `api`, chỉ tạo thư mục này. Không tạo thêm bất kỳ file báo cáo, schema, OpenAPI YAML, JSON hay mã nguồn nào. Toàn bộ kết quả, kể cả sơ đồ, bảng, DTO mẫu, quyết định mở và kế hoạch triển khai, phải nằm trong `api/api-design.md`. Không sửa tài liệu kỹ thuật cũ trong nhiệm vụ này.

## 1. Nguồn cần đọc và thứ tự ưu tiên

1. Đọc `AGENTS.md` và quy tắc làm việc của repo (nếu có).
2. Đọc đủ bảy báo cáo khảo sát trong `docs/backend-audit/` (hoặc tìm theo tên nếu thư mục khác): `FRONTEND_AUDIT.md`, `FEATURE_API_MAPPING.md`, `API_REQUIREMENTS.md`, `DATABASE_REQUIREMENTS.md`, `BOOKING_CAPACITY_ANALYSIS.md`, `DOCUMENT_GAP_ANALYSIS.md`, `BACKEND_IMPLEMENTATION_PLAN.md`.
3. Đọc các tài liệu nghiệp vụ/kiến trúc hiện có: `REQUIREMENTS.md`, `BUSINESS_RULES.md`, `USER_FLOW.md`, `DATABASE_DESIGN.md`, `API_SPEC.md`, `SYSTEM_ARCHITECTURE.md` trong `technical-documentation/` hoặc vị trí thực tế.
4. Kiểm tra lại source hiện hành của public booking, `/co-van`, `/dieu-hanh`, `/admin`, các form/drawer, provider, types, mock/seed, điều hướng, API client và quyền; không dựa hoàn toàn vào báo cáo nếu source đã đổi.
5. Đối chiếu quy trình CRM cũ từ tài liệu/audit có sẵn. **Không suy đoán tính năng thực tế của CRM cũ khi chưa có bằng chứng**. Phân biệt `confirmed in source`, `confirmed business decision`, `proposed`, `needs approval`.
6. Nếu thiếu tài liệu, ghi rõ file thiếu và tác động; không tự bịa nội dung.

**Quyết định nghiệp vụ đã xác nhận và có ưu tiên cao hơn bản đề xuất cũ:**
- DPAuto mới **thay thế hoàn toàn CRM cũ**, không chỉ thay phần đặt lịch.
- Một Backend + PostgreSQL thống nhất cho public, cố vấn và điều hành.
- Giới hạn đặt lịch **theo dịch vụ và năng lực/tài nguyên thực tế**, không chỉ số xe trong một slot.
- Booking public thành công tạo `PENDING` **và giữ chỗ ngay trong cùng transaction**; chưa phải `CONFIRMED`.
- **Không overbooking**, kể cả khi nhiều request tranh suất cuối, đổi lịch, nhân viên tạo lịch, giảm năng lực hoặc thay đổi cấu hình.
- Giữ UI/UX hiện có; chỉ đề xuất những thay đổi giao diện tối thiểu nếu hợp đồng API bắt buộc.
- Stack định hướng: **NestJS + Fastify + TypeScript + Drizzle ORM + PostgreSQL**, kiến trúc **modular monolith**. Database DPAuto độc lập hệ thống bán xe.

**Định hướng nghiệp vụ mục tiêu cần thiết kế bao phủ:** booking; khách đến trực tiếp (*walk-in*); tiếp nhận và phiếu dịch vụ; báo giá nhiều phiên bản và phê duyệt; phân công KTV/thi công; nghiệm thu; bàn giao; phụ tùng và nhập/xuất/kiểm kê; thanh toán/đặt cọc/hoàn tiền/công nợ; báo cáo điều hành; nội dung website; thông báo/Zalo OA; lịch sử xe và chuyển dữ liệu từ CRM cũ. Đây là **phạm vi thiết kế**, không có nghĩa mọi chi tiết vận hành (hóa đơn, bảo hành, nhà cung cấp, thuế, tồn kho, thanh toán) đã được chủ dự án phê duyệt. Đánh dấu rõ phần cần quyết định.

## 2. Nguyên tắc thiết kế bắt buộc

- **Không giữ nguyên máy móc** catalog 94 endpoint / 50 bảng của audit. Xem đó là baseline cần rà soát, hợp nhất, bổ sung và phân kỳ lại vì mục tiêu đã chuyển sang thay CRM toàn phần. Không chạy theo số lượng endpoint/bảng.
- Thiết kế API **theo nghiệp vụ và aggregate**, không tạo endpoint riêng chỉ vì mỗi nút UI; tránh generic CRUD cho state transition quan trọng.
- API versioning `/api/v1`; thống nhất naming, method, status, pagination/filter/sort, date/timezone, idempotency, optimistic concurrency, error codes, requestId, correlationId, permission và response envelope.
- Public DTO, internal DTO, customer access DTO tách biệt; không trả PII/ghi chú nội bộ/giá vốn sai phạm vi.
- Tất cả mutation nghiệp vụ trọng yếu phải nêu transaction boundary, lock order, version check, idempotency, audit/outbox và failure behavior.
- `booking` (lịch hẹn) **khác** `service_visit` (lượt tiếp nhận/phiếu dịch vụ). **Walk-in phải tạo được visit không có booking**; không ép tạo lịch hẹn giả. Xem xét hệ quả `booking_id NULL`, uniqueness, provenance, permissions và trạng thái.
- `booking_status`, `visit_stage`, `work_status`, `quote_status`, `acceptance_status`, `payment_status` và `public_progress` là các trục trạng thái riêng; không suy `COMPLETED = PAID` hoặc `quote approved = inventory issued`.
- Báo giá dùng revision/snapshot bất biến sau khi duyệt; tiền dùng PostgreSQL `numeric`/decimal và quy tắc rounding được duyệt; không dùng float.
- Tồn kho có sổ giao dịch/nguồn chứng từ, điều chỉnh bằng reversal hoặc compensating entry; phân biệt `requested`, `reserved`, `issued`, `returned`, `on_hand`, `available`.
- Thanh toán có bút toán nguồn, hoàn tiền, đặt cọc, thanh toán nhiều lần và đối soát; không tự suy số thu từ báo giá hoặc phiếu đã bàn giao. Phạm vi hóa đơn thuế/e-invoice là quyết định riêng.
- Cố vấn chỉ thao tác hồ sơ đúng scope; manager điều phối; KTV và nhân viên kho/thu ngân có thể là **job role** khác **auth role**. Đề xuất RBAC/permission matrix khả thi; không suy quyền từ URL.
- Cân nhắc multi-station ở data model nhưng không xây chức năng đa chi nhánh nếu chưa duyệt.
- Không thiết kế microservices, Redis, queue broker, OTP, payment gateway, Zalo OA integration thật như điều kiện tiên quyết nếu chưa cần. Outbox/worker adapter đủ làm nền.
- Không tự chuyển mock/localStorage/seed thành dữ liệu production; kế hoạch migration CRM cũ phải tách, đối soát và rollback.

## 3. Phân kỳ thiết kế và triển khai (bắt buộc)

Thiết kế **toàn bộ target architecture**, nhưng lập roadmap với dependency và tiêu chí nghiệm thu theo phase. Có thể tinh chỉnh tên/số phase khi có lý do rõ ràng; không hoãn phần cần thiết để thay CRM thật.

### Phase 0 — Business decisions & API foundations (thiết kế, chưa code)
- Đối chiếu nguồn; khóa thuật ngữ, aggregate, actors, station scope, canonical service catalog.
- Lập danh sách **decision blockers** (P0) và phương án mặc định an toàn, không giả định được duyệt.
- Chốt quy ước hợp đồng API, auth/session, permission matrix, state machines, idempotency, timezone và versioning.
- Phân loại `must-have for first go-live`, `must-have before CRM cutover`, `post-cutover`.

### Phase 1 — Identity, catalog, customers, booking & capacity
- Auth/session, RBAC, staff, customer/vehicle, service catalog, resource pools/policies, hours/blocks.
- Public availability/create; advisor create; manager queue/assign/transfer; confirm/reschedule/cancel/no-show; audit/events.
- Capacity reservation xuyên nhiều buckets/pools, concurrency-safe, không double hold/release; policy/config impact.
- Bắt buộc có cả API public, `/co-van`, `/dieu-hanh` cùng đọc/ghi nguồn thật.

### Phase 2 — Reception & service visits
- Walk-in intake; booking arrival; tiếp nhận xe, odometer, tình trạng xe, yêu cầu khách, ảnh riêng tư, phiếu dịch vụ.
- Visit lifecycle, contact/history, progress, assignment; tránh tạo trùng visit khi retry/arrive.
- Chốt quan hệ booking ↔ visit, cách tiếp nhận không lịch hẹn và hành vi xe quay lại.

### Phase 3 — Quotes, workshop, acceptance & handover
- Quote revisions/lines/discount/tax/totals; submit/approve/reject, evidence, quote change orders.
- Work order, technician assignment, checklist, logs, stage transitions, estimate/due dates.
- Nghiệm thu, sửa lỗi sau nghiệm thu, bàn giao, các ngoại lệ: dịch vụ miễn phí, báo giá không bắt buộc, hủy sau khi nhận xe, phát sinh dịch vụ/phụ tùng.
- Các transition phải được định nghĩa theo rule, không cập nhật status tùy ý.

### Phase 4 — Inventory, payments & finance
- Parts, warehouses/suppliers (nếu thực sự cần), stock receipt/issue/return/adjustment/stocktake, requests/reservations, ledger và đối soát.
- Deposit/collection/refund/reversal, payment methods, outstanding balance, receipts và điều kiện bàn giao theo policy.
- Báo cáo doanh thu thực thu vs báo giá vs công nợ; nguồn dữ liệu, ngày ghi nhận, phân quyền, precision/rounding.
- Không mặc định có hóa đơn điện tử, thuế kế toán, tích hợp POS/ngân hàng nếu chưa chốt.

### Phase 5 — Operations, reports, CMS & notifications
- Dashboard/operations board/alerts, staff shifts, KPI có định nghĩa mẫu số/ngày/scope.
- CMS draft/revision/publish/SEO/media và cache invalidation; role CMS riêng nếu cần.
- Notification inbox, outbox worker, adapter Zalo OA, consent, delivery logs, retry/dedupe; không gửi thật khi chưa duyệt.
- Export CSV bảo vệ dữ liệu và chống formula injection.

### Phase 6 — Legacy CRM migration, cutover & future access
- Data inventory/mapping/import staging/identity matching/manual review/dedup/provenance; mã phiếu gốc, dữ liệu lịch sử, phụ tùng/tồn, công nợ nếu có.
- Reconciliation, parallel-run, freeze window, cutover, rollback, backup/restore, auditability.
- Customer OTP/portal, waitlist, Android/iOS chỉ nếu được duyệt; thiết kế extension points, không làm blocker của cutover.

**Lưu ý:** migration planning phải bắt đầu từ P0 vì nó có thể ảnh hưởng khóa định danh và schema; Phase 6 là thời điểm thực hiện chuyển đổi, không phải lần đầu nghĩ đến migration. Các module kho/tài chính cần thiết kế từ sớm dù triển khai sau core booking.

## 4. Cấu trúc BẮT BUỘC của `api/api-design.md`

Viết tài liệu hoàn chỉnh bằng **tiếng Việt, kỹ thuật chính xác, ngắn gọn nhưng đủ để developer triển khai**. Dùng các heading sau theo đúng thứ tự:

1. **Executive Summary & Scope** — mục tiêu thay CRM; nguồn audit; những gì đã xác nhận/chưa xác nhận; giới hạn phạm vi.
2. **Current State vs Target State** — mapping 40 nhóm chức năng, 94 API cũ, 50 bảng baseline với các thay đổi; nêu phần thiếu về walk-in, inventory write, payments write, migration; không sao chép vô tội vạ.
3. **Architecture & Module Boundaries** — module ownership, dependency, transaction boundaries, API consumers, ASCII/Mermaid diagram (nhúng trực tiếp Markdown).
4. **Actors, Roles, Permissions** — persona/job role/auth role, ma trận quyền theo resource/action và record scope; negative cases.
5. **Canonical Domain Model** — entities/aggregates, quan hệ, cardinality, identifiers, lifecycle; bảng đề xuất mới/đổi so với baseline và migration implications.
6. **State Machines & Business Invariants** — Booking, Reservation, Visit, Quote, Work, Acceptance, Inventory, Payment; bảng from→action→to→actor→guard→side effects→error; tách public progress.
7. **API Standards** — `/api/v1`, naming, authentication/cookie/CSRF/CORS, UTC + `Asia/Ho_Chi_Minh`, DTO validation, error envelope, cursor paging, sort/filter, rate limit, idempotency key, ETag/expectedVersion, audit, observability.
8. **API Catalog by Phase** — **mỗi endpoint một dòng** với ID, phase, method/path, consumer, actor/permission, purpose, request fields, response fields, validation, errors, transaction/side effects, source file/requirement, status (`confirmed/proposed/needs approval`). Không chỉ liệt kê path. Gắn nhãn endpoint reused/modified/new/deferred so với audit.
9. **Detailed API Contracts for Critical Flows** — JSON mẫu request/response/error cho ít nhất: availability, public create, staff create, assign/transfer, confirm, reschedule, cancel, arrive, walk-in visit, reception, quote draft/revision/submit/decision, work start/finish, acceptance, handover, stock receipt/issue/return, payment collect/refund, operations summary. Nêu status code và preconditions. Không tạo code implementation.
10. **Booking Capacity Algorithm & Concurrency** — C01–C12; footprint nhiều service/pool/bucket, resources không đồng nhất, lock order, atomic reserve/release/replan, policy change, time overlap, no-show, arrived overrun, rollback, reconciliation; pseudo-code transaction và race tests. **Không chốt giả thời lượng/tài nguyên**.
11. **Database Contract & Schema Change Plan** — bảng theo phase, PK/FK/unique/index/check, nullable, snapshots, numeric/time, station scope, idempotency/outbox/audit; bảng cần thêm/đổi để support walk-in, inventory, finance, migration. Không viết migration thật.
12. **Frontend Integration Map** — mapping UI route/component→API→DTO→permission→phase; nơi cần thay mock/localStorage; UX cho 409/422/timeout, loading, double submit; giữ giao diện hiện tại.
13. **Legacy CRM Migration Strategy** — dữ liệu nào cần khảo sát từ CRM cũ, mapping, staging, dedup/manual review, reconciliation, rollback, unknowns; không giả định có API/export từ CRM cũ.
14. **Phase-by-Phase Delivery Plan** — thứ tự PR/sprint logic, prerequisites, acceptance criteria, Definition of Done, rollback/gates; mỗi phase có dependency, test matrix và demo scenario.
15. **Security, Reliability & Observability** — RBAC scope, session revocation, PII/media, rate limiting, CSRF, input sanitation, audit, outbox, backups, readiness, monitoring, SLO đề xuất (không giả số production).
16. **Decision Register & Open Questions** — phân loại `BLOCKER BEFORE SCHEMA`, `BLOCKER BEFORE GO-LIVE`, `CAN DEFER`; mỗi câu hỏi có ID, lý do, options, khuyến nghị, ảnh hưởng API/DB/UX, người quyết định. Đưa D01–D14 và C01–C12 vào đây hoặc liên kết bảng rõ ràng.
17. **Final Recommended Contract & Next Actions** — danh sách endpoint/schema **đủ điều kiện khóa** vs **chưa khóa**, thứ tự quyết định cần chủ dự án trả lời, prompt ngắn cho nhiệm vụ triển khai Phase 1 tiếp theo (chỉ văn bản trong tài liệu, không triển khai).

## 5. Tiêu chuẩn chi tiết cho mỗi API

Đối với mỗi endpoint, bảo đảm trả lời được:
- Ai gọi? Public, Advisor, Manager, Technician, Cashier, Inventory, CMS, worker hay customer đã xác minh?
- Trường hợp nghiệp vụ nào kích hoạt? UI nào đang cần? Có thực sự cần endpoint riêng không?
- Method/path, path/query/header/body, required/optional, kiểu, validation, defaults, whitelist.
- Response thành công có schema, status code, enum, cursor/meta, dữ liệu nào bị che theo role.
- Mã lỗi nghiệp vụ cụ thể và hành vi frontend (ví dụ `CAPACITY_FULL`, `VERSION_CONFLICT`, `INVALID_TRANSITION`, `QUOTE_LOCKED`, `INSUFFICIENT_STOCK`, `PAYMENT_CONFLICT`).
- Transaction gồm những bảng/aggregate nào? Có lock/optimistic version/idempotency/outbox không?
- Hành động lặp/timeout/retry có an toàn không? Nếu thành công một phần thì rollback/compensate thế nào?
- Gắn vào phase nào và vì sao? Truy vết đến file UI hoặc tài liệu nghiệp vụ cụ thể (path và line nếu có).

Nếu số endpoint quá lớn, catalog phải đầy đủ nhưng ví dụ JSON chi tiết ưu tiên critical flows; tránh lặp boilerplate bằng định nghĩa common profiles rồi tham chiếu.

## 6. Quy tắc đặc biệt cần kiểm tra

1. **Walk-in:** visit không có booking, không giữ suất đặt lịch giả; nếu cần cấp phát khoang ngay thì vẫn dùng cơ chế resource allocation tương thích, có rule cho trường hợp capacity đầy.
2. **Booking/Visit:** một booking có thể không dẫn đến visit; một visit walk-in không có booking; tránh duplicate do retry. Kiểm tra trường hợp khách đổi xe, nhiều dịch vụ và nhiều lần quay lại.
3. **Capacity:** confirm cùng giờ không trừ lần hai; reschedule không tự xung đột với hold của chính booking; cancel/no-show release đúng một lần; arrived không tự giải phóng toàn bộ tài nguyên.
4. **Quotations:** sửa sau khi khách duyệt tạo revision/change order, không sửa snapshot cũ; ghi rõ khách duyệt bằng cách nào và evidence chưa duyệt.
5. **Inventory:** phê duyệt báo giá không tự xuất kho; xuất kho có thể một phần; trả lại phụ tùng; số tồn không âm trừ khi chính sách backorder được duyệt; tránh double-issue khi retry.
6. **Finance:** thu nhiều lần, hoàn tiền, đảo bút toán; số dư từ ledger; không xóa giao dịch đã ghi; phân quyền người thu và người duyệt điều chỉnh.
7. **Handover:** tách kỹ thuật hoàn thành, nghiệm thu, xe sẵn sàng, đã bàn giao, đã thanh toán; điều kiện chặn bàn giao theo policy chưa chốt.
8. **Legacy:** không gộp hồ sơ theo phone/plate tự động; lưu external ID/provenance, log lỗi import và đối soát; không ghi đè hồ sơ thật bằng seed.
9. **Authorization:** mọi list/search/count/export và mutation phải áp dụng record scope tại server/DB; chuyển cố vấn làm mất quyền ghi của cố vấn cũ ngay sau commit.
10. **Consistency:** chỉ báo thành công trên UI sau commit; không gọi Zalo trong transaction; audit/outbox ghi cùng transaction nghiệp vụ.

## 7. Kiểm tra chất lượng tài liệu trước khi kết thúc

Tự kiểm tra và ghi checklist cuối tài liệu:
- [ ] Chỉ có một file đầu ra `api/api-design.md`, không thay đổi file khác.
- [ ] Đã đọc đủ audit/tài liệu/source có sẵn; liệt kê nguồn thiếu.
- [ ] Mục tiêu thay CRM toàn phần đã được phản ánh ở API/DB/phase.
- [ ] Có đầy đủ walk-in, quote revisions, workshop, acceptance, handover, inventory write, payments write, CRM migration.
- [ ] Có mapping old→new endpoint và bảng; không tự mặc định 94/50 là con số khóa.
- [ ] Booking PENDING giữ chỗ atomic, chống race, không overbooking.
- [ ] Phân biệt confirmed facts/proposals/unknowns; không âm thầm chốt D01–D14, C01–C12.
- [ ] Mọi endpoint có quyền, input/output, lỗi, side effect, phase và consumer.
- [ ] Có test cases cạnh tranh, idempotency, rollback, scope, money/stock consistency.
- [ ] Có acceptance gate từng phase và blockers trước schema/go-live.
- [ ] Không tạo backend, migration, DB, test chạy, hoặc sửa UI.

**Khi hoàn tất:** trả lời chat thật ngắn: đường dẫn `api/api-design.md`, số endpoint theo phase (đề xuất), số bảng mới/đổi (đề xuất), 5–10 blocker cần chủ dự án duyệt. Không tạo báo cáo chat dài thay cho file.

</details>
