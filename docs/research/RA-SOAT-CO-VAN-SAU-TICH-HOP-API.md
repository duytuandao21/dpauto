# Rà soát UI/UX `/co-van` sau khi tích hợp API

Ngày: 13/11/2026.

## Kết luận

Phản ánh UI/UX thay đổi là có cơ sở. Nguyên nhân chính nằm ở cách nối giao diện: các nhánh `apiEnabled` chuyển từ component đã duyệt sang `LiveVisits`, `LiveVisitDetail`, `LiveReception`, `LiveWorkflow` với cấu trúc JSX khác. CSS CoreUI vẫn tồn tại, nhưng nhiều mẫu bố cục, class responsive và tiện ích cũ không được dùng lại. Đây không phải yêu cầu bắt buộc của API.

Đối chiếu dựa trên component local/Git hiện có, stylesheet `admin.css`, `advisor.css`, `advisor-coreui.css` và báo cáo giao diện trước đó. Không lấy mẫu thiết kế ngoài hoặc thay palette/font.

## Các sai lệch và chỉnh sửa

| Khu vực | Phát hiện | Đã chỉnh |
| --- | --- | --- |
| Tổng quan | `AdvisorProvider` trả `orders=[]` khi bật API; “Cần xử lý” không còn theo dõi phiếu đang làm | Đọc phiếu active từ API, đưa về danh sách việc theo giai đoạn và ưu tiên quá hạn; giữ giao diện tác vụ hiện có. Dùng snapshot khách/xe khi hiển thị lịch; giờ so sánh theo UTC+7. |
| Lịch hẹn | Form liên hệ nằm ngay đầu chi tiết, đẩy khách/xe xuống; thêm một lịch sử thao tác thứ hai | Đưa form vào nhóm thu gọn bên dưới thông tin chính, bỏ truy vấn/lịch sử lặp; giữ endpoint ghi nhận liên hệ và timeline chính. |
| Xe dịch vụ | Tên màn hình đổi, mất tìm kiếm có icon và bộ lọc nhanh, bộ lọc nâng cao bung sẵn; ô ngày thiếu class chuẩn | Dùng lại tiêu đề Xe dịch vụ, tìm kiếm, bộ lọc nhanh/nâng cao, `adv-filters`, empty state; phân trang hiện khi có trang để chuyển. Giữ lọc/paging phía server. |
| Nhãn trạng thái | Nhiều giai đoạn dùng chung một màu; chi tiết phiếu dùng badge trung tính | Ánh xạ trạng thái API về các tone sẵn có cho chờ xử lý, thi công, nghiệm thu, hoàn tất và dừng. |
| Chi tiết phiếu | Mất thẻ khách/xe và các tiện ích liên hệ; tóm tắt bị thay bằng vài đoạn văn | Dùng lại `OrderPerson` với dữ liệu API: gọi, sao chép SĐT, Zalo, soạn nội dung, hồ sơ khách/xe. Khôi phục `adv-summary` và tab Tổng quan; giữ số tiền server, nguồn tiếp nhận, liên kết lịch và lần tiếp nhận trước. |
| Báo giá | Hạng mục API dùng grid chung thay bố cục đã thiết kế riêng cho báo giá | Dùng lại `adv-line-head`, `adv-line-fields`, `adv-line-name` và breakpoint cũ. Không đổi dữ liệu số thập phân, tiền, revision hoặc xác nhận báo giá. |
| Tiếp nhận | Tiêu đề card không còn số bước; thiếu lối quay lại; legend và tiêu đề card lặp nhau | Dùng lại mẫu tiêu đề nhóm có số, liên kết quay lại; fieldset được đặt tên bằng ARIA thay việc lặp tiêu đề nhìn thấy. Hiển thị trạng thái chưa có dịch vụ khi catalog rỗng. |
| Hồ sơ khách/xe | Chèn toàn bộ màn danh sách API vào panel hồ sơ, đẩy thông tin khách/xe xuống dưới | Render lịch sử dạng hàng gọn `adm-related-bookings`, thông tin xe xuất hiện trước lịch sử; giữ paging, legacy history và phân quyền. |
| Shell, lỗi tải và toast | Provider trả màn lỗi ngoài shell; tải lại có thể làm mất điều hướng và theme. Toast API thiếu `data-theme` | Giữ shell/provider khi tải hoặc lỗi; trạng thái lỗi trong main và có nút tải lại. Toast theo theme đã chọn. |
| Tài khoản và lịch sử | Mục Thông báo còn mở hộp thoại đếm lịch thay vì inbox; breadcrumb lịch sử rơi về Tổng quan | Dẫn tới inbox API trong chế độ API; bổ sung nhận diện route lịch sử trong shell. |
| Mobile và tối | Nhóm nút mới ép vùng tiêu đề; đoạn văn không class bị màu chữ website công khai ghi đè | Chỉ bổ sung responsive cho nhóm hành động trong header cố vấn. Đoạn văn trong workspace kế thừa màu của thành phần; giữ nguyên token sáng/tối. |

Các chỉnh sửa chính nằm trong `src/components/advisor/{live-visits,live-workflow,live-reception,workflow-quote,visit-intake-fields,overview-tasks,order-common,vehicle-profile}.tsx`, các component admin dùng cho cố vấn, `src/lib/api/visits.ts` và `src/styles/advisor-coreui.css`.

## Những khác biệt cần giữ do nghiệp vụ thật

- Danh sách rỗng khi chưa có dữ liệu hoặc không thuộc phạm vi được giao; không đưa fixtures/localStorage trở lại bản API.
- Đối chiếu xe, lý do thiếu biển số/ODO, quyền theo cố vấn, revision báo giá, xác nhận của khách và các điều kiện tồn/tiền trước bàn giao vẫn được giữ.
- Phụ tùng/thu tiền là bước nghiệp vụ mới đã có API; không bỏ tab hoặc thay bằng trạng thái hoàn thành cục bộ.
- Không sửa backend, endpoint, database, role hoặc grant trong lượt UI này.

## Kiểm tra đã thực hiện

### Trình duyệt

Người dùng đăng nhập Chrome riêng. Phiên hiện có role **MANAGER**. Cổng 4001 hiển thị bản build trước chỉnh sửa; mở Next dev riêng tại **4003** để kiểm tra mã mới, không thay server 4001. Turbopack bị chờ biên dịch nên chuyển dev sang Webpack; không chạy production build hoặc bộ E2E.

Đã mở và kiểm tra bố cục ở **390 × 844, 820 × 1000, 1440 × 900**:

| Route | Kết quả ở dữ liệu hiện tại |
| --- | --- |
| `/co-van` | Tổng quan rỗng, KPI/tác vụ/lịch hôm nay; không tràn ngang. Sau chỉnh nhóm nút, vùng tiêu đề mobile rộng đủ 358 px. |
| `/co-van/lich-hen` | Lịch ngày, bộ lọc và trạng thái rỗng; không tràn ngang. |
| `/co-van/lich-hen/tao-moi` | Ba nhóm form tạo lịch hiển thị; không gửi form, không tràn ngang. |
| `/co-van/phieu-dich-vu` | Bộ lọc nhanh/nâng cao, empty state; thao tác chọn bộ lọc không báo lỗi. Ô ngày dùng input chuẩn cao 45 px; không tràn ngang. |
| `/co-van/tiep-nhan/truc-tiep` | Form tiếp nhận với catalog hiện rỗng; các nhóm nội dung và trường bắt buộc vẫn có; không gửi form, không tràn ngang. |
| `/co-van/khach-hang` | Danh sách rỗng, tìm kiếm và empty state; không tràn ngang. |
| `/co-van/tai-khoan` | Thông tin tài khoản và menu; không tràn ngang. |
| `/co-van/tuy-chon` | Tùy chọn giao diện; không tràn ngang. |
| `/co-van/thong-bao` | Inbox hiện tại; không tràn ngang; không đánh dấu đã đọc. |
| `/co-van/lich-su` | Mở được khung trang nhưng API lịch sử phụ trách không tải đủ với phiên MANAGER. Không coi đây là ca đạt chức năng của cố vấn. |

Đã xem ảnh sáng/tối của danh sách và form tiếp nhận, gồm mobile/tablet/desktop đại diện. Màu mô tả empty state tối sau sửa là `rgb(183,193,208)`, đúng token `--adm-muted: #b7c1d0`. Đã trở lại theme sáng. Ảnh kiểm tra lưu ở thư mục tạm `DPAuto-advisor-ui-captures`, không đưa ảnh phiên làm việc vào repository.

### Kiểm tra code

- TypeScript frontend đạt ở lượt kiểm tra trong nhiệm vụ. Các điều chỉnh JSX/CSS và tái sử dụng `OrderPerson` sau đó được rà tĩnh/parse bằng formatter; không chạy lặp typecheck đã đạt.
- **3/3 ca mới đạt** trong `tests/advisor-api-presentation.test.mts`: tác vụ theo giai đoạn, không đề xuất xử lý phiếu đã đóng, ưu tiên quá hạn đúng thời điểm và loại trừ công việc đã hoàn tất/dừng, phân biệt tone trạng thái. Không chạy lại ca đã đạt.
- Không chạy toàn bộ suite, build, Lighthouse, benchmark, migration hoặc kiểm thử ghi vào database công ty.

## Giới hạn còn lại

Danh sách lịch, khách và phiếu trong phiên hiện tại đều rỗng. Vì vậy **chưa xác nhận trực quan** chi tiết lịch/khách/xe, phiếu, báo giá, thi công, nghiệm thu, bản in có dữ liệu thật; các màn này mới được đối chiếu code với mẫu hiện có. Cần hồ sơ được giao cho tài khoản cố vấn để kiểm tra tiếp, không tạo giao dịch giả nhằm lấp dữ liệu. Chưa kiểm tra trên điện thoại/Safari thật hoặc thao tác gửi form/thu tiền/bàn giao. Không tuyên bố khớp 100% mọi trạng thái.

Để xem chỉnh sửa: dùng bản dev `http://localhost:4003/co-van` đang mở trong Chrome kiểm tra. Bản `npm start` tại 4001 cần build lại theo quy trình của người dùng để nhận source mới.
