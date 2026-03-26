import { z } from 'zod';
import i18n from '@/locales';

export const salesOrderItemSchema = z
  .object({
    product_id: z.string().optional(),
    combo_id: z.string().optional(),
    quantity: z
      .number()
      .int({ message: i18n.t('validation.qtyInteger') })
      .positive({ message: i18n.t('validation.qtyPositive') }),
    unit_price: z.number().positive({ message: i18n.t('validation.unitPricePositive') }),
    discount_pct: z
      .number()
      .min(0, { message: i18n.t('validation.discountNonNegative') })
      .max(100, { message: i18n.t('validation.discountMax100') })
      .optional(),
    color_note: z.string().optional(),
    packaging_note: z.string().optional(),
  })
  .refine((data) => data.product_id || data.combo_id, {
    message: i18n.t('validation.productOrComboRequired'),
    path: ['product_id'],
  });

export const salesOrderSchema = z.object({
  customer_id: z.string().min(1, { message: i18n.t('validation.customerRequired') }),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  vat_rate: z.enum(['VAT_0', 'VAT_8', 'VAT_10'], {
    message: i18n.t('validation.vatRateRequired'),
  }),
  items: z
    .array(salesOrderItemSchema)
    .min(1, { message: i18n.t('validation.minOneItem') }),
});

export const purchaseOrderItemSchema = z.object({
  product_id: z.string().min(1, { message: i18n.t('validation.productRequired') }),
  quantity: z
    .number()
    .int({ message: i18n.t('validation.qtyInteger') })
    .positive({ message: i18n.t('validation.qtyPositive') }),
  unit_price: z.number().positive({ message: i18n.t('validation.unitPricePositive') }),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, { message: i18n.t('validation.supplierRequired') }),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, { message: i18n.t('validation.minOneItem') }),
});

export type SalesOrderItemFormValues = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;
export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
