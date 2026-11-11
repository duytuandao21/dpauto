# DPAuto – BUSINESS RULES

> **Mã tài liệu:** DPA-BR-001  
> **Phiên bản:** 1.0 – Dự thảo rà soát nghiệp vụ  
> **Ngày:** 10/11/2026  
> **Cơ sở:** `DPAuto_Conversation_Handoff_2026-11-09.md` và `DPAuto_Booking_Requirements.md` (09/11/2026)  
> **Phạm vi:** Website công khai, đặt lịch, quản lý lịch, tiến độ xe, lịch sử dịch vụ, tra cứu an toàn và chuẩn bị thông báo.  
> **Trạng thái:** Chưa phê duyệt toàn bộ; các quyết định D01–D14 còn chờ xác nhận.

## 1. Mục tiêu và nguyên tắc

Tài liệu quy định hành vi nghiệp vụ để thiết kế luồng thao tác, UI/UX, database, API và kiểm thử. DPAuto là **hệ thống độc lập**, không tích hợp hoặc đồng bộ hệ thống đặt lịch cũ. MVP **không** bao gồm quản lý kho, báo giá/hóa đơn, thanh toán trực tuyến, quy trình kỹ thuật sửa chữa chi tiết hoặc ứng dụng native. Zalo OA triển khai sau MVP.

**Nhãn quyết định:**
- **[ĐÃ CHỐT]**: người dùng đã quyết định rõ trong hồ sơ bàn giao.
- **[THEO REQUIREMENTS – CHỜ DUYỆT]**: có quy tắc trong bản requirements 1.0 nhưng chưa được xác nhận riêng; không được coi là đã chốt.
- **[ĐỀ XUẤT]**: phương án bổ sung để giải quyết trường hợp thiếu đặc tả.
- **[CẦN XÁC NHẬN]**: quyết định nghiệp vụ chưa đủ thông tin để khóa thiết kế.

**Quy ước kiểm thử:** Mỗi quy tắc có mã `BR-xx`; tiêu chí `T-xx` là hành vi cần kiểm tra. Các kiểm thử gắn quy tắc chưa duyệt là **dự kiến**, không phải acceptance criteria đã được phê duyệt.

## 2. Vai trò, quyền và phạm vi dữ liệu

**BR-01 [ĐÃ CHỐT] – Hai vai trò nội bộ.** Chỉ có `MANAGER` (Quản lý) và `ADVISOR` (Cố vấn dịch vụ). Khách sử dụng website công khai, không phải vai trò đăng nhập Admin. **T-01:** Không cấp chức năng quản lý nội bộ cho khách; tài khoản Advisor không có quyền Manager.

**BR-02 [ĐÃ CHỐT] – Phạm vi cố vấn.** Advisor được tự tạo lịch, xem và cập nhật lịch **hiện được giao cho mình**; không xem/chỉnh lịch chỉ được giao cho người khác. Manager được xem toàn trạm, tạo lịch, phân công và chuyển người phụ trách. **T-02:** Advisor A gọi trực tiếp API xem/sửa lịch chỉ giao B bị từ chối; Manager thao tác được.

**BR-03 [ĐÃ CHỐT + chi tiết chờ duyệt] – Lịch sử cố vấn.** Advisor xem được lịch mình từng xử lý; lịch đã chuyển giao không còn được chỉnh sửa. **[THEO REQUIREMENTS – CHỜ DUYỆT]** Chỉ hiển thị bản tóm tắt và thao tác lịch sử của A, không hiển thị ghi chú nội bộ mới phát sinh sau khi giao B. **T-03:** Sau chuyển A→B, A không sửa được; A chỉ đọc đúng dữ liệu lịch sử được phép; B cập nhật được.

**BR-04 [THEO REQUIREMENTS – CHỜ DUYỆT; D01, D02] – Phân công lịch.** Mỗi lịch có tối đa một cố vấn chính tại một thời điểm. Lịch từ website chưa phân công vào hàng đợi của Manager; Advisor không tự nhận từ hàng đợi. Lịch do Advisor tạo mặc định giao chính mình; Manager tạo có thể giao ngay hoặc để chờ. **T-04:** Không thể đồng thời có hai cố vấn chính; Advisor không thấy hàng đợi chưa giao.

**BR-05 [THEO REQUIREMENTS – CHỜ DUYỆT] – Bảo vệ ở backend.** API kiểm tra đăng nhập, vai trò **và quyền từng bản ghi**; ẩn nút trên UI không được xem là kiểm soát truy cập. **T-05:** Thay ID trên request không vượt quyền; các endpoint danh sách, tìm kiếm, export và thống kê không lộ lịch ngoài phạm vi.

**BR-06 [THEO REQUIREMENTS – CHỜ DUYỆT] – Chuyển giao.** Chỉ Manager chuyển Advisor; lưu người chuyển, người cũ/mới, thời điểm và lý do (đề xuất yêu cầu lý do). Việc chuyển và thu hồi quyền phải nhất quán trong một giao dịch. **T-06:** Hai yêu cầu chuyển đồng thời không tạo hai người phụ trách; quyền A bị thu hồi ngay khi chuyển thành công.

| Thao tác | Manager | Advisor đang phụ trách | Advisor đã chuyển giao | Khách |
|---|---|---|---|---|
| Xem lịch đang xử lý | Toàn trạm | Lịch của mình | Không; chỉ lịch sử được phép | Chỉ sau xác minh |
| Tạo lịch nội bộ | Có | Có | Theo quyền tạo lịch mới | Không áp dụng |
| Sửa/đổi/hủy lịch | Có | Có, theo trạng thái | Không | Không tự sửa ở MVP nếu chưa duyệt |
| Phân/chuyển cố vấn | Có | Không | Không | Không |
| Cập nhật tiến độ xe | Có | Lịch của mình | Không | Không |
| Cấu hình sức chứa, tài khoản | Có | Không | Không | Không |
| Xem lịch sử công việc | Toàn trạm | Phần mình từng phụ trách | Chỉ đọc phần được phép | Lịch sử xe được xác minh |

## 3. Tạo lịch và nguồn tiếp nhận

**BR-07 [ĐÃ CHỐT] – Đặt lịch không đăng nhập.** Khách được gửi yêu cầu trên `/dat-lich` qua website hoặc QR. **T-07:** Khách chưa đăng nhập gửi yêu cầu hợp lệ được; QR dẫn đúng trang đặt lịch.

**BR-08 [THEO REQUIREMENTS – CHỜ DUYỆT] – Dữ liệu đặt lịch.** Bắt buộc: họ tên, số điện thoại hợp lệ, ít nhất một dịch vụ, ngày/khung giờ mong muốn, xác nhận đã được cung cấp thông tin xử lý dữ liệu. Hãng/dòng xe được khuyến nghị; biển số và mô tả là tùy chọn. Lưu nguồn tạo tự động. Không tự đánh dấu đồng ý quảng cáo. **T-08:** Thiếu trường bắt buộc bị từ chối; biển số trống vẫn đặt được; consent quảng cáo mặc định tắt.

**BR-09 [THEO REQUIREMENTS – CHỜ DUYỆT] – Tạo yêu cầu.** Backend kiểm tra đầu vào, chống spam, trùng yêu cầu và khả năng tiếp nhận; tạo mã lịch không tiết lộ thông tin nhạy cảm. Lịch website ban đầu là `PENDING` và hiển thị “Đã nhận yêu cầu – đang chờ xác nhận”, không hứa giờ đã được chấp thuận. **T-09:** Gửi thành công tạo `PENDING`; gửi lặp với cùng khóa idempotency không tạo hai lịch.

**BR-10 [ĐÃ CHỐT + chi tiết chờ duyệt] – Lịch nhân viên tạo.** Manager/Advisor tạo lịch cho khách gọi điện, Fanpage, Zalo hoặc đến trực tiếp. **[THEO REQUIREMENTS – CHỜ DUYỆT]** Ghi người tạo, nguồn, áp dụng kiểm tra trùng/sức chứa; walk-in có thao tác tiếp nhận ngay với lý do nếu vượt tải. **T-10:** Lịch nội bộ có nguồn và người tạo; vượt tải không diễn ra âm thầm.

**BR-11 [ĐỀ XUẤT] – Chuẩn hóa và chống trùng.** Chuẩn hóa số điện thoại về một dạng thống nhất; chuẩn hóa biển số để tìm kiếm nhưng **không** dùng làm khóa định danh khách/xe. Chống trùng theo khóa request và kiểm tra lịch gần giống, nhưng không tự gộp hai khách/xe. **T-11:** Gửi lại do mất mạng không tạo lịch nhân đôi; hai người khác nhau cùng biển số không tự gộp hồ sơ.

## 4. Trạng thái lịch hẹn

**BR-12 [THEO REQUIREMENTS – CHỜ DUYỆT] – Danh mục trạng thái.** Tách `booking_status` khỏi `service_progress`. Danh mục đề xuất của requirements:

| Trạng thái | Ý nghĩa | Chuyển thông thường |
|---|---|---|
| `PENDING` | Đã nhận yêu cầu, chưa xác nhận | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | Đã thống nhất thời gian | `ARRIVED`, `CANCELLED`, `NO_SHOW` |
| `ARRIVED` | Xe/khách đã đến trạm | `COMPLETED` khi đủ điều kiện |
| `COMPLETED` | Kết thúc lượt phục vụ | Kết thúc; Manager xử lý ngoại lệ |
| `CANCELLED` | Lịch đã hủy | Kết thúc |
| `NO_SHOW` | Khách không đến | Kết thúc |

**T-12:** API từ chối chuyển không hợp lệ như `PENDING→COMPLETED`, `CANCELLED→ARRIVED`; lưu lịch sử trước/sau và người thao tác.

**BR-13 [THEO REQUIREMENTS – CHỜ DUYỆT] – Xác nhận lịch.** Chỉ Manager hoặc Advisor đang được giao xác nhận sau khi thống nhất với khách; kiểm tra lại sức chứa tại thời điểm xác nhận. **T-13:** Advisor không phụ trách không xác nhận được; suất cuối không thể được xác nhận cho hai lịch.

**BR-14 [THEO REQUIREMENTS – CHỜ DUYỆT; D14] – Không đến.** Chỉ áp dụng cho `CONFIRMED` đã qua giờ hẹn cộng thời gian chờ do Manager cấu hình; cần nhân viên kiểm tra, không tự chuyển `NO_SHOW` chỉ vì quá giờ. **T-14:** Chưa hết thời gian chờ không đánh dấu được; quá giờ không tự động chuyển trạng thái.

**BR-15 [THEO REQUIREMENTS – CHỜ DUYỆT; D10] – Lịch đã đến/đã hoàn thành.** Không cho hủy/đổi theo luồng thông thường sau `ARRIVED`; `COMPLETED` chỉ Manager có thể sửa/mở lại theo ngoại lệ có lý do và audit. **T-15:** Advisor không sửa lịch hoàn thành; thao tác ngoại lệ của Manager có lý do và dấu vết.

**BR-16 [ĐỀ XUẤT] – Thương lượng giờ khác.** “Đang đề xuất giờ khác” lưu như `contact_outcome` và giờ đề xuất, không bắt buộc tạo trạng thái lịch mới; chỉ đổi giờ khi khách đồng ý. **T-16:** Gửi đề xuất không tự sửa giờ đã xác nhận.

## 5. Khung giờ, sức chứa và điều phối

**BR-17 [ĐÃ CHỐT] – Chặn quá tải.** Khách không được chọn khung giờ đã hết khả năng tiếp nhận. Manager có thể điều chỉnh khung giờ theo tình hình garage. Backend phải xác thực lại, không chỉ dựa UI. **T-17:** Khung đóng/đầy không chọn được; request giả lập tới API vẫn bị chặn.

**BR-18 [THEO REQUIREMENTS – CHỜ DUYỆT] – Cấu hình.** Manager quản lý giờ mở cửa theo ngày/thứ, giờ nghỉ, ngày nghỉ đột xuất, độ dài khung (ví dụ 30/60 phút), sức chứa, thời gian đặt trước tối thiểu, cửa sổ đặt tối đa, ngưỡng cảnh báo và tạm ngừng nhận lịch. **T-18:** Thay đổi cấu hình phản ánh đúng lên lịch khả dụng; ngày nghỉ không xuất hiện như còn chỗ.

**BR-19 [CẦN XÁC NHẬN; D03–D05] – Cách tính suất.** Phương án trong requirements: `CONFIRMED` chiếm suất chính thức; `PENDING` không giữ suất, nhưng giới hạn số yêu cầu đang chờ/khung; sức chứa ban đầu tính tổng số lượt tiếp nhận mỗi khung, chưa tính kỹ thuật viên/cầu nâng. Cần chốt cả giới hạn `PENDING` và cách xử lý các lịch `ARRIVED` trong thống kê sức chứa khung gốc. **T-19 (dự kiến):** Không vượt giới hạn đã chọn; lịch chờ không bị hiển thị như đã được giữ chỗ.

**BR-20 [THEO REQUIREMENTS – CHỜ DUYỆT] – Cập nhật đồng thời.** Xác nhận và đổi giờ phải dùng transaction và cơ chế khóa/kiểm soát cạnh tranh; đổi giờ thành công chiếm suất mới và giải phóng suất cũ một cách nguyên tử. **T-20:** Hai thao tác tranh suất cuối chỉ một thành công; lỗi giữa giao dịch không để mất hoặc nhân đôi suất.

**BR-21 [THEO REQUIREMENTS – CHỜ DUYỆT] – Đổi/hủy.** Ghi giờ cũ/mới, lý do, người thực hiện, thời điểm. Chỉ đổi giờ khi đã thống nhất với khách; khi hủy/`NO_SHOW`, giải phóng suất theo chính sách đã duyệt. **T-21:** Đổi giờ thất bại giữ nguyên lịch cũ; hủy đúng quyền làm suất khả dụng trở lại.

**BR-22 [THEO REQUIREMENTS – CHỜ DUYỆT; D03] – Danh sách chờ.** Khi đầy có thể ghi “Đề nghị liên hệ khi có chỗ”; đây **không phải** lịch xác nhận. Khi suất trống, nhân viên liên hệ khách; không tự chuyển giờ hoặc xác nhận thay khách. **T-22:** Yêu cầu chờ không chiếm suất như lịch xác nhận; không đổi lịch khi chưa ghi nhận khách đồng ý.

**BR-23 [ĐỀ XUẤT] – Ngoại lệ vượt tải.** Chỉ Manager được vượt sức chứa thông thường, phải nhập lý do, xem cảnh báo và lưu audit; walk-in của Advisor nếu cần vượt tải phải được Manager chấp thuận. **T-23:** Advisor không thể vượt tải bằng API; ngoại lệ Manager có lý do và được báo cáo riêng.

## 6. Tiếp nhận và tiến độ xe

**BR-24 [ĐÃ CHỐT] – Theo dõi tiến độ cơ bản.** Khi xe ở trạm, Advisor được giao cập nhật các mốc dịch vụ để khách theo dõi; không triển khai workflow kỹ thuật chi tiết. **T-24:** Advisor B không cập nhật xe của lịch A; khách không thấy dữ liệu kỹ thuật nội bộ.

**BR-25 [THEO REQUIREMENTS – CHỜ DUYỆT; D07, D12] – Bộ mốc tiến độ.** Chỉ bắt đầu khi lịch `ARRIVED`. Bộ mốc đề xuất: `RECEIVED` (đã tiếp nhận), `INSPECTING` (đang kiểm tra), `WAITING_APPROVAL` (chờ xác nhận phương án), `IN_SERVICE` (đang thực hiện), `QUALITY_CHECK` (kiểm tra hoàn tất), `READY_FOR_PICKUP` (sẵn sàng bàn giao), `HANDED_OVER` (đã bàn giao). Có thể bỏ qua mốc không áp dụng; không tạo mốc giả. **T-25:** `CONFIRMED` không thể có tiến độ xe; bỏ qua mốc không làm phát sinh sự kiện giả.

**BR-26 [THEO REQUIREMENTS – CHỜ DUYỆT] – Ghi chú và thời gian.** Mỗi cập nhật phân biệt nội bộ/công khai; lưu người và thời gian. Thời gian hoàn tất dự kiến là tùy chọn và phải có nhãn “dự kiến”. **T-26:** Ghi chú nội bộ không xuất hiện trong API khách; dự kiến không hiển thị như cam kết.

**BR-27 [THEO REQUIREMENTS – CHỜ DUYỆT; D06] – Hoàn thành.** Khi bàn giao xe, ghi `HANDED_OVER`; hoàn thành lịch sau khi có dữ liệu lượt phục vụ cần thiết. Manager hoặc Advisor đang phụ trách được hoàn thành theo chính sách được duyệt. **T-27:** Không đánh dấu hoàn thành trước điều kiện bàn giao; tạo lịch sử dịch vụ thực tế, không phải chỉ lịch hẹn.

**BR-28 [ĐỀ XUẤT] – Dừng/chờ dịch vụ.** Nếu xe chờ khách phản hồi hoặc tạm dừng, lưu cập nhật công khai phù hợp và ghi chú nội bộ; không suy đoán tiến độ hay thời gian hoàn tất. **T-28:** Có thể thông báo đang chờ mà không bắt buộc tạo phiếu sửa chữa/phụ tùng.

## 7. Khách hàng, xe và lịch sử dịch vụ

**BR-29 [ĐÃ CHỐT] – Tra cứu lịch sử/trạng thái.** Khách có thể xem lịch sử sử dụng dịch vụ và tiến độ xe **sau khi xác minh quyền**. Chỉ nhập SĐT hoặc biển số **không** đủ để xem dữ liệu cá nhân. **T-29:** Truy vấn chưa xác minh không trả lịch sử, tên khách hay tiến độ chi tiết.

**BR-30 [CẦN XÁC NHẬN; D08] – Phương thức xác minh.** Requirements ưu tiên OTP gửi tới số liên hệ đã gắn hồ sơ; nếu chưa triển khai được, dùng liên kết token ngẫu nhiên có hạn, giới hạn **theo từng lịch**. Không mở tra cứu toàn bộ lịch sử bằng SĐT/biển số khi thiếu cơ chế xác minh. **T-30:** OTP/token hết hạn, giới hạn thử sai; token một lịch không truy cập lịch khác.

**BR-31 [THEO REQUIREMENTS – CHỜ DUYỆT] – Phạm vi phiên tra cứu.** Sau xác minh, chỉ cấp quyền truy cập những lịch/xe được xác minh thuộc quyền xem; không tiết lộ sự tồn tại hồ sơ trước xác minh; phiên có thời hạn. **T-31:** Đổi ID hoặc biển số không mở dữ liệu người khác; phản hồi trước xác minh không cho phép dò hồ sơ.

**BR-32 [THEO REQUIREMENTS – CHỜ DUYỆT; D09] – Lịch sử đúng nghĩa.** Phân biệt *lịch sử lịch hẹn* (kể cả hủy/không đến) với *lịch sử dịch vụ* (lượt đã thực sự phục vụ). Chỉ công bố lịch sử do DPAuto ghi nhận hoặc dữ liệu import đã kiểm tra; không mặc định có dữ liệu từ phần mềm cũ. **T-32:** `CONFIRMED`, `CANCELLED`, `NO_SHOW` không tự tạo lượt dịch vụ hoàn thành.

**BR-33 [THEO REQUIREMENTS – CHỜ DUYỆT] – Nội dung công khai.** Có thể hiển thị ngày/giờ lịch, dịch vụ, trạng thái, tiến độ, cập nhật công khai, thời gian dự kiến, tóm tắt công việc đã xác nhận và mốc bảo dưỡng nếu có. Không hiển thị ghi chú nội bộ, giá vốn hoặc dữ liệu của khách khác. **T-33:** API công khai chỉ trả trường nằm trong danh sách cho phép.

**BR-34 [ĐỀ XUẤT] – Quan hệ khách–xe.** Xe dùng ID nội bộ; biển số có thể thay đổi hoặc trùng qua thời gian. Việc đổi liên kết chủ thể, gộp hồ sơ hoặc xử lý xe đã bán cần Manager xác minh và ghi audit; không tự gộp bằng SĐT/biển số. **T-34:** Đổi biển số không làm mất lịch sử; gộp hồ sơ phải có bằng chứng và nhật ký.

## 8. Thông báo và quyền riêng tư

**BR-35 [ĐÃ CHỐT] – Zalo OA về sau.** MVP không phụ thuộc Zalo OA để lưu, xác nhận hay hoàn thành lịch. Chuẩn bị dữ liệu để gửi xác nhận, nhắc hẹn, bàn giao, bảo dưỡng và hậu mãi sau này. **T-35:** Booking vẫn hoạt động khi chưa kết nối Zalo.

**BR-36 [THEO REQUIREMENTS – CHỜ DUYỆT] – Thông báo nội bộ.** Có danh sách/cảnh báo lịch mới, chờ xử lý, sắp đến, đổi/hủy, quá tải; nhân viên kiểm tra khách trễ thủ công. **T-36:** Sự kiện đúng tạo cảnh báo cho đúng người có quyền; không tự đánh dấu `NO_SHOW`.

**BR-37 [THEO REQUIREMENTS – CHỜ DUYỆT] – Đồng ý liên hệ.** Thông tin cần thiết để thực hiện lịch và lựa chọn nhận khuyến mãi phải tách biệt; không chọn sẵn nhận quảng cáo. Khi triển khai Zalo OA, phân biệt tin dịch vụ và quảng cáo theo điều kiện của nền tảng/quy định áp dụng. **T-37:** Từ chối quảng cáo không cản đặt lịch; dữ liệu consent có thể truy xuất khi cần.

**BR-38 [ĐỀ XUẤT] – Thông báo tin cậy.** Lưu notification job với khóa chống gửi trùng, trạng thái gửi, retry có giới hạn; lỗi gửi không rollback xác nhận lịch. **T-38:** Gửi lỗi vẫn giữ booking đã xác nhận; xử lý lại không phát tán trùng không kiểm soát.

## 9. Nhật ký, dữ liệu và vận hành

**BR-39 [THEO REQUIREMENTS – CHỜ DUYỆT] – Audit.** Lưu actor, thời điểm, hành động, bản ghi, giá trị trước/sau phù hợp, lý do cho các thay đổi nhạy cảm: phân công, đổi/hủy, sửa lịch hoàn thành, cấu hình sức chứa, thay quyền, gộp hồ sơ. Lịch sử sự kiện nghiệp vụ nên append-only. **T-39:** Có thể truy lại ai đổi lịch/giờ/người phụ trách và khi nào.

**BR-40 [THEO REQUIREMENTS – CHỜ DUYỆT] – Dữ liệu tối thiểu.** Các nhóm dữ liệu dự kiến: nhân viên/quyền; khách; xe; danh mục dịch vụ; booking/dịch vụ của booking; phân công; sự kiện lịch; lượt phục vụ/tiến độ; cấu hình giờ/sức chứa; danh sách chờ; xác minh/quyền truy cập; consent; audit. Lưu thời gian có timezone, hiển thị `Asia/Ho_Chi_Minh`. **T-40:** Các quan hệ không mồ côi; truy xuất thời gian nhất quán.

**BR-41 [THEO REQUIREMENTS – CHỜ DUYỆT] – Phi chức năng.** HTTPS, xác thực nội bộ, giới hạn request, chống spam (Turnstile khi áp dụng), phân trang, health check, log, backup PostgreSQL và thử khôi phục; database/service DPAuto tách biệt Xe Lướt Toàn Trung dù có thể dùng chung VPS. **T-41:** Kiểm tra RBAC API, rate limit, backup/restore và health check trước production.

**BR-42 [ĐỀ XUẤT] – Tính nhất quán và chống cập nhật đè.** Dùng version hoặc optimistic locking cho các bản ghi booking; mỗi hành động đổi trạng thái có điều kiện theo trạng thái hiện tại và quyền hiện tại. **T-42:** Hai nhân viên sửa cùng bản ghi không âm thầm ghi đè; trả lỗi xung đột rõ ràng.

## 10. Quy tắc ngoại lệ và xử lý lỗi

| Mã | Tình huống | Cách xử lý đề xuất | Kiểm thử |
|---|---|---|---|
| EX-01 | Khung giờ đầy giữa lúc khách đang nhập form | Backend từ chối và trả gợi ý chọn giờ khác; không tạo booking xác nhận | Hai request tranh suất không vượt tải |
| EX-02 | Khách gửi form hai lần vì mạng chậm | Idempotency; hiển thị kết quả của yêu cầu đầu | Chỉ một booking hợp lệ |
| EX-03 | Advisor bị chuyển lịch khi đang mở chi tiết | Mọi thao tác ghi phải kiểm tra quyền mới; yêu cầu tải lại | A bị từ chối sau chuyển |
| EX-04 | Khách đến không hẹn lúc quá tải | Ghi walk-in; Manager duyệt ngoại lệ nếu vượt sức chứa | Không vượt tải không dấu vết |
| EX-05 | Khách hủy sát giờ hoặc không đến | Cập nhật theo quyền, giải phóng suất theo chính sách; đề xuất khách chờ | Không tự đổi giờ khách chờ |
| EX-06 | Xe đã đến nhưng khách muốn dừng dịch vụ | Manager xử lý ngoại lệ; lưu kết quả thực tế và lý do, không giả hoàn thành | Có audit và không tạo lịch sử sai |
| EX-07 | Khách đổi SĐT, biển số hoặc chủ xe | Xác minh quyền trước khi cập nhật liên kết/hồ sơ | Không lộ lịch sử chủ cũ |
| EX-08 | OTP/token sai, hết hạn hoặc thử nhiều lần | Từ chối, giới hạn thử và thời gian; thông báo không tiết lộ hồ sơ | Không thể dò lịch sử |
| EX-09 | Lỗi gửi thông báo | Lưu lỗi để xử lý lại; không ảnh hưởng booking đã lưu | Booking vẫn nhất quán |
| EX-10 | Manager giảm sức chứa thấp hơn số lịch đã xác nhận | Cảnh báo và yêu cầu xử lý thủ công; không tự hủy lịch | Lịch cũ không tự mất |
| EX-11 | Advisor nghỉ/khóa tài khoản khi còn lịch | Manager chuyển giao; không tự phân công không kiểm soát | Lịch không mất, quyền cũ bị chặn |
| EX-12 | Hai khách dùng chung SĐT hoặc một xe có nhiều người liên hệ | Quyền tra cứu gắn bằng chứng được phép, không suy ra sở hữu từ SĐT đơn lẻ | Không lộ chéo hồ sơ |

> Các ngoại lệ EX-01–EX-12 là **đề xuất xử lý**, cần rà soát thực tế với Manager/Advisor trước khi khóa thiết kế.

## 11. Quyết định nghiệp vụ cần xác nhận (D01–D14)

| Mã | Nội dung cần quyết định | Phương án đang đề xuất trong REQUIREMENTS | Trạng thái |
|---|---|---|---|
| D01 | Ai xử lý lịch khách gửi? | Hàng đợi chung, Manager phân công | Chưa chốt |
| D02 | Advisor được tự nhận lịch chưa giao? | Không | Chưa chốt |
| D03 | Khung đầy có danh sách chờ? | Có, chỉ đăng ký liên hệ | Chưa chốt |
| D04 | `PENDING` có giữ suất? | Không; giới hạn yêu cầu chờ | Chưa chốt |
| D05 | Sức chứa tính theo gì? | Tổng suất mỗi khung trước, nhóm dịch vụ sau | Chưa chốt |
| D06 | Ai hoàn thành lịch? | Manager hoặc Advisor đang phụ trách sau bàn giao | Chưa chốt |
| D07 | Có bỏ qua mốc tiến độ? | Có, không tạo bước giả | Chưa chốt |
| D08 | Xác minh khách bằng gì? | OTP; fallback token từng lịch | Chưa chốt |
| D09 | Lịch sử cũ hiển thị đến đâu? | Dữ liệu DPAuto/import đã xác minh | Chưa chốt |
| D10 | Đổi/hủy sau khi xe đã đến? | Manager xử lý ngoại lệ có lý do | Chưa chốt |
| D11 | Advisor cũ còn xem gì? | Tóm tắt phần việc và thao tác của mình | Chưa chốt |
| D12 | Mốc tiến độ phù hợp mọi dịch vụ? | Bộ mốc chung, có thể bỏ qua | Chưa chốt |
| D13 | Ai quản lý nội dung/dịch vụ website? | Manager trong MVP | Chưa chốt |
| D14 | Bao lâu thì được đánh dấu không đến? | Manager cấu hình theo thực tế | Chưa chốt |

### 11.1. Thông số vận hành còn thiếu

Ngoài D01–D14, cần chốt trước khi lập trình: giờ làm/nghỉ; độ dài khung; số suất/khung; giới hạn `PENDING`; thời gian đặt trước và số ngày mở lịch; có cho Advisor xác nhận ngay lịch tự tạo không; ai liên hệ khách khi đổi giờ; cách ghi nhận khách đồng ý; dữ liệu tối thiểu để kết thúc lượt dịch vụ; thời hạn phiên OTP/token; chính sách giữ/xóa dữ liệu và quyền xem của người đồng sở hữu xe. **Không tự gán số mặc định như 15 phút, 30 phút hay 5 xe/khung thành chính sách chính thức.**

### 11.2. Gợi ý thứ tự duyệt

1. **Khóa luồng đặt lịch:** D01–D05, D14 và thông số sức chứa.
2. **Khóa luồng phục vụ:** D06, D07, D10–D12.
3. **Khóa quyền và dữ liệu khách:** D08, D09, D11, quyền xem lịch sử và hồ sơ xe.
4. **Khóa quản trị nội dung:** D13 và chính sách cập nhật danh mục dịch vụ.

## 12. Ma trận kiểm thử nghiệm thu theo nhóm

| Nhóm | Quy tắc | Điều kiện đạt |
|---|---|---|
| Quyền | BR-01–06 | Không vượt quyền bằng UI/API; chuyển giao thu hồi quyền ngay |
| Đặt lịch | BR-07–11 | Không cần đăng nhập; chống trùng; thông báo chờ xác nhận rõ ràng |
| Trạng thái | BR-12–16 | Không chuyển sai; `NO_SHOW` có điều kiện; ngoại lệ có audit |
| Sức chứa | BR-17–23 | Chặn đầy cả UI/API; giao dịch đồng thời không vượt tải |
| Tiến độ | BR-24–28 | Chỉ bắt đầu khi đến; ghi chú nội bộ không lộ; lịch sử đúng thực tế |
| Tra cứu | BR-29–34 | Không có dữ liệu cá nhân trước xác minh; không truy cập chéo |
| Thông báo | BR-35–38 | Lỗi gửi không làm hỏng booking; consent quảng cáo riêng |
| Vận hành | BR-39–42 | Audit, phân trang, backup/restore, chống cập nhật đè |
| Ngoại lệ | EX-01–12 | Các tình huống thực tế có xử lý và dấu vết phù hợp |

## 13. Điều kiện chuyển sang tài liệu thiết kế

- [ ] Manager và ít nhất một Advisor rà soát luồng nghiệp vụ thực tế.
- [ ] D01–D14 được ghi quyết định, người duyệt và ngày duyệt.
- [ ] Chốt chính sách `PENDING`, sức chứa và thời gian `NO_SHOW`.
- [ ] Chốt trạng thái lịch, mốc tiến độ, điều kiện hoàn thành.
- [ ] Chốt quyền xem lịch đã chuyển và quyền tra cứu lịch sử khách.
- [ ] Chọn phương án xác minh đủ an toàn trước khi mở cổng tra cứu.
- [ ] Rà soát các đề xuất EX-01–EX-12 và thông số vận hành.
- [ ] Đồng bộ thay đổi đã duyệt trở lại `REQUIREMENTS.md`.

**Sau khi duyệt:** viết `USER_FLOWS.md` → `UI_UX_SPEC.md` → `DATABASE_DESIGN.md` → `API_SPEC.md` → `SYSTEM_ARCHITECTURE.md` → `IMPLEMENTATION_PLAN.md` → `TEST_PLAN.md` → `DEPLOYMENT.md`.

---

**Lưu ý kiểm soát thay đổi:** Tài liệu này diễn giải yêu cầu hiện có và đề xuất cách xử lý phần chưa rõ; **không tự nâng đề xuất thành quyết định đã chốt**. Mọi thay đổi chính sách phải cập nhật phiên bản và kiểm thử liên quan trước khi giao Codex triển khai.
