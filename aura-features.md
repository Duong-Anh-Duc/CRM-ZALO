# Aura — AI Agent của PackFlow CRM

Tổng hợp đầy đủ tính năng của chatbot Aura sau refactor (Phase 0–4).

**Số liệu nhanh:**
- 88 tool đã đăng ký
- 2 channel hoạt động (CRM nội bộ + Zalo khách hàng)
- 4 lớp infrastructure (audit, telemetry, confirmation, memory)

---

## 1. Tool nghiệp vụ (88 tool)

### 1.1 Read / Query (10 tool — không audit, không confirm)

| Tool | Chức năng |
|---|---|
| `get_receivable_details` | Chi tiết công nợ phải thu theo từng KH (gốc/đã thu/còn lại/quá hạn) |
| `get_payable_details` | Chi tiết công nợ phải trả theo từng NCC |
| `get_customer_list` | Danh sách KH + đơn hàng + doanh thu + công nợ |
| `get_supplier_list` | Danh sách NCC + đơn mua + công nợ |
| `get_product_list` | Danh sách SP (SKU, tên, chất liệu, dung tích, giá) |
| `get_financial_report` | Doanh thu, giá vốn, lợi nhuận gộp/ròng, chi phí vận hành |
| `get_cash_book_details` | Chi tiết sổ quỹ theo danh mục thu/chi |
| `get_recent_orders` | Đơn bán gần nhất kèm chi tiết item |
| `get_return_details` | Phiếu trả hàng (bán + mua) gần nhất |
| `get_order_detail` | Chi tiết 1 đơn theo mã (VD: `SO-20260101-001`) |

### 1.2 Search (4 tool)

| Tool | Chức năng |
|---|---|
| `search_customer` | Tìm KH theo tên/SĐT |
| `search_supplier` | Tìm NCC theo tên/SĐT |
| `search_product` | Tìm SP theo tên/SKU |
| `list_categories` | Liệt kê danh mục (product / cash / operating_cost) |

### 1.3 Vision (1 tool)

| Tool | Chức năng |
|---|---|
| `find_product_by_image` | Nhận diện SP từ ảnh (1 hoặc nhiều ảnh cùng SP), OCR SKU/brand, fuzzy match catalog |

### 1.4 Customer (3 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_customer` | ✅ | ❌ | Tạo KH mới (company_name, phone, email, address, tax_code, debt_limit) |
| `update_customer` | ✅ | ❌ | Cập nhật thông tin KH |
| `delete_customer` | ✅ | 🛑 | Soft delete KH (is_active=false) |

### 1.5 Supplier (3 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_supplier` | ✅ | ❌ | Tạo NCC mới + payment_terms (NET_15/30/45/60/COD) |
| `update_supplier` | ✅ | ❌ | Cập nhật NCC |
| `delete_supplier` | ✅ | 🛑 | Soft delete NCC |

### 1.6 Product (10 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_product` | ✅ | ❌ | Tạo SP (SKU auto-gen, material, capacity_ml, MOQ, retail_price) |
| `update_product` | ✅ | ❌ | Cập nhật SP |
| `delete_product` | ✅ | 🛑 | Soft delete SP |
| `create_product_category` | ✅ | ❌ | Tạo danh mục SP |
| `update_product_category` | ✅ | ❌ | Đổi tên danh mục SP |
| `delete_product_category` | ✅ | 🛑 | Xoá danh mục SP |
| `upsert_customer_product_price` | ✅ | ❌ | Lưu/sửa giá riêng của 1 KH cho 1 SP |
| `upsert_supplier_price` | ✅ | ❌ | Tạo/sửa giá NCC cho 1 SP (kèm MOQ, lead_time, is_preferred) |
| `delete_customer_product_price` | ✅ | 🛑 | Xoá giá KH cho SP |
| `delete_supplier_price` | ✅ | 🛑 | Xoá giá NCC cho SP |

### 1.7 Sales & Purchase Order (8 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_sales_order` | ✅ | ❌ | Tạo đơn bán (customer_id + items + VAT_rate + delivery date) |
| `update_sales_order` | ✅ | ❌ | Sửa info chung của đơn (notes, fees, VAT) |
| `update_sales_order_status` | ✅ | ❌ | Đổi trạng thái: DRAFT/CONFIRMED/SHIPPING/COMPLETED/CANCELLED |
| `add_sales_order_item` | ✅ | ❌ | Thêm 1 SP vào đơn DRAFT |
| `remove_sales_order_item` | ✅ | 🛑 | Gỡ item khỏi đơn DRAFT |
| `create_purchase_order` | ✅ | ❌ | Tạo PO (link với SO, supplier, items) |
| `update_purchase_order` | ✅ | ❌ | Sửa PO (notes, delivery date) |
| `update_purchase_order_status` | ✅ | ❌ | Đổi trạng thái PO |

### 1.8 Invoice (5 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_sales_invoice` | ✅ | ❌ | Tạo HĐ bán từ SO đã CONFIRMED |
| `create_purchase_invoice` | ✅ | ❌ | Tạo HĐ mua từ PO (DRAFT, cần finalize sau) |
| `update_sales_invoice` | ✅ | ❌ | Sửa HĐ DRAFT (notes, date, VAT, total) |
| `finalize_invoice` | ✅ | 🛑 | Duyệt HĐ (DRAFT → APPROVED) |
| `cancel_invoice` | ✅ | 🛑 | Huỷ HĐ |

### 1.9 Return (6 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_sales_return` | ✅ | ❌ | Tạo phiếu trả hàng bán (KH trả) |
| `create_purchase_return` | ✅ | ❌ | Tạo phiếu trả hàng mua (trả NCC) |
| `update_sales_return` | ✅ | ❌ | Sửa reason/notes phiếu trả bán |
| `update_purchase_return` | ✅ | ❌ | Sửa reason/notes phiếu trả mua |
| `delete_sales_return` | ✅ | 🛑 | Xoá phiếu trả bán (khi chưa APPROVED) |
| `delete_purchase_return` | ✅ | 🛑 | Xoá phiếu trả mua (khi chưa APPROVED) |

### 1.10 Payment (4 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `record_receivable_payment` | ✅ | ❌ | Ghi thu tiền KH (FIFO theo HĐ cũ nhất, evidence_url BẮT BUỘC) |
| `record_payable_payment` | ✅ | ❌ | Ghi trả tiền NCC (evidence_url BẮT BUỘC) |
| `update_receivable_payment_evidence` | ✅ | ❌ | Cập nhật minh chứng (ảnh/PDF) cho payment KH |
| `update_payable_payment_evidence` | ✅ | ❌ | Cập nhật minh chứng cho payment NCC |

### 1.11 Cash Book & Operating Cost (12 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_cash_transaction` | ✅ | ❌ | Thêm GD sổ quỹ (INCOME/EXPENSE) |
| `update_cash_transaction` | ✅ | ❌ | Sửa GD sổ quỹ |
| `delete_cash_transaction` | ✅ | 🛑 | Xoá GD sổ quỹ |
| `create_cash_category` | ✅ | ❌ | Tạo danh mục sổ quỹ (INCOME/EXPENSE) |
| `update_cash_category` | ✅ | ❌ | Sửa danh mục sổ quỹ (name/is_active) |
| `delete_cash_category` | ✅ | 🛑 | Xoá danh mục sổ quỹ |
| `create_operating_cost` | ✅ | ❌ | Thêm chi phí vận hành |
| `update_operating_cost` | ✅ | ❌ | Sửa chi phí vận hành |
| `delete_operating_cost` | ✅ | 🛑 | Xoá chi phí vận hành |
| `create_operating_cost_category` | ✅ | ❌ | Tạo danh mục CP vận hành |
| `update_operating_cost_category` | ✅ | ❌ | Đổi tên danh mục CP vận hành |
| `delete_operating_cost_category` | ✅ | 🛑 | Xoá danh mục CP vận hành |

### 1.12 Payroll (7 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `create_payroll_period` | ✅ | ❌ | Tạo kỳ lương (year, month) |
| `calculate_payroll` | ✅ | ❌ | Tính lương cho 1 kỳ |
| `approve_payroll` | ✅ | 🛑 | Duyệt kỳ lương |
| `mark_payroll_paid` | ✅ | 🛑 | Đánh dấu đã trả lương |
| `create_employee_profile` | ✅ | ❌ | Tạo hồ sơ NV (lương cơ bản, allowances, BH, MST...) |
| `update_employee_profile` | ✅ | ❌ | Cập nhật hồ sơ NV |
| `delete_employee_profile` | ✅ | 🛑 | Đánh dấu nghỉ việc (INACTIVE) |

### 1.13 Alert (2 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `mark_alert_read` | ✅ | ❌ | Đánh dấu alert đã đọc |
| `take_alert_action` | ✅ | ❌ | Ghi action xử lý alert (ACK, RESCHEDULED...) |

### 1.14 Zalo (5 tool — read + write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `get_zalo_messages` | ❌ | ❌ | Đọc tin Zalo theo range/tên/sender — read |
| `list_zalo_threads` | ❌ | ❌ | Liệt kê hội thoại Zalo + last msg — read |
| `send_zalo_message` | ✅ | ❌ | Gửi DM tới user Zalo |
| `send_zalo_group_message` | ✅ | ❌ | Gửi tin vào group Zalo |
| `set_zalo_auto_reply` | ✅ | ❌ | Bật/tắt auto-reply AI cho 1 thread |

### 1.15 Export Excel (3 tool — write)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `export_customers_excel` | ✅ | ❌ | Xuất danh sách KH ra Excel (filter: type, city, has_debt) |
| `export_suppliers_excel` | ✅ | ❌ | Xuất NCC ra Excel (filter: city, has_payable) |
| `export_products_excel` | ✅ | ❌ | Xuất SP ra Excel (filter: category, material, is_active) |

### 1.16 AI Training (3 tool)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `list_ai_training` | ❌ | ❌ | Liệt kê kiến thức đã train cho Aura — read |
| `add_ai_training` | ✅ | ❌ | Thêm rule/alias/example/correction vào training |
| `delete_ai_training` | ✅ | 🛑 | Xoá 1 kiến thức |

### 1.17 Hệ thống (2 tool)

| Tool | Audit | Confirm | Chức năng |
|---|---|---|---|
| `help` | ❌ | ❌ | Aura tự liệt kê các năng lực hiện có (auto từ registry) |
| `confirm_action` | ❌ | ❌ | Xác nhận thực thi 1 hành động đã preview (gọi sau khi user OK) |

---

## 2. Infrastructure (cách Aura hoạt động)

| Thành phần | Mô tả |
|---|---|
| **Multi-round tool calling** | Tối đa 5 round LLM ↔ tool. Mỗi round có thể gọi nhiều tool song song |
| **Tool registry** | 88 tool đăng ký 1 chỗ, tách 17 file theo domain (customer, supplier, product, ...) |
| **Streaming response** | SSE endpoint `/api/chatbot/chat/stream` — yield từng chunk text |
| **Vision** | GPT-4o-mini nhận diện ảnh → trả JSON attrs (loai, chat_lieu, dung_tich, brand, OCR) |
| **System context cache** | KPIs hệ thống (số KH, doanh thu, công nợ) cache 60s, invalidate khi train mới |
| **History summarization** | Khi `history > 20 turn`, tóm tắt phần cũ thành 1 system msg + giữ 10 turn mới |
| **Prompt caching prep** | System prompt tách 2 phần: STATIC (cố định, ~2K tokens, prefix cacheable) + DYNAMIC (date + KPI, đổi liên tục) |
| **Convergence detection** | Phát hiện tool gọi lặp 2 round liên tiếp → break loop, tránh vô hạn |
| **Markdown stripping** | Streaming-safe — buffer ký tự cuối để tránh cắt giữa `**` |
| **Vietnamese persona** | Xưng "em", gọi user "anh", plain text, dùng "•" liệt kê, không markdown |

---

## 3. Bảo mật & quan sát (Phase 1–3)

### 3.1 Audit log (`ai_audit_logs` — 68 write tool)

| Trường | Ý nghĩa |
|---|---|
| `user_id`, `user_email` | AI hành động dưới quyền user nào |
| `tool_name` | Tool gì (vd `delete_customer`) |
| `args` (JSON) | Tham số AI truyền |
| `result` | Kết quả tool (truncate 1000 ký tự) |
| `success`, `error` | Thành công hay lỗi |
| `duration_ms` | Tool chạy mất bao lâu |
| `created_at` | Lúc nào |

### 3.2 Telemetry (`ai_telemetry` — mỗi conversation 1 row)

| Trường | Ý nghĩa |
|---|---|
| `user_id`, `user_email`, `channel` | Ai chat, channel `chat` hay `customer_reply` |
| `model` | Model dùng (vd `gpt-4o-mini`, `techla`) |
| `rounds` | Số LLM call trong conversation |
| `prompt_tokens`, `completion_tokens` | Token in/out |
| `cached_tokens` | Token được cache hit (50% rẻ) |
| `total_tokens` | Tổng token |
| `latency_ms` | Wall-clock toàn cuộc hội thoại |
| `tool_calls` | Số tool đã execute |
| `success`, `error` | Trạng thái cuối |

### 3.3 Confirmation flow (19 destructive tool)

| Bước | Hành vi |
|---|---|
| 1. AI gọi tool destructive | Server CHẶN, không thực hiện |
| 2. Server trả `[confirm_id:xxx]` + preview | Pending action lưu vào in-memory map (TTL 10 phút) |
| 3. Aura tóm tắt + hỏi user xác nhận | "Em sẽ xoá KH ABC, anh xác nhận nhé?" |
| 4. User trả lời | "ok" → bước 5; "thôi" → bước 6 |
| 5. Aura gọi `confirm_action()` | Server lấy pending mới nhất → run tool gốc → audit log ghi tool gốc |
| 6. Aura báo "đã hủy" | Pending tự hết hạn sau 10 phút |

### 3.4 User context

| Cấu trúc | Mô tả |
|---|---|
| `req.user` (JwtPayload) | Auth middleware decode JWT → có `userId`, `email`, `role`, `roleSlug` |
| `ChatUser` | Map sang `{ id, email, role, roleSlug }` truyền vào `chatStream` |
| `ToolContext` | `{ user: ChatUser }` truyền vào MỌI tool handler |
| Anonymous fallback | `ctx.user = { id: 'anonymous' }` nếu không có user (Zalo customer) |

### 3.5 Permission

| Endpoint | Guard |
|---|---|
| `/api/chatbot/chat/*` | `authenticate` + `requireAbility('use', 'AiChat')` |
| `/api/ai-stats/*` | `authenticate` + `requireAbility('read', 'AuditLog')` |

---

## 4. Channels

| Channel | Endpoint | Persona | Tool có | Audit | Telemetry |
|---|---|---|---|---|---|
| **CRM nội bộ** | `POST /api/chatbot/chat`, `POST /api/chatbot/chat/stream` | Aura — trợ lý AI nội bộ, xưng "em" gọi "anh" | 88 tool đầy đủ | ✅ (channel `chat`) | ✅ |
| **Zalo customer** | `customerReply()` (gọi từ `zalo.service.ts` khi webhook) | Nhân viên sale của shop, không nhận là AI | Chỉ `lookup_product` | ❌ (anonymous) | ✅ (channel `customer_reply`) |

---

## 5. Endpoint admin (Phase 2)

| Method | Path | Trả về |
|---|---|---|
| GET | `/api/ai-stats/summary?days=7&channel=chat&user_id=...` | Tổng hợp: conversations, tokens, latency, cache_hit_rate |
| GET | `/api/ai-stats/daily?days=30&channel=chat` | Mảng theo ngày: tokens/lat/conversations từng ngày |
| GET | `/api/ai-stats/tools?days=7` | Top tool theo số call, success rate, avg duration |

---

## 6. Tổng kết — Aura đã đạt chuẩn AI Agent production-grade

| Tiêu chí | Trạng thái |
|---|---|
| Multi-round tool calling | ✅ 5 rounds + convergence detection |
| Tool registry & schema chuẩn | ✅ 88 tools, OpenAI function-calling JSON schema |
| Streaming + SSE | ✅ |
| Vision (image understanding) | ✅ GPT-4o-mini |
| Memory management | ✅ Summarize >20 turn |
| Prompt caching prep | ✅ Tách static/dynamic (chờ proxy support) |
| User context propagation | ✅ ToolContext truyền mọi tool |
| Audit log security | ✅ 68 write tool |
| Telemetry cost/perf | ✅ Mọi conversation |
| Destructive confirmation | ✅ 19 tool, in-memory TTL 10min |
| Role-based guard | ✅ `requireAbility` |
| Multi-channel | ✅ CRM + Zalo customer |
| Vietnamese-native persona | ✅ Plain text, không markdown |
| Modular code | ✅ <300 dòng/file, registry pattern |
