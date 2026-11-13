# Đối chiếu source và tài liệu kỹ thuật

Ngày: 11/11/2026. Chỉ khảo sát/viết báo cáo; tài liệu gốc không được sửa. “Đã xác nhận trong source” chỉ mô tả code hiện có, không chứng nhận chức năng backend. Quyết định mới trong yêu cầu audit được ưu tiên hơn đề xuất cũ.

## 1. Tài liệu đã đối chiếu

| Tài liệu | Phạm vi / vị trí quan trọng | Đánh giá |
|---|---|---|
| [REQUIREMENTS](../../technical-documentation/REQUIREMENTS.md#L25) | MVP, hai vai trò, booking/public/tra cứu; §6 capacity, §14 D01–D14 | Nền nghiệp vụ; route và phạm vi CRM đã phát triển thêm; pending policy cũ bị thay thế. |
| [BUSINESS_RULES](../../technical-documentation/BUSINESS_RULES.md#L1) | BR-01–42, EX, D01–D14; [BR-19:87](../../technical-documentation/BUSINESS_RULES.md#L87), [BR-23:95](../../technical-documentation/BUSINESS_RULES.md#L95) | Cần thay đề xuất không giữ pending và over-capacity exception theo yêu cầu mới. |
| [USER_FLOW](../../technical-documentation/USER_FLOW.md#L57) | UF-01–18; [state:275](../../technical-documentation/USER_FLOW.md#L275), [screen matrix:310](../../technical-documentation/USER_FLOW.md#L310) | Luồng nghiệp vụ có căn cứ; URL /dat-lich,/quanly không còn mô tả đúng cách vào UI hiện tại. |
| [DATABASE_DESIGN](../../technical-documentation/DATABASE_DESIGN.md#L29) | Entities, constraint, TX, read models; [capacity:202](../../technical-documentation/DATABASE_DESIGN.md#L202), [phase:465](../../technical-documentation/DATABASE_DESIGN.md#L465) | Thiết kế dự thảo, chưa schema triển khai. Counter số lượt và thứ tự phase cần thay. |
| [API_SPEC](../../technical-documentation/API_SPEC.md#L9) | Public/Admin/Customer Access, DTO, RBAC, errors/TX | Hợp đồng chưa khóa; endpoints là dự kiến. Confirm “chiếm suất” không phù hợp nếu pending đã giữ cùng giờ. |
| [SYSTEM_ARCHITECTURE](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L17) | Modular monolith, DB riêng, auth, deployment, security, worker, backup | Phù hợp hướng backend; auth/ORM/provider vẫn là quyết định mở; capacity phải lên P1 thay vì P3. |

Tên file cũ như DPAuto_Booking_Requirements.md/handoff được nhắc trong metadata các tài liệu trên không tự chứng minh đó là bản nguồn mới nhất. Bộ sáu file thực tế dưới technical-documentation và yêu cầu audit hiện tại là căn cứ đối chiếu. Không import/đồng bộ dữ liệu từ CRM cũ trong nhiệm vụ này.

## 2. Thứ tự căn cứ và nhãn

1. **Đã xác nhận mới:** năm quy tắc booking trong yêu cầu audit: theo dịch vụ/tài nguyên, PENDING, giữ chỗ ngay, hard no-overbooking, chống race.
2. **Đã xác nhận quan sát source:** routes/components/stores/fields đang có, dẫn file/vị trí. Đây có thể chỉ là prototype.
3. **Đề xuất:** tên endpoint/schema/locking/cookie/Decimal/phase trong bộ audit.
4. **Cần làm rõ:** thông số thực, policy chưa duyệt, role CMS, model nguồn ghi kho/thực thu. Không biến mặc định UI thành nghiệp vụ chính thức.

## 3. Ma trận khác biệt

Ký hiệu phân loại: **Khớp** (ý định UI và tài liệu tương thích); **UI+** (UI có, tài liệu chưa đủ); **Doc+** (tài liệu có, UI/logic thật chưa có); **Mâu thuẫn**; **Chưa đủ**. P0 chặn tích hợp an toàn; P1 cần trước mở module tương ứng; P2 có thể hoãn. Mỗi hàng chỉ rõ ảnh hưởng API/DB.

| ID / loại / ưu tiên | Bằng chứng source | Căn cứ tài liệu / quyết định | Khoảng cách và xử lý đề xuất | Ảnh hưởng |
|---|---|---|---|---|
| G01 — Mâu thuẫn / P0 | [manager mock:485](../../src/lib/manager/mock.ts#L485) giữ pending; [public dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192) không ghi thật | [BR-19:87](../../technical-documentation/BUSINESS_RULES.md#L87), [REQ:193](../../technical-documentation/REQUIREMENTS.md#L193) từng đề xuất pending không giữ | Yêu cầu mới đã chốt giữ ngay. Không hỏi lại “có giữ hay không”; chỉ hỏi TTL/release. Create phải giữ trước commit. | API+DB |
| G02 — Mâu thuẫn / P0 | [form:134](../../src/components/admin/booking-form.tsx#L134) cho “Vẫn lưu lịch” | [BR-23:95](../../technical-documentation/BUSINESS_RULES.md#L95) đề xuất manager override; yêu cầu mới không overbook | Không cho override vượt năng lực dù có reason. Tăng capacity thực phải có cấu hình/đối soát riêng. | API+DB |
| G03 — Chưa đủ / P0 | [manager rules:3](../../src/lib/manager/rules.ts#L3), [mock:485](../../src/lib/manager/mock.ts#L485) phút theo start window | [DB:212](../../technical-documentation/DATABASE_DESIGN.md#L212) tổng suất/slot, chưa model tài nguyên | Thiếu pool, units, interval, duration, sequential/parallel, continuity. Resource-minutes tổng không chứng minh khả thi liên tục. | API+DB |
| G04 — Doc+ / P0 | [booking-provider:146](../../src/components/admin/booking-provider.tsx#L146), [advisor-provider:79](../../src/components/advisor/advisor-provider.tsx#L79) không actor/record guard | [REQ:46](../../technical-documentation/REQUIREMENTS.md#L46), [API:36](../../technical-documentation/API_SPEC.md#L36) yêu cầu RBAC từng record | Xây auth+scope backend; advisorId filter không cấp quyền. Đây là thiếu backend, không bằng chứng xâm nhập production. | API+DB |
| G05 — Mâu thuẫn / P0 | [booking-form:389](../../src/components/admin/booking-form.tsx#L389) chọn cố vấn bất kỳ | [REQ:70](../../technical-documentation/REQUIREMENTS.md#L70) advisor tạo mặc định tự phụ trách, transfer M | Server xác định owner từ identity; transfer action riêng, thu hồi quyền ngay. | API+DB |
| G06 — Mâu thuẫn / P0 | [provider:171](../../src/components/admin/booking-provider.tsx#L171) tự match/merge phone | [DB:128](../../technical-documentation/DATABASE_DESIGN.md#L128), [BR-34:121](../../technical-documentation/BUSINESS_RULES.md#L121) không tự gộp | Dùng ID/link đã xác minh; phone/plate không unique hoặc proof ownership. | API+DB |
| G07 — Doc+ / P0 | [dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192) timeout thay submit HTTP | [API:89](../../technical-documentation/API_SPEC.md#L89), [DB TX:323](../../technical-documentation/DATABASE_DESIGN.md#L323) idempotency/TX | Chưa có create thật; atomic booking+hold+idempotency; mã lịch không access token. | API+DB |
| G08 — Chưa đủ / P0 | [public catalog:35](../../src/lib/public-booking/mock.ts#L35), [advisor seed:15](../../src/lib/booking/seed.ts#L15), [manager seed:152](../../src/lib/manager/mock.ts#L152), [content:1](../../src/lib/content.ts#L1) | [DB services:142](../../technical-documentation/DATABASE_DESIGN.md#L142) một catalog | Các catalog ID/tên/định lượng không đồng nhất; lập bảng mapping do trạm duyệt, không match tên tự động. | API+DB |
| G09 — Doc+ / P0 | [steps:27](../../src/components/public-booking/booking-steps.tsx#L27), [dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192) chưa lưu consent thật | [REQ:151](../../technical-documentation/REQUIREMENTS.md#L151), [DB:273](../../technical-documentation/DATABASE_DESIGN.md#L273) | Bổ sung notice/acknowledgement và marketing riêng khi nối API; không mặc định opt-in. | API+DB |
| G10 — Mâu thuẫn / P0 | [public stationToday:106](../../src/lib/public-booking/mock.ts#L106), [advisor localDate:44](../../src/lib/booking/logic.ts#L44), [provider:192](../../src/components/admin/booking-provider.tsx#L192) thiếu offset | [API:14](../../technical-documentation/API_SPEC.md#L14) ISO timezone, DB timestamptz | Server authority giờ trạm; không dùng local ngày máy khách làm policy. | API+DB |
| G11 — Mâu thuẫn / P1 | [acceptance:29](../../src/components/advisor/acceptance-editor.tsx#L29), [actions:22](../../src/components/admin/booking-actions.tsx#L22) stage done rồi mới complete riêng | [UF-11:199](../../technical-documentation/USER_FLOW.md#L199) handover tạo completed/history | Tách nghiệm thu/ready/handed-over; complete không mặc định paid. D06 cần tiêu chí tối thiểu. | API+DB |
| G12 — Doc+ / P0 | [receive:67](../../src/components/advisor/advisor-provider.tsx#L67) ghi order rồi act arrive ở store khác | [DB:349](../../technical-documentation/DATABASE_DESIGN.md#L349) arrive+visit/event cùngTX | Unique visit/booking và receive atomic; không hai visit vì click/retry. | API+DB |
| G13 — Doc+ / P1 | [actions:38](../../src/components/admin/booking-actions.tsx#L38), [reschedule:110](../../src/components/admin/booking-actions.tsx#L110) confirm dialog không nhập reason/đồng ý | [API:157](../../technical-documentation/API_SPEC.md#L157) đổi giờ có reason/customerAgreed | Manager đã gần luồng hơn nhưng cố vấn cần field/contract tương ứng khi nối backend. | API+DB |
| G14 — Chưa đủ / P1 | [logic:62](../../src/lib/booking/logic.ts#L62) no-show theo giờ hẹn, không grace cấu hình | [API:173](../../technical-documentation/API_SPEC.md#L173), [REQ D14:433](../../technical-documentation/REQUIREMENTS.md#L433) | Duyệt grace và quyền xác minh; không auto no-show. | API+DB |
| G15 — Doc+ / P1 | Route inventory không có portal OTP; [admin placeholder:1](../../src/app/admin/page.tsx#L1) không là cổng khách | [REQ:264](../../technical-documentation/REQUIREMENTS.md#L264), [API:211](../../technical-documentation/API_SPEC.md#L211) | Hoãn public history tới khi challenge/grant an toàn; không tra cứu bằng phone/plate đơn thuần. | API+DB |
| G16 — UI+ / P1 | [quote-editor:57](../../src/components/advisor/quote-editor.tsx#L57), [work-editor:9](../../src/components/advisor/work-editor.tsx#L9), [acceptance:10](../../src/components/advisor/acceptance-editor.tsx#L10) | [REQ:25](../../technical-documentation/REQUIREMENTS.md#L25), [DB:14](../../technical-documentation/DATABASE_DESIGN.md#L14) ngoài MVP chi tiết | UI CRM rộng hơn MVP tài liệu; giữ module mở rộng P3, không tự nâng thành bắt buộc P1/P2. | API+DB |
| G17 — UI+ / P1 | [resource-pages:15](../../src/components/manager/resource-pages.tsx#L15), [resource-pages:208](../../src/components/manager/resource-pages.tsx#L208) kho/tài chính readonly | [API scope:9](../../technical-documentation/API_SPEC.md#L9) ngoài ERP/payment | Cần nguồn ledger/import được duyệt hoặc module ghi riêng; hiện không có flow thu tiền/nhập-xuất đầy đủ để suy ra POST API. | API+DB |
| G18 — Chưa đủ / P1 | [quoteTotals:146](../../src/lib/advisor/seed.ts#L146), [acceptance:14](../../src/components/advisor/acceptance-editor.tsx#L14) tồn ảnh chụp | Tài liệu MVP chưa mô tả quote rounding/revision/stock issue | Chốt precision/rounding, revision khách duyệt, chứng cứ quyết định, issued vs required; không dùng tồn snapshot để chứng minh đã đủ phụ tùng thực tế. | API+DB |
| G19 — Chưa đủ / P1 | [content-page:49](../../src/components/manager/content-page.tsx#L49) edit/publish local; [content.ts:1](../../src/lib/content.ts#L1) public JSON | [D13:432](../../technical-documentation/REQUIREMENTS.md#L432), [API:245](../../technical-documentation/API_SPEC.md#L245) CMS riêng chưa chốt | Chưa có publish thật/cache invalidation; CMS role và cấu trúc blocks/SEO cần chốt; không cấp advisor CMS. | API+DB |
| G20 — UI+ / P1 | [staff-schedule:22](../../src/components/manager/staff-schedule.tsx#L22), [operations types:54](../../src/lib/manager/operations.ts#L54) ca làm | [REQ:29](../../technical-documentation/REQUIREMENTS.md#L29) chưa chấm công/lương | Ca khả dụng không phải payroll; job_role KTV khác authrole. Duyệt ca ảnh hưởng pool hay chỉ assignment. | API+DB |
| G21 — Mâu thuẫn tài liệu / P0 | [public mock:183](../../src/lib/public-booking/mock.ts#L183) chưa capacity thật | [architecture phase:315](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L315), [DB phase:465](../../technical-documentation/DATABASE_DESIGN.md#L465) để capacity sau create | Đưa capacity/reservation/concurrency vào P1 cùng public create; không mở đặt lịch thật rồi mới chặn overbook ở P3. | API+DB |
| G22 — Khớp ý định / P1 | [manager rules:3](../../src/lib/manager/rules.ts#L3), [booking-list:106](../../src/components/manager/booking-list.tsx#L106) reason/đồng ý/đổi-hủy | [API:157](../../technical-documentation/API_SPEC.md#L157), [UF07:160](../../technical-documentation/USER_FLOW.md#L160) | Có UI phù hợp để tích hợp; vẫn thiếu DB TX/version/actor thật, không đánh dấu backend hoàn thành. | API+DB |
| G23 — Khớp ranh giới / P2 | [accessories:44](../../src/components/sections/accessories.tsx#L44), [print:11](../../src/components/advisor/print-page.tsx#L11), [settings:63](../../src/components/admin/secondary-pages.tsx#L63) | Tài liệu không yêu cầu commerce/PDF engine/theme sync | Không bổ sung API bán hàng, in server hoặc bảng theme chỉ vì có nút/link. | API phạm vi |
| G24 — Mâu thuẫn route, Chưa đủ role / P1 | [next config:1](../../next.config.ts#L1), [co-van website:3](../../src/app/co-van/website/page.tsx#L3), [admin page:1](../../src/app/admin/page.tsx#L1) | [UF screen:310](../../technical-documentation/USER_FLOW.md#L310) /dat-lich,/quanly; [REQ:35](../../technical-documentation/REQUIREMENTS.md#L35)2 roles | Hiện booking modal, /co-van,/dieu-hanh,/admin. Bốn persona trong trao đổi không mặc nhiên4 role login. Chốt CMS quyền riêng; route không quyết định permission. | API+DB |

## 4. Trạng thái D01–D14 sau audit

| Mã cũ | Kết luận hiện tại | Cần quyết định tiếp |
|---|---|---|
| D01 | Cần làm rõ queue/phân công | Ai chịu trách nhiệm liên hệ pending; có manager-only queue không? |
| D02 | Cần làm rõ tự nhận lịch | Đề xuất không tự nhận; không bật do UI chọn advisor được. |
| D03 | Chưa chốt waitlist | Có làm không? Hoãn P5, khác pending đang giữ chỗ. |
| D04 | **Đã xác nhận: PENDING giữ chỗ ngay** | TTL và xử lý pending lâu chưa chốt; mặc định không tự expire. |
| D05 | **Đã xác nhận hướng: theo dịch vụ/năng lực** | Công thức, pool, duration, continuity, resource cụ thể C01–C12 còn mở. |
| D06 | Cần làm rõ hoàn tất/bàn giao | Ai, trường tối thiểu, có cần nghiệm thu chi tiết khi CRM bật không? |
| D07 | Cần duyệt bỏ qua mốc | Không tạo bước giả khi không áp dụng. |
| D08 | Cần chọn OTP/token provider | Không mở portal history trước xác minh an toàn. |
| D09 | Cần duyệt phạm vi lịch sử | Không tự import CRM cũ; provenance dữ liệu phải rõ. |
| D10 | Cần duyệt ngoại lệ sau arrived | Hoãn reopen; không generic PATCH status. Hard no-overbook vẫn áp dụng. |
| D11 | Cần duyệt projection sau transfer | Advisor cũ đọc phần nào, đặc biệt note/quote/PII phát sinh sau chuyển? |
| D12 | Cần duyệt progress theo dịch vụ | Phân biệt public progress và CRM stage. |
| D13 | Cần duyệt quyền CMS | Admin website khác manager vận hành ra sao, ai publish? |
| D14 | Cần duyệt grace no-show | Không nhầm câu hỏi ngày bảo dưỡng với D14 no-show; [DB:247](../../technical-documentation/DATABASE_DESIGN.md#L247). |

## 5. Các quyết định bổ sung, chưa tự chốt

- **API+DB/P0:** canonical service IDs và requirement version; tài nguyên thực, units, giờ nghỉ, đa dịch vụ và continuity; pending timeout nếu muốn có; giảm capacity/nghỉ đột xuất khi có hold.
- **API+DB/P0:** identity/session provider, role matrix, mã staff khác user ID; scope A trước/sau transfer; một hay nhiều role/user.
- **API+DB/P1:** customer/vehicle dedup và quyền xem lịch sử khi đổi chủ; model/ODO có bắt buộc theo từng bước không; notice/consent policy và retention.
- **API+DB/P1 cho CRM:** revision quote, rounding/thuế, kỹ năng/ca KTV, nguồn nhập/xuất kho, nguồn payment thực thu, refund/overpayment, điều kiện nghiệm thu.
- **API/P1:** domain/origin/cookie/CSRF, giới hạn spam, request-size, rate limit và Idempotency-Key TTL; không gán số tùy tiện thành đã chốt.
- **Vận hành:** RPO/RTO, backup/restore, sức tải VPS; tài liệu [architecture:200](../../technical-documentation/SYSTEM_ARCHITECTURE.md#L200) nói4vCPU/4GB nhưng chưa có phép đo trong nhiệm vụ này.
- **Mở rộng:** hiện một trạm; station_id giúp chuẩn bị nhưng chưa là đa chi nhánh hoàn chỉnh. Mobile app dùng hợp đồng API tương lai, không lưu token trong URL/localStorage để “chuẩn bị app”.

## 6. Việc đồng bộ tài liệu sau khi có duyệt

Không thực hiện sửa các file gốc trong audit. Khi được giao coding, trước migration cần cập nhật phiên bản BUSINESS_RULES/REQUIREMENTS (pending/hard limit), USER_FLOW (modal/routes/state), DATABASE_DESIGN (resource reservation), API_SPEC (create giữ chỗ/confirm không trừ2 lần) và SYSTEM_ARCHITECTURE (capacity P1/stack/provider), giữ lịch sử thay đổi và người duyệt.

Các test trong tài liệu gốc là kế hoạch nghiệm thu tương lai, không phải quyền chạy full suite trong nhiệm vụ này. Không có browser/test/build được chạy để “xác nhận” các phát hiện tĩnh.

