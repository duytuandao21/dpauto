# Phase 3 — Báo giá, thi công, nghiệm thu và bàn giao

> Cập nhật 13/11/2026: [Phase 4](phase4-implementation.md) đã bổ sung kho, thu/cọc/hoàn/đảo, điều chỉnh giảm và bàn giao phiếu đã đối soát. Các giới hạn “chờ Phase 4” bên dưới mô tả thời điểm triển khai Phase 3; hợp đồng Phase 4 thay thế chúng cho phiên bản hiện tại.

Triển khai ngày 12/11/2026, tiếp nối [Phase 2](phase2-implementation.md). Giao diện API dùng flag hiện có `NEXT_PUBLIC_API_ENABLED=true`, session và phân quyền của backend. Giữ các component, theme, responsive và mẫu in đang có; không thêm thư viện hoặc biến môi trường.

## Quyết định nghiệp vụ

- Theo xác nhận của chủ dự án: **phiếu có tiền phải thu bị chặn bàn giao, hoàn thiện đối soát ở Phase 4**. Không có thao tác tự ghi đã thu hoặc cho nợ để vượt điều kiện này.
- Báo giá VND có các bản `DRAFT → SUBMITTED → APPROVED/REJECTED`. Bản gửi khách khóa nội dung và snapshot thông tin trạm/khách/xe. Quyết định phải nêu người xác nhận, kênh, nội dung và tùy chọn ảnh thuộc chính phiếu.
- Sau khi từ chối có thể lập lại từ bản cũ. Sau khi duyệt, bản mới là **phát sinh bổ sung**, cộng nghĩa vụ với các bản đã duyệt; không thay thế hoặc xóa nghĩa vụ trước. Chưa hỗ trợ giảm/hủy một phần phạm vi đã duyệt, hoàn tiền hoặc điều chỉnh ledger; những thay đổi đó cần Phase 4.
- Dịch vụ phải chọn từ catalog có resource plan và số lượng 1; snapshot plan được giữ trên dòng báo giá. Muốn thay khối lượng định mức phải cấu hình gói thực phù hợp, không tăng số lượng rồi giữ nguyên năng lực. Phụ tùng có thể nhập mô tả và số lượng lẻ; chưa coi báo giá là xuất kho.
- Công việc dự kiến có thể chưa liên kết báo giá, nhưng bắt đầu thi công cần liên kết dòng dịch vụ đã duyệt hoặc phạm vi miễn phí do quản lý duyệt. Một việc có nhiều KTV hoạt động, có thời hạn và lịch sử phân công. Không tự tạo tài khoản KTV.
- Miễn phí toàn phiếu không báo giá và công việc miễn phí bổ sung là hai trường hợp riêng. Chỉ quản lý có quyền duyệt ngoại lệ, phải ghi phạm vi, lý do và căn cứ.
- Thi công `NOT_STARTED → IN_PROGRESS ↔ PAUSED → FINISHED`. Phiếu chuyển `INSPECTED → IN_PROGRESS → QUALITY_CHECK → READY → HANDED_OVER`. Các công việc thực tế, trạng thái kỹ thuật, nghiệm thu, bàn giao và tài chính được lưu riêng.
- Nghiệm thu yêu cầu đúng tập công việc hiện tại, người kiểm tra, từng kết quả và nhận xét. Không đạt trả việc lỗi về xử lý và tăng phiên bản phạm vi; giữ các lần nghiệm thu cũ. Phát sinh được duyệt hoặc thay kế hoạch cũng làm nghiệm thu trước mất hiệu lực đối với phạm vi mới.
- Bàn giao cần phiếu READY, nghiệm thu đạt còn hiệu lực, nghĩa vụ được xác định bằng 0, không có dòng phụ tùng đã duyệt chờ đối soát và xác nhận xe đã rời tài nguyên. Chỉ thao tác bàn giao đổi booking liên quan từ ARRIVED sang COMPLETED. `COMPLETED` không mang nghĩa đã thanh toán.
- Có thể trả khu vực thi công khi READY bằng thao tác và xác nhận riêng; xe vẫn chờ bàn giao. Quản lý được dừng phiếu miễn phí/chưa phát sinh nghĩa vụ sau khi ghi căn cứ và đưa xe ra ngoài. Phiếu có nghĩa vụ thu hoặc phụ tùng phải chờ xử lý tài chính/kho, không xóa lịch sử để đóng.
- Xe quay lại tạo lượt tiếp nhận mới với `followUpOfVisitId/followUpReason`, không reopen phiếu cũ.

## Tiền và làm tròn

Policy cố định `VND_LINE_HALF_UP_V1`; số tiền truyền bằng chuỗi số nguyên VND, quantity tối đa 3 chữ số thập phân, tỷ lệ tối đa 2. Tính bằng BigInt, lưu PostgreSQL numeric, không dùng số thực cho tiền.

Mỗi dòng: làm tròn `quantity × unitPrice` tới đồng → chiết khấu dòng → chiết khấu chung trên phần còn lại → thuế trên giá sau chiết khấu → thành tiền. Mỗi bước làm tròn half-up; tổng chứng từ là tổng các dòng. Chặn số âm, tỷ lệ ngoài 0–100 và vượt miền numeric. Thuế suất do người lập nhập rõ; đây là cách tính báo giá, chưa phải xác định chế độ thuế hoặc phát hành hóa đơn kế toán.

## Tài nguyên thực tế

- Bắt đầu/tiếp tục thi công lập lại kế hoạch bằng các snapshot dịch vụ đã duyệt; phiếu miễn phí không báo giá dùng snapshot dịch vụ tiếp nhận. Reservation được thay thế trong transaction, bỏ qua chính giữ chỗ cũ khi tính; không trừ capacity hai lần.
- Ghi nhận `resource_occupancies` riêng với thời điểm thực vào, dự kiến trả và thực trả. Exclusion/unique chống hai xe thực chiếm một tài nguyên. Không tự chuyển một xe đang chiếm tài nguyên sang vị trí khác khi planner chọn khác.
- Gia hạn kiểm tra giữ chỗ của xe/lịch khác, lịch khóa và occupancy. Xe quá giờ tiếp tục chặn tiếp nhận mới trên tài nguyên đó, không tự giải phóng theo đồng hồ. Manager xem các lịch có nguy cơ trùng trong 7 ngày tới rồi điều chỉnh lịch liên quan trước.
- Policy không được thay footprint khi còn occupancy mở; khóa lịch không được đè thời gian xe thực đang chiếm. Bật/tắt nhận lịch với footprint không đổi vẫn dùng hành vi hiện có.
- Giữ cách cấp phát bảo thủ: lập lại toàn bộ phạm vi dịch vụ đã duyệt, không tối ưu theo phần công việc còn lại. Chưa có luồng tự động di chuyển xe đang làm giữa các cầu.

## API bổ sung

Prefix `/api/v1`; mutation có `Idempotency-Key`, CSRF, `expectedVersion` của **visit** và `reason`. Receipt chỉ chứa ID, version, stage, event và các tham chiếu; replay kiểm tra owner hiện hành. Tất cả truy cập quote/work/print/acceptance đều scope qua visit. Manager xem trong trạm, cố vấn xem phiếu đang phụ trách.

| Method | Path                                          | Nội dung / quyền                                                            |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/admin/service-visits/:id/workflow`          | Báo giá, công việc, nghiệm thu, occupancy, bàn giao; `visits.read`          |
| GET    | `/admin/quotes`                               | `q,status,limit,cursor`; `quotes.read`                                      |
| POST   | `/admin/service-visits/:id/quotes`            | `baseRevisionId?`; `quotes.write`                                           |
| PATCH  | `/admin/quote-revisions/:id`                  | Policy, dòng, tỷ lệ CK chung, ghi chú; `quotes.write`                       |
| POST   | `/admin/quote-revisions/:id/submit`           | Cố định bản gửi khách; `quotes.write`                                       |
| POST   | `/admin/quote-revisions/:id/decision`         | APPROVED/REJECTED + evidence; `quotes.decide`                               |
| GET    | `/admin/quote-revisions/:id/print`            | Snapshot bản đã gửi, không giá vốn; `quotes.read`                           |
| GET    | `/admin/acceptances/:id/print`                | Snapshot biên bản và người kiểm tra; `visits.read`                          |
| POST   | `/admin/service-visits/:id/work-exemptions`   | NO_QUOTE_FREE/FREE_TASKS + scope/evidence; manager, `work.exempt`           |
| POST   | `/admin/service-visits/:id/work-items`        | Label, căn cứ tùy chọn, KTV[], dueAt; `work.write`                          |
| PATCH  | `/admin/work-items/:id`                       | Chỉnh việc chưa bắt đầu; `work.write`                                       |
| POST   | `/admin/work-items/:id/progress`              | IN_PROGRESS/DONE; SKIPPED chỉ manager với việc chưa thực hiện; `work.write` |
| POST   | `/admin/service-visits/:id/work/start`        | Kiểm tra phạm vi, KTV, replan và occupancy; `work.write`                    |
| POST   | `/admin/service-visits/:id/work/pause`        | Tạm dừng có lý do; `work.write`                                             |
| POST   | `/admin/service-visits/:id/work/resume`       | Kiểm tra lại phạm vi, tài nguyên, KTV; `work.write`                         |
| POST   | `/admin/service-visits/:id/work/finish`       | Đủ công việc → chờ nghiệm thu; `work.write`                                 |
| POST   | `/admin/service-visits/:id/work/log`          | Note, workItemId tùy chọn; `work.write`                                     |
| POST   | `/admin/service-visits/:id/acceptances`       | Inspector, checklist, kết quả, nhận xét; `acceptance.record`                |
| POST   | `/admin/service-visits/:id/ready`             | Nghiệm thu hiện tại đạt; `visits.handover`                                  |
| POST   | `/admin/service-visits/:id/handover`          | Recipient/evidence/vehicleMoved, NO_CHARGE; `visits.handover`               |
| POST   | `/admin/service-visits/:id/abort`             | Căn cứ và vehicleMoved; manager, `visits.abort`                             |
| POST   | `/admin/service-visits/:id/resources/extend`  | expectedEndAt, tối đa 7 ngày; `work.write`                                  |
| POST   | `/admin/service-visits/:id/resources/release` | vehicleMoved, chỉ READY; `visits.handover`                                  |
| GET    | `/admin/resource-conflicts`                   | Xung đột occupancy với lịch sắp tới, paging; manager, `capacity.read`       |

`GET /admin/service-visits` bổ sung các stage mới và `activeOnly=true` cho điều phối. `GET /admin/staff?jobRole=TECHNICIAN&active=true` cho cố vấn chỉ trả định danh/tên/chức danh/trạng thái/version KTV, không tài khoản, email hoặc SĐT. Không tắt KTV khi còn công việc chưa xong của phiếu mở.

Lỗi chính: `QUOTE_LOCKED`, `QUOTE_OPEN_REVISION`, `QUOTE_REVISION_CONFLICT`, `QUOTE_PENDING`, `WORK_NOT_AUTHORIZED`, `APPROVED_SCOPE_INCOMPLETE`, `TECHNICIAN_REQUIRED/UNAVAILABLE/BUSY`, `WORK_INCOMPLETE`, `ACCEPTANCE_REQUIRED/INCOMPLETE/RESULT_MISMATCH`, `RESOURCE_CONFLICT/OCCUPIED/MOVE_REQUIRED`, `FINANCE_NOT_AVAILABLE`, `STOCK_SETTLEMENT_REQUIRED`, `ABORT_SETTLEMENT_REQUIRED`, cùng VERSION_CONFLICT/validation/scope hiện có. Lỗi rollback toàn bộ mutation, không cập nhật trạng thái thành công ở UI.

## Schema và giao diện

Migration mới `0003_workflow.sql`: 12 bảng `quote_revisions`, `quote_lines`, `quote_decisions`, `work_orders`, `work_exemptions`, `work_items`, `work_item_assignments`, `work_logs`, `acceptances`, `acceptance_checks`, `visit_handovers`, `resource_occupancies`. Tổng sau Phase 3: **51 bảng nghiệp vụ + 1 metadata migration, 82 endpoint**. Không sửa migration đã có.

- Chi tiết phiếu `/co-van/phieu-dich-vu/[id]` và `/dieu-hanh/phieu-dich-vu/[id]` dùng cùng component API cho 4 tab. Draft chỉ giữ trong bộ nhớ, không ghi PII vào localStorage; lỗi version giữ form cho người dùng xử lý, có cảnh báo trước khi rời phần chưa lưu.
- `/dieu-hanh/bao-gia` tra các bản báo giá với cursor/filter; `/dieu-hanh/dieu-phoi` xem phiếu đang mở và cảnh báo tài nguyên thật. Không trộn dữ liệu local vào API.
- Cả hai khu vực có `/phieu-dich-vu/[id]/in-bao-gia?revision=...` và `/in-nghiem-thu?acceptance=...`. Đối chiếu bản thuộc phiếu trước khi tải endpoint print; bản in không có URL công khai chứa dữ liệu khách.

## Cập nhật môi trường đang dùng Phase 2

Sao lưu theo quy trình vận hành trước khi cập nhật database thật. Trong `backend` chạy `npm.cmd run db:migrate` để áp dụng migration mới; **không chạy lại bootstrap** cho trạm đã có tài khoản. Build/restart theo quy trình deploy của dự án khi được duyệt. Không có lệnh nào trong bước phát triển này chạy lên database công ty hoặc đổi `.env`.

## Xác minh và giới hạn

- Backend TypeScript và frontend TypeScript đạt; kiểm thử tiền 2 ca và adapter báo giá 1 ca đạt.
- API/DB PostgreSQL tạm: **10/10 ca đã đạt**, cộng dồn các lượt kiểm thử có chọn lọc; không chạy lại các ca đã đạt. Bao phủ snapshot/revision/phát sinh, evidence/scope/replay sau transfer, guard công việc/KTV/counters, nghiệm thu/làm lại, bàn giao miễn phí và chặn phiếu có tiền phải thu, trả tài nguyên riêng, ngoại lệ miễn phí/dừng phiếu, gia hạn/xung đột quá giờ, bản in riêng tư và bảo vệ lịch sử bất biến.
- Sau khi được chủ dự án cho phép tiếp tục kiểm thử, 6 ca còn lỗi đã được xác nhận đạt với sửa ép kiểu timestamp trong CASE cập nhật tiến độ. Ca cuối cần sửa fixture đăng nhập lại sau khi tăng đồng hồ giả lập hai giờ; giữ nguyên chính sách hết hạn phiên. Cũng xác nhận danh sách phiếu mở, tiến độ kiểm tra ban đầu và chặn đổi policy/khóa lịch đè occupancy thực. Database tạm đã dừng và được dọn sau kiểm thử.
- Chưa chạy full suite, E2E/browser, production build, migration DB thật, import CRM hoặc deploy. Responsive được rà bằng component/CSS hiện có, chưa xác minh hình ảnh trên thiết bị.
- Chưa thay thế CRM vận hành: kho, thanh toán, đặt cọc/hoàn tiền/công nợ, hóa đơn và đối soát phụ tùng thuộc Phase 4; portal/link khách duyệt công khai, chữ ký số và quick quote không visit chưa được mở.
