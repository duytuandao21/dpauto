# Triển khai DPAuto lên VPS

Hướng dẫn cho một VPS Ubuntu LTS chạy **Nginx → Next.js :4001 → NestJS/Fastify :4002 → PostgreSQL :5432**. Nginx nhận HTTPS, trình duyệt gọi `/api/v1` trên cùng tên miền, Next chuyển tiếp API công khai và nội bộ ứng dụng. Ảnh/video CMS có thể dùng Cloudflare R2. Các lệnh dưới đây chạy trên Linux, trừ bước kiểm tra bản phát hành trên máy phát triển. Thay `dpauto.example.com`, URL Git và SHA bằng giá trị của hệ thống.

## Điều kiện trước khi mở công khai

- **Chốt một SHA có đủ mã và migration.** Lúc rà soát, hai lockfile có thay đổi và migration `0018`–`0024`, mã CMS/media và route preview còn chưa được Git theo dõi. Kiểm tra `git status --short` và nội dung commit trước khi clone lên VPS. Đưa cả hai lockfile, `public/` và toàn bộ `backend/migrations/` vào bản phát hành. Tạo `.env` trên VPS và cài lại dependency trên Linux để lấy đúng binary của Next/SWC và `sharp`.
- **Xác minh rate limit qua proxy.** Backend đặt `trustProxy: "127.0.0.1"`: chỉ tin `X-Forwarded-For` khi request đến từ Next trên loopback. Nginx phải **ghi đè** header này bằng IP thật của khách (`$remote_addr` sau khi khôi phục IP từ Cloudflare, xem mục 5); không dùng `$proxy_add_x_forwarded_for`, vì khách có thể tự khai IP giả. Hạn mức theo IP: tạo lịch **5/10 phút**, tra cứu xe **10/10 phút**, CSRF **30/10 phút**, đăng nhập **20/15 phút**, đọc catalog/CMS **120/phút**. Request SSR từ Next (loopback, không có header) được miễn hạn mức đọc catalog/CMS; đặt lịch và tra cứu vẫn bị giới hạn. Xác minh trên staging từ hai mạng thật: mỗi mạng có hạn mức riêng. [Mã API](../backend/src/api.ts), [Fastify `trustProxy`](https://fastify.dev/docs/latest/Reference/Server/#trustproxy).
- **Bản demo không cho index.** `src/app/robots.ts` chặn mọi crawler. Khi chạy thật, cho phép `/` và khai báo sitemap.
- **Xác định dữ liệu cần giữ.** Nếu cần lịch hẹn, tài khoản, phiếu dịch vụ, tồn kho, tài chính hoặc CMS từ hệ thống hiện tại, chọn chuyển database và media. Cài mới chỉ tạo schema và cấu hình mặc định. Dữ liệu trình duyệt của chế độ mock và dữ liệu CRM cũ có quy trình riêng. [Runbook chuyển CRM](../api/phase6-implementation.md).
- **Diễn tập nâng schema trên bản phục hồi.** `0020` thêm liên kết và ràng buộc để gộp khách hàng. `0022` xóa revision CMS cũ, giữ bản đã đăng và revision mới nhất của tài liệu chưa xóa. Readiness đòi tên và SHA-256 của **mọi** SQL khớp với `dpauto_migrations`. Working tree Windows đang có file `0006` xuống dòng hỗn hợp và `0012` CRLF, trong khi bản Git là LF. Nếu chúng từng được dùng để migrate, phục hồi thử có thể báo sai checksum. Đối chiếu file từng triển khai với bản DB trước khi chuyển. Giữ nguyên bản SQL đã áp dụng, tránh sửa `dpauto_migrations` chỉ để qua health check. [Kiểm tra schema](../backend/src/schema-check.ts), [Migration CMS](../backend/migrations/0022_cms_single_revision.sql).

## 1. Chuẩn bị máy và bản phát hành

Dùng **Node.js 22 LTS bản vá mới nhất của nhánh 22** để gần với môi trường phát triển hiện tại. Repo backend yêu cầu `>=22` và dùng `--env-file-if-exists`. Chọn **PostgreSQL 18** và client tools cùng major; migration đầu cần `btree_gist`. Cài Node từ nguồn tin cậy, ghi lại đường dẫn tuyệt đối của binary cho systemd. Cài PostgreSQL theo kho chính thức nếu Ubuntu đang dùng chưa có gói 18. [Node.js LTS](https://nodejs.org/en/about/previous-releases), [PostgreSQL trên Ubuntu](https://www.postgresql.org/download/linux/ubuntu/).

```bash
sudo apt update
sudo apt install git nginx curl ca-certificates certbot python3-certbot-nginx
# Sau khi kho gói PostgreSQL 18 đã có trên máy
sudo apt install postgresql-18 postgresql-client-18
sudo systemctl enable --now postgresql
node --version
npm --version
command -v node
pg_dump --version
```

Trỏ DNS `A` về IPv4 VPS. Chỉ tạo `AAAA` nếu IPv6 đã hoạt động. Mở `80/443` và cổng SSH quản trị. Giữ `4001/4002/5432` trên loopback và đóng ở firewall. Với một máy vừa build vừa chạy Next, API và DB, có thể lấy **2 vCPU, 4 GB RAM** làm cấu hình khởi điểm để thử trên staging. Đo lại RAM lúc build và lúc xử lý ảnh/video, cùng dung lượng DB, log và backup, trước khi chốt VPS.

Các ví dụ dùng user Linux `dpauto` không có quyền sudo và deploy key Git chỉ đọc. Chỉ chạy `adduser` khi tài khoản này chưa có. Cấu hình deploy key cho user đó trước khi clone repo riêng.

```bash
sudo adduser --disabled-password --gecos '' dpauto
sudo install -d -o dpauto -g dpauto -m 0750 /srv/dpauto /srv/dpauto/releases
sudo install -d -o root -g dpauto -m 0750 /etc/dpauto
sudo -u dpauto -H bash

release='SHA_RELEASE'
release_dir="/srv/dpauto/releases/$release"
git clone 'URL_REPO_RIENG' "$release_dir"
cd "$release_dir"
git checkout --detach "$release"
git rev-parse HEAD
npm ci --include=dev
npm --prefix backend ci --include=dev
```

## 2. Tạo file môi trường

Tạo hai file ở `/etc/dpauto` với quyền `0640`, owner `root:dpauto`. Dùng `.env.example` và `backend/.env.example` để đối chiếu tên biến. Cấu hình runtime và build phải dùng đúng môi trường đích. [Cách Next.js đọc biến môi trường khi build](https://nextjs.org/docs/app/guides/self-hosting#environment-variables).

```bash
# Chạy trong shell quản trị VPS
sudo touch /etc/dpauto/frontend.env /etc/dpauto/backend.env
sudo chown root:dpauto /etc/dpauto/frontend.env /etc/dpauto/backend.env
sudo chmod 0640 /etc/dpauto/frontend.env /etc/dpauto/backend.env
sudoedit /etc/dpauto/frontend.env /etc/dpauto/backend.env
```

`/etc/dpauto/frontend.env`:

```dotenv
NEXT_PUBLIC_SITE_URL=https://dpauto.example.com
NEXT_PUBLIC_API_ENABLED=true
API_INTERNAL_URL=http://127.0.0.1:4002
```

`/etc/dpauto/backend.env`:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://dpauto_runtime:MAT_KHAU_DA_URL_ENCODE@127.0.0.1:5432/dpauto
API_HOST=127.0.0.1
API_PORT=4002
APP_ORIGIN=https://dpauto.example.com
APP_ALLOWED_ORIGINS=
API_SECRET=SECRET_RIENG_CUA_MOI_TRUONG
STATION_CODE=TOAN_TRUNG
```

- Tạo secret dài bằng `node -e 'console.log(require("node:crypto").randomBytes(48).toString("base64url"))'`. Giữ secret ổn định qua các lần phát hành cùng môi trường. Lưu riêng trong kho bí mật, đặc biệt nếu dùng manifest ký của `ops backup/restore`.
- `APP_ORIGIN` là HTTPS, chính xác đến host và port nếu có, bỏ dấu `/` cuối. Nếu chuyển DB thì `STATION_CODE` phải khớp mã trạm trong DB nguồn. Các biến `NEXT_PUBLIC_*` cần đúng **trước khi build**. Nếu chỉnh sau, build lại frontend. Cookie production là `__Host-dpauto-session` và có `Secure`.
- Với `MEDIA_DRIVER=r2`, khai báo `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_ORIGINALS`, `MEDIA_PUBLIC_URL=https://img.dpauto.example.com`. Chỉ công khai bucket phục vụ website, giữ bucket ảnh gốc riêng tư. Video CMS được lưu thẳng vào bucket công khai. Ảnh hồ sơ/tiếp nhận và media CRM riêng tư đi theo PostgreSQL. Dùng bucket riêng cho staging. [Bucket công khai R2](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- Với `MEDIA_DRIVER=local`, đặt `MEDIA_LOCAL_DIR=/srv/dpauto/media`, cấp quyền ghi cho user dịch vụ và **bỏ hẳn dòng `MEDIA_PUBLIC_URL`**. Giá trị rỗng `MEDIA_PUBLIC_URL=` từ file mẫu làm backend từ chối cấu hình. Driver local hiện phù hợp để thử ảnh. Route local đọc toàn bộ file và chưa khai báo kiểu MIME MP4/WebM hoặc xử lý Range, nên dùng R2 nếu cần phát video CMS ổn định. [Cấu hình media](../backend/src/config.ts), [Route media local](../backend/src/app.ts).

Từ thư mục release, dưới user `dpauto`, nối file môi trường và build backend:

```bash
ln -s /etc/dpauto/frontend.env .env.production.local
ln -s /etc/dpauto/backend.env backend/.env
npm --prefix backend run build
```

## 3. Chuẩn bị database

### Cài mới

Mở `sudo -u postgres psql -X` trên VPS. Ví dụ tách role sở hữu schema để migrate với role chạy ứng dụng. `\password` hỏi mật khẩu tương tác.

```sql
CREATE ROLE dpauto_migrator LOGIN;
\password dpauto_migrator
CREATE ROLE dpauto_runtime LOGIN;
\password dpauto_runtime
CREATE DATABASE dpauto OWNER dpauto_migrator;
\connect dpauto
CREATE EXTENSION IF NOT EXISTS btree_gist;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE dpauto TO dpauto_runtime;
GRANT USAGE ON SCHEMA public TO dpauto_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dpauto_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dpauto_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE dpauto_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dpauto_runtime;
\quit
```

Sau khi `backend/.env` đã nối đúng, chạy bước dưới từ root của release dưới user `dpauto`. Nhập URL của **role migrate**, có password đã URL encode. Biến truyền cho lệnh có ưu tiên cao hơn URL runtime trong file `.env`.

```bash
(
  read -rsp 'DATABASE_URL của role migrate: ' dpauto_migrate_url
  printf '\n'
  test -n "$dpauto_migrate_url" || exit 1
  DATABASE_URL="$dpauto_migrate_url" npm run api:migrate
)
```

Sau migrate, có thể giới hạn quyền trên bảng lịch sử migration bằng `sudo -u postgres psql -X -d dpauto -c 'REVOKE INSERT, UPDATE, DELETE ON dpauto_migrations FROM dpauto_runtime;'`. API vẫn cần `SELECT` để kiểm tra readiness.

Nếu DB thật sự mới, bổ sung tạm `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD` (15–128 ký tự) và `STATION_NAME`, `STATION_PHONE`, `STATION_ADDRESS`, `STATION_DIRECTIONS_URL` (HTTPS) vào file backend. Chạy **một lần**:

```bash
npm run api:bootstrap
```

Xóa dòng `BOOTSTRAP_PASSWORD` ngay sau khi thành công. Đăng nhập bằng tài khoản quản lý và đổi mật khẩu tạm. Cấu hình `/dieu-hanh/cau-hinh`, danh mục và tài khoản cố vấn trước khi mở cửa cho khách. Bootstrap hiện đặt nhận lịch **bật** và hệ thống có sẵn khung 60 phút, 5 lịch/khung, 07:30–17:30. Nếu chưa sẵn sàng, giữ site ở staging hoặc tắt nhận lịch trong giao diện quản lý. Tài liệu cấu hình tài nguyên cũ và `db:configure` dùng cho mô hình trước đây. [Luồng đặt lịch hiện tại](../api/booking-slots-v1.md).

### Chuyển một database đang dùng

1. Kiểm tra DB nguồn, mã trạm, danh sách migration, ảnh/video CMS đang dùng và thư mục/bucket thực tế. Sao lưu DB **và** media ngoài DB. Diễn tập phục hồi vào DB/bucket riêng trước.
2. Lúc chuyển thật, tạm ngừng ghi ở nguồn, chụp dump cuối và đồng bộ media. Phục hồi vào database đích riêng với role sở hữu schema/migration đã chuẩn bị. Giữ `dpauto_migrations` trong dump. Nếu dùng `--no-owner --no-privileges`, áp dụng lại quyền runtime cho các bảng và sequence đã restore, cùng default privileges cho các lần migrate sau.
3. Đối chiếu checksum trước rồi chạy `npm run api:migrate` bằng role migrate để áp dụng phần còn thiếu. Tài khoản và dữ liệu đã có đi cùng DB nên bỏ qua bootstrap. Nếu media đã ở local và muốn qua R2, cần chuyển cả `public/` và `originals/` của kho media theo đúng key. `npm --prefix backend run media -- migrate --dry-run` chỉ xét ảnh CMS cũ còn `storage='db'`. Lệnh `media -- migrate` ghi dữ liệu thật và không chuyển các object đang ở local sang R2.

Ví dụ dump và phục hồi **trên staging hoặc DB phục hồi trống**, điều chỉnh host, role và đường dẫn theo hệ thống. Tạo nơi chứa dump với quyền riêng và lưu bản mã hóa ngoài VPS.

```bash
umask 077
pg_dump -h 127.0.0.1 -U dpauto_migrator -W -Fc -f dpauto-before-release.dump dpauto
sudo -u postgres createdb --owner=dpauto_migrator dpauto_restore_test
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
  -h 127.0.0.1 -U dpauto_migrator -W -d dpauto_restore_test dpauto-before-release.dump
```

Đọc lịch sử migration từ database phục hồi và so với `sha256sum backend/migrations/*.sql` trong release Linux. Các file đã áp dụng phải khớp checksum. File mới chưa có trong DB là phần cần migrate.

```bash
psql -X -h 127.0.0.1 -U dpauto_migrator -W -d dpauto_restore_test \
  -c 'SELECT name, checksum FROM dpauto_migrations ORDER BY name;'
sha256sum backend/migrations/*.sql
```

## 4. Chạy hai dịch vụ bằng systemd

Tạo hai unit dưới `/etc/systemd/system/`. Đổi `/usr/local/bin/node` trong mẫu sang đường dẫn đã kiểm tra. Trên VPS có DB ngoài, chỉnh phụ thuộc `postgresql.service` theo hạ tầng.

`dpauto-api.service`:

```ini
[Unit]
Description=DPAuto API
After=network.target postgresql.service

[Service]
User=dpauto
WorkingDirectory=/srv/dpauto/current/backend
ExecStart=/usr/local/bin/node --env-file=.env dist/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`dpauto-web.service`:

```ini
[Unit]
Description=DPAuto Next.js
After=network.target dpauto-api.service

[Service]
User=dpauto
WorkingDirectory=/srv/dpauto/current
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4001
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Lần cài đầu, tạo symlink `current` từ trong thư mục release, khởi động API và kiểm tra trước khi build web. Một số trang Next đọc CMS trên server, nên build với API và schema tương ứng đang sẵn sàng.

```bash
# Trong shell của user dpauto, ở thư mục release
ln -s "$PWD" /srv/dpauto/current
```

```bash
# Trong shell quản trị VPS
sudo systemctl daemon-reload
sudo systemctl enable --now dpauto-api
curl -fsS --retry 8 --retry-connrefused http://127.0.0.1:4002/api/v1/internal/health/live
curl -fsS http://127.0.0.1:4002/api/v1/internal/health/ready
curl -fsS http://127.0.0.1:4002/api/v1/public/content >/dev/null
sudo -u dpauto -H bash -c 'cd /srv/dpauto/current && npm run build'
sudo systemctl enable --now dpauto-web
curl -fsS --retry 8 --retry-connrefused http://127.0.0.1:4001/ >/dev/null
```

Nếu systemd hoặc `sudo` dùng PATH khác shell cài Node, đặt PATH chính xác hoặc chạy bằng đường dẫn Node/npm tuyệt đối. Giữ devDependencies ở môi trường chạy các lệnh quản trị vì `db:migrate`, `db:bootstrap`, `media` và `ops` cần `tsx`.

## 5. Cloudflare, Nginx và HTTPS

Kiến trúc: **Cloudflare (proxy, cam) → Nginx :443 → Next :4001 → API :4002**.

### 5.1 Cloudflare

- DNS: bản ghi `A` của tên miền trỏ về IP VPS, bật **Proxied**. Nếu dùng cả `www` và tên miền gốc, redirect một bên sang bên còn lại bằng Redirect Rule. Nếu không redirect, thêm bên còn lại vào `APP_ALLOWED_ORIGINS`.
- SSL/TLS: chọn **Full (strict)**, bật *Always Use HTTPS*. Không dùng *Flexible*: cookie `__Host-dpauto-session` cần HTTPS và dễ gặp vòng lặp redirect.
- Origin certificate: vào *SSL/TLS → Origin Server → Create Certificate* cho `dpauto.example.com`, lưu thành `/etc/ssl/dpauto/origin.pem` và `/etc/ssl/dpauto/origin.key` (key quyền `0600`, owner root). Không cần certbot.
- Cache Rules: tạo rule **Bypass cache** cho đường dẫn bắt đầu bằng `/api/`, `/co-van`, `/dieu-hanh`, `/admin`. Không bật *Cache Everything* cho HTML, vì trang public có chế độ preview. `/_next/static/*` được cache mặc định.
- Tắt **Rocket Loader** và **Email Address Obfuscation** (*Scrape Shield*). Hai tính năng này sửa HTML và làm React báo lỗi hydration.
- Giới hạn của Cloudflare (gói Free/Pro): request tối đa **100 MB**, chờ origin tối đa **100 giây** (lỗi 524). Video CMS cho phép tới 100 MiB nhưng qua Cloudflare chỉ nên upload dưới khoảng 90 MB.
- Ảnh R2: gắn custom domain `img.dpauto.example.com` vào bucket public, đặt `MEDIA_PUBLIC_URL` theo domain này.

### 5.2 Firewall: chỉ nhận traffic từ Cloudflare

Nếu để mở, người ngoài có thể gọi thẳng IP VPS và bỏ qua Cloudflare. Chỉ mở 80/443 cho dải IP Cloudflare (danh sách tại <https://www.cloudflare.com/ips/>), giữ cổng SSH quản trị:

```bash
sudo ufw allow OpenSSH
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443
done
sudo ufw enable
```

Dải IP Cloudflare hiếm khi đổi, nhưng nên kiểm tra định kỳ và cập nhật cả firewall lẫn file `real_ip` bên dưới.

### 5.3 Khôi phục IP thật của khách trong Nginx

Tạo `/etc/nginx/conf.d/cloudflare-realip.conf`. Nginx chỉ tin header `CF-Connecting-IP` khi request đến từ dải Cloudflare:

```bash
{
  for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done
  echo "real_ip_header CF-Connecting-IP;"
} | sudo tee /etc/nginx/conf.d/cloudflare-realip.conf
```

Sau bước này `$remote_addr` là IP thật của khách. Server block bên dưới ghi đè `X-Forwarded-For` bằng giá trị đó, Next chuyển tiếp sang API, và API dùng nó cho rate limit.

### 5.4 Server block

Thêm vào `/etc/nginx/sites-available/dpauto`. `log_format` nằm trong ngữ cảnh `http` khi file được include theo cấu hình Ubuntu, dùng `$uri` để access log không ghi query chứa token preview. Nếu dùng bản ghi `AAAA`, thêm listener IPv6 cho HTTP và HTTPS.

```nginx
log_format dpauto '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent $request_time';

server {
    listen 80;
    server_name dpauto.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name dpauto.example.com;
    ssl_certificate     /etc/ssl/dpauto/origin.pem;
    ssl_certificate_key /etc/ssl/dpauto/origin.key;
    access_log /var/log/nginx/dpauto.access.log dpauto;
    client_max_body_size 2m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Ghi đè, không nối thêm: API tin header này để tính rate limit theo IP.
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_buffering off;
    proxy_cache off;

    location ^~ /api/v1/internal/ { return 404; }

    location = /api/v1/admin/cms/assets {
        client_max_body_size 110m;
        proxy_read_timeout 600s;
        proxy_pass http://127.0.0.1:4001;
    }

    location / {
        proxy_pass http://127.0.0.1:4001;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dpauto /etc/nginx/sites-enabled/dpauto
sudo nginx -t
sudo systemctl reload nginx
```

`http2 on;` cần Nginx 1.25.1 trở lên. Với bản cũ hơn, xóa dòng này và dùng `listen 443 ssl http2;`. Nếu dùng bản ghi `AAAA`, thêm `listen [::]:80;` và `listen [::]:443 ssl;`.

Giới hạn app là ảnh 20 MiB và video 100 MiB. Next đã nới proxy lên 110 MiB và timeout 10 phút. Cloudflare vẫn chặn ở 100 MB và 100 giây (mục 5.1). Kiểm tra upload và phát video qua **tên miền cuối cùng**. [Nginx giới hạn body](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size), [Nginx real IP](https://nginx.org/en/docs/http/ngx_http_realip_module.html), [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

## 6. Kiểm tra trước khi bàn giao

```bash
curl -fsS https://dpauto.example.com/ >/dev/null
curl -fsS https://dpauto.example.com/sitemap.xml >/dev/null
curl -fsS https://dpauto.example.com/api/v1/public/content >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' https://dpauto.example.com/api/v1/internal/health/ready
sudo journalctl -u dpauto-api -u dpauto-web -n 100 --no-pager
sudo ss -ltn
```

- Ba request đầu phải thành công và request health qua internet phải trả `404`. Kiểm tra nội dung sitemap dùng đúng domain. API readiness trực tiếp phải trả `ready`. Nếu trả `503`, kiểm tra kết nối DB, sự hiện diện và checksum của thư mục `backend/migrations` trước khi restart nhiều lần.
- Trên staging, thử từ máy tính và điện thoại: đặt lịch → cố vấn nhận lịch → tiếp nhận xe và ảnh → báo giá/in PDF → thi công/hoàn thành. Đăng nhập `/co-van`, `/dieu-hanh`, `/admin` đúng vai trò, kiểm tra tài khoản thiếu quyền bị từ chối. Tạo tài khoản CMS/cấp `cms.read`, `cms.write`, `cms.publish` theo nhu cầu. Kiểm tra quyền kho/tài chính riêng.
- Thử tải ảnh/video CMS, điều chỉnh ảnh đại diện, xem trước rồi xuất bản và mở bằng cửa sổ ẩn danh. Với bucket thử, `npm --prefix backend run media -- check` kiểm tra thử quyền ghi/đọc/xóa và URL public. Nếu có `413`, kiểm tra giới hạn ở từng lớp CDN/Nginx/Next/API. Nếu còn `DYNAMIC_SERVER_USAGE`, đối chiếu route, HTTP status và log cùng thời điểm trong bản production. Một trang chủ tải được chưa chứng minh các trang chi tiết, preview và sitemap đều ổn.
- Rà lại số điện thoại, địa chỉ, giờ mở cửa, dịch vụ, ảnh/logo và chính sách public. Xét thời gian lưu ảnh tiếp nhận, backup và log. Thông báo nội bộ có sẵn, adapter Zalo hiện chưa gửi ra ngoài.

## 7. Cập nhật, sao lưu và quay lui

- Mỗi bản phát hành dùng SHA riêng. Kiểm tra bản mới trên staging với DB phục hồi trước. Chuẩn bị release mới theo mục 1–2. Trong cửa sổ bảo trì production, dừng web và API, chụp backup cuối, chạy migrate từ release mới, chuyển symlink và khởi động theo thứ tự mục 4. Giữ release trước và bản backup trước cập nhật. Kiểm tra `live`, `ready`, URL qua HTTPS và một luồng nghiệp vụ có liên quan.
- Schema check yêu cầu DB khớp **chính xác** với danh sách file của release. Nếu DB đã áp dụng migration mới, chỉ trỏ symlink về mã cũ sẽ làm readiness lỗi. Ưu tiên sửa tiến. Nếu tính đến phục hồi snapshot, xác định giao dịch phát sinh sau snapshot trước để tránh mất lịch, thu tiền hoặc tồn kho. Công cụ `ops` có quy trình freeze/checkpoint/restore kiểm chứng khi chuyển CRM. [Runbook backup/restore và cutover](../api/phase6-implementation.md#5-backup-phục-hồi-kiểm-chứng-và-mở-vận-hành).
- Lập lịch dump PostgreSQL và sao lưu media ngoài DB. Diễn tập phục hồi cả hai và giữ cấu hình/secret phục hồi ở nơi riêng. Theo dõi `429/5xx`, RAM lúc upload, dung lượng, hạn TLS, tuổi bản backup và số dòng session/rate-limit/idempotency. Chỉ đặt lịch `media -- purge` sau khi chốt thời gian lưu giữ, vì lệnh xóa hẳn những tệp quá hạn trong thùng rác. [Lệnh vận hành media](../backend/README.md#ảnh-website-cloudflare-r2).
