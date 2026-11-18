# Kế hoạch: Dashboard quản trị website `/admin` và hệ thống ảnh

> **Phạm vi:**
> - Trang công khai: trang chủ, dịch vụ, phụ kiện, thành quả, tin tức, giới thiệu, liên hệ, chính sách.
> - Trang quản trị `/admin`.
>
> Không thay đổi UI/UX và logic của `/co-van`, `/dieu-hanh`.
>
> **Đây là file dùng để triển khai.** Mỗi việc có ô `[ ]`, làm xong thì đánh dấu `[x]`. Thứ tự triển khai: **Phần A (ảnh)** trước, rồi đến **Phần B (nội dung và dashboard)**.

---

## 0. Các quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Hạ tầng | Web chạy trên **VPS**. Ảnh lưu trên **Cloudflare R2**. |
| 2 | Link ảnh | **Giai đoạn đầu dùng link `r2.dev`.** Trước khi chạy chính thức, chuyển sang tên miền riêng `img.<tên-miền>`. Để chuyển được, DNS của tên miền phải nằm trên Cloudflare. |
| 3 | Resize | **Resize một lần lúc upload** bằng `sharp` ở backend. Không dùng Cloudflare Images, cũng không dùng `/_next/image` cho ảnh CMS. |
| 4 | Thư viện mới cho backend | `sharp`, `@aws-sdk/client-s3` (đã duyệt), `@fastify/multipart` (đề xuất; xác nhận lại trước khi cài). |
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

**Key trên R2:**
- `media/<assetId>/w<width>.<avif|webp>`
- `media/<assetId>/og.jpg`
- `originals/<assetId>.<jpg|png|webp|avif>`

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
- **Khi `MEDIA_DRIVER=local`:** backend phát file tĩnh tại `/media/*` và `MEDIA_PUBLIC_URL=http://localhost:4002/media`. Chế độ này chỉ dùng cho dev và test.

---

## A1. Nền tảng backend (≈ 1,5 ngày)

- [ ] Cài phụ thuộc cho `backend/`, ghi version chính xác:
  - `sharp`
  - `@aws-sdk/client-s3`
  - `@fastify/multipart` (sau khi xác nhận)
- [ ] `config.ts`:
  - Đọc các biến môi trường ở trên và kiểm tra hợp lệ.
  - `MEDIA_PUBLIC_URL` không có `/` ở cuối.
- [ ] `.env.example`: thêm các biến, để trống giá trị bí mật. Cập nhật `backend/README.md`, phần cấu hình.
- [ ] `backend/src/media-store.ts`, chỉ có 4 hàm:
  - `put(bucket, key, body, contentType)`
  - `remove(bucket, keys[])`
  - `get(bucket, key)`: đọc ảnh gốc khi cần tạo lại biến thể
  - `url(key)`

  Có 2 driver: `r2` (S3 client) và `local` (ghi file). Driver được chọn theo `MEDIA_DRIVER`.
- [ ] `backend/src/image-pipeline.ts`, hàm `processImage(buffer)` trả về:
  - metadata: `width`, `height`, `format`, `bytes`, `sha256`
  - `variants[]`: mỗi biến thể có `{ width, height, format, key, bytes, body }`
  - `og`
  - `placeholder`
  - ảnh gốc đã chuẩn hóa

  Xử lý:
  - Từ chối: HEIC/HEIF, GIF, SVG (rủi ro XSS), file hỏng, ảnh quá 50 MP (`limitInputPixels`). Thông báo lỗi bằng tiếng Việt.
  - Ảnh nhiều khung hình (GIF/WebP động): chỉ lấy khung đầu.
  - Chỉ xử lý tối đa 2 ảnh cùng lúc (semaphore trong tiến trình). Request đến sau thì chờ, không bị lỗi.
- [ ] Fastify multipart:
  - Áp riêng cho route upload, giới hạn 20 MB và đúng 1 file. `bodyLimit` toàn cục vẫn giữ 2 MB.
  - Giữ nguyên guard xác thực, CSRF và rate limit đang dùng cho các route `admin/*`.

**Lưu ý khi deploy VPS:** `sharp` có file chạy riêng cho từng hệ điều hành. Trên VPS phải chạy `npm ci`, **không copy `node_modules` từ Windows sang**.

## A2. Database (≈ 0,5 ngày)

- [ ] Migration `0018_cms_assets_storage.sql`:
  - `content` bỏ `NOT NULL` và bỏ `CHECK` 200 KB. Ảnh cũ vẫn đọc được cho tới khi chuyển xong.
  - Thêm cột:

    | Cột | Kiểu | Ghi chú |
    |---|---|---|
    | `storage` | `text`, `CHECK IN ('db','r2','local')` | Mặc định `'db'` |
    | `width`, `height`, `bytes` | `integer` | |
    | `mime` | `text` | |
    | `original_key` | `text` | |
    | `variants` | `jsonb` | Mặc định `[]` |
    | `og_key` | `text` | |
    | `placeholder` | `text` | |
    | `focal_x`, `focal_y` | `numeric` | Mặc định `0.5`, `CHECK` trong khoảng 0..1 |
    | `deleted_at` | `timestamptz` | |
    | `deleted_by` | `uuid` | |
    | `purged_at` | `timestamptz` | |

  - Ràng buộc và index:
    - `CHECK`: dòng có `storage='db'` thì phải có `content`; dòng `r2`/`local` thì phải có `original_key` và `variants`.
    - Index `(station_id, sha256) WHERE deleted_at IS NULL`, dùng để chống trùng.
    - Index `(station_id, created_at) WHERE deleted_at IS NULL`, dùng cho danh sách ảnh.
- [ ] `schema-check.ts`: cập nhật nếu có kiểm tra cấu trúc bảng `cms_assets`.
- [ ] Migration sau, **chỉ chạy khi script A4 đã chuyển xong và đã kiểm tra:** xóa cột `content`.

## A3. API (≈ 1 ngày)

Dùng lại `Cms`, `audit`, `page`, `fail` và quyền `cms.*`.

| Method & route | Quyền | Mô tả |
|---|---|---|
| `POST admin/cms/assets` (multipart: `file`, `alt`, `name`) | `cms.write` | Xem thứ tự xử lý ngay dưới bảng. Audit `CMS_MEDIA_CREATED`. Trả về asset đầy đủ (id, link các biến thể, placeholder). |
| `GET admin/cms/assets?search=&cursor=` | `cms.read` | Danh sách ảnh chưa xóa, phân trang như hiện tại. Kèm link thumbnail `w320.webp`, kích thước, alt. |
| `GET admin/cms/assets/:id` | `cms.read` | Ảnh `storage='db'`: trả bytes như cũ. Ảnh `r2`/`local`: **302** tới bản WebP lớn nhất. |
| `PATCH admin/cms/assets/:id` (`alt`, `name`, `focalX`, `focalY`) | `cms.write` | Sửa thông tin ảnh. Nếu đổi điểm lấy nét: lấy ảnh gốc, tạo lại `og-<n>.jpg`, xóa bản OG cũ. Audit `CMS_MEDIA_UPDATED`. |
| `GET admin/cms/assets/:id/usage` | `cms.read` | Các tài liệu đang dùng ảnh ở bản mới nhất hoặc bản đã xuất bản. |
| `DELETE admin/cms/assets/:id` | `cms.write` | Ảnh đang được dùng: **409 `CMS_ASSET_IN_USE`**, kèm danh sách nơi dùng. Ngược lại: đặt `deleted_at` (vào thùng rác). Audit `CMS_MEDIA_DELETED`. |
| `POST admin/cms/assets/:id/restore` | `cms.write` | Khôi phục ảnh khỏi thùng rác, chỉ khi chưa xóa hẳn. |
| `GET public/cms/assets/:id` | công khai | Giữ điều kiện "chỉ ảnh đã xuất bản". Ảnh R2: **302** tới bản WebP lớn nhất. Ảnh DB: trả bytes như cũ. Link cũ vẫn chạy. |

**Thứ tự xử lý khi upload:** pipeline → chống trùng → đẩy lên R2 (ảnh gốc và các biến thể) → `INSERT`.
- Nếu `INSERT` lỗi thì xóa các file vừa đẩy (cố gắng hết sức) và ghi log.

**Nội dung tham chiếu ảnh:**
- `upsert` của `cms.ts` hiện kiểm tra `imageId` thuộc đúng trạm. Bổ sung thêm điều kiện **chưa bị xóa**.
- Ảnh nằm trong rich text (Phần B) cũng phải ghi vào `cms_revision_assets`.

**Contracts zod:**
- `alt` tối đa 240 ký tự, `name` tối đa 120 ký tự, `focalX`/`focalY` trong khoảng 0..1.
- Định dạng file kiểm tra bằng `sharp`, không tin `Content-Type` trình duyệt gửi lên.

## A4. Script vận hành (≈ 0,5 ngày)

- [ ] `backend/scripts/media-migrate.ts`: chuyển ảnh cũ trong DB lên R2.
  - Xử lý các dòng `storage='db'`: lấy `content`, chạy pipeline, đẩy lên R2, rồi cập nhật dòng.
  - Chạy lại nhiều lần vẫn an toàn.
  - Có `--dry-run`. In ra số ảnh đã chuyển, bỏ qua, lỗi.
- [ ] `backend/scripts/media-purge.ts`: xóa hẳn ảnh trong thùng rác quá 30 ngày.
  - Xóa các file trên R2, rồi đặt `purged_at`.
  - **Giữ lại dòng trong DB**, vì `cms_revision_assets` là lịch sử không được sửa và còn trỏ tới.
  - Trên VPS, chạy bằng cron mỗi ngày một lần. Hướng dẫn cron ghi vào README.
- [ ] Script kiểm tra kết nối `media-check`: upload một file nhỏ lên R2, đọc lại qua `MEDIA_PUBLIC_URL`, rồi xóa. Dùng để kiểm tra khóa trong `.env` ngay sau A1.

## A5. Tab Hình ảnh trong `/admin` (≈ 1,5 ngày)

Dùng lại tab media sẵn có trong `live-cms.tsx`, cùng `ManagerPanel`, `ManagerModal` và các class `mgr-*`. Không thêm style mới khi đã có class tương ứng.

- [ ] **Upload:**
  - Gửi **file gốc** bằng `FormData`, bỏ bước nén còn 200 KB ở trình duyệt (`prepareIntakePhoto`) cho CMS. Màn `/co-van` vẫn giữ nguyên bước này.
  - Chọn nhiều file và kéo thả được.
  - Có thanh tiến trình cho từng file. Lỗi hiện theo từng file: sai định dạng, quá 20 MB, HEIC.
- [ ] **Lưới ảnh:**
  - Dùng thumbnail `w320.webp`, có ảnh mờ placeholder trong lúc tải.
  - Có tìm kiếm theo tên hoặc alt. Cảnh báo ảnh thiếu alt.
- [ ] **Chi tiết ảnh** (`ManagerModal`):
  - Xem ảnh lớn; sửa alt và tên.
  - Chọn điểm lấy nét bằng cách bấm lên ảnh.
  - Xem kích thước, dung lượng, các biến thể.
  - Xem nơi đang dùng ảnh. Xóa hoặc khôi phục.
- [ ] **Component `MediaPicker`:** hộp thoại chọn ảnh từ thư viện, hoặc upload mới ngay trong hộp thoại. Thay cho ô chọn ảnh hiện tại ở form Nội dung/Bài viết, và dùng lại cho Tiptap, dịch vụ, phụ kiện.
- [ ] **Link ảnh** trong `live-cms.tsx` lấy từ API (`variants`), không tự ghép `/api/v1/admin/cms/assets/<id>`.

## A6. Hiển thị ở trang công khai (≈ 1 ngày)

- [ ] **API công khai:** trả kèm mỗi ảnh: `width`, `height`, `placeholder`, `focal`, danh sách link AVIF/WebP theo độ rộng, link OG.
- [ ] **Component `Photo`** (`src/components/ui/photo.tsx`):
  - Mở rộng để nhận asset CMS, render `<picture>` gồm `<source type="image/avif" srcset>` và `<img srcset sizes width height loading decoding>`.
  - Giữ nguyên class, tỉ lệ và hiệu ứng hiện tại. `object-position` lấy theo điểm lấy nét.
  - Trước khi sửa, kiểm tra tất cả nơi đang dùng `Photo`.
- [ ] **Bảng `sizes` theo vị trí:**

  | Vị trí | `sizes` |
  |---|---|
  | Hero/banner toàn màn hình | `100vw` |
  | Thẻ dịch vụ, phụ kiện, bài viết | `(max-width: 809px) 50vw, 25vw` |
  | Ảnh trong bài viết | `(max-width: 809px) 100vw, 800px` |
  | Logo, ảnh nhỏ | ảnh cố định `w320` |

- [ ] **Thay link ảnh** `/api/v1/public/cms/assets/<id>` ở `hero.tsx`, `our-work-motion.tsx`, `cms-page.tsx`, `lib/cms-content.ts`, `lib/public-cms.ts` bằng dữ liệu asset mới. Route cũ vẫn chuyển hướng được, nên không có chỗ nào bị hỏng trong lúc chuyển.
- [ ] **Ảnh hero đầu trang:** `fetchPriority="high"`, không lazy. Các ảnh còn lại để `loading="lazy"`.
- [ ] **Metadata OG/Twitter:** dùng `og.jpg` của ảnh đại diện.
- [ ] **Ảnh tĩnh `public/images`:**
  - Ảnh nội dung (dịch vụ, bài viết, phụ kiện, thành quả): đưa vào thư viện bằng script seed ở Phần B.
  - Ảnh giao diện (logo, nền, icon): giữ trong `public`, nén một lần bằng script `sharp` về đúng cỡ lớn nhất cần dùng.
  - Bỏ `unoptimized` khi chỗ đó đã chuyển sang `Photo` mới.

## A7. Kiểm thử Phần A

Theo nguyên tắc kiểm thử tối thiểu trong `AGENTS.md`.

- [ ] **Unit test `image-pipeline`:**
  - Đúng các độ rộng; ảnh nhỏ không bị phóng to.
  - Đã xóa EXIF và GPS; ảnh xoay đúng chiều.
  - Từ chối file giả đổi đuôi, HEIC, SVG, ảnh quá 50 MP.
  - Có `og.jpg` 1200×630.
- [ ] **Integration test API** (driver `local`):
  - Upload thành công. Ảnh trùng trả lại id cũ.
  - Không có quyền thì nhận 403.
  - Xóa ảnh đang dùng nhận 409. Xóa rồi khôi phục được.
  - Route công khai không trả ảnh chưa xuất bản. Ảnh R2 trả 302.
  - Ảnh cũ trong DB vẫn đọc được.
- [ ] **Kiểm thử R2 thật:** chạy `media-check` một lần và `media-migrate --dry-run`.
- [ ] **Typecheck** frontend và backend, mỗi bên chạy một lần.
- Không chạy E2E hay build production nếu chưa được duyệt.

## A8. Chuyển sang tên miền riêng (trước khi chạy chính thức)

- [ ] Chuyển DNS của tên miền về Cloudflare, nếu chưa.
- [ ] Ở bucket `dpauto-media`, vào **Settings → Custom Domains**, gắn `img.<tên-miền>`.
- [ ] Đổi `MEDIA_PUBLIC_URL=https://img.<tên-miền>` trong `.env` trên VPS, rồi khởi động lại backend.
- [ ] Tắt `r2.dev` cho bucket.
- Không phải sửa code hay dữ liệu, vì DB chỉ lưu key tương đối.

**Ước lượng Phần A: khoảng 6 ngày làm việc.**

---

# PHẦN B — NỘI DUNG VÀ DASHBOARD

## B1. Mô hình nội dung

Giữ nguyên lõi CMS: document, revision, publish/withdraw, audit. Phần cần làm là mở rộng các loại nội dung (`kind`).

| Loại | Kiểu | Trường chính |
|---|---|---|
| `SETTINGS` | 1 bản | Tên ("DPAuto - Trạm dịch vụ Toàn Trung"), logo, điện thoại, email, địa chỉ, bản đồ, giờ mở cửa, mạng xã hội, ngày nghỉ |
| `NAVIGATION` | 1 bản | Menu header (thứ tự, nhãn, link), các cột footer |
| `PAGE` | Theo khóa | Các khối trang: hero, banner, giới thiệu, CTA, khối trang chủ |
| `SERVICE` | Danh sách | slug, tên, mô tả ngắn, ảnh đại diện, bài giới thiệu (rich text), quy trình, lợi ích, FAQ, thư viện ảnh, giá tham khảo, thứ tự |
| `NEWS` | Danh sách (đã có) | Thêm: rich text, tác giả, lên lịch đăng |
| `ACCESSORY` | Danh sách | Tên, thương hiệu, danh mục, giá, giá khuyến mãi, nhiều ảnh, mô tả, nổi bật trang chủ |
| `ACCESSORY_BRAND` / `ACCESSORY_CATEGORY` | Danh mục | Tên, logo, thứ tự |
| `PROJECT` | Danh sách | Tiêu đề, xe, dịch vụ, mô tả, ảnh trước/sau |
| `PRICING` | 1 bản | Nhóm giá, dòng giá, liên kết dịch vụ |
| `FAQ`, `REVIEW` | Danh sách | Câu hỏi/trả lời; đánh giá |
| `SEO` | Theo đường dẫn (đã có) | Thêm: ảnh OG, canonical; SEO mặc định tự sinh |

**Ràng buộc:**
- Slug là duy nhất. Đổi slug sau khi đã xuất bản thì tự tạo chuyển hướng 301.
- Mỗi lần lưu tạo một revision mới; xem lại và khôi phục được bản cũ.

## B2. Trình soạn thảo Tiptap

**Thư viện:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` và các extension MIT. Cài với version chính xác. **Không dùng Tiptap Pro.**

**Tính năng:**
- Định dạng chữ: tiêu đề H2–H4; đậm, nghiêng, gạch chân, gạch ngang; màu chữ và highlight theo **bảng màu có sẵn của trang** (không cho chọn màu tự do).
- Bố cục: căn lề; danh sách thường, có số, checklist; trích dẫn; đường kẻ ngang.
- Liên kết và ảnh: link (`https:`, `tel:`, `mailto:`, link nội bộ); ảnh chọn từ `MediaPicker`, có alt và chú thích.
- Nhúng: bảng, video YouTube.
- Thao tác: hoàn tác/làm lại; dán từ Word/Google Docs được làm sạch; đếm số chữ.

**Lưu trữ:**
- Lưu **JSON của Tiptap**, không lưu HTML.
- Backend kiểm tra bằng zod: chỉ cho phép đúng các node/mark ở trên, giới hạn kích thước, link an toàn, ảnh phải thuộc đúng trạm và chưa bị xóa.
- Ảnh trong bài được ghi vào `cms_revision_assets`.

**Hiển thị:** trang công khai render JSON bằng component React riêng, dùng style của trang và component `Photo`. **Không dùng `dangerouslySetInnerHTML`.**

**Bài viết cũ:** chuyển `blocks` cũ sang JSON Tiptap khi mở hoặc lưu lại. Renderer vẫn đọc được cả định dạng cũ.

## B3. Dashboard `/admin`

Dùng lại `CmsShell`, `PageHeading`, `mgr-tabs`, `ManagerPanel`, `ManagerTable`, `ManagerModal`. Không tạo hệ thống giao diện mới.

| Mục | Chức năng |
|---|---|
| Tổng quan | Bản nháp, nội dung mới cập nhật, cảnh báo thiếu SEO hoặc alt, bài đã lên lịch |
| Trang | Sửa từng khối của trang chủ, giới thiệu, liên hệ, chính sách |
| Dịch vụ | Thêm, sửa, sắp xếp, ẩn/hiện; bài giới thiệu dịch vụ (Tiptap); quy trình, lợi ích, FAQ, thư viện ảnh |
| Bài viết & tin tức | Lọc theo danh mục và trạng thái; soạn bài (Tiptap); lên lịch; xem trước |
| Phụ kiện | Sản phẩm, giá, giá khuyến mãi, thương hiệu, danh mục, sản phẩm nổi bật |
| Thành quả | Dự án có ảnh trước/sau |
| Bảng giá, FAQ, đánh giá | Danh sách sửa nhanh, kéo thả thứ tự |
| Thư viện ảnh | Phần A5 |
| SEO | Tiêu đề, mô tả, ảnh OG, `noindex`; xem trước kết quả Google |
| Cài đặt website | Thông tin cửa hàng, giờ mở cửa, menu, mạng xã hội |
| Lịch sử | Nhật ký thay đổi; so sánh và khôi phục phiên bản |

**Quy trình:** lưu nháp → xem trước (link có token, có hạn dùng) → xuất bản hoặc gỡ → trang công khai tự làm mới.

## B4. Trang công khai đọc từ CMS và cache

1. **Tách API công khai:** danh sách chỉ trả tóm tắt, chi tiết mới trả nội dung đầy đủ. Đây là việc xử lý ghi chú `shortcut` trong `cms.ts`.
2. **Cache theo tag của Next 16:** bỏ `no-store`. Khi xuất bản, backend gọi một endpoint nội bộ có khóa bí mật để làm mới đúng tag liên quan. **Đọc `node_modules/next/dist/docs` trước khi code**, vì Next 16 đổi API.
3. **Script seed:** đưa `site-content.json`, `home-vi.ts`, `accessories.ts`, `content.ts` và ảnh nội dung trong `public/images` vào CMS qua pipeline ảnh.
   - Chạy lại nhiều lần vẫn an toàn.
   - Thay "HyperAuto Care" bằng tên thật.
4. **Tự sinh:** sitemap, `generateStaticParams`, metadata/OG.
5. **Thứ tự chuyển trang:** Cài đặt/menu → Dịch vụ → Bài viết → Phụ kiện → Thành quả → khối trang chủ.
   - Giao diện từng trang phải giữ nguyên.
   - Kiểm tra bằng ảnh chụp trước/sau, chỉ làm khi bạn duyệt chạy trình duyệt.

## B5. Lộ trình Phần B

| Giai đoạn | Nội dung | Ước lượng |
|---|---|---|
| B-1 | Loại nội dung mới, contracts zod, quyền, slug/301 | 3–4 ngày |
| B-2 | Tiptap: editor, kiểm tra ở backend, renderer, chuyển `blocks` cũ | 3–4 ngày |
| B-3 | Dashboard: các mục ở B3 | 6–10 ngày |
| B-4 | Seed, tách API, cache theo tag, chuyển từng trang | 3–5 ngày |
| B-5 | Lên lịch đăng, cảnh báo SEO/alt, hướng dẫn sử dụng; kiểm tra tổng (khi bạn duyệt) | 2–3 ngày |

**Kiểm thử Phần B:**
- Dữ liệu không hợp lệ bị từ chối; link độc hại bị chặn.
- Node lạ trong JSON Tiptap bị từ chối.
- Revision và khôi phục hoạt động đúng; slug trùng bị chặn; đổi slug tạo 301.
- Quyền đúng cho từng API.

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

1. **Xác nhận cài `@fastify/multipart`**, cần trước khi bắt đầu A1.
2. **Thông tin thật của gara** để nhập vào `SETTINGS`, cần ở Phần B: địa chỉ, số điện thoại, email, giờ mở cửa, link Google Maps, mạng xã hội, logo.
3. **Tên miền** sẽ dùng cho `img.<tên-miền>`, cần ở bước A8.
