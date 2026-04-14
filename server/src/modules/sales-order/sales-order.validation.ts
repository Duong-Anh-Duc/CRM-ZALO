import { z } from 'zod';
import { t } from '../../locales';

export const createSalesOrderSchema = z.object({
  customer_id: z.string().min(1, t('validation.customerRequired')),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  vat_rate: z.enum(['VAT_0', 'VAT_8', 'VAT_10'], { message: t('validation.vatRateRequired') }),
  items: z.array(z.object({
    product_id: z.string().optional(),
    quantity: z.number().int(t('validation.qtyInteger')).positive(t('validation.qtyPositive')),
    unit_price: z.number().positive(t('validation.unitPricePositive')),
    discount_pct: z.number().min(0).max(100).optional(),
  })).min(1, t('validation.minOneItem')),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1, t('validation.statusRequired')),
});
