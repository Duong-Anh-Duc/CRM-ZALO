# PackFlow CRM — Tài liệu Đặc tả Hệ thống

> Phiên bản: 2.0 | Cập nhật: 15/04/2026
> Loại: Business Analysis Document (BAD)
> Đối tượng: BA, Dev, QA, Stakeholder

---

## 1. Tổng quan

### 1.1. Mô hình kinh doanh

PackFlow CRM phục vụ doanh nghiệp **môi giới bao bì nhựa** — không sản xuất, không tồn kho dài hạn.

```
Khách hàng ←→ [PackFlow] ←→ Nhà cung cấp
```

- Nhận đơn từ KH → Đặt hàng NCC → Giao hàng cho KH
- Lợi nhuận = Giá bán KH − Giá mua NCC − Chi phí vận hành

### 1.2. Vai trò người dùng

| Role | Quyền |
|------|-------|
| **ADMIN** | Toàn quyền: cài đặt, nhân viên, duyệt, xoá |
| **STAFF** | Tạo/sửa đơn hàng, ghi nhận thanh toán, tạo trả hàng |
| **VIEWER** | Chỉ xem, không tạo/sửa/xoá |

---

## 2. Luồng nghiệp vụ chính

### 2.1. Luồng tổng quan

```
          ┌─────────────────────────────────────────────────────┐
          │                   LUỒNG CHÍNH                       │
          │                                                     │
 KH hỏi giá    Tạo đơn bán     Xác nhận        Giao hàng      │
 (Zalo/Tel) → SO (DRAFT) → SO (CONFIRMED) → SO (SHIPPING) → SO (COMPLETED)
                                   │                            │
                              Auto tạo PO                       │
                              (per NCC)                         │
                                   │                            │
                          PO (DRAFT) → PO (CONFIRMED) → PO (COMPLETED)
                                                                │
          ┌─────────────────────────────────────────────────────┘
          │
          ▼
   Tạo hoá đơn       Duyệt HĐ           Ghi nhận TT
   (DRAFT) ────→ HĐ (APPROVED) ────→ Công nợ ────→ Sổ quỹ
                      │                                │
                      └── Tạo Receivable/Payable ──────┘
```

### 2.2. Luồng chi tiết từng bước

**Bước 1: Tiếp nhận đơn hàng**
- Kênh: Zalo (AI tự đề xuất), điện thoại, trực tiếp
- Tạo SO ở trạng thái DRAFT
- Thêm sản phẩm, số lượng, đơn giá, VAT per item

**Bước 2: Gán nhà cung cấp**
- Mỗi item trong SO phải gán 1 NCC
- Hệ thống tự gợi ý NCC ưu tiên (is_preferred) nếu có
- Hiển thị giá nhập bên cạnh giá bán để tính lợi nhuận

**Bước 3: Xác nhận đơn (CONFIRMED)**
- Điều kiện: TẤT CẢ items phải có supplier_id
- Hệ thống tự tạo PO cho mỗi NCC (group items by supplier)
- Items không có supplier → bị skip, không tạo PO

**Bước 4: Tạo và duyệt hoá đơn**
- Tạo hoá đơn bán (SALES) từ SO → PDF preview
- Tạo hoá đơn mua (PURCHASE) từ PO → upload file NCC
- Duyệt hoá đơn → tạo công nợ (Receivable/Payable)

**Bước 5: Thanh toán**
- Ghi nhận thanh toán theo FIFO (nợ cũ nhất trả trước)
- Tự động tạo bản ghi sổ quỹ (Thu/Chi)

---

## 3. Module Sản phẩm

### 3.1. Thông tin sản phẩm

| Field | Bắt buộc | Mô tả |
|-------|----------|-------|
| SKU | Có | Mã SP duy nhất, auto-generate theo format `PLB-{material}-{year}-{seq}` |
| Tên | Có | Tên sản phẩm |
| Chất liệu | Có | PET, HDPE, PP, PVC, PS, ABS |
| Dung tích (ml) | Không | Cho chai, can |
| Màu sắc | Không | CLEAR, WHITE, BLUE, GREEN, CUSTOM |
| Hình dáng | Không | ROUND, SQUARE, OVAL, CUSTOM |
| Cổ chai | Không | Loại + spec (VD: SCREW - 24/410) |
| Đơn vị bán | Có | PIECE, CARTON, KG |
| MOQ | Không | Số lượng đặt tối thiểu |
| Giá bán lẻ | Không | Mức giá mặc định cho KH lẻ |
| Giá bán sỉ | Không | Mức giá cho KH sỉ |
| Bảng giá theo SL | Không | Giá tier: ≥100 cái = X, ≥500 cái = Y |

### 3.2. Giá nhà cung cấp

Mỗi SP có thể được cung cấp bởi nhiều NCC:

| Field | Mô tả |
|-------|-------|
| NCC | Nhà cung cấp |
| Giá nhập | Giá mua từ NCC |
| MOQ | SL tối thiểu NCC yêu cầu |
| Lead time | Thời gian giao hàng (ngày) |
| Ưu tiên | Đánh dấu NCC ưu tiên (auto-assign khi tạo SO) |

### 3.3. Lịch sử đơn hàng

- Tab "Lịch sử bán": 20 SO gần nhất chứa SP này (mã đơn, KH, SL, đơn giá, ngày)
- Tab "Lịch sử mua": 20 PO gần nhất chứa SP này (mã đơn, NCC, SL, giá nhập, ngày)

### 3.4. Quy tắc xoá

- **Soft delete** (is_active = false) — không xoá thật khỏi DB
- SP đã có trong đơn hàng vẫn xoá (ẩn) được, đơn cũ không bị ảnh hưởng

---

## 4. Module Khách hàng

### 4.1. Loại khách hàng

| Loại | Mô tả | Fields riêng |
|------|-------|-------------|
| INDIVIDUAL | Cá nhân | contact_name, phone |
| BUSINESS | Doanh nghiệp | company_name, tax_code, contact_name, debt_limit |

### 4.2. Hạn mức công nợ

- Field `debt_limit`: số tiền nợ tối đa cho phép
- Khi tạo SO mới → hệ thống kiểm tra: tổng nợ hiện tại + đơn mới ≤ debt_limit
- Nếu vượt → cảnh báo (không chặn cứng)

### 4.3. Trang chi tiết khách hàng

Hiển thị trên cùng 1 trang, không tách modal:

```
[Summary Bar] Tổng tiền | Đã thanh toán | Còn nợ | Quá hạn

[Card] Thông tin khách hàng
  - Tên, SĐT, email, địa chỉ, mã số thuế, hạn mức nợ

[Table] Lịch sử đơn hàng
  Cột: STT | Mã đơn | Ngày | Tổng tiền | Trạng thái | Số HĐ | Đã TT | Còn lại | TT công nợ | Thao tác
  
  - Mã đơn: click → chi tiết SO
  - Số HĐ: click → preview PDF hoá đơn
  - Thao tác: icon lịch sử TT → modal danh sách payments
```

---

## 5. Module Nhà cung cấp

### 5.1. Thông tin

| Field | Mô tả |
|-------|-------|
| Tên công ty | Bắt buộc |
| Mã số thuế | Tuỳ chọn |
| Người liên hệ | Tên + SĐT + email |
| Địa chỉ | |
| Điều khoản TT | IMMEDIATE / NET_30 / NET_60 / NET_90 |

### 5.2. Trang chi tiết

```
[Summary Bar] Tổng mua | Đã thanh toán | Còn nợ | Quá hạn

[Card] Thông tin NCC

[Tabs]
  Tab 1: Lịch sử đơn mua (PO + công nợ + payments - giống KH)
  Tab 2: Sản phẩm cung cấp (SKU, tên, giá nhập, MOQ, lead time)
```

---

## 6. Module Đơn bán hàng (Sales Order)

### 6.1. Trạng thái

```
DRAFT → CONFIRMED → SHIPPING → COMPLETED
  ↓                                ↓
CANCELLED                      CANCELLED
```

| Trạng thái | Mô tả | Cho phép |
|------------|-------|---------|
| DRAFT | Nháp, đang soạn | Sửa items, sửa giá, gán NCC |
| CONFIRMED | Đã xác nhận, auto tạo PO | Không sửa items |
| SHIPPING | Đang giao hàng | |
| COMPLETED | Hoàn thành | |
| CANCELLED | Đã huỷ | |

### 6.2. Tính toán tài chính

```
Mỗi item:
  line_total = quantity × unit_price × (1 − discount_pct / 100)
  vat_amount = line_total × vat_rate / 100

Đơn hàng:
  subtotal    = SUM(all items line_total)
  vat_amount  = SUM(all items vat_amount)
  grand_total = subtotal + vat_amount + shipping_fee + other_fee
```

**VAT per item**: Mỗi SP có VAT riêng (0%, 5%, 8%, 10%) — không phải VAT cả đơn.

### 6.3. Auto tạo PO khi CONFIRMED

**Điều kiện**: Tất cả items phải có `supplier_id`

**Logic**:
1. Group items by `supplier_id`
2. Mỗi group → 1 PO mới (DRAFT)
3. PO items copy từ SO items (product, quantity, purchase_price)
4. PO notes = "Mua cho đơn {SO_CODE}"

**Items không có supplier** → skip, không tạo PO

### 6.4. Hiển thị chi tiết

```
[Header] Avatar "SO" | Mã đơn | Trạng thái | Nút đổi trạng thái

[Info] Ngày đặt | Ngày giao | VAT | Phí ship | Phí khác | Ghi chú

[Table SP] STT | SKU | Tên SP | NCC (link) | SL | Đơn giá | CK% | VAT | Thành tiền
           Summary: Tạm tính | VAT | Phí ship | Phí khác | Tổng cộng

[DRAFT mode] Inline edit: SL, giá, CK%, VAT, assign NCC + Nút thêm SP
```

---

## 7. Module Đơn mua hàng (Purchase Order)

### 7.1. Trạng thái

```
DRAFT → CONFIRMED → SHIPPING → COMPLETED
  ↓
CANCELLED
```

### 7.2. Liên kết SO

- Mỗi PO có `sales_order_id` → biết PO này mua cho đơn bán nào
- PO detail hiển thị link đến SO gốc
- SO detail hiển thị danh sách PO liên kết

### 7.3. Tính toán

```
total = SUM(quantity × unit_price) + shipping_fee + other_fee
```

---

## 8. Module Hoá đơn (Invoice)

### 8.1. Loại hoá đơn

| Loại | Mô tả | Tạo từ |
|------|-------|--------|
| SALES | Hoá đơn bán hàng | Tạo từ SO → hệ thống generate |
| PURCHASE | Hoá đơn mua hàng | Upload file từ NCC |

### 8.2. Trạng thái

```
DRAFT → APPROVED
  ↓
CANCELLED
```

### 8.3. Duyệt hoá đơn → Tạo công nợ

Khi HĐ được duyệt (DRAFT → APPROVED):

**Hoá đơn bán (SALES)**:
```
→ Tạo Receivable (công nợ phải thu)
  - original_amount = invoice.total
  - due_date = ngày duyệt + 30 ngày
  - status = UNPAID
  - Liên kết: customer_id, sales_order_id
```

**Hoá đơn mua (PURCHASE)**:
```
→ Tạo Payable (công nợ phải trả)
  - original_amount = invoice.total
  - due_date = ngày duyệt + 30 ngày
  - status = UNPAID
  - Liên kết: supplier_id, purchase_order_id
```

### 8.4. PDF hoá đơn

- Generate bằng Puppeteer (HTML → PDF)
- Bao gồm: thông tin bên bán/mua, items, VAT, tổng tiền bằng chữ
- Watermark "NHÁP" cho DRAFT
- Preview trong modal từ nhiều trang: chi tiết KH, chi tiết NCC, chi tiết công nợ

---

## 9. Module Công nợ

### 9.1. Công nợ phải thu (Receivable)

**Nguồn tạo**: Duyệt hoá đơn bán

**Trạng thái**:
```
UNPAID → PARTIAL → PAID
           ↓
         OVERDUE (auto khi quá hạn)
```

**Trang danh sách**: Group by khách hàng
- Tổng nợ, đã trả, còn lại, số HĐ, số quá hạn per KH
- Click → chi tiết công nợ KH

**Trang chi tiết**: Table hoá đơn
- Cột: STT | Số HĐ | Trạng thái | Mã đơn | Ngày HĐ | Hạn TT | Gốc | Đã TT | Còn lại
- Thao tác: icon xem SP (modal) + icon lịch sử TT (modal)
- Search + filter trạng thái + phân trang

### 9.2. Công nợ phải trả (Payable)

Cấu trúc tương tự, group by NCC.

### 9.3. Thanh toán — FIFO

Khi ghi nhận thanh toán cho 1 KH/NCC:

```
Input: customer_id + amount + payment_method + reference

Logic:
1. Lấy tất cả receivable UNPAID/PARTIAL/OVERDUE, sắp xếp due_date ASC (cũ nhất trước)
2. Lần lượt phân bổ:
   - HĐ 1 (due 01/01, còn 5M) → trả 5M → PAID
   - HĐ 2 (due 15/01, còn 3M) → trả 3M → PAID  
   - HĐ 3 (due 30/01, còn 4M) → trả 2M → PARTIAL (hết tiền)
3. Tạo ReceivablePayment cho mỗi HĐ được phân bổ
4. Auto tạo CashTransaction (Thu) trong sổ quỹ
```

**Validation**:
- Số tiền > 0
- Số tiền ≤ tổng nợ còn lại
- Phải có nợ chưa thanh toán

### 9.4. Auto phát hiện quá hạn

**Cron job**: Chạy mỗi ngày lúc 7:00 sáng

```
Tìm receivable/payable có:
  - due_date < ngày hiện tại
  - status IN [UNPAID, PARTIAL]
→ Cập nhật status = OVERDUE
```

---

## 10. Module Trả hàng

### 10.1. Loại trả hàng

| Loại | Mô tả | Tác động tài chính |
|------|-------|-------------------|
| Sales Return | KH trả lại cho mình | Giảm công nợ phải thu |
| Purchase Return | Mình trả lại NCC | Giảm công nợ phải trả |

### 10.2. Trạng thái

**KH trả**:
```
PENDING → APPROVED → RECEIVING → COMPLETED
  ↓          ↓
CANCELLED  REJECTED
```

**Trả NCC**:
```
PENDING → APPROVED → SHIPPING → COMPLETED
  ↓          ↓
CANCELLED  REJECTED
```

### 10.3. Tạo phiếu trả

1. Chọn đơn hàng gốc (SO hoặc PO)
2. Hệ thống load danh sách SP trong đơn
3. Nhập SL trả cho từng SP (≤ SL gốc) + lý do
4. Tổng tiền hoàn = SUM(SL trả × đơn giá)

### 10.4. COMPLETED → Giảm công nợ

Khi trạng thái chuyển sang COMPLETED:

**Sales Return**:
```
Tìm receivable của SO + KH, còn nợ > 0
Giảm remaining theo thứ tự mới nhất trước (reverse FIFO)
Nếu remaining ≤ 0 → status = PAID
```

**Purchase Return**: Tương tự, giảm payable.

### 10.5. Quy tắc xoá

- Chỉ xoá được phiếu ở trạng thái **PENDING** hoặc **REJECTED**
- Phiếu APPROVED/RECEIVING/SHIPPING/COMPLETED → không xoá được
- Cascade delete items khi xoá phiếu

---

## 11. Module Sổ quỹ (Cash Book)

### 11.1. Loại giao dịch

| Loại | Ví dụ | Màu |
|------|-------|-----|
| **INCOME** (Thu) | Thu từ KH, nạp vốn, thu khác | Xanh lá |
| **EXPENSE** (Chi) | Thanh toán NCC, lương, vận chuyển, thuê kho | Đỏ |

### 11.2. Danh mục

**Thu**: Thu từ khách hàng | Nạp tiền vốn | Thu khác

**Chi**: Thanh toán NCC | Lương nhân viên | Vận chuyển | Thuê kho bãi | Điện nước | Đóng gói | Marketing | Bảo trì thiết bị | Rút tiền | Khác

### 11.3. Auto-sync từ thanh toán

Khi ghi nhận thanh toán công nợ:

```
Receivable payment → Auto tạo Thu (INCOME)
  - Danh mục: "Thu từ khách hàng"
  - Mô tả: "Thu từ {tên KH}"
  - is_auto = true

Payable payment → Auto tạo Chi (EXPENSE)
  - Danh mục: "Thanh toán NCC"
  - Mô tả: "TT NCC {tên NCC}"
  - is_auto = true
```

### 11.4. Quy tắc xoá

| Loại record | Xoá được? | Icon |
|-------------|-----------|------|
| Giao dịch thủ công (is_auto=false) | Có | Thùng rác đỏ |
| Giao dịch auto-sync (is_auto=true) | Không | Khoá xám |

Lý do: Nếu xoá auto-sync → sổ quỹ không khớp công nợ.

### 11.5. Hiển thị

```
[Summary] Tổng thu (xanh) | Tổng chi (đỏ) | Số dư (xanh dương)

[Actions] Nút "Thu tiền" (xanh) | Nút "Chi tiền" (đỏ)

[Filters] Tìm kiếm | Loại (Thu/Chi) | Danh mục

[Table] STT | Ngày | Loại | Danh mục | Mô tả | Số tiền (+/-) | PT thanh toán | Tham chiếu | Thao tác
```

---

## 12. Module Dashboard

### 12.1. Dữ liệu hiển thị

| Card | Nguồn |
|------|-------|
| Tổng phải thu | SUM(receivable.remaining) where UNPAID/PARTIAL/OVERDUE |
| Tổng phải trả | SUM(payable.remaining) where UNPAID/PARTIAL/OVERDUE |
| Quá hạn phải thu | SUM(receivable.remaining) where OVERDUE |
| Quá hạn phải trả | SUM(payable.remaining) where OVERDUE |

### 12.2. Biểu đồ

- **Xu hướng doanh thu**: Line chart theo tháng (doanh thu vs chi phí vs lợi nhuận)
  - Doanh thu = SUM(SO.grand_total) per month
  - Chi phí = SUM(cash_transactions.amount where EXPENSE) per month
  - Lợi nhuận = Doanh thu − Chi phí

### 12.3. Bảng xếp hạng

- Top 5 KH theo doanh thu
- Top 5 SP theo doanh thu
- Đơn hàng sắp giao (expected_delivery trong 7 ngày tới)

---

## 13. Module Báo cáo

### 13.1. Lãi/Lỗ (P&L)

```
Doanh thu     = SUM(SO.grand_total) trong khoảng thời gian
Giá vốn       = SUM(PO.total) trong khoảng thời gian
Lợi nhuận gộp = Doanh thu − Giá vốn
Chi phí VH    = SUM(cash_transactions.amount where EXPENSE) trong khoảng thời gian
Lợi nhuận ròng = Lợi nhuận gộp − Chi phí VH
```

### 13.2. Phân tích tuổi nợ (Aging)

| Bucket | Điều kiện |
|--------|----------|
| Hiện tại | due_date ≥ today |
| 1-30 ngày | 1 ≤ (today − due_date) ≤ 30 |
| 31-60 ngày | 31 ≤ (today − due_date) ≤ 60 |
| Trên 60 ngày | (today − due_date) > 60 |

Áp dụng cho cả receivable và payable.

### 13.3. Doanh thu sản phẩm

- Group SO items by product_id
- Tính: tổng SL bán, tổng doanh thu per SP
- Sắp xếp theo doanh thu giảm dần

---

## 14. Module Zalo AI

### 14.1. Luồng xử lý tin nhắn

```
Tin nhắn Zalo → Webhook → Lưu DB → AI phân tích
                                       ↓
                              Là đơn hàng? → Tạo OrderSuggestion (PENDING)
                                       ↓
                              Staff duyệt → Tạo SO + auto PO
                              Staff từ chối → Ghi lý do
```

### 14.2. AI matching sản phẩm

3 cấp độ matching:
1. **SKU chính xác**: "PET-100" → match PET-100
2. **Tên gần đúng**: "chai pet 100ml" → match "Chai PET 100ml cổ 24mm"
3. **Keyword**: "chai nhựa" → match SP có keyword tương tự

### 14.3. Auto tạo đơn khi duyệt

1. Tìm/tạo KH từ thông tin Zalo (zalo_user_id, phone, tên)
2. Tạo SO với items từ AI matching
3. Auto tạo PO group by NCC ưu tiên
4. Ghi chú đơn: "[Zalo] {tên người gửi} - {AI summary}"

---

## 15. Module Cảnh báo

### 15.1. Loại cảnh báo

| Type | Mô tả |
|------|-------|
| WARNING | Giao hàng sắp đến hạn |
| URGENT | Quá hạn giao hàng |
| CRITICAL | Quá hạn nghiêm trọng |
| ESCALATION | Cần can thiệp quản lý |

### 15.2. Hành động

- Đánh dấu đã đọc
- Xác nhận trễ (nhập ngày giao mới)
- Xác nhận đã giao
- Gửi tin nhắn Zalo cho KH/NCC

---

## 16. Quy tắc xoá toàn hệ thống

| Đối tượng | Kiểu xoá | Điều kiện | An toàn? |
|-----------|----------|-----------|----------|
| Khách hàng | Soft (ẩn) | Luôn được | ✅ |
| Nhà cung cấp | Soft (ẩn) | Luôn được | ✅ |
| Sản phẩm | Soft (ẩn) | Luôn được | ✅ |
| Đơn bán/mua | Không xoá | Chuyển CANCELLED | ✅ |
| Hoá đơn | Không xoá | Chuyển CANCELLED | ✅ |
| Công nợ | Không xoá | Tự tạo từ HĐ | ✅ |
| Trả hàng | Hard delete | Chỉ PENDING/REJECTED | ✅ Cascade items |
| Sổ quỹ (thủ công) | Hard delete | Luôn được | ✅ |
| Sổ quỹ (auto) | Không xoá | is_auto=true | ✅ Bảo vệ |
| Nhân viên | Soft (ẩn) | Luôn được | ✅ |

---

## 17. Công thức tài chính

### 17.1. Đơn bán hàng

```
item.line_total = quantity × unit_price × (1 − discount_pct / 100)
item.vat_amount = item.line_total × item.vat_rate / 100

SO.subtotal    = Σ item.line_total
SO.vat_amount  = Σ item.vat_amount
SO.grand_total = SO.subtotal + SO.vat_amount + SO.shipping_fee + SO.other_fee
```

### 17.2. Đơn mua hàng

```
item.line_total = quantity × unit_price
PO.total = Σ item.line_total + PO.shipping_fee + PO.other_fee
```

### 17.3. Công nợ

```
receivable.original_amount = invoice.total (= SO.grand_total)
receivable.remaining = original_amount − paid_amount − completed_returns
receivable.due_date = invoice_approved_date + 30 ngày
```

### 17.4. Lợi nhuận đơn hàng

```
profit = SO.grand_total − Σ linked_PO.total
margin% = profit / SO.grand_total × 100
```

### 17.5. Sổ quỹ

```
balance = Σ INCOME.amount − Σ EXPENSE.amount
```

---

## 18. Đa ngôn ngữ

| Phạm vi | File |
|---------|------|
| Frontend Tiếng Việt | client/src/locales/vi.json |
| Frontend English | client/src/locales/en.json |
| Backend Tiếng Việt | server/src/locales/vi.json |
| Backend English | server/src/locales/en.json |

Tổng: **607 translation keys** (client) + **154 keys** (server)

Mặc định: Tiếng Việt. Chuyển đổi ngôn ngữ qua header UI.

---

## 19. Scheduled Jobs

| Job | Lịch | Mô tả |
|-----|------|-------|
| Overdue Checker | Mỗi ngày 7:00 AM | Tìm receivable/payable quá hạn → set OVERDUE |

---

## 20. Data Integrity Rules

| Rule | Mô tả |
|------|-------|
| SO.grand_total = subtotal + vat + fees | Tự tính khi tạo/sửa |
| Receivable.original = SO.grand_total | Set khi duyệt HĐ |
| Remaining ≥ 0 | Không bao giờ âm |
| Paid ≤ Original | Không trả vượt quá nợ gốc |
| Cash Thu KH = Receivable payments | Auto-sync đảm bảo khớp |
| Cash Chi NCC = Payable payments | Auto-sync đảm bảo khớp |
| Auto records không xoá | is_auto=true → block delete |
