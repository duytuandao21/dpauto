# Quy trình Phiếu dịch vụ DPAuto V2

## 1. Kết quả triển khai

Luồng áp dụng cho **phiếu tiếp nhận mới**:

**Tiếp nhận → Báo giá → Chờ thi công → Đang thi công → Bàn giao → Hoàn thành.**

Đây là trạng thái lưu và kiểm soát ở backend, không phải chỉ thay nhãn giao diện. Phiếu cũ giữ `workflow_version=1` và các cổng nghiệp vụ V1 để tiếp tục xử lý an toàn; phiếu mới được tạo với `workflow_version=2`.

| Phase                  | Kết quả                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — State machine      | 5 giai đoạn chính, `ABORTED` là ngoại lệ; tạm dừng có thuộc tính riêng; đóng phiếu thì không sửa nghiệp vụ tiếp                              |
| 2 — Báo giá            | Tạo dòng từ dịch vụ tiếp nhận; lưu nháp, xem trước/in PDF; chốt báo giá và ghi nhận khách đồng ý trong một transaction                       |
| 3 — Phát sinh          | Phiên bản `CHANGE_ORDER` riêng, duyệt/từ chối/duyệt một phần, hủy hợp lệ; chỉ tính và cho thực hiện phạm vi được duyệt                       |
| 4 — Thi công           | Bắt đầu không bắt buộc công việc con hoặc kỹ thuật viên cho dịch vụ không yêu cầu; có tạm dừng, tiếp tục, nhật ký                            |
| 5 — Kiểm tra, bàn giao | Kiểm tra nằm trong phiếu; có thể lưu kiểm tra và hoàn tất thi công bằng một thao tác; bàn giao kiểm soát chất lượng, tiền, kho và người nhận |
| 6 — Ngoại lệ           | Từ chối/một phần/phát sinh/làm lại/giảm nghĩa vụ/dừng phiếu/xe quay lại, giữ lịch sử và quyền hiện có                                        |
| 7 — Giao diện          | Chi tiết 3 khu vực, thanh tiến trình 5 bước, danh sách giữ bảng 7 cột; đồng bộ thành phần liên quan ở điều hành                              |
| 8 — Dữ liệu, API       | Migration `0012_service_workflow_v2.sql`, giữ dữ liệu V1, mở rộng endpoint đang có và thêm chốt/hủy báo giá                                  |
| 9 — Xác minh           | Unit/render, integration trên PostgreSQL tạm, TypeScript, Chrome render component và PDF đã chạy; build ghi ở mục 6                          |

## 2. Quy trình sử dụng

| Giai đoạn     | Thông tin và thao tác                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tiếp nhận     | Xác minh khách/xe, ODO hoặc lý do thiếu, yêu cầu thực tế. Tạo đúng một phiếu `QUOTING`; lịch liên kết chuyển `ARRIVED`                                                                                             |
| Báo giá       | Sửa dịch vụ/phụ tùng, số lượng, đơn giá, chiết khấu, VAT và ghi chú. **Chốt báo giá** kèm tên khách, kênh, căn cứ và xác nhận khách thực sự đồng ý → `WAITING_FOR_WORK`                                            |
| Chờ thi công  | Xem hạng mục đã duyệt. **Bắt đầu thi công** → `IN_PROGRESS`; yêu cầu công việc/kỹ thuật viên chỉ khi dịch vụ được cấu hình bắt buộc                                                                                |
| Đang thi công | Theo dõi công việc nếu cần; thêm phát sinh, tạm dừng/tiếp tục. Hoàn tất các công việc đang theo dõi, xác nhận thực hiện đầy đủ phạm vi và các kiểm tra bắt buộc, ghi nhận xét → **Hoàn tất thi công** → `HANDOVER` |
| Bàn giao      | Xem khách/xe, hạng mục, tiền gốc/phát sinh/điều chỉnh/đã thu/còn thu, kho và kết quả kiểm tra. Nhập người nhận, căn cứ giao xe, xác nhận giao thực tế → **Hoàn thành phiếu**                                       |
| Hoàn thành    | `COMPLETED`; lịch liên kết cũng `COMPLETED`. Chỉ xem/in; xe quay lại tạo phiếu mới có liên kết và lý do                                                                                                            |

### Kiểm tra chất lượng

- Dùng lại bảng nghiệm thu và lịch sử cũ. V2 không có giai đoạn kiểm tra/nghiệm thu/sẵn sàng riêng.
- Mặc định theo nhóm: bảo dưỡng kiểm tra hạng mục và an toàn vận hành; chăm sóc xe kiểm tra bề mặt/hoàn thiện; phụ kiện kiểm tra lắp đặt/vận hành; nhóm khác xác nhận hoàn tất công việc.
- Quản lý sửa **Kiểm tra bắt buộc** và **Bắt buộc phân công kỹ thuật viên** trong danh mục dịch vụ. Các mục kiểm tra được chụp lại vào dòng báo giá khi lưu, không bị cấu hình về sau làm thay đổi báo giá đã chốt.
- Kiểm tra không đạt giữ `IN_PROGRESS`, lưu vấn đề và cho làm lại. Kết quả kiểm tra cũ không thay thế được kết quả của phạm vi công việc mới.
- Các mục mặc định là kiểm tra tổng quát; người phụ trách kỹ thuật cần bổ sung checklist chi tiết phù hợp dịch vụ thực tế.

### Phát sinh, từ chối và điều chỉnh

- **+ Thêm phát sinh** tạo phiên bản riêng; ghi lý do trong thao tác tạo và ghi chú báo giá, không sửa báo giá gốc. Có thể in riêng từng phiên bản.
- `DRAFT → PENDING_APPROVAL → APPROVED / REJECTED`; có nhánh `VOIDED`. Trạng thái `SUBMITTED` được giữ cho phiếu V1.
- Khách duyệt một phần: giữ nguyên các dòng và tổng đề xuất; lưu ID dòng đồng ý và giá trị được duyệt riêng. Dòng không duyệt không được thi công hoặc lập yêu cầu kho.
- Khi chờ phát sinh, các hạng mục độc lập đã duyệt vẫn tiếp tục; quyết định phát sinh không tự đưa phiếu về Báo giá hoặc tự tạm dừng.
- Trước khi hoàn tất thi công, mọi bản nháp/chờ duyệt còn mở phải được chốt, từ chối hoặc hủy. Mỗi phiếu mở một phiên bản báo giá tại một thời điểm; các phát sinh tiếp theo được lập tuần tự.
- Hủy báo giá đã duyệt chỉ dành cho quản lý, phải xác nhận chưa thực hiện; backend chặn nếu đã có công việc thực hiện, phụ tùng giữ/xuất chưa xử lý hoặc làm sai nghĩa vụ sau điều chỉnh. Giữ quyết định đồng ý cũ và ghi sự kiện hủy mới.
- Có thể chọn hủy **riêng từng hạng mục chưa thực hiện** sau khi khách đổi ý. Quyết định/báo giá gốc giữ nguyên; sự kiện hủy bất biến loại hạng mục khỏi phạm vi thi công, kiểm tra và kho. Khoản giảm bằng đúng thành tiền dòng sau VAT/chiết khấu, được ghi vào điều chỉnh nghĩa vụ trong cùng transaction. Giảm tiền cần quyền `payments.refund`; request lặp không ghi giảm lần hai. Chứng từ xuất kho cũ không được ghi sổ cho hạng mục đã hủy.
- Phần đã thực hiện dùng nghiệp vụ điều chỉnh tài chính có quyền, lý do/căn cứ; không xóa hoặc sửa khoản thu/hoàn cũ.
- Dừng phiếu chỉ dành cho quản lý: phải đối soát nghĩa vụ, tiền ròng và phụ tùng; giữ lịch sử, chuyển phiếu `ABORTED`, lịch liên kết `CANCELLED`.

### Tính tiền và an toàn

Backend tính VND, VAT và chiết khấu theo `VND_LINE_HALF_UP_V1`. Preview frontend dùng số nguyên `BigInt` và đã đối chiếu với backend. Tổng đề xuất, giá trị gốc/phát sinh đã duyệt, phát sinh chờ, điều chỉnh, phải thu, thu ròng và còn thu được giữ riêng. Bản in phân biệt tổng đề xuất với giá trị thực sự được duyệt.

Tài chính sử dụng `approved_total` của bản duyệt một phần; phiếu cũ dùng tổng cũ khi cột này chưa có giá trị. Kho và thi công dùng view `authorized_quote_lines` chung. Request lặp không cộng thêm tiền hay tạo thêm phiếu. Tiếp tục dùng transaction, khóa/version, idempotency, scope cố vấn và quyền tiền/kho hiện có.

## 3. Tương thích trạng thái cũ

**Migration không ép đổi trạng thái của phiếu cũ.** Bảng dưới là ý nghĩa đối chiếu/lọc; quyền thao tác thực tế vẫn xét phiên bản quy trình và dữ liệu gốc.

| V1              | Ý nghĩa V2 / chính sách xử lý                                                    |
| --------------- | -------------------------------------------------------------------------------- |
| `RECEIVED`      | Báo giá; giữ dữ liệu tiếp nhận và cổng kiểm tra ban đầu V1                       |
| `INSPECTED`     | Báo giá hoặc Chờ thi công tùy báo giá/phạm vi đã duyệt; không tự coi là đã duyệt |
| `IN_PROGRESS`   | Đang thi công; thông tin tạm dừng V1 vẫn nằm ở work order                        |
| `QUALITY_CHECK` | Theo dõi ở nhóm thi công; tiếp tục nghiệm thu V1, không tự coi là đạt            |
| `READY`         | Tương ứng Bàn giao; giữ yêu cầu nghiệm thu hiện hành                             |
| `HANDED_OVER`   | Tương ứng Hoàn thành; giữ bản ghi bàn giao và thời điểm cũ                       |
| `ABORTED`       | Đã dừng, giữ nguyên                                                              |

Các bộ lọc giai đoạn mới nhận cả dữ liệu V1 tương ứng. Phiếu mới dùng trực tiếp các trạng thái V2; các kiểm tra phiếu đóng ở tài chính, kho, nhân sự, vận hành và tiếp nhận xe quay lại đã nhận thêm `COMPLETED`.

## 4. API và migration

Tiền tố API: `/api/v1/`.

| API                                                            | Thay đổi                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `admin/service-visits`, POST `admin/bookings/:id/receive` | Tạo phiếu V2; giữ chống trùng và liên kết lịch                                                                                                       |
| GET `admin/service-visits`, GET `admin/service-visits/:id`     | Bổ sung phiên bản quy trình/tạm dừng; lọc giai đoạn mới và giữ mã cũ                                                                                 |
| GET `admin/service-visits/:id/workflow`                        | Bổ sung hạng mục được phép thực hiện, kiểm tra bắt buộc, tổng tiền gốc/phát sinh và trạng thái phụ                                                   |
| POST `admin/quote-revisions/:id/close`                         | Mới: lưu nháp hiện tại + gửi + ghi nhận đồng ý + chuyển giai đoạn trong cùng transaction; cần quyền sửa và chốt báo giá                              |
| POST `admin/quote-revisions/:id/decision`                      | Thêm `approvedLineIds` cho V2; không sửa bản đã gửi                                                                                                  |
| POST `admin/quote-revisions/:id/void`                          | Mới: hủy hợp lệ; bản đã duyệt cần quản lý và `unperformedConfirmed=true`; `lineIds` cho hủy riêng hạng mục, giảm tiền cần quyền điều chỉnh tài chính |
| POST `admin/service-visits/:id/work/start,pause,resume,finish` | Giữ đường dẫn từng hành động; `finish` nhận `quality` tùy chọn để kiểm tra và hoàn tất cùng transaction                                              |
| POST `admin/service-visits/:id/acceptances`                    | V2 ghi kiểm tra khi đang thi công, không cần giai đoạn nghiệm thu riêng                                                                              |
| POST `admin/service-visits/:id/handover`                       | V2 hoàn thành phiếu và lịch; tiếp tục chặn thiếu tiền/kho/chất lượng/xác nhận giao thực tế                                                           |
| GET `admin/quote-revisions/:id/print`                          | V2 hỗ trợ preview bản nháp đã lưu; bản đã gửi giữ snapshot                                                                                           |
| POST/PATCH `admin/services` / `admin/services/:id`             | Bổ sung `qualityChecks`, `technicianRequired`                                                                                                        |

Migration mới: **`backend/migrations/0012_service_workflow_v2.sql`** và **`backend/migrations/0013_authorized_quote_scope.sql`**. Mở rộng bảng hiện có, không tạo lại/reset database. Thêm view phạm vi được duyệt, giữ các trigger lịch sử/báo giá bất biến và ràng buộc nghiệm thu bàn giao. Agent chỉ chạy migration trên PostgreSQL tạm trong kiểm thử.

### Khắc phục checksum migration 0012 — 14/11/2026

- Kiểm tra chỉ đọc xác nhận database đang dùng đã áp dụng `0012`; file bị bổ sung bộ lọc hạng mục đã hủy sau thời điểm áp dụng. Đã khôi phục file khớp chính xác checksum đã lưu, giữ nguyên lịch sử migration.
- Chuyển bộ lọc bổ sung sang `0013_authorized_quote_scope.sql`, dùng `CREATE OR REPLACE VIEW`; không xóa dữ liệu, không sửa checksum trong database.
- Kiểm thử riêng hủy hạng mục trên PostgreSQL tạm đạt: cả `0012` và `0013` áp dụng thành công, giữ đúng phạm vi thi công, số tiền điều chỉnh và chặn xuất kho hạng mục đã hủy.
- Chưa chạy `0013` trên database đang dùng. Tại thư mục `backend`, chạy `npm run db:migrate`; `0012` sẽ được bỏ qua và chỉ áp dụng `0013`.

### Sao lưu và rollback

1. Trước khi nâng cấp database thật, sao lưu đầy đủ bằng `pg_dump -Fc`, kiểm tra khôi phục vào database riêng và thống kê phiếu đang mở theo trạng thái.
2. Nâng cấp backend/frontend cùng phiên bản sau migration; dừng thao tác ghi trong thời điểm chuyển đổi.
3. Nếu có vấn đề, giữ bản sao database hiện tại để bảo toàn các thao tác mới và ưu tiên bản sửa tương thích V2.
4. Không chạy code cũ lên dữ liệu V2, không ép `HANDOVER/COMPLETED` về enum cũ, không xóa cột quyết định một phần. Code cũ có thể tính sai tiền vì chưa hiểu `approved_total`.
5. Chỉ khôi phục cả code và backup trước nâng cấp khi không có dữ liệu phát sinh sau mốc đó, hoặc đã có phương án đối soát/bảo toàn đầy đủ được duyệt. Không có down-migration tự động gây mất lịch sử.

## 5. File thay đổi chính

- Backend nghiệp vụ: `backend/src/workflow.ts`, **`workflow-v2.ts`**, **`service-workflow.ts`**, `visits.ts`, `workflow-contracts.ts`, `visit-contracts.ts`, `contracts.ts`, `api.ts`, `app.ts`.
- Module phụ thuộc: `catalog.ts`, `finance.ts`, `inventory.ts`, `operations.ts`, `staff.ts`, `legacy.ts`; migration ở mục 4.
- Giao diện: **`src/components/advisor/service-workflow-panel.tsx`**, `live-workflow.tsx`, `live-visits.tsx`, `live-reception.tsx`, `workflow-quote.tsx`, `workflow-work.tsx`, `workflow-print.tsx`, `service-tickets-page.tsx`; `src/styles/advisor.css`.
- Điều hành: `catalog-pages.tsx`, `live-visits.tsx`, `remote-manager-provider.tsx`.
- Kiểu/hàm: `src/lib/api/{visits,workflow,types,operations}.ts`, `src/lib/advisor/service-tickets.ts`, **`quote-preview.ts`**, `src/lib/manager/mock.ts`.
- Kiểm thử: **`backend/test/service-workflow-{state.test,v2.integration.test}.ts`**, **`legacy-visit-fixture.ts`**, các fixture Phase 2–6/booking cũ; **`tests/service-workflow-v2.test.mjs`**, helper render và script kiểm tra Chrome. Helper Chrome có sẵn được tái sử dụng.

Giao diện dùng lại `adm-panel`, `adm-field`, `adm-form-grid`, `adv-tabs`, `adm-btn`, badge, form báo giá, công việc, đối soát, bàn giao và CSS/theme đang có. Không thêm thư viện hoặc đổi palette toàn ứng dụng.

## 6. Kết quả kiểm tra thực tế

| Phạm vi          | Kết quả                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| State machine    | 1 unit test đạt: chỉ chuyển tiếp hợp lệ, không hoàn tất khi tạm dừng                                                                                                                                                                                                                                                                             |
| API V2           | 10 integration tests khác nhau đạt: báo giá/một phần/bất biến/quyền; phát sinh; chất lượng/thu tiền/bàn giao/xe quay lại; đặt lịch–tiếp nhận–hoàn thành/concurrency; kho/dừng; snapshot cấu hình/V1; schema/preview/tính tiền; hủy báo giá; hủy hạng mục/giảm tiền/chặn xuất kho cũ; quản lý thiếu quyền tiền bị từ chối và không ghi dở dữ liệu |
| Hồi quy V1       | 2 integration tests đạt: toàn bộ giai đoạn/ngoại lệ và bàn giao có thu tiền, kho, nghiệm thu, điều chỉnh/hoàn/dừng                                                                                                                                                                                                                               |
| Frontend         | 10 unit/render tests khác nhau đạt, gồm bảng phiếu, 5 giai đoạn, 3 khu vực, quyền thao tác/điều chỉnh, preview VND, nhãn tiếng Việt và bản in duyệt một phần                                                                                                                                                                                     |
| TypeScript       | Backend và frontend đạt tại mốc kiểm tra; các chỉnh sửa tiếp theo được rà tĩnh và build frontend ở dưới                                                                                                                                                                                                                                          |
| Chrome           | 9 cấu hình form ở 390/820/1440px sáng/tối đạt phép đo không tràn ngang/chồng control, gồm mở form hủy hạng mục của quản lý; đã xem ảnh mobile, tablet và desktop                                                                                                                                                                                 |
| Bản in           | Render component bản in thật, xem ảnh và xuất PDF báo giá duyệt một phần bằng Chrome; phân biệt 1.650.000đ đề xuất và 1.100.000đ được duyệt                                                                                                                                                                                                      |
| Production build | `npm.cmd run build` đạt, sinh 55 trang. Lượt đầu phát hiện tham chiếu tùy chọn đã bỏ, sửa và build lại đạt. Guard ẩn nút theo quyền tài chính bổ sung sau đó đã qua render test và rà tĩnh, không chạy lại build đã đạt                                                                                                                          |

Các ca thất bại được sửa và chạy lại riêng: validation kỹ thuật viên tùy chọn; thứ tự kiểm tra cùng thời điểm; fixture quyền/khách/xe/payload; database tạm dùng chung giữa hai file; bộ đo control trong `details` đóng. Lượt bổ sung cho ca xe quay lại đã được bạn duyệt. Không còn lỗi kiểm thử đã biết chưa xử lý ở các ca nêu trên.

Bằng chứng: [kết quả Chrome](docs/qa/service-workflow-v2/browser-results.json), [form thi công mobile](docs/qa/service-workflow-v2/work-390-light.png), [tablet tối](docs/qa/service-workflow-v2/work-820-dark.png), [bàn giao desktop tối](docs/qa/service-workflow-v2/handover-1440-dark.png), [bản in](docs/qa/service-workflow-v2/quote-print-1440-light.png), [PDF](docs/qa/service-workflow-v2/quote-partial-approval.pdf).

Ảnh form lưu tại mốc rà bố cục; một số tinh chỉnh nhãn/bỏ tùy chọn không cần thiết và bổ sung danh sách hạng mục bàn giao sau đó được rà tĩnh, không chạy lại những phép đo đã đạt.

## 7. Giới hạn và phần chưa xác minh

- Chưa chạy E2E Playwright sau đăng nhập: workspace không cài Playwright. Chrome ở trên render component cùng CSS/font thật với fixture riêng, không phải toàn ứng dụng kết nối API. Luồng API dùng PostgreSQL tạm và server inject thực tế.
- Chưa thử trên điện thoại thật, máy in thật hoặc kiểm thử tải lớn. Không chạy lại toàn bộ test suite các module không liên quan.
- Chưa chuyển đổi hàng loạt phiếu V1 đang mở sang V2; cố ý giữ quy trình V1 để không bỏ qua cổng kiểm soát cũ.
- Đã bổ sung trang in tổng hợp báo giá và phát sinh ở đợt chỉnh sửa giao diện bên dưới; đường dẫn có `revision` vẫn phục vụ đối chiếu từng lần xác nhận.
- Driver PostgreSQL có cảnh báo deprecation về concurrent query hiện có; không nâng cấp dependency trong nhiệm vụ này.
- Không sửa `.env`, không triển khai production, không migrate/ghi dữ liệu vào database đang dùng, không dừng frontend/backend của bạn.

## 8. Chạy development

Từ thư mục dự án, bảo đảm `backend/.env` trỏ tới database **development** cần nâng cấp, sao lưu trước rồi chạy:

```powershell
npm.cmd --prefix backend run db:migrate
npm.cmd --prefix backend run dev
```

Terminal khác:

```powershell
npm.cmd run dev
```

Nếu chạy bản production tại máy: build lại frontend rồi `npm.cmd start`; backend dùng bản build tương ứng nếu chạy `npm.cmd --prefix backend start`.

Thử một lịch mới: **đặt lịch → chốt lịch → tiếp nhận → tạo/sửa báo giá → chốt báo giá → bắt đầu thi công → kiểm tra và hoàn tất → thu tiền/xuất phụ tùng theo quyền → hoàn thành phiếu**. Thêm một phát sinh rồi thử đồng ý/từ chối; kiểm tra lịch liên kết chỉ hoàn thành sau khi giao xe.

Lệnh kiểm thử để chạy lại khi cần (mỗi file integration dùng PostgreSQL tạm riêng):

```powershell
node --test tests/service-workflow-v2.test.mjs tests/service-tickets.test.mjs
cd backend
node --import tsx scripts/test-phase1.ts test/service-workflow-v2.integration.test.ts
```

Chrome phục vụ rà component và PostgreSQL tạm đã được các bộ chạy đóng/dọn sau kiểm thử.

## 9. Báo giá trên một màn hình — 14/11/2026

- Tái sử dụng `WorkflowQuote`, `EvidenceFields`, `quotePreview`, form/nút/badge/theme hiện có. Bỏ điều hướng số phiên bản trong quy trình V2; mở phần đang soạn hoặc chờ khách duyệt tự động, kể cả đường dẫn cũ có `revision`.
- Gom dịch vụ và phụ tùng vào hai bảng với diễn giải, đơn vị, số lượng, đơn giá, chiết khấu, VAT và thành tiền. Đơn giá nhập có dấu phân cách hàng nghìn; backend vẫn nhận số nguyên theo hợp đồng cũ.
- Hạng mục đã chốt nằm cùng bảng, chỉ đọc. Phát sinh được thêm ngay tại đây, chốt riêng bằng **Chốt báo giá**; khoản đang soạn/chờ duyệt chưa vào tiền phải thu. Căn cứ khách đồng ý vẫn bắt buộc; khóa phần chỉnh hạng mục trong lúc xác nhận chốt, quay lại để sửa nếu cần.
- Lưu lịch sử xác nhận và hủy trong phần thu gọn, giữ quyền tài chính, chống sửa đè và xử lý hạng mục đã thi công. Không sửa nghiệp vụ tính tiền hay xóa lịch sử phiên bản bên dưới.
- Trang in mặc định của V2 tổng hợp báo giá đã chốt cùng phát sinh đang mở; đánh dấu chưa duyệt, không duyệt và đã hủy, phân biệt tổng đề xuất với tổng đã chốt sau điều chỉnh. Bản in từng lần xác nhận theo đường dẫn cũ vẫn dùng được.
- Migration mới **`0014_quote_line_description.sql`** chỉ thêm diễn giải mỗi dòng, mặc định rỗng cho dữ liệu cũ. Cập nhật API lưu/đọc/in và sao chép báo giá bị từ chối; payload cũ vẫn hợp lệ. Chưa chạy migration trên database đang dùng.

### Kiểm tra riêng đợt báo giá

- TypeScript frontend/backend đạt; 8 unit/render tests trong file quy trình V2 đạt.
- 1 integration test PostgreSQL tạm đạt: giới hạn diễn giải không ghi dở, chốt ban đầu/phát sinh, giữ nguyên dòng đã duyệt, khoản nháp không tăng tiền phải thu, bản in giữ diễn giải, kiểm tra quyền và sao chép khi khách từ chối.
- Chrome render component tại 390px sáng, 820px tối, 1280px sáng, 1440px tối: không tràn trang hoặc ô nhập chồng nhau; đã xem ảnh mobile/desktop. Khi vùng bảng hẹp, chuyển thành thẻ thay vì ép chữ nhỏ/cuộn ngang. Các tinh chỉnh cuối về tiêu đề, fieldset xác nhận, nhãn hủy và ngắt dòng tiền được rà tĩnh; không chạy lại kiểm tra đã đạt.
- Bằng chứng: `docs/qa/service-workflow-v2/quote-unified-*.png` và `browser-results.json`. Chưa E2E sau đăng nhập hoặc xuất PDF tổng hợp trên máy in thật; không chạy production build hay toàn bộ test suite.

Áp dụng trên database development cần nâng cấp: `npm.cmd --prefix backend run db:migrate`, sau đó khởi động lại backend. Nếu dùng frontend production tại máy, cần tự build lại trước `npm start`.
