import { z } from 'zod';

export const createSalesReturnSchema = z.object({
  sales_order_id: z.string().min(1),
  customer_id: z.string().min(1),
  return_date: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().positive(),
    reason: z.string().optional(),
  })).min(1),
});

export const createPurchaseReturnSchema = z.object({
  purchase_order_id: z.string().min(1),
  supplier_id: z.string().min(1),
  return_date: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().positive(),
    reason: z.string().optional(),
  })).min(1),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVING', 'SHIPPING', 'COMPLETED', 'REJECTED', 'CANCELLED']),
});
