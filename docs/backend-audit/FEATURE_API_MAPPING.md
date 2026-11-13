# Ánh xạ chức năng → API → dữ liệu

Ngày: 11/11/2026. **40 nhóm chức năng**, bao phủ47 route template và các component con. Tên Fxx là khóa traceability dùng chung trong [khảo sát UI](FRONTEND_AUDIT.md), [catalog94 API](API_REQUIREMENTS.md) và [baseline50 bảng](DATABASE_REQUIREMENTS.md).

## 1. Quy ước

- Dữ liệu hiển thị, input bắt buộc/tùy chọn, validation hiện tại, loading/empty/error/success xem FRONTEND_AUDIT mục4–5. Bảng dưới bổ sung backend reads/writes và khoảng trống tích hợp.
- Endpoint ID dẫn catalog nơi có method/path, quyền, request/response, validation, lỗi và phase. Một API phục vụ nhiều Fxx, không cộng lại theo số consumer.
- Tên rút gọn trong ô read model chỉ miền dữ liệu, **không phải bảng mới ngoài50 bảng**. Nguồn source ở mỗi hàng chỉ ra consumer hiện tại, không chứng minh API đã tồn tại.
- Không có API mới cho tương tác thuần hiển thị, tel/mail/maps, theme, FAQ, slider, animation hoặc in trình duyệt.

## 2. Ma trận40 nhóm

| Nhóm và bằng chứng consumer | API đề xuất | Backend cần đọc | Backend cần ghi / transaction | Khoảng trống / giới hạn |
|---|---|---|---|---|
| **F01 — Nội dung trang chủ, about, contact, pháp lý**<br>[src/lib/content.ts:1](../../src/lib/content.ts#L1) | PUB05,PUB08 | stations,content_items,content_revisions | CMS ghi ở F38, thông tin trạm ở F36; public chỉ đọc | Giữ static nếu chưa triển khai CMS, không thêm form liên hệ |
| **F02 — Dịch vụ public**<br>[src/app/(public)/services/[slug]/page.tsx:6](../../src/app/(public)/services/[slug]/page.tsx#L6) | PUB01,PUB02 | services,service_categories,content_items,content_revisions,media_assets | Public chỉ đọc, catalog ghi F27 | Mapping slug marketing và bookable serviceId |
| **F03 — Tin tức public**<br>[src/app/(public)/news/[slug]/page.tsx:10](../../src/app/(public)/news/[slug]/page.tsx#L10) | PUB06,PUB07 | content_items,content_revisions,media_assets | Public chỉ đọc | Bài featured/related cùng API, không endpoint cho từng section |
| **F04 — Công trình và ảnh trước/sau**<br>[src/app/(public)/our-work/page.tsx:1](../../src/app/(public)/our-work/page.tsx#L1) | Không cần API mới | Không cần bảng MVP | JSON hiện tại chỉ đọc | Project CRUD không có consumer quản trị hiện tại, hoãn |
| **F05 — Phụ kiện, thương hiệu, đánh giá, FAQ**<br>[src/components/sections/accessories.tsx:44](../../src/components/sections/accessories.tsx#L44) | Không cần API mới | Không ecommerce/review tables MVP | FAQ/carousel/brand static; phụ kiện link contact | Không suy ra đơn hàng hoặc lấy Google Reviews trực tiếp |
| **F06 — Popup thông tin khách và xe**<br>[src/components/public-booking/booking-steps.tsx:27](../../src/components/public-booking/booking-steps.tsx#L27) | PUB04 (một phần) | customers,vehicles,customer_vehicle_links,consents | Tạo contact snapshot và consent trong cùng booking TX | Không auto-merge theo phone/plate, model/plate public tùy chọn |
| **F07 — Chọn nhiều dịch vụ**<br>[src/lib/public-booking/mock.ts:35](../../src/lib/public-booking/mock.ts#L35) | PUB01,CAT01 | services,service_categories,service_resource_requirements,resource_pools | Ghi booking_services snapshot khi submit | Danh mục canonical, không dùng durationLabel làm số |
| **F08 — Lịch và availability**<br>[src/components/public-booking/booking-schedule.tsx:131](../../src/components/public-booking/booking-schedule.tsx#L131) | PUB03 | business_hours,calendar_blocks,capacity_policies,capacity_buckets,reservation_allocations | Chỉ đọc availability; chưa tạo hold khi mới chọn giờ | Create recheck; abort/refresh khi đổi dịch vụ/ngày |
| **F09 — Gửi và thành công đặt lịch**<br>[src/components/public-booking/booking-dialog.tsx:192](../../src/components/public-booking/booking-dialog.tsx#L192) | PUB04 | bookings,booking_services,capacity_reservations,reservation_allocations,idempotency_keys,booking_events,consents,outbox_jobs | Tạo PENDING+giữ tài nguyên ngay, atomic | Mã lịch không là access token; timeout giữ cùng key |
| **F10 — Tổng quan cố vấn**<br>[src/components/admin/bookings-workspace.tsx:101](../../src/components/admin/bookings-workspace.tsx#L101) | BKG01,RPT01,VIS01 | bookings,service_visits,quotes,quote_revisions,work_orders,acceptances | Chỉ đọc hôm nay theo scope cố vấn | KPI không tính trên page; CRM tasks chỉ bật P3 |
| **F11 — Danh sách và chi tiết lịch cố vấn**<br>[src/components/admin/booking-detail.tsx:16](../../src/components/admin/booking-detail.tsx#L16) | BKG01,BKG02,BKG12 | bookings,customers,vehicles,booking_services,booking_events,booking_assignments | Đọc scoped; không tải toàn bộ DB về browser | Search/filter/sort trước paging; chi tiết có version/actions |
| **F12 — Tạo/sửa lịch cố vấn**<br>[src/components/admin/booking-form.tsx:121](../../src/components/admin/booking-form.tsx#L121) | BKG03,BKG04,CUS01,CAT01 | bookings,customers,vehicles,links,booking_services,reservations,allocations,events | Tạo/sửa có footprint replan; actor từ server | Tên links/reservations/allocations/events trong ô này là các bảng đầy đủ mụcDB; không tạo bảng alias |
| **F13 — Xác nhận, hủy, không đến**<br>[src/components/admin/booking-actions.tsx:22](../../src/components/admin/booking-actions.tsx#L22) | BKG05,BKG07,BKG08 | bookings,capacity_reservations,reservation_allocations,capacity_buckets,booking_events,outbox_jobs | Confirm/release atomic; reason/no-show grace | Complete không gộp action confirm; bàn giao F20 |
| **F14 — Đổi giờ cố vấn**<br>[src/components/admin/booking-actions.tsx:102](../../src/components/admin/booking-actions.tsx#L102) | BKG06,BKG14,PUB03 | bookings,booking_contact_events,capacity_reservations,reservation_allocations,booking_events | Liên hệ/đồng ý + chuyển hold atomic | Proposal không đổi giờ chính thức; fail giữ nguyên hold cũ |
| **F15 — Khách và hồ sơ xe cố vấn**<br>[src/components/admin/customers-workspace.tsx:134](../../src/components/admin/customers-workspace.tsx#L134) | CUS01,CUS02,CUS03 | customers,vehicles,customer_vehicle_links,bookings,booking_assignments,service_visits | Read projection scope theo assignment | Không cấp A quyền duyệt mọi khách chỉ vì UI có search |
| **F16 — Tiếp nhận và nháp**<br>[src/components/advisor/reception-page.tsx:137](../../src/components/advisor/reception-page.tsx#L137) | BKG09,VIS03,VIS04,MED01 | service_visits,service_progress_events,bookings,booking_events,media_assets | Nhận xe mộtTX; condition/ODO/request, metadata ảnh | Nháp local chưa cần endpoint autosave; media P3, ODO bắt buộc cần chốt |
| **F17 — Danh sách/chi tiết phiếu**<br>[src/components/advisor/order-detail-page.tsx:32](../../src/components/advisor/order-detail-page.tsx#L32) | VIS01,VIS02 | service_visits,customers,vehicles,quotes,work_orders,acceptances | Read list/detail; tab con dùng API nhóm F18–20 | Không trả toàn bộ lịch sử/ảnh để list nhanh |
| **F18 — Soạn báo giá và quyết định khách**<br>[src/components/advisor/quote-editor.tsx:74](../../src/components/advisor/quote-editor.tsx#L74) | QTE01,QTE02,QTE03,QTE04,CAT01,INV01 | quotes,quote_revisions,quote_lines,services,parts,audit_logs | Lưu draft/revision, submit, ghi quyết định khách | Server tính tiền, immutable bản đã duyệt; không tự xuất kho |
| **F19 — Thi công và nhật ký**<br>[src/components/advisor/work-editor.tsx:33](../../src/components/advisor/work-editor.tsx#L33) | WRK01,WRK02,WRK03,WRK04 | work_orders,work_items,work_logs,staff_profiles,visit_assignments,service_visits | Lưu KTV/deadline/checklist/log và chuyển stage | Không tự public phần trăm thành lời hứa hoàn tất |
| **F20 — Nghiệm thu và chờ bàn giao**<br>[src/components/advisor/acceptance-editor.tsx:20](../../src/components/advisor/acceptance-editor.tsx#L20) | ACP01,ACP02,VIS06 | acceptances,acceptance_checks,service_visits,bookings,service_progress_events | Lưu nghiệm thu; handover thật riêng và COMPLETED atomic | Done nghiệm thu không đồng nghĩa bàn giao hoặc thu đủ tiền |
| **F21 — In báo giá/biên bản**<br>[src/components/advisor/print-page.tsx:11](../../src/components/advisor/print-page.tsx#L11) | VIS02,QTE01 | service_visits,quotes,quote_revisions,quote_lines,acceptances,acceptance_checks | Chỉ đọc bản được phép cho browser print | Không cần PDF server; dữ liệu in phải đúng revision |
| **F22 — Tài khoản và tùy chọn**<br>[src/components/admin/secondary-pages.tsx:8](../../src/components/admin/secondary-pages.tsx#L8) | AUTH03,AUTH02,NOT01 | users,staff_profiles,sessions,notifications | Logout revoke session; theme có thể local | UI account đang cố định, không tạo API sửa profile/mật khẩu vô cớ |
| **F23 — Dashboard/báo cáo quản lý**<br>[src/components/manager/dashboard.tsx:20](../../src/components/manager/dashboard.tsx#L20) | RPT01,RPT02,BKG01,CAP01,OPS01,OPS02 | bookings,visits,capacity,quotes,payments (read models trên bảng mụcDB) | Read aggregate/export; không ghi doanh thu từ quote | Tên rút gọn chỉ miền đọc, không bảng mới; dateBasis/mẫu số rõ ràng |
| **F24 — Lịch quản lý và drawer hành động**<br>[src/components/manager/booking-list.tsx:106](../../src/components/manager/booking-list.tsx#L106) | BKG01,BKG02,BKG05,BKG06,BKG07 | bookings,customers,vehicles,services,events,reservations,allocations | Cùng Booking API với cố vấn; manager khác scope | Không làm /manager-bookings duplicate; mọi filter nằm trong BKG01 |
| **F25 — Phân/chuyển cố vấn**<br>[src/components/manager/order-drawer.tsx:46](../../src/components/manager/order-drawer.tsx#L46) | STF01,BKG10,BKG11,VIS07 | booking_assignments,bookings,visit_assignments,staff_profiles,audit_logs | Một owner, transfer history, KTV assignment | Thu hồi A ngay; A không tự nhận queue khi chưa duyệt D02 |
| **F26 — Năng lực phục vụ**<br>[src/components/manager/capacity-page.tsx:42](../../src/components/manager/capacity-page.tsx#L42) | CAP01,CAP02,CAP03,CAP04,CAP05,CAP06,CAP07,CAP08 | resource_pools,requirements,business_hours,blocks,policies,buckets,reservations,allocations | Init ngày/chỉnh capacity/đóng-mở có impact và audit | Tên rút gọn tham chiếu bảng DB; không giữ chỉ start bucket |
| **F27 — Danh mục dịch vụ quản lý**<br>[src/components/manager/catalog-pages.tsx:22](../../src/components/manager/catalog-pages.tsx#L22) | CAT01,CAT02,CAT03 | services,service_categories,service_resource_requirements,audit_logs | Catalog version/active/duration/mapping | Không sửa snapshots cũ; UI chưa nhập đầy đủ pool |
| **F28 — Nhân sự quản lý**<br>[src/components/manager/catalog-pages.tsx:277](../../src/components/manager/catalog-pages.tsx#L277) | STF01,STF02,STF03 | staff_profiles,users,user_roles,sessions,booking_assignments | Hồ sơ/active/invite nếu duyệt, role trong DTO riêng | Job KTV không mặc nhiên tài khoản; account disable ảnh hưởng request kế tiếp |
| **F29 — Ca làm và nghỉ**<br>[src/components/manager/staff-schedule.tsx:22](../../src/components/manager/staff-schedule.tsx#L22) | STF04,STF05,STF06 | staff_shifts,staff_profiles,capacity_policies | Tạo/sửa ca với reason và overlap check | PRESENT/SCHEDULED/LEAVE theo type; không chấm công/lương |
| **F30 — Khách/xe toàn trạm**<br>[src/components/manager/customers-page.tsx:24](../../src/components/manager/customers-page.tsx#L24) | CUS01,CUS02,CUS03 | customers,vehicles,customer_vehicle_links,bookings,service_visits | Đọc khách/xe/lịch/phiếu toàn trạm theo quyền M | Chuẩn hóa customer+vehicle flattened, chưa CRUD merge độc lập |
| **F31 — Điều phối công việc**<br>[src/components/manager/operations-page.tsx:31](../../src/components/manager/operations-page.tsx#L31) | OPS01,VIS02,BKG01,STF01 | bookings,service_visits,quote_revisions,work_orders,acceptances | Đọc board; assignment ghi F25 | Không API drag-drop vì UI hiện chỉ mở drawer |
| **F32 — Theo dõi phiếu và báo giá quản lý**<br>[src/components/manager/operations-page.tsx:31](../../src/components/manager/operations-page.tsx#L31) | VIS01,VIS02,QTE01,OPS01 | service_visits,quotes,quote_revisions,quote_lines,booking_events | Manager đọc phiếu/báo giá/history; phân công F25 | Không mặc định manager đã có quote editor |
| **F33 — Kho và yêu cầu phụ tùng**<br>[src/components/manager/resource-pages.tsx:208](../../src/components/manager/resource-pages.tsx#L208) | INV01,INV02,INV03 | parts,inventory_movements,part_requests,quote_lines | Chỉ read theo UI hiện tại; nguồn ghi ngoài phạm vi đã duyệt | Không tạo POST nhập/xuất thiếu form/policy; số thiếu không bằng tồn |
| **F34 — Tài chính tổng hợp**<br>[src/components/manager/resource-pages.tsx:15](../../src/components/manager/resource-pages.tsx#L15) | FIN01 | quotes,quote_revisions,payment_entries,service_visits | Read totals/rows; chưa có UI thu/hoàn tiền | Nguồn ledger/đối soát cần chốt; quote value khác thực thu |
| **F35 — Trung tâm cảnh báo**<br>[src/lib/manager/operations.ts:133](../../src/lib/manager/operations.ts#L133) | OPS02 | bookings,capacity_buckets,work_orders,acceptances,parts,movements (derived) | Đọc cảnh báo và deep link; không tự sửa status | Threshold mẫu80%/2h/3xe chưa chính thức |
| **F36 — Cấu hình trạm**<br>[src/components/manager/system-pages.tsx:17](../../src/components/manager/system-pages.tsx#L17) | SET01,SET02,CAP02,CAP03 | stations,business_hours,calendar_blocks,capacity_policies,audit_logs | Ghi liên hệ/cấu hình có version, reason và impact | Không gửi secret Zalo vào DTO settings chung |
| **F37 — Thông báo và nhật ký**<br>[src/components/manager/system-pages.tsx:184](../../src/components/manager/system-pages.tsx#L184) | NOT01,NOT02,AUD01 | notifications,outbox_jobs,audit_logs,booking_events | Mark read riêng recipient; audit readonly | Nút retry Zalo hiện không gửi thật; không thêm endpoint gửi khi chưa tích hợp |
| **F38 — CMS nội dung/bài/ảnh/SEO**<br>[src/components/manager/content-page.tsx:49](../../src/components/manager/content-page.tsx#L49) | CMS01,CMS02,CMS03,CMS04,MEDCMS01,MEDCMS02 | content_items,content_revisions,media_assets,outbox_jobs | Tạo news/edit/preview/publish/metadata; public invalidate | CMS chưa đồng bộ JSON, D13 phải chốt trước cấp quyền |
| **F39 — Admin website và route cũ**<br>[src/app/admin/page.tsx:1](../../src/app/admin/page.tsx#L1) | Không API riêng | Không bảng riêng | Placeholder /admin; redirects là routing | Không lấy tồn tại đường dẫn làm auth hoặc CMS đã xong |
| **F40 — Auth, tra cứu an toàn, waitlist và vận hành backend còn thiếu**<br>[technical-documentation/API_SPEC.md:36](../../technical-documentation/API_SPEC.md#L36) | AUTH01,AUTH02,AUTH03,BKG13,VIS05,CAC01,CAC02,CAC03,CAC04,CAC05,CAC06,CAC07,WAI01,WAI02,WAI03,INT01,INT02 | users,sessions,verification_challenges,access_grants,waitlist_requests,outbox_jobs,audit_logs | Yêu cầu tài liệu/đề xuất kỹ thuật, chưa có UI hoàn chỉnh | P5 chỉ khi D03/D08/D09 duyệt; probe không là nghiệp vụ public |

## 3. Truy vết ngược toàn bộ endpoint

Bảng này bảo đảm từng endpoint trong catalog có ít nhất một consumer hoặc lý do kỹ thuật/tài liệu; không có endpoint vô căn cứ được thêm chỉ để “đủ CRUD”. Các endpoints bị hoãn vẫn được tính trong94 API dự kiến, không là MVP đã duyệt.

| ID | Method/path | Fxx sử dụng | Ưu tiên |
|---|---|---|---|
| PUB01 | GET `/public/services` | F02, F07 | P1 |
| PUB02 | GET `/public/services/:slug` | F02 | P4 |
| PUB03 | GET `/public/availability` | F08, F14 | P1 |
| PUB04 | POST `/public/bookings` | F09 | P1 |
| PUB05 | GET `/public/site-info` | F01 | P4 |
| PUB06 | GET `/public/posts` | F03 | P4 |
| PUB07 | GET `/public/posts/:slug` | F03 | P4 |
| PUB08 | GET `/public/pages/:key` | F01 | P4 |
| AUTH01 | POST `/admin/auth/login` | F40 | P1 |
| AUTH02 | POST `/admin/auth/logout` | F22, F40 | P1 |
| AUTH03 | GET `/admin/auth/me` | F22, F40 | P1 |
| STF01 | GET `/admin/staff` | F25, F28, F31 | P1 |
| STF02 | POST `/admin/staff` | F28 | P1 |
| STF03 | PATCH `/admin/staff/:id` | F28 | P1 |
| STF04 | GET `/admin/staff-shifts` | F29 | P3 |
| STF05 | POST `/admin/staff-shifts` | F29 | P3 |
| STF06 | PATCH `/admin/staff-shifts/:id` | F29 | P3 |
| CAT01 | GET `/admin/services` | F07, F12, F18, F27 | P1 |
| CAT02 | POST `/admin/services` | F27 | P1 |
| CAT03 | PATCH `/admin/services/:id` | F27 | P1 |
| BKG01 | GET `/admin/bookings` | F10, F11, F23, F24, F31 | P1 |
| BKG02 | GET `/admin/bookings/:id` | F11, F24 | P1 |
| BKG03 | POST `/admin/bookings` | F12 | P1 |
| BKG04 | PATCH `/admin/bookings/:id` | F12 | P1 |
| BKG05 | POST `/admin/bookings/:id/confirm` | F13, F24 | P1 |
| BKG06 | POST `/admin/bookings/:id/reschedule` | F14, F24 | P1 |
| BKG07 | POST `/admin/bookings/:id/cancel` | F13, F24 | P1 |
| BKG08 | POST `/admin/bookings/:id/no-show` | F13 | P1 |
| BKG09 | POST `/admin/bookings/:id/arrive` | F16 | P2 |
| BKG10 | POST `/admin/bookings/:id/assign` | F25 | P1 |
| BKG11 | POST `/admin/bookings/:id/transfer` | F25 | P1 |
| BKG12 | GET `/admin/bookings/:id/events` | F11 | P1 |
| BKG13 | GET `/admin/my-history` | F40 | P2 |
| BKG14 | POST `/admin/bookings/:id/contact-events` | F14 | P2 |
| CAP01 | GET `/admin/capacity/calendar` | F23, F26 | P1 |
| CAP02 | GET `/admin/capacity/policy` | F26, F36 | P1 |
| CAP03 | PUT `/admin/capacity/policy` | F26, F36 | P1 |
| CAP04 | POST `/admin/capacity/days` | F26 | P1 |
| CAP05 | PATCH `/admin/capacity/buckets/:id` | F26 | P1 |
| CAP06 | GET `/admin/capacity/blocks` | F26 | P1 |
| CAP07 | POST `/admin/capacity/blocks` | F26 | P1 |
| CAP08 | DELETE `/admin/capacity/blocks/:id` | F26 | P1 |
| CUS01 | GET `/admin/customers` | F12, F15, F30 | P1 |
| CUS02 | GET `/admin/customers/:id` | F15, F30 | P1 |
| CUS03 | GET `/admin/vehicles/:id` | F15, F30 | P2 |
| VIS01 | GET `/admin/service-visits` | F10, F17, F32 | P2 |
| VIS02 | GET `/admin/service-visits/:id` | F17, F21, F31, F32 | P2 |
| VIS03 | POST `/admin/bookings/:id/service-visit` | F16 | P2 |
| VIS04 | PATCH `/admin/service-visits/:id/summary` | F16 | P2 |
| VIS05 | POST `/admin/service-visits/:id/progress` | F40 | P2 |
| VIS06 | POST `/admin/service-visits/:id/hand-over` | F20 | P2 |
| VIS07 | POST `/admin/service-visits/:id/assignment` | F25 | P3 |
| MED01 | POST `/admin/service-visits/:id/media` | F16 | P3 |
| QTE01 | GET `/admin/service-visits/:id/quote` | F18, F21, F32 | P3 |
| QTE02 | PUT `/admin/service-visits/:id/quote` | F18 | P3 |
| QTE03 | POST `/admin/service-visits/:id/quote/submit` | F18 | P3 |
| QTE04 | POST `/admin/service-visits/:id/quote/decision` | F18 | P3 |
| WRK01 | PATCH `/admin/service-visits/:id/work` | F19 | P3 |
| WRK02 | POST `/admin/service-visits/:id/work/start` | F19 | P3 |
| WRK03 | POST `/admin/service-visits/:id/work/logs` | F19 | P3 |
| WRK04 | POST `/admin/service-visits/:id/work/finish` | F19 | P3 |
| ACP01 | PUT `/admin/service-visits/:id/acceptance` | F20 | P3 |
| ACP02 | POST `/admin/service-visits/:id/acceptance/complete` | F20 | P3 |
| OPS01 | GET `/admin/operations` | F23, F31, F32 | P3 |
| OPS02 | GET `/admin/alerts` | F23, F35 | P3 |
| INV01 | GET `/admin/parts` | F18, F33 | P3 |
| INV02 | GET `/admin/inventory/movements` | F33 | P3 |
| INV03 | GET `/admin/inventory/requests` | F33 | P3 |
| FIN01 | GET `/admin/finance/summary` | F34 | P3 |
| RPT01 | GET `/admin/reports` | F10, F23 | P2 |
| RPT02 | GET `/admin/reports/export` | F23 | P3 |
| NOT01 | GET `/admin/notifications` | F22, F37 | P2 |
| NOT02 | POST `/admin/notifications/:id/read` | F37 | P2 |
| AUD01 | GET `/admin/audit-logs` | F37 | P2 |
| SET01 | GET `/admin/site-settings` | F36 | P1 |
| SET02 | PUT `/admin/site-settings` | F36 | P1 |
| CMS01 | GET `/admin/content` | F38 | P4 |
| CMS02 | POST `/admin/content` | F38 | P4 |
| CMS03 | PATCH `/admin/content/:id` | F38 | P4 |
| CMS04 | POST `/admin/content/:id/publication` | F38 | P4 |
| MEDCMS01 | GET `/admin/media` | F38 | P4 |
| MEDCMS02 | PATCH `/admin/media/:id` | F38 | P4 |
| CAC01 | POST `/customer-access/challenges` | F40 | P5 |
| CAC02 | POST `/customer-access/challenges/verify` | F40 | P5 |
| CAC03 | POST `/customer-access/logout` | F40 | P5 |
| CAC04 | GET `/customer-access/bookings` | F40 | P5 |
| CAC05 | GET `/customer-access/bookings/:id` | F40 | P5 |
| CAC06 | GET `/customer-access/vehicles` | F40 | P5 |
| CAC07 | GET `/customer-access/vehicles/:id/history` | F40 | P5 |
| WAI01 | POST `/public/waitlist` | F40 | P5 |
| WAI02 | GET `/admin/waitlist` | F40 | P5 |
| WAI03 | POST `/admin/waitlist/:id/contact` | F40 | P5 |
| INT01 | GET `/internal/health/live` | F40 | P1 |
| INT02 | GET `/internal/health/ready` | F40 | P1 |

## 4. Hành vi tích hợp chung

| Tình huống | UI cần làm khi nối backend | Dữ liệu không được ghi |
|---|---|---|
| Mở list/search/filter | Debounce phù hợp, abort request cũ, giữ filter URL khi hiện có; scope/filter/count ở server | Không tải toàn bộ khách/lịch để lọc quyền ở browser. |
| Mở detail/drawer | Lấy ID+version+allowedActions; 404 trong scope, không dùng object cache cũ sau transfer | Không coi allowedActions FE là quyền cuối cùng. |
| Lưu form/modal | Validate FE để hỗ trợ; gửi DTO strict+key/version; disable gửi lặp, giữ dữ liệu khi lỗi | Không toast success chỉ vì đã setState. |
| 409 | Refresh đúng detail/availability, cho đối chiếu thay đổi; reschedule thất bại giữ slot cũ | Không tự retry bằng key mới để né capacity/version. |
| Timeout sau submit | Retry cùng key và payload; đối soát kết quả cũ | Không tạo booking thứ2 do key mới tự sinh mỗi click. |
| Loading/empty/error | Spinner/skeleton cho tải; empty khi trả0; error riêng với retry có kiểm soát | Không dùng seed làm fallback giả dữ liệu thật khi API lỗi. |
| Submit thành công | Hiển thị bookingCode/PENDING/reservationHELD, invalidate list/count/slot liên quan | Không tự chuyển confirmed hoặc tự ghi doanh thu. |
| Rời phiên/khóa account | Thu hồi session, clear dữ liệu nhạy cảm cache/local draft theo policy | Không để localStorage là bản sao CRM dùng chung lâu dài. |

## 5. Không chuyển prototype thành dữ liệu thật tự động

Public timer, repository cố vấn, advisor orders, manager state có ID và schema khác nhau. Phải chuyển consumer sang canonical API theo phase, không import localStorage/fixtures khi mở production. Nguồn: [public dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192), [repository:3](../../src/lib/booking/repository.ts#L3), [advisor-provider:18](../../src/components/advisor/advisor-provider.tsx#L18), [manager-provider:43](../../src/components/manager/manager-provider.tsx#L43).

