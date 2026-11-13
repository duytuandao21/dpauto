# Phase 4 — Kho, thu chi và đối soát bàn giao

Triển khai 13/11/2026, tiếp nối [Phase 3](phase3-implementation.md). Chủ dự án đã chọn **bình quân gia quyền sau mỗi lần nhập**. Giữ feature flag, session, CSRF, idempotency, UI/CoreUI, typography và responsive hiện có; không thêm dependency hoặc biến môi trường.

## 1. Phạm vi đã nối

- `/dieu-hanh/kho`: danh mục phụ tùng/kho; tồn, giữ hàng, giá trị tồn theo quyền; chứng từ nháp/ghi sổ; nhập, xuất, trả, điều chỉnh, kiểm kê; sổ kho và đối soát.
- `/dieu-hanh/tai-chinh`: thu/cọc, phân bổ tiền đã thu, hoàn/đảo, công nợ phiếu, điều chỉnh giảm có căn cứ và tổng hợp theo kỳ. Có phiếu thu/chi riêng tư để in/lưu PDF.
- Phiếu dịch vụ của cố vấn và quản lý thêm tab **Phụ tùng & thu tiền**. Cố vấn xem số đã thu/phải thu và tình trạng phụ tùng của phiếu đang phụ trách. Người có quyền kho đối chiếu mã/DVT, lập yêu cầu, giữ/trả giữ và đi đến chứng từ xuất.
- Bàn giao phiếu có tiền đã được mở khi **thu đủ, phân bổ đúng phiếu, xuất đủ phụ tùng và nghiệm thu hiện tại đạt**. Không có quyền bỏ qua khoản phải thu hoặc xuất âm kho.
- Tiếp nhận lịch tự phân bổ cọc đã thu sang visit trong cùng transaction, không ghi thêm khoản thu. Cọc khách hàng chưa có lịch/lượt phục vụ tạo hồ sơ tiền độc lập, không tạo booking giả.

## 2. Quyền

Mặc định MANAGER đọc được tồn và chứng từ không có giá vốn; ADVISOR chỉ tra catalog cơ bản và thông tin phiếu thuộc scope. Các quyền sau **không tự cấp chỉ vì chức danh quản lý**:

| Grant                 | Quyền                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| `inventory.manage`    | Danh mục, chứng từ nhập/xuất/trả, yêu cầu và giữ hàng                          |
| `inventory.adjust`    | Điều chỉnh tồn và kiểm kê; cần thêm inventory.manage để ghi chứng từ           |
| `inventory.cost.read` | Xem giá vốn/giá trị tồn; cần có khi lập/ghi chứng từ nhập, điều chỉnh, kiểm kê |
| `finance.read`        | Sổ tiền, phiếu thu/chi, công nợ và tổng hợp trong trạm                         |
| `payments.collect`    | Ghi nhận thu/cọc và phân bổ khoản đã thu                                       |
| `payments.refund`     | Hoàn/đảo tiền và điều chỉnh giảm nghĩa vụ có căn cứ                            |

Người có `roles.manage` vào **Nhân sự → Quản lý tài khoản quản lý → Quyền kho và tài chính** để cấp đúng nhiệm vụ. Giữ nguyên các grant hiện có khi lưu; tài khoản bị đổi quyền cần đăng nhập lại. `staff.manage/roles.manage` vẫn là quyền riêng. Không tự cấp grant cho tài khoản đang có khi migrate, không sửa bootstrap hoặc mật khẩu để vượt quyền.

## 3. Kho và giá vốn

- Mã phụ tùng/kho duy nhất trong trạm, không đổi mã hoặc DVT khi sửa tên. Chưa quy đổi đơn vị: DVT trên dòng báo giá phải trùng DVT phụ tùng. Một dòng phụ tùng được gắn một mã và một kho; chưa chia một dòng giữa nhiều kho hoặc có chứng từ chuyển kho.
- `on_hand`, `reserved`, available = on_hand − reserved. Không cho reserved hoặc tồn âm, không ngừng danh mục khi còn tồn/giữ hoặc yêu cầu của phiếu mở.
- Yêu cầu gắn dòng PART đã được khách duyệt. Cho giữ một phần, xuất nhiều đợt và trả giữ độc lập; chưa đủ hàng thì phần còn lại tiếp tục hiện chưa xuất, không sinh tồn âm hoặc tự đánh dấu hoàn tất.
- Chứng từ `DRAFT → POSTED`. Nháp có thể sửa; ghi sổ tạo ledger và cập nhật balances/holds cùng transaction. Chứng từ và dòng đã POSTED, ledger và reservation events không sửa/xóa lịch sử. Điều chỉnh bằng chứng từ mới có lý do, không xóa bút toán cũ.
- Xuất kho dùng hàng giữ cho chính yêu cầu cộng hàng còn tự do; không dùng hàng đang giữ cho phiếu khác. Tổng nhiều dòng cùng yêu cầu trong một chứng từ cũng không vượt lượng khách đã duyệt. Đăng lại chứng từ không xuất lần hai.
- Trả tham chiếu dòng xuất đã ghi sổ, có giới hạn phần còn được trả. RESTOCK tăng tồn; SCRAP ghi nhận phần hỏng, không tăng tồn. Cả hai giảm lượng đã cấp ròng trên phiếu, nên cần cấp bù nếu vẫn phải hoàn thành phạm vi đó. Chưa cho trả phụ tùng sau khi xe đã bàn giao; trường hợp này cần quy trình bảo hành/điều chỉnh phạm vi riêng.
- Kiểm kê lưu số đếm và phiên bản tồn tại lúc chốt mốc. Nếu nhập/xuất/giữ hàng đã làm đổi phiên bản thì từ chối `COUNT_STALE`, phải đối chiếu lại. Không giảm tồn dưới phần đang giữ.
- Quantity là decimal 3 chữ số, giá vốn đơn vị là chuỗi số nguyên VND; tính BigInt, lưu numeric. Khi nhập: tăng giá trị theo quantity × unitCost, làm tròn half-up tới đồng. Khi xuất: phân bổ giá trị tồn hiện tại theo tỷ lệ số lượng; xuất hết lấy toàn bộ giá trị còn lại. Trả kho khôi phục giá trị gốc theo lũy kế số đã trả, tránh cộng sai do làm tròn từng đợt.
- Đối soát so sánh tồn/giá trị tồn với tổng stock_ledger và reserved với lịch sử giữ hàng. Chỉ báo chênh lệch, không tự sửa số. Giá trị vốn bị lược khỏi DTO nếu thiếu quyền xem.
- Tồn đầu kỳ phải nhập bằng chứng từ có căn cứ và giá vốn thực tế; không seed hoặc tự lấy số từ CRM cũ. Đối tác nhập là nội dung chứng từ; chưa dựng sổ nhà cung cấp/công nợ nhà cung cấp.

## 4. Tiền, nghĩa vụ và bàn giao

- Chỉ VND. Khoản thu/cọc là cash entry dương; hoàn/đảo là entry bù mới tham chiếu khoản gốc. Chứng từ có command ID duy nhất bền vững, không chỉ dựa vào thời hạn cache idempotency. Mã giao dịch ngân hàng/thẻ không được ghi thu trùng trong trạm cùng phương thức.
- Phương thức CASH/BANK_TRANSFER/CARD/OTHER được nhân viên có quyền đối chiếu và xác nhận thực tế. Không kết nối ngân hàng/POS hoặc tự xác nhận thanh toán từ báo giá.
- Thu/cọc có đúng một nguồn booking, visit hoặc customer. Thu phiếu phân bổ ngay; cọc booking phân bổ khi receive; cọc khách phân bổ rõ vào phiếu cùng khách. Không chuyển cọc lịch này sang phiếu lịch khác một cách ngầm định.
- Allocation chỉ điều chuyển cách gắn tiền đã thu, không tạo cash entry mới. Refund trừ đúng phần phân bổ hoặc tiền chưa phân bổ; không biến tiền đã hoàn thành tiền khả dụng để phân bổ lại.
- Refund không vượt phần còn được hoàn. REVERSAL đảo toàn bộ phần còn lại của khoản gốc, gồm các allocation và phần chưa phân bổ. Các thao tác được khóa/kiểm tra lại trong transaction; request cạnh tranh không hoàn vượt tiền.
- Nghĩa vụ = tổng các báo giá APPROVED − các điều chỉnh giảm đã ghi. Điều chỉnh giảm cần quyền refund, expectedVersion, số tiền trong giới hạn, lý do và căn cứ/xác nhận khách; giữ nguyên báo giá gốc và lịch sử điều chỉnh. Đây không phải hóa đơn điều chỉnh điện tử và không tự hủy công việc đã duyệt.
- Đã thu ròng của visit = tổng allocations − các reductions tương ứng. Trạng thái UNASSESSED/UNPAID/PARTIAL/SETTLED/CREDIT là projection; CREDIT ở đây là **thu dư**, không phải cho phép giao xe còn nợ.
- Bàn giao cần READY, nghiệm thu hiện hành đạt, nghĩa vụ đã xác định, outstanding=0, phụ tùng được cấp đủ và xác nhận xe đã rời tài nguyên. Snapshot bàn giao giữ số phải thu và đã thu tại thời điểm đó. Booking liên quan chỉ COMPLETED trong thao tác bàn giao, không phải lúc thu tiền.
- Xuất/trả phụ tùng sau khi chờ nghiệm thu/READY làm nghiệm thu cũ mất hiệu lực; cần tiếp tục, hoàn tất và nghiệm thu lại. Hoàn/đảo sau handover không được tạo khoản nợ mới; cần điều chỉnh giảm nghĩa vụ hợp lệ trước nếu có căn cứ.
- Dừng phiếu sau nhận cần nghĩa vụ bằng 0/chưa phát sinh, đã thu ròng bằng 0 và không còn phụ tùng cấp ròng; giữ hàng được trả cùng transaction. Khi đã thu/xuất phải hoàn và trả/đối soát trước, không xóa phiếu để xóa nghĩa vụ.
- Khoản đã thu dư có thể hoàn phần dư mà không đổi trạng thái kỹ thuật hoặc sửa chứng từ bàn giao cũ.

## 5. Tổng hợp và thời gian

- Cash in/out/net theo `occurred_at` do server ghi, kỳ ngày theo `Asia/Ho_Chi_Minh`, tối đa 93 ngày/lần tra. Chưa cho sửa ngày chứng từ hoặc backdate.
- Giá trị báo giá trong kỳ là tổng bản được APPROVED trong kỳ, gồm phát sinh bổ sung; không gọi đó là tiền đã thu.
- Công nợ là outstanding **hiện tại toàn trạm**, sau điều chỉnh giảm và thu/hoàn, không giới hạn theo ngày mở phiếu trong kỳ báo cáo. API trả `asOf` để không nhầm với số dư lịch sử cuối kỳ.
- Chưa phải sổ kế toán tổng hợp, báo cáo lợi nhuận, hóa đơn điện tử, kỳ khóa sổ hoặc báo cáo thuế. Xuất CSV/KPI và các read model mở rộng tiếp tục Phase 5.

## 6. API bổ sung

Prefix `/api/v1`, strict DTO, session/CSRF, permission, station scope, idempotency và audit/outbox dùng lại nền hiện có. Mutation thông thường có expectedVersion của aggregate được sửa. Refund có `expectedRefundable`, allocation có `expectedAvailable` và expectedVersion visit; không tin số dư từ trình duyệt.

| Method             | Path                                        | Nội dung                                                                                    |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET / POST / PATCH | `/admin/stock/parts`, `/:id` khi PATCH      | Catalog mã, tên, DVT / sửa tên và trạng thái                                                |
| GET / POST / PATCH | `/admin/stock/warehouses`, `/:id` khi PATCH | Catalog kho                                                                                 |
| GET                | `/admin/stock/balances`                     | `q,warehouseId,partId,limit,cursor`                                                         |
| GET / POST         | `/admin/stock/documents`                    | Danh sách / tạo nháp với commandId, warehouseId, kind, reason, lines                        |
| GET / PATCH        | `/admin/stock/documents/:id`                | Đọc / sửa nháp với expectedVersion                                                          |
| POST               | `/admin/stock/documents/:id/post`           | Ghi sổ đúng phiên bản                                                                       |
| GET                | `/admin/stock/ledger`                       | Ledger theo kho/phụ tùng, cursor                                                            |
| GET                | `/admin/stock/reconciliation`               | Các chênh lệch tồn và lịch sử, cursor                                                       |
| POST               | `/admin/service-visits/:id/stock-requests`  | Dòng báo giá, mã phụ tùng, kho; version visit                                               |
| POST               | `/admin/stock/requests/:id/reservation`     | RESERVE/RELEASE, quantity, version request                                                  |
| GET / POST         | `/admin/finance/payments`                   | Danh sách / thu-cọc với commandId, nguồn, amount, method, reference, payerName              |
| GET                | `/admin/finance/payments/:id`               | Chứng từ riêng tư, snapshot in, allocations, phần khả dụng/còn hoàn                         |
| POST               | `/admin/finance/payments/:id/allocate`      | Visit, amount, expectedAvailable, expectedVersion và commandId                              |
| POST               | `/admin/finance/payments/:id/refund`        | REFUND/REVERSAL, amount, allocationId tùy chọn, expectedRefundable, method/reference/reason |
| POST               | `/admin/service-visits/:id/credits`         | Điều chỉnh giảm, version visit, amount/evidence/reason/commandId                            |
| GET                | `/admin/finance/accounts`                   | Công nợ visit; q, visitId, outstandingOnly và cursor                                        |
| GET                | `/admin/finance/summary`                    | from/to; cash thực, báo giá duyệt và công nợ hiện tại                                       |

Tổng **24 endpoint mới**, toàn backend **106 endpoint**. Workflow read thêm `settlement`, `stock`, `financialCredits` và paymentStatus thực; API handover nhận NO_CHARGE/SETTLED và server kiểm tra lại basis. API cũ không có endpoint PATCH status tùy ý.

Ví dụ thu cọc khách chưa có lịch:

```json
{
  "commandId": "<UUID mới cho nghiệp vụ, giữ nguyên khi retry>",
  "expectedVersion": 1,
  "customer": { "name": "<Tên khách thực>", "phone": "<SĐT thực>" },
  "kind": "DEPOSIT",
  "amount": "100000",
  "method": "CASH",
  "reference": "<Căn cứ thu thực>",
  "payerName": "<Người nộp>",
  "reason": "<Nội dung thu>"
}
```

Nếu khách đã có, dùng customerId và version hiện hành; không tự gộp theo SĐT. Receipt mutation không chứa PII; bản in phải gọi API có quyền. Không có public link truy cập sổ tiền hoặc kho.

## 7. Schema và áp dụng

Migration mới `0004_stock_finance.sql`, không sửa 0001–0003. Thêm 12 bảng: parts, warehouses, stock_balances, stock_requests, stock_reservation_events, stock_documents, stock_document_lines, stock_ledger, cash_entries, cash_allocations, cash_reductions, obligation_credits. Tổng **63 bảng nghiệp vụ + 1 metadata migration**. Mở rộng grant allowlist và snapshot bàn giao để ghi nhận SETTLED; các phiếu miễn phí cũ vẫn hợp lệ.

Với trạm đang chạy Phase 3: sao lưu theo quy trình vận hành, vào backend rồi chạy:

```powershell
npm.cmd run db:migrate
```

Không bootstrap lại. Không có env/dependency mới. Restart backend và frontend theo quy trình deploy; `npm start` cần bản build mới có giao diện Phase 4. Lệnh build/deploy và migration database công ty không được tự chạy trong nhiệm vụ này.

Sau khi cập nhật, người có roles.manage cấp quyền phù hợp rồi đăng nhập lại tài khoản được cấp. Tạo danh mục kho/phụ tùng và nhập tồn thực bằng chứng từ có căn cứ; không nhập fixtures kiểm thử hoặc dùng dữ liệu giao diện local làm số dư đầu kỳ.

## 8. Xác minh

- TypeScript backend và frontend: đạt. Một kiểm thử tính decimal/bình quân/biên số và một kiểm thử adapter loại bỏ snapshot/giá trị tính từ client: đạt.
- **10/10 ca API/DB Phase 4 đạt** qua 3 lượt chọn lọc (8 + 1 + 1), không chạy lại ca đã đạt. Bao phủ phân quyền/ẩn giá vốn; bình quân và ledger; tranh tồn/xuất trùng/trả/hỏng; giữ một phần và rollback chứng từ nhiều dòng; cọc nhận xe không thu hai lần; tranh hoàn tiền/đảo tiền; bàn giao đã thu đủ và điều chỉnh/hoàn/dừng phiếu; phụ tùng và nghiệm thu lại; cọc khách không lịch và báo cáo công nợ/đối soát; giới hạn tiền và chống trùng mã chuyển khoản.
- PostgreSQL dùng cluster tạm riêng trên loopback, tự dừng và dọn sau kiểm thử; không đọc/đổi cấu hình kết nối doanh nghiệp hoặc chạy migration lên DB thật.
- Các expectation Phase 1/3 bị thay đổi bởi schema và payment gate đã cập nhật; không chạy toàn suite cũ. Không chạy E2E, Playwright, Lighthouse, benchmark hoặc production build. Đã rà tĩnh các component/form/table và responsive hiện có; chưa xác minh UI bằng browser hoặc thiết bị thật.
- Chưa deploy, nhập CRM, đối soát số dư doanh nghiệp, diễn tập backup/restore hoặc cutover. Vận hành thật còn cần dữ liệu đầu kỳ, người được giao quyền và quy trình đối soát; các giới hạn Phase 5–6 nêu trên vẫn giữ.
