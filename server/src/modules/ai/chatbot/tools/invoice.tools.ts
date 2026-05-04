import { ToolDefinition } from '../types';

export const invoiceTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_sales_invoice',
        description: 'Tạo hóa đơn bán từ 1 đơn bán đã CONFIRMED trở lên',
        parameters: {
          type: 'object',
          properties: { sales_order_id: { type: 'string' } },
          required: ['sales_order_id'],
        },
      },
    },
    handler: async (args) => {
      const { InvoiceService } = await import('../../../invoice/invoice.service');
      const inv = await InvoiceService.createFromOrder(args.sales_order_id);
      return `✅ Đã tạo hóa đơn ${inv.invoice_number} [id:${inv.id}] · status: ${inv.status}`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_purchase_invoice',
        description: 'Tạo hoá đơn mua (PURCHASE) từ 1 đơn mua. Trả về HĐ ở trạng thái DRAFT — cần finalize_invoice để duyệt.',
        parameters: {
          type: 'object',
          properties: {
            purchase_order_id: { type: 'string', description: 'UUID đơn mua' },
            notes: { type: 'string', description: 'Ghi chú (optional)' },
          },
          required: ['purchase_order_id'],
        },
      },
    },
    handler: async (args) => {
      const { InvoiceService } = await import('../../../invoice/invoice.service');
      const inv = await InvoiceService.createPurchaseInvoice(args.purchase_order_id);
      if (args.notes) {
        await InvoiceService.updateInvoice(inv.id, { notes: args.notes });
      }
      return `✅ Đã tạo hóa đơn mua #${inv.invoice_number} [id:${inv.id}] · status: ${inv.status}`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_sales_invoice',
        description: 'Sửa hoá đơn bán đang DRAFT (chưa finalize). Hỗ trợ: notes, invoice_date (YYYY-MM-DD), vat_amount, subtotal, total.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'UUID hoá đơn' },
            notes: { type: 'string' },
            invoice_date: { type: 'string', description: 'YYYY-MM-DD' },
            vat_amount: { type: 'number' },
            subtotal: { type: 'number' },
            total: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { InvoiceService } = await import('../../../invoice/invoice.service');
      const { id, invoice_date, ...rest } = args;
      const data: Record<string, unknown> = { ...rest };
      if (invoice_date) data.invoice_date = new Date(invoice_date);
      const inv = await InvoiceService.updateInvoice(id, data);
      return `✅ Đã cập nhật hóa đơn #${inv.invoice_number} [id:${inv.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'finalize_invoice',
        description: 'Duyệt/hoàn tất hóa đơn (DRAFT → APPROVED)',
        parameters: {
          type: 'object',
          properties: { invoice_id: { type: 'string' } },
          required: ['invoice_id'],
        },
      },
    },
    handler: async (args) => {
      const { InvoiceService } = await import('../../../invoice/invoice.service');
      const inv = await InvoiceService.finalize(args.invoice_id);
      return `✅ Đã duyệt HĐ ${inv.invoice_number} [id:${inv.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'cancel_invoice',
        description: 'Hủy hóa đơn',
        parameters: {
          type: 'object',
          properties: { invoice_id: { type: 'string' } },
          required: ['invoice_id'],
        },
      },
    },
    handler: async (args) => {
      const { InvoiceService } = await import('../../../invoice/invoice.service');
      const inv = await InvoiceService.cancel(args.invoice_id);
      return `✅ Đã hủy HĐ ${inv.invoice_number} [id:${inv.id}]`;
    },
  },
];
