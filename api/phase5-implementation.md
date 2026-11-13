# Phase 5 — Operations, báo cáo, CMS và thông báo

Triển khai 13/11/2026, nối tiếp [Phase 4](phase4-implementation.md). Giữ session, CSRF, station/owner scope, version, idempotency receipt không PII và transactional outbox. Không thêm dependency hoặc biến môi trường. Giao diện dùng lại CoreUI hiện có: ManagerPanel, bảng responsive, form, nút, trạng thái, theme sáng/tối và typography.

## 1. Màn hình và dữ liệu

- `/dieu-hanh`: bổ sung số liệu vận hành hôm nay và cảnh báo, giữ danh sách lịch hẹn hiện có.
- `/dieu-hanh/bao-cao`: khoảng ngày, số xe, tỷ lệ, thời gian xử lý, công việc KTV; số tiền chỉ hiện khi có `finance.read`. Xuất CSV phiếu dịch vụ hoặc sổ tiền theo quyền.
- `/dieu-hanh/dieu-phoi`: số xe đang ở từng giai đoạn, xung đột tài nguyên và các phiếu mở; thẻ phiếu có số việc hoàn thành, KTV và hạn hẹn xong.
- `/dieu-hanh/canh-bao`: chưa phân công, quá giờ hẹn chưa tiếp nhận, báo giá chờ phản hồi, quá hạn thi công/tài nguyên thực tế, vật tư yêu cầu chưa đủ và xe sẵn sàng chờ bàn giao. Không tự đánh dấu vắng hoặc tự trả tài nguyên.
- `/dieu-hanh/nhan-su`: ca làm/nghỉ qua API, tạo tài khoản CMS riêng và cấp quyền theo nhiệm vụ.
- `/dieu-hanh/website/{noi-dung,bai-viet,hinh-anh,seo}` và `/admin`: quản trị nội dung đã nối API, không phụ thuộc dữ liệu local của ManagerProvider trong khu vực `/admin`.
- `/dieu-hanh/thong-bao`, `/co-van/thong-bao`: hộp thông báo và đánh dấu đã đọc. Header dẫn đến hộp thông báo; thanh điều hướng dưới mobile cố vấn giữ bốn mục hiện có. Quản lý có quyền riêng xem nhật ký xử lý và yêu cầu thử lại.

## 2. Quyền

| Quyền / role           | Phạm vi                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `MANAGER`              | Báo cáo vận hành, cảnh báo và lịch ca trong trạm; các quyền nhạy cảm không tự cấp                      |
| `ADVISOR`              | Số liệu, cảnh báo và thông báo chỉ trên lịch/phiếu đang phụ trách; lịch ca của chính mình              |
| `staff.manage`         | Thêm/hủy ca; vẫn cần role MANAGER                                                                      |
| `reports.export`       | Xuất CSV theo trạm; sổ tiền cần thêm `finance.read`                                                    |
| `cms.read`             | Danh sách nội dung, bản nháp, phiên bản và ảnh riêng tư                                                |
| `cms.write`            | Tạo/lưu bản nháp và tải ảnh                                                                            |
| `cms.publish`          | Xuất bản phiên bản đã chọn hoặc gỡ nội dung                                                            |
| `notifications.manage` | Nhật ký outbox, delivery logs và yêu cầu thử lại; chỉ MANAGER                                          |
| `CMS_ADMIN`            | Mặc định chỉ có `cms.read`; chỉ nhận thêm grant `cms.*`, không đọc lịch, khách, kho, báo cáo hoặc tiền |

Người có `roles.manage` cấp quyền tại **Nhân sự → Quản lý tài khoản → Quyền theo công việc**; cần `staff.manage` để tạo hồ sơ/tài khoản. Tài khoản được đổi quyền cần đăng nhập lại. Việc tạo CMS_ADMIN không cấp quyền vận hành từ chức danh hồ sơ. Không tự cấp các grant mới cho người đang dùng khi migrate. Giữ bảo vệ tài khoản cấp quyền cuối cùng.

## 3. Định nghĩa KPI và CSV

- Giờ Việt Nam, khoảng ngày bao gồm cả ngày đầu/cuối; tối đa 93 ngày mỗi báo cáo.
- **Tiếp nhận:** `received_at` trong kỳ, đếm từ service_visits.
- **Hoàn thành nhóm tiếp nhận:** số phiếu trong nhóm trên hiện đã HANDED_OVER / tổng số phiếu trong nhóm. Mẫu số 0 hiển thị dấu gạch, không giả định 0% hay 100%.
- **Xe bàn giao:** `handed_over_at` trong kỳ, khác nhóm tiếp nhận. Thời gian xử lý trung bình là phút từ nhận đến giao của các xe bàn giao trong kỳ.
- **Vắng hẹn:** NO_SHOW / (ARRIVED + COMPLETED + NO_SHOW), lấy theo scheduled_start_at. Không đưa lịch chờ/xác nhận/hủy vào mẫu số.
- **Xe đang ở trạm:** trạng thái hiện tại của các phiếu chưa HANDED_OVER/ABORTED, độc lập bộ lọc kỳ tiếp nhận.
- **KTV:** công việc DONE theo finished_at; việc chung tính cho từng người đang được phân công, không cộng thành tổng việc toàn trạm.
- Tiền dùng lại Finance.report Phase 4: thực thu/hoàn/đảo theo occurred_at; báo giá theo decided_at; công nợ là số hiện tại toàn trạm tại asOf, không gọi tổng báo giá là doanh thu thực thu.
- CSV tối đa 5.000 dòng, chỉ cột allowlist; không xuất tên/điện thoại khách trong báo cáo phiếu. Sổ tiền không kèm giá vốn. Escape dấu nháy, xuống dòng và các ô bắt đầu bằng công thức Excel kể cả có khoảng trắng/ký tự điều khiển phía trước. Có audit mỗi lần xuất. GET export dùng transaction cho phép ghi audit; không lưu file CSV/PII vào idempotency receipt.

## 4. Ca làm và năng lực

- Khoảng ca WORK hoặc LEAVE nằm trong một ngày theo giờ Việt Nam, chưa bắt đầu trong quá khứ. Trùng ca cùng loại bị chặn; hai ca liền nhau được gộp thành giờ liên tục; ca nghỉ trừ khỏi ca làm. Hủy có version và lý do; không xóa lịch sử.
- Ca không cộng thêm người/tài nguyên vào pool. Khi resource_unit gắn staff_id, giờ khả dụng bị giới hạn bởi ca làm và trừ ca nghỉ. Chưa có ca WORK thì giữ giờ tài nguyên đã cấu hình; LEAVE vẫn trừ giờ đó. Các giới hạn bucket thủ công vẫn giữ nguyên.
- Thay ca kiểm tra toàn bộ ngày, gồm lịch cuối ngày, allocations đã giữ, tài nguyên thực tế chưa giải phóng và KTV đang thi công dù chưa gắn resource_unit. Nếu ảnh hưởng, trả CAPACITY_IMPACT và rollback ca cùng version/audit; phải điều phối trước.
- Bắt đầu/tiếp tục thi công và bắt đầu công việc kiểm tra KTV có đang trong ca/nghỉ. Không dùng kiểm tra giờ hiện tại để chặn việc phân công trước cho tương lai.
- Nhân sự còn ca WORK tương lai phải hủy/điều chỉnh trước khi offboard. Đổi ca tăng configuration_version để client cũ chọn lại năng lực.

## 5. CMS và website public

- Document có station/kind/key, optimistic version và con trỏ published_revision_id. Mỗi lần lưu tạo revision mới bất biến; sửa bản nháp không sửa nội dung đang public. Publish chọn đúng revision thuộc document và version hiện tại; có audit ghi ID phiên bản cũ/mới.
- Gỡ để lại tombstone. Bài cũ cùng slug không được xuất hiện lại từ JSON tĩnh sau khi đã gỡ. Tin đã xuất bản từ CMS được ưu tiên theo ngày đăng trước các bài legacy; có thể ghi đè bài legacy bằng cùng slug. Không tự nhập toàn bộ JSON hoặc dữ liệu CRM vào database.
- PAGE hỗ trợ `home.hero`, `home.services`, `home.pricing`, `home.cta`, `about`, `contact`, `privacy`, `terms`. Các khối trang chủ chỉ sửa tiêu đề/mô tả và ảnh ở hero/CTA; không đổi animation/layout. Giới thiệu/pháp lý có nội dung đoạn; liên hệ thêm nội dung bên cạnh các thông tin liên hệ hiện có. Đây là các vị trí cố định, không phải page builder thay bố cục.
- Trang `/chinh-sach-dat-lich` giữ nội dung gắn BOOKING_V1; không cho sửa nội dung chấp thuận qua CMS mà không có quy trình version/consent mới.
- NEWS có slug, tiêu đề, mô tả, ngày, chuyên mục, ảnh và các đoạn p/h2/h3/li/blockquote. Không nhận HTML/script tùy ý; React escape bản xem trước, chuyển sang HTML đã escape khi dùng RichContent hiện có.
- SEO: title, description, ảnh chia sẻ và noindex cho các route public hỗ trợ. Metadata và sitemap lấy nội dung đã xuất bản, loại bài gỡ/noindex. New slug đọc được ở `/news/[slug]` khi API bật.
- Ảnh CMS riêng với ảnh nhận xe: JPEG kiểm tra nội dung/kích thước, tối đa 200 KB, lưu bytea. Client dùng lại bộ thu nhỏ ảnh hiện có. Không nhận SVG/HTML, không fetch URL tùy ý, không tự chuyển ảnh nhận xe thành ảnh public. Asset chỉ public khi còn được tham chiếu bởi một revision đang xuất bản; bản preview yêu cầu cms.read.
- UI hiển thị 100 revision gần nhất, vẫn lưu đầy đủ lịch sử trong DB; danh sách document có cursor. Ảnh/các lựa chọn danh mục dùng collection client hiện có và báo lỗi khi vượt giới hạn, không âm thầm cắt dữ liệu. Manifest public hiện chứa cả nội dung bài, giới hạn 2.000 mục; cần tách list/detail trước khi phát triển thư viện nội dung lớn để giảm dung lượng mỗi lần đọc.
- Giữ `NEXT_PUBLIC_API_ENABLED`. Tắt API giữ website tĩnh hiện có. Bật API thì published manifest, ảnh và fetch SSR dùng no-store; thay đổi có hiệu lực ở request/reload tiếp theo, không cập nhật nóng tab public đã mở. Khi API lỗi không phục hồi nội dung đã gỡ bằng seed; website cần backend sẵn sàng. Không thêm Redis hoặc hệ thống cache mới.

## 6. Inbox, outbox và Zalo

- Worker chỉ xử lý BOOKING_EVENT/VISIT_EVENT sau business commit; CORE_MUTATION để consumer tương ứng xử lý sau, không đánh dấu gửi thành công giả.
- Claim tối đa 50 job/lượt, SKIP LOCKED, lease 30 giây có token, tối đa 5 lần. Job lỗi retry với backoff có giới hạn. Lease hết hạn được thu hồi; hết lượt chuyển FAILED. Worker cũ không được ghi đè token worker mới.
- Inbox có unique event_key/recipient; retry không nhân đôi thông báo. Recipient là quản lý active trong trạm và cố vấn hiện được giao. List/count/read kiểm tra lại scope hiện tại: người cũ không còn đọc được thông báo phiếu đã chuyển người khác.
- Delivery logs append-only, không lưu nội dung liên hệ hoặc exception thô chứa secrets. PROCESSED nghĩa là xử lý nội bộ; không có nghĩa đã gửi Zalo.
- ZaloOaAdapter mặc định BLOCKED / PROVIDER_NOT_CONFIGURED, không gọi mạng. Không chuyển SERVICE_NOTICE_ACK hoặc MARKETING thành quyền gửi OA mặc định. Chỉ tích hợp gửi thật sau khi có OA/template được duyệt, mapping người nhận, căn cứ consent theo kênh và idempotency phía provider. Các consent của Phase 1–2 được giữ nguyên, không bật quảng cáo.
- Chạy một batch rồi thoát:

```powershell
cd backend
npm.cmd run notifications:work
```

Hộp thông báo cần worker được chạy định kỳ bằng hạ tầng vận hành. Không tự tạo service nền/Task Scheduler trong nhiệm vụ này. Worker dừng không rollback nghiệp vụ; inbox được tạo khi worker xử lý backlog.

## 7. API và schema

Thêm 21 endpoint `/api/v1`:

| Nhóm         | Endpoint                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Operations   | GET `/admin/operations/{summary,alerts,export}`                                                                           |
| Ca           | GET/POST `/admin/staff-shifts`; POST `/admin/staff-shifts/:id/cancel`                                                     |
| Inbox        | GET `/admin/notifications`; POST `/admin/notifications/:id/read`                                                          |
| Worker admin | GET `/admin/notification-jobs`; POST `/admin/notification-jobs/:id/retry`                                                 |
| CMS          | GET/POST `/admin/cms/documents`; GET/PATCH `/admin/cms/documents/:id`; POST `/admin/cms/documents/:id/{publish,withdraw}` |
| Media        | GET/POST `/admin/cms/assets`; GET `/admin/cms/assets/:id`                                                                 |
| Public       | GET `/public/content`; GET `/public/cms/assets/:id`                                                                       |

Migration `0005_operations_cms_notifications.sql`: 7 bảng mới (staff_shifts, cms_assets/documents/revisions/revision_assets, notifications, notification_deliveries); tổng 70 bảng nghiệp vụ + dpauto_migrations. Mở role/grant allowlist và trạng thái PROCESSED/lease token trên outbox. Không sửa migration cũ hoặc thay số liệu Phase 1–4.

Với DB đang dùng Phase 4: sao lưu theo quy trình vận hành rồi chạy thủ công:

```powershell
cd backend
npm.cmd run db:migrate
```

Không bootstrap lại. Restart backend và cập nhật bản frontend theo quy trình đang dùng; npm start cần bản build mới. Nhiệm vụ này chưa migrate DB doanh nghiệp, build production, deploy hoặc cấu hình worker định kỳ.

## 8. Xác minh và giới hạn

- TypeScript backend và frontend đạt, mỗi lệnh chạy một lần. Các chỉnh sửa trình bày tiếp theo được rà tĩnh.
- **11 kiểm thử backend đạt:** 9 ca API/DB và 2 ca interval/CSV. Lượt đầu 8/9 đạt; một fixture gọi nhầm `/finance/report` được sửa thành `/finance/summary`, chỉ chạy lại ca đó. Bổ sung một ca riêng để bảo vệ lịch cuối ngày và KTV đang làm nhưng chưa gắn resource_unit, một ca unit cho ca liền nhau và không sửa giờ policy gốc; đều đạt. Không chạy lại ca đã thành công.
- **3 kiểm thử frontend đạt**, chạy chọn lọc từng ca: chuyển đổi văn bản CMS, escape/ghi đè/tombstone và thứ tự bài mới trước legacy.
- Migration và API dùng PostgreSQL tạm ở loopback, đã dừng và dọn sau mỗi lượt. Không đọc/đổi file env hoặc kết nối DB doanh nghiệp. Expectation số bảng trong test Phase 1/3/4 đã cập nhật theo migration mới, không chạy lại suite cũ.
- Rà tĩnh UI theo form/grid/card/table và các breakpoint hiện có; chưa kiểm tra bằng browser, tablet hoặc điện thoại thật. Không E2E, Playwright, Lighthouse, benchmark hoặc production build.
- Phạm vi chưa gồm import CRM/cutover/backup restore, gửi Zalo thật, page builder, portal khách hàng, kế toán pháp định hoặc payroll. Trước vận hành cần cấp quyền, chạy worker định kỳ và kiểm tra hạ tầng/khả dụng API. SSR hiện dùng chung IP loopback và giới hạn read API với các request qua proxy; cần cấu hình trusted client IP/rate limit tại triển khai có lưu lượng lớn. Không tự tin cậy X-Forwarded-For do client gửi.

## 9. Nhóm file chính

- Backend: migration 0005; `operations{,-contracts,-utils}.ts`, `cms.ts`, `notifications.ts`, worker script; mở rộng api/controller/auth/staff/capacity/workflow và projection phiếu.
- Frontend: `live-operations.tsx`, `live-cms.tsx`, `cms-shell.tsx`, API types/helpers, public-cms loader/merge, CMS content render; nối các màn hình manager/admin và route public/metadata/sitemap.
- Test: `backend/test/phase5.integration.test.ts`, `tests/phase5-api.test.mts`; cập nhật số bảng ở các fixture liên quan. Không đổi env, dependency, animation hoặc bộ màu.
