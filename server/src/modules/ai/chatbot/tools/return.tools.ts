import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const returnTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_sales_return',
        description: 'Tạo phiếu trả hàng bán (KH trả lại)',
        parameters: {
          type: 'object',
          properties: {
            sales_order_id: { type: 'string' }, customer_id: { type: 'string' },
            return_date: { type: 'string' }, reason: { type: 'string' }, notes: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['product_id', 'quantity', 'unit_price'],
              },
            },
          },
          required: ['sales_order_id', 'customer_id', 'items'],
        },
      },
    },
    handler: async (args) => {
      const { SalesReturnService } = await import('../../../return/sales-return.service');
      const r = await SalesReturnService.create(args as any);
      return `✅ Đã tạo phiếu trả hàng bán ${r.return_code} [id:${r.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_purchase_return',
        description: 'Tạo phiếu trả hàng mua (trả cho NCC)',
        parameters: {
          type: 'object',
          properties: {
            purchase_order_id: { type: 'string' }, supplier_id: { type: 'string' },
            return_date: { type: 'string' }, reason: { type: 'string' }, notes: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['product_id', 'quantity', 'unit_price'],
              },
            },
          },
          required: ['purchase_order_id', 'supplier_id', 'items'],
        },
      },
    },
    handler: async (args) => {
      const { PurchaseReturnService } = await import('../../../return/purchase-return.service');
      const r = await PurchaseReturnService.create(args as any);
      return `✅ Đã tạo phiếu trả hàng mua ${r.return_code} [id:${r.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_sales_return',
        description: 'Sửa phiếu trả hàng bán (chỉ đổi reason/notes, không đổi items)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const data: Record<string, any> = {};
      if (args.reason !== undefined) data.reason = args.reason;
      if (args.notes !== undefined) data.notes = args.notes;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const r = await prisma.salesReturn.update({ where: { id: args.id }, data });
      return `✅ Đã cập nhật phiếu trả bán ${r.return_code} [id:${r.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_sales_return',
        description: 'Xoá phiếu trả hàng bán (chỉ khi chưa APPROVED/RECEIVING/COMPLETED)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { SalesReturnService } = await import('../../../return/sales-return.service');
      await SalesReturnService.delete(args.id);
      return `✅ Đã xoá phiếu trả hàng bán [id:${args.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_purchase_return',
        description: 'Sửa phiếu trả hàng mua (chỉ đổi reason/notes)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const data: Record<string, any> = {};
      if (args.reason !== undefined) data.reason = args.reason;
      if (args.notes !== undefined) data.notes = args.notes;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const r = await prisma.purchaseReturn.update({ where: { id: args.id }, data });
      return `✅ Đã cập nhật phiếu trả mua ${r.return_code} [id:${r.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_purchase_return',
        description: 'Xoá phiếu trả hàng mua (chỉ khi chưa APPROVED/RECEIVING/COMPLETED)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const { PurchaseReturnService } = await import('../../../return/purchase-return.service');
      await PurchaseReturnService.delete(args.id);
      return `✅ Đã xoá phiếu trả hàng mua [id:${args.id}]`;
    },
  },
];
