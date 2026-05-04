import { ToolDefinition } from '../types';

export const paymentTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'record_receivable_payment',
        description: 'Ghi nhận thu tiền từ KH (FIFO phân bổ theo hóa đơn cũ nhất trước). evidence_url BẮT BUỘC.',
        parameters: {
          type: 'object',
          properties: {
            customer_id: { type: 'string' }, amount: { type: 'number' },
            payment_date: { type: 'string', description: 'YYYY-MM-DD' },
            method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'OTHER'] },
            reference: { type: 'string' }, evidence_url: { type: 'string' },
          },
          required: ['customer_id', 'amount', 'payment_date', 'method', 'evidence_url'],
        },
      },
    },
    handler: async (args) => {
      const { ReceivableService } = await import('../../../receivable/receivable.service');
      const pay = await ReceivableService.recordPayment({
        customer_id: args.customer_id, amount: args.amount,
        payment_date: args.payment_date, method: args.method,
        reference: args.reference, evidence_url: args.evidence_url,
      });
      return `✅ Đã ghi nhận thu ${Number(args.amount).toLocaleString()} VND từ KH. Phân bổ ${(pay as any).allocations?.length || 0} HĐ.`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'record_payable_payment',
        description: 'Ghi nhận chi tiền trả NCC. evidence_url BẮT BUỘC.',
        parameters: {
          type: 'object',
          properties: {
            supplier_id: { type: 'string' }, amount: { type: 'number' },
            payment_date: { type: 'string' }, method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'OTHER'] },
            reference: { type: 'string' }, evidence_url: { type: 'string' },
          },
          required: ['supplier_id', 'amount', 'payment_date', 'method', 'evidence_url'],
        },
      },
    },
    handler: async (args) => {
      const { PayableService } = await import('../../../payable/payable.service');
      const pay = await PayableService.recordPayment({
        supplier_id: args.supplier_id, amount: args.amount,
        payment_date: args.payment_date, method: args.method,
        reference: args.reference, evidence_url: args.evidence_url,
      });
      return `✅ Đã ghi nhận trả ${Number(args.amount).toLocaleString()} VND cho NCC. Phân bổ ${(pay as any).allocations?.length || 0} HĐ.`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_receivable_payment_evidence',
        description: 'Cập nhật URL minh chứng (ảnh/PDF) cho 1 payment phải thu',
        parameters: {
          type: 'object',
          properties: {
            payment_id: { type: 'string' },
            evidence_url: { type: 'string' },
          },
          required: ['payment_id', 'evidence_url'],
        },
      },
    },
    handler: async (args) => {
      const { ReceivableService } = await import('../../../receivable/receivable.service');
      const r = await ReceivableService.updatePaymentEvidence(args.payment_id, args.evidence_url);
      return `✓ Đã cập nhật minh chứng payment phải thu [id:${r.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_payable_payment_evidence',
        description: 'Cập nhật URL minh chứng (ảnh/PDF) cho 1 payment phải trả',
        parameters: {
          type: 'object',
          properties: {
            payment_id: { type: 'string' },
            evidence_url: { type: 'string' },
          },
          required: ['payment_id', 'evidence_url'],
        },
      },
    },
    handler: async (args) => {
      const { PayableService } = await import('../../../payable/payable.service');
      const r = await PayableService.updatePaymentEvidence(args.payment_id, args.evidence_url);
      return `✓ Đã cập nhật minh chứng payment phải trả [id:${r.id}]`;
    },
  },
];
