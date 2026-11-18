> Cập nhật 13/11/2026: đặt lịch dùng giới hạn số lịch mỗi khung giờ. Xem [cơ chế V1 và hợp đồng hiện tại](../api/booking-slots-v1.md). Các mô tả planner tài nguyên trong tài liệu Phase 1–6 là lịch sử thiết kế, không còn điều khiển nhận lịch.

# DPAuto API — Phase 1–6

Backend độc lập trong repository hiện tại: NestJS 11, Fastify 5, TypeScript, Drizzle và PostgreSQL. Frontend Next.js không đổi hệ thống UI. Hợp đồng nền: [api-design.md](../api/api-design.md).

## Đã triển khai

- Phase 6: staging/duyệt/đối soát CRM, lịch sử riêng tư trong hồ sơ khách/xe, khóa ghi, checkpoint, backup/restore kiểm chứng và gate chuyển đổi. Chưa có export CRM thật nên chưa chuyển dữ liệu hoặc cutover. Xem [hướng dẫn Phase 6 và chạy nhanh](../api/phase6-implementation.md).
- Phase 5: báo cáo/cảnh báo, ca làm có impact check, CMS revision/publish và inbox/outbox. Nâng cấp từ Phase 4 bằng migration 0005; không bootstrap lại và không có env/dependency mới. Quyền CMS/export/notification phải được cấp riêng. Worker chạy một batch bằng `npm.cmd run notifications:work`; Zalo chưa gửi ra ngoài. Xem [hướng dẫn áp dụng Phase 5](../api/phase5-implementation.md).
- 130 endpoint `/api/v1`: 46 nền Phase 1, 12 tiếp nhận Phase 2, 24 workshop Phase 3, 24 kho/tài chính Phase 4, 21 operations/CMS/notifications Phase 5 và 3 endpoint lịch sử/media Phase 6. Hợp đồng và giới hạn: [Phase 2](../api/phase2-implementation.md), [Phase 3](../api/phase3-implementation.md), [Phase 4](../api/phase4-implementation.md), [Phase 5](../api/phase5-implementation.md), [Phase 6](../api/phase6-implementation.md).
- Migration cho 76 bảng nghiệp vụ cùng một bảng metadata migration. Giữ exclusion constraint trên tài nguyên vật lý, FK/unique/check, lịch sử append-only và checksum migration.
- Public tạo PENDING và giữ một chỗ trong cùng transaction. Chờ xác nhận và đã xác nhận cùng tính vào giới hạn khung giờ; hủy/đổi giờ trả chỗ. Transaction khóa trạm để chống nhận quá giới hạn khi đặt đồng thời.
- Idempotency receipt không PII; replay kiểm tra lại quyền hiện tại. Chuyển cố vấn thu hồi quyền detail và mutation của người cũ; lịch sử riêng không chứa thông tin khách.
- Local session HttpOnly, CSRF, mật khẩu scrypt, giới hạn thử đăng nhập, revoke phiên và bảo vệ tài khoản có quyền cấp phát cuối cùng.
- Frontend API được bật qua feature flag. Dùng lại modal, form, bảng, card, theme và responsive CSS của hệ thống hiện tại; không thêm UI library.

## Cấu trúc

```text
backend/
  migrations/0001_phase1.sql  Schema và constraints
  scripts/                   Migrate, bootstrap, cấu hình, chạy test DB tạm
  src/
    app.ts                   Nest controller và xử lý lỗi
    api.ts                   Auth/scope, idempotency và transaction boundary
    auth.ts                  Session, CSRF, password, rate limit
    bookings.ts              Booking, assignment, contact và history
    capacity/                Khung giờ, giới hạn lịch và đóng/mở nhận lịch
    catalog.ts               Dịch vụ, thời lượng dự kiến và revisions
    directory.ts             Hồ sơ khách/xe theo scope
    staff.ts                 Hồ sơ và tài khoản nhân viên
    public.ts                Catalog, availability và nguồn QR
    system.ts                Settings, audit và blocks read model
    visits.ts                Tiếp nhận, ảnh riêng tư và lịch sử phiếu
    workflow.ts              Báo giá, thi công, nghiệm thu và bàn giao
    quote-money.ts           Tính VND chính xác bằng BigInt
    inventory.ts             Chứng từ, giữ hàng, tồn và đối soát kho
    finance.ts               Thu/cọc, phân bổ, hoàn/đảo, công nợ
    stock-money.ts           Quantity decimal và giá trị bình quân
    database.ts              Drizzle/pg và transaction
  test/                      Kiểm thử planner và API/DB Phase 1
```

## Chạy nhanh khi đã có database và env

Terminal 1, từ thư mục `backend`:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Terminal 2, từ root repository:

```powershell
npm.cmd run dev
```

Mở `http://localhost:4001`. Giữ `NEXT_PUBLIC_API_ENABLED=true` trong root `.env.local`. Không bootstrap lại database đã có tài khoản. Phase 6 chưa cần chạy nhập CRM khi chưa có export; quy trình riêng tại [runbook](../api/phase6-implementation.md).

## Thiết lập lần đầu

Yêu cầu Node.js 22+, PostgreSQL 18 (hoặc phiên bản tương thích `btree_gist`). Database DPAuto phải độc lập database bán xe. Dùng database mới, không trỏ script vào CRM cũ.

Trong thư mục repository:

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
```

Điền `.env`:

- `DATABASE_URL`: database mới của DPAuto.
- `API_SECRET`: sinh bằng lệnh trong `.env.example`; không commit.
- `APP_ORIGIN`: origin frontend chính để tạo link/QR, không có dấu `/` cuối; luôn được phép truy cập API.
- `APP_ALLOWED_ORIGINS`: các origin frontend bổ sung, ngăn bằng dấu phẩy; có thể để trống. Mỗi origin gồm giao thức HTTP/HTTPS, tên miền hoặc IP và cổng nếu có; không có đường dẫn, dấu `/` cuối hay wildcard.
- Các trường `BOOTSTRAP_*` và thông tin trạm còn trống. Mật khẩu tạm từ 15 đến 128 ký tự.

```powershell
npm.cmd run db:migrate
npm.cmd run db:bootstrap
npm.cmd run dev
```

Bootstrap chỉ chạy khi chưa có authority; không tự tạo mật khẩu hoặc dữ liệu khách/xe. Xóa `BOOTSTRAP_PASSWORD` khỏi env sau khi tạo tài khoản. Lần đăng nhập đầu phải đổi mật khẩu trước khi dùng nghiệp vụ.

Nếu đã dùng các phase trước: sao lưu theo quy trình vận hành rồi chỉ chạy `npm.cmd run db:migrate` để áp dụng các migration còn thiếu đến `0006_legacy_cutover.sql`; không chạy lại bootstrap. Phase 4–6 không cần dependency hoặc env bắt buộc mới. Sau cập nhật, người có roles.manage cấp các quyền kho/thu/hoàn/xem giá vốn ở Nhân sự; không tự thêm quyền nhạy cảm cho tài khoản hiện có. Phiếu được bàn giao khi thu đủ, cấp đủ phụ tùng và nghiệm thu hợp lệ. Xem [hướng dẫn Phase 4](../api/phase4-implementation.md#7-schema-và-áp-dụng) và [chuyển đổi Phase 6](../api/phase6-implementation.md).

Tại root, tạo hoặc cập nhật `.env.local` theo `.env.example`:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:4001
API_INTERNAL_URL=http://127.0.0.1:4002
NEXT_PUBLIC_API_ENABLED=true
```

Chế độ dev cần khởi động lại Next để nhận cấu hình. Với `npm start`, flag `NEXT_PUBLIC_*` cần được đặt khi tạo bản build mới trong quy trình deploy; không chỉ đổi env rồi restart bản build cũ. `npm run api:dev` tại root cũng chạy backend. Không có server frontend hoặc backend được để chạy sau nhiệm vụ triển khai này.

## Cấu hình trạm

Booking mặc định đóng. Có thể đăng nhập `/dieu-hanh/cau-hinh` trước khi có catalog:

1. Tạo đầy đủ nhóm tài nguyên, các cầu/KTV/thiết bị thực và giờ khả dụng, giữ **Mở nhận lịch** tắt. Mỗi resource đại diện một tài nguyên vật lý; không nhân bản một KTV để tăng năng lực.
2. Vào `/dieu-hanh/dich-vu`, tạo mã dịch vụ, các requirement gồm pool/units/offset/duration và bật cho phép đặt lịch. Các khoảng thời gian phải lấy từ vận hành thực.
3. Trở lại cấu hình, giữ nguyên footprint và bật nhận lịch. Nếu thiếu plan/tài nguyên/giờ, server từ chối mở nhận lịch.
4. Trong `/dieu-hanh/nhan-su`, tạo nhân sự và tùy chọn tài khoản cố vấn nếu có quyền `roles.manage`. Cố vấn đổi mật khẩu tạm trước khi nhận phân công.

Thay footprint áp dụng từ đầu ngày hiệu lực mới. Publication có active holds trong khoảng ảnh hưởng bị từ chối; chọn ngày sau các holds hoặc điều phối trước. Bật/tắt nhận mới với cùng footprint không hủy holds hiện có.

Cũng có thể nhập cấu hình offline bằng JSON thật theo [station-config.example.json](station-config.example.json):

```powershell
npm.cmd run db:configure -- C:\path\station-config.json
```

Template có trường `null` và mảng rỗng cần điền; không phải seed vận hành. Services dùng `poolCode` trong requirements; script ánh xạ sang UUID và commit toàn bộ hoặc rollback. `BOOTSTRAP_EMAIL` phải là Manager có `roles.manage` của trạm.

Thông tin đặt lịch hiện dùng registry `BOOKING_V1` tại `/chinh-sach-dat-lich`. Marketing mặc định không đồng ý; chưa có nội dung marketing được publish nên API không cho bật opt-in. Nội dung thông báo cần được trạm kiểm tra trước go-live.

## LAN và production

- Để dùng cả localhost trên máy tính và IP trên điện thoại, giữ `APP_ORIGIN=http://localhost:4001`, thêm `APP_ALLOWED_ORIGINS=http://<IP-máy>:4001` trong `backend/.env`, rồi khởi động lại backend. Có thể thêm nhiều origin bằng dấu phẩy. Hai thiết bị dùng cùng mạng LAN; backend vẫn bind loopback, Next proxy public/admin API. Phiên đăng nhập tách riêng theo từng địa chỉ. Nếu muốn link/QR cũng mở được trên điện thoại, dùng địa chỉ IP làm `APP_ORIGIN`, thêm localhost vào `APP_ALLOWED_ORIGINS`.
- Khi chạy `npm run dev`, IP truy cập phải có trong `allowedDevOrigins` của `next.config.ts`; đây là cấu hình riêng của Next, không thay thế danh sách origin của backend.
- Production: `NODE_ENV=production`, HTTPS cho `APP_ORIGIN` và mọi origin bổ sung, secret riêng và reverse proxy cùng origin. Cookie production có prefix `__Host-` và Secure; không nới sang cookie HTTP để xử lý deploy sai.
- Không proxy `/internal`: probes chỉ dùng qua backend nội bộ. Không bật CORS hoặc tin tùy ý `X-Forwarded-For`. Giới hạn IP hiện dùng địa chỉ peer; khi Next proxy qua loopback, giới hạn theo IP được chia sẻ, cần cấu hình proxy tin cậy theo hạ tầng thực trước mở công khai.
- Tách quyền migration/extension khỏi user runtime khi triển khai. Không dùng tài khoản PostgreSQL superuser làm runtime.
- Backend có script `npm run build` để xuất JavaScript vào `dist/`; `npm start` chạy JavaScript này và không cần tsx/dev dependencies ở runtime. Tạo build trong bước deploy được duyệt, không tự chạy trong nhiệm vụ này. Migration/bootstrap chạy ở bước quản trị có dev dependencies trước khi bỏ dev dependencies khỏi runtime.
- Chưa chạy migration trên DB công ty, deploy, import CRM, backup/restore thực hoặc đặt thông số tài nguyên thay người vận hành.

## Giới hạn được giữ rõ

- Đã nối tiếp nhận, workshop, nghiệm thu và bàn giao theo tồn/tiền thực; CMS revision/publish và inbox; công cụ chuẩn hóa/nhập tham chiếu CRM. Kho có chứng từ và ledger; tiền có thu/cọc/phân bổ/hoàn/đảo, điều chỉnh giảm và phiếu thu/chi. Chưa có tích hợp ngân hàng/POS, hóa đơn điện tử, kế toán thuế, gửi Zalo/customer portal hoặc dữ liệu CRM thật. Chưa có connector tự đọc database/Excel CRM cũ.
- Xe thi công có occupancy thực, gia hạn kiểm tra xung đột và trả khu vực bằng xác nhận riêng. Xe quá giờ tiếp tục chặn tài nguyên; không tự coi đã ra ngoài. Chưa cutover CRM: cần cấu hình và nhập số dư thực, cấp quyền, diễn tập vận hành và các gate release.
- Ảnh tiếp nhận được thu nhỏ ở trình duyệt, nhận JPEG tối đa 200 KB/ảnh, 6 ảnh/phiếu, body tối đa 2 MB. Nội dung lưu trong PostgreSQL, không đặt trong `public`; API kiểm tra chủ phiếu hiện hành mỗi lần đọc. Gỡ ảnh là thu hồi quyền đọc, chưa xóa vật lý khỏi backup hoặc database; cần chính sách lưu giữ trước go-live.
- PENDING không tự hết hạn. Manager phải theo dõi và xử lý lịch chưa phân công.
- Dịch vụ nối tiếp theo thứ tự được chọn. Một requirement phải liên tục, trong cùng ngày/giờ cho phép; occupancy làm tròn bảo thủ theo bucket.
- Policy publication v1 không cho thay footprint đè live holds, kể cả thay đổi có thể chỉ bổ sung; cần impact planner chi tiết trước khi mở sửa trực tiếp tình huống này.
- Public calendar không dùng fixture để đánh dấu ngày đầy/nghỉ. Slot và commit mới là nguồn xác nhận khả dụng.
- Màn hình lịch cũ lọc local trong khoảng đã tải, tối đa 2.000 record rồi báo cần thu hẹp, không âm thầm cắt kết quả. Khách/xe và audit của Manager dùng paging server. Cố vấn tải lịch theo vùng ngày đang xem, hồ sơ khách/xe tải lịch sử riêng.
- Outbox được ghi cùng giao dịch; chưa có provider gửi thông báo. Không đánh dấu SENT giả. Cần vận hành dọn session/rate-limit/idempotency hết hạn và theo dõi dung lượng trước production.
- Hai field `customerId,createdAt` được bổ sung vào BookingSummary nội bộ để adapter không cần N request detail chỉ lấy định danh. Metadata catalog nội bộ thêm phiên bản và notice version. Các bổ sung không đổi scope hay state machine.

## Kiểm tra đã chạy

**Phase 6:** TypeScript backend/frontend đạt; 12/12 ca mới (4 định dạng/media/chữ ký, 8 API/DB) đạt qua các lượt chọn lọc. Đã backup/restore kiểm chứng trong PostgreSQL tạm và dọn sau kiểm thử. Chưa migrate DB công ty, import CRM thật, cutover, build hoặc browser. Chi tiết: [Phase 6](../api/phase6-implementation.md#7-xác-minh).

**Phase 5:** TypeScript backend/frontend đạt; 11 ca backend (9 API/DB, 2 ca interval/CSV) và 3 ca frontend đạt qua các lượt chạy chọn lọc, không chạy lại ca đã thành công. PostgreSQL tạm đã dừng/dọn. Chưa migrate DB doanh nghiệp, build, browser, deploy hoặc gửi Zalo. Chi tiết: [Phase 5](../api/phase5-implementation.md#8-xác-minh-và-giới-hạn).

**Phase 4:** TypeScript backend/frontend, 1 ca decimal/giá trị kho, 1 ca adapter và **10/10 ca API/DB** đạt. Chỉ kiểm thử các ca mới/ảnh hưởng, PostgreSQL tạm đã dừng và dọn; không chạy lại các ca thành công. Không build/browser hoặc migrate DB doanh nghiệp. Chi tiết: [Phase 4](../api/phase4-implementation.md#8-xác-minh).

**Phase 3:** TypeScript backend/frontend, 2 ca tiền, 1 ca adapter và **10/10 ca API/DB đạt** qua các lượt kiểm thử có chọn lọc. Sau khi được phép tiếp tục, chỉ chạy lại các ca còn lỗi; không lặp lại ca đã đạt. Database PostgreSQL tạm đã dừng và được dọn. Chi tiết tại [Phase 3](../api/phase3-implementation.md#xác-minh-và-giới-hạn). Các kết quả bên dưới thuộc lượt Phase 1–2, không phải chạy lại toàn bộ trong Phase 3.

- Backend TypeScript: đạt; frontend TypeScript: đạt.
- 4 ca planner: đạt một lần.
- 13 ca API/DB: đã đạt, chỉ chạy lại phần lỗi. Có migration trên DB tạm, create cạnh tranh tài nguyên cuối, replay, confirm/replan/cancel, scope sau transfer, CSRF/cursor, config/blocks, no-show, revoke/last-authority và append-only audit.
- 3 ca adapter/client: đạt, gồm giờ trạm, giữ requested origin, snapshot, giữ nguyên key/payload tạo lịch sau mất mạng và không cache command chứa mật khẩu.
- PostgreSQL kiểm thử chạy bằng user/database tạm trên loopback và được dừng sau kiểm thử. Không dùng database công ty.
- Không chạy full suite, E2E/Playwright, Lighthouse, benchmark hoặc production build. Chưa xác minh trực quan bằng browser/mobile thật hoặc proxy triển khai thực.

Chạy kiểm thử liên quan khi cần, theo Minimal Testing trong AGENTS.md:

```powershell
npm.cmd run typecheck
npm.cmd run test:phase1
# Chỉ chạy lại một ca lỗi:
npm.cmd run test:phase1 -- --test-name-pattern=no-show test/phase1.integration.test.ts
```

`PG_BIN` chỉ thư mục chứa initdb/pg_ctl nếu khác mặc định PostgreSQL 18. Bộ chạy tự tạo database tạm; không nhận URL database công ty.

## Nâng từ Phase 1 lên Phase 2

Giữ nguyên `.env` và cấu hình tài nguyên đã có. Không chạy lại bootstrap hoặc nhập seed:

```powershell
cd backend
npm.cmd run db:migrate
```

Lệnh áp dụng thêm `0002_reception.sql`, không sửa checksum migration cũ. Sau đó khởi động lại backend và frontend theo cách đang dùng. `NEXT_PUBLIC_API_ENABLED` vẫn là feature gate chung; không có flag mới. Migration trên database thật chưa được thực hiện trong nhiệm vụ code này.

Kiểm thử riêng Phase 2 khi được yêu cầu:

```powershell
npm.cmd run test:phase2
# Chỉ chạy lại một ca liên quan:
npm.cmd run test:phase1 -- --test-name-pattern="transfer synchronizes" test/phase2.integration.test.ts
```

Đã đạt 11 ca API/DB Phase 2 trên PostgreSQL tạm và 2 ca adapter/client. Các ca thành công không chạy lặp; ca chuyển cố vấn chạy lại riêng sau khi sửa thời hạn phiên trong fixture. Typecheck backend/frontend đạt. Không chạy production build, browser, E2E hoặc sửa database thật.
