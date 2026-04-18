import { z } from 'zod';
import { t } from '../../locales';

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, t('validation.supplierRequired')),
  sales_order_id: z.string().optional(),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1, t('validation.productRequired')),
    quantity: z.number().int(t('validation.qtyInteger')).positive(t('validation.qtyPositive')),
    unit_price: z.number().positive(t('validation.unitPricePositive')),
  })).min(1, t('validation.minOneItem')),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1, t('validation.statusRequired')),
});
