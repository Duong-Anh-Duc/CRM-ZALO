import OpenAI from 'openai';
import { config } from '../../config';
import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import dayjs from 'dayjs';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: 120000,
  maxRetries: 2,
});

export class ChatbotService {
  /**
   * Gather system context: summary stats from all modules
   */
  private static async getSystemContext(): Promise<string> {
    const now = dayjs();
    const monthStart = now.startOf('month').toDate();

    const [
      productCount,
      customerCount,
      supplierCount,
      soStats,
      poStats,
      recSummary,
      paySummary,
      cashIncome,
      cashExpense,
      recentSO,
      recentAlerts,
      overdueRec,
      overduePay,
    ] = await Promise.all([
      prisma.product.count({ where: { is_active: true } }),
      prisma.customer.count({ where: { is_active: true } }),
      prisma.supplier.count({ where: { is_active: true } }),
      prisma.salesOrder.groupBy({ by: ['status'], _count: true }),
      prisma.purchaseOrder.groupBy({ by: ['status'], _count: true }),
      prisma.receivable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true, original_amount: true, paid_amount: true },
        _count: true,
      }),
      prisma.payable.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        _sum: { remaining: true, original_amount: true, paid_amount: true },
        _count: true,
      }),
      prisma.cashTransaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } }),
      prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      prisma.salesOrder.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { order_code: true, grand_total: true, status: true, created_at: true, customer: { select: { company_name: true, contact_name: true } } },
      }),
      prisma.alert.findMany({ where: { is_read: false }, orderBy: { created_at: 'desc' }, take: 5, select: { title: true, type: true, created_at: true } }),
      prisma.receivable.findMany({
        where: { status: 'OVERDUE' },
        take: 10,
        select: { invoice_number: true, remaining: true, due_date: true, customer: { select: { company_name: true, contact_name: true } } },
      }),
      prisma.payable.findMany({
        where: { status: 'OVERDUE' },
        take: 10,
        select: { invoice_number: true, remaining: true, due_date: true, supplier: { select: { company_name: true } } },
      }),
    ]);

    const soStatusStr = soStats.map(s => `${s.status}: ${s._count}`).join(', ');
    const poStatusStr = poStats.map(s => `${s.status}: ${s._count}`).join(', ');

    const recentSOStr = recentSO.map(o =>
      `${o.order_code} | ${o.customer?.company_name || o.customer?.contact_name} | ${Number(o.grand_total).toLocaleString()} VND | ${o.status} | ${dayjs(o.created_at).format('DD/MM/YYYY')}`
    ).join('\n');

    const overdueRecStr = overdueRec.map(r =>
      `${r.invoice_number} | ${r.customer?.company_name || r.customer?.contact_name} | Còn ${Number(r.remaining).toLocaleString()} VND | Hạn ${dayjs(r.due_date).format('DD/MM/YYYY')}`
    ).join('\n');

    const overduePayStr = overduePay.map(p =>
      `${p.invoice_number} | ${p.supplier?.company_name} | Còn ${Number(p.remaining).toLocaleString()} VND | Hạn ${dayjs(p.due_date).format('DD/MM/YYYY')}`
    ).join('\n');

    const alertStr = recentAlerts.map(a => `[${a.type}] ${a.title} (${dayjs(a.created_at).format('DD/MM')})`).join('\n');

    return `
=== DỮ LIỆU HỆ THỐNG PACKFLOW CRM (cập nhật: ${now.format('DD/MM/YYYY HH:mm')}) ===

TỔNG QUAN:
- Sản phẩm: ${productCount}
- Khách hàng: ${customerCount}
- Nhà cung cấp: ${supplierCount}

ĐƠN BÁN HÀNG: ${soStatusStr}
ĐƠN MUA HÀNG: ${poStatusStr}

CÔNG NỢ PHẢI THU (chưa TT):
- Số hoá đơn: ${recSummary._count}
- Tổng gốc: ${Number(recSummary._sum.original_amount || 0).toLocaleString()} VND
- Đã thu: ${Number(recSummary._sum.paid_amount || 0).toLocaleString()} VND
- Còn lại: ${Number(recSummary._sum.remaining || 0).toLocaleString()} VND

CÔNG NỢ PHẢI TRẢ (chưa TT):
- Số hoá đơn: ${paySummary._count}
- Tổng gốc: ${Number(paySummary._sum.original_amount || 0).toLocaleString()} VND
- Đã trả: ${Number(paySummary._sum.paid_amount || 0).toLocaleString()} VND
- Còn lại: ${Number(paySummary._sum.remaining || 0).toLocaleString()} VND

SỔ QUỸ:
- Tổng thu: ${Number(cashIncome._sum.amount || 0).toLocaleString()} VND
- Tổng chi: ${Number(cashExpense._sum.amount || 0).toLocaleString()} VND
- Số dư: ${(Number(cashIncome._sum.amount || 0) - Number(cashExpense._sum.amount || 0)).toLocaleString()} VND

10 ĐƠN BÁN GẦN NHẤT:
${recentSOStr}

CÔNG NỢ QUÁ HẠN (PHẢI THU):
${overdueRecStr || 'Không có'}

CÔNG NỢ QUÁ HẠN (PHẢI TRẢ):
${overduePayStr || 'Không có'}

CẢNH BÁO CHƯA ĐỌC:
${alertStr || 'Không có'}
`.trim();
  }

  /**
   * Query specific data based on user question
   */
  private static async querySpecificData(question: string): Promise<string> {
    const q = question.toLowerCase();
    let extra = '';

    // ── Công nợ phải thu chi tiết ──
    if (q.includes('phải thu') || q.includes('receivable') || (q.includes('công nợ') && !q.includes('phải trả'))) {
      const receivables = await prisma.receivable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { customer: { select: { company_name: true, contact_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      // Group by customer
      const byCustomer = new Map<string, { name: string; total: number; paid: number; remaining: number; count: number; overdue: number }>();
      for (const r of receivables) {
        const name = r.customer?.company_name || r.customer?.contact_name || 'N/A';
        const entry = byCustomer.get(r.customer_id) || { name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        entry.total += Number(r.original_amount);
        entry.paid += Number(r.paid_amount);
        entry.remaining += Number(r.remaining);
        entry.count += 1;
        if (r.status === 'OVERDUE') entry.overdue += 1;
        byCustomer.set(r.customer_id, entry);
      }
      const sorted = Array.from(byCustomer.values()).sort((a, b) => b.remaining - a.remaining);
      extra += '\n\nCHI TIẾT CÔNG NỢ PHẢI THU THEO TỪNG KHÁCH HÀNG:\n';
      sorted.forEach((c, i) => {
        extra += `${i + 1}. ${c.name} | ${c.count} HĐ | Gốc: ${c.total.toLocaleString()} | Đã thu: ${c.paid.toLocaleString()} | Còn: ${c.remaining.toLocaleString()} VND${c.overdue > 0 ? ` | ${c.overdue} quá hạn` : ''}\n`;
      });
    }

    // ── Công nợ phải trả chi tiết ──
    if (q.includes('phải trả') || q.includes('payable') || (q.includes('công nợ') && q.includes('trả'))) {
      const payables = await prisma.payable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { supplier: { select: { company_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const bySupplier = new Map<string, { name: string; total: number; paid: number; remaining: number; count: number; overdue: number }>();
      for (const p of payables) {
        const name = p.supplier?.company_name || 'N/A';
        const entry = bySupplier.get(p.supplier_id) || { name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        entry.total += Number(p.original_amount);
        entry.paid += Number(p.paid_amount);
        entry.remaining += Number(p.remaining);
        entry.count += 1;
        if (p.status === 'OVERDUE') entry.overdue += 1;
        bySupplier.set(p.supplier_id, entry);
      }
      const sorted = Array.from(bySupplier.values()).sort((a, b) => b.remaining - a.remaining);
      extra += '\n\nCHI TIẾT CÔNG NỢ PHẢI TRẢ THEO TỪNG NHÀ CUNG CẤP:\n';
      sorted.forEach((s, i) => {
        extra += `${i + 1}. ${s.name} | ${s.count} HĐ | Gốc: ${s.total.toLocaleString()} | Đã trả: ${s.paid.toLocaleString()} | Còn: ${s.remaining.toLocaleString()} VND${s.overdue > 0 ? ` | ${s.overdue} quá hạn` : ''}\n`;
      });
    }

    // ── Khách hàng chi tiết ──
    if (q.includes('khách') || q.includes('customer')) {
      const customers = await prisma.customer.findMany({
        where: { is_active: true },
        include: {
          _count: { select: { sales_orders: true } },
          receivables: { select: { remaining: true, status: true, original_amount: true, paid_amount: true } },
          sales_orders: { select: { grand_total: true, status: true }, orderBy: { created_at: 'desc' }, take: 5 },
        },
        orderBy: { created_at: 'desc' },
      });
      extra += '\n\nDANH SÁCH KHÁCH HÀNG CHI TIẾT:\n';
      customers.forEach((c, i) => {
        const totalDebt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const totalRevenue = c.sales_orders.reduce((s, o) => s + Number(o.grand_total), 0);
        const overdue = c.receivables.filter(r => r.status === 'OVERDUE').length;
        extra += `${i + 1}. ${c.company_name || c.contact_name} | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | Doanh thu: ${totalRevenue.toLocaleString()} | Nợ còn: ${totalDebt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} quá hạn` : ''}\n`;
      });
    }

    // ── NCC chi tiết ──
    if (q.includes('ncc') || q.includes('nhà cung cấp') || q.includes('supplier')) {
      const suppliers = await prisma.supplier.findMany({
        where: { is_active: true },
        include: {
          _count: { select: { purchase_orders: true } },
          payables: { select: { remaining: true, status: true } },
          supplier_prices: { select: { product: { select: { name: true } } } },
        },
      });
      extra += '\n\nDANH SÁCH NHÀ CUNG CẤP CHI TIẾT:\n';
      suppliers.forEach((s, i) => {
        const totalDebt = s.payables.reduce((sum, p) => sum + Number(p.remaining), 0);
        const overdue = s.payables.filter(p => p.status === 'OVERDUE').length;
        const productNames = s.supplier_prices.slice(0, 3).map(sp => sp.product?.name).filter(Boolean).join(', ');
        extra += `${i + 1}. ${s.company_name} | SĐT: ${s.phone || '-'} | ${s._count.purchase_orders} PO | Nợ còn: ${totalDebt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} quá hạn` : ''} | SP: ${productNames || '-'}\n`;
      });
    }

    // ── Sản phẩm chi tiết ──
    if (q.includes('sản phẩm') || q.includes('sp') || q.includes('product')) {
      const products = await prisma.product.findMany({
        where: { is_active: true },
        select: { sku: true, name: true, retail_price: true, wholesale_price: true, material: true, capacity_ml: true },
      });
      extra += '\n\nDANH SÁCH SẢN PHẨM:\n';
      products.forEach((p, i) => {
        extra += `${i + 1}. ${p.sku} | ${p.name} | ${p.material || '-'} | ${p.capacity_ml ? p.capacity_ml + 'ml' : '-'} | Giá lẻ: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'} | Giá sỉ: ${p.wholesale_price ? Number(p.wholesale_price).toLocaleString() : '-'}\n`;
      });
    }

    // ── Doanh thu / lợi nhuận ──
    if (q.includes('doanh thu') || q.includes('lợi nhuận') || q.includes('revenue') || q.includes('profit') || q.includes('kinh doanh')) {
      const soRevenue = await prisma.salesOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grand_total: true } });
      const poCost = await prisma.purchaseOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } });
      const cashExpense = await prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } });
      const rev = Number(soRevenue._sum.grand_total || 0);
      const cost = Number(poCost._sum.total || 0);
      const opex = Number(cashExpense._sum.amount || 0);
      extra += `\n\nBÁO CÁO TÀI CHÍNH:
• Doanh thu (SO): ${rev.toLocaleString()} VND
• Giá vốn (PO): ${cost.toLocaleString()} VND
• Lợi nhuận gộp: ${(rev - cost).toLocaleString()} VND
• Chi phí vận hành (sổ quỹ chi): ${opex.toLocaleString()} VND
• Lợi nhuận ròng: ${(rev - cost - opex).toLocaleString()} VND\n`;
    }

    // ── Sổ quỹ chi tiết ──
    if (q.includes('sổ quỹ') || q.includes('quỹ') || q.includes('thu chi') || q.includes('cash')) {
      const cats = await prisma.cashCategory.findMany({
        include: { transactions: { select: { amount: true } } },
        orderBy: { type: 'asc' },
      });
      extra += '\n\nSỔ QUỸ CHI TIẾT THEO DANH MỤC:\n';
      cats.forEach(c => {
        const total = c.transactions.reduce((s, t) => s + Number(t.amount), 0);
        if (total > 0) extra += `• [${c.type}] ${c.name}: ${total.toLocaleString()} VND (${c.transactions.length} giao dịch)\n`;
      });
    }

    // ── Đơn hàng chi tiết ──
    if (q.includes('đơn hàng') || q.includes('đơn bán') || q.includes('order')) {
      const recentOrders = await prisma.salesOrder.findMany({
        orderBy: { created_at: 'desc' },
        take: 15,
        include: {
          customer: { select: { company_name: true, contact_name: true } },
          items: { select: { quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } },
        },
      });
      extra += '\n\n15 ĐƠN BÁN GẦN NHẤT (CHI TIẾT SP):\n';
      recentOrders.forEach((o, i) => {
        const custName = o.customer?.company_name || o.customer?.contact_name || '-';
        extra += `${i + 1}. ${o.order_code} | ${custName} | ${Number(o.grand_total).toLocaleString()} VND | ${o.status}\n`;
        o.items.forEach(item => {
          extra += `   └ ${item.product?.sku} ${item.product?.name} x${item.quantity} @ ${Number(item.unit_price).toLocaleString()}\n`;
        });
      });
    }

    // ── Trả hàng ──
    if (q.includes('trả hàng') || q.includes('return')) {
      const salesReturns = await prisma.salesReturn.findMany({
        include: { customer: { select: { company_name: true, contact_name: true } }, sales_order: { select: { order_code: true } }, items: { include: { product: { select: { name: true } } } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
      const purchaseReturns = await prisma.purchaseReturn.findMany({
        include: { supplier: { select: { company_name: true } }, purchase_order: { select: { order_code: true } }, items: { include: { product: { select: { name: true } } } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
      extra += '\n\nTRẢ HÀNG BÁN:\n';
      salesReturns.forEach((r, i) => {
        extra += `${i + 1}. ${r.return_code} | ${r.customer?.company_name || r.customer?.contact_name} | ${r.sales_order?.order_code} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status} | Lý do: ${r.reason || '-'}\n`;
        r.items.forEach(item => extra += `   └ ${item.product?.name} x${item.quantity}\n`);
      });
      extra += '\nTRẢ HÀNG MUA:\n';
      purchaseReturns.forEach((r, i) => {
        extra += `${i + 1}. ${r.return_code} | ${r.supplier?.company_name} | ${r.purchase_order?.order_code} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status} | Lý do: ${r.reason || '-'}\n`;
        r.items.forEach(item => extra += `   └ ${item.product?.name} x${item.quantity}\n`);
      });
    }

    return extra;
  }

  static async chat(question: string, history: Array<{ role: string; content: string }> = []): Promise<string> {
    try {
      const systemContext = await this.getSystemContext();
      const specificData = await this.querySpecificData(question);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Bạn tên là Aura — trợ lý AI thân thiện của hệ thống PackFlow CRM, phần mềm quản lý kinh doanh bao bì nhựa.
Bạn có quyền truy cập toàn bộ dữ liệu hệ thống. Hãy trả lời chính xác dựa trên dữ liệu thực.

Phong cách trả lời:
- Xưng hô: "em" (trợ lý) và "anh" (người dùng). KHÔNG dùng "anh/chị", chỉ dùng "anh"
- Lịch sự, thân thiện như một nhân viên hỗ trợ chuyên nghiệp
- Mở đầu bằng câu chào hoặc xác nhận câu hỏi, VD: "Dạ, em xin báo cáo tình hình công nợ ạ:"
- Kết thúc bằng câu hỏi thêm, VD: "Anh cần em tra cứu thêm gì không ạ?"

Quy tắc format:
- TUYỆT ĐỐI KHÔNG dùng markdown (không **, không ##, không bullet -)
- Liệt kê bằng dấu "•" hoặc xuống dòng rõ ràng
- Số tiền format: xxx.xxx VND (có dấu chấm phân cách)
- Mỗi ý trên 1 dòng riêng, dễ đọc
- Trả lời bằng tiếng Việt
- Nếu không có dữ liệu, nói: "Dạ, hiện tại em chưa tìm thấy dữ liệu về..."

Ví dụ trả lời đúng:
"Dạ, em xin báo cáo tình hình công nợ phải thu ạ:

• Tổng số hoá đơn chưa thanh toán: 64
• Tổng gốc: 432.831.510 VND
• Đã thu: 184.752.930 VND
• Còn lại cần thu: 247.358.580 VND

Anh cần em xem chi tiết khách hàng nào nợ nhiều nhất không ạ?"

${systemContext}
${specificData}`,
        },
        ...history.slice(-10).map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: question },
      ];

      const response = await openai.chat.completions.create({
        model: config.openai.model || 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'Không thể trả lời lúc này.';
    } catch (err) {
      logger.error('Chatbot error:', err);
      return 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
    }
  }
}
