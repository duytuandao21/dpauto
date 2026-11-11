# DPAuto – Tài liệu yêu cầu hệ thống đặt lịch và quản lý dịch vụ

> **Loại tài liệu:** Business & Functional Requirements (BRD/FRD)  
> **Phiên bản:** 1.0 – Bản dự thảo để rà soát nghiệp vụ  
> **Ngày cập nhật:** 09/11/2026  
> **Sản phẩm:** DPAuto – Trạm dịch vụ ô tô Toàn Trung  
> **Phạm vi:** Website khách hàng, đặt lịch, cổng tra cứu lịch sử/trạng thái và trang quản lý dành cho nhân viên  
> **Định hướng:** Mobile-first cho cố vấn dịch vụ; sẵn sàng tích hợp Zalo OA về sau

---

## 1. Tổng quan và mục tiêu

DPAuto xây dựng **hệ thống đặt lịch và theo dõi dịch vụ độc lập**, thay thế quy trình quản lý lịch hẹn cũ. Khách hàng có thể đặt lịch trực tuyến, tra cứu các lần làm dịch vụ và theo dõi tiến độ xe; nhân viên tiếp nhận, quản lý, cập nhật lịch được phân công; quản lý điều phối lịch và giám sát hoạt động toàn trạm.

### 1.1. Mục tiêu

1. Khách đặt lịch thuận tiện mà không cần đăng ký tài khoản.
2. Quản lý phân công lịch rõ ràng; mỗi cố vấn chỉ thao tác trên lịch được giao.
3. Giúp cố vấn xem lịch hiện tại và lịch sử công việc của mình, giảm nhầm lẫn khi nhiều người cùng sử dụng.
4. Chủ động kiểm soát năng lực tiếp nhận theo ngày/khung giờ, tránh quá tải.
5. Cho khách theo dõi **trạng thái thực tế của xe** và lịch sử dịch vụ được phép công bố.
6. Lưu vết thay đổi để phục vụ đối soát, xử lý khiếu nại và chăm sóc hậu mãi.

### 1.2. Phạm vi phiên bản đầu tiên (MVP)

**Bao gồm:** Website giới thiệu và đặt lịch; kiểm soát khung giờ; quản lý và phân công lịch; cập nhật trạng thái đặt lịch và tiến độ xe ở mức cơ bản; quản lý khách hàng/xe; lịch sử dịch vụ tóm tắt; tra cứu an toàn; thông báo nội bộ; báo cáo cơ bản; phân quyền và nhật ký thao tác.

**Chưa bao gồm:** Quản lý kho, mua hàng, chấm công, tính lương, phiếu sửa chữa kỹ thuật chi tiết, thanh toán trực tuyến, hóa đơn điện tử, ứng dụng Android/iOS native, tự động hóa Zalo OA (để giai đoạn sau).

> **Ranh giới nghiệp vụ:** MVP theo dõi các *mốc tiến độ dịch vụ* do cố vấn cập nhật; không tự động suy ra tiến độ sửa chữa từ thiết bị hay hệ thống khác. Lịch sử dịch vụ chỉ phản ánh dữ liệu đã được DPAuto ghi nhận/xác thực, không mặc định có toàn bộ lịch sử trước khi hệ thống đi vào hoạt động.

---

## 2. Vai trò và nguyên tắc phân quyền

Trang quản lý có **đúng 2 vai trò nghiệp vụ**:

| Vai trò | Mô tả |
|---|---|
| **Quản lý (Manager)** | Theo dõi toàn trạm, tạo/chỉnh lịch, phân công/đổi cố vấn, cấu hình lịch nhận xe, kiểm tra báo cáo và xử lý trường hợp đặc biệt. |
| **Cố vấn dịch vụ (Advisor)** | Tiếp nhận và xử lý lịch **đang được phân công cho chính mình**, cập nhật trạng thái, thông tin phục vụ và xem lịch sử công việc của mình. |

Khách hàng là người dùng công khai của website, **không phải vai trò đăng nhập trong trang quản lý**.

### 2.1. Ma trận phân quyền

| Chức năng | Quản lý | Cố vấn dịch vụ |
|---|:---:|:---:|
| Xem lịch toàn trạm | ✅ | Không; chỉ lịch được giao |
| Xem lịch của mình | ✅ | ✅ |
| Tạo lịch trong Admin | ✅ | ✅ |
| Chỉnh sửa lịch được giao | ✅ | ✅ |
| Chỉnh sửa lịch của cố vấn khác | ✅ | ❌ |
| Xác nhận/đổi/hủy lịch được giao | ✅ | ✅ |
| Cập nhật trạng thái xe của lịch được giao | ✅ | ✅ |
| Phân công / chuyển cố vấn phụ trách | ✅ | ❌ |
| Xem lịch sử của mọi cố vấn | ✅ | ❌ |
| Xem lịch sử lịch đã từng phụ trách của mình | ✅ | ✅ (chỉ đọc nếu đã chuyển giao) |
| Quản lý giờ làm, ngày nghỉ, sức chứa khung giờ | ✅ | ❌ |
| Xem báo cáo toàn trạm | ✅ | ❌ |
| Xem thống kê cá nhân | ✅ | ✅ |
| Quản lý tài khoản và quyền nhân viên | ✅ | ❌ |
| Điều chỉnh lịch đã hoàn thành / mở lại hồ sơ | ✅, có lý do | ❌ |
| Xem nhật ký kiểm toán toàn trạm | ✅ | Chỉ sự kiện thuộc lịch được phép xem |

**Quy tắc bắt buộc:**

- Phân quyền kiểm tra tại **backend cho từng API và từng bản ghi**, không dựa vào việc ẩn nút trên giao diện.
- Một lịch có **một cố vấn chịu trách nhiệm chính tại một thời điểm**; cho phép ghi nhận người hỗ trợ sau này nhưng không thay quyền chính.
- Lịch khách tự gửi và chưa được phân công nằm trong **hàng đợi chung**: quản lý xem/nhận phân công; cố vấn chỉ thấy khi đã được giao. Nếu muốn cố vấn được “nhận lịch” từ hàng đợi, đây là thay đổi chính sách cần duyệt riêng.
- Khi quản lý chuyển lịch từ cố vấn A sang B: A mất quyền chỉnh sửa ngay; B nhận quyền xử lý; A vẫn xem được bản tóm tắt và lịch sử **các thao tác do mình thực hiện** để đối soát, nhưng không được thấy các ghi chú riêng phát sinh sau khi chuyển nếu không còn quyền.
- Lịch do cố vấn tự tạo mặc định giao cho chính cố vấn đó; lịch do quản lý tạo phải chỉ định cố vấn hoặc để chờ phân công.

---

## 3. Quy trình nghiệp vụ chuẩn

### 3.1. Khách đặt lịch từ website

1. Khách mở `/dat-lich` qua website hoặc mã QR.
2. Chọn nhóm dịch vụ, ngày và khung giờ còn cho phép tiếp nhận.
3. Nhập họ tên, số điện thoại, thông tin xe (nếu có), yêu cầu bổ sung.
4. Đồng ý thông báo xử lý dữ liệu cần thiết; lựa chọn nhận nội dung quảng cáo là **tùy chọn tách biệt**, không tích sẵn.
5. Backend xác thực dữ liệu, chống spam/chống trùng và kiểm tra lại sức chứa.
6. Hệ thống tạo **yêu cầu đặt lịch – Chờ xác nhận** và mã tra cứu không có thông tin nhạy cảm.
7. Quản lý phân công cố vấn; cố vấn liên hệ khách và xác nhận giờ phù hợp hoặc đề xuất thay thế.
8. Khi khách đến, cố vấn chuyển trạng thái “Đã đến”, bắt đầu theo dõi tiến độ dịch vụ.
9. Khi hoàn tất, cố vấn ghi nhận dịch vụ đã làm, ngày phục vụ, ODO nếu có và mốc bảo dưỡng nếu có; đánh dấu hoàn thành và công bố phần tóm tắt cho khách.

> Khách chọn khung giờ là **yêu cầu**, không đồng nghĩa lịch đã được DPAuto chấp thuận. Màn hình thành công phải ghi rõ “Đã nhận yêu cầu – đang chờ xác nhận”.

### 3.2. Lịch tạo bởi nhân viên

- Quản lý/cố vấn tạo lịch cho khách gọi điện, Fanpage, Zalo hoặc đến trực tiếp.
- Bắt buộc ghi **nguồn tạo** và người tạo; áp dụng quy tắc kiểm tra trùng và giới hạn tiếp nhận tương tự website.
- Trường hợp khách đến không hẹn có thể dùng thao tác “Tiếp nhận ngay”, đồng thời ghi lý do khi vượt ngưỡng tiếp nhận.

### 3.3. Đổi lịch, hủy lịch, khách không đến

- Cố vấn được giao có thể đổi/hủy lịch trong phạm vi quyền; lưu **giờ cũ, giờ mới, lý do, người thao tác và thời điểm**.
- Khi đổi giờ phải kiểm tra khả năng tiếp nhận ở giờ mới; giờ cũ chỉ được giải phóng khi cập nhật thành công.
- “Không đến” chỉ ghi nhận với lịch **đã xác nhận** và đã qua giờ hẹn cộng thời gian chờ do quản lý cấu hình; không tự động đánh dấu nếu chưa được kiểm tra.
- Khi khung giờ được giải phóng, hệ thống có thể gợi ý khách đang chờ/chấp nhận đổi sang giờ sớm hơn; **không tự thay lịch** khi chưa liên hệ và được khách đồng ý.

---

## 4. Trạng thái: tách lịch hẹn khỏi tiến độ xe

Để khách phân biệt rõ “lịch đã được duyệt chưa?” và “xe đang được làm đến đâu?”, cần hai nhóm trạng thái độc lập.

### 4.1. Trạng thái lịch hẹn (`booking_status`)

| Trạng thái | Ý nghĩa | Chuyển trạng thái hợp lệ |
|---|---|---|
| `PENDING` – Chờ xác nhận | Khách đã gửi yêu cầu | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` – Đã xác nhận | Cố vấn và khách đã thống nhất thời gian | `ARRIVED`, `CANCELLED`, `NO_SHOW` |
| `ARRIVED` – Đã đến | Khách/xe đã đến trạm | `COMPLETED` (khi đủ điều kiện kết thúc) |
| `COMPLETED` – Hoàn thành | Đã kết thúc lượt phục vụ | Trạng thái kết thúc; sửa/mở lại chỉ quản lý |
| `CANCELLED` – Đã hủy | Không tiếp tục lịch | Kết thúc; nếu đặt lại nên tạo lịch mới hoặc lịch nối tiếp có liên kết |
| `NO_SHOW` – Không đến | Khách không đến sau thời gian chờ | Kết thúc; tạo lịch mới khi khách hẹn lại |

“Đang đề xuất giờ khác” là **tình trạng trao đổi/xử lý** (`contact_outcome`) kèm giờ đề xuất, không nhất thiết là trạng thái lịch hẹn chính. Lịch có thể chờ xác nhận trong thời gian thương lượng.

### 4.2. Tiến độ dịch vụ của xe (`service_progress`)

Chỉ áp dụng khi lịch đã chuyển sang `ARRIVED`. Đề xuất các mốc:

| Mốc | Hiển thị cho khách | Ghi chú |
|---|---|---|
| `RECEIVED` | Đã tiếp nhận xe | Mặc định khi đánh dấu khách đến |
| `INSPECTING` | Đang kiểm tra xe | Cố vấn cập nhật theo thông tin tại trạm |
| `WAITING_APPROVAL` | Chờ xác nhận phương án dịch vụ | Chỉ hiển thị khi thực sự cần khách duyệt/trao đổi |
| `IN_SERVICE` | Đang thực hiện dịch vụ | Không cam kết thời gian xong nếu chưa xác nhận |
| `QUALITY_CHECK` | Đang kiểm tra hoàn tất | Kiểm tra/chuẩn bị bàn giao |
| `READY_FOR_PICKUP` | Xe đã sẵn sàng bàn giao | Có thể liên hệ khách nhận xe |
| `HANDED_OVER` | Đã bàn giao xe | Kết thúc tiến độ; chuyển lịch sang `COMPLETED` |

**Yêu cầu:**

- Không mặc định “Đang sửa chữa” ngay sau khi xác nhận lịch.
- Có thể bỏ qua các bước không áp dụng (ví dụ dịch vụ nhanh), nhưng phải lưu lịch sử; không tự tạo các bước giả.
- Cho phép cố vấn bổ sung **ghi chú nội bộ** và **cập nhật công khai** riêng; ghi chú nội bộ không được rò rỉ sang website khách.
- Thời gian dự kiến hoàn tất là **tùy chọn**, do cố vấn xác nhận và có nhãn “dự kiến”.
- Nếu làm dịch vụ bị tạm dừng/chờ phụ tùng, có thể ghi lý do nội bộ hoặc công khai phù hợp; chưa cần workflow quản lý phụ tùng ở MVP.

---

## 5. Trang đặt lịch dành cho khách hàng

### 5.1. Trường dữ liệu

| Trường | Bắt buộc | Quy tắc |
|---|:---:|---|
| Họ và tên | ✅ | Giới hạn độ dài, loại bỏ đầu vào không hợp lệ |
| Số điện thoại | ✅ | Chuẩn hóa, xác thực định dạng số Việt Nam |
| Dịch vụ | ✅ | Chọn 1 hoặc nhiều dịch vụ từ danh mục đang hoạt động |
| Ngày và khung giờ mong muốn | ✅ | Chỉ cho chọn khung còn khả năng tiếp nhận theo chính sách |
| Hãng/dòng xe | Khuyến nghị | Có thể điền sau nếu khách chưa nhớ |
| Biển số xe | Không | Chuẩn hóa; không dùng làm định danh chính |
| Mô tả nhu cầu | Không | Giới hạn ký tự; không yêu cầu dữ liệu nhạy cảm |
| Nguồn đặt lịch | Tự động | Website/QR showroom/QR garage/chiến dịch... |
| Thông báo quyền riêng tư | ✅ | Cung cấp thông tin xử lý dữ liệu, lưu bằng chứng khi cần |
| Nhận khuyến mãi | Không | Tùy chọn riêng; không mặc định đồng ý |

### 5.2. Hành vi giao diện

- Mobile-first; tải nhanh; không yêu cầu tài khoản.
- Chọn dịch vụ → ngày/giờ → thông tin liên hệ → xác nhận.
- Ngày/khung giờ hết chỗ bị vô hiệu hóa và có giải thích “Đã đủ lịch tiếp nhận”. Có thể đề xuất **khung giờ gần nhất còn chỗ**.
- Hiển thị các khung giờ theo giờ hoạt động và ngày nghỉ của trạm.
- Sau khi gửi: hiển thị mã lịch, thời gian yêu cầu và trạng thái **Chờ xác nhận**.
- Nếu hết chỗ ngay trong lúc gửi do người khác đặt/xác nhận: backend trả lỗi rõ ràng để khách chọn khung khác.

### 5.3. Quy tắc giới hạn công khai

- Quản lý có thể cấu hình **ẩn/đóng khung giờ** theo ngày, nhóm dịch vụ hoặc lịch nghỉ.
- Không hiển thị chi tiết lịch hay tên/số điện thoại khách khác.
- Có thể cho phép “Đề nghị được liên hệ khi có chỗ” khi hết lịch; đây là **danh sách chờ**, không phải lịch xác nhận.

---

## 6. Quản lý sức chứa và quá tải

### 6.1. Cấu hình quản lý

- Giờ hoạt động theo thứ/ngày, giờ nghỉ trưa, ngày lễ, lịch nghỉ đột xuất.
- Khung giờ tiếp nhận (ví dụ 30/60 phút), số lượng tiếp nhận tối đa cho từng khung.
- Cho phép cấu hình theo nhóm dịch vụ nếu vận hành yêu cầu (ví dụ chăm sóc xe, sửa chữa, lắp đặt phụ kiện).
- Thời gian tối thiểu phải đặt trước; số ngày tối đa cho phép đặt trước.
- Ngưỡng cảnh báo gần đầy và chế độ tạm ngừng nhận lịch.

### 6.2. Chính sách kiểm soát sức chứa – đề xuất

1. **Suất đã xác nhận** chiếm sức chứa chính thức.
2. Yêu cầu `PENDING` không giữ suất vô thời hạn. Để tránh quá nhiều yêu cầu gây thất vọng, hệ thống dùng **hạn mức yêu cầu đang chờ** cho từng khung hoặc cơ chế giữ suất ngắn hạn có thời hạn; chính sách cụ thể do quản lý chọn.
3. Website không cho gửi yêu cầu mới khi khung bị đóng/đã chạm giới hạn công khai; quản lý có thể mở thêm sức chứa hoặc tiếp nhận ngoại lệ có lý do.
4. Tại thời điểm **xác nhận hoặc đổi lịch**, backend phải kiểm tra sức chứa lại trong **transaction có khóa/kiểm soát đồng thời**; không thể để hai cố vấn cùng nhận suất cuối cùng.
5. Khi khách hủy/không đến, suất đã xác nhận được giải phóng; có thể gợi ý khách chờ phù hợp.
6. Không đồng nhất số suất tiếp nhận với số cầu nâng hoặc thời gian hoàn tất dịch vụ. Đây là giới hạn **tiếp nhận xe**, không phải lịch phân công kỹ thuật viên.

> **Quyết định cần xác nhận trước khi code:** Với lịch `PENDING`, trạm muốn (A) giữ suất tạm trong X phút, hay (B) không giữ suất và chỉ giới hạn số yêu cầu chờ? **Đề xuất MVP: B**, kèm thông báo minh bạch “giờ mong muốn chưa được giữ chỗ”.

---

## 7. Các màn hình trang quản lý (`/quanly`)

### 7.1. Dashboard

- Số lịch hôm nay, chờ xác nhận, đã xác nhận, xe đã đến, đang phục vụ, hoàn thành, hủy/không đến.
- **Quản lý:** thống kê toàn trạm, tất cả lịch chờ phân công, cảnh báo quá tải.
- **Cố vấn:** lịch của mình, yêu cầu cần xử lý, lịch sắp đến, xe đang làm và lịch sử của mình.
- Bộ lọc ngày và thao tác tạo lịch nhanh.

### 7.2. Lịch theo ngày/tuần

- Xem lịch theo giờ, trạng thái và cố vấn; tìm theo số điện thoại, biển số, tên, mã lịch.
- Quản lý có bộ lọc cố vấn và xem toàn trạm; cố vấn chỉ có dữ liệu được giao.
- Chỉ báo sức chứa/khung đã đầy; thay đổi giờ bằng thao tác có xác nhận (chưa cần kéo thả ở MVP).

### 7.3. Danh sách lịch

- Các tab: Cần xử lý, Sắp tới, Đã đến/Đang phục vụ, Hoàn thành, Đã hủy/Không đến.
- Mỗi lịch hiển thị: mã, khách, xe, dịch vụ, giờ yêu cầu, giờ xác nhận, trạng thái, cố vấn phụ trách, nguồn.
- Nhấn vào thẻ để mở chi tiết; trên mobile dùng trang/drawer toàn màn hình.

### 7.4. Chi tiết lịch

- **Thông tin khách và xe**; **yêu cầu dịch vụ**; **lịch hẹn**; **cố vấn**; **tiến độ xe**; **lịch sử thay đổi**.
- Hành động theo quyền: xác nhận, đề xuất đổi giờ, đổi/hủy, đánh dấu đến, cập nhật tiến độ, hoàn thành; quản lý được phân/chuyển lịch.
- Tách ghi chú nội bộ và cập nhật công khai cho khách.
- Mọi thao tác lưu người thực hiện, thời gian và dữ liệu trước/sau.

### 7.5. Lịch sử công việc của cố vấn

- Tìm kiếm, lọc theo ngày, trạng thái, nhóm dịch vụ.
- Hiển thị lịch hiện đang phụ trách và lịch **đã từng phụ trách** (có nhãn “Đã chuyển giao”).
- Lịch đã chuyển giao chỉ hiển thị dữ liệu đủ để đối soát nhiệm vụ trước đó, không được chỉnh sửa.
- Thống kê cá nhân: số lịch đã xử lý, đến đúng hẹn, không đến, hoàn thành. Không biến báo cáo thành chấm công/tính lương ở MVP.

### 7.6. Quản lý khách hàng và phương tiện

- Quản lý hồ sơ liên hệ, danh sách xe, lịch sử hẹn và lịch sử dịch vụ đã công bố.
- Cố vấn chỉ xem/sửa trong phạm vi lịch được giao và thông tin cần xử lý; không có quyền duyệt toàn bộ cơ sở dữ liệu khách hàng.
- Gộp hồ sơ trùng phải có cơ chế xác minh và ghi audit; không tự gộp chỉ dựa vào biển số.

### 7.7. Cấu hình (chỉ Quản lý)

- Nhân sự, tài khoản, trạng thái hoạt động.
- Khung giờ, sức chứa, ngày nghỉ, khoảng thời gian đặt trước, thời gian chờ khách không đến.
- Danh mục nhóm dịch vụ phục vụ đặt lịch, thời gian tiếp nhận dự kiến.
- Thiết lập nội dung trạng thái công khai, cơ chế thông báo nội bộ.

### 7.8. Yêu cầu UI/UX

- **Mobile-first**, tối ưu điện thoại và tablet trước; desktop có lịch toàn trạm và bảng tổng hợp.
- Ưu tiên thao tác một tay, nút đủ lớn, trạng thái rõ màu + chữ (không chỉ màu).
- Có nút **Tạo lịch** nhanh và cảnh báo yêu cầu chờ xử lý.
- Tối đa 2–3 thao tác phổ biến để xác nhận/đánh dấu khách đến; xác nhận lại với thao tác hủy/chuyển giao.
- Hỗ trợ loading/error/empty state, kiểm soát mất kết nối và tránh gửi lặp.

---

## 8. Trang khách hàng: lịch sử và trạng thái xe

### 8.1. Nguyên tắc riêng tư bắt buộc

**Không cho phép bất kỳ ai chỉ nhập biển số hoặc số điện thoại là xem được toàn bộ lịch sử xe, tên khách, chi tiết dịch vụ hoặc trạng thái nhạy cảm.** Biển số có thể nhìn thấy công khai và số điện thoại có thể bị biết bởi bên thứ ba.

**Luồng đề xuất:**

1. Khách nhập **số điện thoại hoặc biển số** để **khởi tạo tra cứu**.
2. Hệ thống thực hiện xác minh quyền xem, ưu tiên **OTP gửi tới số điện thoại đã gắn với hồ sơ/lịch** hoặc liên kết truy cập riêng có hạn, có kiểm soát. Nếu tìm bằng biển số, vẫn yêu cầu xác minh chủ thể có quyền.
3. Sau khi xác minh thành công, cấp phiên tra cứu ngắn hạn, giới hạn những lịch/xe mà người này có quyền xem.
4. Hiển thị lịch hẹn hiện tại, tiến độ dịch vụ công khai và lịch sử dịch vụ tóm tắt.
5. Cho phép đăng xuất/đóng phiên; giới hạn thử OTP, chống dò đoán và không tiết lộ có/không tồn tại số điện thoại hoặc biển số trước khi xác minh.

> Nếu chưa triển khai được OTP/định danh an toàn trong MVP, **chưa mở tra cứu lịch sử theo số điện thoại/biển số công khai**. Phương án thay thế tạm thời: khách nhận **liên kết theo từng lịch có token ngẫu nhiên, khó đoán, có thời hạn**, chỉ xem đúng lịch được cấp và dữ liệu tối thiểu.

### 8.2. Nội dung khách được xem

| Nhóm | Hiển thị |
|---|---|
| Lịch sắp tới | Ngày giờ yêu cầu/đã xác nhận, địa chỉ trạm, nhóm dịch vụ, trạng thái lịch |
| Xe đang tại trạm | Tiến độ dịch vụ hiện tại, mốc cập nhật gần nhất, thông báo công khai từ cố vấn, thời gian hoàn tất dự kiến nếu có |
| Lịch sử | Ngày sử dụng dịch vụ, xe, nhóm công việc/tóm tắt đã xác nhận, kết quả và mốc bảo dưỡng tiếp theo nếu có |
| Hỗ trợ | Hotline/Zalo, cách yêu cầu sửa thông tin, liên hệ khi có lịch sai |

**Không hiển thị:** ghi chú nội bộ, thông tin quản trị/phân công nhạy cảm, thông tin xe của khách khác, giá vốn hay các trường chưa được công bố.

### 8.3. Sự khác biệt giữa “lịch sử lịch hẹn” và “lịch sử dịch vụ”

- **Lịch sử lịch hẹn:** đã đặt, đã xác nhận, hủy, không đến, đã đến.
- **Lịch sử dịch vụ:** những lượt xe **thực sự được phục vụ**, có tóm tắt công việc và thời điểm kết thúc.
- Không tạo lịch sử “đã sửa chữa” chỉ vì lịch hẹn chuyển sang `CONFIRMED` hoặc `ARRIVED`.
- Có thể bổ sung dữ liệu lịch sử cũ qua import được kiểm tra sau này, cần đánh dấu nguồn nhập và độ tin cậy.

---

## 9. Thông báo và chăm sóc sau dịch vụ

### MVP

- Thông báo nội bộ khi có lịch mới được phân công, lịch cần xác nhận, lịch sắp đến, lịch đổi/hủy và khung giờ quá tải.
- Nhắc cố vấn kiểm tra khách chưa đến; không tự động thay trạng thái khi chưa xác minh.
- Có log sự kiện và danh sách cần liên hệ thủ công.

### Giai đoạn Zalo OA

- Xác nhận lịch, đổi/hủy, nhắc trước giờ hẹn, thông báo xe sẵn sàng bàn giao, nhắc bảo dưỡng/hậu mãi.
- Chuẩn bị `notification_jobs`, trạng thái gửi, chống gửi trùng, retry có giới hạn, webhook.
- Tin giao dịch/dịch vụ và tin khuyến mãi phải được phân loại riêng, áp dụng chính sách nền tảng và căn cứ đồng ý phù hợp.
- Lỗi gửi Zalo **không được làm thất bại giao dịch xác nhận lịch**.

---

## 10. Dữ liệu và cấu trúc nghiệp vụ tối thiểu

| Thực thể | Vai trò |
|---|---|
| `users`, `staff_profiles`, `user_roles` | Tài khoản nhân viên; đúng 2 vai trò quản lý/cố vấn |
| `customers` | Thông tin khách liên hệ |
| `vehicles` | Xe được liên kết với hồ sơ khách (định danh nội bộ; biển số không phải khóa chính) |
| `service_categories` / `services` | Nhóm dịch vụ cho phép đặt |
| `bookings` | Yêu cầu và lịch hẹn; mã, thời gian yêu cầu/xác nhận, trạng thái, nguồn, cố vấn hiện tại |
| `booking_services` | Một lịch có thể yêu cầu nhiều dịch vụ |
| `booking_assignments` | Lịch sử giao/chuyển cố vấn với người giao và thời điểm |
| `booking_events` | Lịch sử thay đổi trạng thái, thời gian, ghi chú, audit |
| `service_visits` | Lượt phục vụ thực tế, mốc tiến độ, tóm tắt công việc, ngày hoàn thành |
| `service_progress_events` | Các lần cập nhật tiến độ xe, ghi chú công khai/nội bộ |
| `business_hours`, `calendar_blocks`, `capacity_rules` | Cấu hình giờ hoạt động, nghỉ, năng lực tiếp nhận |
| `waitlist_requests` | Khách chờ khi khung giờ đầy hoặc muốn đổi sớm |
| `verification_challenges` / `access_grants` | Xác minh quyền tra cứu của khách, token/OTP và phiên truy cập |
| `consents` | Tùy chọn liên lạc và bằng chứng đồng ý |
| `audit_logs` | Nhật ký hành động nhạy cảm |

**Trường quan trọng của `bookings`:** `id`, `code`, `customer_id`, `vehicle_id`, `requested_start_at` hoặc khoảng thời gian mong muốn, `confirmed_start_at`, `status`, `assigned_advisor_id`, `source`, `created_by`, `version`, `created_at`, `updated_at`. Lưu timestamps theo chuẩn có timezone và hiển thị theo `Asia/Ho_Chi_Minh`.

**Đồng thời dữ liệu:** Xác nhận/đổi giờ và chuyển cố vấn phải thực hiện có kiểm tra phiên bản/transaction để tránh cập nhật đè và nhận quá sức chứa. Lịch sử cập nhật là append-only ở mức nghiệp vụ.

---

## 11. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
|---|---|
| Bảo mật | HTTPS; xác thực nhân viên; RBAC ở API; OTP/token tra cứu an toàn; giới hạn thử sai; audit |
| Chống spam | Rate limit, xác thực biểu mẫu bằng Turnstile khi áp dụng, idempotency khi tạo lịch |
| Riêng tư | Thu thập tối thiểu; phân biệt nội bộ/công khai; không lộ dữ liệu khi tìm kiếm; chính sách lưu trữ/xóa phù hợp |
| Hiệu năng | Trang đặt lịch ưu tiên tải nhanh; lịch và danh sách phân trang; chỉ cập nhật dữ liệu cần thiết |
| Tính sẵn sàng | Health check, log, cảnh báo, backup PostgreSQL và thử khôi phục định kỳ |
| Trải nghiệm | Mobile/tablet-first cho quản lý; trạng thái và lỗi hiển thị rõ; phù hợp thiết bị cảm ứng |
| Tính mở rộng | API module hóa để sau này tích hợp Zalo OA, app di động, bảo hành và quản lý dịch vụ chi tiết |
| Vận hành | Database và service DPAuto độc lập với Xe Lướt Toàn Trung dù có thể dùng chung VPS ban đầu |

---

## 12. Tiêu chí nghiệm thu (Acceptance Criteria)

### AC-01 – Phân quyền
- [ ] Cố vấn A không thể xem chi tiết/chỉnh sửa lịch chỉ được giao cho B bằng UI **hoặc gọi API trực tiếp**.
- [ ] Quản lý xem và phân công được lịch toàn trạm.
- [ ] Sau khi chuyển lịch A → B, A bị chặn chỉnh sửa ngay; B xử lý được.
- [ ] A còn xem được lịch sử thao tác trước khi chuyển theo phạm vi đã quy định.

### AC-02 – Đặt lịch
- [ ] Khách đặt được lịch không cần đăng nhập.
- [ ] Khung giờ đóng/đủ sức chứa không thể chọn và không thể gửi thành công nếu cố sửa request.
- [ ] Khi tạo xong, lịch ở trạng thái `PENDING`, không tự xác nhận.
- [ ] Gửi lặp không tạo hai lịch ngoài ý muốn.

### AC-03 – Điều phối và đồng thời
- [ ] Quản lý đổi sức chứa/khóa ngày nghỉ có hiệu lực trên website.
- [ ] Hai người cùng xác nhận suất cuối không thể làm vượt giới hạn.
- [ ] Chuyển giờ thành công giải phóng suất cũ và chiếm suất mới một cách nhất quán.
- [ ] Hủy/không đến giải phóng suất và có thể tạo gợi ý cho danh sách chờ.

### AC-04 – Tiến độ xe
- [ ] Chỉ lịch `ARRIVED` mới được bắt đầu tiến độ xe.
- [ ] Cố vấn được giao cập nhật từng mốc, có lưu lịch sử người/thời gian.
- [ ] Khách chỉ thấy mốc và ghi chú được đánh dấu công khai.
- [ ] Khi bàn giao, lưu `HANDED_OVER` và hoàn thành lịch theo quy tắc nghiệp vụ.

### AC-05 – Tra cứu khách hàng
- [ ] Nhập biển số/SĐT **không** trả lịch sử cá nhân nếu chưa xác minh quyền.
- [ ] OTP hoặc token hết hạn và bị giới hạn thử lại.
- [ ] Khách chỉ xem được hồ sơ thuộc quyền truy cập đã xác minh.
- [ ] Lịch sử dịch vụ không bị nhầm với lịch hẹn đã hủy hoặc chưa thực hiện.

### AC-06 – Giao diện và vận hành
- [ ] Cố vấn xử lý lịch trên điện thoại, tablet, desktop.
- [ ] Dashboard cố vấn chỉ hiển thị các việc thuộc phạm vi của họ.
- [ ] Có danh sách công việc, lịch ngày/tuần, lịch sử, bộ lọc và tìm kiếm.
- [ ] Audit, sao lưu/khôi phục và cảnh báo lỗi cơ bản hoạt động.

---

## 13. Kế hoạch triển khai đề xuất

| Giai đoạn | Phạm vi | Kết quả bàn giao |
|---|---|---|
| **P0. Khảo sát & chốt nghiệp vụ** | Quyền, trạng thái, sức chứa, mẫu dữ liệu, mockup mobile/tablet | BRD/FRD được phê duyệt và prototype |
| **P1. Booking nền tảng** | Database, API, xác thực nhân viên, tạo lịch công khai, chống spam | Khách gửi yêu cầu, hệ thống lưu đúng |
| **P2. Trang quản lý** | Dashboard, lịch ngày/tuần, danh sách, chi tiết, giao lịch, quyền advisor/manager | Cố vấn làm việc độc lập theo lịch được giao |
| **P3. Điều phối & tiến độ xe** | Sức chứa, đổi/hủy, khách chờ, đến trạm, tiến độ, bàn giao | Điều phối và theo dõi trạng thái thực tế |
| **P4. Tra cứu khách & lịch sử** | Xác minh khách, danh sách xe/lịch sử, tiến độ công khai | Khách tự kiểm tra an toàn |
| **P5. Vận hành & thông báo** | Kiểm thử E2E, logs, báo cáo, backup, QR, cấu trúc notification | Sẵn sàng production; chuẩn bị Zalo OA |
| **P6. Zalo OA** | Kết nối kênh, mẫu tin hợp lệ, nhắc hẹn/bảo dưỡng | Tự động hóa thông báo sau khi đủ điều kiện |

**Nguyên tắc triển khai:** Kiểm thử theo quy trình thật và nghiệm thu từng giai đoạn; không mở công khai tính năng tra cứu lịch sử trước khi có xác minh quyền; không để giao diện vượt trước các quy tắc phân quyền ở backend.

---

## 14. Các quyết định nghiệp vụ còn cần chốt

> Các mục dưới đây **không làm thay đổi ý tưởng chính đã chốt**; đây là những thông số cần xác nhận với quản lý và cố vấn trước khi lập trình chính thức.

| Mã | Câu hỏi cần chốt | Đề xuất ban đầu |
|---|---|---|
| D01 | Lịch khách đặt mới do ai xử lý? | Hàng đợi chờ **quản lý phân công**; cố vấn tự tạo lịch thì tự phụ trách |
| D02 | Cố vấn có được tự nhận lịch chưa phân công không? | **Không** ở MVP; tránh nhận trùng và lệch tải |
| D03 | Website khi khung đủ tải có cho đăng ký danh sách chờ không? | **Có**, yêu cầu liên hệ khi trống, không cam kết giờ |
| D04 | `PENDING` có giữ suất tiếp nhận không? | Không giữ; giới hạn số yêu cầu chờ và kiểm tra lại khi xác nhận |
| D05 | Sức chứa tính chung hay theo nhóm dịch vụ? | Bắt đầu với **tổng suất mỗi khung**, hỗ trợ cấu hình nhóm sau |
| D06 | Ai được đưa lịch thành `COMPLETED`? | Cố vấn đang phụ trách hoặc quản lý, sau khi ghi nhận kết quả/bàn giao |
| D07 | Có cho phép bỏ qua bước tiến độ không áp dụng? | Có; yêu cầu ghi lịch sử và không giả mạo bước |
| D08 | Khách xác minh quyền bằng cách nào? | OTP điện thoại; nếu chưa sẵn sàng, liên kết token theo từng lịch |
| D09 | Khách được xem bao nhiêu lịch sử cũ? | Chỉ dữ liệu đã được DPAuto ghi nhận hoặc import xác minh |
| D10 | Đổi lịch/hủy khi khách đã đến xử lý thế nào? | Không dùng hủy lịch thông thường; quản lý xử lý ngoại lệ với lý do |
| D11 | Khi chuyển cố vấn, người cũ xem được gì? | Chỉ phần nhiệm vụ và thao tác quá khứ của mình, không xem dữ liệu nội bộ phát sinh sau chuyển |
| D12 | Các mốc tiến độ có phù hợp từng nhóm dịch vụ không? | Dùng bộ mốc chung có thể bỏ qua; lấy ý kiến cố vấn để chốt |
| D13 | Người nào quản lý dịch vụ/nội dung website? | Quản lý ở MVP; nếu CMS lớn hơn sẽ tách quyền sau |
| D14 | Thời gian chờ trước khi đánh dấu “Không đến”? | Quản lý cấu hình theo quy trình thực tế |

---

## 15. Tóm tắt phạm vi đã chốt

- **Hai vai trò quản trị:** Quản lý và Cố vấn dịch vụ.
- **Cố vấn:** Tạo lịch, xử lý/cập nhật lịch được giao, theo dõi tiến độ và xem lịch sử công việc của mình.
- **Quản lý:** Xem toàn trạm, phân/chuyển lịch, cấu hình khung giờ và giám sát hoạt động.
- **Khách hàng:** Đặt lịch không cần đăng nhập; tra cứu lịch sử/trạng thái xe **sau khi xác minh quyền truy cập**.
- **Khung giờ:** Ngăn chọn giờ quá tải dựa trên cấu hình và kiểm tra lại tại backend.
- **Dữ liệu:** Tách trạng thái đặt lịch, tiến độ dịch vụ và lịch sử thực hiện; có nhật ký thay đổi.
- **Định hướng:** Phát triển độc lập với phần mềm cũ; website + trang quản lý trước, Zalo OA sau.

**Bước tiếp theo:** Rà soát và xác nhận các mục D01–D14 cùng cố vấn dịch vụ và quản lý trạm, sau đó khóa phiên bản 1.0 để viết đặc tả API/database và giao Codex triển khai theo từng phase.
