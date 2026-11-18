# Báo cáo tối ưu quy trình đặt lịch DPAuto

## 1. Kết quả

Đã triển khai tuần tự 6 phase trong `prompt.md`, cùng các yêu cầu bổ sung về mã lịch, ngày giờ và bố cục form.

Luồng chính: **Hàng chờ → gọi khách → Chốt lịch → nhập ngày/giờ đã thống nhất → Xác nhận lịch hẹn → Tiếp nhận xe → Phiếu dịch vụ.**

Tái sử dụng giao diện dashboard hiện có, `adm-field`, `adm-form-grid`, `adm-dialog`, `ManagerModal`, nút, trạng thái, token và breakpoints sẵn có. Không thay palette hay thêm thư viện. Các thay đổi đang có trước nhiệm vụ được giữ lại.

`datlich.md` không hiện diện trên đĩa lúc triển khai; đã đối chiếu lại source thực tế. Không thể tự gọi lệnh hội thoại `/compact`; tiến độ và kết quả từng phase đã được ghi vào chính file này trong quá trình thực hiện.

## 2. Các phase đã triển khai

### Phase 1 — Hàng chờ và thẻ lịch `/co-van`

- **Cần xử lý:** tải PENDING được phép xem, không giới hạn vào ngày đang chọn hoặc ±7 ngày; phân biệt chưa liên hệ, cần gọi lại, đã liên hệ/chưa chốt, hiển thị người phụ trách.
- **Đã đến:** tải ARRIVED được phép xem, gồm xe tiếp nhận từ trước khoảng ngày đang chọn. Có nhóm **Lịch hôm nay**, **Tất cả lịch** và bộ lọc hiện có.
- Ưu tiên ngày mong muốn hiện tại; cùng ngày thì yêu cầu tạo trước đứng trước. Đổi ngày không làm mất ngày yêu cầu gốc.
- Thẻ có mã, khách, điện thoại gọi nhanh, xe/biển số, dịch vụ, ngày/buổi hoặc giờ chính thức, trạng thái và cố vấn.
- Nút chính theo trạng thái: Chốt lịch / Tiếp nhận xe / Xem phiếu dịch vụ / Xem lịch sử / Xem chi tiết. Thao tác phụ nằm trong menu `…` trên thẻ.
- Ẩn các bộ lọc ngày/trạng thái không phù hợp với nhóm đang xem để tránh lọc chồng lên hàng chờ.

**Mã lịch mới:** `DP-DV13112026-001`, `DP-DV13112026-012`, `DP-DV13112026-123`.

Số tăng theo ngày tạo tại Việt Nam, bắt đầu lại từ 001 mỗi ngày; tối thiểu 3 chữ số, không cắt từ 1000 trở lên. Bộ đếm được cấp trong transaction, dùng chung theo ràng buộc mã duy nhất toàn hệ thống hiện có. Giữ mã cũ; gửi lại cùng idempotency key không cấp thêm mã.

### Phase 2 — Chốt lịch và liên hệ

- `BookingTimeForm` hiển thị khách/điện thoại/xe/dịch vụ và yêu cầu ban đầu. Giờ chính thức **để trống** khi chưa chốt, không lấy giờ kỹ thuật của buổi.
- Một lần xác nhận lưu giờ, trạng thái, người phụ trách, sự đồng ý, lịch sử và ghi chú tùy chọn. Không cần lưu liên hệ riêng trước đó.
- Kiểm tra cảnh báo trước lưu; chỉ thêm bước tiếp tục khi có cảnh báo. Lỗi API giữ form và dữ liệu, không đóng như thành công.
- Không biết kênh liên hệ thì ghi OTHER, không tự nhận là gọi điện/Zalo.
- **Chưa liên hệ được:** giờ gọi lại tùy chọn, tăng số lần liên hệ, giữ PENDING. Ghi liên hệ không tự nhận yêu cầu chưa phân công; chốt lịch vẫn nhận phụ trách trong transaction.
- Hủy yêu cầu lý do thực tế; đánh dấu không đến yêu cầu xác nhận đã kiểm tra thủ công. Giữ lịch sử đổi giờ và hủy.

### Phase 3 — Tạo lịch nội bộ

- **Tạo yêu cầu chờ xác nhận:** chọn ngày/buổi, giữ PENDING.
- **Tạo và xác nhận:** chủ động nhập giờ đã thống nhất, tạo CONFIRMED, phân công, ghi đồng ý và lịch sử trong cùng transaction; không gửi request xác nhận thứ hai.
- Có preflight cho giờ cụ thể. Giữ thông báo sử dụng thông tin khách và kiểm tra quyền.
- Chọn dịch vụ đang hoạt động/mở đặt lịch, tối đa 10 dịch vụ; giữ dịch vụ cũ đã chọn khi chỉnh lịch.
- Khi sửa lịch PENDING theo buổi, hiển thị buổi thay cho giờ kỹ thuật chỉ đọc.

### Phase 4 — Tiếp nhận xe

- Hiển thị sẵn mã lịch, khách/điện thoại, xe/biển số, cố vấn, giờ chính thức và dịch vụ.
- Tự điền yêu cầu từ dịch vụ và ghi chú khách; không dùng ghi chú nội bộ thay lời khách.
- Nhóm chính gồm ODO/lý do thiếu ODO, yêu cầu thực tế và ghi chú tiếp nhận. Nhóm kiểm tra/vận hành/ảnh thu gọn, không phát sinh trường bắt buộc.
- Giữ xác minh xe thực tế, lý do đổi xe/thiếu biển số, xe đang có phiếu mở, quyền cố vấn và chống trùng phiếu.
- Tiếp nhận tạo đúng một phiếu, chuyển ARRIVED và mở phiếu; giữ bước kiểm tra ban đầu và các cổng nghiệp vụ phía sau.

### Phase 5 — API và dữ liệu

- Tách `originalRequestedPeriod` khỏi buổi hiện tại; `requestedStartAt` giữ ngày gốc, `confirmedStartAt` là giờ đã chốt.
- Cảnh báo trùng cố vấn dựa trên giao khoảng dự kiến từ reservation; hai khoảng chỉ chạm đầu/cuối không bị báo trùng.
- Preflight không ghi trạng thái/nhận phụ trách. Lúc lưu vẫn kiểm tra quyền, trạng thái, version và điều kiện nghiệp vụ; dùng transaction/idempotency hiện có.
- Cảnh báo tải/đóng cửa/ngoài giờ không khóa xác nhận; số yêu cầu sáng/chiều không bị giới hạn theo số lượng.
- Callback quá khứ bị từ chối và không ghi dở dữ liệu.
- Ngày hiển thị `dd/mm/yyyy`, ngày hiện tại và giờ hiển thị dùng `Asia/Ho_Chi_Minh` (UTC+7), kể cả khi máy khách dùng múi giờ khác. API tiếp tục dùng ISO.

### Phase 6 — Đồng bộ `/dieu-hanh`

- Hàng chờ toàn trạm và nhóm chưa phân công không phụ thuộc ngày chọn. Chỉ tải thêm backlog tại màn hình lịch hẹn để giữ tập dữ liệu các module khác.
- Dùng chung `BookingTimeForm`, preflight và nghiệp vụ chốt/đổi giờ; bỏ checkbox/lý do mặc định trùng lặp trong luồng API.
- Chọn cố vấn ngay khi chốt lịch chưa phân công; giữ phân công/chuyển cố vấn riêng.
- Dùng chi tiết/lịch sử booking thực tế và version hiện tại. Chốt/đổi/hủy thành công đóng drawer, tránh báo không tìm thấy khi lịch vừa rời hàng chờ.
- Phần ghi nhận liên hệ dùng callback của workspace điều hành, không bắt buộc context riêng của cố vấn.
- Giữ quyền toàn trạm của quản lý và phạm vi cố vấn.

## 3. API thay đổi

Các đường dẫn có tiền tố `/api/v1/`.

| API                                            | Thay đổi                                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `admin/bookings`                           | Cho phép hàng chờ không ngày với `status=PENDING` hoặc `status=PENDING,ARRIVED`; giữ scope/phân trang.                                       |
| GET `admin/bookings`, GET `admin/bookings/:id` | Thêm `lastContactOutcome`, `contactAttempts`, `callbackAt`, `originalRequestedPeriod`.                                                       |
| GET `admin/bookings/:id/preview`               | Mới: `action=confirm/reschedule`, `expectedVersion`, `startAt`, `advisorId` tùy quyền; không ghi dữ liệu.                                    |
| GET `admin/bookings/create-preview`            | Mới: `startAt`, `serviceIds` ngăn bằng dấu phẩy, `catalogVersion`, `advisorId` tùy quyền.                                                    |
| POST `admin/bookings`                          | Ngày/buổi hoặc giờ cụ thể. `confirmNow=true` cần `customerAgreed=true`, giờ cụ thể, cố vấn hợp lệ, quyền xác nhận. Payload cũ vẫn dùng được. |
| POST `admin/bookings/:id/confirm`              | Lý do có mặc định nghiệp vụ, ghi chú nội bộ tùy chọn; giữ version và nhận phụ trách an toàn.                                                 |
| POST `admin/bookings/:id/reschedule`           | Lý do tùy chọn; giữ đổi buổi khi PENDING và giờ cụ thể khi đã xác nhận.                                                                      |
| POST `admin/bookings/:id/contact-events`       | `callbackAt` tùy chọn phải sau hiện tại; không tự nhận lịch chưa phân công.                                                                  |

API hủy, không đến và tiếp nhận giữ hợp đồng kiểm soát hiện có. Preflight là ảnh chụp tại lúc kiểm tra; lúc lưu tính lại tải/xung đột, cảnh báo mới do thay đổi đồng thời có thể xuất hiện trong thông báo sau lưu.

## 4. Migration và rollback

| Migration mới                      | Nội dung                                          | Bảo toàn / rollback                                                             |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `0009_booking_daily_codes.sql`     | Bộ đếm số lịch theo ngày.                         | Không đổi mã cũ. Giữ bảng khi rollback code để không mất số đã cấp nếu bật lại. |
| `0010_booking_callback.sql`        | Cột `callback_at` nullable trong lịch sử liên hệ. | Giữ lịch sử cũ; backend cũ bỏ qua cột.                                          |
| `0011_booking_original_period.sql` | Buổi gốc, sao chép buổi đang lưu cho lịch cũ.     | Giữ cột khi rollback code để tránh mất thông tin gốc.                           |

**Chưa chạy migration trên database bạn đang sử dụng.** Chỉ áp dụng trên PostgreSQL tạm khi kiểm thử. `0008_booking_periods.sql` đã có trước nhiệm vụ, không viết lại trong đợt này.

Buổi gốc đã bị ghi đè trước nâng cấp và không còn nguồn lịch sử tương ứng thì không thể suy đoán khôi phục chính xác. Không xóa/reset database hoặc sửa checksum migration đã áp dụng.

## 5. File chính

- Backend: `backend/src/bookings.ts`, `contracts.ts`, `api.ts`, `app.ts`; ba migration ở mục 4.
- Cố vấn: `src/components/admin/bookings-workspace.tsx`, `booking-actions.tsx`, **`booking-time-form.tsx` mới**, `booking-form.tsx`, `booking-detail.tsx`, `booking-communication.tsx`, `booking-provider.tsx`, `remote-booking-provider.tsx`.
- Tiếp nhận: `src/components/advisor/live-reception.tsx`, `visit-intake-fields.tsx`.
- Điều hành: `src/components/manager/bookings-page.tsx`, `booking-list.tsx`, `remote-manager-provider.tsx`.
- Kiểu/định dạng: `src/lib/booking/types.ts`, `logic.ts`, **`queue.ts` mới**, `src/lib/api/types.ts`, `booking-adapter.ts`, `src/lib/manager/mock.ts`, `src/lib/public-booking/mock.ts`.
- CSS component: `src/styles/admin.css`, `advisor.css`, `advisor-coreui.css`, `manager.css`; chỉnh spacing/wrapping, menu phụ và font textarea kế thừa, không đổi token.
- Test: `backend/test/booking-workflow.integration.test.ts`, `booking-workflow-contracts.test.ts`, `tests/booking-queue.test.mts`, `booking-workflow-ui.test.mts`.

## 6. Kiểm tra thực tế

| Phạm vi                   | Kết quả                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1                   | Unit hàng chờ; integration cấp số đồng thời, đệm số, idempotency, đổi ngày Việt Nam và hàng chờ đạt.                                       |
| Phase 2                   | 2 integration tests đạt: liên hệ lại/giữ hàng chờ/callback/chốt/lịch sử; đồng thời giữa cố vấn và quyền truy cập.                          |
| Phase 3                   | Integration tạo/xác nhận một transaction, rollback thiếu cố vấn, idempotency và preflight đạt.                                             |
| Phase 4                   | Integration xác minh xe, ODO, lý do đổi xe, hai lần tiếp nhận một phiếu và giữ cổng kiểm tra ban đầu đạt.                                  |
| Phase 5                   | Integration giao khoảng/khoảng tiếp nối, buổi gốc, 7 yêu cầu cùng buổi vẫn mở và callback lỗi không ghi dở đạt.                            |
| Phase 6                   | Integration backlog/chốt/chuyển cố vấn/quyền hạn đạt; 2 kiểm thử render form đạt.                                                          |
| Bổ sung                   | Unit ngày giờ HCM, xếp hàng sau đổi ngày và hợp đồng lọc hàng chờ đang xử lý đạt.                                                          |
| TypeScript                | Frontend và backend đạt tại các mốc triển khai.                                                                                            |
| Production build frontend | `npm.cmd run build` đạt, sinh 55 trang. Các tinh chỉnh cuối CSS/nhãn/lọc được rà tĩnh và kiểm tra TSX cục bộ; không chạy lại build đã đạt. |
| Lint                      | Không chạy: `package.json` không có script lint; không thêm dependency ngoài yêu cầu.                                                      |

Tổng cộng **7 integration tests và 6 unit/render/contract tests khác nhau đạt**. Không chạy toàn bộ test suite, benchmark hoặc Lighthouse. Phase 1 đầu gặp lỗi khởi động PostgreSQL trong sandbox, sau đó sửa bộ lọc và UUID trong fixture; lượt bổ sung đã được bạn duyệt và đạt. Không còn ca kiểm thử thất bại chưa xử lý. Driver PostgreSQL có cảnh báo deprecation về concurrent query; không nâng cấp driver ngoài phạm vi.

### Hiển thị form

- Chrome headless render riêng component thật cùng CSS/token/font hiện có; không gửi thao tác vào dữ liệu đang sử dụng.
- 12 cấu hình: form chốt cố vấn, tạo lịch nội bộ, thông tin tiếp nhận, form chốt quản lý; 390/820px sáng, 1440px tối.
- Không phát hiện tràn ngang hoặc ô/nút chồng lấp trong các cấu hình đã đo. Đã xem ảnh, sửa font textarea kế thừa giao diện và rà lại trường hợp liên quan. Khung drawer đối chiếu header/body `ManagerModal`.
- Bằng chứng: [kết quả browser](docs/qa/booking-workflow/browser-results.json), [chốt lịch mobile](docs/qa/booking-workflow/advisor-confirm-390-light.png), [tiếp nhận mobile](docs/qa/booking-workflow/advisor-intake-390-light.png), [quản lý chế độ tối](docs/qa/booking-workflow/manager-confirm-1440-dark.png).

### Giới hạn

- Chưa E2E giao diện sau đăng nhập hoặc thử điện thoại thật; browser trên kiểm tra bản render component riêng, không phải toàn bộ màn hình kết nối API.
- Không chạy lại toàn bộ báo giá/thi công/kho/tài chính/nghiệm thu/bàn giao; source nghiệp vụ các module đó không sửa trong đợt này. Test tiếp nhận xác nhận không bỏ cổng kiểm tra ban đầu.
- Bộ tải hiện có vẫn giới hạn bảo vệ 2.000 bản ghi/view; nếu backlog vượt mức đó cần phân trang/tìm kiếm từ server.
- Ô chọn ngày native còn phụ thuộc locale trình duyệt/hệ điều hành; nhãn văn bản và hàm nghiệp vụ đã cố định định dạng Việt Nam, UTC+7.

## 7. Chạy thử

Trỏ backend đến đúng database phát triển cần nâng cấp, tại thư mục dự án:

```powershell
npm.cmd --prefix backend run db:migrate
npm.cmd --prefix backend run dev
```

Terminal khác:

```powershell
npm.cmd run dev
```

Nếu dùng `npm start`, build lại bản cuối: `npm.cmd run build`, rồi `npm.cmd start`. Chỉ chạy một frontend trên cổng 4001; khởi động lại backend hiện tại thay vì mở bản trùng cổng.

Thử: gửi lịch ngày tương lai ở website → **Cần xử lý** → **Chốt lịch** → nhập giờ → xác nhận → **Tiếp nhận xe** → xác minh/ODO/yêu cầu → hoàn tất và mở phiếu. Lịch nội bộ đã thống nhất giờ dùng **Tạo và xác nhận**.

Không deploy/migrate production trong nhiệm vụ này. Chrome và server rà component riêng đã đóng; không dừng frontend/backend của bạn.
