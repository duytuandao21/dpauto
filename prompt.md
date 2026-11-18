# CODEX PROMPT — TỐI ƯU QUY TRÌNH ĐẶT LỊCH & TIẾP NHẬN XE DPAUTO

## 1. Bối cảnh và mục tiêu

Dự án DPAuto là hệ thống quản lý trạm dịch vụ ô tô, bao gồm website đặt lịch, dashboard cố vấn dịch vụ `/co-van` và dashboard quản lý cửa hàng `/dieu-hanh`.

Hãy đọc kỹ báo cáo `datlich.md` và khảo sát lại source code thực tế trước khi thực hiện.

**Mục tiêu:** Đơn giản hóa quy trình làm việc của cố vấn dịch vụ, giảm số lần nhấn, số form và số màn hình phải mở, nhưng vẫn giữ đầy đủ dữ liệu nghiệp vụ và các bước kiểm soát quan trọng.

Quy trình mong muốn:

**Khách đặt lịch → Cố vấn liên hệ và chốt giờ → Khách đến tiếp nhận xe → Tạo phiếu dịch vụ → Xử lý dịch vụ.**

Trong đợt này, ưu tiên tối ưu 3 giai đoạn đầu. Không thiết kế lại toàn bộ quy trình báo giá, thi công, nghiệm thu và bàn giao.

## 2. Nguyên tắc triển khai bắt buộc

- Bám sát UI/UX, màu sắc đỏ – trắng, typography, spacing, component và design system hiện tại.
- Không xây dựng một giao diện mới hoàn toàn hoặc thay đổi bố cục không cần thiết.
- Ưu tiên tái sử dụng component, API, service và database schema hiện có.
- Những chức năng đã hoạt động đúng thì giữ nguyên.
- Loại bỏ thao tác trùng lặp, không loại bỏ dữ liệu nghiệp vụ quan trọng.
- Ưu tiên tốc độ thao tác của cố vấn trên máy tính, đồng thời đảm bảo responsive trên tablet/mobile.
- Không thêm các bước xác nhận hoặc popup không cần thiết.
- Không thay đổi phân quyền, quy trình tài chính, kho, báo giá và thi công ngoài phạm vi.
- Không sử dụng mock API hoặc dữ liệu giả thay cho dữ liệu backend thực tế.
- Đảm bảo tương thích với dữ liệu lịch hẹn đã tồn tại.
- Nếu cần migration, phải có phương án bảo toàn dữ liệu và rollback.

## 3. PHASE 1 — Tối ưu giao diện quản lý lịch hẹn `/co-van`

### 3.1. Xây dựng hàng chờ yêu cầu tập trung

Hiện tại, dashboard `/co-van` ưu tiên lịch hôm nay, trong khi yêu cầu đặt cho ngày tương lai có thể bị bỏ sót.

Cần bổ sung khu vực **Cần xử lý** tổng hợp tất cả yêu cầu `PENDING` mà cố vấn có quyền xem, không phụ thuộc vào ngày khách chọn.

Phân biệt:

- Yêu cầu mới chưa được liên hệ.
- Yêu cầu đã liên hệ nhưng chưa chốt.
- Yêu cầu chưa liên hệ được và cần gọi lại.
- Yêu cầu đang được cố vấn khác phụ trách (chỉ hiển thị theo quyền hiện có).

Hiển thị số lượng yêu cầu cần xử lý, ưu tiên các yêu cầu chờ lâu và lịch có ngày mong muốn sắp đến.

Không thay đổi quyền truy cập dữ liệu hiện tại.

### 3.2. Tối ưu thẻ lịch hẹn

Mỗi thẻ lịch chỉ hiển thị những thông tin quan trọng:

- Mã lịch dễ nhận biết, không sử dụng UUID dài làm tiêu đề.
- Tên khách hàng.
- Số điện thoại, có thao tác gọi nhanh.
- Xe và biển số nếu có.
- Dịch vụ khách yêu cầu.
- Ngày và buổi mong muốn hoặc giờ đã xác nhận.
- Trạng thái hiện tại.
- Cố vấn phụ trách nếu có.

**Nguyên tắc một hành động chính cho mỗi trạng thái:**

| Trạng thái | Nút chính |
|---|---|
| `PENDING` | Chốt lịch |
| `CONFIRMED` | Tiếp nhận xe |
| `ARRIVED` | Xem phiếu dịch vụ |
| `COMPLETED` | Xem lịch sử |
| `CANCELLED` / `NO_SHOW` | Xem chi tiết |

Các thao tác ít sử dụng như sửa thông tin, hủy lịch, đổi giờ, xem lịch sử được đặt trong menu phụ `...`.

Không hiển thị quá nhiều nút trên một thẻ lịch.

Các thao tác thường xuyên cần thực hiện ngay trên danh sách, không bắt buộc điều hướng sang trang chi tiết.

### 3.3. Thiết kế danh sách theo nhu cầu vận hành

Ưu tiên các nhóm:

1. **Cần xử lý:** Yêu cầu chưa xác nhận thuộc phạm vi cố vấn được xem.
2. **Lịch hôm nay:** Lịch đã xác nhận, sắp xếp theo giờ.
3. **Đã đến:** Xe đã tiếp nhận, có liên kết phiếu dịch vụ.
4. **Tất cả lịch:** Tìm kiếm, lọc ngày, trạng thái, cố vấn và dịch vụ.

Không tạo thêm các trang riêng nếu có thể triển khai bằng tab hoặc bộ lọc trên giao diện hiện tại.

Cập nhật dữ liệu sau thao tác, tránh yêu cầu cố vấn tải lại trang thủ công.

## 4. PHASE 2 — Gộp liên hệ và xác nhận lịch

Đây là thay đổi nghiệp vụ quan trọng nhất.

### 4.1. Loại bỏ thao tác xác nhận trùng lặp

Hiện tại, cố vấn có thể phải:

1. Mở lịch.
2. Ghi nhận liên hệ.
3. Chọn kết quả đã thống nhất.
4. Lưu liên hệ.
5. Mở xác nhận lịch.
6. Nhập ngày giờ.
7. Xác nhận lần nữa.

**Hãy tối ưu thành:**

1. Cố vấn gọi hoặc nhắn cho khách.
2. Nhấn **Chốt lịch**.
3. Nhập ngày và giờ chính thức.
4. Nhấn **Xác nhận lịch hẹn**.

Một lần lưu phải hoàn thành toàn bộ nghiệp vụ xác nhận, bao gồm:

- Chuyển trạng thái từ `PENDING` sang `CONFIRMED`.
- Gán cố vấn phụ trách theo đúng quyền và cơ chế xử lý đồng thời.
- Lưu ngày và giờ chính thức.
- Ghi lịch sử xác nhận và người thực hiện.
- Ghi nhận khách đã đồng ý với giờ hẹn theo dữ liệu xác nhận thực tế.
- Cập nhật danh sách và dashboard.

Không bắt buộc tạo sự kiện liên hệ riêng trước khi xác nhận.

Không tự ghi kênh liên hệ là Điện thoại hoặc Zalo nếu hệ thống không biết kênh thực tế.

### 4.2. Popup Chốt lịch nhanh

Thiết kế popup hoặc side panel ngắn gọn gồm:

**Thông tin chỉ đọc:**

- Khách hàng, số điện thoại.
- Xe và dịch vụ.
- Ngày/buổi khách đã yêu cầu.

**Thông tin nhập:**

- Ngày hẹn chính thức, mặc định theo ngày khách yêu cầu.
- Giờ hẹn chính thức, bắt buộc nhập hoặc chủ động chọn.
- Ghi chú nội bộ, không bắt buộc.

**Nút chính:** `Xác nhận lịch hẹn`.

Không yêu cầu cố vấn nhập lý do mặc định như "Đã liên hệ và thống nhất giờ hẹn".

Không thêm checkbox nếu hành động xác nhận đã thể hiện rõ rằng cố vấn đang chốt giờ đã thống nhất với khách. Tuy nhiên, backend vẫn phải xác thực điều kiện nghiệp vụ tương ứng.

Đặc biệt:

- Không tự điền giờ kỹ thuật của buổi sáng/chiều vào trường giờ chính thức.
- Với lịch chưa có giờ thỏa thuận, trường giờ phải để trống.
- Không cho lưu nếu giờ không hợp lệ.
- Hiển thị cảnh báo quá tải, trùng lịch cố vấn hoặc ngoài giờ trước khi xác nhận cuối cùng.
- Cảnh báo công suất không tự động khóa xác nhận.
- Tránh tạo thêm hộp thoại xác nhận thứ hai khi không có cảnh báo.

### 4.3. Xử lý chưa liên hệ được

Thêm thao tác nhanh **Chưa liên hệ được**.

Khi cố vấn chọn:

- Ghi nhận một lần liên hệ không thành công.
- Tăng số lần liên hệ nếu có dữ liệu tương ứng.
- Giữ trạng thái `PENDING`.
- Cho phép nhập thời điểm cần gọi lại, không bắt buộc nếu nghiệp vụ chưa yêu cầu.
- Đưa vào nhóm cần liên hệ lại.

Không bắt buộc nhập ghi chú dài.

**Quan trọng:** Báo cáo cho thấy thao tác lưu liên hệ hiện tự gán lịch cho cố vấn. Hãy rà soát và điều chỉnh rõ ràng cơ chế này.

Đề xuất:

- Có thao tác nhận xử lý rõ ràng khi cần.
- Không bắt cố vấn nhấn Nhận xử lý trước khi Chốt lịch.
- Chốt lịch thành công có thể tự nhận lịch trong cùng transaction.
- Với lịch chưa liên hệ được, đảm bảo không bị bỏ quên hoặc mất khỏi hàng chờ chung ngoài ý muốn.
- Giữ khả năng quản lý phân công và chuyển cố vấn.

### 4.4. Đổi lịch và hủy lịch

Đối với lịch đã xác nhận:

- **Đổi giờ:** Mở popup nhỏ, chọn ngày/giờ mới, ghi chú lý do nếu cần.
- **Hủy lịch:** Mở hộp thoại ngắn, hiển thị đúng khách/xe/lịch và chọn hoặc nhập lý do thực tế.

Không sử dụng lý do cố định "Khách yêu cầu hủy" cho mọi trường hợp.

Đảm bảo lưu lịch sử thay đổi.

Với lịch đang `PENDING`, khi khách đồng ý một ngày/giờ mới, cố vấn có thể xác nhận trực tiếp bằng popup Chốt lịch, không phải Đổi lịch rồi Xác nhận lịch thêm một lần.

Không thay đổi các thao tác hủy phiếu dịch vụ sau tiếp nhận.

## 5. PHASE 3 — Tối ưu tạo lịch nội bộ

Hiện tại, cố vấn tạo lịch thủ công đã nhập giờ cụ thể nhưng lịch vẫn ở `PENDING`, sau đó phải xác nhận một lần nữa.

Cần hỗ trợ hai lựa chọn:

**Tạo yêu cầu chờ xác nhận:** Khi chưa thống nhất giờ với khách.

**Tạo và xác nhận:** Khi cố vấn đã trao đổi và thống nhất ngày/giờ chính thức.

Với lựa chọn thứ hai, hệ thống:

- Tạo lịch.
- Gán cố vấn.
- Lưu giờ chính thức.
- Chuyển thẳng sang `CONFIRMED`.
- Ghi lịch sử trong cùng transaction.

Không bắt buộc tạo lịch chờ rồi gửi thêm request xác nhận nếu có thể xử lý an toàn trong một transaction.

Tái sử dụng form hiện có, chỉ bổ sung hoặc điều chỉnh hành vi cần thiết.

## 6. PHASE 4 — Tối ưu tiếp nhận xe

Tập trung giảm nhập liệu trùng lặp, không bỏ qua các điều kiện kiểm soát hiện có.

### 6.1. Tự điền dữ liệu

Khi cố vấn nhấn **Tiếp nhận xe** từ lịch đã xác nhận, tự lấy:

- Thông tin khách hàng.
- Số điện thoại.
- Xe và biển số đã biết.
- Danh sách dịch vụ.
- Yêu cầu/ghi chú khách đã cung cấp.
- Cố vấn đang phụ trách.

Không bắt nhân viên nhập lại dữ liệu đã có.

### 6.2. Giao diện tiếp nhận nhanh

Ưu tiên các nhóm:

**Nhóm 1 — Xác minh xe**

Hiển thị khách/xe hiện có, cho phép điều chỉnh khi xe thực tế khác thông tin đã đặt.

**Nhóm 2 — Thông tin tiếp nhận**

- ODO hoặc lý do không ghi được.
- Yêu cầu thực tế của khách.
- Ghi chú tình trạng xe khi cần.

**Nhóm 3 — Kiểm tra và hình ảnh**

Hiển thị dạng mở rộng/thu gọn các mục kiểm tra ngoại thất, nội thất, vận hành và hình ảnh.

Không bắt cố vấn mở hoặc điền mọi nhóm tùy chọn nếu chưa có dữ liệu cần ghi nhận.

### 6.3. Hoàn tất tiếp nhận

Nút chính: **Hoàn tất tiếp nhận**.

Một lần lưu thành công phải:

- Đảm bảo điều kiện xác minh khách/xe.
- Lưu dữ liệu tiếp nhận.
- Tạo đúng một phiếu dịch vụ.
- Chuyển lịch sang `ARRIVED`.
- Điều hướng đến phiếu dịch vụ.

Giữ nguyên các kiểm tra quan trọng như ODO, xe khác thực tế, biển số thiếu, quyền cố vấn và xe đang có phiếu chưa đóng.

Không tự đánh dấu đã đối chiếu xe khi nhân viên chưa thực sự xác minh.

Không xóa bước kiểm tra ban đầu, báo giá, nghiệm thu hoặc bàn giao trong nghiệp vụ phiếu dịch vụ.

## 7. PHASE 5 — Cải thiện API và xử lý dữ liệu

Rà soát API, service và schema hiện tại để hỗ trợ các luồng thao tác nhanh.

Yêu cầu:

1. Ưu tiên tái sử dụng API hiện có.
2. Nếu cần API tổng hợp, đảm bảo các bước tạo/cập nhật nghiệp vụ được xử lý trong transaction.
3. Giữ kiểm tra quyền và optimistic concurrency hoặc cơ chế tương đương.
4. Không để hai cố vấn cùng nhận hoặc chốt một lịch không hợp lệ.
5. Tách rõ ngày/buổi khách yêu cầu và giờ cố vấn xác nhận.
6. Không dùng giờ kỹ thuật làm giờ hẹn chính thức.
7. Kiểm tra trùng lịch cố vấn theo khoảng thời gian dự kiến, không chỉ trùng thời điểm bắt đầu.
8. Chuyển cảnh báo quá tải, trùng giờ, ngoài giờ sang bước trước khi lưu khi khả thi.
9. Các cảnh báo không mang tính chặn phải cho phép nhân viên tiếp tục theo quyền.
10. Đảm bảo UI phản ánh đúng kết quả API, không đóng popup như thành công nếu request thất bại.
11. Đảm bảo dữ liệu lịch sử, booking và phiếu dịch vụ luôn nhất quán.
12. Không thay đổi quy tắc không giới hạn số yêu cầu đặt lịch theo buổi.

Nếu có thay đổi schema, tạo migration phù hợp và xử lý dữ liệu lịch cũ an toàn.

## 8. PHASE 6 — Đồng bộ trang quản lý `/dieu-hanh`

Sau khi thay đổi luồng cố vấn, rà soát những thành phần liên quan tại `/dieu-hanh`.

Yêu cầu:

- Danh sách lịch và trạng thái thống nhất với `/co-van`.
- Quản lý vẫn có thể phân công hoặc chuyển cố vấn.
- Có thể xem yêu cầu chưa phân công và yêu cầu tồn đọng.
- Khi quản lý xác nhận hoặc đổi lịch, sử dụng logic nghiệp vụ thống nhất.
- Giữ quyền truy cập toàn trạm theo phân quyền hiện có.
- Không làm lại toàn bộ dashboard quản lý.
- Không thay đổi các module điều hành không liên quan.

## 9. Kiểm thử bắt buộc

Sau khi chỉnh sửa, kiểm tra tối thiểu:

1. Khách gửi lịch sáng/chiều và hệ thống lưu `PENDING`.
2. Nhiều khách đặt cùng một buổi không bị khóa do số lượng.
3. Lịch đặt ngày tương lai xuất hiện trong nhóm Cần xử lý.
4. Cố vấn chốt lịch trong một lần lưu.
5. Chưa liên hệ được vẫn có thể tiếp tục xử lý sau.
6. Hai cố vấn đồng thời xử lý một lịch không gây ghi đè.
7. Đổi lịch đã xác nhận ghi nhận đúng giờ mới và lịch sử.
8. Hủy lịch sử dụng lý do thực tế.
9. Tạo lịch nội bộ và xác nhận trong một lần lưu.
10. Tiếp nhận xe tự điền dữ liệu đã có.
11. Hoàn tất tiếp nhận không tạo trùng phiếu dịch vụ.
12. Cảnh báo quá tải/trùng giờ hiển thị đúng và không chặn sai.
13. Backend trả lỗi thì UI không hiển thị thao tác thành công.
14. Phân quyền cố vấn và quản lý vẫn hoạt động đúng.
15. Các luồng báo giá, thi công và bàn giao hiện có không bị ảnh hưởng.

Chạy TypeScript check, lint, build và các bài test liên quan. Với những bài kiểm thử không thể chạy, ghi rõ lý do.

## 10. Phạm vi không thực hiện

- Không tích hợp Zalo API/OA trong đợt này.
- Không triển khai thêm tính năng CRM mới ngoài quy trình đang tối ưu.
- Không thiết kế lại module kho và tài chính.
- Không bỏ qua các bước xác minh, phê duyệt hoặc kiểm soát nghiệp vụ quan trọng.
- Không thay đổi toàn bộ kiến trúc backend nếu không cần.
- Không xóa dữ liệu hoặc reset database hiện tại.
- Không triển khai production hoặc chạy migration production khi chưa được yêu cầu.

## 11. Yêu cầu kết quả

Hãy **trực tiếp chỉnh sửa source code**, không chỉ viết kế hoạch hoặc đề xuất.

Thực hiện tuần tự từng phase, đảm bảo phase trước hoạt động ổn định trước khi chuyển sang phase tiếp theo.

Nếu phát hiện kiến trúc thực tế khác báo cáo `datlich.md`, ưu tiên source code đang tồn tại và điều chỉnh cách triển khai phù hợp, nhưng không thay đổi các mục tiêu nghiệp vụ đã nêu.

Cuối cùng:

- Liệt kê những chức năng đã chỉnh sửa.
- Liệt kê các file chính bị thay đổi.
- Nêu những API hoặc migration được thêm/sửa.
- Báo cáo kết quả kiểm thử thực tế.
- Nêu rõ những điểm còn tồn tại hoặc chưa hoàn thành.
- Hướng dẫn chạy thử ngắn gọn.

**Chỉ xuất một file báo cáo duy nhất:** `BOOKING_WORKFLOW_OPTIMIZATION_REPORT.md`.

Không tạo nhiều file Markdown báo cáo không cần thiết.

### Tiêu chí hoàn thành

Cố vấn có thể thực hiện luồng thông thường:

**Mở hàng chờ → Gọi khách → Chốt lịch bằng một lần lưu → Khách đến → Tiếp nhận xe → Mở phiếu dịch vụ.**

Mọi thao tác thường xuyên phải nhanh, dễ nhận biết và ít bước. Giao diện không rườm rà, không nhập lại thông tin đã có, nhưng vẫn đảm bảo tính chính xác của dữ liệu và an toàn nghiệp vụ.