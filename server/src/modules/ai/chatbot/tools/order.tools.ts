import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const orderTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_sales_order',
        description: 'Tạo đơn bán hàng. customer_id (UUID) + items (mỗi item gồm product_id UUID, quantity, unit_price).',
        parameters: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' },
            expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
            notes: { type: 'string' },
            vat_rate: { type: 'string', enum: ['VAT_0', 'VAT_5', 'VAT_8', 'VAT_10'] },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number' },
                  customer_product_name: { type: 'string' },
                  supplier_id: { type: 'string' },
                  discount_pct: { type: 'number' },
                },
                required: ['product_id', 'quantity', 'unit_price'],
              },
            },
          },
          required: ['customer_id', 'items'],
        },
      },
    },
    handler: async (args) => {
      const { SalesOrderService } = await import('../../../sales-order/sales-order.service');
      const order = await SalesOrderService.create({
        customer_id: args.customer_id,
        expected_delivery: args.expected_delivery,
        notes: args.notes,
        vat_rate: args.vat_rate || 'VAT_0',
        items: args.items,
      });
      return `✅ Đã tạo đơn bán ${order.order_code} [id:${order.id}] — Tổng: ${Number(order.grand_total).toLocaleString()} VND`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_sales_order_status',
        description: 'Đổi trạng thái đơn bán (DRAFT/CONFIRMED/SHIPPING/COMPLETED/CANCELLED)',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' }, status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'] } },
          required: ['id', 'status'],
        },
      },
    },
    handler: async (args) => {
      const o = await prisma.salesOrder.update({ where: { id: args.id }, data: { status: args.status } });
      return `✅ Đơn ${o.order_code} → ${args.status} [id:${o.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_sales_order',
        description: 'Sửa thông tin chung của đơn bán (KHÔNG sửa items — dùng add/remove_sales_order_item). Hỗ trợ: notes, expected_delivery (ngày giao YYYY-MM-DD), vat_rate, shipping_fee, other_fee, other_fee_note.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'UUID đơn bán' },
            notes: { type: 'string' },
            expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
            vat_rate: { type: 'string', enum: ['VAT_0', 'VAT_5', 'VAT_8', 'VAT_10'] },
            shipping_fee: { type: 'number' },
            other_fee: { type: 'number' },
            other_fee_note: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { SalesOrderService } = await import('../../../sales-order/sales-order.service');
      const { id, ...data } = args;
      const o = await SalesOrderService.update(id, data);
      return `✅ Đã cập nhật đơn bán ${o.order_code} [id:${o.id}] — Tổng: ${Number(o.grand_total).toLocaleString()} VND`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'add_sales_order_item',
        description: 'Thêm 1 sản phẩm vào đơn bán DRAFT',
        parameters: {
          type: 'object',
          properties: {
            sales_order_id: { type: 'string' }, product_id: { type: 'string' },
            quantity: { type: 'number' }, unit_price: { type: 'number' },
            supplier_id: { type: 'string' }, customer_product_name: { type: 'string' },
          },
          required: ['sales_order_id', 'product_id', 'quantity', 'unit_price'],
        },
      },
    },
    handler: async (args) => {
      const { SalesOrderService } = await import('../../../sales-order/sales-order.service');
      const item = await SalesOrderService.addItem(args.sales_order_id, {
        product_id: args.product_id, quantity: args.quantity, unit_price: args.unit_price,
        supplier_id: args.supplier_id, customer_product_name: args.customer_product_name,
      });
      return `✅ Đã thêm SP vào đơn. Line total: ${Number(item.line_total).toLocaleString()} VND`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'remove_sales_order_item',
        description: 'Gỡ 1 item khỏi đơn bán DRAFT',
        parameters: {
          type: 'object',
          properties: { sales_order_id: { type: 'string' }, item_id: { type: 'string' } },
          required: ['sales_order_id', 'item_id'],
        },
      },
    },
    handler: async (args) => {
      const { SalesOrderService } = await import('../../../sales-order/sales-order.service');
      await SalesOrderService.removeItem(args.sales_order_id, args.item_id);
      return `✅ Đã gỡ item khỏi đơn bán [id:${args.sales_order_id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_purchase_order',
        description: 'Tạo đơn mua hàng. Phải link với sales_order_id. items: product_id + quantity + unit_price.',
        parameters: {
          type: 'object',
          properties: {
            sales_order_id: { type: 'string' }, supplier_id: { type: 'string' },
            expected_delivery: { type: 'string' }, notes: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: { product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' } },
                required: ['product_id', 'quantity', 'unit_price'],
              },
            },
          },
          required: ['sales_order_id', 'supplier_id', 'items'],
        },
      },
    },
    handler: async (args) => {
      const { PurchaseOrderService } = await import('../../../purchase-order/purchase-order.service');
      const po = await PurchaseOrderService.create({
        supplier_id: args.supplier_id, sales_order_id: args.sales_order_id,
        expected_delivery: args.expected_delivery, notes: args.notes, items: args.items,
      });
      return `✅ Đã tạo đơn mua ${po.order_code} [id:${po.id}] — Tổng: ${Number(po.total).toLocaleString()} VND`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_purchase_order_status',
        description: 'Đổi trạng thái đơn mua',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' }, status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'] } },
          required: ['id', 'status'],
        },
      },
    },
    handler: async (args) => {
      const p = await prisma.purchaseOrder.update({ where: { id: args.id }, data: { status: args.status } });
      return `✅ PO ${p.order_code} → ${args.status} [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_purchase_order',
        description: 'Sửa thông tin chung của đơn mua (hiện hỗ trợ: notes, expected_delivery YYYY-MM-DD). KHÔNG sửa items.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'UUID đơn mua' },
            notes: { type: 'string' },
            expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { PurchaseOrderService } = await import('../../../purchase-order/purchase-order.service');
      const { id, ...data } = args;
      const p = await PurchaseOrderService.update(id, data);
      return `✅ Đã cập nhật đơn mua ${p.order_code} [id:${p.id}] — Tổng: ${Number(p.total).toLocaleString()} VND`;
    },
  },
];
