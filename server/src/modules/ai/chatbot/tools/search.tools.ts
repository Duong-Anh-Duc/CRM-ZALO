import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const searchTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'search_customer',
        description: 'Tìm kiếm khách hàng theo tên hoặc số điện thoại',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'Tên hoặc SĐT khách hàng' } }, required: ['query'] },
      },
    },
    handler: async (args) => {
      const q = args.query || '';
      const customers = await prisma.customer.findMany({
        where: { OR: [{ company_name: { contains: q, mode: 'insensitive' } }, { contact_name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } } },
        take: 10,
      });
      if (customers.length === 0) return 'Không tìm thấy khách hàng nào.';
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const zalo = c.zalo_user_id ? ` | Zalo ID: ${c.zalo_user_id}` : '';
        return `${i + 1}. ${c.company_name || c.contact_name} [id:${c.id}] | SĐT: ${c.phone || '-'}${zalo} | ${c._count.sales_orders} đơn | Nợ: ${debt.toLocaleString()} VND`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'search_supplier',
        description: 'Tìm NCC theo tên hoặc SĐT — trả về id cần dùng cho các thao tác tiếp theo',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
    handler: async (args) => {
      const q = args.query || '';
      const suppliers = await prisma.supplier.findMany({
        where: { OR: [{ company_name: { contains: q, mode: 'insensitive' } }, { contact_name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        take: 10,
      });
      if (suppliers.length === 0) return 'Không tìm thấy NCC.';
      return suppliers.map((s, i) => {
        const zalo = s.zalo_user_id ? ` | Zalo ID: ${s.zalo_user_id}` : '';
        return `${i + 1}. ${s.company_name} [id:${s.id}] | SĐT: ${s.phone || '-'}${zalo}`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'search_product',
        description: 'Tìm sản phẩm theo tên hoặc SKU — trả về id cần cho các thao tác tạo đơn',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
    handler: async (args) => {
      const q = args.query || '';
      const products = await prisma.product.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] },
        take: 10,
      });
      if (products.length === 0) return 'Không tìm thấy SP.';
      return products.map((p, i) => `${i + 1}. ${p.name} (${p.sku}) [id:${p.id}] | Giá tham khảo: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'}`).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_categories',
        description: 'Liệt kê danh mục (product category hoặc cash category hoặc operating-cost category)',
        parameters: {
          type: 'object',
          properties: { type: { type: 'string', enum: ['product', 'cash', 'operating_cost'] } },
          required: ['type'],
        },
      },
    },
    handler: async (args) => {
      if (args.type === 'product') {
        const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        return cats.map((c) => `• ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      if (args.type === 'cash') {
        const cats = await prisma.cashCategory.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
        return cats.map((c) => `• [${c.type}] ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      if (args.type === 'operating_cost') {
        const cats = await prisma.operatingCostCategory.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
        return cats.map((c) => `• ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      return 'type không hợp lệ';
    },
  },
];
