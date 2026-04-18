import { z } from 'zod';

export const createSupplierPriceSchema = z.object({
  supplier_id: z.string().min(1),
  product_id: z.string().min(1),
  purchase_price: z.number().nonnegative(),
  moq: z.number().int().nonnegative().optional().nullable(),
  lead_time_days: z.number().int().nonnegative().optional().nullable(),
  is_preferred: z.boolean().optional(),
});

export const updateSupplierPriceSchema = z.object({
  purchase_price: z.number().nonnegative().optional(),
  moq: z.number().int().nonnegative().optional().nullable(),
  lead_time_days: z.number().int().nonnegative().optional().nullable(),
  is_preferred: z.boolean().optional(),
});
