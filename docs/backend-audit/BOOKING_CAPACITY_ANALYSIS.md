# Booking và Capacity — phân tích chuyên sâu

Ngày: 11/11/2026. **Đã xác nhận** = năm quy tắc trong yêu cầu audit hiện tại. **Đề xuất** = thiết kế để thực hiện các quy tắc đó. **Cần làm rõ** = thông số vận hành chưa được trạm duyệt. Chưa có thuật toán backend triển khai trong nhiệm vụ này.

## 1. Năm bất biến đã chốt

1. Giới hạn theo **dịch vụ và tài nguyên/năng lực phục vụ**, không dùng tổng số booking đơn thuần.
2. Public đặt thành công tạo `PENDING`, chưa xác nhận giờ với khách.
3. **PENDING giữ năng lực ngay trong transaction tạo booking**. Không đợi nhân viên xác nhận mới trừ chỗ.
4. Không chấp nhận booking vượt năng lực. Không có `force=true` hoặc nút bỏ qua để phá bất biến này.
5. Nhiều request tranh năng lực cuối cùng phải được DB serialize/khóa đúng; UI báo còn chỗ chỉ là tham khảo.

Các quy tắc này thay thế đề xuất cũ ở [REQUIREMENTS:193](../../technical-documentation/REQUIREMENTS.md#L193), [BUSINESS_RULES:87](../../technical-documentation/BUSINESS_RULES.md#L87) (BR-19), [DATABASE_DESIGN:212](../../technical-documentation/DATABASE_DESIGN.md#L212), [API_SPEC:111](../../technical-documentation/API_SPEC.md#L111). Chỉ cập nhật đánh giá trong bộ audit; không sửa tài liệu gốc.

**Giữ chỗ không đồng nghĩa xác nhận:** có reservation nhưng nhân viên vẫn phải liên hệ. Không hứa thời gian hoàn tất dịch vụ chỉ vì giữ được giờ bắt đầu.

## 2. Đối chiếu ba luồng hiện tại

| Nguồn | Có gì | Thiếu gì để dùng thật |
|---|---|---|
| Public | 7 dịch vụ; durationLabel là chuỗi, ngày/giờ giả định; submit bằng timer. [mock:7](../../src/lib/public-booking/mock.ts#L7), [mock:122](../../src/lib/public-booking/mock.ts#L122), [dialog:192](../../src/components/public-booking/booking-dialog.tsx#L192) | Không có dịch vụ định lượng, pool, reservation, DB, idempotency, atomic write hoặc booking ID thật. |
| Cố vấn | carsPerSlot và slotMinutes; cảnh báo overlap cùng xe/cố vấn/số xe rồi cho “Vẫn lưu lịch”. [form:134](../../src/components/admin/booking-form.tsx#L134), [types:49](../../src/lib/booking/types.ts#L49) | Vi phạm hard limit nếu dùng như quy tắc thật; không tính duration nhiều dịch vụ hoặc pool; đổi giờ provider không kiểm tra capacity. [provider:256](../../src/components/admin/booking-provider.tsx#L256) |
| Điều hành | Dịch vụ có duration và group; pending/confirmed/arrived có holds; thay đổi có giải phóng/giữ lại phút, kiểm tra ngày/giờ/nghỉ. [mock:485](../../src/lib/manager/mock.ts#L485), [rules:3](../../src/lib/manager/rules.ts#L3), [rules:71](../../src/lib/manager/rules.ts#L71) | Chỉ cộng duration vào cửa sổ chứa giờ bắt đầu; state cục bộ không chống race giữa thiết bị; group không chứng minh tài nguyên thực độc lập. Không phải bộ lập lịch nhiều khung. |

Việc manager đang giữ pending phù hợp **ý định** yêu cầu mới, chưa chứng minh đáp ứng chống quá tải/concurrency. Không lấy giá trị mẫu 180/240 phút hay ngưỡng80% thành cấu hình chính thức.

## 3. Dữ liệu bắt buộc trước khi khóa thiết kế

| Quyết định | Cần thu thập | Tác động API/DB |
|---|---|---|
| C01 — Ý nghĩa năng lực | Chỉ tiếp nhận, thi công thực tế hay cả hai? Có tách cố vấn nhận xe và khoang thi công không? | Chọn pool và phạm vi lời hứa availability. Không lấy estimated intake làm thời lượng sửa chữa. |
| C02 — Tài nguyên | Danh sách khoang/cầu, KTV có kỹ năng, vị trí rửa/chăm sóc, máy chuyên dụng; tài nguyên dùng chung | resource_pools, units và mapping dịch vụ; không tạo pool riêng cho mỗi service nếu cùng dùng một cầu. |
| C03 — Thời lượng | Thời gian từng bước theo loại dịch vụ/xe, buffer, chuẩn bị/dọn dẹp, khoảng chờ có chiếm tài nguyên không | service_resource_requirements và snapshot; durationLabel “tùy tình trạng” chưa đủ tính chỗ. |
| C04 — Nhiều dịch vụ | Nối tiếp hay song song? Thứ tự, offset, các tài nguyên giữ cùng lúc; có cho ngắt qua trưa/qua ngày? | Footprint và reserved_end_at. Không tự lấy SUM hoặc MAX cho mọi trường hợp. |
| C05 — Độ phân giải | Giờ bắt đầu cho chọn và bucket khóa; ví dụ 15 phút chỉ là ví dụ | Availability slot khác bucket occupancy; rounding lên, không làm tròn giảm tải. |
| C06 — Đặt trước | Giờ mở, nghỉ trưa/lễ, lead time, max advance; cutoff dùng giờ máy chủ trạm | business_hours/blocks/policy. 60 ngày UI không phải chính sách đã duyệt. |
| C07 — Giữ pending | Có thời hạn không? Ai được hết hạn/hủy khi không liên lạc được? | Hiện **không tự expiry**. Nếu thêm TTL phải quyết định chuyển trạng thái và release nguyên tử; cần thông báo rõ. |
| C08 — Xe đến/trễ/vượt thời lượng | Hold gốc kết thúc khi nào? Xe đang làm vượt giờ ảnh hưởng slot sau ra sao? | Không giải phóng toàn bộ vì ARRIVED. Phải tái lập lịch/đóng nhận mới khi tài nguyên thực chưa trống. |
| C09 — Nhân sự/ca | Pool năng lực cứng hay tính theo KTV/ca/kỹ năng? Nghỉ đột xuất xử lý hold ra sao? | staff_shifts có thể là đầu vào capacity, không được trừ hai lần nếu pool đã tính nhân sự. |
| C10 — Ngoại lệ | Walk-in, dịch vụ chưa rõ thời lượng, đổi loại dịch vụ, giảm capacity, dừng khi xe đã đến | Không overbook. Có thể tăng **năng lực thực đã xác minh** rồi đặt; không “override” chỉ bằng reason. |
| C11 — No-show | Ngưỡng chờ và cách nhân viên xác minh thực tế | Không tự no-show từ timer; API kiểm tra giờ máy chủ. |
| C12 — Cấp phát tài nguyên cụ thể | Các đơn vị trong pool có hoàn toàn thay thế được không? Một việc phải giữ cùng một cầu/KTV xuyên suốt? | Nếu không đồng nhất, phải lập interval trên tài nguyên cụ thể, không chỉ resource-minutes tổng. |

C01–C05 và chính sách C07–C10 là **blocker thiết kế DB/API**. Có thể dựng khung ứng dụng trước, chưa được mở đặt lịch thật cho dịch vụ chưa có footprint an toàn được duyệt.

## 4. Mô hình đề xuất

- `services` và `service_resource_requirements`: dịch vụ cần pool nào, bao nhiêu units, duration và offset. Lưu version/hiệu lực.
- `capacity_policies`, `business_hours`, `calendar_blocks`: giờ hợp lệ và giới hạn tài nguyên thực.
- `capacity_buckets`: hàng khóa ổn định theo `pool_id + starts_at`, có capacity_units/held_units/closed.
- `capacity_reservations`: một kế hoạch ACTIVE cho booking, có generation/version.
- `reservation_allocations`: footprint ở **tất cả** bucket bị chiếm; booking_services lưu snapshot.
- `bookings`: trạng thái nghiệp vụ, thời điểm requested/confirmed; không dùng status như bảng counter.

Một booking có nhiều dịch vụ → nhiều requirement → nhiều allocation. Không tách booking public/advisor/manager thành ba bảng.

### Ví dụ minh họa, chưa là thông số vận hành

Hai khoang detailing đồng nhất, bucket15 phút; một dịch vụ chiếm1 khoang từ09:00–10:30. Booking phải giữ1 unit ở **6 bucket liên tiếp**, không chỉ cộng90 phút vào ô09:00.

Nếu còn2 unit tại09:00 nhưng0 unit tại09:45 thì không nhận dịch vụ90 phút bắt đầu09:00. Nếu có2 booking pending cùng footprint, booking thứ ba phải bị chặn ngay.

**Giới hạn toán học:** tổng “180 phút còn lại trong cửa sổ90 phút” không tự chứng minh một việc90 phút có cầu/KTV liên tục. Capacity theo bucket với pool chỉ đủ khi các units đồng nhất và việc chuyển giữa units không làm sai khả thi. Nếu cùng một tài nguyên phải dùng xuyên suốt hoặc có kỹ năng khác nhau, thêm lịch cấp phát theo resource cụ thể và constraint chống overlap; đây là biến thể C12 cần duyệt, **chưa đưa bảng resource-specific vào 50 bảng baseline**.

Khi dùng bucket, bảo thủ giữ cả bucket có phần giao với interval; không giữ fraction làm phát sinh overbooking. Nếu nhiều bước cùng booking dùng một pool đồng thời, cộng nhu cầu theo giao thời gian trước khi kiểm tra.

## 5. Trạng thái và tác động giữ chỗ

| Booking | Reservation | Chuyển tiếp và ràng buộc |
|---|---|---|
| PENDING | ACTIVE ngay khi tạo | Confirm không cộng lần2. Chưa có assigned advisor vẫn giữ chỗ. |
| CONFIRMED | ACTIVE | Nếu confirmedStart khác reservedStart phải chuyển kế hoạch nguyên tử, không chỉ sửa label. |
| ARRIVED | Không tự release | Ghi actualArrival, visit; phân biệt intake pool và execution pool, xử lý hold theo C08 đã duyệt. |
| COMPLETED | Kết thúc allocation theo thời điểm thực/policy | Chỉ sau bàn giao/điều kiện hoàn tất; không mở lại capacity quá khứ như còn đặt được. |
| CANCELLED | RELEASED | Pending/confirmed release đúng một lần; sau arrived phải có flow ngoại lệ riêng được duyệt. |
| NO_SHOW | RELEASED | Confirmed + grace + xác minh nhân viên; không đánh dấu tự động. |

TTL chưa chốt: không phát minh trạng thái EXPIRED booking hoặc tự thu hồi hold sau15 phút. Có thể cảnh báo pending lâu để nhân viên liên hệ. Waitlist khác PENDING: waitlist không giữ tài nguyên, không được dùng làm fallback tạo booking quá tải.

Order stage UI `quote/work/acceptance/done` là trục riêng; `done` trong nghiệm thu đang mô tả chờ bàn giao, không đồng nghĩa `COMPLETED` booking. [acceptance-editor:29](../../src/components/advisor/acceptance-editor.tsx#L29), [booking-actions:22](../../src/components/admin/booking-actions.tsx#L22). Public tiến độ bảy mốc trong [API_SPEC:177](../../technical-documentation/API_SPEC.md#L177) phải có mapping được duyệt; không tự suy từ phần trăm thi công.

## 6. Transaction tạo booking chống tranh suất cuối

**Đề xuất kỹ thuật**, triển khai trong service NestJS, dùng transaction Drizzle/PostgreSQL:

1. Validate DTO, chuẩn hóa phone, timezone, service IDs; kiểm tra rate limit/challenge **trước** khi giữ lock dài. Nguồn/actor do server xác định.
2. BEGIN; giành unique `(scope,key_hash)` cho Idempotency-Key. Cùng key khác fingerprint →409; cùng payload đã hoàn tất → kết quả cũ. Không chỉ kiểm tra key bằng SELECT rồi INSERT không xử lý unique.
3. Chốt catalog/policy version hiện hành. Khóa hàng policy/pool hoặc giao thức publish version tương đương để config không đổi giữa lúc lập footprint và commit.
4. Lập footprint cho mọi resource/bucket; bucket phải được tạo trước hoặc UPSERT unique trước khi khóa. Không có hàng = không nhận đặt, không SELECT rỗng rồi coi là vô hạn.
5. Khóa các capacity_buckets theo thứ tự **pool_id, starts_at** thống nhất ở mọi writer. Kiểm tra interval, blocks, lead/advance, active service và version lại sau lock.
6. Với mỗi bucket: `held_units + demand_units <= capacity_units`, không closed. Không đủ bất kỳ bucket nào → rollback toàn bộ. Không giữ được một dịch vụ rồi vẫn báo thành công.
7. Tạo contact/vehicle record phù hợp, không auto-merge theo phone/plate; booking PENDING; booking_services snapshot; ACTIVE reservation và allocations; tăng held_units; consent; booking event; audit/outbox.
8. Lưu idempotent response tối thiểu, COMMIT.
9. Sau commit mới trả201 và hiển thị thành công. Worker gửi nội bộ sau commit, không giữ lock trong lúc gọi Zalo/OTP.

Giữ key/idempotency row và booking/allocation cùng transaction; nếu rollback do đầy không để booking hoặc giữ chỗ mồ côi. Với response timeout sau commit, client gửi lại cùng key/payload sẽ nhận cùng mã lịch. Key mới không chống được spam → cần cơ chế rate limit/chống abuse riêng.

**Cấu hình và quyền cũng là tài nguyên cạnh tranh:** sửa config, assign/transfer, confirm, cancel phải dùng cùng lock/version protocol. Để transfer đã commit thu hồi quyền ngay, writer phải khóa booking rồi kiểm tra assignment hiện hành, không chỉ scope bằng dữ liệu đã đọc trước lock.

READ COMMITTED + khóa đầy đủ các hàng ổn định có thể đủ nếu mọi writer tuân thủ. SERIALIZABLE là lựa chọn khác nhưng vẫn cần xử lý serialization failure/retry có giới hạn; không thay thế unique/idempotency hoặc bỏ qua phạm vi khóa. Thống nhất thứ tự lock giữa create/reschedule/config; tránh vòng deadlock.

## 7. Các mutation đặc biệt

| Mutation | Transaction cần bảo đảm |
|---|---|
| Confirm cùng giờ | Lock booking, scope, version/status, kiểm tra active hold; update CONFIRMED/event/outbox; counter không đổi. |
| Confirm khác giờ / reschedule | Lock booking + policy + hợp tất cả bucket cũ/mới theo thứ tự ổn định. Tính nhu cầu mới **trừ phần hold chính booking trên cùng bucket**. Chỉ chuyển generation/release cũ khi toàn bộ mới hợp lệ; lỗi giữ nguyên cũ. |
| Thay dịch vụ | Không PATCH serviceIds rồi để hold cũ; replan như reschedule, snapshot/version mới có event. |
| Cancel/no-show | Lock booking+allocations+buckets, verifytransition, release chỉ ACTIVE; đổi trạng thái/event/counter cùngTX. Request lặp không giảm counter lần2. |
| Arrive/reception | Một visit/booking bằng unique. Tạo ARRIVED+visit+RECEIVED mộtTX; form chi tiết có thể cập nhật visit tối thiểu đã tạo, không tạo bản thứ2. |
| Bàn giao | HandedOver/event/completedAt/bookingCOMPLETED nhất quán; chính sách release theo pool được duyệt; không tự suy “đã thu đủ”. |
| Giảm/đóng capacity | Lock cùngbucket; trả impact nếu đụng holds. Baseline từ chối giảm dướiheld, giữ dữ liệu cũ và đóng nhận mới bằng block hợp lệ sau xử lý; không clamp âm hoặc xóa booking để vừa số. |
| Khóa nhân viên/nghỉ | Không xóa booking hay cấp phát mồ côi. Manager chuyển/điều phối; nếu capacity phụ thuộc nhân sự, phải xử lý impact theo cùnggiao thức. |
| Reopen | Tài liệu có đề xuất Manager exception, UI chưa flow riêng; chưa thêm endpoint trong catalog audit vì quyết định D10 chưa chốt; không bật generic statusPATCH. |

## 8. Bảo đảm dữ liệu và lỗi

- CHECK counters không âm/không vượt limit; unique bucket, active reservation, code và idempotency. CHECK một hàng không tự bảo đảm tổng nhiều allocation: transaction và reconciliation vẫn bắt buộc.
- Reservation là bằng chứng phân bổ; counter là projection giao dịch. Job đối soát đọc snapshot nhất quán; phát hiện lệch → cảnh báo/đóng nhận mới an toàn, không tự xóa hold khách.
- Không dùng Redis lock hay browser localStorage làm nguồn quyết định cuối. Cache availability chỉ gợi ý, không cần Redis trong MVP.
- 409 CAPACITY_FULL nếu mất chỗ lúc submit; 409 VERSION_CONFLICT nếu hồ sơ đổi; 422 SLOT_CLOSED/OUTSIDE_BUSINESS_HOURS/UNKNOWN_SERVICE; 429 RATE_LIMITED; 503 khi phụ thuộc không sẵn sàng. Public không trả tên khách hoặc booking đang chiếm chỗ.
- Lỗi ở bất kỳ bước nào trước commit rollback tất cả; không success toast nếu request chưa chắc commit.

## 9. Các kiểm thử cần làm khi triển khai backend, chưa chạy trong audit

1. Hai request **tạo PENDING** tranh unit cuối: đúng1 thành công; counter/allocations nhất quán.
2. Nhiều pool hoặc dịch vụ kéo qua nhiều bucket: một bucket thiếu phải rollback toàn bộ.
3. Cùng idempotency key đồng thời; cùng key khác payload; mất response sau commit.
4. Confirm pending cùnggiờ không nhân đôi; reschedule cùngbucket không tự chặn bởi hold của mình.
5. Reschedule lỗi giữa transaction giữ nguyên toàn bộ hold cũ; cancel lặp không release lần2.
6. Config/holiday/service active thay đổi đồng thời với submit; transfer đồng thời advisor save; no-show/arrive tranh nhau.
7. Staff nghỉ, xe quá giờ, duration qua nghỉ trưa/đóng cửa và timezone client khác +07.
8. Không overbook ở cả public và tạo lịch nội bộ; không còn “Vẫn lưu lịch” bỏ qua hard limit.
9. Service/requirementversion mới không sửa footprint booking cũ; reconciliation phát hiện counter lệch.
10. Với tài nguyên không đồng nhất: chứng minh một resource liên tục đáp ứng toàn bộ khoảng trước khi mở dịch vụ đó.

Đây là kế hoạch kiểm thử cho phase backend được duyệt; không phải đề nghị chạy full suite trong nhiệm vụ báo cáo.

