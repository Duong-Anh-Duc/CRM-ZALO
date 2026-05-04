import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const customerTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_customer',
        description: 'Tạo khách hàng mới. Trả về id khách vừa tạo.',
        parameters: {
          type: 'object',
          properties: {
            company_name: { type: 'string', description: 'Tên công ty hoặc tên KH cá nhân' },
            phone: { type: 'string' },
            email: { type: 'string' },
            contact_name: { type: 'string' },
            address: { type: 'string' },
            customer_type: { type: 'string', enum: ['INDIVIDUAL', 'BUSINESS'] },
            tax_code: { type: 'string' },
            debt_limit: { type: 'number' },
          },
          required: ['company_name'],
        },
      },
    },
    handler: async (args) => {
      const c = await prisma.customer.create({
        data: {
          company_name: args.company_name,
          phone: args.phone || null, email: args.email || null, contact_name: args.contact_name || null,
          address: args.address || null, customer_type: args.customer_type || 'INDIVIDUAL',
          tax_code: args.tax_code || null, debt_limit: args.debt_limit || 0,
          approval_status: 'APPROVED',
        },
      });
      return `✅ Đã tạo KH "${c.company_name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_customer',
        description: 'Cập nhật thông tin KH (id là UUID từ search_customer)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            company_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
            contact_name: { type: 'string' }, address: { type: 'string' }, tax_code: { type: 'string' },
            debt_limit: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { id, ...data } = args;
      const c = await prisma.customer.update({ where: { id }, data });
      return `✅ Đã cập nhật KH "${c.company_name}" [id:${c.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_customer',
        description: 'Xóa khách hàng (soft delete, chuyển is_active=false)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { CustomerService } = await import('../../../customer/customer.service');
      await CustomerService.softDelete(args.id);
      return `✅ Đã xóa khách hàng [id:${args.id}]`;
    },
  },
];
