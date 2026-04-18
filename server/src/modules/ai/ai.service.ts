import OpenAI from 'openai';
import { config } from '../../config';
import { t } from '../../locales';
import logger from '../../utils/logger';
import prisma from '../../lib/prisma';
import { AiTrainingService } from './ai-training.service';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: 120000, // 2 phút — OpenClaw chậm hơn OpenAI
  maxRetries: 2,
});

async function getCustomPrompts() {
  try {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    return {
      chat: cfg?.ai_chat_prompt || null,
      summary: cfg?.ai_summary_prompt || null,
      order: cfg?.ai_order_prompt || null,
    };
  } catch {
    return { chat: null, summary: null, order: null };
  }
}

export interface ExtractedOrderItem {
  product_name: string;
  quantity: number;
  unit_price?: number;
  note?: string;
}

export interface ExtractedOrder {
  is_order: boolean;
  customer_name?: string;
  customer_phone?: string;
  items: ExtractedOrderItem[];
  delivery_note?: string;
  raw_summary?: string;
}

const CHAT_SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh cho hệ thống CRM bao bì nhựa PackFlow.
Bạn có khả năng đọc và phân tích tin nhắn Zalo từ khách hàng.

Nhiệm vụ:
- Trả lời câu hỏi của nhân viên về tin nhắn Zalo gần đây
- Tóm tắt nội dung tin nhắn, phát hiện đơn hàng tiềm năng
- Phân tích xu hướng, khách hàng nào đang quan tâm sản phẩm gì
- Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng
- Nếu được hỏi về đơn hàng, liệt kê rõ: tên khách, sản phẩm, số lượng
- Format đẹp với bullet points khi cần

QUAN TRỌNG:
- Mỗi tin nhắn có kèm ngày giờ. Khi người dùng hỏi "hôm nay" → CHỈ phân tích tin nhắn có ngày trùng với ngày hiện tại.
- Khi hỏi "tuần này" → chỉ lấy tin trong 7 ngày gần nhất.
- KHÔNG trộn lẫn tin nhắn cũ với tin nhắn mới. Phân biệt rõ thời gian.
- Nếu không có tin nhắn nào trong khoảng thời gian được hỏi, hãy nói rõ.

BUSINESS MODEL:
- Công ty là TRUNG GIAN giữa khách hàng và nhà cung cấp (NCC), KHÔNG tự sản xuất.
- Khi khách hỏi mua → phải kiểm tra: sản phẩm có trong hệ thống không? NCC nào cung cấp? Giá bao nhiêu? Còn hàng không?
- Bạn được cung cấp danh sách SẢN PHẨM, NHÀ CUNG CẤP (kèm giá, MOQ, lead time), và KHÁCH HÀNG trong hệ thống.
- Khi phát hiện đơn hàng tiềm năng, phải trả lời: sản phẩm đã có chưa, NCC nào có hàng, giá NCC bao nhiêu, thời gian giao.
- Nếu sản phẩm CHƯA có trong hệ thống hoặc CHƯA có NCC → cảnh báo rõ.

QUY TẮC TÓM TẮT:
- Khi tóm tắt tin nhắn, PHẢI nhóm theo từng người (từng khách hàng/người gửi).
- Format: liệt kê tên người → bên dưới là tất cả nội dung của người đó.
- KHÔNG xen kẽ tin nhắn giữa các người với nhau.

PHONG CÁCH TRẢ LỜI:
- Bạn là trợ lý AI chuyên nghiệp, xưng "em", gọi người dùng là "anh".
- Trả lời ngắn gọn, đi thẳng vào vấn đề.
- TUYỆT ĐỐI KHÔNG dùng markdown: không bold, không heading, không code block, không italic.
- Trình bày dạng plain text sạch sẽ, dễ đọc.
- Dùng dấu gạch ngang (-) cho danh sách.
- Tên người/công ty viết bình thường, không bold.
- Dùng dấu ngoặc kép "" khi trích dẫn.
- Số liệu viết rõ ràng: "500 cái", "2.200đ/cái".
- Khi báo cáo tình trạng, dùng từ ngữ rõ ràng: "Có", "Chưa có", "Đã tạo", "Chưa tạo".
- Kết thúc bằng câu hỏi hoặc gợi ý hành động cụ thể nếu cần.

Ví dụ cách trả lời đúng:

Anh ơi, hiện tại hệ thống ghi nhận:

Khách hàng: Trần Trung Kiên (Công ty TNHH TECHLA AI)
  - Đặt 500 chai PET 500ml
  - Đặt 300 nắp PCO28
  - Yêu cầu giao tuần sau

Kiểm tra sản phẩm:
  - Chai PET 500ml: Có trong hệ thống, NCC Nhựa Sài Gòn còn 5.000 cái, giá 2.200đ
  - Nắp PCO28: Có trong hệ thống, NCC Nhựa Sài Gòn còn 10.000 cái, giá 400đ

Trạng thái đơn hàng: Chưa tạo đơn bán và đơn mua.

Anh có muốn em tạo đơn bán và đơn mua cho đơn hàng này không?

HÀNH ĐỘNG (ACTIONS):
Khi người dùng yêu cầu, thêm block JSON vào CUỐI câu trả lời:

<!--ACTIONS
[{"type": "action_type", "data": {...}}]
ACTIONS-->

DANH SACH ACTIONS:

-- KHACH HANG --
create_customer: {"company_name","contact_name","phone","email","tax_code","address","customer_type":"INDIVIDUAL/BUSINESS"}
update_customer: {"customer_name":"tên hiện tại","updates":{"company_name","contact_name","phone","email","tax_code","address","customer_type","debt_limit"}}
delete_customer: {"customer_name":"tên KH"}

QUY TAC PHAN BIET KHACH HANG:
- INDIVIDUAL (Ca nhan): Chi co ten nguoi, khong co ten cong ty, khong co MST. VD: "Nguyen Van A", "anh Tung"
- BUSINESS (Doanh nghiep): Co ten cong ty/co so/cua hang, co the co MST. VD: "Cong ty TNHH ABC", "Co so Hoa Phat"
Khi tao khach hang, neu chi co ten nguoi → INDIVIDUAL, neu co "cong ty", "co so", "cua hang" → BUSINESS

-- NHA CUNG CAP --
create_supplier: {"company_name","contact_name","phone","email","tax_code","address","payment_terms":"NET_30/NET_60/NET_90/IMMEDIATE"}
update_supplier: {"supplier_name":"tên hiện tại","updates":{"company_name","contact_name","phone","email","tax_code","address","payment_terms"}}

-- DON BAN HANG (tao ra status DRAFT) --
create_sales_order: {"customer_name","vat_rate":"VAT_10","delivery_date":"YYYY-MM-DD","notes","items":[{"product_name","quantity","unit_price","supplier_name":"ten NCC (tu tim trong context, uu tien NCC co ⭐)"}]}
update_sales_order: {"order_code":"SO-xxx","updates":{"notes","expected_delivery":"YYYY-MM-DD"}}
update_order_status: {"order_code":"SO-xxx hoac PO-xxx","status":"DRAFT/CONFIRMED/SHIPPING/COMPLETED/CANCELLED"}

QUY TAC MATCH NCC KHI TAO DON:
- Moi san pham PHAI co NCC. Doc danh sach NCC trong context, tim NCC co san pham do.
- Uu tien NCC co dau ⭐ (is_preferred).
- Neu nhieu NCC co cung SP → chon NCC co gia thap nhat hoac NCC ⭐.
- Neu khong tim thay NCC nao co SP do → BAO CHO USER, khong tao don.

-- DON MUA HANG (tao ra status PENDING) --
create_purchase_order: {"supplier_name","delivery_date":"YYYY-MM-DD","notes","items":[{"product_name","quantity","unit_price"}]}
update_purchase_order: {"order_code":"PO-xxx","updates":{"notes","expected_delivery":"YYYY-MM-DD"}}

-- HOA DON --
create_invoice: {"order_code":"SO-xxx"}
finalize_invoice: {"order_code":"SO-xxx"}

-- THANH TOAN / CONG NO --
record_payment: {"type":"receivable/payable","order_code":"SO-xxx hoac PO-xxx","amount":1000000,"method":"CASH/BANK_TRANSFER","reference":"so tham chieu"}
mark_debt_paid: {"type":"receivable/payable","order_code":"SO-xxx hoac PO-xxx"} (danh dau da thanh toan het)

-- SAN PHAM --
create_product: {"name","sku","category_name","material":"PET/HDPE/PP","retail_price","moq","description"}
update_product: {"product_name":"tên hiện tại","updates":{"retail_price","moq","description"}}

-- GIA NCC --
update_supplier_price: {"supplier_name","product_name","updates":{"purchase_price","moq","lead_time_days","stock_quantity"}}

-- CAP NHAT TRANG THAI DON MUA --
update_po_status: {"order_code":"PO-xxx","status":"CONFIRMED/INVOICED/COMPLETED","note":"NCC xác nhận/giao hàng"}

-- CANH BAO --
create_alert: {"type":"STOCK_OUT/PRICE_CHANGE/DELIVERY_DELAY","title":"tiêu đề","message":"chi tiết","related_entity":"PO-xxx hoặc tên NCC"}

-- BAO CAO --
get_report: {"type":"pnl/debt_aging/product_sales","from_date":"YYYY-MM-DD","to_date":"YYYY-MM-DD"}

LUU Y: Thong tin san pham, NCC, khach hang, don hang, hoa don da co san trong context. KHONG can tao action de "get" hay "check" — chi can doc context va tra loi.

XU LY TIN NHAN TU NHA CUNG CAP (NCC):
Trong phần PHÂN LOẠI NGƯỜI GỬI ZALO, nếu người gửi được đánh dấu "NHÀ CUNG CẤP":
- NCC nhắn về giao hàng ("đã giao", "đã ship", "đang giao", "giao xong") → gợi ý update_po_status sang COMPLETED hoặc SHIPPING
- NCC xác nhận đơn ("xác nhận đơn", "nhận đơn", "ok đơn") → gợi ý update_po_status sang CONFIRMED
- NCC báo giá mới ("giá mới", "tăng giá", "giảm giá", "báo giá") → gợi ý update_supplier_price
- NCC báo hết hàng ("hết hàng", "không còn", "hết rồi", "tạm hết") → gợi ý create_alert type STOCK_OUT
- NCC báo giao trễ ("giao trễ", "chậm giao", "lùi lịch") → gợi ý create_alert type DELIVERY_DELAY
Luôn HỎI xác nhận trước khi thực hiện action, trừ khi người dùng yêu cầu trực tiếp.

QUY TẮC TUYỆT ĐỐI VỀ ACTIONS:
- KHÔNG BAO GIỜ tự thêm actions block nếu người dùng CHƯA XÁC NHẬN.
- Khi phát hiện đơn hàng tiềm năng → CHỈ BÁO CÁO thông tin + HỎI "anh có muốn em tạo không?" → DỪNG, KHÔNG thêm actions.
- CHỈ thêm actions block khi người dùng trả lời RÕ RÀNG: "tạo đi", "ok tạo", "làm đi", "có", "tạo khách hàng", "tạo đơn hàng".
- Nếu người dùng chỉ hỏi thông tin (ví dụ: "có đơn hàng nào chưa?", "kiểm tra giúp") → KHÔNG thêm actions, chỉ trả lời text.
- Nếu thiếu thông tin → HỎI LẠI, không đoán.
- Actions block luôn ở CUỐI câu trả lời, sau phần text.`;


const SUMMARY_SYSTEM_PROMPT = `Bạn là trợ lý AI phân tích tin nhắn Zalo cho CRM bao bì nhựa.

Nhiệm vụ: Tóm tắt tin nhắn Zalo gần đây và phát hiện:
1. **Đơn hàng mới**: Tin nhắn đặt hàng (tên SP, số lượng, khách hàng)
2. **Yêu cầu báo giá**: Khách hỏi giá sản phẩm
3. **Khiếu nại/Vấn đề**: Phản hồi tiêu cực, khiếu nại
4. **Tin nhắn quan trọng**: Cần phản hồi gấp

Trả về JSON:
{
  "summary": "tóm tắt tổng quan ngắn gọn",
  "potential_orders": [{ "customer": "tên", "products": "SP", "quantity": "SL", "message": "nội dung gốc" }],
  "quote_requests": [{ "customer": "tên", "products": "SP hỏi giá", "message": "nội dung gốc" }],
  "issues": [{ "customer": "tên", "issue": "mô tả vấn đề", "message": "nội dung gốc" }],
  "needs_reply": [{ "customer": "tên", "reason": "lý do cần trả lời", "message": "nội dung gốc" }],
  "stats": { "total_messages": 0, "incoming": 0, "outgoing": 0 }
}`;

const SYSTEM_PROMPT = `Bạn là trợ lý AI chuyên phân tích tin nhắn Zalo để trích xuất thông tin đơn hàng cho công ty bao bì nhựa.

Nhiệm vụ: Đọc TOÀN BỘ cuộc hội thoại (nhiều tin nhắn) và xác định xem khách hàng có đặt hàng không. Nếu có, trích xuất và GỘP thông tin đơn hàng từ TẤT CẢ tin nhắn.

Quy tắc:
1. Tin nhắn đặt hàng thường chứa: tên sản phẩm, số lượng, đôi khi có giá và ghi chú giao hàng
2. Tin nhắn hỏi thăm, chào hỏi, hỏi giá (chưa đặt) → is_order = false
3. Số lượng có thể viết: "1000 cái", "5 thùng", "2k" (=2000), "500c" (=500 cái)
4. Tên sản phẩm có thể viết tắt hoặc không chính xác, hãy giữ nguyên
5. Nếu tin nhắn nhắc đến nhiều sản phẩm, tách thành nhiều items

GỘP ĐƠN HÀNG TỪ NHIỀU TIN NHẮN:
6. Nếu khách nhắn thêm sản phẩm ở tin nhắn sau ("thêm 200 nắp nữa nhé"), GỘP vào cùng 1 đơn hàng
7. Nếu khách SỬA số lượng ("không, 1000 cái chứ không phải 500"), dùng số lượng MỚI NHẤT
8. Ghi chú giao hàng có thể xuất hiện ở BẤT KỲ tin nhắn nào trong cuộc hội thoại
9. Chỉ xét các tin nhắn INCOMING (← từ khách hàng), bỏ qua tin nhắn OUTGOING (→ từ shop)
10. Tin nhắn mới nhất có độ ưu tiên cao hơn nếu có mâu thuẫn

Trả về JSON duy nhất, không giải thích thêm:
{
  "is_order": true/false,
  "customer_name": "tên khách nếu có",
  "customer_phone": "SĐT nếu có",
  "items": [
    { "product_name": "tên SP", "quantity": 1000, "unit_price": null, "note": "ghi chú nếu có" }
  ],
  "delivery_note": "ghi chú giao hàng nếu có",
  "raw_summary": "tóm tắt ngắn gọn nội dung đơn hàng đã gộp"
}`;

// ──── Message compression helpers ────

type MsgRow = { sender_name: string | null; content: string | null; direction: string; created_at: Date };

function isNoise(content: string): boolean {
  if (!content || content.length < 2) return true;
  const c = content.trim().toLowerCase();
  // Attachments, stickers, empty
  if (c === '[attach]' || c.startsWith('[^') || c === '[sticker]') return true;
  // OTP / verification
  if (/mã (xác thực|otp|xác nhận)/i.test(c)) return true;
  if (/\b\d{4,6}\b/.test(c) && c.length < 30) return true;
  // Spam / ads
  if (/voucher|khuyến mại|ưu đãi|nạp thẻ|vay nhanh|tặng riêng/i.test(c) && c.length > 50) return true;
  return false;
}

function compressMessages(messages: MsgRow[]): string {
  // Filter noise
  const clean = messages.filter((m) => !isNoise(m.content || ''));

  // Compact format: "HH:mm Tên: nội dung" (no date if same day, no direction label)
  let lastDate = '';
  const lines: string[] = [];

  for (const m of clean) {
    const d = new Date(m.created_at);
    const date = d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const time = d.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const name = m.sender_name || (m.direction === 'OUTGOING' ? 'Tôi' : '?');
    const content = (m.content || '').substring(0, 200); // truncate long messages

    if (date !== lastDate) {
      lines.push(`--- ${date} ---`);
      lastDate = date;
    }
    const dir = m.direction === 'OUTGOING' ? '→' : '←';
    lines.push(`${time} ${dir} ${name}: ${content}`);
  }

  return lines.join('\n');
}

// Build product + supplier context for AI
async function buildBusinessContext(messageHints?: string[]): Promise<string> {
  try {
    // Smart loading: load all SP + NCC prices (compact), but limit KH + orders
    const [products, supplierPrices] = await Promise.all([
      prisma.product.findMany({
        where: { is_active: true },
        select: { id: true, name: true, sku: true, retail_price: true },
        take: 100,
      }),
      prisma.supplierPrice.findMany({
        where: { supplier: { is_active: true } },
        include: {
          supplier: { select: { company_name: true, phone: true, is_active: true } },
          product: { select: { name: true, sku: true } },
        },
      }),
    ]);

    // KH: top 30 gần đây (có đơn hàng) + tất cả có zalo_user_id
    const customers = await prisma.customer.findMany({
      where: { is_active: true },
      select: { company_name: true, contact_name: true, phone: true, zalo_user_id: true },
      orderBy: { updated_at: 'desc' },
      take: 50,
    });

    const lines: string[] = [];

    // Products — compact: 1 line per product with NCC inline
    lines.push(`\n--- SP (${products.length}) ---`);
    for (const p of products) {
      const sp = supplierPrices.filter((s) => s.product?.sku === p.sku && s.supplier?.is_active);
      const nccInfo = sp.map((s) => `${s.supplier.company_name}:${s.purchase_price}đ${s.is_preferred ? '⭐' : ''}`).join(', ');
      lines.push(`${p.sku}|${p.name}|giá tk:${p.retail_price||'-'}|NCC:[${nccInfo || 'chưa có'}]`);
    }

    // Customers — compact
    lines.push(`\n--- KH (${customers.length}) ---`);
    for (const c of customers) {
      lines.push(`${c.company_name || c.contact_name}|${c.phone || '-'}${c.zalo_user_id ? '|Zalo✓' : ''}`);
    }

    // Thread classification for recent Zalo senders
    const recentSenders = await prisma.zaloMessage.findMany({
      where: { direction: 'INCOMING', msg_type: { not: 'control' }, group_id: null },
      distinct: ['sender_id'],
      orderBy: { created_at: 'desc' },
      select: { sender_id: true, sender_name: true },
      take: 50,
    });

    if (recentSenders.length > 0) {
      const suppliers = await prisma.supplier.findMany({
        where: { is_active: true },
        select: { company_name: true, zalo_user_id: true },
      });

      const customerZaloMap = new Map(customers.filter((c) => c.zalo_user_id).map((c) => [c.zalo_user_id!, `KHÁCH HÀNG: ${c.company_name}`]));
      const supplierZaloMap = new Map(suppliers.filter((s) => s.zalo_user_id).map((s) => [s.zalo_user_id!, `NHÀ CUNG CẤP: ${s.company_name}`]));

      const classifiedLines: string[] = [];
      for (const s of recentSenders) {
        if (!s.sender_id) continue;
        const label = customerZaloMap.get(s.sender_id) || supplierZaloMap.get(s.sender_id) || 'CHƯA XÁC ĐỊNH';
        classifiedLines.push(`- ${s.sender_name || s.sender_id}: ${label}`);
      }

      if (classifiedLines.length > 0) {
        lines.push(`\n--- PHÂN LOẠI NGƯỜI GỬI ZALO (${classifiedLines.length}) ---`);
        lines.push(...classifiedLines);
      }
    }

    // Recent orders (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [salesOrders, purchaseOrders, pendingSuggestions] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { created_at: { gte: since } },
        include: {
          customer: { select: { company_name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.purchaseOrder.findMany({
        where: { created_at: { gte: since } },
        include: {
          supplier: { select: { company_name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.orderSuggestion.findMany({
        where: { status: 'PENDING' },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Orders — compact: chỉ 10 đơn gần nhất mỗi loại
    if (salesOrders.length > 0) {
      lines.push(`\n--- SO gần đây (${salesOrders.length}) ---`);
      for (const o of salesOrders.slice(0, 10)) {
        const items = o.items.map((i: any) => `${i.product?.name}x${i.quantity}`).join('+');
        lines.push(`${o.order_code}|${o.customer?.company_name}|${o.status}|${items}|${o.grand_total.toLocaleString()}đ`);
      }
    }
    if (purchaseOrders.length > 0) {
      lines.push(`\n--- PO gần đây (${purchaseOrders.length}) ---`);
      for (const o of purchaseOrders.slice(0, 10)) {
        const items = o.items.map((i: any) => `${i.product?.name}x${i.quantity}`).join('+');
        lines.push(`${o.order_code}|${o.supplier?.company_name}|${o.status}|${items}|${o.total.toLocaleString()}đ`);
      }
    }

    if (pendingSuggestions.length > 0) {
      lines.push(`\n--- ĐỀ XUẤT ĐƠN HÀNG CHỜ DUYỆT (${pendingSuggestions.length}) ---`);
      for (const s of pendingSuggestions) {
        const items = ((s.matched_items || []) as any[]).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ');
        lines.push(`- Từ: ${s.sender_name} | KH: ${s.customer_name} | SP: ${items || 'chưa khớp'}`);
      }
    }

    // Debts — summary only (save tokens)
    const [recAgg, payAgg] = await Promise.all([
      prisma.receivable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true }, _count: true }),
      prisma.payable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true }, _count: true }),
    ]);
    const recOverdue = await prisma.receivable.count({ where: { status: 'OVERDUE' } });
    const payOverdue = await prisma.payable.count({ where: { status: 'OVERDUE' } });
    lines.push(`\n--- CÔNG NỢ ---`);
    lines.push(`Phải thu: ${recAgg._count} khoản, còn ${(recAgg._sum.remaining || 0).toLocaleString()}đ, quá hạn ${recOverdue}`);
    lines.push(`Phải trả: ${payAgg._count} khoản, còn ${(payAgg._sum.remaining || 0).toLocaleString()}đ, quá hạn ${payOverdue}`);

    return lines.join('\n');
  } catch (err) {
    logger.error('Build business context error:', err);
    return '';
  }
}

export class AIService {
  static getDefaultPrompts() {
    return {
      ai_chat_prompt: CHAT_SYSTEM_PROMPT,
      ai_summary_prompt: SUMMARY_SYSTEM_PROMPT,
      ai_order_prompt: SYSTEM_PROMPT,
    };
  }

  static async extractOrderFromMessage(
    message: string,
    productList: string[],
    threadMessages?: Array<{ sender_name: string | null; content: string | null; direction: string; created_at: Date }>,
  ): Promise<ExtractedOrder> {
    try {
      if (!config.openai.apiKey) {
        logger.warn('OpenAI API key not configured, skipping AI extraction');
        return { is_order: false, items: [], raw_summary: t('ai.apiKeyNotSet') };
      }

      const customPrompts = await getCustomPrompts();
      const orderPrompt = customPrompts.order || SYSTEM_PROMPT;
      const trainingContext = await AiTrainingService.buildTrainingContext();

      const productContext = productList.length > 0
        ? `\n\nDanh sách sản phẩm hiện có:\n${productList.join('\n')}`
        : '';

      // Build user content: full thread context if available, otherwise single message
      let userContent: string;
      if (threadMessages && threadMessages.length > 0) {
        const threadContext = compressMessages(threadMessages);
        userContent = `Cuộc hội thoại gần đây (tin nhắn cũ → mới):\n\n${threadContext}\n\nTin nhắn mới nhất cần phân tích:\n${message}`;
      } else {
        userContent = message;
      }

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: orderPrompt + trainingContext + productContext },
          { role: 'user', content: userContent },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { is_order: false, items: [], raw_summary: t('ai.emptyResponse') };
      }

      const parsed = JSON.parse(content) as ExtractedOrder;
      logger.info('AI order extraction result:', { is_order: parsed.is_order, items_count: parsed.items?.length });
      return parsed;
    } catch (err: any) {
      logger.error('AI extraction error:', err.message);
      return { is_order: false, items: [], raw_summary: `${t('ai.error')}: ${err.message}` };
    }
  }

  /**
   * Chat with AI about Zalo messages. User asks a question, AI answers based on message context.
   */
  static async chatAboutMessages(
    question: string,
    messages: Array<{ sender_name: string | null; content: string | null; direction: string; created_at: Date }>,
  ): Promise<string> {
    try {
      if (!config.openai.apiKey) return t('ai.apiKeyNotConfigured');

      const customPrompts = await getCustomPrompts();
      const systemPrompt = customPrompts.chat || CHAT_SYSTEM_PROMPT;
      const [trainingContext, businessContext] = await Promise.all([
        AiTrainingService.buildTrainingContext(),
        buildBusinessContext(),
      ]);

      const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      const msgContext = compressMessages(messages);

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt + trainingContext + businessContext + `\n\nNgày giờ hiện tại: ${now}\nHôm nay là: ${today}\n\n--- TIN NHẮN ZALO ---\n${msgContext}\n--- HẾT ---` },
          { role: 'user', content: question },
        ],
      });

      return response.choices[0]?.message?.content || t('ai.noResponse');
    } catch (err: any) {
      logger.error('AI chat error:', err.message);
      return `${t('ai.error')}: ${err.message}`;
    }
  }

  /**
   * Auto-summarize recent Zalo messages: detect orders, issues, quote requests.
   */
  static async summarizeMessages(
    messages: Array<{ sender_name: string | null; content: string | null; direction: string; created_at: Date }>,
  ): Promise<Record<string, unknown>> {
    try {
      if (!config.openai.apiKey) return { error: t('ai.apiKeyNotConfigured') };

      const customPrompts = await getCustomPrompts();
      const summaryPrompt = customPrompts.summary || SUMMARY_SYSTEM_PROMPT;
      const trainingContext = await AiTrainingService.buildTrainingContext();

      const msgContext = compressMessages(messages);

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: summaryPrompt + trainingContext },
          { role: 'user', content: `Phân tích ${messages.length} tin nhắn Zalo sau:\n\n${msgContext}` },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { error: t('ai.noResponse') };
      return JSON.parse(content);
    } catch (err: any) {
      logger.error('AI summary error:', err.message);
      return { error: `${t('ai.error')}: ${err.message}` };
    }
  }
}
