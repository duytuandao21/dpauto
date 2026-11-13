# Rà soát UI/UX `/dieu-hanh` sau khi tích hợp API

Ngày: 13/11/2026.

## Kết luận

Phản ánh giao diện thay đổi có cơ sở. Các nhánh `apiEnabled` thay component quản lý đã duyệt bằng màn API có JSX khác; một số màn còn dùng danh sách của cố vấn. CSS CoreUI vẫn có trong repository, nhưng các bảng, thẻ KPI, bộ lọc, biểu đồ và cột điều phối cũ không được sử dụng đầy đủ. API không bắt buộc thay thiết kế như vậy.

Đối chiếu với component local hiện có, `manager.css`, `manager-coreui.css`, thành phần admin dùng chung và báo cáo khảo sát trước đó. Giữ thiết kế CoreUI đã được duyệt riêng cho khu vực nội bộ; dùng lại token, icon, font và breakpoint của dự án.

## Phát hiện và chỉnh sửa

| Khu vực | Sai lệch | Xử lý |
| --- | --- | --- |
| Dashboard | KPI đơn giản, thiếu phân biệt màu; mất khoảng xem, biểu đồ và bố cục công suất | Dùng lại `mgr-welcome`, thẻ KPI có tone/icon, hôm nay/7/30 ngày, `BookingTrend`, `BookingDistribution`, `CapacityBars`, danh sách lịch và drawer hiện có. Số liệu lịch theo khoảng chọn; vận hành và năng lực hôm nay có nhãn riêng. |
| Lịch hẹn | Hiện UUID thay mã lịch; tìm kiếm chưa ưu tiên snapshot; liên kết chưa phân công không áp dụng bộ lọc | Hiện mã lịch có fallback ID, tìm snapshot khách/xe; đồng bộ điều kiện lịch cần phân công giữa KPI và danh sách, loại lịch đã đóng. |
| Điều phối | Chuyển thành danh sách thẻ cố vấn, mất cột giai đoạn | Dùng lại `mgr-ops-board`, `mgr-board-column`, `mgr-vehicle-card` và danh sách mobile. Lấy toàn bộ phiếu active theo bộ lọc; lỗi tải không bị coi là không có xe. |
| Phiếu dịch vụ | Dùng danh sách của cố vấn cho toàn trạm | Bảng quản lý gồm phiếu/xe, khách/liên hệ, cố vấn/KTV, trạng thái/tiến độ và đường dẫn chi tiết; tìm kiếm, lọc và phân trang phía server được giữ. |
| Giám sát báo giá | Thẻ rời khó đối chiếu nhiều phiếu | Bảng mã phiếu, phiên bản, khách, xe, trạng thái, giá trị và thao tác. Giữ chính xác chuỗi tiền, revision và liên kết đến báo giá tương ứng. |
| Báo cáo và vận hành | Các số liệu đứng rời, thiếu phân cấp | Dùng `ManagerPanel`, KPI có màu/icon và các thẻ giai đoạn; khôi phục biểu đồ lịch theo dữ liệu thật. Các thước đo, quyền xuất báo cáo và số tài chính từ server được giữ. |
| Hồ sơ khách hàng | Drawer nhiều đoạn văn và chèn nguyên trang danh sách cố vấn | Dùng mẫu hồ sơ có avatar/liên hệ, thông tin xe trước lịch sử, bảng dịch vụ gọn. Lỗi tải chi tiết có thông báo thay vì chờ mãi. Giữ lịch sử cũ và phân trang server. |
| Kho và tài chính | Tab và danh sách chứng từ/thu chi không theo bảng quản lý | Dùng `mgr-tabs`, `ManagerTable`, nhãn trạng thái và nút chi tiết hiện có; tab tự xuống hàng trên mobile. Giữ các form, quyền, ghi sổ và tính tiền hiện có. |
| Shell, theme, lỗi tải | Provider trả trang lỗi ngoài shell; toast thiếu theme; breadcrumb chi tiết rơi về Dashboard | Giữ menu/header khi tải hoặc lỗi, có nút tải lại; toast nhận theme; nhận diện route con và tiếp nhận xe. |
| CSS và phân trang | `.adv-page` bó hẹp màn quản lý; màu đoạn văn công khai ghi đè workspace tối; nút chuyển trang hiện cả khi chỉ có một trang | Sửa phạm vi `.mgr-app`/`.mgr-dialog`, giữ token sẵn có; phân trang API dùng mẫu quản lý và chỉ xuất hiện khi có trang để chuyển. |
| Quản trị nội dung | Khi thiếu quyền chỉ có một dòng chữ, mất cấu trúc trang | Giữ tiêu đề và panel quyền truy cập, không tự cấp quyền. |

Các trang danh mục dịch vụ, nhân sự, năng lực và cấu hình vẫn dùng cấu trúc quản lý đã có. Các phần mới do nghiệp vụ thật như chính sách năng lực, ca làm, chứng từ kho, thu tiền và nội dung website không bị thay bằng dữ liệu local.

## Phạm vi file

- Shell và dữ liệu: `manager-shell.tsx`, `manager-provider.tsx`, `remote-manager-provider.tsx`.
- Trang và trình bày API: `live-dashboard.tsx`, `live-visits.tsx`, `live-quotes.tsx`, `live-operations.tsx`, `live-customers.tsx`, `live-stock.tsx`, `live-finance.tsx`, `live-cms.tsx`, `live-audit.tsx` trong `src/components/manager`.
- Thành phần gọi: `operations-page.tsx`, `bookings-page.tsx`, `booking-list.tsx`; nhãn trạng thái chi tiết dùng chung trong `src/components/advisor/live-visits.tsx`.
- CSS: `src/styles/manager-coreui.css`.
- Quy tắc trình bày và kiểm tra: `src/lib/api/manager-presentation.ts`, `tests/manager-api-presentation.test.mts`.

Không thay backend, schema, hợp đồng API, role/grant, quy tắc tiền/kho hoặc điều kiện bàn giao. Không đưa fixtures trở lại giao diện API.

## Kiểm tra

### Trình duyệt

Dùng phiên Chrome riêng đang đăng nhập role **MANAGER**, bản source mới ở `http://localhost:4003/dieu-hanh`. Server `npm start` tại 4001 là build trước chỉnh sửa, không bị dừng hoặc thay thế.

Đã mở các trang sau ở độ rộng **1440, 820 và 390 px**, kiểm tra cấu trúc và tràn ngang. Desktop/tablet cao 900–1000 px; mobile 844 px.

| Nhóm | Trang | Dữ liệu/phạm vi quan sát |
| --- | --- | --- |
| Tổng quan | Dashboard, báo cáo, cảnh báo | KPI, biểu đồ, công suất và trạng thái trống hiện tại. |
| Vận hành | Lịch hẹn, điều phối, phiếu dịch vụ, báo giá | Bộ lọc, bảng/cột và trạng thái trống. |
| Danh mục | Năng lực, dịch vụ, nhân sự, khách hàng | Danh mục hiện tại, form/ca làm, bộ lọc và trạng thái trống. |
| Kho, tiền | Kho, tài chính | Kho hiện chưa có tồn; tài chính hiển thị thiếu quyền của phiên đăng nhập. |
| Website | Nội dung, bài viết, hình ảnh, SEO | Kiểm tra cấu trúc màn quyền truy cập; tài khoản hiện không có quyền CMS. |
| Hệ thống | Thông báo, cấu hình, nhật ký | Inbox, thông tin trạm/chính sách và các hàng nhật ký hiện có. |
| Tiếp nhận | Tiếp nhận xe trực tiếp | Mở form và kiểm tra bố cục, không gửi. |

Không phát hiện tràn ngang toàn trang ở các kích thước đã quan sát. Cuộn ngang bên trong bảng điều phối desktop là cách bố trí các cột hiện có. Một lượt ảnh khách hàng desktop trùng lúc Fast Refresh nên chỉ ghi nhận trạng thái tải; kết quả đó không được coi là đã kiểm tra hàng dữ liệu.

Đã xem ảnh chế độ tối của dashboard desktop, chứng từ kho mobile và danh sách phương tiện tablet. Đã thử đổi dashboard sang 7 ngày, chuyển tab Chứng từ và Phương tiện: không có thông báo lỗi tải và không tràn ngang ở các trạng thái này. Đã trả về theme sáng và dashboard desktop. Chỉ thay đổi trạng thái giao diện, không gửi lệnh nghiệp vụ.

Ảnh kiểm tra lưu trong thư mục tạm `DPAuto-advisor-ui-captures`, không đưa ảnh phiên làm việc vào repository. Không tạo khách/lịch/phiếu, cấp quyền hoặc thực hiện giao dịch để làm đầy dữ liệu.

### Code

- Frontend TypeScript đạt ở lượt kiểm tra trong nhiệm vụ. Các sửa JSX nhỏ sau đó được rà tĩnh với props của thành phần dùng lại; không chạy lặp typecheck đã đạt.
- Bốn ca kiểm tra trình bày đạt, mỗi ca thành công chạy một lần: route con/breadcrumb, tương thích bộ lọc giai đoạn cũ, thống kê đúng kỳ và loại lịch đã đóng khỏi số cần phân công, điều kiện lọc chi tiết khớp KPI.
- Không chạy toàn bộ test suite, production build, E2E/Playwright, Lighthouse, benchmark hoặc migration.

## Giới hạn và khác biệt còn lại

- Lịch hẹn, khách, phiếu và báo giá hiện không có bản ghi để kiểm tra trực quan chi tiết đầy đủ. Drawer, báo giá, thi công, nghiệm thu, bản in và chứng từ có dữ liệu mới được đối chiếu source; chưa xác nhận thao tác ghi/gửi.
- Màn tài chính/CMS chưa được kiểm tra đầy đủ khi có quyền. Không coi việc hiện thông báo quyền truy cập là kiểm thử thành công chức năng tài chính hoặc xuất bản.
- Danh sách API đi đến route chi tiết thật; không khôi phục các thao tác sửa local không có API tương ứng. Bộ lọc KTV/độ khẩn của prototype không được dựng thành bộ lọc giả khi endpoint chưa hỗ trợ.
- Năng lực chưa cấu hình được hiện bằng trạng thái chưa có dữ liệu; không tự dựng công suất hoặc dữ liệu doanh thu.
- Chưa kiểm tra trên điện thoại/Safari thật. Không tuyên bố giống 100% mọi trạng thái dữ liệu và tương tác.
- Muốn xem source mới bằng `npm start` tại 4001 cần build lại theo quy trình của người dùng; bản xem ngay hiện ở 4003.
