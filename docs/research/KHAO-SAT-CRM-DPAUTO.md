# Khảo sát hệ thống CRM DPAuto đang sử dụng

- **Website:** https://crm.dpauto.vn
- **Ngày khảo sát:** 11/11/2026, theo múi giờ Việt Nam.
- **Phương pháp:** khảo sát trực tiếp trên tab Chrome đã đăng nhập do người dùng mở; đọc màn hình, mở menu, form và các trang chi tiết, xem mẫu in.
- **Phạm vi quyền:** tài khoản hiện tại thuộc bộ phận **Cố vấn dịch vụ**. Đây là báo cáo các phần truy cập được bằng tài khoản này, không phải xác nhận đã xem toàn bộ chức năng của mọi vai trò.
- **Thao tác:** không lưu form, tạo phiếu, đổi trạng thái nghiệp vụ, xác nhận báo giá, thu tiền, gửi thảo luận, tải media lên hoặc thay đổi mật khẩu. Các mẫu in được mở để xem, không thực hiện lệnh in ra thiết bị.
- **Dữ liệu trong báo cáo:** mô tả cấu trúc và chức năng; không chép lại danh sách khách hàng, số điện thoại cá nhân, CCCD hoặc số tài khoản ngân hàng đang có trên hệ thống.

## 1. Tóm tắt

CRM cũ là hệ thống vận hành garage, có phạm vi lớn hơn quản lý lịch hẹn. Những phần đã quan sát gồm:

1. Đặt lịch và tìm xe theo biển số.
2. Tiếp nhận xe, ghi nhận tình trạng và yêu cầu dịch vụ.
3. Lập báo giá dịch vụ, phụ tùng, chiết khấu và VAT.
4. Xác nhận báo giá, theo dõi cọc và thanh toán.
5. Phân công kỹ thuật viên, theo dõi thi công và nhật ký.
6. Xuất phụ tùng theo báo giá và phiếu dịch vụ.
7. Nghiệm thu với checklist và điều kiện hoàn tất.
8. In báo giá, yêu cầu xuất kho, phiếu nhập/xuất kho, phiếu thu và biên bản nghiệm thu.
9. Báo cáo doanh thu cố vấn dịch vụ.
10. Quản lý các danh mục khách hàng, xe, dịch vụ, phụ tùng, kho và nhà cung cấp.

Điểm quan trọng khi đọc hệ thống: **trạng thái xử lý xe, trạng thái thanh toán và tiến độ công việc được trình bày riêng**. Có thẻ xe ở giai đoạn đặt lịch hoặc đang thi công nhưng đã mang nhãn “Đã thu đủ”. Không nên hiểu DONE là đồng nghĩa với vừa thanh toán xong.

## 2. Bản đồ các mục đã khảo sát

Đã mở **17 mục chức năng trong menu điều hướng**, cùng hai trang tài khoản, các form và màn hình nghiệp vụ liên quan.

| Nhóm | Màn hình | Đường dẫn | Mức độ đã xem |
| --- | --- | --- | --- |
| Dịch vụ | Quản lý xe | `/kanban` | Kanban, tìm kiếm/lọc hiện có, thẻ xe, mở thẻ chờ nghiệm thu |
| Dịch vụ | Phiếu dịch vụ | `/admin/phieu-dich-vu` | Danh sách, bộ lọc, phân trang, chi tiết và các liên kết nghiệp vụ |
| Dịch vụ | BC Doanh thu CVDV | `/admin/bc-doanh-thu-co-van-dich-vu` | Bộ lọc, KPI, bảng tổng hợp và chi tiết, giới hạn quyền |
| Dịch vụ | Đặt lịch | `/admin/dat-lich` | Danh sách, form tạo, form sửa ngày giờ hẹn |
| Dịch vụ | Báo giá nhanh | `/admin/bao-gia-nhanh` | Form thông tin, bảng dịch vụ/phụ tùng và tổng tiền |
| Kho → Nhập xuất | Nhập kho | `/admin/nhap-kho` | Danh sách, form tạo/sửa và bản in |
| Kho → Nhập xuất | Xuất kho | `/admin/xuat-kho` | Danh sách, form tạo và bản in |
| Danh mục → Đơn vị | Kho | `/admin/kho` | Danh sách và hộp thoại thêm |
| Danh mục → Phụ tùng | Đơn vị tính | `/admin/don-vi-tinh` | Danh sách và hộp thoại thêm |
| Danh mục → Phụ tùng | Nhóm phụ tùng | `/admin/nhom-phu-tung` | Danh sách và hộp thoại thêm |
| Danh mục → Phụ tùng | Phụ tùng | `/admin/phu-tung` | Danh sách và hộp thoại thêm |
| Danh mục → Dịch vụ | Nhóm dịch vụ | `/admin/nhom-dich-vu` | Danh sách và hộp thoại thêm |
| Danh mục → Dịch vụ | Dịch vụ | `/admin/dich-vu` | Danh sách và hộp thoại thêm |
| Danh mục → Xe | Loại xe | `/admin/loai-xe` | Danh sách và hộp thoại thêm |
| Danh mục → Xe | Xe dịch vụ | `/admin/xe` | Danh sách và hộp thoại thêm |
| Danh mục → Đối tượng | Khách hàng | `/admin/khach-hang` | Danh sách và hộp thoại thêm |
| Danh mục → Đối tượng | Nhà cung cấp | `/admin/nha-cc` | Danh sách và hộp thoại thêm |
| Tài khoản | Thông tin tài khoản | `/account/thong-tin` | Thông tin hiển thị và hướng dẫn cập nhật qua quản trị viên |
| Tài khoản | Đổi mật khẩu | `/account/doi-mat-khau` | Các trường nhập và nút thao tác; không nhập mật khẩu |

Các đường dẫn trong báo cáo đều thuộc `https://crm.dpauto.vn`. `{id}` trong các phần dưới là mã bản ghi, không phải URL dùng trực tiếp.

## 3. Quy trình nghiệp vụ quan sát được

### 3.1. Các giai đoạn quản lý xe

Kanban có sáu cột theo thứ tự:

```text
ĐẶT LỊCH → CHECK IN → BÁO GIÁ → ĐANG THI CÔNG → CHỜ NGHIỆM THU → DONE
```

Đây là thứ tự trình bày và các bước được thể hiện qua màn hình/nút chuyển bước. Chưa thực hiện chuyển trạng thái để kiểm chứng toàn bộ điều kiện ở phía máy chủ.

| Giai đoạn | Những gì giao diện thể hiện |
| --- | --- |
| Đặt lịch | Thời gian hẹn, dịch vụ khách yêu cầu, thông tin xe/khách; có thể có tiền cọc hoặc thông tin báo giá |
| Check in | Xe đã vào luồng tiếp nhận, có đường đi sang báo giá |
| Báo giá | Có báo giá chi tiết; có thao tác khách xác nhận và đi sang thi công |
| Đang thi công | KTV, deadline, tiến độ, phân công công việc, nhật ký và xuất phụ tùng |
| Chờ nghiệm thu | Checklist, người nghiệm thu, kết quả, ghi chú và điều kiện hoàn tất |
| DONE | Trạng thái hoàn tất nghiệm thu; có đường đi tới thu tiền trên Kanban |

### 3.2. Các nhánh liên quan

- **Đặt lịch trước:** tìm xe → xem thông tin xe → chọn ngày/giờ → nhập yêu cầu → ghi nhận cọc nếu có → lưu lịch hẹn.
- **Xe đến trực tiếp:** tìm hoặc thêm xe → ghi nhận tình trạng và yêu cầu → tạo phiếu dịch vụ.
- **Báo giá:** chọn dịch vụ/phụ tùng → nhập số lượng, giá, chiết khấu, VAT → xem trước/in → lưu hoặc xác nhận theo quy trình.
- **Thi công:** chọn KTV → bắt đầu → phân công, cập nhật công việc → xuất phụ tùng → chuyển chờ nghiệm thu.
- **Nghiệm thu:** kiểm tra hạng mục → ghi kết quả → hoàn tất khi đủ điều kiện.
- **Thanh toán:** theo dõi báo giá, cọc, đã thu, còn nợ và các phiếu thu/chi liên quan.

**Lưu ý mô hình:** danh sách lịch hẹn đã hiển thị mã phiếu dạng `DP1-DV…`. Vì vậy, lịch hẹn và phiếu dịch vụ có liên hệ ngay trong giao diện cũ; chưa thể kết luận cách lưu quan hệ này trong database.

## 4. Chi tiết nhóm Dịch vụ

### 4.1. Dashboard quản lý xe — `/kanban`

- Tiêu đề “DASHBOARD QUẢN LÝ XE”.
- Ô tìm kiếm với gợi ý tìm biển số, mã lệnh, khách và KTV.
- Bộ lọc “Cố vấn DV”.
- Nút “Đặt lịch mới”, “Làm mới”.
- Sáu cột có tên trạng thái, số lượng thẻ và màu riêng.
- Bảng Kanban cuộn ngang để xem các cột tiếp theo.

Thông tin trên thẻ, tùy từng phiếu:

- Biển số nổi bật; mã lệnh/phiếu dịch vụ.
- Nhãn trạng thái và nhãn thanh toán.
- Hãng, loại xe, tên khách hàng.
- CVDV; KTV khi đã phân công.
- Nội dung yêu cầu hoặc ghi chú.
- Ngày giờ hẹn.
- Tiền cọc, còn nợ, giá trị báo giá.
- Deadline, cảnh báo quá hạn và tiến độ phần trăm.
- Chỉ dẫn đi tiếp: báo giá, thi công, nghiệm thu hoặc thu tiền.

Đã bấm một thẻ ở cột chờ nghiệm thu và được đưa tới đúng trang nghiệm thu của phiếu đó. Không thử kéo thả thẻ vì chưa xác định thao tác này có làm đổi trạng thái nghiệp vụ hay không.

### 4.2. Danh sách phiếu dịch vụ — `/admin/phieu-dich-vu`

Các cột đã thấy:

| Thông tin phiếu/xe | Vận hành và tài chính |
| --- | --- |
| Số phiếu, biển số, loại xe, khách hàng | Trạng thái, thành tiền, còn nợ |
| Ngày tạo | Tiến độ, tư vấn, KTV, deadline |

- Bộ lọc từ ngày, đến ngày, trạng thái; nút “Xem”.
- Khoảng ngày lọc được phản ánh lên query string.
- Có phân trang và liên kết xuất dữ liệu.
- Nút “Tiếp nhận xe” mở form tạo phiếu.
- Từng dòng có liên kết nghiệp vụ phù hợp như báo giá, thi công, xuất phụ tùng, nghiệm thu, thu/cọc.

#### Hộp thoại chi tiết phiếu

Đã mở từ lịch sử dịch vụ của xe. Hộp thoại tổng hợp:

- Trạng thái, xe, khách, số điện thoại, người lập, ngày tạo.
- Nhân viên tư vấn và dấu hiệu phiếu của đối tác Toàn Trung.
- Yêu cầu dịch vụ, công việc dự kiến và ghi chú.
- **Ảnh/video tiếp nhận hoặc hiện trường:** chọn media, phân loại; có nút tải tất cả ảnh.
- **Thảo luận:** ô nhập có gợi ý `@user`, đính kèm ảnh và gửi.
- Báo giá, số dòng dịch vụ/phụ tùng, các tổng tiền và đường dẫn xem/sửa.
- Thi công: tiến độ, KTV, deadline, nút bắt đầu.
- Ghi vết lịch sử chỉnh sửa, gồm người thực hiện, thời điểm và nội dung thay đổi.

Chỉ đọc hộp thoại; không sửa nhân viên tư vấn, cờ đối tác, tải lên media hay gửi thảo luận.

### 4.3. Tiếp nhận xe — `/admin/phieu-dich-vu/tao`

Form mở dần sau khi chọn một xe. Đã tìm và chọn xe có sẵn để đọc các phần sau; không tạo phiếu.

1. **Tìm xe theo biển số:** gõ để tìm; giao diện thông báo có tự chuẩn hóa biển số. Có nhánh thêm xe mới.
2. **Thông tin xe:** biển số, loại xe, khách hàng; bảng các phiếu dịch vụ gần nhất và nút xem chi tiết.
3. **Tình trạng xe:** ngoại thất, nội thất; tình trạng động cơ gồm đề nổ, “Gara nổ”, taplo; ODO (km).
4. **Lưu ý khách hàng.**
5. **Khảo sát tình trạng chạy:** đề nổ, tiếng động cơ, sang số, gầm khi di chuyển, vô lăng, phanh, hệ thống lạnh, hao nhớt, hao nước.
6. **Phiếu dịch vụ:** yêu cầu ban đầu, ghi chú tiếp nhận, cờ “Phiếu của đối tác Toàn Trung”, nhân viên tư vấn.
7. **Công việc dự kiến:** checklist tùy chọn, được mô tả là tách khỏi báo giá để cập nhật tiến độ thi công.

Nhánh thêm xe mới ngay trong quy trình gồm biển số, loại xe và khách hàng, với nút lưu xe mới/hủy thêm mới.

### 4.4. Lịch hẹn — `/admin/dat-lich`

Bảng gồm ngày hẹn, mã phiếu, biển số, loại xe, khách hàng, điện thoại, dịch vụ, đã cọc và thao tác.

Các thao tác nhìn thấy:

- Đặt lịch mới.
- Sửa ngày giờ hẹn: đã mở hộp thoại, gồm ngày và giờ, nút hủy/lưu.
- Hủy lịch hẹn: chỉ ghi nhận có nút, không bấm.
- Báo giá.
- Tiếp nhận: không bấm để tránh đổi trạng thái lịch thật.

Form tạo tại `/admin/dat-lich/tao`:

- Tìm xe bằng autocomplete biển số hoặc thêm xe mới.
- Hiển thị lại xe, loại xe, khách hàng sau khi chọn.
- Ngày hẹn, giờ hẹn.
- Dịch vụ khách hẹn và ghi chú.
- Cọc tùy chọn: số tiền, hình thức và tài khoản ngân hàng.
- Nút lưu lịch hẹn.

Trong màn hình danh sách đã xem, chưa thấy bộ lọc theo ngày, lịch tuần/tháng hoặc bộ chọn năng lực khung giờ. Đây là ghi nhận giao diện hiện tại, không kết luận hệ thống hoàn toàn không có cơ chế kiểm tra lịch trùng/năng lực ở nơi khác.

### 4.5. Báo giá theo phiếu — `/admin/phieu-dich-vu/bao-gia/{id}`

Đầu trang nhận diện phiếu dịch vụ, biển số, khách hàng và mã báo giá có hậu tố `-BG`.

#### Thông tin chung

- Checklist công việc dự kiến, có nút lưu riêng.
- Kho tham chiếu tồn phụ tùng.
- Chiết khấu tổng theo phần trăm và số tiền.
- Tài khoản ngân hàng phục vụ QR chuyển khoản.
- Ngày/giờ bắt đầu và kết thúc.

#### Dòng báo giá

Hai bảng riêng: **Công việc dịch vụ** và **Phụ tùng vật tư**.

Các trường quan sát: tên hạng mục, diễn giải, DVT, số lượng, giá nhập, tỷ lệ, giá bán, CK %, CK tiền, VAT %, thành tiền. Phụ tùng có thêm thông tin tồn kho. Có nút thêm dòng và nút xóa trên dòng.

Các tổng tiền: tiền gốc, chiết khấu dòng, tổng VAT, tạm tính, chiết khấu tổng theo %/tiền và thành tiền.

#### Lịch sử và thao tác

- Ghi vết thể hiện thay đổi trước → sau của giá, diễn giải, tỷ lệ, số lượng, VAT hoặc tổng tiền; ghi nhận cả thêm hạng mục.
- Có người sửa và thời điểm sửa.
- Các nút: xem báo giá, in báo giá, in yêu cầu xuất kho, khách xác nhận BG, lưu báo giá và thi công.
- Đã mở **Xem báo giá**: hộp thoại trình bày đủ các dòng, tổng tiền và liên kết in.
- Bản xem nội bộ có giá nhập và tỷ lệ; **bản in báo giá khách hàng đã xem không hiển thị hai cột này**.

Chưa kiểm chứng công thức tính, quy tắc làm tròn, thứ tự áp dụng chiết khấu/VAT hoặc hậu quả của nút xác nhận khách hàng, vì không sửa/lưu dữ liệu.

### 4.6. Báo giá nhanh — `/admin/bao-gia-nhanh`

- Thông tin khách hàng, SĐT/Zalo, biển số, xe/mô tả và địa chỉ đều ghi tùy chọn.
- Chiết khấu tổng %, tiền; tài khoản ngân hàng; thời gian bắt đầu/kết thúc.
- Chọn dịch vụ và phụ tùng từ từ điển.
- Mỗi nhóm có nút **Dòng thủ công**.
- Hai bảng dịch vụ/phụ tùng có giá nhập, tỷ lệ, giá bán, chiết khấu, VAT, thành tiền.
- Khu tổng tiền và nút làm mới/in báo giá.

Giao diện cho thấy đây là nhánh chuẩn bị báo giá khi chưa cần chọn một phiếu dịch vụ có sẵn. Chưa xác minh báo giá nhanh có lưu ở máy chủ, chuyển sang phiếu dịch vụ hay chỉ phục vụ in.

### 4.7. Thi công — `/admin/phieu-dich-vu/thi-cong/{id}`

Đã xem cả phiếu ở giai đoạn báo giá và phiếu đang thi công.

**Trước khi thi công:** trạng thái, báo giá, thành tiền, KTV phụ trách; form chọn KTV chính, deadline ngày/giờ, ghi chú và nút bắt đầu.

**Khi đang thi công:**

- Tiến độ phần trăm.
- Deadline và ghi chú.
- Bảng phân công nhiều KTV: KTV, công việc, đánh dấu xong; có nút thêm KTV.
- Checklist công việc dự kiến.
- Nhật ký công việc: xem lịch sử và ô ghi nhật ký mới.
- Các đường đi sửa báo giá, xuất phụ tùng.
- Nút chuyển chờ nghiệm thu và lưu tiến độ.

Nhật ký có cả sự kiện liên quan như sửa báo giá, xác nhận khách, thu cọc và xuất phụ tùng. Chưa xác minh công thức tính tiến độ hoặc quyền sửa công việc của từng KTV.

### 4.8. Xuất phụ tùng theo phiếu — `/admin/phieu-dich-vu/xuat-pt/{id}`

- Trạng thái phiếu và khách hàng.
- Danh sách các phiếu xuất đã lập.
- Kho xuất, ngày xuất, ghi chú.
- Bảng phụ tùng với các lượng **báo giá / đã xuất / còn lại / tồn / số lượng xuất**, DVT và đơn giá.
- Có số lượng thập phân, không chỉ số nguyên.
- Tùy chọn chuyển phiếu sang chờ nghiệm thu sau khi xuất.
- Nút quay lại thi công và lưu phiếu xuất.

### 4.9. Nghiệm thu — `/admin/phieu-dich-vu/nghiem-thu/{id}`

Đã xem một phiếu chờ nghiệm thu và một phiếu DONE.

- Trình bày theo mẫu **Biên bản nghiệm thu dịch vụ**, có thông tin công ty và quốc hiệu.
- Thông tin xe, khách, KTV, báo giá, tiến độ và yêu cầu dịch vụ.
- Các hạng mục dịch vụ/phụ tùng, chiết khấu, VAT và tổng tiền; phụ tùng có cột ngày bảo hành.
- Checklist: mục kiểm tra, đạt, ghi chú; có thêm mục.
- Người nghiệm thu, kết quả, ghi chú nghiệm thu.
- Khu ký của khách hàng, cố vấn dịch vụ và KTV trưởng.
- Thông tin chuyển khoản và nhật ký.
- Nút in biên bản, lưu checklist, hoàn tất → DONE.
- Với phiếu DONE, giao diện báo đã hoàn tất và không còn form cập nhật checklist như phiếu đang chờ.

**Điều kiện được thể hiện rõ trên giao diện:** một phiếu chờ nghiệm thu bị chặn hoàn tất vì chưa xuất hết phụ tùng báo giá. Trang nêu các phụ tùng còn thiếu cùng lượng báo giá, đã xuất và còn lại, có liên kết mở trang xuất phụ tùng. Chưa thử vượt điều kiện hoặc gửi yêu cầu hoàn tất.

### 4.10. Thu/cọc — `/admin/phieu-dich-vu/thu-chi/{id}`

Phiếu đã xem hiển thị:

- Trạng thái phiếu; mã và trạng thái xác nhận báo giá.
- Thành tiền, đã cọc, đã thu, còn nợ dịch vụ.
- Bảng phiếu thu/chi đã lập: số phiếu, ngày, loại, hình thức, tài khoản ngân hàng, số tiền, người lập và đường dẫn in.
- Thông báo đã thu đủ theo báo giá.
- Nút ghép tablet; trạng thái chờ đánh giá trên tablet; làm mới và bỏ qua đánh giá.
- Liên kết “Sổ thu chi”.

Chưa thực hiện ghép tablet, bỏ qua đánh giá hay nhận tiền. Vì phiếu được xem đã thu đủ, chưa khảo sát đầy đủ form nhập khoản thu mới/thu thiếu/hoàn tiền.

## 5. Nhóm Kho

### 5.1. Nhập kho

Danh sách có từ ngày/đến ngày, tìm kiếm, phân trang và tạo phiếu. Cột: số phiếu, ngày, số hóa đơn, kho, NCC, người lập, tổng tiền và số dòng; có đường dẫn sửa/in.

Form tạo `/admin/nhap-kho/tao` và form sửa `/admin/nhap-kho/{id}`:

- Kho nhập, ngày nhập, số/ngày hóa đơn, nhà cung cấp.
- Quét hoặc nhập mã vạch; gợi ý Enter để thêm dòng.
- Ghi chú.
- Các dòng phụ tùng, DVT, số lượng, giá chưa VAT, VAT, tiền VAT, đơn giá, thành tiền.
- Tổng tiền; thêm dòng bằng **F2**, lưu/cập nhật bằng **Ctrl+S** theo nhãn nút.
- Form tạo có tải mẫu Excel và nhập từ Excel.

Đã xem bản in phiếu nhập. Không tải/import Excel, quét mã hoặc lưu phiếu để kiểm chứng xử lý kho.

### 5.2. Xuất kho

Danh sách có lọc ngày, tìm kiếm, phân trang và tạo phiếu. Cột: số phiếu, ngày, kho, phiếu DV, biển số, khách hàng, người lập, tổng tiền và số dòng; có bản in.

Form `/admin/xuat-kho/tao`:

- Tìm **phiếu dịch vụ DONE (xuất bù)**.
- Kho xuất, ngày xuất, khách hàng, mã vạch, ghi chú.
- Dòng phụ tùng có DVT, tồn, số lượng, đơn giá, thành tiền.
- Tải mẫu/nhập Excel, F2 thêm dòng, Ctrl+S lưu theo nhãn giao diện.

Đây là nhánh riêng với xuất phụ tùng ngay trong phiếu dịch vụ. Chưa thử xuất bù, xuất thiếu tồn hoặc kiểm tra thay đổi tồn kho.

## 6. Các danh mục

Các trang danh mục chủ yếu dùng bảng tìm kiếm/phân trang và hộp thoại thêm. Cột hiển thị hoặc trạng thái có thể dùng checkbox/icon thay vì chữ.

| Danh mục | Thông tin trong danh sách | Trường đã đọc trong form thêm |
| --- | --- | --- |
| Kho | Tên kho, cửa hàng, mặc định, hiển thị | Tên kho, cửa hàng, kho mặc định, hiển thị |
| Đơn vị tính | Tên DVT, ký hiệu, hiển thị | Tên đơn vị, ký hiệu, hiển thị |
| Nhóm phụ tùng | Tên nhóm, thứ tự, hiển thị | Tên nhóm, thứ tự, hiển thị |
| Phụ tùng | Mã, mã vạch, tên, DVT, nhóm, VAT %, giá bán | Mã, barcode, tên, DVT, nhóm, giá nhập/bán, VAT %, tồn tối thiểu, số ngày bảo hành, hiển thị |
| Nhóm dịch vụ | Tên nhóm, thứ tự, hiển thị | Tên nhóm, thứ tự, hiển thị |
| Dịch vụ | Mã, tên, nhóm, giá công | Mã, nhóm, tên, DVT, giờ công chuẩn, giá công, ghi chú, hiển thị |
| Loại xe | Nhãn hiệu, tên loại, phân khúc, thứ tự, hiển thị | Nhãn hiệu, tên loại, phân khúc, thứ tự, hiển thị |
| Xe dịch vụ | Biển số, loại xe, khách hàng, màu, năm SX | Biển số, loại xe, khách hàng, màu sắc, năm SX |
| Khách hàng | Họ tên, SĐT, tỉnh/xã, CCCD, hạng | Họ tên, SĐT, SĐT 2, tỉnh, xã, địa chỉ, CCCD, hạng VIP, ngày/nơi cấp, ghi chú |
| Nhà cung cấp | Tên NCC, MST, điện thoại | Tên, MST, điện thoại, email, địa chỉ, người đại diện |

Những chi tiết đáng chú ý:

- Phụ tùng có **số ngày bảo hành tính từ ngày xuất kho** theo ghi chú form.
- Khách hàng có phân hạng; mặc định hiển thị “Standard” ở những bản ghi đã xem.
- Địa chỉ khách có gợi ý phần cuối dựa trên tỉnh và xã.
- Biển số được ghi chú lưu theo dạng chuẩn hóa.
- Danh mục phụ tùng có tải mẫu và import Excel.
- Đã mở form thêm để đọc cấu trúc; chưa thử lưu, sửa, xóa hoặc thay đổi cờ hiển thị/mặc định.

## 7. Báo cáo doanh thu cố vấn dịch vụ

Trang `/admin/bc-doanh-thu-co-van-dich-vu` có:

- Từ ngày **ngày thu**, đến ngày và phạm vi.
- Nút xem báo cáo, xuất Excel.
- KPI: số phiếu, số cố vấn, tổng doanh thu, doanh thu dịch vụ, doanh thu phụ tùng.
- Bảng tổng hợp theo cố vấn: số phiếu, doanh thu, phần dịch vụ/phụ tùng, tỷ trọng.
- Bảng chi tiết: số phiếu, biển số, khách hàng, CVDV, ngày NT, doanh thu và phần dịch vụ/phụ tùng.
- Tìm theo số phiếu, biển số, khách, cố vấn.

**Giới hạn thực tế:** dù bộ chọn phạm vi hiển thị “Tất cả”, trang có thông báo tài khoản chỉ đang xem doanh thu của chính mình; cần quyền “Tất cả” để xem mọi cố vấn. Vì vậy không lấy số đang hiển thị làm doanh thu toàn công ty. Chưa kiểm tra thuật toán ghi nhận doanh thu hay tải file Excel.

## 8. Mẫu in và xuất dữ liệu

### 8.1. Những mẫu đã mở để đọc

| Mẫu | Đường dẫn hoặc nơi mở | Nội dung chính |
| --- | --- | --- |
| Báo giá dịch vụ | `/admin/phieu-dich-vu/bao-gia/in/{id}` | Công ty, mã BG, phiếu DV, xe/khách, bảng dịch vụ/phụ tùng, CK, VAT, tiền bằng chữ, chuyển khoản/QR, các vị trí ký |
| Yêu cầu xuất kho | Cùng URL in báo giá, thêm `?kind=ycxk` | Kho, phiếu DV, khách/xe, người lập, mã/tên phụ tùng, DVT, lượng cần xuất, giá trị và các vị trí ký |
| Phiếu nhập kho | `/admin/nhap-kho/in/{id}` | NCC, kho, người lập, dòng hàng, tổng tiền/bằng chữ và chữ ký |
| Phiếu xuất kho | `/admin/xuat-kho/in/{id}` | Kho, phiếu DV, xe/khách, người lập, dòng hàng, tổng tiền/bằng chữ và chữ ký |
| Phiếu thu | `/admin/phieu-thu/in/{id}` | Người nộp, lý do, số tiền/bằng chữ, hình thức thu, vị trí ký; bản đã xem bố trí hai phần phiếu lặp lại |
| Biên bản nghiệm thu | Ngay màn hình nghiệm thu, có nút in | Hạng mục thực hiện, checklist, kết quả, người nghiệm thu và chữ ký |

Bản in báo giá và phiếu kho có bố cục văn bản/bảng kẻ đen trên nền trắng, khác giao diện nhập liệu. Bản báo giá sử dụng kiểu chữ serif và có tiền bằng chữ. Bản phiếu thu có dòng ghi tên mẫu và thông tư; đây chỉ là mô tả nội dung được in, không phải đánh giá tính pháp lý của biểu mẫu.

**Xuất báo giá:** đã thấy và mở trang **In báo giá**. Chưa thấy nút xuất PDF riêng trong các màn hình đã khảo sát; chưa xác nhận có API/file PDF chuyên biệt. Không nên mô tả “xuất PDF đã hoạt động” chỉ từ việc có bản in.

### 8.2. Excel

- Có liên kết xuất dữ liệu tại danh sách phiếu dịch vụ.
- Có nút xuất Excel tại báo cáo doanh thu CVDV.
- Có tải mẫu/import Excel tại phụ tùng và tạo phiếu nhập/xuất kho.
- Chưa tải các file dữ liệu, đọc cấu trúc workbook, thử import hoặc xác minh nội dung xuất.

### 8.3. Thông tin công ty trên chứng từ

Các bản in đã xem sử dụng tên **Công ty Cổ phần Dịch vụ DP Auto**, địa chỉ **787–789 Quốc lộ 13, Phường Hiệp Bình, TP. Hồ Chí Minh**.

Số điện thoại đang in là **0777 23 23 68**, khác số **0772 584 279** người dùng đã chọn cho website mới. Cần chốt thông tin chứng từ khi xây dựng bản mới; khảo sát này không sửa CRM cũ.

## 9. Tài khoản, quyền và phần không truy cập được

### 9.1. Những gì đã đọc được

- Menu tài khoản: thông tin tài khoản, đổi mật khẩu, giao diện tối, đăng xuất.
- Trang thông tin gồm họ tên, mã nhân viên, bộ phận; hướng dẫn liên hệ quản trị để đổi tài khoản/quyền/thông tin nhân sự.
- Form đổi mật khẩu: mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu; có hướng dẫn tối thiểu 6 ký tự. Chưa thử lưu hoặc đánh giá cơ chế xác thực.
- Có trang từ chối truy cập, hướng dẫn liên hệ quản trị để phân quyền trong **Nhóm người dùng / Quyền sử dụng**.

### 9.2. Giới hạn đã gặp trực tiếp

| Phần | Kết quả |
| --- | --- |
| `/` | Chuyển sang `/access-denied` với ReturnUrl của trang gốc |
| `/admin/thu-chi` | Chuyển sang `/access-denied`; không xem được Sổ thu chi |
| Doanh thu tất cả cố vấn | Trang báo cáo nêu giới hạn chỉ xem bản thân |
| Nhóm người dùng / Quyền sử dụng | Chỉ thấy tên chức năng trong thông báo từ chối; chưa mở được màn hình quản trị này |

Không sử dụng tài khoản khác, không tìm cách vượt giới hạn quyền. Vì vậy chưa thể mô tả đầy đủ dashboard cấp quản trị, cấu hình công ty, toàn bộ sổ quỹ hoặc ma trận quyền của hệ thống cũ.

## 10. Ghi nhận UI/UX và kỹ thuật giao diện

### 10.1. Bố cục và thành phần

- Sidebar bên trái, menu nhiều tầng có thể mở/thu gọn.
- Header có nút menu, logo, chuyển sáng/tối, tài khoản.
- Nhận diện đỏ, nền sáng xám nhạt, panel trắng, viền mảnh và bo góc.
- Trạng thái dùng màu khác nhau và chữ; không chỉ dựa vào màu.
- Form có dấu `*` cho một số trường bắt buộc; autocomplete cho xe, dịch vụ, phụ tùng, khách/NCC và nhân sự tùy màn hình.
- Các bảng nghiệp vụ rộng, nhiều cột; form tiếp nhận và báo giá khá dài.
- Có nút icon kèm tooltip ở một số bảng, hộp thoại cho thêm danh mục và xem chi tiết, date/time picker.

### 10.2. Font và màu đo trực tiếp

Các giá trị sau là giá trị tính toán trong trình duyệt ở lần quan sát chế độ sáng, không phải đề xuất thay token của website mới:

| Thành phần | Giá trị quan sát |
| --- | --- |
| Font nội dung | `Inter, "Segoe UI", sans-serif` |
| Chữ nền của body | 14px, line-height khoảng 20px |
| Tiêu đề Dashboard | 28px, line-height khoảng 34,6px |
| Biển số trên thẻ | `Rajdhani, sans-serif`, khoảng 17,6px |
| Sidebar desktop mở | Khoảng 240px |
| Màu chữ chính | `rgb(26, 26, 34)` |
| Nền body sáng | `rgb(244, 244, 246)` |
| Nền thẻ xe sáng | `rgb(255, 255, 255)` |
| Đỏ biển số | `rgb(225, 6, 0)` |
| Đặt lịch | Xám xanh `rgb(120, 144, 156)` |
| Check in | Xanh dương `rgb(2, 136, 209)` |
| Báo giá | Cam `rgb(237, 108, 2)` |
| Đang thi công | Tím `rgb(123, 31, 162)` |
| Chờ nghiệm thu | Chàm `rgb(92, 107, 192)` |
| DONE | Xanh lá `rgb(46, 125, 50)` |

Đã chuyển sang tối để xem: nền tối, thẻ xám đậm, chữ sáng; màu nhận diện các giai đoạn vẫn được giữ. Sau khảo sát đã chuyển lại sáng.

### 10.3. Màn hình hẹp

Đã quan sát bổ sung hai màn hình **Kanban và danh sách lịch hẹn** ở kích thước mô phỏng **390 × 844 CSS px**, có tải lại trang ở kích thước đó. Đây là mô phỏng Chrome trên máy tính, không phải kiểm tra Safari/Chrome trên điện thoại thật.

- Sidebar thu về dải icon ở trái, vẫn chiếm một phần chiều rộng.
- Kanban giữ từng cột và cuộn ngang; thẻ xe đọc được trong cột đầu. Toolbar tìm kiếm/lọc và các nút cần thêm thao tác cuộn để tiếp cận.
- Danh sách lịch hẹn chuyển hàng dữ liệu thành các cặp nhãn/giá trị.
- Trên khung hẹp đã xem, một số giá trị và cụm nút ở phía phải bị khuất; tiêu đề/nút đặt lịch xuống nhiều dòng.
- Các ghi nhận này cho thấy cần thiết kế lại luồng dùng một tay cho bản mới, thay vì sao chép nguyên bảng và toolbar desktop. Chưa khảo sát mobile của mọi màn hình và chưa đo toàn diện khả năng truy cập.

### 10.4. Dấu hiệu công nghệ

DOM và tài nguyên trang có `MudBlazor`, `_framework/blazor.web.js` và các script giao diện riêng. Có cơ sở xác định giao diện dùng Blazor/MudBlazor. Không khảo sát mã nguồn máy chủ, API nội bộ hoặc database; không suy ra kiến trúc backend chi tiết từ các tên tài nguyên này.

## 11. Các quan hệ dữ liệu và quy tắc cần giữ khi phát triển bản mới

Phần này là **nhận định từ giao diện đã quan sát**, chưa phải lược đồ database được kiểm chứng.

| Đối tượng | Quan hệ/đặc điểm thể hiện trên giao diện |
| --- | --- |
| Khách hàng | Liên kết xe, thông tin liên hệ/địa chỉ, phân hạng |
| Xe | Biển số, loại xe, khách hàng, lịch sử phiếu dịch vụ |
| Lịch hẹn | Xe/khách, ngày giờ, nội dung và cọc; có mã phiếu dịch vụ |
| Phiếu dịch vụ | Trạng thái xe, yêu cầu, tình trạng tiếp nhận, nhân sự, media, thảo luận, nhật ký |
| Báo giá | Các dòng dịch vụ/phụ tùng, giá/CK/VAT, thời gian, xác nhận khách và lịch sử sửa |
| Công việc dự kiến | Checklist phục vụ thi công, được mô tả tách khỏi các dòng báo giá |
| Nhân sự | Người lập, CVDV, nhân viên tư vấn, KTV chính và các KTV được phân công |
| Kho/phụ tùng | Tồn tham chiếu, nhập/xuất, lượng đã xuất và còn lại theo phiếu |
| Nghiệm thu | Checklist, kết quả, người/thời điểm nghiệm thu và điều kiện hoàn tất |
| Thu/cọc | Giá trị báo giá, xác nhận, cọc, đã thu, nợ và phiếu thu liên quan |
| Chứng từ in | Nội dung nghiệp vụ, thông tin công ty, tiền bằng chữ, chuyển khoản và chữ ký |

Những điểm cần phân biệt rõ:

1. **Lịch hẹn ≠ toàn bộ phiếu dịch vụ:** phiếu còn có tiếp nhận, thi công, vật tư, nghiệm thu và tài chính.
2. **CVDV, nhân viên tư vấn, KTV và người lập là các nhãn khác nhau:** không gộp thành một trường “nhân viên” nếu chưa chốt nghiệp vụ.
3. **Đối tác Toàn Trung:** có cờ nhận diện và sự kiện nhật ký đề cập công nợ theo dõi riêng; cần hỏi rõ cơ chế trước khi triển khai.
4. **Công việc dự kiến ≠ dòng báo giá:** giao diện cũ ghi rõ tách checklist tiến độ khỏi báo giá.
5. **DONE ≠ đã thanh toán:** trạng thái tài chính tồn tại độc lập với giai đoạn xử lý xe.
6. **Xuất kho có đối soát theo báo giá:** cần bảo toàn lượng đã xuất/còn lại và điều kiện nghiệm thu, không chỉ một nút đổi trạng thái.
7. **Giá nhập và giá khách hàng:** có phạm vi hiển thị khác nhau giữa xem nội bộ và bản in khách hàng.
8. **Lịch sử chỉnh sửa:** hệ thống đang thể hiện thay đổi chi tiết, không chỉ thông báo “đã cập nhật”.

## 12. Phần chưa xác minh và câu hỏi cần chốt

### Chưa xác minh trong lần khảo sát

- Các màn hình ngoài quyền của tài khoản hiện tại.
- Lưu dữ liệu, tạo/sửa/xóa chứng từ và mọi chuyển trạng thái thực tế.
- Phân quyền chi tiết theo vai trò, theo bản ghi hoặc theo trường giá nhập.
- Trùng lịch, giới hạn năng lực, quy tắc quá hạn và lịch làm việc.
- Công thức giá, tỷ lệ, làm tròn, CK/VAT và cách tổng hợp doanh thu.
- Tự động cập nhật tồn kho, quy tắc âm kho, xuất bù và hoàn/hủy chứng từ.
- Form thu mới, thu thiếu, hoàn tiền, sổ thu chi toàn cửa hàng.
- Gửi/duyệt báo giá qua kênh ngoài hệ thống; thông báo tự động.
- Upload, tải hàng loạt, tag người dùng và gửi thảo luận.
- Import/export Excel; xuất PDF riêng; in ra máy in thật.
- Ghép tablet, ký/xác nhận hoặc đánh giá trên tablet.
- Hiệu ứng và khả năng dùng trên điện thoại thật.

### Câu hỏi để chuyển thành yêu cầu phát triển

1. Bản mới chỉ quản lý đặt lịch hay cần thay thế cả luồng vận hành garage hiện tại?
2. CVDV được tạo/sửa báo giá và thu cọc tới đâu; ai được xem giá nhập và doanh thu toàn trạm?
3. “Nhân viên tư vấn” có phải nhân viên bán xe/đối tác, khác với CVDV trực tiếp xử lý phiếu không?
4. Công nợ đối tác Toàn Trung cần tách và đối soát như thế nào?
5. Cọc trước hẹn có làm xác nhận báo giá hay ảnh hưởng trạng thái xe không?
6. Những điều kiện bắt buộc trước khi DONE ngoài xuất đủ phụ tùng là gì?
7. Các mẫu in hiện tại cần giữ nguyên nội dung nào; thông tin công ty, hotline, chữ ký và QR nào được dùng cho bản mới?
8. Có cần chuyển dữ liệu lịch sử khách/xe/phiếu, media, tồn kho và công nợ sang hệ thống mới không?

## 13. Kết luận

Hệ thống cũ có ba lớp chức năng liên kết: **đặt lịch và tiếp nhận**, **thực hiện dịch vụ**, **kho và tài chính/chứng từ**. Luồng nghiệp vụ đã được thể hiện khá sâu qua báo giá, checklist, nhật ký, media, xuất vật tư và nghiệm thu.

Báo cáo này là tư liệu khảo sát để hiểu hệ thống đang dùng. Không thay đổi giao diện/source của dự án mới hoặc dữ liệu nghiệp vụ trong CRM cũ. Các điểm chưa có quyền hoặc cần thao tác ghi dữ liệu được giữ ở mức chưa xác minh, không coi là chức năng đã kiểm chứng thành công.
