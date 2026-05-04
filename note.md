# Lưu ý — Refactor chatbot Aura sang AI Agent (Phase 0–2)

Tài liệu này ghi lại các trade-off & lưu ý kỹ thuật trong quá trình refactor chatbot Aura. Tất cả "lưu ý" đều là quyết định thiết kế chủ động, không phải bug.

---

## Phase 0 — Tách monolith chatbot.service.ts (2620 → 138 dòng)

### Lưu ý 1: Behavior preserved — public API không đổi
- **Ý:** Chỉ DI CHUYỂN code, không sửa logic. `ChatbotService.chatStream / chat / customerReply / identifyProductFromImage` giữ nguyên signature.
- **Tác động:** Caller bên ngoài (`chatbot.route.ts`, `zalo.service.ts`) chạy y nguyên — không cần sửa client hay nơi khác.
- **Cần làm:** Test thử chat → tạo KH/đơn → confirm output giống trước. OK thì commit.

### Lưu ý 2: Total LOC tăng nhẹ (2620 → 2960)
- **Ý:** Code tổng dài hơn ~340 dòng vì mỗi file mới có header/import riêng.
- **Tác động:** Không hề gì. Đổi lại maintainability tốt hơn nhiều — sửa 1 tool không phải mở file 2620 dòng.

---

## Phase 1 — User context + audit log (`ai_audit_logs`)

### Lưu ý 1: customerReply (Zalo auto-reply) KHÔNG audit
- **Ý:** Khi khách hàng nhắn Zalo cho shop, AI trả lời tự động qua `customerReply()` — luồng này KHÔNG ghi vào `ai_audit_logs`.
- **Lý do:** Khách hàng Zalo là người ngoài, không có `req.user`. Họ chỉ gọi 1 tool `lookup_product` (read-only, vô hại). Audit log mục đích là "ai trong nội bộ làm gì".
- **Tác động:** Đúng thiết kế, không phải bug.
- **Mở rộng nếu cần:** Muốn tracking khách Zalo (ai hỏi gì, hỏi bao nhiêu) → dùng bảng `zalo_messages` đã có sẵn, hoặc Phase 2 telemetry (đã track channel `customer_reply`).

### Lưu ý 2: Tools handler chưa dùng ctx.user để filter ownership
- **Ý:** `ctx.user` đã được TRUYỀN xuống mọi tool handler, nhưng handler vẫn không check `user_id` khi query DB. VD: `delete_customer(id)` không check "KH này có thuộc tenant của user không".
- **Lý do:** PackFlow là single-tenant (1 công ty dùng), không có khái niệm tenant.
- **Tác động:** An toàn cho single-tenant hiện tại. Nếu sau này multi-tenant SaaS → phải sửa từng handler để filter `where: { tenant_id: ctx.user.tenant_id }`.
- **Đã chuẩn bị sẵn:** `ctx` đã truyền tới mọi handler → khi cần chỉ thêm filter, không phải đổi kiến trúc.

---

## Phase 2 — Observability (`ai_telemetry` + `/api/ai-stats`)

### Lưu ý 1: cache_hit_rate = 0 cho đến khi Phase 4
- **Ý:** Telemetry đã đọc `prompt_tokens_details.cached_tokens` từ OpenAI response, nhưng số này chỉ > 0 khi prompt prefix ≥1024 token và STABLE giữa các request (OpenAI tự cache).
- **Vấn đề hiện tại:** System prompt Aura có `${dayjs().format('DD/MM/YYYY')}` ngay trong prompt → mỗi ngày prefix khác nhau → cache không match. Phần `${systemContext}` (cache 60s) cũng đổi liên tục.
- **Phase 4 sẽ fix:** Tách phần "ổn định" (system prompt cố định + tool definitions, ~3000 token) ra ĐẦU prompt → OpenAI cache prefix → giảm 50% cost input cho phần đó.

### Lưu ý 2: Tool latency cho read tools chưa track
- **Ý:** `ai_audit_logs` chỉ ghi 68 write tools. Endpoint `/api/ai-stats/tools` sẽ KHÔNG hiện stats cho `search_customer`, `get_recent_orders`, `find_product_by_image`, v.v.
- **Lý do:** Audit log = security (ai làm gì write). Read tools không cần audit. Nhưng latency thì nên track cho cả read.
- **Workaround nếu cần:**
  - **Đơn giản:** Bật `audit: true` cho mọi nhóm trong `tools/index.ts` → DB phình ra (mỗi message gọi 3-5 read tool → vài trăm row/ngày).
  - **Đúng cách:** Thêm flag `telemetry: true` riêng (track latency, không lưu args/result) — Phase 2.5 nếu cần.
- **Khi nào nên làm:** Khi thấy chat chậm và muốn debug tool nào chậm.

### Lưu ý 3: UI dashboard cho stats — task FE riêng
- **Ý:** Mới làm BACKEND endpoint trả JSON. Client chưa có trang gọi `/api/ai-stats/summary` để hiển thị.
- **Truy cập hiện tại:** curl, Postman, hoặc query SQL trực tiếp.
- **Mở rộng nếu cần:** Tạo trang `/admin/ai-stats` ở client (Vietnamese label, Ant Design Statistic + Line chart).

---

## Tổng kết

| Lưu ý | Loại | Hành động |
|---|---|---|
| Phase 0 — Behavior preserved | Đã thiết kế | Test xong → commit |
| Phase 0 — LOC tăng nhẹ | Đánh đổi đáng giá | Không cần làm gì |
| Phase 1 — customerReply không audit | Đúng thiết kế | Không cần làm gì |
| Phase 1 — Chưa filter ownership | Single-tenant OK | Khi multi-tenant mới sửa |
| Phase 2 — cache_hit_rate = 0 | Phase 4 sẽ fix | Đợi Phase 4 |
| Phase 2 — Read tools không track latency | Có thể mở rộng | Khi cần debug perf |
| Phase 2 — Chưa có UI dashboard | Có thể mở rộng | Khi cần xem stats qua UI |

---

## Tham khảo nhanh

### Schema mới
- `ai_audit_logs` — security audit cho 68 write tools (user_id, tool_name, args, result, success, duration_ms)
- `ai_telemetry` — cost/perf tracking per conversation (model, rounds, tokens, latency_ms, tool_calls)

### Endpoint admin (mount `/api/ai-stats`, guard `requireAbility('read', 'AuditLog')`)
- `GET /summary?days=7&channel=chat&user_id=...`
- `GET /daily?days=30&channel=chat`
- `GET /tools?days=7`

### Query SQL nhanh
```sql
-- Tin nhắn AI hôm nay tốn bao nhiêu token
SELECT DATE(created_at) AS day, COUNT(*) AS conversations,
       SUM(total_tokens) AS tokens, AVG(latency_ms)::int AS avg_ms
FROM ai_telemetry
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY day ORDER BY day DESC;

-- AI đã làm gì hôm nay
SELECT tool_name, success, user_email, duration_ms, created_at
FROM ai_audit_logs
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC LIMIT 50;
```
