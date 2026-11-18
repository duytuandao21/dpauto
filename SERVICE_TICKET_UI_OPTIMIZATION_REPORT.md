# Tối ưu giao diện Phiếu dịch vụ DPAuto

## Kết quả

- Đổi tên hiển thị “Xe dịch vụ” thành **Phiếu dịch vụ** ở menu, header và các liên kết liên quan.
- Trang `/co-van/phieu-dich-vu` dùng bảng toàn chiều rộng với 7 cột: **Mã phiếu – Biển số – Tên xe – Khách hàng – Thành tiền – Trạng thái – Thao tác**.
- Desktop dùng bảng ngang, header/cột thao tác giữ vị trí khi cuộn. Tablet cuộn trong bảng; mobile chuyển thành thẻ gọn, đưa biển số và trạng thái lên đầu. Dùng lại font Inter, token, nút, badge, ô tìm kiếm, loading và empty state hiện có; hỗ trợ sáng/tối.
- Giữ nút **Mở lịch hẹn**, **Tiếp nhận xe trực tiếp**. Mỗi dòng có một hành động chính; menu phụ mở tổng quan khi cần.
- Mặc định **Đang xử lý**. Có **Tất cả** và các tab nghiệp vụ, gồm **Đã bàn giao**; trạng thái ngoại lệ nằm trong bộ lọc thu gọn. Các lựa chọn có nghĩa riêng, không ẩn phiếu đã bàn giao trong tab Tất cả.
- Tìm mã phiếu, biển số, tên xe, tên khách và số điện thoại. Hỗ trợ số đầy đủ dạng `0…`, `84…`, `+84…` qua chuẩn hóa số điện thoại đang có.
- API phân trang bằng cursor, tối đa 20 phiếu/trang trên giao diện; đổi từ khóa/bộ lọc đặt lại trang. Không tải toàn bộ phiếu để lọc trên trình duyệt.
- Hành động là liên kết đến tab nghiệp vụ hiện có, không tự gửi lệnh chuyển trạng thái. Người thiếu quyền thao tác được hiển thị **Xem phiếu**.

## Mapping trạng thái

Không đổi enum trong database. `ticketStage` là dữ liệu hiển thị/tìm kiếm được tính khi đọc.

| Dữ liệu thực tế                                                                                      | Hiển thị                         | Hành động / khu vực                                    |
| ---------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `RECEIVED`                                                                                           | Chờ kiểm tra, thuộc nhóm Báo giá | Tiếp tục xử lý → Tổng quan; giữ bước hoàn tất kiểm tra |
| `INSPECTED`, chưa đủ dữ liệu chờ thi công hoặc còn báo giá nháp/chờ khách duyệt                      | Báo giá                          | Lập / xử lý báo giá → Báo giá                          |
| `INSPECTED` + work `NOT_STARTED`, có báo giá đã duyệt hoặc miễn phí được duyệt, không còn báo giá mở | Chờ thi công                     | Bắt đầu thi công → Thi công                            |
| `IN_PROGRESS`                                                                                        | Đang thi công                    | Cập nhật thi công → Thi công                           |
| `IN_PROGRESS` + work `PAUSED`                                                                        | Tạm dừng                         | Xử lý tạm dừng → Thi công                              |
| `IN_PROGRESS` + work `PAUSED` + nghiệm thu gần nhất `NEEDS_WORK`                                     | Cần làm lại                      | Xử lý làm lại → Thi công                               |
| `QUALITY_CHECK`                                                                                      | Chờ nghiệm thu                   | Nghiệm thu → Nghiệm thu & bàn giao                     |
| `READY`                                                                                              | Sẵn sàng bàn giao                | Bàn giao xe → Nghiệm thu & bàn giao                    |
| `HANDED_OVER`                                                                                        | Đã bàn giao                      | Xem phiếu                                              |
| `ABORTED`                                                                                            | Đã dừng                          | Xem phiếu                                              |

Các nút điều hướng theo quyền `visits.update`, `quotes.write`, `work.write`, `acceptance.record`, `visits.handover`. Điều kiện về kiểm tra, khách duyệt báo giá, hạng mục, kỹ thuật viên, phụ tùng, tiền và nghiệm thu vẫn được kiểm tra bởi quy trình chi tiết/backend hiện có.

## Nguồn Thành tiền

- **Dự kiến:** tổng của bản báo giá mở gần nhất (`DRAFT`/`SUBMITTED`) có hạng mục thực tế, khi chưa có báo giá đã duyệt.
- **Báo giá đã duyệt:** tổng các revision `APPROVED`; các phát sinh được cộng theo cùng cơ chế INITIAL/CHANGE_ORDER hiện có. Phát sinh chưa duyệt không cộng vào số này và được ghi chú riêng.
- **Phải thanh toán:** ở `READY`/`HANDED_OVER`, tổng đã duyệt trừ `obligation_credits`, đúng nguồn mà `Finance.obligation` đang sử dụng. Đây là nghĩa vụ tổng, không phải số tiền còn nợ sau các lần thu.
- Miễn phí không báo giá chỉ có số 0 khi đã có `NO_QUOTE_FREE` được duyệt. Báo giá có hạng mục giá 0 thực tế vẫn được thể hiện đúng.
- Chưa có báo giá, hoặc nháp chưa có hạng mục: **Chưa có báo giá**; không lấy số 0 mặc định của database.
- API trả tiền bằng chuỗi số nguyên; frontend định dạng `vi-VN` bằng `BigInt`, ví dụ `4.500.000 đ`. Không đổi nghiệp vụ tài chính hay chính sách tính giá.

## API

- GET `/api/v1/admin/service-visits`: dùng tìm kiếm và cursor hiện có; bổ sung tìm tên xe, chuẩn hóa tìm số điện thoại và bộ lọc `ticketStage`.
- Danh sách thêm `ticketStage`, `pricing`; chi tiết thêm `pricing`. Các trường cũ, bộ lọc `stage`, scope theo cố vấn/trạm và cursor gắn với người dùng/bộ lọc được giữ.
- Các thao tác tiếp tục dùng GET chi tiết/workflow và các lệnh nghiệp vụ sẵn có ở trang chi tiết. Không bổ sung API ghi hay migration.

## File thay đổi

- Trang/bảng mới: `src/components/advisor/service-tickets-page.tsx`, `service-tickets-table.tsx`; `orders-page.tsx` chuyển sang trang mới.
- Mapping: `src/lib/advisor/service-tickets.ts`; kiểu API: `src/lib/api/visits.ts`.
- CSS: `src/styles/advisor.css`, chỉ thêm style cho khu vực Phiếu dịch vụ.
- Nhãn điều hướng: `admin-shell.tsx`, `live-visits.tsx`, `live-reception.tsx`, `order-detail-page.tsx`, `overview-tasks.tsx`.
- Backend đọc: `backend/src/visits.ts`, `backend/src/visit-contracts.ts`.
- Kiểm thử: các ca `Ticket UI` trong `backend/test/phase3.integration.test.ts`; `tests/service-tickets.test.mjs`, `tests/helpers/service-ticket-render.cjs`.
- Kiểm tra responsive: `scripts/check-service-tickets.cjs`; ảnh và kết quả trong `docs/qa/service-tickets/`.

## Kiểm tra

| Phạm vi                                        | Kết quả                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript frontend/backend                    | Đạt tại mốc triển khai; build frontend cũng kiểm tra lại kiểu của bản frontend cuối                                                               |
| 5 unit/render tests                            | Đạt: mapping, quyền/thao tác, các loại thành tiền, bảng 7 cột/liên kết, bộ lọc/phân trang/loading/error                                           |
| 3 API integration tests trên PostgreSQL tạm    | Đạt: scope cố vấn/quản lý, tìm kiếm, cursor, tiền đã duyệt/phát sinh/giảm nghĩa vụ; toàn bộ giai đoạn và ngoại lệ; nháp rỗng không hiển thị 0 giả |
| Chrome 390px sáng, 820px sáng, 1440px sáng/tối | Đạt: đúng viewport, 7 cột, mobile dùng grid, tablet cuộn trong bảng, không tràn ngang toàn trang; đã xem ảnh                                      |
| Production build frontend                      | `npm.cmd run build` đạt, sinh 55 trang                                                                                                            |

Bằng chứng: [kết quả kích thước](docs/qa/service-tickets/browser-results.json), [mobile](docs/qa/service-tickets/390-light.png), [tablet](docs/qa/service-tickets/820-light.png), [desktop sáng](docs/qa/service-tickets/1440-light.png), [desktop tối](docs/qa/service-tickets/1440-dark.png).

Ban đầu PostgreSQL tạm không khởi động trong sandbox; lượt chạy được cấp quyền đã chạy trên database cô lập. Kiểm thử phát hiện tìm số nội địa chưa khớp `+84`, đã sửa và đạt. Các lỗi fixture về bước công việc/dừng phiếu đã sửa; lượt chạy bổ sung riêng ca còn lỗi được người dùng cho phép và đã đạt. Không còn ca thất bại chưa xử lý.

## Giới hạn và chạy bản mới

- Browser kiểm tra component bảng thật trong khung CSS với dữ liệu kiểm thử cô lập, không phải E2E sau đăng nhập hoặc điện thoại thật. Không chạy toàn bộ test suite hay kiểm thử mọi nghiệp vụ ngoài phạm vi.
- Chế độ local cũ không có trạng thái bàn giao riêng: `done` chỉ được ánh xạ **Sẵn sàng bàn giao**, không suy đoán thành Đã bàn giao. Quy trình đầy đủ/phân trang server áp dụng khi bật API.
- Tìm tên tiếng Việt ở backend vẫn theo `ILIKE`, chưa bổ sung tìm bỏ dấu. Từ khóa số điện thoại đầy đủ được chuẩn hóa; các kiểu nhập không hợp lệ không tự suy đoán.
- Chưa đo tải với dữ liệu lớn; projection đọc bổ sung dữ liệu báo giá theo mỗi phiếu trong trang 20 dòng, tận dụng index hiện có, chưa refactor loader dùng chung.
- Cần khởi động lại backend bằng code mới để nhận bộ lọc/trường dữ liệu mới. Nếu đang chạy `backend/npm start` từ `dist`, cần build backend trong quy trình chạy của bạn trước khi restart. Không cần migration cho thay đổi này.
- Không thay đổi database đang sử dụng, không deploy, không dừng frontend/backend của bạn. Chrome và server chụp ảnh riêng đã đóng.
