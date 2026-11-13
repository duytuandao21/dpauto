# Phase 6 — Nhập lịch sử CRM và chuyển đổi vận hành

## 1. Phạm vi đã triển khai

- Migration `0006_legacy_cutover.sql`: 6 bảng staging, provenance, khóa ghi, checkpoint và biên bản chuyển đổi. Tổng schema: 76 bảng nghiệp vụ + bảng metadata migration.
- CLI quản trị `legacy` và `ops`; không mở endpoint nhập dữ liệu ra Internet. Lệnh tác động database yêu cầu email Manager đang hoạt động, đã đổi mật khẩu và có `roles.manage`; email là định danh kiểm toán của người vận hành có quyền truy cập database, không phải phương thức đăng nhập từ xa.
- Kiểm tra schema, checksum file, mốc chốt, số lượng và các tổng tiền/tồn; dòng sai bị cách ly. Nhập theo transaction, chạy lại cùng file không tạo trùng.
- Ghép khách/xe bằng quyết định có lý do; điện thoại/biển số chỉ gợi ý. Giữ mã nguồn, phiên bản nguồn và bản lịch sử đã nhập bất biến. Không ghi đè hồ sơ mới khi dữ liệu CRM thay đổi.
- Lịch sử và tệp đính kèm trong hồ sơ khách/xe dùng lại panel, phân trang và quyền truy cập hiện tại. Tài chính cần thêm `finance.read`; cố vấn mất quyền khi khách không còn thuộc phạm vi được giao. Media tải qua API riêng tư, không vào `public`.
- Khóa cập nhật nghiệp vụ, checkpoint, backup nhất quán, phục hồi kiểm chứng vào database trống riêng, biên bản mở vận hành và xuất dữ liệu sau checkpoint để xử lý sự cố.
- Readiness kiểm tra đúng danh sách/checksum migration; worker trì hoãn xử lý khi khóa ghi.

**Chủ dự án chưa có file xuất CRM. Chưa nhập dữ liệu thật, chưa chuyển hệ thống đang dùng, chưa chốt ngày chuyển đổi.** Không tự lấy hồ sơ/tiền/tồn từ ảnh, tài liệu khảo sát hay fixtures. Chưa xây OTP, tài khoản khách hàng, waitlist hoặc ứng dụng native.

## 2. Chạy ứng dụng đang có

Database và env đã thiết lập từ các phase trước:

```powershell
# Terminal 1, từ root repository
cd backend
npm.cmd run db:migrate
npm.cmd run dev
```

```powershell
# Terminal 2, từ root repository
npm.cmd run dev
```

Frontend: `http://localhost:4001`; API nội bộ: cổng `4002`. Dùng `/co-van`, `/dieu-hanh`, `/admin` theo role. Root `.env.local` cần `NEXT_PUBLIC_API_ENABLED=true` và `API_INTERNAL_URL=http://127.0.0.1:4002`. Backend dùng `.env` hiện có. Không bootstrap lại database đã có tài khoản. Cài lần đầu theo [backend README](../backend/README.md).

Worker inbox chạy một batch bằng `npm.cmd run notifications:work` trong `backend`; cần scheduler riêng nếu muốn chạy định kỳ. Không tự gửi Zalo.

Các lệnh tiếp theo đều chạy trong `backend`, dành cho thao tác chuyển đổi có kế hoạch; **không cần chạy để xem giao diện Phase 6 khi chưa có dữ liệu nguồn**.

## 3. Hợp đồng file và inventory nguồn

Tạo khung **trống**, không cần kết nối database:

```powershell
New-Item -ItemType Directory -Force .ops
npm.cmd run legacy -- template --out .ops/source.json --station-code TOAN_TRUNG
```

`DPAUTO_LEGACY_V1` là JSON chuẩn hóa, **không phải bộ đọc trực tiếp CSV/Excel hay connector CRM cũ**. Khi có export thật, khảo sát schema rồi viết ánh xạ sang hợp đồng tại `backend/src/legacy-contracts.ts`. `sourceSystem`, `key`, `sourceVersion` phải ổn định từ nguồn, không sinh lại cho mỗi lần xuất.

Envelope: `format`, `stationCode`, `sourceSystem`, `scopeMode`, `exportedAt`, `cutoffAt`, `expected`, `records`. Mỗi record: `{type,key,sourceVersion,data}`. Timestamp cần offset; không được vượt `cutoffAt`; `exportedAt >= cutoffAt`.

| Loại | Nội dung và xử lý |
| --- | --- |
| CUSTOMER | Tên, điện thoại; người vận hành chọn CREATE hoặc LINK tới UUID hiện tại. |
| VEHICLE | Model, biển số, năm; chọn CREATE hoặc LINK, không tự gộp theo biển số. |
| LINK | Khóa nguồn khách/xe, thời gian quan hệ; giữ lịch sử, không tự đổi chủ. |
| HISTORY | Mã phiếu/báo giá cũ, thời gian, trạng thái CLOSED/CANCELLED, mô tả, tổng báo giá/thu/hoàn/còn nợ; đọc tham chiếu, không tạo phiếu hoặc doanh thu mới. |
| STOCK | HISTORY hoặc OPENING; mã chứng từ/kho/vật tư, đơn vị, số lượng/giá trị. Số dư có giá trị phải giữ CRM hoặc đối chiếu chứng từ nhập thật đã có. |
| FINANCE | HISTORY hoặc OPENING; mã, khách, DEBT/DEPOSIT/COLLECT/REFUND. OPENING chỉ DEBT/DEPOSIT. Không tự phát sinh thu/chi từ bản lịch sử. |
| ACTIVE_ORDER | Mã/trạng thái/mô tả phiếu đang làm; KEEP_LEGACY hoặc đối chiếu phiếu mới có cố vấn, tài nguyên hợp lệ. Không dựng phiếu đang làm từ dữ liệu thiếu. |
| MEDIA | Khóa HISTORY, tên, đường dẫn tương đối, SHA256, kích thước, MIME. Tệp phải nằm trong gói nguồn, không chấp nhận đi ra ngoài thư mục. |

Tiền VND là chuỗi số nguyên không âm; số lượng là chuỗi tối đa 3 chữ số thập phân. File tối đa 20 MB / 20.000 dòng; attachment JPEG/PNG/WebP/PDF tối đa 10 MB/tệp, 100 MB/batch. Tệp được lưu riêng tư trong database và tải dạng attachment; không có quét malware.

`expected.counts` phải có đủ 8 loại. `expected.totals`: `quoteTotal`, `received`, `refunded`, `outstanding`, `openingDebt`, `deposits`, `cashCollected`, `cashRefunded`, `stockValue`, `stockQuantities`, `activeOrders`, `mediaBytes`. Tồn nhóm theo khóa `JSON.stringify([warehouseCode,partCode,unit])`, không cộng lẫn đơn vị. Tổng kỳ vọng phải đến từ báo cáo nguồn độc lập; tính lại từ cùng file chỉ kiểm tra nhất quán, không chứng minh export đầy đủ.

Inventory cần xác nhận ngoài công cụ: từng nguồn/bảng, thời gian bao phủ, số lượng và tổng kiểm soát, người chịu trách nhiệm, phần thiếu, lịch chốt/final delta, quyền sở hữu từng phiếu/số dư. `REFERENCE_ONLY` mặc định; chỉ dùng `CUTOVER` khi đã rà đủ nguồn. Công cụ không thể tự chứng minh một CRM chưa cung cấp dữ liệu là đầy đủ.

Thư mục `.ops` được gitignore. File nguồn, bản plan có PII, dump, manifest và restore report phải có ACL/quyền thư mục riêng; không commit hoặc đặt trong thư mục public. Giữ `API_SECRET` an toàn vì dùng xác thực bằng chứng vận hành.

## 4. Kiểm tra, duyệt, nhập

```powershell
npm.cmd run legacy -- inspect --file .ops/source.json --out .ops/inspection.json
npm.cmd run legacy -- stage --operator manager@company.vn --file .ops/source.json
npm.cmd run legacy -- plan --operator manager@company.vn --batch <batch-id> --out .ops/plan.json
```

`inspect` không ghi database; `stage` chỉ ghi staging. Console không in hồ sơ/attachment; file plan chứa dữ liệu chuẩn hóa và gợi ý trùng cần bảo vệ. Mỗi đầu ra dùng tên file mới; công cụ không ghi đè file đã có.

Duyệt từng khách/xe với version batch vừa trả về:

```powershell
npm.cmd run legacy -- review --operator manager@company.vn --batch <batch-id> --record <record-id> --version <version> --decision LINK --target <customer-or-vehicle-id> --reason "Đã đối chiếu hồ sơ nguồn"
```

`CREATE` tạo hồ sơ khi nhập. Nếu có ứng viên trùng mà vẫn cần tạo riêng, thêm `--allow-duplicate` sau khi kiểm tra. Không dùng cờ này hàng loạt. Dữ liệu nguồn cập nhật cần `--ack-source-change`; khách/xe đã ánh xạ phải giữ nguyên đích. Version đích thay đổi sau duyệt làm apply bị từ chối, phải duyệt lại.

OPENING hoặc ACTIVE_ORDER: chọn `KEEP_LEGACY` khi tiếp tục xử lý CRM cũ; hoặc `ARCHIVE --live-type STOCK_LINE|CASH|VISIT --live-id <id>` để chứng minh đã ghi nhận vào nghiệp vụ mới. Proof kiểm tra số tiền/tồn, đơn vị, chủ sở hữu và trạng thái; áp dụng lại khi commit. Không có đường ép bỏ qua proof hoặc tự tạo giao dịch tồn/tiền. Số dư CRM chưa thể biểu diễn bằng chứng từ hợp lệ phải giữ CRM và chặn FULL, không tạo phiếu giả để vượt gate.

Hủy batch sai: `legacy -- abandon ... --version <version> --reason "..."`; giữ bằng chứng, không xóa. Sửa export rồi stage thành batch mới. Plan phải `ready:true`; khóa cập nhật trước apply:

```powershell
npm.cmd run ops -- status --operator manager@company.vn
npm.cmd run ops -- freeze --operator manager@company.vn --version <guard-version> --reason "Nhập CRM đã đối soát"
npm.cmd run legacy -- plan --operator manager@company.vn --batch <batch-id> --out .ops/final-plan.json
npm.cmd run legacy -- apply --operator manager@company.vn --batch <batch-id> --approve <plan-fingerprint>
```

Nên backup trước nhập bằng checkpoint riêng như mục 5. Mỗi lần apply atomic; sai một dòng rollback toàn batch. Lịch sử đã nhập không sửa/xóa trực tiếp. Chạy lại cùng source version/checksum được bỏ qua; thay đổi có ghi nhận phiên bản mới và duyệt lại, không ghi đè hồ sơ vận hành.

## 5. Backup, phục hồi kiểm chứng và mở vận hành

Sau khi khóa và hoàn tất nhập/đối soát:

```powershell
npm.cmd run ops -- checkpoint --operator manager@company.vn --reason "Chốt dữ liệu trước mở vận hành"
npm.cmd run ops -- backup --operator manager@company.vn --checkpoint <checkpoint-id> --out .ops/prelaunch.dump
```

Cần PostgreSQL client tools (`pg_dump`, `pg_restore`) tương thích server; Windows mặc định PostgreSQL 18, đường dẫn khác dùng `PG_BIN`. Dump custom và manifest ký HMAC dùng cùng snapshot PostgreSQL. Không thay secret giữa backup và kiểm chứng.

Người quản trị database tạo trước **database trống riêng** tên `dpauto_restore_<suffix>`; đặt URL trong biến PowerShell của phiên chạy (không ghi đè `DATABASE_URL`):

```powershell
$env:RESTORE_DATABASE_URL = '<URL-database-trong-rieng>'
npm.cmd run ops -- restore --file .ops/prelaunch.dump --out .ops/restore-report.json --confirm-target dpauto_restore_<suffix>
Remove-Item Env:RESTORE_DATABASE_URL
```

Công cụ chặn đích trùng nguồn, sai tên/xác nhận hoặc có relation sẵn. `pg_restore` chạy transaction, sau đó đối chiếu số dòng/checksum **mọi bảng** trước khi cấp restore report ký. Không chạy phục hồi lên database đang dùng. PostgreSQL thực thi nội dung backup nên chỉ dùng dump do hệ thống/trạm kiểm soát.

Hai lựa chọn:

- `NEW_BUSINESS`: cho giao dịch mới hoạt động, các phiếu/công nợ/tồn chưa chuyển vẫn do CRM cũ xử lý. Phù hợp khi chưa có file nguồn. Cần khóa/checkpoint mới nhất, backup phục hồi đạt và xác nhận đào tạo. Không có dữ liệu cũ giả để lấp chỗ trống.
- `FULL`: thêm inventory nguồn CUTOVER không rỗng, mọi batch liên quan đã đối soát/import, không còn ownership LEGACY, công nợ lịch sử được đối chiếu đúng tổng với proof số dư, xác nhận đã đóng ghi CRM nguồn và đào tạo. Vẫn cần người chịu trách nhiệm xác nhận độ đầy đủ export và kiểm tra cấu hình, số dư/chứng từ thực, phiếu đang làm, tài nguyên.

```powershell
npm.cmd run ops -- plan --operator manager@company.vn --checkpoint <checkpoint-id> --mode NEW_BUSINESS
npm.cmd run ops -- activate --operator manager@company.vn --checkpoint <checkpoint-id> --mode NEW_BUSINESS --approve <checkpoint-fingerprint> --restore-report .ops/restore-report.json --training-confirmed --reason "Chỉ mở nghiệp vụ mới; giao dịch cũ tiếp tục CRM"
```

FULL thay mode và thêm `--source-freeze-confirmed` khi đã thực sự khóa hệ thống nguồn. Activate lưu biên bản bất biến và mở khóa ghi. Các lệnh này không triển khai server hay khóa CRM bên ngoài. Muốn chỉ thoát cửa sổ bảo trì mà chưa cutover: `ops -- resume --operator ... --version <guard-version> --reason "..."`; resume không phải xác nhận cutover.

Khóa ghi áp dụng API nghiệp vụ, cấu hình offline chính thức và worker; đăng nhập/đọc/replay thành công vẫn hoạt động. DBA/script SQL bên ngoài không bị công cụ ngăn, nên dừng mọi writer khác trong cửa sổ chuyển đổi. Việc chỉ định CRM/DPAuto là nơi ghi cho một phiếu cần thực thi bằng quy trình/phân quyền ở cả hai hệ thống; registry không tự chặn người dùng ghi trong CRM cũ.

## 6. Rollback và đào tạo

Nếu phát sinh lỗi sau mở hệ thống, khóa ghi, checkpoint/backup hiện tại và xuất phần thay đổi trước khi quyết định:

```powershell
npm.cmd run ops -- delta --operator manager@company.vn --checkpoint <prelaunch-checkpoint-id> --out .ops/postlaunch-delta.json
```

Không có thay đổi nghiệp vụ: `NO_BUSINESS_DELTA`. Có thay đổi: `FORWARD_FIX_REQUIRED`; **không phục hồi đè backup cũ** vì mất lịch/thu/chi/tồn mới. Delta là snapshot hiện tại của những bảng thay đổi, có dấu vết checksum trước/sau, không phải event log hay script tự áp lại; dữ liệu xóa cần điều tra từ backup/audit. Trên 10.000 dòng/bảng hoặc 20 MB thì dừng với `DELTA_REQUIRES_FULL_BACKUP`, không cắt cụt. Công cụ hiện chỉ phục hồi vào database riêng để đối chiếu rồi sửa tiến có kiểm soát; không có nút rollback production.

Đào tạo trước ký: cố vấn nhận/chuyển lịch, tiếp nhận và xem đúng hồ sơ cũ, báo giá/thi công/nghiệm thu; quản lý phân công, chứng từ kho, thu/cọc/phân bổ/hoàn/đối soát, bàn giao đã đủ điều kiện; admin publish nội dung đúng quyền; người vận hành diễn tập freeze/backup/restore và sự cố có giao dịch mới. Ký `--training-confirmed` chỉ khi đã thực hiện. Lượt code này không thay việc đào tạo người dùng hay diễn tập trên dữ liệu doanh nghiệp.

## 7. Xác minh

TypeScript backend/frontend đạt. **12/12 ca Phase 6 đạt** qua các lượt chạy chọn lọc: 4 ca định dạng/media/chữ ký và 8 ca API/DB. Bao gồm chống trùng, quarantine, phê duyệt thay đổi nguồn, rollback khi hồ sơ đích thay đổi, thu hồi quyền sau chuyển cố vấn, đối chiếu tiền/tồn không tạo ledger lần hai, khóa ghi/worker/readiness, backup snapshot và restore kiểm chứng mọi bảng vào database trống riêng, gate chuyển đổi và phát hiện dữ liệu phát sinh sau mở vận hành.

Lượt đầu 11 ca đạt; một request kiểm thử danh sách lịch thiếu bộ lọc ngày trả 400 đúng hợp đồng, đã sửa request và chạy lại riêng ca đó đạt. Không chạy lại các ca thành công. PostgreSQL tạm đã dừng/dọn. UI chỉ kiểm tra tĩnh và kiểu dữ liệu, dùng lại panel/phân trang hiện có; chưa kiểm tra trực quan mobile/tablet/desktop. Không chạy browser/E2E, toàn bộ suite, production build, migrate DB công ty, chuyển dữ liệu CRM thật hoặc triển khai. Chưa diễn tập đào tạo/cutover với nhân viên và dữ liệu công ty; điều này vẫn là gate trước vận hành thật.
