import dayjs from 'dayjs';
import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const queryTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_receivable_details',
        description: 'Lấy chi tiết công nợ phải thu theo từng khách hàng (bao gồm tổng nợ, đã thu, còn lại, quá hạn)',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const receivables = await prisma.receivable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { customer: { select: { company_name: true, contact_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const byCustomer = new Map<string, any>();
      for (const r of receivables) {
        const name = r.customer?.company_name || r.customer?.contact_name || 'N/A';
        const e = byCustomer.get(r.customer_id) || { id: r.customer_id, name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(r.original_amount); e.paid += Number(r.paid_amount); e.remaining += Number(r.remaining); e.count++; if (r.status === 'OVERDUE') e.overdue++;
        byCustomer.set(r.customer_id, e);
      }
      return Array.from(byCustomer.values()).sort((a, b) => b.remaining - a.remaining)
        .map((c, i) => `${i + 1}. ${c.name} [id:${c.id}] | ${c.count} HĐ | Gốc: ${c.total.toLocaleString()} | Đã thu: ${c.paid.toLocaleString()} | Còn: ${c.remaining.toLocaleString()} VND${c.overdue > 0 ? ` | ${c.overdue} quá hạn` : ''}`)
        .join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_payable_details',
        description: 'Lấy chi tiết công nợ phải trả theo từng nhà cung cấp',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const payables = await prisma.payable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { supplier: { select: { company_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const bySupplier = new Map<string, any>();
      for (const p of payables) {
        const name = p.supplier?.company_name || 'N/A';
        const e = bySupplier.get(p.supplier_id) || { id: p.supplier_id, name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(p.original_amount); e.paid += Number(p.paid_amount); e.remaining += Number(p.remaining); e.count++; if (p.status === 'OVERDUE') e.overdue++;
        bySupplier.set(p.supplier_id, e);
      }
      return Array.from(bySupplier.values()).sort((a, b) => b.remaining - a.remaining)
        .map((s, i) => `${i + 1}. ${s.name} [id:${s.id}] | ${s.count} HĐ | Gốc: ${s.total.toLocaleString()} | Đã trả: ${s.paid.toLocaleString()} | Còn: ${s.remaining.toLocaleString()} VND${s.overdue > 0 ? ` | ${s.overdue} quá hạn` : ''}`)
        .join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_customer_list',
        description: 'Lấy danh sách khách hàng với thông tin đơn hàng, doanh thu, công nợ',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const customers = await prisma.customer.findMany({
        where: { is_active: true },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } }, sales_orders: { select: { grand_total: true }, take: 100 } },
      });
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const rev = c.sales_orders.reduce((s, o) => s + Number(o.grand_total), 0);
        const overdue = c.receivables.filter((r) => r.status === 'OVERDUE').length;
        return `${i + 1}. ${c.company_name || c.contact_name} [id:${c.id}] | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | DT: ${rev.toLocaleString()} | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_supplier_list',
        description: 'Lấy danh sách nhà cung cấp với thông tin đơn mua, công nợ, sản phẩm',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const suppliers = await prisma.supplier.findMany({
        where: { is_active: true },
        include: { _count: { select: { purchase_orders: true } }, payables: { select: { remaining: true, status: true } } },
      });
      return suppliers.map((s, i) => {
        const debt = s.payables.reduce((sum, p) => sum + Number(p.remaining), 0);
        const overdue = s.payables.filter((p) => p.status === 'OVERDUE').length;
        return `${i + 1}. ${s.company_name} [id:${s.id}] | SĐT: ${s.phone || '-'} | ${s._count.purchase_orders} PO | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_product_list',
        description: 'Lấy danh sách sản phẩm (SKU, tên, chất liệu, dung tích, giá)',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const products = await prisma.product.findMany({ where: { is_active: true }, select: { sku: true, name: true, retail_price: true, material: true, capacity_ml: true } });
      return products.map((p, i) => `${i + 1}. ${p.sku} | ${p.name} | ${p.material || '-'} | ${p.capacity_ml ? p.capacity_ml + 'ml' : '-'} | Giá tham khảo: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'}`).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_financial_report',
        description: 'Lấy báo cáo tài chính: doanh thu, giá vốn, lợi nhuận gộp/ròng',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const [soRev, poCost, cashExp] = await Promise.all([
        prisma.salesOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grand_total: true } }),
        prisma.purchaseOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
        prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      ]);
      const rev = Number(soRev._sum.grand_total || 0), cost = Number(poCost._sum.total || 0), opex = Number(cashExp._sum.amount || 0);
      return `Doanh thu (SO): ${rev.toLocaleString()} VND\nGiá vốn (PO): ${cost.toLocaleString()} VND\nLợi nhuận gộp: ${(rev - cost).toLocaleString()} VND\nChi phí vận hành: ${opex.toLocaleString()} VND\nLợi nhuận ròng: ${(rev - cost - opex).toLocaleString()} VND`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_cash_book_details',
        description: 'Lấy chi tiết sổ quỹ theo danh mục thu/chi',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const cats = await prisma.cashCategory.findMany({ include: { transactions: { select: { amount: true } } }, orderBy: { type: 'asc' } });
      return cats.filter((c) => c.transactions.length > 0).map((c) => {
        const total = c.transactions.reduce((s, t) => s + Number(t.amount), 0);
        return `[${c.type}] ${c.name}: ${total.toLocaleString()} VND (${c.transactions.length} GD)`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_recent_orders',
        description: 'Lấy danh sách đơn hàng bán gần nhất với chi tiết sản phẩm',
        parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Số đơn cần lấy (mặc định 15)' } }, required: [] },
      },
    },
    handler: async (args) => {
      const limit = args.limit || 15;
      const orders = await prisma.salesOrder.findMany({
        orderBy: { created_at: 'desc' }, take: limit,
        include: { customer: { select: { company_name: true, contact_name: true } }, items: { select: { quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } } },
      });
      return orders.map((o, i) => {
        const items = o.items.map((it) => `  └ ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()}`).join('\n');
        return `${i + 1}. ${o.order_code} | ${o.customer?.company_name || o.customer?.contact_name} | ${Number(o.grand_total).toLocaleString()} VND | ${o.status}\n${items}`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_return_details',
        description: 'Lấy danh sách phiếu trả hàng (trả bán + trả mua) gần nhất',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      const [sr, pr] = await Promise.all([
        prisma.salesReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { customer: { select: { company_name: true, contact_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
        prisma.purchaseReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { supplier: { select: { company_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
      ]);
      let result = 'TRẢ HÀNG BÁN:\n';
      sr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.customer?.company_name || r.customer?.contact_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      result += '\nTRẢ HÀNG MUA:\n';
      pr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.supplier?.company_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      return result;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_order_detail',
        description: 'Lấy chi tiết 1 đơn hàng cụ thể theo mã đơn',
        parameters: { type: 'object', properties: { order_code: { type: 'string', description: 'Mã đơn hàng (VD: SO-20260101-001)' } }, required: ['order_code'] },
      },
    },
    handler: async (args) => {
      const order = await prisma.salesOrder.findFirst({
        where: { order_code: { contains: args.order_code, mode: 'insensitive' } },
        include: { customer: true, items: { include: { product: { select: { name: true, sku: true } } } }, purchase_orders: { include: { supplier: { select: { company_name: true } } } } },
      });
      if (!order) return 'Không tìm thấy đơn hàng.';
      let result = `Mã: ${order.order_code}\nKH: ${order.customer?.company_name || order.customer?.contact_name}\nNgày: ${dayjs(order.order_date).format('DD/MM/YYYY')}\nTổng: ${Number(order.grand_total).toLocaleString()} VND\nTT: ${order.status}\n\nSản phẩm:\n`;
      order.items.forEach((it) => { result += `• ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()} = ${Number(it.line_total).toLocaleString()} VND\n`; });
      if (order.purchase_orders.length > 0) {
        result += '\nĐơn mua liên kết:\n';
        order.purchase_orders.forEach((po) => { result += `• ${po.order_code} | ${po.supplier?.company_name} | ${Number(po.total).toLocaleString()} VND | ${po.status}\n`; });
      }
      return `${result}[id:${order.id}]`;
    },
  },
];
