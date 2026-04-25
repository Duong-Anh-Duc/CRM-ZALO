# Hướng dẫn Deploy PackFlow CRM lên VPS

## 1. Thông tin VPS hiện tại

| Mục | Giá trị |
|---|---|
| **IP** | `192.168.1.229` |
| **SSH user** | `techla` |
| **Password** | (xem trong password manager, KHÔNG commit) |
| **OS** | Ubuntu 24.04.3 LTS |
| **Postgres** | 16.13 |
| **Node** | `/usr/bin/node` |
| **Yarn / PM2** | cài qua `/usr/bin/{yarn,pm2}` |
| **Repo path** | `/home/techla/packflow-crm` |
| **PM2 process** | `packflow-crm` (backend port 3001) |
| **DB** | `packflow_crm` với user `packflow` |

## 2. Deploy nhanh (flow thông thường)

Sau khi push code lên GitHub (`git push origin main`):

```bash
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  'cd ~/packflow-crm && bash deploy.sh'
```

Script `deploy.sh` sẽ tự động:
1. `git pull --ff-only origin main`
2. `cd server && yarn install --network-timeout 600000`
3. `npx prisma generate` + `npx prisma db push --skip-generate`
4. `yarn build` (tsc)
5. `cd client && yarn install && yarn build`
6. `pm2 restart packflow-crm --update-env`
7. `pm2 save`

Thời gian: ~40-60s cho mỗi lần deploy.

## 2.1 Việc cần làm thủ công sau deploy (chỉ khi commit có thay đổi)

`deploy.sh` CHỈ làm schema sync + build + restart. Nếu commit có thêm **Zalo API mới**, **backfill data**, hoặc **seed ZaloConfig fields mới**, phải chạy thêm các bước dưới.

### 2.1.1 Seed ZaloConfig — URL + Token các API Func.vn mới

Mỗi khi thêm API Zalo mới vào `ZaloConfig` (VD: `GROUP_SEND_MESSAGE`, `GROUP_SEND_IMAGE`, `GROUP_REPLY_MESSAGE`), cần chạy SQL sau với URL+token thực:

```bash
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  "PGPASSWORD='zE3rD1F1mizPtsXwgHTtnt9h' psql -h localhost -U packflow -d packflow_crm" <<'SQL'
UPDATE zalo_configs SET
  group_send_message_url   = 'https://public-api.func.vn/functions/<ID>',
  group_send_message_token = 'eyJhbGci...',
  group_send_image_url     = '...',
  group_send_image_token   = '...',
  group_reply_message_url   = '...',
  group_reply_message_token = '...',
  updated_at = NOW()
WHERE is_active = true;
SQL
```

Hoặc vào UI **Cài đặt → Tích hợp Zalo** điền các trường rồi bấm "Lưu" (cách dễ hơn).

### 2.1.2 Chạy backfill scripts (khi commit có thay đổi business logic)

Hiện có 2 script backfill đồng bộ bảng catalog với transaction data:

```bash
# Backfill supplier_prices từ purchase_order_items
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  'cd ~/packflow-crm/server && yarn tsx scripts/backfill-supplier-prices.ts'

# Backfill customer_product_prices từ sales_order_items
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  'cd ~/packflow-crm/server && yarn tsx scripts/backfill-customer-prices.ts'
```

**Khi nào cần chạy**: chỉ lần ĐẦU sau commit thêm auto-upsert, hoặc khi phát hiện data drift. Các PO/SO TẠO MỚI sau đó sẽ tự sync (không cần chạy lại).

### 2.1.3 Embed products cho semantic search (khi thêm nhiều SP mới)

```bash
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  'cd ~/packflow-crm/server && yarn tsx scripts/embed-products.ts'
```

Script này chỉ re-embed những SP có hash thay đổi, nên an toàn chạy bất cứ lúc nào.

### 2.1.4 Checklist sau deploy

- [ ] `pm2 list` thấy `packflow-crm` **online**
- [ ] `pm2 logs packflow-crm --lines 30 --nostream` không có `[error]`
- [ ] Mở https://`<domain>`/ đăng nhập được
- [ ] Nếu thay đổi ZaloConfig → test gửi 1 tin nhắn qua UI Zalo hoặc Aura
- [ ] Nếu backfill → vào trang chi tiết 1 supplier/customer xem số sản phẩm có khớp đơn không

### 2.1.5 Khi nào cần mirror full DB (Option B)?

Mặc định sau deploy, prod giữ nguyên data của nó + áp schema/logic mới. Chỉ làm full mirror khi:
- Dev trên local sinh ra data mẫu mà prod cần có (VD seed mới, refactor data)
- Muốn reset prod về state sạch của local
- Data prod đã drift nghiêm trọng, không muốn backfill từng chỗ

Làm theo **5.8** — đã cover backup → dump → wipe → restore → verify → rollback.

## 3. Setup lần đầu / khi đổi VPS

### 3.1 Clone repo + .env

```bash
ssh techla@192.168.1.229
cd ~
git clone https://github.com/<user>/packflow-crm.git
cd packflow-crm/server
cp .env.example .env
# Sửa DATABASE_URL, JWT_SECRET, CLOUDINARY_*, OPENAI_*, GEMINI_*, ZALO_* ...
```

### 3.2 Install dependencies

```bash
# Yarn + PM2 (nếu chưa có)
sudo apt-get install -y nodejs yarn
sudo npm install -g pm2

# Postgres 16
sudo apt-get install -y postgresql postgresql-16

# pgvector extension (bắt buộc cho AI product search)
sudo apt-get install -y postgresql-16-pgvector

# Redis (nếu dùng cache)
sudo apt-get install -y redis-server
```

### 3.3 Tạo DB + user

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE packflow_crm;
CREATE USER packflow WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE packflow_crm TO packflow;
\c packflow_crm
GRANT ALL ON SCHEMA public TO packflow;
CREATE EXTENSION IF NOT EXISTS vector;
EOF
```

### 3.4 Deploy + seed lần đầu

```bash
cd ~/packflow-crm
bash deploy.sh

cd server
npx tsx src/prisma/seed.ts            # seed dữ liệu mẫu (RBAC + users + products)
npx tsx scripts/embed-products.ts     # embed vector cho semantic search
```

### 3.5 PM2 config (lần đầu)

```bash
cd ~/packflow-crm/server
pm2 start dist/index.js --name packflow-crm
pm2 save
pm2 startup  # làm theo hướng dẫn để PM2 auto-start khi reboot
```

## 4. Biến môi trường cần thiết

File `server/.env`:

```bash
# Database
DATABASE_URL="postgresql://packflow:PASSWORD@localhost:5432/packflow_crm"

# JWT
JWT_SECRET="random-32-chars"
JWT_EXPIRES_IN="7d"

# Redis (cache)
REDIS_URL="redis://localhost:6379"

# OpenAI / LLM gateway
OPENAI_API_KEY="..."
OPENAI_BASE_URL="https://llm.openclaw-box.io.vn/v1"
OPENAI_MODEL="techla"                # text chat model
OPENAI_VISION_MODEL="cx/gpt-5.4"     # vision model (ảnh)

# Gemini embedding (Phase 4 — semantic product search)
GEMINI_API_KEY="AIza..."             # lấy tại https://aistudio.google.com/apikey
EMBEDDING_MODEL="gemini-embedding-001"

# Cloudinary (upload ảnh)
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Zalo Func API
ZALO_FUNC_GET_THREADS_URL="..."
ZALO_FUNC_GET_THREADS_TOKEN="..."
# ... (các URL+token khác)
```

**Lưu ý:** `.env` được gitignore — mỗi khi thêm env var mới **phải SSH vào server sửa trực tiếp**, không sync qua git.

## 5. Tác vụ phổ biến

### 5.1 Thêm env var mới

```bash
ssh techla@192.168.1.229
cd ~/packflow-crm/server
echo "NEW_VAR=value" >> .env
pm2 restart packflow-crm --update-env
```

### 5.2 Re-embed products (khi thêm nhiều SP mới cùng lúc)

```bash
ssh techla@192.168.1.229
cd ~/packflow-crm/server
npx tsx scripts/embed-products.ts
```

Script tự skip SP đã embed (so sánh hash) — chỉ embed cái mới/thay đổi.

### 5.3 Xem log BE

```bash
ssh techla@192.168.1.229 'pm2 logs packflow-crm --lines 100 --nostream'
```

Theo dõi realtime:
```bash
ssh techla@192.168.1.229 'pm2 logs packflow-crm'
# Ctrl+C để thoát
```

### 5.4 Restart chỉ BE (không rebuild)

```bash
ssh techla@192.168.1.229 'pm2 restart packflow-crm --update-env'
```

### 5.5 Truy cập DB production

```bash
ssh techla@192.168.1.229
psql -U packflow -d packflow_crm -h localhost
# hoặc
sudo -u postgres psql -d packflow_crm  # nếu có sudo
```

### 5.6 Backup DB production

```bash
# Backup plain SQL (text, restore bằng psql)
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  "mkdir -p ~/db-backups && PGPASSWORD='zE3rD1F1mizPtsXwgHTtnt9h' pg_dump -h localhost -U packflow packflow_crm | gzip > ~/db-backups/packflow_prod_\$(date +%Y%m%d_%H%M%S).sql.gz"

# Kéo về local (optional)
sshpass -p 'PASSWORD' scp techla@192.168.1.229:~/db-backups/packflow_prod_*.sql.gz ./backups/
```

### 5.7 Restore DB (từ backup plain SQL)

```bash
# Copy backup lên VPS nếu đang ở local
sshpass -p 'PASSWORD' scp ./backups/packflow_prod_xxx.sql.gz techla@192.168.1.229:/tmp/

# Stop app + restore + restart
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 '
  pm2 stop packflow-crm
  echo "66668888" | sudo -S -u postgres psql -d packflow_crm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO packflow; GRANT ALL ON SCHEMA public TO public; CREATE EXTENSION IF NOT EXISTS vector;"
  gunzip -c /tmp/packflow_prod_xxx.sql.gz | PGPASSWORD="zE3rD1F1mizPtsXwgHTtnt9h" psql -h localhost -U packflow -d packflow_crm -v ON_ERROR_STOP=0
  pm2 restart packflow-crm --update-env
'
```

### 5.8 Mirror full DB từ local lên prod (Option B — overwrite)

**⚠️ DESTRUCTIVE**: wipe toàn bộ data prod rồi copy từ local. Mất hết đơn/thanh toán phát sinh trên prod sau lần sync trước nếu có. CHỈ dùng khi chủ động muốn reset prod về state của local.

```bash
# 1. Backup prod trước (để rollback nếu hỏng)
BACKUP_NAME="packflow_prod_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 \
  "mkdir -p ~/db-backups && PGPASSWORD='zE3rD1F1mizPtsXwgHTtnt9h' pg_dump -h localhost -U packflow packflow_crm | gzip > ~/db-backups/${BACKUP_NAME}"

# 2. Dump local (PLAIN SQL — tránh version mismatch với prod pg_restore)
LOCAL_DUMP=/tmp/packflow_local_plain.sql
PGPASSWORD=postgres pg_dump -h localhost -U postgres --no-owner --no-privileges --no-comments packflow_crm > $LOCAL_DUMP

# 3. Upload lên VPS
sshpass -p 'PASSWORD' scp $LOCAL_DUMP techla@192.168.1.229:/tmp/packflow_local_plain.sql

# 4. Wipe prod schema (cần sudo postgres để tạo lại vector extension) + restore
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 '
  set -e
  pm2 stop packflow-crm
  PGPASSWORD="zE3rD1F1mizPtsXwgHTtnt9h" psql -h localhost -U packflow -d packflow_crm -c "DROP SCHEMA public CASCADE;"
  echo "66668888" | sudo -S -u postgres psql -d packflow_crm -c "CREATE SCHEMA IF NOT EXISTS public; GRANT ALL ON SCHEMA public TO packflow; GRANT ALL ON SCHEMA public TO public; CREATE EXTENSION IF NOT EXISTS vector;"
  PGPASSWORD="zE3rD1F1mizPtsXwgHTtnt9h" psql -h localhost -U packflow -d packflow_crm -v ON_ERROR_STOP=0 -f /tmp/packflow_local_plain.sql
  pm2 restart packflow-crm --update-env
'

# 5. Verify counts khớp local
QUERY="SELECT 'products' tbl, COUNT(*) FROM products UNION ALL SELECT 'customers', COUNT(*) FROM customers UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders UNION ALL SELECT 'zalo_messages', COUNT(*) FROM zalo_messages ORDER BY tbl;"
echo "=== LOCAL ===" && PGPASSWORD=postgres psql -h localhost -U postgres -d packflow_crm -c "$QUERY"
echo "=== PROD ===" && sshpass -p 'PASSWORD' ssh techla@192.168.1.229 "PGPASSWORD='zE3rD1F1mizPtsXwgHTtnt9h' psql -h localhost -U packflow -d packflow_crm -c \"$QUERY\""
```

**Rollback nếu prod bị sai sau sync** (dùng backup bước 1):
```bash
sshpass -p 'PASSWORD' ssh techla@192.168.1.229 '
  pm2 stop packflow-crm
  PGPASSWORD="zE3rD1F1mizPtsXwgHTtnt9h" psql -h localhost -U packflow -d packflow_crm -c "DROP SCHEMA public CASCADE;"
  echo "66668888" | sudo -S -u postgres psql -d packflow_crm -c "CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO packflow; GRANT ALL ON SCHEMA public TO public; CREATE EXTENSION IF NOT EXISTS vector;"
  gunzip -c ~/db-backups/packflow_prod_backup_<TIMESTAMP>.sql.gz | PGPASSWORD="zE3rD1F1mizPtsXwgHTtnt9h" psql -h localhost -U packflow -d packflow_crm -v ON_ERROR_STOP=0
  pm2 restart packflow-crm
'
```

### 5.9 pg_dump version compatibility

- Local macOS thường có `pg_dump 18+` (Homebrew), prod Ubuntu 24.04 có `pg_dump 16.13`.
- Custom format (`pg_dump -Fc`) **KHÔNG tương thích ngược** → dump từ local 18 không restore được với prod 16.
- Giải pháp: luôn dùng **plain SQL** (`pg_dump` mặc định, không có `-Fc`) khi đồng bộ cross-version.
- Hoặc cài pg16 trên mac (`brew install postgresql@16`) để dump với đúng version.

## 6. Troubleshooting

### Build fail: "Cannot find module X"
→ Thiếu package. SSH vào + `cd server && yarn install`.

### Prisma error: "relation does not exist"
→ DB schema out of sync. Chạy `npx prisma db push` trong `server/`.

### pgvector: "extension vector does not exist"
→ Chưa cài extension. Làm theo 3.2 + 3.3.

### PM2 "errored" status
```bash
pm2 logs packflow-crm --err --lines 50
pm2 restart packflow-crm
```

### Port 3001 đã dùng
```bash
sudo lsof -i :3001
# kill process cũ, restart PM2
```

### pg_restore: "unsupported version (1.16) in file header"
→ pg_dump local mới hơn prod pg_restore. Dùng **plain SQL** (`pg_dump` không có `-Fc`) thay vì custom format. Xem 5.9.

### Restore DB: "permission denied to create extension vector"
→ User `packflow` không phải superuser. Phải dùng `sudo -u postgres` để tạo extension trước, rồi mới chạy restore bằng `packflow`. Xem 5.7/5.8.

### Zalo send API trả `error_code:114 "Tham số không hợp lệ"`
→ Func.vn API cần user_id/group_id KHÔNG có prefix `zu`. Webhook lưu có prefix → phải strip. `ZaloService.cleanZaloId()` đã xử lý — nếu thấy lỗi này tức code chưa deploy hoặc có method chưa gọi cleanZaloId.

### Gemini "rate limit exceeded"
→ Free tier 100 RPM. Script `embed-products.ts` đã có delay 700ms → không bao giờ hit limit.

### Out of disk space
```bash
df -h                     # check
docker system prune -a    # nếu có docker
journalctl --vacuum-size=500M  # dọn log systemd
```

## 7. Rollback

### Rollback commit
```bash
ssh techla@192.168.1.229
cd ~/packflow-crm
git log --oneline -10                  # chọn commit muốn rollback
git reset --hard <commit-hash>
bash deploy.sh
```

### Rollback DB (nếu vừa db push sai)
- Không có auto-rollback với `db push`
- Nếu chỉ thêm cột: `ALTER TABLE X DROP COLUMN Y`
- Nếu phức tạp: restore từ backup gần nhất (xem 5.7 hoặc "Rollback nếu prod bị sai sau sync" ở 5.8)

## 8. Security checklist (quan trọng)

- [ ] SSH password-based → nên đổi sang **SSH key** + tắt password login
- [ ] `.env` chỉ đọc được bởi user `techla`: `chmod 600 server/.env`
- [ ] Postgres chỉ listen `localhost` (không bind public IP)
- [ ] Firewall mở **chỉ** port 80/443 (Nginx) và 22 (SSH)
- [ ] Backend không public port 3001 — dùng Nginx reverse proxy
- [ ] Cloudflare hoặc Let's Encrypt HTTPS cho domain
- [ ] Rotate JWT_SECRET mỗi 6 tháng

## 9. Stack components

```
[Browser]
    ↓ HTTPS
[Nginx (port 80/443)]
    ↓ proxy
[Node.js (PM2, port 3001)]   ←  packflow-crm process
    ├─ [Postgres 16 + pgvector]  (localhost:5432)
    ├─ [Redis]                    (localhost:6379)
    ├─ [Cloudinary]               (external)
    ├─ [OpenAI gateway]           (llm.openclaw-box.io.vn/v1)
    ├─ [Gemini API]               (generativelanguage.googleapis.com)
    └─ [Func.vn Zalo API]         (public-api.func.vn)
```

## 10. Liên hệ

- **VPS provider**: (tự điền)
- **Domain**: (tự điền)
- **Cloudinary account**: (tự điền)
- **Google AI Studio**: (tài khoản đã tạo Gemini key)
