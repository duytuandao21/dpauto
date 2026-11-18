# Tiếp nhận xe — cập nhật 14/11/2026

## Thay đổi

- Form hiện tại được tổ chức thành workspace hai cột khi đủ rộng: xe/ODO/yêu cầu/ghi chú bên trái; khách hàng/lịch hẹn/kiểm tra/ảnh/checklist bên phải. Mobile/tablet chuyển một cột; thứ tự DOM và phím Tab đi từ khách hàng tới xe và nội dung tiếp nhận.
- Dùng lại `adm-panel`, `adm-field`, `adm-form-grid`, `adm-btn`, badge, `AdminIcon`, accordion và theme sáng/tối. Giữ route, tiếp nhận trực tiếp, tiếp nhận từ lịch, xe quay lại, chọn khách/xe có sẵn, phân công của quản lý, quyền và điều hướng mở phiếu sau thành công.
- Checklist cập nhật từ dữ liệu đang nhập, không thêm checkbox bắt buộc. Giữ xác minh khách/xe, yêu cầu khách và thông báo sử dụng thông tin đối với tiếp nhận trực tiếp.
- Tách phần kiểm tra/ảnh có sẵn thành `VisitInspectionFields` để đặt ở cột phải, giữ giới hạn 6 ảnh, ảnh nguồn 20 MB, nén JPEG, thumbnail, chụp/chọn ảnh và xóa ảnh. Giữ khóa nhập liệu trong lúc xử lý ảnh, kể cả nơi đang sửa tiếp nhận trên phiếu.
- Dùng khóa submit tức thời bằng ref, loading hiện có, giữ dữ liệu khi API lỗi, đưa focus tới lỗi API hoặc trường native validation đầu tiên. Footer để trong luồng trang vì bản ghim che hai ô nhập lúc kiểm tra.

## Yêu cầu bổ sung: bỏ ô lý do

Theo chỉ dẫn mới nhất của bạn, bỏ các ô lý do thiếu biển số, thiếu ODO, bổ sung/đổi xe và xe quay lại. Không tự điền lý do thay cố vấn.

- API tiếp nhận không còn bắt buộc các lý do này; trường cũ vẫn nhận được nếu caller cũ gửi. Giữ kiểm tra ODO 0–9.999.999, số nguyên, xác minh xe, quyền, version, liên kết khách/xe, xe đang có phiếu mở và lịch sử sự kiện.
- Migration **`backend/migrations/0015_optional_reception_reasons.sql`** gỡ ràng buộc bắt buộc lý do ODO/xe quay lại, giữ ràng buộc phiếu quay lại không trỏ chính nó. Không sửa migration cũ hoặc xóa cột/dữ liệu lý do đã có.
- Đây là phần Backend/Database tối thiểu cần đồng bộ với yêu cầu mới, thay cho giới hạn chỉ sửa frontend trong prompt ban đầu. Không thay đổi nghiệp vụ báo giá/thi công/bàn giao.

## File

| File | Mục đích |
| --- | --- |
| `src/components/advisor/live-reception.tsx` | Workspace, context, checklist, validation UI, submit |
| `src/components/advisor/visit-intake-fields.tsx` | Tái sử dụng phần nhập liệu và kiểm tra/ảnh |
| `src/styles/advisor.css` | Bố cục chỉ áp dụng trong `.adv-reception` |
| `backend/src/visit-contracts.ts`, `backend/src/visits.ts` | Bỏ bắt buộc lý do, giữ các kiểm tra khác |
| `backend/migrations/0015_optional_reception_reasons.sql` | Nâng cấp ràng buộc mà không xóa dữ liệu |
| `tests/booking-workflow-ui.test.mts`, các test tiếp nhận trong `backend/test` | Cập nhật trường hợp lý do không còn bắt buộc |
| `scripts/check-reception.cjs`, `tests/helpers/reception-{browser,mocks}.tsx` | Browser kiểm tra component thật với API giả lập cục bộ |

## Kiểm tra

- TypeScript frontend và backend: đạt.
- 1 render test intake: đạt; yêu cầu khách vẫn bắt buộc, không có ô lý do, kiểm tra/ảnh tùy chọn và thu gọn.
- 4 integration tests riêng trên PostgreSQL tạm: đạt. Bao gồm ODO/biển số thiếu không cần lý do; xe quay lại không cần lý do; đổi/bổ sung xe khi tiếp nhận; xác minh xe/quyền; version; tiếp nhận đồng thời tạo một phiếu; kiểm tra ban đầu của phiếu cũ; liên kết lịch và hoàn thành phiếu. ODO sai vẫn bị từ chối.
- Chrome với React/component thật, API giả lập: 4 cấu hình sáng/tối 390/820/1440px đạt, không tràn trang hoặc điều khiển chồng nhau. Kiểm tra xe có sẵn/xe mới, thiếu biển số/ODO, ODO hợp lệ, xác minh chưa chọn, lưu thành công/lỗi, giữ dữ liệu, nén/thêm/xóa thumbnail và hai submit liên tiếp chỉ gửi một request.
- 2 kiểm tra Tab riêng trên 390/1440px tối: đạt sau khi đồng bộ thứ tự DOM; đã xem ảnh sáng/tối và mobile/desktop. Phần khôi phục khóa nhập liệu của component chỉnh tiếp nhận sau khi tách ảnh được rà tĩnh, không chạy lại kiểm tra đã đạt.
- Lỗi browser đầu tiên bị cleanup profile Chrome che mất thông báo; sau sửa cleanup xác định footer ghim gây chồng hai ô nhập. Bỏ ghim và lượt chạy lại cuối đạt. Không còn kiểm thử thất bại chưa xử lý.
- Không có Playwright hoặc script lint trong dự án; không thêm dependency. Không chạy production build, toàn bộ test suite, E2E sau đăng nhập, điện thoại/camera thật hoặc database đang sử dụng.
- Bằng chứng: `docs/qa/reception/results.json`, `booking-1440-light.png`, `keyboard-1440-dark.png`, `walk-in-390-light.png`, `keyboard-390-dark.png`.

## Nguồn xe và giới hạn

Backend chỉ phân biệt `BOOKING`/`WALK_IN`, chưa có trường khách thông thường/Xe Lướt Toàn Trung. UI hiển thị lựa chọn nguồn xe ở trạng thái khóa với thông báo chưa hỗ trợ lưu; không gửi trường mới hoặc tạo cảm giác đã lưu. Cần bổ sung hợp đồng API/lưu trữ riêng khi triển khai phân loại nguồn xe, người gửi và ghi chú đối tác.

Các browser checks dùng dữ liệu cục bộ để tránh thao tác vào dữ liệu đang sử dụng; API/database được kiểm tra riêng trên PostgreSQL tạm. Không sửa `.env`, không dừng server của bạn.

## Áp dụng

Tại thư mục dự án, chạy migration trước rồi khởi động lại backend:

```powershell
npm.cmd --prefix backend run db:migrate
```

Nếu dùng `npm start`, cần tự build lại frontend trước khi khởi động. Agent chưa migrate database đang dùng hoặc build production trong nhiệm vụ này.
