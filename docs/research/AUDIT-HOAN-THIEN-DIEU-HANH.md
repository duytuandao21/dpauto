# Audit và hoàn thiện UI/UX điều hành DPAuto

Ngày thực hiện: 11/11/2026. Phạm vi: frontend `/dieu-hanh`.

Tham chiếu nghiệp vụ: `docs/research/KHAO-SAT-CRM-DPAUTO.md`, các phần vai trò, lịch hẹn, capacity và service visit trong `technical-documentation/BUSINESS_RULES.md` và `API_SPEC.md`; source `/co-van` dùng để tìm kiểu dữ liệu và thành phần phù hợp. Báo cáo CRM cũ được khảo sát bằng tài khoản CVDV, không xác nhận các quyền quản lý chưa truy cập được.

Người dùng đã xác nhận giữ giao diện CoreUI hiện tại và một thông báo mô phỏng dùng chung cho toàn khu vực. Không quay lại phối đỏ–trắng trong file yêu cầu gốc.

## A. Audit hiện trạng và kết quả

| Chức năng                         | Đã có trước nhiệm vụ                                               | Thiếu / vấn đề ban đầu                                     | Đã bổ sung                                                                                                                                               | File liên quan / ghi chú                                       |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Layout, header, sidebar, sáng/tối | Đã hoạt động, đã phối CoreUI                                       | Menu chưa có các màn hình vận hành garage                  | Giữ hệ thống style; thêm menu có route thực và một nhãn dữ liệu dùng chung                                                                               | `manager-shell.tsx`, `mock.ts`, layout điều hành               |
| Dashboard                         | KPI lịch, biểu đồ, bảng cần xử lý                                  | KPI chưa bấm được; cảnh báo là mảng cố định                | KPI liên kết có filter; KPI giai đoạn xe, quá hạn, khung đầy; cảnh báo lấy từ trạng thái hiện tại                                                        | `dashboard.tsx`, `operational-overview.tsx`, `alerts-page.tsx` |
| Lịch toàn trạm                    | Danh sách, lịch ngày/tuần, search, trạng thái, dịch vụ, phân trang | Chưa lọc CVDV/nhóm/khoảng ngày/thay đổi                    | Thêm các bộ lọc; nhận query từ KPI/cảnh báo; mobile xem danh sách thay lịch tuần desktop                                                                 | `bookings-page.tsx`                                            |
| Chi tiết lịch                     | Drawer, thông tin khách/xe, phân công                              | Chưa xác nhận, đổi giờ, hủy; chuyển giao chưa có lý do     | Lý do bắt buộc; khách đồng ý khi xác nhận/đổi giờ; kiểm tra trạng thái, giờ, ngày nghỉ và năng lực; nhật ký trước/sau                                    | `booking-list.tsx`, `rules.ts`                                 |
| Giữ chỗ                           | Chỉ số snapshot rời rạc                                            | Chưa có liên kết phần nguồn lực giữ với từng lịch          | Fixture có holds theo lịch; pending giữ ngay; xác nhận không giữ hai lần; đổi chuyển giữ chỗ trong một cập nhật local; hủy giải phóng đúng phần của lịch | `mock.ts`, `rules.ts`                                          |
| Năng lực                          | Thẻ nguồn lực / filter ngày, nhóm                                  | Đổi ngày chỉ đổi tiêu đề; nút cấu hình chỉ báo đã ghi nhận | Dữ liệu theo ngày/nhóm; cập nhật năng lực thực trong phiên; khóa/mở; ngày nghỉ; số nguồn lực thiếu và lịch bị ảnh hưởng                                  | `capacity-page.tsx`                                            |
| Điều phối xe                      | Chưa có                                                            | Thiếu giám sát toàn trạm                                   | Kanban đặt lịch → tiếp nhận → báo giá → thi công → nghiệm thu → hoàn tất; mobile chuyển card; bộ lọc CVDV/KTV/ngày/ưu tiên                               | `operations-page.tsx`, `/dieu-phoi`                            |
| Phiếu dịch vụ                     | Có ở CVDV, chưa có tại điều hành                                   | Không có danh sách toàn trạm                               | Danh sách có search/filter, tiến độ, deadline, giá trị, thanh toán và drawer dùng chung                                                                  | `/phieu-dich-vu`, `order-drawer.tsx`                           |
| Báo giá                           | Có editor thuộc context CVDV                                       | Thiếu giám sát toàn trạm                                   | Danh sách nháp/chờ/đã chốt/từ chối/có điều chỉnh; người lập; CK, VAT; lịch sử người sửa, thời gian, nội dung, giá trước/sau                              | `/bao-gia`, `order-drawer.tsx`                                 |
| Thi công                          | Có editor CVDV                                                     | Chưa có góc nhìn quản lý                                   | Đọc KTV, checklist, progress, bắt đầu/dự kiến, lý do đình trệ, nhật ký; phân công KTV/CVDV có lý do và cảnh báo tải                                      | Tab Thi công / Tổng quan trong drawer                          |
| Nghiệm thu                        | Có editor CVDV                                                     | Thiếu theo dõi ở điều hành                                 | Kết quả đạt/chưa kiểm tra/cần làm lại; người/thời gian; checklist; điều kiện chưa đủ; thanh toán hiển thị độc lập                                        | Tab Nghiệm thu trong drawer                                    |
| Nhân sự                           | Hồ sơ quản lý/CVDV, thêm/sửa, active                               | Thiếu KTV, tải, ca/nghỉ/khả dụng                           | Thêm vai trò công việc KTV, số xe/việc/quá hạn, liên kết phân công; ca theo ngày/vai trò, ngày nghỉ, kiểm tra trùng ca                                   | `catalog-pages.tsx`, `staff-schedule.tsx`                      |
| Khách hàng và xe                  | Search, hồ sơ, lịch sử đặt lịch                                    | Chưa thấy phiếu dịch vụ thực tế                            | Deep link hồ sơ từ lịch; phiếu thực tế tách khỏi lịch hẹn, mở drawer nghiệp vụ                                                                           | `customers-page.tsx`                                           |
| Kho / phụ tùng                    | Chưa có                                                            | Thiếu giám sát nguồn lực                                   | Tồn/định mức/nhà cung cấp; nhập/xuất; nhu cầu, đã xuất, còn cần theo phiếu                                                                               | `/kho`, `resource-pages.tsx`                                   |
| Tài chính                         | Chưa có                                                            | Chưa giám sát tiền / nợ                                    | Giá trị báo giá đã chốt, cọc, thu thêm, còn phải thu; filter CVDV/ngày tiếp nhận/nợ; cơ cấu dịch vụ/phụ tùng                                             | `/tai-chinh`, `resource-pages.tsx`                             |
| Báo cáo                           | KPI và CSV lịch hẹn                                                | Chưa có số xe, thời gian xử lý, hiệu suất                  | Thêm hoàn tất/tiếp nhận, tỷ lệ đến, xe quá hạn, thời gian có mốc hợp lệ, tải nhân sự, giá trị báo giá theo ngày; mở rộng CSV                             | `dashboard.tsx`, `operational-overview.tsx`                    |
| Thông báo / cảnh báo              | Thông báo và cảnh báo hardcode, retry Zalo local                   | Dễ trùng, có thông báo thành công gây hiểu lầm             | Một selector cảnh báo; dashboard xem tóm tắt, route riêng xem/lọc; thông báo lấy sự kiện; kiểm tra Zalo không giả vờ đã gửi                              | `operations.ts`, `alerts-page.tsx`, `system-pages.tsx`         |
| Cấu hình / website / nhật ký      | Form, modal, danh sách hoạt động local                             | Bảng mobile cần cuộn ngang; toast không nói phạm vi lưu    | Giữ các chức năng; tái sử dụng bảng chuyển card mobile; toast nói rõ phiên hiện tại                                                                      | `manager-ui.tsx`, `manager-provider.tsx`, các trang hiện có    |
| Loading / empty / error           | Loading, empty có sẵn                                              | Thiếu route error, query bản ghi sai bị im lặng            | Error boundary có thử lại; empty filter; drawer không tìm thấy; ngày query không hợp lệ có fallback                                                      | `error.tsx`, các drawer và trang filter                        |

## B. Những gì đã triển khai

### Route mới

- `/dieu-hanh/dieu-phoi`: Kanban giám sát, không kéo thả trạng thái nghiệp vụ.
- `/dieu-hanh/phieu-dich-vu`: danh sách toàn trạm và chi tiết.
- `/dieu-hanh/bao-gia`: giám sát báo giá và điều chỉnh.
- `/dieu-hanh/canh-bao`: trung tâm cảnh báo tập trung.
- `/dieu-hanh/kho`: giám sát tồn kho, chứng từ và nhu cầu vật tư.
- `/dieu-hanh/tai-chinh`: giá trị đã chốt, tiền đã nhận và công nợ.

### Tái sử dụng

Giữ `ManagerProvider`, `ManagerModal`, `ManagerPanel`, `ManagerField`, `FilterSelect`, `ManagerSearch`, `ManagerPager`, `StatusBadge`, `AdminIcon` và hệ thống CoreUI sáng/tối hiện tại. Kiểu phiếu kế thừa `ServiceOrder` của CVDV; phép tính báo giá dùng `quoteTotals`, định dạng tiền dùng `formatMoney`; mã local dùng helper `createDemoId` có fallback cho truy cập HTTP bằng IP.

`ManagerTable` mở rộng nhóm UI chung của điều hành: suy ra nhãn ô từ header để chuyển bảng thành card mobile, không tạo một bộ dữ liệu riêng cho mobile. Drawer phiếu được dùng chung từ danh sách, Kanban, báo giá, kho, tài chính và hồ sơ khách.

### Dữ liệu và thao tác

- Fixture nằm riêng trong `mock.ts` và `operations-seed.ts`; selectors/quy tắc local ở `operations.ts` và `rules.ts`.
- `pending`, trạng thái thi công và thanh toán là các trường riêng. Phiếu hoàn tất vẫn có thể còn nợ; báo giá chưa chốt không bị ghi nhận thành công nợ chắc chắn.
- Bộ lọc và KPI mở đúng route/query. Không thêm menu trang trắng.
- Cập nhật vẫn chỉ nằm trong state của phiên; tải lại trình duyệt sẽ tạo lại fixture. Thông báo thành công ghi rõ phạm vi phiên, không giả lập một request lưu server.
- Không thay đổi giao diện public, CVDV, backend, database, đăng nhập hoặc quyền API.

## C. Danh sách file

Đường dẫn dưới đây tính từ gốc dự án.

| File                                                                                  | Tạo / sửa  | Mục đích                                                                               |
| ------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `src/lib/manager/operations.ts`                                                       | Tạo        | Kiểu dữ liệu vận hành, tổng tiền, trạng thái thanh toán, workload và selector cảnh báo |
| `src/lib/manager/operations-seed.ts`                                                  | Tạo        | Fixture phiếu, báo giá, kho, ca làm tách khỏi logic                                    |
| `src/lib/manager/rules.ts`                                                            | Tạo        | Validation và chuyển holds khi xác nhận/đổi/hủy lịch local                             |
| `src/lib/manager/mock.ts`                                                             | Sửa        | Mở rộng dữ liệu, holds, nguồn lực theo ngày/nhóm, nhân sự KTV và menu                  |
| `src/components/manager/operations-page.tsx`                                          | Tạo        | Một màn hình dùng chung cho Kanban/danh sách phiếu/báo giá                             |
| `src/components/manager/order-drawer.tsx`                                             | Tạo        | Chi tiết tổng quan/báo giá/thi công/nghiệm thu/lịch sử và phân công                    |
| `src/components/manager/alerts-page.tsx`                                              | Tạo        | Trung tâm và danh sách cảnh báo dùng chung                                             |
| `src/components/manager/resource-pages.tsx`                                           | Tạo        | Giám sát tài chính và kho                                                              |
| `src/components/manager/staff-schedule.tsx`                                           | Tạo        | Lịch làm việc, khả dụng và chỉnh ca                                                    |
| `src/components/manager/operational-overview.tsx`                                     | Tạo        | KPI và báo cáo vận hành                                                                |
| `src/components/manager/booking-list.tsx`                                             | Sửa        | Lý do phân công, thao tác lịch và hồ sơ khách                                          |
| `src/components/manager/bookings-page.tsx`                                            | Sửa        | Filter/query và lịch mobile                                                            |
| `src/components/manager/capacity-page.tsx`                                            | Sửa        | Cấu hình có tác dụng local, khóa/ngày nghỉ và ảnh hưởng holds                          |
| `src/components/manager/catalog-pages.tsx`                                            | Sửa        | Workload, KTV, bảng responsive và ca làm                                               |
| `src/components/manager/customers-page.tsx`                                           | Sửa        | Query hồ sơ và phiếu dịch vụ thực tế                                                   |
| `src/components/manager/dashboard.tsx`                                                | Sửa        | KPI liên kết, mở rộng CSV, thay cảnh báo tĩnh                                          |
| `src/components/manager/manager-charts.tsx`                                           | Sửa        | Không chia cho 0 khi giảm năng lực về 0                                                |
| `src/components/manager/manager-provider.tsx`                                         | Sửa        | Đồng hồ cảnh báo và thông báo phạm vi lưu                                              |
| `src/components/manager/manager-shell.tsx`                                            | Sửa        | Thông báo dữ liệu một lần và đường vào trung tâm cảnh báo                              |
| `src/components/manager/manager-ui.tsx`                                               | Sửa        | Bảng có nhãn responsive, tái sử dụng trong toàn khu vực                                |
| `src/components/manager/content-page.tsx`                                             | Sửa        | Dùng bảng responsive, giữ editor hiện tại                                              |
| `src/components/manager/system-pages.tsx`                                             | Sửa        | Sự kiện thay thông báo tĩnh, bảng responsive, phản hồi Zalo chính xác                  |
| `src/styles/manager-operations.css`                                                   | Tạo        | Bố cục vận hành và responsive, chỉ dùng tokens điều hành                               |
| `src/app/dieu-hanh/layout.tsx`                                                        | Sửa        | Import stylesheet cục bộ                                                               |
| `src/app/dieu-hanh/{dieu-phoi,phieu-dich-vu,bao-gia,canh-bao,kho,tai-chinh}/page.tsx` | Tạo 6 file | Khai báo các route mới                                                                 |
| `src/app/dieu-hanh/error.tsx`                                                         | Tạo        | Màn hình lỗi và thử lại                                                                |
| `tests/manager-rules.test.mjs`                                                        | Tạo        | Kiểm thử logic local có rủi ro thay đổi dữ liệu                                        |
| `scripts/check-manager-ui.cjs`                                                        | Tạo        | Kiểm tra route, responsive và thao tác trên server local riêng                         |
| `docs/qa/manager-audit/`                                                              | Tạo        | Kết quả browser và ảnh tham chiếu kiểm tra                                             |
| Báo cáo này                                                                           | Tạo        | Audit, thay đổi, kiểm chứng và phần chờ backend                                        |

## D. Kết quả kiểm thử

- Typecheck: `node node_modules/typescript/bin/tsc --noEmit` — đạt.
- Kiểm thử quy tắc: 9 ca thuộc `tests/manager-rules.test.mjs`; 8 ca đạt lần đầu. Ca đổi chỗ dương tính ban đầu chọn đúng một khung đã đầy trong fixture; đã chuẩn bị năng lực trống cho ca đó và chạy lại riêng ca thất bại, đạt. Không chạy lại 8 ca đã thành công.
- Lint: dự án không có script lint, ESLint hoặc cấu hình lint. Không cài thêm thư viện; Prettier được dùng để parse/định dạng các file liên quan, không gọi đó là ESLint.
- Production build: `next build --webpack` trên bản sao source cuối cùng ở thư mục kiểm tra riêng — đạt, bao gồm TypeScript và sinh 57 trang tĩnh. Cả 20 route điều hành xuất hiện trong danh sách build. Không build đè `.next` của bản người dùng đang chạy.
- Browser: **53/60 lượt route/kích thước đã đạt**: 20 route ở 1536px, 20 route ở 820px và 13 route đầu ở 390px. Các lượt này xác nhận có nội dung trang, một thông báo dữ liệu dùng chung, không tràn ngang cả trang và không có ảnh hỏng. Không ghi nhận console error/hydration error trong phần đã chạy.
- Browser chưa kiểm tra: ở 390px còn `/cau-hinh`, `/thong-bao`, `/nhat-ky` và 4 route `/website/*`. Lần chờ trang cấu hình mobile đã hết thời gian; chưa xác định đây là vấn đề điều khiển Chrome/dev server hay lỗi giao diện. Không coi lượt này là đạt.
- Các tương tác form, đổi filter trực tiếp, phân công, cập nhật capacity, đổi ca, đóng/mở dialog và theme **chưa chạy xong trong browser**. Quy tắc dữ liệu đã có test riêng, nhưng không thay thế kiểm thử tương tác.
- Người dùng đã yêu cầu **dừng browser và báo cáo phần đã kiểm tra**; không tiếp tục chạy lại. Các route còn lại và tương tác được giữ rõ là chưa kiểm chứng.
- Sau khi xem ảnh tablet, đã tăng cỡ chữ điều khiển và mở rộng bố cục card cho bảng ở tablet; đồng thời đưa phần cảnh báo lên trước nhóm KPI chi tiết/biểu đồ. Các thay đổi cuối này đã qua parse/build; chưa kiểm tra lại bằng browser vì yêu cầu dừng.

Bằng chứng: [kết quả browser có trạng thái partial](../qa/manager-audit/browser-results.json), [dashboard desktop](../qa/manager-audit/dashboard-1536.png), [điều phối desktop](../qa/manager-audit/dieu-phoi-1536.png), [nhân sự tablet](../qa/manager-audit/nhan-su-820.png). Ảnh là thời điểm kiểm tra trước các tinh chỉnh cuối đã nêu, không phải ảnh xác nhận toàn bộ source cuối.

Các kiểm tra browser chỉ truy cập bản sao frontend local tại cổng 4002; không ghi dữ liệu CRM đang dùng. Bản `npm start` của người dùng tại cổng 4001 không được dừng hay build đè. Bản sao ban đầu khác ổ đĩa gặp lỗi đường dẫn module Next.js Windows; bản sao dưới `node_modules` không được loader transpile. Đã chuyển việc kiểm tra sang thư mục `reference` cùng ổ E:, nằm ngoài source chính và được tsconfig gốc loại trừ.

## E. Chuẩn bị kết nối backend

Những tên endpoint dưới đây chỉ dùng hợp đồng hiện có khi đã được ghi trong `API_SPEC.md`; các miền vận hành mở rộng cần thiết kế hợp đồng mới, chưa tạo backend trong nhiệm vụ này.

| Chức năng             | Dữ liệu đọc                                                                                    | Payload cần gửi                                              | Phạm vi quyền / quy tắc cần chốt                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Lịch và search        | `/admin/bookings`: ngày/khoảng, CVDV, trạng thái, dịch vụ, khách/xe, phân trang, action hợp lệ | ID, filter, cursor                                           | Manager toàn trạm; không dựa vào ẩn nút để bảo vệ                                                                                        |
| Xác nhận/đổi/hủy      | Chi tiết, holds và version mới nhất                                                            | Action, giờ mới, customerAgreed, reason, expectedVersion     | Endpoint action hiện có; transaction giữ/chuyển/giải phóng chỗ; idempotency và xử lý 409                                                 |
| Phân/chuyển cố vấn    | Nhân sự khả dụng, assignment, workload                                                         | from/toAdvisorId, reason, expectedVersion                    | Manager; ghi người/thời điểm/trước/sau; thu hồi quyền người cũ                                                                           |
| Năng lực              | Lịch capacity, giờ hoạt động, ngày nghỉ, nguồn lực nhóm, giữ/đã dùng/còn lại                   | total, group, date/time, block/unblock, reason, version      | D03–D05 phải cập nhật theo quyết định mới: pending giữ chỗ ngay. Xác nhận đơn vị phút, cách kéo dài qua nhiều khung và cách tính ARRIVED |
| Ca làm / KTV          | Vai trò công việc, ca/nghỉ, công việc được giao                                                | staffId, ngày, start/end, availability, note                 | KTV ở đây là danh mục nhân sự vận hành, không tự cấp tài khoản/quyền đăng nhập mới                                                       |
| Phiếu / điều phối     | Service visit/order + khách/xe/CVDV/KTV/deadline/progress                                      | Assignment và reason; các thao tác tiến độ theo API đã duyệt | Manager xem toàn trạm; đồng bộ cùng nguồn với CVDV, không đồng bộ từ localStorage                                                        |
| Báo giá               | Dòng, giá, CK, VAT, status, người lập và phiên bản lịch sử trước/sau                           | Trước mắt màn hình giám sát đọc; sửa qua luồng đã duyệt      | Chốt công thức và làm tròn; không tạo duyệt chiết khấu ngoài yêu cầu                                                                     |
| Thi công / nghiệm thu | Checklist, logs, stageChangedAt, inspector/result/checkedAt                                    | Các action hiện có sau khi chốt điều kiện                    | Chỉ chuyển trạng thái khi đủ điều kiện; không kéo thả Kanban để đổi nghiệp vụ                                                            |
| Tài chính             | Báo giá đã chốt, giao dịch cọc/thu/hoàn, ngày ghi nhận, công nợ                                | Màn hình hiện tại giám sát, không thu tiền thật              | Phân quyền xem tài chính; cần sổ giao dịch để báo cáo doanh thu thực theo ngày thu, không dùng ngày tiếp nhận thay ngày thu              |
| Kho                   | Part/unit/supplier, balance, minimum, nhập/xuất theo order                                     | Màn hình giám sát; CRUD/chứng từ cần hợp đồng riêng          | Kiểm tra tồn, xuất lũy kế, số thập phân, version/transaction; không tự xuất kho theo tiến độ                                             |
| Cảnh báo              | Điều kiện hiện tại và các mốc thời gian, chính sách cảnh báo                                   | Đã đọc/đã xử lý nếu nghiệp vụ chốt                           | Một nguồn cảnh báo và khóa chống trùng; không tự chuyển NO_SHOW; chốt ngưỡng 60 phút/2 giờ/tải >3 xe đang dùng để minh họa UI            |
| Báo cáo               | Aggregates chính thức theo phạm vi/ngày, timezone và quyền                                     | Filter và export yêu cầu                                     | Thống nhất mẫu số tỷ lệ, mốc thời gian xử lý, doanh thu và công nợ; CSV có cùng quyền với danh sách                                      |
| Thông báo / Zalo      | Notification/outbox trạng thái thật                                                            | Retry có idempotency sau khi kết nối                         | Chưa gửi tin thật; lỗi gửi không rollback giao dịch nghiệp vụ                                                                            |

### Giới hạn còn lại

1. Đây là frontend có dữ liệu local trong phiên, chưa dùng chung dữ liệu giữa CVDV và Quản lý. Đã dùng chung kiểu dữ liệu và hàm tính phù hợp; kết nối thực cần một nguồn API.
2. Capacity local là minh họa phút nguồn lực trong khung bắt đầu, không phải thuật toán phân bổ nhiều khung/cầu nâng/KTV hoặc bảo đảm concurrency. Backend phải kiểm tra lại mọi action.
3. Tài chính hiển thị giá trị đã chốt và tiền được cung cấp trong fixture. Chưa ghi nhận doanh thu kế toán, thu/cọc/thanh toán thật, in chứng từ mới hoặc CRUD kho đầy đủ.
4. Các màn hình thi công/nghiệm thu ở điều hành phục vụ giám sát và phân công. Không nhân đôi toàn bộ editor nghiệp vụ CVDV hoặc tự tạo quy trình phê duyệt mới.
5. Error boundary có thể trình bày lỗi render; lỗi API/network và stale version phải bổ sung vào adapter khi có API thực. Không mô phỏng lỗi mạng như dữ liệu production.
