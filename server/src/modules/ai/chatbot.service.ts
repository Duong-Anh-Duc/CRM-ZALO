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

// ── Cache ──
let cachedContext: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

// ── Function definitions for OpenAI ──
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_receivable_details',
      description: 'Lấy chi tiết công nợ phải thu theo từng khách hàng (bao gồm tổng nợ, đã thu, còn lại, quá hạn)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payable_details',
      description: 'Lấy chi tiết công nợ phải trả theo từng nhà cung cấp',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_list',
      description: 'Lấy danh sách khách hàng với thông tin đơn hàng, doanh thu, công nợ',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_list',
      description: 'Lấy danh sách nhà cung cấp với thông tin đơn mua, công nợ, sản phẩm',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_list',
      description: 'Lấy danh sách sản phẩm (SKU, tên, chất liệu, dung tích, giá)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_report',
      description: 'Lấy báo cáo tài chính: doanh thu, giá vốn, lợi nhuận gộp/ròng',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cash_book_details',
      description: 'Lấy chi tiết sổ quỹ theo danh mục thu/chi',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_orders',
      description: 'Lấy danh sách đơn hàng bán gần nhất với chi tiết sản phẩm',
      parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Số đơn cần lấy (mặc định 15)' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_return_details',
      description: 'Lấy danh sách phiếu trả hàng (trả bán + trả mua) gần nhất',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_customer',
      description: 'Tìm kiếm khách hàng theo tên hoặc số điện thoại',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Tên hoặc SĐT khách hàng' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_detail',
      description: 'Lấy chi tiết 1 đơn hàng cụ thể theo mã đơn',
      parameters: { type: 'object', properties: { order_code: { type: 'string', description: 'Mã đơn hàng (VD: SO-20260101-001)' } }, required: ['order_code'] },
    },
  },
];

// ── Tool implementations ──
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'get_receivable_details': {
      const receivables = await prisma.receivable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { customer: { select: { company_name: true, contact_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const byCustomer = new Map<string, any>();
      for (const r of receivables) {
        const name = r.customer?.company_name || r.customer?.contact_name || 'N/A';
        const e = byCustomer.get(r.customer_id) || { name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(r.original_amount); e.paid += Number(r.paid_amount); e.remaining += Number(r.remaining); e.count++; if (r.status === 'OVERDUE') e.overdue++;
        byCustomer.set(r.customer_id, e);
      }
      return Array.from(byCustomer.values()).sort((a, b) => b.remaining - a.remaining)
        .map((c, i) => `${i + 1}. ${c.name} | ${c.count} HĐ | Gốc: ${c.total.toLocaleString()} | Đã thu: ${c.paid.toLocaleString()} | Còn: ${c.remaining.toLocaleString()} VND${c.overdue > 0 ? ` | ${c.overdue} quá hạn` : ''}`)
        .join('\n');
    }
    case 'get_payable_details': {
      const payables = await prisma.payable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { supplier: { select: { company_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const bySupplier = new Map<string, any>();
      for (const p of payables) {
        const name = p.supplier?.company_name || 'N/A';
        const e = bySupplier.get(p.supplier_id) || { name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(p.original_amount); e.paid += Number(p.paid_amount); e.remaining += Number(p.remaining); e.count++; if (p.status === 'OVERDUE') e.overdue++;
        bySupplier.set(p.supplier_id, e);
      }
      return Array.from(bySupplier.values()).sort((a, b) => b.remaining - a.remaining)
        .map((s, i) => `${i + 1}. ${s.name} | ${s.count} HĐ | Gốc: ${s.total.toLocaleString()} | Đã trả: ${s.paid.toLocaleString()} | Còn: ${s.remaining.toLocaleString()} VND${s.overdue > 0 ? ` | ${s.overdue} quá hạn` : ''}`)
        .join('\n');
    }
    case 'get_customer_list': {
      const customers = await prisma.customer.findMany({
        where: { is_active: true },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } }, sales_orders: { select: { grand_total: true }, take: 100 } },
      });
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const rev = c.sales_orders.reduce((s, o) => s + Number(o.grand_total), 0);
        const overdue = c.receivables.filter(r => r.status === 'OVERDUE').length;
        return `${i + 1}. ${c.company_name || c.contact_name} | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | DT: ${rev.toLocaleString()} | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    }
    case 'get_supplier_list': {
      const suppliers = await prisma.supplier.findMany({
        where: { is_active: true },
        include: { _count: { select: { purchase_orders: true } }, payables: { select: { remaining: true, status: true } } },
      });
      return suppliers.map((s, i) => {
        const debt = s.payables.reduce((sum, p) => sum + Number(p.remaining), 0);
        const overdue = s.payables.filter(p => p.status === 'OVERDUE').length;
        return `${i + 1}. ${s.company_name} | SĐT: ${s.phone || '-'} | ${s._count.purchase_orders} PO | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    }
    case 'get_product_list': {
      const products = await prisma.product.findMany({ where: { is_active: true }, select: { sku: true, name: true, retail_price: true, wholesale_price: true, material: true, capacity_ml: true } });
      return products.map((p, i) => `${i + 1}. ${p.sku} | ${p.name} | ${p.material || '-'} | ${p.capacity_ml ? p.capacity_ml + 'ml' : '-'} | Lẻ: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'} | Sỉ: ${p.wholesale_price ? Number(p.wholesale_price).toLocaleString() : '-'}`).join('\n');
    }
    case 'get_financial_report': {
      const [soRev, poCost, cashExp] = await Promise.all([
        prisma.salesOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grand_total: true } }),
        prisma.purchaseOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
        prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      ]);
      const rev = Number(soRev._sum.grand_total || 0), cost = Number(poCost._sum.total || 0), opex = Number(cashExp._sum.amount || 0);
      return `Doanh thu (SO): ${rev.toLocaleString()} VND\nGiá vốn (PO): ${cost.toLocaleString()} VND\nLợi nhuận gộp: ${(rev - cost).toLocaleString()} VND\nChi phí vận hành: ${opex.toLocaleString()} VND\nLợi nhuận ròng: ${(rev - cost - opex).toLocaleString()} VND`;
    }
    case 'get_cash_book_details': {
      const cats = await prisma.cashCategory.findMany({ include: { transactions: { select: { amount: true } } }, orderBy: { type: 'asc' } });
      return cats.filter(c => c.transactions.length > 0).map(c => {
        const total = c.transactions.reduce((s, t) => s + Number(t.amount), 0);
        return `[${c.type}] ${c.name}: ${total.toLocaleString()} VND (${c.transactions.length} GD)`;
      }).join('\n');
    }
    case 'get_recent_orders': {
      const limit = args.limit || 15;
      const orders = await prisma.salesOrder.findMany({
        orderBy: { created_at: 'desc' }, take: limit,
        include: { customer: { select: { company_name: true, contact_name: true } }, items: { select: { quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } } },
      });
      return orders.map((o, i) => {
        const items = o.items.map(it => `  └ ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()}`).join('\n');
        return `${i + 1}. ${o.order_code} | ${o.customer?.company_name || o.customer?.contact_name} | ${Number(o.grand_total).toLocaleString()} VND | ${o.status}\n${items}`;
      }).join('\n');
    }
    case 'get_return_details': {
      const [sr, pr] = await Promise.all([
        prisma.salesReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { customer: { select: { company_name: true, contact_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
        prisma.purchaseReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { supplier: { select: { company_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
      ]);
      let result = 'TRẢ HÀNG BÁN:\n';
      sr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.customer?.company_name || r.customer?.contact_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      result += '\nTRẢ HÀNG MUA:\n';
      pr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.supplier?.company_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      return result;
    }
    case 'search_customer': {
      const q = args.query || '';
      const customers = await prisma.customer.findMany({
        where: { OR: [{ company_name: { contains: q, mode: 'insensitive' } }, { contact_name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } } }, take: 10,
      });
      if (customers.length === 0) return 'Không tìm thấy khách hàng nào.';
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        return `${i + 1}. ${c.company_name || c.contact_name} | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | Nợ: ${debt.toLocaleString()} VND`;
      }).join('\n');
    }
    case 'get_order_detail': {
      const order = await prisma.salesOrder.findFirst({
        where: { order_code: { contains: args.order_code, mode: 'insensitive' } },
        include: { customer: true, items: { include: { product: { select: { name: true, sku: true } } } }, purchase_orders: { include: { supplier: { select: { company_name: true } } } } },
      });
      if (!order) return 'Không tìm thấy đơn hàng.';
      let result = `Mã: ${order.order_code}\nKH: ${order.customer?.company_name || order.customer?.contact_name}\nNgày: ${dayjs(order.order_date).format('DD/MM/YYYY')}\nTổng: ${Number(order.grand_total).toLocaleString()} VND\nTT: ${order.status}\n\nSản phẩm:\n`;
      order.items.forEach(it => { result += `• ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()} = ${Number(it.line_total).toLocaleString()} VND\n`; });
      if (order.purchase_orders.length > 0) {
        result += '\nĐơn mua liên kết:\n';
        order.purchase_orders.forEach(po => { result += `• ${po.order_code} | ${po.supplier?.company_name} | ${Number(po.total).toLocaleString()} VND | ${po.status}\n`; });
      }
      return result;
    }
    default: return 'Không hỗ trợ công cụ này.';
  }
}

export class ChatbotService {
  /**
   * Get system overview context (cached 60s)
   */
  private static async getSystemContext(): Promise<string> {
    if (cachedContext && Date.now() - cacheTime < CACHE_TTL) return cachedContext;

    const now = dayjs();
    const [productCount, customerCount, supplierCount, soStats, poStats, recSummary, paySummary, cashIncome, cashExpense, overdueRec, overduePay] = await Promise.all([
      prisma.product.count({ where: { is_active: true } }),
      prisma.customer.count({ where: { is_active: true } }),
      prisma.supplier.count({ where: { is_active: true } }),
      prisma.salesOrder.groupBy({ by: ['status'], _count: true }),
      prisma.purchaseOrder.groupBy({ by: ['status'], _count: true }),
      prisma.receivable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true, original_amount: true, paid_amount: true }, _count: true }),
      prisma.payable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true, original_amount: true, paid_amount: true }, _count: true }),
      prisma.cashTransaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } }),
      prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      prisma.receivable.count({ where: { status: 'OVERDUE' } }),
      prisma.payable.count({ where: { status: 'OVERDUE' } }),
    ]);

    cachedContext = `
=== DỮ LIỆU PACKFLOW CRM (${now.format('DD/MM/YYYY HH:mm')}) ===
Sản phẩm: ${productCount} | Khách hàng: ${customerCount} | NCC: ${supplierCount}
Đơn bán: ${soStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Đơn mua: ${poStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Phải thu: ${recSummary._count} HĐ, gốc ${Number(recSummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(recSummary._sum.remaining || 0).toLocaleString()} VND (${overdueRec} quá hạn)
Phải trả: ${paySummary._count} HĐ, gốc ${Number(paySummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(paySummary._sum.remaining || 0).toLocaleString()} VND (${overduePay} quá hạn)
Sổ quỹ: Thu ${Number(cashIncome._sum.amount || 0).toLocaleString()}, Chi ${Number(cashExpense._sum.amount || 0).toLocaleString()}, Dư ${(Number(cashIncome._sum.amount || 0) - Number(cashExpense._sum.amount || 0)).toLocaleString()} VND
`.trim();
    cacheTime = Date.now();
    return cachedContext;
  }

  /**
   * Chat with function calling + streaming
   */
  static async *chatStream(question: string, history: Array<{ role: string; content: string }> = []): AsyncGenerator<string> {
    try {
      const systemContext = await this.getSystemContext();

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Bạn tên là Aura — trợ lý AI của PackFlow CRM (quản lý kinh doanh bao bì nhựa).
Xưng "em", gọi user "anh". Lịch sự, chuyên nghiệp.

Format: KHÔNG markdown (**, ##, -). Dùng "•" liệt kê. Số tiền: xxx.xxx VND.
Mở đầu bằng "Dạ,...", kết thúc hỏi thêm.
Nếu cần dữ liệu chi tiết, hãy GỌI FUNCTION tương ứng thay vì đoán.
Nếu user hỏi về KH/NCC cụ thể, dùng search_customer.
Nếu user hỏi về đơn hàng cụ thể, dùng get_order_detail.

Khi trả lời, nếu có thể điều hướng user đến trang liên quan, thêm dòng cuối dạng:
[action:/đường-dẫn|Tên nút]
VD: [action:/receivables/customer/abc123|Xem chi tiết KH]

Ngày hôm nay: ${dayjs().format('DD/MM/YYYY')}

${systemContext}`,
        },
        ...history.slice(-10).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: question },
      ];

      // First call with tools
      const response = await openai.chat.completions.create({
        model: config.openai.model || 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1500,
      });

      const choice = response.choices[0];

      // If tool calls needed
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        messages.push(choice.message);

        for (const tc of choice.message.tool_calls) {
          const fn = (tc as any).function;
          const args = JSON.parse(fn.arguments || '{}');
          const result = await executeTool(fn.name, args);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        // Second call with tool results — stream response
        const stream = await openai.chat.completions.create({
          model: config.openai.model || 'gpt-4o-mini',
          messages,
          temperature: 0.3,
          max_tokens: 1500,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      } else {
        // No tool calls — stream directly
        // Re-do with streaming
        const stream = await openai.chat.completions.create({
          model: config.openai.model || 'gpt-4o-mini',
          messages,
          temperature: 0.3,
          max_tokens: 1500,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    } catch (err) {
      logger.error('Chatbot error:', err);
      yield 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
    }
  }

  /**
   * Non-streaming fallback
   */
  static async chat(question: string, history: Array<{ role: string; content: string }> = []): Promise<string> {
    let result = '';
    for await (const chunk of this.chatStream(question, history)) {
      result += chunk;
    }
    return result;
  }
}
