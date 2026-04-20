import { z } from 'zod';
import { t } from '../../locales';

// Use nullish() instead of optional() for fields that may be cleared to null from UI forms.
export const createProductSchema = z.object({
  name: z.string().min(1, t('validation.productNameRequired')),
  sku: z.string().nullish(),
  material: z.string().nullish(),
  capacity_ml: z.number().positive(t('validation.capacityPositive')).nullish(),
  height_mm: z.number().positive(t('validation.heightPositive')).nullish(),
  body_dia_mm: z.number().positive(t('validation.bodyDiaPositive')).nullish(),
  neck_dia_mm: z.number().positive(t('validation.neckDiaPositive')).nullish(),
  weight_g: z.number().positive(t('validation.weightPositive')).nullish(),
  color: z.string().nullish(),
  shape: z.string().nullish(),
  neck_type: z.string().nullish(),
  neck_spec: z.string().nullish(),
  unit_of_sale: z.string().nullish(),
  pcs_per_carton: z.number().int().positive().nullish(),
  moq: z.number().int().positive().nullish(),
  retail_price: z.number().positive(t('validation.retailPricePositive')).nullish(),
  category_id: z.string().nullish(),
  description: z.string().nullish(),
  is_active: z.boolean().optional(),
  industries: z.array(z.string()).optional(),
  safety_standards: z.array(z.string()).optional(),
  price_tiers: z.array(z.object({
    min_qty: z.number().int().positive(t('validation.minQtyPositive')),
    price: z.number().positive(t('validation.pricePositive')),
  })).optional(),
});

export const updateProductSchema = createProductSchema.partial();
