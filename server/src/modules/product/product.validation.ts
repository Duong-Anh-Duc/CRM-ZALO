import { z } from 'zod';
import { t } from '../../locales';

export const createProductSchema = z.object({
  name: z.string().min(1, t('validation.productNameRequired')),
  sku: z.string().optional(),
  material: z.string().optional(),
  capacity_ml: z.number().positive(t('validation.capacityPositive')).optional(),
  height_mm: z.number().positive(t('validation.heightPositive')).optional(),
  body_dia_mm: z.number().positive(t('validation.bodyDiaPositive')).optional(),
  neck_dia_mm: z.number().positive(t('validation.neckDiaPositive')).optional(),
  weight_g: z.number().positive(t('validation.weightPositive')).optional(),
  color: z.string().optional(),
  shape: z.string().optional(),
  neck_type: z.string().optional(),
  neck_spec: z.string().optional(),
  unit_of_sale: z.string().optional(),
  pcs_per_carton: z.number().int().positive().optional(),
  moq: z.number().int().positive().optional(),
  retail_price: z.number().positive(t('validation.retailPricePositive')).optional(),
  category_id: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  industries: z.array(z.string()).optional(),
  safety_standards: z.array(z.string()).optional(),
  price_tiers: z.array(z.object({
    min_qty: z.number().int().positive(t('validation.minQtyPositive')),
    price: z.number().positive(t('validation.pricePositive')),
  })).optional(),
});

export const updateProductSchema = createProductSchema.partial();
