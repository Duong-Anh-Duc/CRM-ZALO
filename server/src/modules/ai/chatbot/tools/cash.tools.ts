import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const cashTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_cash_transaction',
        description: 'Thêm giao dịch sổ quỹ (thu/chi)',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
            amount: { type: 'number' }, category_id: { type: 'string' },
            transaction_date: { type: 'string' }, description: { type: 'string' },
            reference: { type: 'string' },
          },
          required: ['type', 'amount', 'category_id', 'transaction_date'],
        },
      },
    },
    handler: async (args) => {
      const ct = await prisma.cashTransaction.create({
        data: {
          type: args.type, amount: args.amount, category_id: args.category_id,
          date: new Date(args.transaction_date),
          description: args.description || '', reference: args.reference || null,
        },
      });
      return `✅ Đã ghi ${args.type === 'INCOME' ? 'thu' : 'chi'} ${Number(args.amount).toLocaleString()} VND [id:${ct.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_cash_transaction',
        description: 'Sửa giao dịch sổ quỹ đã tạo (id UUID)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            category_id: { type: 'string' },
            transaction_date: { type: 'string', description: 'YYYY-MM-DD' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { CashBookService } = await import('../../../cash-book/cash-book.service');
      const { id, transaction_date, ...rest } = args;
      const data: Record<string, any> = { ...rest };
      if (transaction_date) data.date = transaction_date;
      const ct = await CashBookService.update(id, data);
      return `✓ Đã cập nhật giao dịch sổ quỹ ${Number(ct.amount).toLocaleString()} VND [id:${ct.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_cash_transaction',
        description: 'Xoá giao dịch sổ quỹ (id UUID). Không xoá được GD tự động.',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { CashBookService } = await import('../../../cash-book/cash-book.service');
      await CashBookService.delete(args.id);
      return `✓ Đã xoá giao dịch sổ quỹ [id:${args.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_cash_category',
        description: 'Tạo danh mục sổ quỹ (type: INCOME/EXPENSE)',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' }, type: { type: 'string', enum: ['INCOME', 'EXPENSE'] } },
          required: ['name', 'type'],
        },
      },
    },
    handler: async (args) => {
      const { CashBookService } = await import('../../../cash-book/cash-book.service');
      const c = await CashBookService.createCategory({ name: args.name, type: args.type });
      return `✅ Đã tạo danh mục sổ quỹ [${c.type}] "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_cash_category',
        description: 'Sửa danh mục sổ quỹ (chỉ đổi name hoặc is_active, KHÔNG đổi type)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            is_active: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { CashBookService } = await import('../../../cash-book/cash-book.service');
      const data: { name?: string; is_active?: boolean } = {};
      if (args.name !== undefined) data.name = args.name;
      if (args.is_active !== undefined) data.is_active = args.is_active;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const c = await CashBookService.updateCategory(args.id, data);
      return `✅ Đã cập nhật danh mục sổ quỹ [${c.type}] "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_cash_category',
        description: 'Xoá danh mục sổ quỹ (soft delete, is_active=false)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { CashBookService } = await import('../../../cash-book/cash-book.service');
      const c = await CashBookService.updateCategory(args.id, { is_active: false });
      return `✅ Đã xoá danh mục sổ quỹ "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_operating_cost',
        description: 'Thêm chi phí vận hành (điện, thuê...)',
        parameters: {
          type: 'object',
          properties: {
            category_id: { type: 'string' }, amount: { type: 'number' },
            date: { type: 'string' }, description: { type: 'string' },
          },
          required: ['category_id', 'amount', 'date'],
        },
      },
    },
    handler: async (args) => {
      const c = await prisma.operatingCost.create({
        data: {
          category_id: args.category_id, amount: args.amount,
          date: new Date(args.date), description: args.description || null,
        },
      });
      return `✅ Đã thêm chi phí vận hành ${Number(args.amount).toLocaleString()} VND [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_operating_cost',
        description: 'Sửa chi phí vận hành (id UUID)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            category_id: { type: 'string' },
            cost_date: { type: 'string', description: 'YYYY-MM-DD' },
            description: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { OperatingCostService } = await import('../../../operating-cost/operating-cost.service');
      const { id, cost_date, ...rest } = args;
      const data: Record<string, any> = { ...rest };
      if (cost_date) data.date = cost_date;
      const c = await OperatingCostService.update(id, data);
      return `✓ Đã cập nhật chi phí vận hành ${Number(c.amount).toLocaleString()} VND [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_operating_cost',
        description: 'Xoá chi phí vận hành (id UUID)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { OperatingCostService } = await import('../../../operating-cost/operating-cost.service');
      await OperatingCostService.delete(args.id);
      return `✓ Đã xoá chi phí vận hành [id:${args.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_operating_cost_category',
        description: 'Tạo danh mục chi phí vận hành',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
    handler: async (args) => {
      const { OperatingCostService } = await import('../../../operating-cost/operating-cost.service');
      const c = await OperatingCostService.createCategory(args.name);
      return `✅ Đã tạo danh mục chi phí VH "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_operating_cost_category',
        description: 'Sửa danh mục chi phí vận hành (chỉ đổi tên)',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' } },
          required: ['id', 'name'],
        },
      },
    },
    handler: async (args) => {
      const { OperatingCostService } = await import('../../../operating-cost/operating-cost.service');
      const c = await OperatingCostService.updateCategory(args.id, args.name);
      return `✅ Đã đổi tên danh mục chi phí VH → "${c.name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_operating_cost_category',
        description: 'Xoá danh mục chi phí vận hành (soft delete, is_active=false)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const c = await prisma.operatingCostCategory.update({
        where: { id: args.id },
        data: { is_active: false },
      });
      return `✅ Đã xoá danh mục chi phí VH "${c.name}" [id:${c.id}]`;
    },
  },
];
