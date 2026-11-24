# Kế hoạch: Dashboard quản trị website `/admin` và hệ thống ảnh

> **Phạm vi:**
> - Trang công khai: trang chủ, dịch vụ, phụ kiện, thành quả, tin tức, giới thiệu, liên hệ, chính sách.
> - Trang quản trị `/admin`.
>
> Không thay đổi UI/UX và logic của `/co-van`, `/dieu-hanh`.
>
> **Đây là file dùng để triển khai.** Mỗi việc có ô `[ ]`, làm xong thì đánh dấu `[x]`. Thứ tự triển khai: **Phần A (ảnh)** trước, rồi đến **Phần C (thiết kế lại /admin)**. Phần B cũ đã được thay bằng Phần C.

---

## 0. Các quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Hạ tầng | Web chạy trên **VPS**. Ảnh lưu trên **Cloudflare R2**. |
| 2 | Link ảnh | **Giai đoạn đầu dùng link `r2.dev`.** Trước khi chạy chính thức, chuyển sang tên miền riêng `img.<tên-miền>`. Để chuyển được, DNS của tên miền phải nằm trên Cloudflare. |
| 3 | Resize | **Resize một lần lúc upload** bằng `sharp` ở backend. Không dùng Cloudflare Images, cũng không dùng `/_next/image` cho ảnh CMS. |
| 4 | Thư viện mới cho backend | `sharp` 0.35.5, `@aws-sdk/client-s3` 3.1171.0 (đã cài). **Không cần `@fastify/multipart`:** ảnh được gửi nguyên file trong body (`application/octet-stream`), tên và alt đi qua query string. |
| 5 | Ảnh HEIC | Không hỗ trợ. Báo lỗi để người dùng chọn lại ảnh JPEG/PNG. iPhone thường tự chuyển ảnh sang JPEG khi upload qua trình duyệt. |
| 6 | Trình soạn thảo | Đầy đủ tính năng, dùng **Tiptap**, chỉ các extension miễn phí (MIT). Chi tiết ở mục B2. |
| 7 | Duyệt bài | Không tách vai trò: một người vừa viết vừa xuất bản. Vẫn giữ quyền `cms.write`/`cms.publish` sẵn có. |
| 8 | Phụ kiện | Không liên kết với kho `/dieu-hanh/kho`. |
| 9 | Thương hiệu | **DPAuto - Trạm dịch vụ Toàn Trung**. Thay toàn bộ "HyperAuto Care" và địa chỉ Seattle trong dữ liệu mẫu. |
| 10 | Ưu tiên nội dung | Không yêu cầu. Thứ tự dùng theo Phần B. |

---

## 1. Hiện trạng (đã khảo sát)

### 1.1. Đã có sẵn

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| Trang quản trị | `src/app/admin`, `src/components/manager/cms-shell.tsx`, `live-cms.tsx` | Có 4 tab: Nội dung, Bài viết, Hình ảnh, SEO. Dùng giao diện `mgr-*`. |
| Backend CMS | `backend/src/cms.ts`; migration `0005_operations_cms_notifications.sql` | Bảng `cms_documents`, `cms_revisions` (không sửa được), `cms_assets`, `cms_revision_assets` (không sửa được). Có lưu nháp, xuất bản, gỡ, nhật ký `audit`. |
| API ảnh | `backend/src/app.ts:152–180` | `GET/POST admin/cms/assets`, `GET admin/cms/assets/:id`, `GET public/cms/assets/:id`. Route công khai chỉ trả ảnh đang dùng trong nội dung đã xuất bản. |
| Upload hiện tại | `Cms.upload`, kiểm tra bằng `Visits.photoBytes` | Chỉ nhận JPEG gửi dạng data URL base64, tối đa 200 KB. Ảnh lưu thẳng vào cột `content bytea`, có ràng buộc `CHECK` 200 KB. |
| Giới hạn request | `app.ts:1104` | `bodyLimit` toàn cục 2 MB. |
| Frontend đang dùng link ảnh | `live-cms.tsx`, `sections/cms-page.tsx`, `hero.tsx`, `our-work-motion.tsx`, `lib/cms-content.ts`, `lib/public-cms.ts` | Đều dùng dạng `/api/v1/(public\|admin)/cms/assets/<id>`. |
| Phân quyền | `cms.read`, `cms.write`, `cms.publish`, vai trò `CMS_ADMIN` | |

### 1.2. Còn thiếu

- **Nội dung viết cứng trong code:** dịch vụ, thành quả, phụ kiện, bảng giá, FAQ, đánh giá, thông tin cửa hàng, menu.
- **Định dạng bài viết:** chỉ có văn bản thuần.
- **Xử lý ảnh:** không resize, không có WebP/AVIF, ảnh nằm trong DB.
- **Ảnh tĩnh** `public/images`: 89 file, nặng 26 MB. Có 37 chỗ dùng `unoptimized`.
- **Trang công khai không cache.** API danh sách trả cả thân bài viết (có ghi chú `shortcut` trong `cms.ts`).

---

# PHẦN A — HỆ THỐNG ẢNH (R2 + sharp)

## A0. Kiến trúc

```
Admin chọn ảnh (JPEG/PNG/WebP/AVIF, ≤ 20 MB)
  │  multipart/form-data: file + alt + name
  ▼
Backend NestJS/Fastify ── xác thực + cms.write + guard sẵn có
  │
  ├─ image-pipeline (sharp)
  │    1. đọc metadata → kiểm tra định dạng thật, giới hạn 50 MP
  │    2. rotate() theo EXIF → xóa toàn bộ metadata
  │    3. cạnh dài ≤ 2560px
  │    4. biến thể theo độ rộng 320 / 640 / 960 / 1280 / 1920 (không phóng to)
  │       × AVIF + WebP
  │    5. og.jpg 1200×630 (ảnh chia sẻ Facebook/Zalo)
  │    6. ảnh mờ 16px (WebP base64) → lưu vào DB
  │
  ├─ media-store
  │    • R2 bucket công khai   dpauto-media            media/<id>/w640.webp ...
  │    • R2 bucket riêng tư    dpauto-media-originals  originals/<id>.<ext>
  │    (dev/test: ổ đĩa storage/media)
  │
  └─ Postgres cms_assets: metadata + danh sách biến thể (key tương đối, không lưu link đầy đủ)
        ▼
API trả link = MEDIA_PUBLIC_URL + key
        ▼
Trang công khai: <picture> AVIF → WebP với srcset/sizes; trình duyệt tự chọn đúng cỡ
```

### Quy ước

**Key trên R2** (đã triển khai, đặt theo **sha256 của file gốc** thay vì id ảnh):
- `media/<sha256>/w<width>.<avif|webp>`
- `media/<sha256>/og-<x%>-<y%>.jpg`: tên file chứa điểm lấy nét
- `originals/<sha256>/original.<jpg|png|webp|avif>`

Lý do đặt theo sha256: upload lại cùng một ảnh, hoặc request gửi lại do mạng chập chờn, sẽ ghi đè đúng các file giống hệt, không sinh file thừa trên R2.

**Ảnh gốc** được giữ nguyên byte trong bucket riêng tư. Mọi file công khai đều đã xóa EXIF/GPS.

**Header khi upload lên R2:**
- `Content-Type` đúng định dạng.
- `Cache-Control: public, max-age=31536000, immutable`.

**URL không bao giờ bị ghi đè.**
- Thay ảnh thì tạo asset mới, với id mới.
- Đổi điểm lấy nét chỉ tạo lại `og.jpg`, đặt tên kèm số phiên bản (`og-<n>.jpg`), nên cache cũ không bị sai.

**Chất lượng nén:**
- AVIF: `quality 50, effort 4`
- WebP: `quality 75`
- OG JPEG: `quality 80, mozjpeg`

Chỉnh lại sau khi xem kết quả thực tế.

**Ảnh nhỏ hơn 320px:** chỉ tạo một biến thể đúng kích thước gốc.

**Chống trùng:** mỗi trạm, ảnh có cùng sha256 với một ảnh chưa xóa thì trả lại id cũ, không upload lại.

**Ảnh nháp xem được qua link:** bucket là công khai, nên ảnh của bản nháp vẫn mở được nếu biết link.
- **Chấp nhận** vì id là UUID ngẫu nhiên, không đoán được. Admin cũng nhờ vậy xem trước ảnh trực tiếp.
- Route cũ `public/cms/assets/:id` vẫn chỉ chuyển hướng với ảnh đã xuất bản.

### Biến môi trường (`backend/.env`, đã điền)

```env
MEDIA_DRIVER=r2                     # r2 | local
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PUBLIC=dpauto-media
R2_BUCKET_ORIGINALS=dpauto-media-originals
MEDIA_PUBLIC_URL=https://pub-xxxx.r2.dev   # sau này: https://img.<tên-miền>
# chỉ dùng khi MEDIA_DRIVER=local
MEDIA_LOCAL_DIR=storage/media
```

- **Endpoint R2** tự ghép trong code: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`.
- **Khi `MEDIA_DRIVER=r2`:** backend kiểm tra đủ biến lúc khởi động. Thiếu biến nào thì dừng ngay và báo rõ tên biến, không đợi đến lúc upload mới lỗi.
- **Khi `MEDIA_DRIVER=local`:** backend phát file tĩnh tại `/api/v1/public/media/*`, đi qua rewrite sẵn có của Next. Để trống `MEDIA_PUBLIC_URL` thì giá trị mặc định là `/api/v1/public/media`. Chế độ này chỉ dùng cho dev và test.

---

## A1. Nền tảng backend — ✅ đã xong

- [x] Phụ thuộc trong `backend/`: `sharp` 0.35.5 và `@aws-sdk/client-s3` 3.1171.0, ghi version chính xác.
- [x] `config.ts` đọc và kiểm tra các biến `MEDIA_*` và `R2_*`. Khi `MEDIA_DRIVER=r2` mà thiếu biến, backend dừng ngay và báo đúng tên biến thiếu.
- [x] `.env.example` thêm các biến (giá trị bí mật để trống). `backend/README.md` thêm mục "Ảnh website (Cloudflare R2)". `storage/` được thêm vào `.gitignore`.
- [x] `backend/src/media-store.ts`: `put`, `get`, `removePrefix`, `url`. Có 2 driver `local` và `r2`.
  - Key được kiểm tra hợp lệ.
  - Driver `local` chặn đường dẫn thoát ra ngoài thư mục (`..`).
- [x] `backend/src/image-pipeline.ts`: `inspect`, `processImage`, `regenerateOg`.
  - Định dạng đọc từ nội dung file. Chỉ nhận JPEG, PNG, WebP, AVIF.
  - Từ chối HEIC/HEIF, GIF, SVG, file hỏng, ảnh quá 50 MP.
  - Chuẩn hóa ảnh CMYK và 16-bit về sRGB 8-bit.
  - Xử lý tối đa 2 ảnh cùng lúc.
- [x] **Upload gửi file trong body, không dùng multipart:**
  - Parser `application/octet-stream` chỉ nhận ở đúng `POST /api/v1/admin/cms/assets` và giới hạn 20 MB. Route khác vẫn chỉ nhận JSON 2 MB.
  - Giữ nguyên xác thực, CSRF, idempotency và rate limit. Mã sha256 của file được đưa vào dấu vân tay (fingerprint) idempotency.
  - Phần xử lý ảnh và upload lên R2 chạy **trước** transaction, nên không giữ khóa trạm trong lúc xử lý.

**Lưu ý khi deploy VPS:** chạy `npm ci` trên VPS, **không copy `node_modules` từ Windows sang**.

## A2. Database — ✅ đã xong

- [x] `migrations/0018_cms_assets_storage.sql`:
  - Bỏ ràng buộc 200 KB và cho `content` được để trống.
  - Thêm các cột `storage`, `width`, `height`, `mime`, `bytes`, `original_key`, `variants`, `og_key`, `placeholder`, `focal_x`, `focal_y`, `deleted_at`, `deleted_by`, `purged_at`.
  - Thêm ràng buộc `cms_assets_storage_shape` (ảnh `db` phải có bytes; ảnh `r2`/`local` phải đủ metadata) và `cms_assets_purge_after_delete`.
  - Thêm 3 index: tìm theo sha, thư viện ảnh, thùng rác.
- [x] `schema-check.ts` tự nhận migration mới, không phải sửa.
- [ ] **Bạn cần chạy** `npm run db:migrate` trong `backend/` trên DB dev, rồi sau này trên VPS.
- [ ] Migration xóa cột `content`: chỉ làm sau khi `media migrate` đã chuyển hết ảnh cũ và đã kiểm tra.

## A3. API — ✅ đã xong

| Route | Kết quả |
|---|---|
| `POST admin/cms/assets?name=&alt=` (body là file) | Trả 201 `{ id, duplicate }`. Ảnh trùng sha: trả lại id cũ; nếu ảnh đó đang trong thùng rác thì khôi phục. |
| `GET admin/cms/assets?search=&trash=true` | Danh sách: kích thước, `src`, `avif[]`, `webp[]`, `og`, `focal`, `placeholder`. |
| `GET admin/cms/assets/:id` | Ảnh cũ (`db`): trả bytes. Ảnh mới: 302 tới bản WebP lớn nhất. |
| `PATCH admin/cms/assets/:id` | Sửa `name`, `alt`, `focalX`/`focalY` (hai giá trị gửi cùng nhau). Đổi điểm lấy nét thì tạo lại `og-*.jpg`. |
| `GET admin/cms/assets/:id/usage` | Danh sách nội dung đang dùng ảnh (bản mới nhất hoặc bản đang hiển thị), có cờ `live`. |
| `DELETE admin/cms/assets/:id` | Ảnh đang dùng: 409 `CMS_ASSET_IN_USE`, kèm tên các nội dung. Ngược lại: chuyển vào thùng rác. |
| `POST admin/cms/assets/:id/restore` | Khôi phục ảnh. Ảnh đã xóa hẳn: 409 `CMS_ASSET_PURGED`. |
| `GET public/cms/assets/:id` | Giữ điều kiện "chỉ ảnh đã xuất bản". Ảnh mới: 302. |
| `GET public/content` | Mỗi payload có `imageId` được gắn thêm `image` (asset đầy đủ). |

- [x] Lưu nội dung bằng ảnh đã nằm trong thùng rác bị từ chối (`CMS_ASSET_INVALID`).
- [x] Có audit `CMS_MEDIA_CREATED`, `CMS_MEDIA_UPDATED`, `CMS_MEDIA_DELETED`, `CMS_MEDIA_RESTORED`.

## A4. Script vận hành — ✅ đã xong

Gộp thành 1 lệnh `npm run media -- <lệnh>` (`backend/scripts/media.ts`):

- [x] `check`: upload, đọc lại qua `MEDIA_PUBLIC_URL`, rồi xóa file thử. **Đã chạy với R2 thật: OK.**
- [x] `migrate [--dry-run]`: chuyển ảnh cũ trong Postgres sang storage.
  - Chạy lại nhiều lần vẫn an toàn.
  - Từ chối chuyển sang ổ đĩa local khi đang ở production.
- [x] `purge [--days 30]`: xóa file trên R2 của ảnh đã nằm trong thùng rác quá số ngày quy định.
  - Giữ lại file nếu còn ảnh khác dùng chung sha.
  - Đặt `purged_at` và giữ lại dòng trong DB.
  - README có mẫu cron chạy hằng ngày.
- [ ] **Bạn cần chạy** `npm run media -- migrate --dry-run` rồi `npm run media -- migrate` sau khi đã chạy `db:migrate`.

## A5. Tab Hình ảnh trong `/admin` — ✅ đã xong

Component mới `src/components/manager/cms-media.tsx` dùng lại `ManagerPanel`, `ManagerModal` và các class `adm-*`/`mgr-*`. CSS chỉ thêm `.mgr-focal-marker`, dùng token có sẵn `--mgr-brand` và `--adm-surface`.

- [x] **Upload:**
  - Chọn nhiều file hoặc kéo thả. Gửi file gốc, không nén ở trình duyệt.
  - Có thanh tiến trình và lỗi riêng cho từng file. Trình duyệt kiểm tra trước HEIC, kích thước, định dạng.
  - Ô alt dùng chung cho cả lượt upload; để trống thì lấy tên file, sửa được sau.
  - `uploadFile()` trong `src/lib/api/client.ts` dùng XHR để báo được tiến trình.
- [x] **Lưới ảnh:** thumbnail `w320.webp`, tìm theo tên/alt (tìm ở server), nút "Thùng rác".
- [x] **Chi tiết ảnh:**
  - Sửa tên và alt.
  - Chọn điểm lấy nét bằng cách bấm lên ảnh, hoặc bằng 2 thanh trượt (dùng được bằng bàn phím).
  - Xem kích thước, dung lượng, các cỡ đã tạo, nơi đang dùng.
  - Xóa (nút bị khóa khi ảnh đang được dùng) và khôi phục.
- [x] **`MediaPicker`:** thay ô `<select>` chọn ảnh trong form Nội dung/Bài viết. Có hộp thoại chọn ảnh hoặc upload ngay; ảnh vừa upload được chọn luôn.
- [x] **Ảnh xem trước trong editor** lấy `src` từ API.
- [x] Màn `/co-van` vẫn dùng `prepareIntakePhoto` như cũ, không bị thay đổi.

## A6. Hiển thị ở trang công khai — ✅ phần ảnh CMS đã xong

- [x] **`Photo`** (`src/components/ui/photo.tsx`):
  - Ảnh có `media` (asset CMS): render `<picture>` gồm AVIF `srcset` và `<img>` WebP `srcset/sizes`, cùng kiểu định vị (absolute, phủ khung) như `next/image fill`.
  - `object-position` chỉ đổi khi điểm lấy nét khác chính giữa.
  - Ảnh không có `media`: giữ **nguyên** cách render cũ bằng `next/image`.
- [x] **`hero.tsx`, `our-work-motion.tsx`, `cms-page.tsx`, `lib/cms-content.ts`:** truyền `media` và dùng `cmsImageSrc()`.
- [x] **`publicMetadata`:** dùng `og-*.jpg` làm ảnh chia sẻ khi có.
- [x] **Ảnh hero:** `fetchPriority="high"`, không lazy. Ảnh còn lại `loading="lazy"`.
- [x] **Không thêm ảnh mờ placeholder ở trang công khai**, để giữ nguyên hiệu ứng hiện tại. Dữ liệu `placeholder` vẫn có trong API và đang dùng ở admin.
- [ ] **Ảnh tĩnh `public/images` và 37 chỗ `unoptimized`:** làm cùng script seed ở Phần B (B-4), khi từng nhóm nội dung chuyển sang CMS. Lúc đó ảnh nội dung sẽ đi qua pipeline này.

## A7. Kiểm thử Phần A — ✅ đã chạy

- [x] **Unit `test/image-pipeline.test.ts`** (`npm run test:media`), 5/5 pass:
  - đúng các độ rộng; ảnh nhỏ không bị phóng to
  - xoay đúng chiều theo EXIF, đã xóa EXIF/GPS
  - từ chối text, SVG, GIF
  - OG 1200×630; tên file OG chứa điểm lấy nét
- [x] **Integration `test/phase5.integration.test.ts`** (`npm run test:phase5`), chạy trên PostgreSQL tạm, 11/11 pass:
  - Test cũ được cập nhật: upload dạng file, route ảnh trả 302, feed công khai có `image`, SVG nhận 422, gửi JSON vào route upload nhận 415.
  - Test mới cho thư viện ảnh: chống trùng, tài khoản không có quyền nhận 403, tìm kiếm, phát file local có cache `immutable`, chặn `..`, sửa điểm lấy nét tạo OG mới, danh sách nơi dùng, xóa ảnh đang dùng nhận 409, thùng rác, không lưu được nội dung bằng ảnh đã xóa, khôi phục.
- [x] **Typecheck** frontend và backend: pass.
- [x] **`media check` với R2 thật:** pass.
- [ ] **Chưa kiểm tra giao diện trên trình duyệt** (tab Hình ảnh, trang công khai). Không chạy E2E hay build production.

## A8. Chuyển sang tên miền riêng (trước khi chạy chính thức)

- [ ] Chuyển DNS của tên miền về Cloudflare, nếu chưa.
- [ ] Ở bucket `dpauto-media`, vào **Settings → Custom Domains**, gắn `img.<tên-miền>`.
- [ ] Đổi `MEDIA_PUBLIC_URL=https://img.<tên-miền>` trong `.env` trên VPS, rồi khởi động lại backend.
- [ ] Tắt `r2.dev` cho bucket.
- Không phải sửa code hay dữ liệu, vì DB chỉ lưu key tương đối.

**Phần A: đã triển khai trên nhánh `feature/media-r2` (chưa commit).**

---

# PHẦN C — THIẾT KẾ LẠI `/admin` (thay cho Phần B cũ)

> **Tham chiếu giao diện:** https://nexoria-topaz.vercel.app/dashboard-cms (cùng các trang `/projects` và `/settings` của site đó). Bạn đã cho phép tham khảo ngày 18/11/2026.
> **Phạm vi ngoại lệ:** chỉ áp dụng cho `/admin`. Không đổi `/co-van`, `/dieu-hanh`, không đổi giao diện trang công khai.

## C0. Quyết định thiết kế

| Chủ đề | Quyết định |
|---|---|
| Giao diện | Làm theo trang tham chiếu (phong cách shadcn/slate). Logo và tên dùng **DPAuto - Trạm dịch vụ Toàn Trung**; logo giữ màu đỏ thương hiệu, phần còn lại của admin dùng bảng màu slate. |
| Token | Font Inter 14px. Màu chữ `#020817`, chữ phụ `#64748b`, viền `#e2e8f0`, nền ô nhập `#f1f5f9`, nút chính `#0f172a`. Bo góc: nút 6px, thẻ 8px. Viền 0.8px. Padding thẻ 24px. Menu trái rộng 255px, mỗi dòng cao 36px. Header cao 64px. H1 30px/700. Tiêu đề thẻ 18px/600. Số liệu 20px/700. Badge bo tròn hoàn toàn. Có chế độ tối. |
| CSS | Một file riêng `src/styles/cms-admin.css`, mọi rule nằm trong `.cms-app`, nên không ảnh hưởng khu khác. |
| Icon | SVG nét 2px vẽ sẵn trong `src/components/cms/icon.tsx`, cùng phong cách với trang tham chiếu. **Không cài thư viện icon.** |
| Trình soạn thảo | Tiptap (bạn đã duyệt "tùy bạn"), chỉ dùng các extension miễn phí. |
| Mặc định và ghi đè | Dữ liệu hiện có trong code (`site-content.json`, `home-vi.ts`, `accessories.ts`, `content.ts`, chữ trong component) trở thành **nội dung mặc định**. CMS lưu **bản ghi đè** theo từng khóa. Bấm "Khôi phục mặc định" là bỏ bản ghi đè. Vì vậy **không cần script seed**. |
| Ẩn | "Ẩn" là trường `hidden` trong nội dung, tách riêng với "Gỡ". Gỡ một khối trang chủ không còn làm mất khối đó nữa. |
| Lý do xuất bản | Không bắt buộc, mặc định "Xuất bản từ trang quản trị". Vẫn ghi nhật ký. |

## C1. Mô hình nội dung (backend)

Giữ bảng `cms_documents` / `cms_revisions`. Migration 0019 mở rộng `kind`:

| `kind` | `key` | Nội dung (zod, mọi trường đều có giới hạn) |
|---|---|---|
| `SETTINGS` | `site` | tên, khẩu hiệu, điện thoại, email, địa chỉ, link Google Maps, link nhúng bản đồ, giờ mở cửa `[{label, value}]`, mạng xã hội, logo, chữ cuối footer |
| `NAVIGATION` | `main` | `header[{label, href}]`, `footer[{title, links[{label, href}]}]` |
| `PAGE` | `home.*`, `about`, `contact`, `privacy`, `terms`, `services`, `our-work`, `news`, `phu-kien` | **Section** dùng chung: `hidden, eyebrow, title, description, body (rich), image, images[], cta{label, href}, cta2, items[]`. Mỗi `Item` gồm: `title, text, image, href, label, price, note, rating, author, meta, features[]`. Ở frontend, mỗi khóa có cấu hình riêng quy định trường nào được hiện. |
| `SERVICE` | slug | tên, mô tả, ảnh, bài giới thiệu (rich), ảnh giới thiệu[], đoạn mở đầu + các bước quy trình, tiêu đề/mở đầu + danh sách lợi ích, mở đầu FAQ + câu hỏi, thư viện ảnh[], `order`, `hidden` |
| `NEWS` | slug | như hiện tại, thêm `body` (rich), `author`, `publishAt` (lên lịch đăng) |
| `ACCESSORY` | slug | tên, thương hiệu, danh mục, giá, giá khuyến mãi, ảnh[], mô tả, `featured`, `order`, `hidden` |
| `PROJECT` | slug | tiêu đề, xe, thời gian, dịch vụ, mô tả, ảnh trước, ảnh sau, `order`, `hidden` |
| `SEO` | path | như hiện tại, thêm ảnh chia sẻ |

**Quy ước ảnh:** giá trị ảnh là `{ src, alt }`. Riêng ảnh trong thư viện có thêm `assetId`.
- Backend duyệt toàn bộ payload để tìm `assetId`: kiểm tra ảnh thuộc đúng trạm và chưa bị xóa, rồi ghi vào `cms_revision_assets`.
- Feed công khai trả kèm `assets{id: CmsAsset}`.

**Rich text:** lưu JSON của Tiptap.
- Chỉ nhận các node: `paragraph`, `heading` (2–4), `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `image` (assetId hoặc src, alt), `table*`, `youtube`, `hardBreak`.
- Chỉ nhận các mark: `bold`, `italic`, `underline`, `strike`, `link` (chỉ `https:`, `tel:`, `mailto:` hoặc đường dẫn nội bộ), `highlight`.
- Node lạ bị từ chối. Tối đa 200 KB.

## C2. API bổ sung

| Route | Mô tả |
|---|---|
| `GET admin/cms/overview` | Số lượng theo loại và trạng thái; bản nháp chưa xuất bản; bài đã lên lịch; số ảnh và dung lượng; 10 hoạt động gần nhất |
| `GET admin/cms/activity?cursor=` | Nhật ký `CMS_*`, có phân trang, kèm tên người thao tác |
| `GET admin/cms/documents?kind=&search=` | Thêm tìm kiếm và trường `hasDraft` |
| `POST admin/cms/documents/:id/revert` | Bỏ bản ghi đè (`published_revision_id=NULL`, `withdrawn=false`) để trang quay về mặc định |
| `POST …/publish` | `reason` không bắt buộc |
| `POST admin/cms/preview` | Tạo token xem trước có ký HMAC, hạn 30 phút |
| `GET public/cms/preview?token=` | Feed giống `public/content` nhưng dùng revision mới nhất |
| Next `/api/preview?token=&path=` | Bật `draftMode`, lưu token vào cookie, rồi chuyển tới `path`. `publicContent()` đọc feed xem trước khi đang ở draft mode |

## C3. Cấu trúc `/admin`

**Menu trái** chia 4 nhóm:
- **TỔNG QUAN:** Tổng quan
- **NỘI DUNG:** Trang chủ, Dịch vụ, Phụ kiện, Thành quả, Tin tức, Các trang
- **QUẢN LÝ:** Thư viện ảnh, SEO, Cài đặt website
- **HỆ THỐNG:** Lịch sử, Tài khoản

Dưới cùng có Trợ giúp.

**Header:** nút thu gọn menu · breadcrumb · ô tìm kiếm nội dung · đổi sáng/tối · "Xem website" · menu người dùng (tên, vai trò, đăng xuất).

| Route | Màn hình |
|---|---|
| `/admin` | **Tổng quan:** 6 thẻ thống kê (Dịch vụ, Tin tức, Phụ kiện, Thành quả, Ảnh, Bản nháp chờ xuất bản), biểu đồ cập nhật nội dung 12 tháng (lấy từ nhật ký), hoạt động gần đây, bài đã lên lịch, cảnh báo nội dung (thiếu SEO, ảnh thiếu alt, dữ liệu mẫu chưa thay), thao tác nhanh |
| `/admin/trang-chu` | Danh sách khối theo đúng thứ tự trên trang. Mỗi khối có trạng thái Mặc định / Đã tùy chỉnh / Có bản nháp / Đang ẩn, công tắc ẩn/hiện, nút Sửa |
| `/admin/trang-chu/[key]` | Màn biên tập khối |
| `/admin/dich-vu`, `/[slug]`, `/moi` | Bảng dịch vụ (ảnh, tên, trạng thái, thứ tự) → màn biên tập có các tab: Thông tin · Giới thiệu · Quy trình · Lợi ích · FAQ · Thư viện ảnh |
| `/admin/phu-kien`, `/[slug]`, `/moi` | Bảng sản phẩm có lọc thương hiệu/danh mục → màn biên tập |
| `/admin/thanh-qua`, `/[slug]`, `/moi` | Thẻ dự án có ảnh trước/sau → màn biên tập |
| `/admin/tin-tuc`, `/[slug]`, `/moi` | Bảng bài viết, lọc theo trạng thái/chuyên mục → trình soạn Tiptap, lên lịch đăng |
| `/admin/trang`, `/[key]` | Giới thiệu, Liên hệ, Chính sách, Điều khoản, banner các trang danh sách |
| `/admin/thu-vien-anh` | Thư viện ảnh (dùng chức năng Phần A với giao diện mới) |
| `/admin/seo` | Bảng mọi đường dẫn công khai, kèm điểm kiểm tra (độ dài tiêu đề/mô tả, ảnh chia sẻ) và xem trước kết quả Google → hộp thoại sửa |
| `/admin/cai-dat` | Các tab: Thông tin cửa hàng · Giờ mở cửa · Mạng xã hội · Menu header/footer |
| `/admin/lich-su` | Nhật ký hoạt động có phân trang |
| `/admin/tai-khoan` | Tài khoản CMS (tạo tài khoản, xem quyền) |
| `/admin?tab=…` | Chuyển hướng sang route mới, để link cũ vẫn chạy |

**Màn biên tập dùng chung (`DocumentEditor`):**
- Phần đầu: tên + badge trạng thái + các nút: Xem trước · Lưu nháp · Xuất bản. Menu "⋯" chứa Khôi phục mặc định và Gỡ.
- Hai cột:
  - **Trái:** các thẻ form theo nhóm trường, giống trang Settings của mẫu.
  - **Phải:** thẻ Trạng thái (đang hiển thị / có bản nháp, cập nhật lúc nào), thẻ Lịch sử phiên bản (bấm để mở bản cũ), thẻ Ảnh đại diện.
- Rời trang khi còn thay đổi chưa lưu thì có cảnh báo.
- Form tự điền sẵn nội dung mặc định khi chưa có bản ghi đè.

**Thành phần giao diện** (`src/components/cms/`): Shell, Sidebar, Topbar, PageHeader, Card, StatCard, Badge, Button, Field (Input/Textarea/Select/Switch), Tabs, DataTable, EmptyState, Dialog, Toast, Repeater (thêm/xóa/sắp xếp mục), ImageField (chọn từ thư viện), RichText (Tiptap).

## C4. Trang công khai đọc từ CMS

- Tách các chuỗi cố định trong component ra `src/lib/site-defaults.ts`. Component nhận nội dung từ CMS và gộp với mặc định, **không đổi markup, class hay hiệu ứng**.
- Loader gộp: `services`, `articles`, `projects`, `accessories` (mặc định + bản ghi đè + mục mới − mục bị ẩn), sắp theo `order`.
- `SETTINGS` thay `site` trong header, footer, liên hệ, vị trí. `NAVIGATION` thay menu.
- Rich text render bằng `RichText` (React, không dùng `dangerouslySetInnerHTML` cho nội dung CMS).

## C5. Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| C-1 | Backend: các kind mới và schema theo từng kind (`cms-contracts.ts`), quét ảnh trong payload, khôi phục mặc định, tổng quan, nhật ký, xem trước, tìm kiếm, tóm tắt trong API danh sách + migration 0019 + test | ✅ |
| C-2 | Khung giao diện + bộ component + Tổng quan + Thư viện ảnh + Cài đặt (cửa hàng, giờ mở cửa, mạng xã hội, menu) + Lịch sử + Tài khoản + Trợ giúp | ✅ |
| C-3 | `DocumentEditor` + Trang chủ (14 khối, ẩn/hiện nhanh) + Các trang (8 trang) + SEO | ✅ |
| C-4 | Dịch vụ (6 tab), Tin tức (Tiptap, hẹn giờ đăng), Phụ kiện, Thành quả | ✅ |
| C-5 | Trang công khai đọc từ CMS (`SiteContentProvider`, `site-content.ts`, `home-defaults.ts`, `page-defaults.ts`) + chế độ xem trước (`/api/preview`) | ✅ |
| C-6 | Kiểm tra trên Chrome bằng môi trường riêng (PostgreSQL tạm + backend 4005 + dev 4003) | ✅ |

### Ghi chú triển khai

- **Rich text** được lưu dạng JSON của Tiptap. Trang công khai chuyển JSON thành HTML qua `richToHtml`: chỉ nhận các thẻ nằm trong danh sách cho phép và escape mọi giá trị, sau đó dùng lại đường hiển thị sẵn có (`rich-content`). Cách này giữ nguyên CSS hiện tại.
- **Thông tin cửa hàng và menu** chỉ thay nội dung gốc khi đã **xuất bản** Cài đặt (cờ `custom`). Lý do là trước đây Hero và footer ghi giờ mở cửa, địa chỉ khác nhau; nếu thay ngay thì trang đổi nội dung dù bạn chưa bấm gì.
- **Gỡ và Khôi phục:** "Gỡ khỏi website" vẫn ẩn hẳn phần nội dung. "Khôi phục nội dung mặc định" (route `…/revert`) đưa về nội dung gốc mà vẫn giữ lịch sử.
- **Slug** chấp nhận cả dấu ngoặc, vì có một dịch vụ gốc tên `paint-protection-film-(ppf)`.
- **Ảnh:** giảm mức nén AVIF (effort 4 xuống 2) cho nhanh hơn. Mỗi ảnh vẫn mất vài giây để xử lý; giao diện upload báo "Đang xử lý ảnh…" trong lúc chờ.

### Kiểm tra đã làm

- **Typecheck** frontend và backend: pass.
- **Test:**
  - Backend `test:phase5` 12/12, có thêm test cho: các kind mới, link độc hại, node lạ, ảnh lồng, revert, preview, overview, activity, hẹn giờ đăng.
  - `test:media` 5/5.
  - `tests/accessories.test.mts` 2/2.
- **Chrome** (môi trường riêng, không đụng DB thật):
  - Đăng nhập, Tổng quan.
  - Sửa Hero, xuất bản, khôi phục mặc định.
  - Danh sách và trình soạn Dịch vụ.
  - Upload ảnh, chọn ảnh vào bài viết.
  - Viết bài mới có định dạng, xuất bản, xem trên `/news/...`.
  - Cài đặt xuất bản: footer, trang Liên hệ đổi theo.
  - Xem trước bản nháp, thoát xem trước.
  - Bố cục ở bề rộng 375px.
- **So sánh văn bản** `main`, header, footer giữa bản mới và bản cũ (4001) khi chưa sửa gì: 8 trang giống hệt.

### Còn lại / giới hạn

- [ ] **Bạn cần chạy** `npm run db:migrate` trong `backend/` (migration 0018 và 0019), rồi build lại backend và frontend.
- [ ] **Thương hiệu do CMS thêm mới** chưa có ô lọc kèm logo ở trang Phụ kiện (vẫn tìm và lọc theo danh mục được).
- [ ] **Carousel trước/sau ở trang chủ** vẫn dùng 3 dự án gốc cố định (`du-an-5`, `du-an-2`, `du-an-1`); chưa chọn được trong admin.
- [ ] **Danh sách tài khoản CMS** chưa xem được trong `/admin`; vẫn quản lý ở `/dieu-hanh/nhan-su`.
- [ ] **Bố cục khảm 4 ảnh và 2 video** của khối "Hình ảnh xưởng" là cố định; video chưa đổi được qua admin.

---|---|---|
| C-1 | Backend: các kind mới + schema, quét asset trong payload, revert, overview, activity, preview, tìm kiếm + test | [ ] |
| C-2 | Shell + UI kit + Tổng quan + Thư viện ảnh + Cài đặt + Lịch sử + Tài khoản | [ ] |
| C-3 | `DocumentEditor` + Trang chủ + Các trang + SEO | [ ] |
| C-4 | Dịch vụ, Tin tức (Tiptap), Phụ kiện, Thành quả | [ ] |
| C-5 | Trang công khai đọc từ CMS + chế độ xem trước | [ ] |
| C-6 | Kiểm tra trên trình duyệt (Chrome) ở máy tính, máy tính bảng, điện thoại; sửa lỗi | [ ] |

---

## 8. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Lộ khóa R2 | Khóa chỉ nằm trong `backend/.env` (đã có trong `.gitignore`). Token chỉ có quyền Object Read & Write trên 2 bucket. Nếu lộ, thu hồi và tạo token mới trên Cloudflare. |
| `r2.dev` bị giới hạn tốc độ | Chỉ dùng giai đoạn đầu. Làm A8 trước khi chạy chính thức. |
| Upload ảnh lớn làm VPS chậm | Giới hạn 20 MB và 50 MP; xử lý tối đa 2 ảnh cùng lúc; giữ rate limit sẵn có. |
| File trên R2 bị sót khi DB lỗi | Xóa các file vừa đẩy nếu `INSERT` lỗi, và ghi log. Script `media-check` có thể mở rộng để liệt kê file không có trong DB. |
| Xóa nhầm ảnh | Có thùng rác 30 ngày và chặn xóa ảnh đang dùng. Ảnh gốc nằm ở bucket riêng tư. |
| Mất dữ liệu ảnh | R2 có độ bền cao. Metadata nằm trong backup DB sẵn có (`backup.ts`). Có thể đồng bộ bucket ảnh gốc về VPS định kỳ nếu muốn (chưa làm). |
| Nội dung CMS phá giao diện | Rich text dạng JSON có danh sách node cho phép, render bằng component của trang; có bước xem trước. |
| Seed làm sai nội dung | Seed chạy lại được, có đối chiếu số lượng; dữ liệu mẫu vẫn dùng khi chạy dev không có API. |
| Ảnh phụ kiện lấy từ website của hãng có bản quyền | Thay bằng ảnh tự chụp hoặc được hãng cho phép trước khi chạy thật. |

---

## 9. Còn cần bạn cung cấp hoặc xác nhận

1. ~~Xác nhận cài `@fastify/multipart`~~: không cần nữa (xem A1).
2. **Thông tin thật của gara** để nhập vào `SETTINGS`, cần ở Phần B: địa chỉ, số điện thoại, email, giờ mở cửa, link Google Maps, mạng xã hội, logo.
3. **Tên miền** sẽ dùng cho `img.<tên-miền>`, cần ở bước A8.
