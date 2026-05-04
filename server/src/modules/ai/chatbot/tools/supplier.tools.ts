import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const supplierTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_supplier',
        description: 'Tạo NCC mới',
        parameters: {
          type: 'object',
          properties: {
            company_name: { type: 'string' },
            contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, address: { type: 'string' },
            tax_code: { type: 'string' },
            payment_terms: { type: 'string', enum: ['NET_15', 'NET_30', 'NET_45', 'NET_60', 'COD'] },
          },
          required: ['company_name'],
        },
      },
    },
    handler: async (args) => {
      const s = await prisma.supplier.create({
        data: {
          company_name: args.company_name,
          contact_name: args.contact_name || null, phone: args.phone || null, email: args.email || null,
          address: args.address || null, tax_code: args.tax_code || null,
          payment_terms: args.payment_terms || 'NET_30',
        },
      });
      return `✅ Đã tạo NCC "${s.company_name}" [id:${s.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_supplier',
        description: 'Cập nhật NCC (id UUID)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            company_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
            contact_name: { type: 'string' }, address: { type: 'string' }, payment_terms: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { id, ...data } = args;
      const s = await prisma.supplier.update({ where: { id }, data });
      return `✅ Đã cập nhật NCC "${s.company_name}" [id:${s.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_supplier',
        description: 'Xóa NCC (soft delete)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { SupplierService } = await import('../../../supplier/supplier.service');
      await SupplierService.softDelete(args.id);
      return `✅ Đã xóa NCC [id:${args.id}]`;
    },
  },
];
