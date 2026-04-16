# PackFlow CRM

Hệ thống quản lý kinh doanh cho doanh nghiệp bao bì nhựa trung gian (môi giới). Mua hàng từ nhà cung cấp, bán cho khách hàng, quản lý công nợ, sổ quỹ, trả hàng.

## Kiến trúc

```
packflow-crm/
├── client/          # Frontend - React + TypeScript + Ant Design
├── server/          # Backend - Express + Prisma + PostgreSQL
└── README.md
```

## Tech Stack

### Frontend (`/client`)

| Thư viện | Version | Mô tả |
|----------|---------|-------|
| React | 18.3 | UI framework |
| TypeScript | 5.7 | Type-safe JavaScript |
| Vite | 6.1 | Dev server + bundler |
| Ant Design | 5.23 | Component library |
| React Router | 7.1 | Routing |
| TanStack React Query | 5.66 | Data fetching + caching |
| Zustand | 5.0 | State management (auth store) |
| Axios | 1.7 | HTTP client |
| i18next | 25.8 | Đa ngôn ngữ (VI/EN) |
| Recharts | 3.7 | Biểu đồ dashboard |
| XLSX | 0.18 | Xuất Excel |
| Zod | 4.3 | Form validation |
| dayjs | 1.11 | Date formatting |

### Backend (`/server`)

| Thư viện | Version | Mô tả |
|----------|---------|-------|
| Express | 4.21 | Web framework |
| Prisma | 6.3 | ORM + migration |
| PostgreSQL | - | Database |
| Redis (ioredis) | 5.10 | Caching |
| JWT (jsonwebtoken) | 9.0 | Authentication |
| bcryptjs | 2.4 | Password hashing |
| Puppeteer | 24.40 | Generate PDF (hoá đơn, báo cáo) |
| OpenAI | 6.33 | AI integration (Zalo chat) |
| Cloudinary | 2.5 | Upload ảnh sản phẩm |
| Helmet + CORS + HPP | - | Security middleware |
| express-rate-limit | 7.5 | Rate limiting |
| Winston + Morgan | - | Logging |
| node-cron | 3.0 | Scheduled jobs (overdue check) |
| Multer | 1.4 | File upload |
| Zod | 3.24 | Request validation |

## Cài đặt

### Yêu cầu

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6 (optional, fallback memory cache)

### 1. Clone & Install

```bash
git clone <repo-url>
cd packflow-crm

# Install server
cd server
npm install

# Install client
cd ../client
npm install
```

### 2. Cấu hình environment

Tạo file `server/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/packflow_crm"

# Auth
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV=development

# Redis (optional)
REDIS_URL="redis://localhost:6379"
REDIS_DEFAULT_TTL=300

# Cloudinary (upload ảnh)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Rate Limiting
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_AUTH=10
RATE_LIMIT_API=60
RATE_LIMIT_HEAVY=5

# Upload
UPLOAD_MAX_SIZE=5242880
UPLOAD_MAX_FILES=10

# Business
DEFAULT_RECEIVABLE_DUE_DAYS=30

# Zalo Integration (optional)
ZALO_FUNC_GET_THREADS_URL=""
ZALO_FUNC_GET_THREADS_TOKEN=""
ZALO_FUNC_GET_MESSAGES_URL=""
ZALO_FUNC_GET_MESSAGES_TOKEN=""
ZALO_FUNC_ACCOUNT_TOKEN=""
```

### 3. Khởi tạo Database

```bash
cd server

# Push schema lên DB
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed data mẫu
npm run db:seed
```

### 4. Chạy development

```bash
# Terminal 1 - Server (port 3001)
cd server
npm run dev

# Terminal 2 - Client (port 5173)
cd client
npm run dev
```

Truy cập: `http://localhost:5173`

### 5. Build production

```bash
# Build client
cd client
npm run build    # Output: client/dist/

# Build server
cd server
npm run build    # Output: server/dist/
npm start        # Start production server
```

## Tài khoản demo

| Email | Password | Role |
|-------|----------|------|
| ducytcg123456@gmail.com | Duckhiem040603@ | ADMIN |
| staff1@packflow.vn | Staff@123456 | STAFF |
| viewer@packflow.vn | Viewer@123456 | VIEWER |

## Modules

### Danh mục

| Module | Mô tả | CRUD |
|--------|-------|------|
| **Sản phẩm** | Quản lý SP nhựa (chai, can, túi...) với thông số kỹ thuật, giá bán, giá NCC, ảnh | Full + soft delete |
| **Khách hàng** | Cá nhân / Doanh nghiệp, hạn mức công nợ, lịch sử đơn + thanh toán | Full + soft delete |
| **Nhà cung cấp** | Quản lý NCC, giá nhập per SP, MOQ, lead time, điều khoản thanh toán | Full + soft delete |

### Đơn hàng

| Module | Mô tả | Flow |
|--------|-------|------|
| **Đơn bán hàng (SO)** | Đơn từ KH, VAT per item (5/8/10%), phí ship, phí khác | DRAFT → CONFIRMED → SHIPPING → COMPLETED |
| **Đơn mua hàng (PO)** | Tự tạo từ SO khi CONFIRMED, group by NCC | DRAFT → CONFIRMED → SHIPPING → COMPLETED |
| **Trả hàng** | KH trả (Sales Return) + Trả NCC (Purchase Return) | PENDING → APPROVED → RECEIVING/SHIPPING → COMPLETED |

**Nghiệp vụ đặc biệt:**
- SO CONFIRMED → tự tạo PO cho mỗi NCC
- Mỗi item SO có VAT riêng (5%, 8%, 10%)
- Grand total = subtotal + VAT + shipping_fee + other_fee
- Trả hàng COMPLETED → tự giảm công nợ tương ứng

### Tài chính

| Module | Mô tả |
|--------|-------|
| **Hoá đơn** | SALES (bán) + PURCHASE (mua), generate PDF, DRAFT → APPROVED tạo công nợ |
| **Công nợ phải thu** | Từ hoá đơn bán approved, FIFO payment, group by KH |
| **Công nợ phải trả** | Từ hoá đơn mua approved, FIFO payment, group by NCC |
| **Sổ quỹ** | Thu/Chi, auto-sync từ thanh toán công nợ, manual entry cho lương/chi phí |

**Nghiệp vụ đặc biệt:**
- Duyệt hoá đơn bán → tạo Receivable (công nợ phải thu)
- Duyệt hoá đơn mua → tạo Payable (công nợ phải trả)
- Ghi nhận thanh toán → FIFO phân bổ + tự tạo record sổ quỹ
- Record sổ quỹ auto-sync có `is_auto=true` → không xoá được
- remaining = original_amount - paid_amount - returns

### Công cụ

| Module | Mô tả |
|--------|-------|
| **Dashboard** | Thống kê: công nợ, doanh thu, biểu đồ xu hướng, top KH/SP |
| **Báo cáo** | P&L, Aging công nợ, Doanh thu SP — có xuất Excel |
| **Zalo AI** | Tích hợp Zalo qua Func.vn, AI phân loại tin nhắn, tạo đơn từ chat |
| **Cảnh báo** | Thông báo giao hàng trễ, thanh toán, status thay đổi |
| **Nhân viên** | Quản lý user (ADMIN/STAFF/VIEWER), ẩn ADMIN khỏi list |
| **Cài đặt** | Thông tin công ty, cấu hình Zalo API |

## API Endpoints

Base URL: `/api`

### Auth (`/api/auth`)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/auth/login` | Đăng nhập, trả về JWT token | - |
| POST | `/auth/logout` | Đăng xuất | Bearer |
| GET | `/auth/profile` | Lấy thông tin user đang đăng nhập | Bearer |
| PUT | `/auth/profile` | Cập nhật thông tin cá nhân | Bearer |
| PUT | `/auth/password` | Đổi mật khẩu | Bearer |

### Users (`/api/users`) — ADMIN only

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/users` | Danh sách nhân viên |
| POST | `/users` | Tạo nhân viên mới (ADMIN/STAFF/VIEWER) |
| PUT | `/users/:id` | Cập nhật thông tin nhân viên |
| DELETE | `/users/:id` | Vô hiệu hoá nhân viên (soft delete) |

### Sản phẩm (`/api/products`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/products` | Danh sách SP (search, filter supplier, phân trang) |
| GET | `/products/:id` | Chi tiết SP + giá NCC + lịch sử bán/mua |
| POST | `/products` | Tạo SP mới (upload ảnh kèm) |
| PUT | `/products/:id` | Cập nhật SP |
| DELETE | `/products/:id` | Ẩn SP (soft delete, is_active=false) |
| POST | `/products/:id/images` | Upload thêm ảnh cho SP |
| PATCH | `/products/:id/images/:imageId/primary` | Đặt ảnh chính |
| DELETE | `/products/:id/images/:imageId` | Xoá ảnh SP |

### Khách hàng (`/api/customers`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/customers` | Danh sách KH (search, phân trang) |
| GET | `/customers/:id` | Chi tiết KH + đơn hàng + công nợ + thanh toán |
| POST | `/customers` | Tạo KH mới |
| PUT | `/customers/:id` | Cập nhật KH |
| DELETE | `/customers/:id` | Ẩn KH (soft delete) |
| POST | `/customers/check-debt-limit` | Kiểm tra hạn mức công nợ trước khi tạo đơn |

### Nhà cung cấp (`/api/suppliers`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/suppliers` | Danh sách NCC (search, phân trang) |
| GET | `/suppliers/:id` | Chi tiết NCC + SP cung cấp + PO + công nợ |
| POST | `/suppliers` | Tạo NCC mới |
| PUT | `/suppliers/:id` | Cập nhật NCC |
| DELETE | `/suppliers/:id` | Ẩn NCC (soft delete) |

### Đơn bán hàng (`/api/sales-orders`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/sales-orders` | Danh sách SO (search, filter status/date, phân trang) |
| GET | `/sales-orders/:id` | Chi tiết SO + items + PO liên kết + hoá đơn |
| POST | `/sales-orders` | Tạo SO mới (items + VAT per item + shipping/other fee) |
| PATCH | `/sales-orders/:id` | Cập nhật SO (notes, expected_delivery, fees) |
| PATCH | `/sales-orders/:id/status` | Đổi trạng thái (CONFIRMED → tự tạo PO) |
| POST | `/sales-orders/:id/items` | Thêm SP vào SO (chỉ DRAFT) |
| PATCH | `/sales-orders/:id/items/:itemId` | Sửa item (qty, price, VAT, supplier) |
| DELETE | `/sales-orders/:id/items/:itemId` | Xoá item khỏi SO |

### Đơn mua hàng (`/api/purchase-orders`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/purchase-orders` | Danh sách PO (search, filter status/date, phân trang) |
| GET | `/purchase-orders/:id` | Chi tiết PO + items + NCC + SO liên kết |
| POST | `/purchase-orders` | Tạo PO mới (thường tự tạo từ SO) |
| PATCH | `/purchase-orders/:id` | Cập nhật PO (notes, expected_delivery) |
| PATCH | `/purchase-orders/:id/status` | Đổi trạng thái PO |

### Hoá đơn (`/api/invoice`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/invoice` | Danh sách HĐ (search, filter status/type/date, sales_order_id, purchase_order_id) |
| GET | `/invoice/:id` | Chi tiết HĐ |
| GET | `/invoice/:id/pdf` | Download/preview PDF hoá đơn |
| GET | `/invoice/sales-order/:id` | Lấy HĐ theo SO |
| POST | `/invoice/from-order/:orderId` | Tạo HĐ bán từ SO (DRAFT) |
| POST | `/invoice/purchase/:poId` | Tạo HĐ mua từ PO (upload file NCC) |
| PATCH | `/invoice/:id` | Sửa HĐ (chỉ DRAFT) |
| POST | `/invoice/:id/finalize` | **Duyệt HĐ** → APPROVED → tạo Receivable/Payable |
| POST | `/invoice/:id/cancel` | Huỷ HĐ |

### Công nợ phải thu (`/api/receivables`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/receivables` | Danh sách flat (filter status/customer/date) |
| GET | `/receivables/by-customer` | Danh sách group by KH (tổng nợ, đã trả, còn lại) |
| GET | `/receivables/summary` | Tổng quan: tổng phải thu, quá hạn, đến hạn tuần này |
| GET | `/receivables/customer/:customerId` | Chi tiết công nợ KH + items SP + lịch sử TT |
| GET | `/receivables/customer/:customerId/export-pdf` | Xuất báo cáo công nợ KH dạng PDF |
| POST | `/receivables/payments` | **Ghi nhận thanh toán** (FIFO) → auto tạo sổ quỹ Thu |

### Công nợ phải trả (`/api/payables`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/payables` | Danh sách flat |
| GET | `/payables/by-supplier` | Danh sách group by NCC |
| GET | `/payables/summary` | Tổng quan phải trả |
| GET | `/payables/supplier/:supplierId` | Chi tiết công nợ NCC + items SP + lịch sử TT |
| GET | `/payables/supplier/:supplierId/export-pdf` | Xuất PDF công nợ NCC |
| POST | `/payables/payments` | **Ghi nhận thanh toán NCC** (FIFO) → auto tạo sổ quỹ Chi |

### Trả hàng (`/api/returns`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/returns/sales` | Danh sách trả hàng bán (search, filter status) |
| GET | `/returns/sales/:id` | Chi tiết phiếu trả + items + lý do |
| POST | `/returns/sales` | Tạo phiếu trả hàng bán (chọn SO → chọn SP + SL trả) |
| PATCH | `/returns/sales/:id/status` | Đổi trạng thái (**COMPLETED → giảm Receivable**) |
| DELETE | `/returns/sales/:id` | Xoá phiếu (chỉ PENDING/REJECTED) |
| GET | `/returns/purchase` | Danh sách trả hàng mua |
| GET | `/returns/purchase/:id` | Chi tiết phiếu trả NCC |
| POST | `/returns/purchase` | Tạo phiếu trả hàng mua (chọn PO → chọn SP) |
| PATCH | `/returns/purchase/:id/status` | Đổi trạng thái (**COMPLETED → giảm Payable**) |
| DELETE | `/returns/purchase/:id` | Xoá phiếu (chỉ PENDING/REJECTED) |

### Sổ quỹ (`/api/cash-book`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/cash-book` | Danh sách giao dịch (filter type/category/date, search) |
| GET | `/cash-book/summary` | Tổng thu / tổng chi / số dư |
| POST | `/cash-book` | Tạo giao dịch thủ công (Thu/Chi) |
| PUT | `/cash-book/:id` | Sửa giao dịch (chỉ manual, không sửa auto) |
| DELETE | `/cash-book/:id` | Xoá giao dịch (chỉ manual, **auto bị chặn**) |
| GET | `/cash-book/categories` | Danh sách danh mục Thu/Chi |
| POST | `/cash-book/categories` | Tạo danh mục mới |
| PUT | `/cash-book/categories/:id` | Sửa danh mục |

### Chi phí vận hành (`/api/operating-costs`) — Legacy, đã gộp vào Sổ quỹ

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/operating-costs` | Danh sách chi phí |
| GET | `/operating-costs/monthly-summary` | Tổng hợp theo tháng |
| GET | `/operating-costs/categories` | Danh mục chi phí |
| POST | `/operating-costs/categories` | Tạo danh mục |
| POST | `/operating-costs` | Tạo chi phí |
| PUT | `/operating-costs/:id` | Sửa chi phí |
| DELETE | `/operating-costs/:id` | Xoá chi phí |

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/dashboard` | Tổng quan: công nợ, doanh thu, biểu đồ xu hướng, top KH/SP, giao hàng sắp tới |

### Báo cáo (`/api/reports`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/reports/pnl` | Báo cáo Lãi/Lỗ (Revenue - COGS - OPEX) |
| GET | `/reports/debt-aging` | Phân tích tuổi nợ (current, 1-30, 31-60, 60+ ngày) |
| GET | `/reports/product-sales` | Doanh thu theo SP (SL, revenue, ranking) |

### Cảnh báo (`/api/alerts`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/alerts` | Danh sách cảnh báo (filter type/status) |
| GET | `/alerts/unread-count` | Số cảnh báo chưa đọc |
| PATCH | `/alerts/:id/read` | Đánh dấu đã đọc |
| PATCH | `/alerts/:id/action` | Xử lý cảnh báo (xác nhận trễ, đã giao...) |

### Zalo Integration (`/api/zalo`)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/zalo/threads` | Lấy danh sách hội thoại Zalo |
| GET | `/zalo/thread-messages` | Lấy tin nhắn trong hội thoại |
| GET | `/zalo/messages` | Lấy tin nhắn tổng |
| GET | `/zalo/group-info` | Thông tin nhóm Zalo |
| GET | `/zalo/user-info` | Thông tin user Zalo |
| GET | `/zalo/user-info-extra` | Thông tin mở rộng user |
| GET | `/zalo/stats` | Thống kê Zalo |
| POST | `/zalo/sync-messages` | Đồng bộ tin nhắn từ Zalo (ADMIN) |
| POST | `/zalo/webhook` | Webhook nhận tin nhắn Zalo |
| GET | `/zalo/config` | Lấy cấu hình Zalo API (ADMIN) |
| POST | `/zalo/config` | Lưu cấu hình Zalo API (ADMIN) |
| POST | `/zalo/ai-chat` | Chat AI (phân loại tin nhắn, tạo đơn) |
| GET | `/zalo/ai-chat/history` | Lịch sử chat AI |
| DELETE | `/zalo/ai-chat/history` | Xoá lịch sử chat |
| GET | `/zalo/ai-summary` | AI tóm tắt hội thoại |
| GET | `/zalo/ai-training` | Danh sách dữ liệu training AI |
| GET | `/zalo/ai-training/categories` | Danh mục training |
| POST | `/zalo/ai-training` | Thêm dữ liệu training |
| PATCH | `/zalo/ai-training/:id` | Sửa dữ liệu training |
| DELETE | `/zalo/ai-training/:id` | Xoá dữ liệu training |
| GET | `/zalo/order-suggestions` | Danh sách đề xuất đơn từ AI |
| GET | `/zalo/order-suggestions/count` | Số đề xuất chờ duyệt |
| POST | `/zalo/order-suggestions/:id/approve` | Duyệt đề xuất → tạo SO |
| POST | `/zalo/order-suggestions/:id/reject` | Từ chối đề xuất |

**Tổng: 95 endpoints**

## Database Schema

### Enums chính
- **SalesOrderStatus**: DRAFT → CONFIRMED → SHIPPING → COMPLETED / CANCELLED
- **PurchaseOrderStatus**: DRAFT → CONFIRMED → SHIPPING → COMPLETED / CANCELLED
- **DebtStatus**: UNPAID → PARTIAL → PAID / OVERDUE
- **ReturnStatus**: PENDING → APPROVED → RECEIVING/SHIPPING → COMPLETED / REJECTED / CANCELLED
- **InvoiceStatus**: DRAFT → APPROVED / CANCELLED
- **CashTransactionType**: INCOME / EXPENSE

### Models chính
```
Product → SalesOrderItem ← SalesOrder → Receivable → ReceivablePayment
                ↓                           ↓
            Supplier → PurchaseOrder → Payable → PayablePayment
                           ↓
                       Invoice (SALES / PURCHASE)

SalesReturn → SalesReturnItem → Product
PurchaseReturn → PurchaseReturnItem → Product

CashCategory → CashTransaction (is_auto: true/false)
```

## Đa ngôn ngữ

Hỗ trợ Tiếng Việt (mặc định) và English:
- Client: `client/src/locales/vi.json` + `en.json`
- Server: `server/src/locales/vi.json` + `en.json`

## Security

- JWT authentication (Bearer token)
- Role-based access control (ADMIN > STAFF > VIEWER)
- Helmet + CORS + HPP middleware
- Rate limiting (global + per-endpoint)
- Password hashing (bcrypt, 12 rounds)
- Soft delete (KH/NCC/SP không xoá thật)
- Auto-sync records không xoá được (is_auto flag)

## Responsive

- 4 breakpoints: 992px / 768px / 576px / 400px
- Mobile-friendly tables (scroll horizontal)
- Sidebar collapse trên mobile
- Card layout tự wrap

## Scripts

### Server
```bash
npm run dev          # Development (nodemon + tsx)
npm run build        # Build TypeScript
npm start            # Production
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema to DB
npm run db:migrate   # Create migration
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio (GUI)
```

### Client
```bash
npm run dev          # Dev server (port 5173)
npm run build        # Build production (→ dist/)
npm run preview      # Preview production build
```
