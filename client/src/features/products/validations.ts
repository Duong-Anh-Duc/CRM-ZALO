import { z } from 'zod';
import i18n from '@/locales';

export const productSchema = z.object({
  name: z.string().min(1, { message: i18n.t('validation.productNameRequired') }),
  material: z.enum(['PET', 'HDPE', 'LDPE', 'PP', 'GLASS', 'OTHER'], {
    message: i18n.t('validation.materialRequired'),
  }),
  capacity_ml: z.number().positive({ message: i18n.t('validation.capacityPositive') }).optional(),
  height_mm: z.number().positive({ message: i18n.t('validation.heightPositive') }).optional(),
  body_dia_mm: z.number().positive({ message: i18n.t('validation.bodyDiaPositive') }).optional(),
  neck_dia_mm: z.number().positive({ message: i18n.t('validation.neckDiaPositive') }).optional(),
  weight_g: z.number().positive({ message: i18n.t('validation.weightPositive') }).optional(),
  color: z
    .enum(['TRANSPARENT', 'WHITE', 'AMBER', 'GREEN', 'BLUE', 'CUSTOM'], {
      message: i18n.t('validation.colorRequired'),
    })
    .optional(),
  shape: z
    .enum(['ROUND', 'SQUARE', 'OVAL', 'CUSTOM'], {
      message: i18n.t('validation.shapeRequired'),
    })
    .optional(),
  neck_type: z
    .enum(['SCREW', 'SNAP', 'PRESS', 'PUMP', 'SPRAY', 'OTHER'], {
      message: i18n.t('validation.neckTypeRequired'),
    })
    .optional(),
  neck_spec: z.string().optional(),
  unit_of_sale: z.enum(['PCS', 'CARTON', 'SET'], {
    message: i18n.t('validation.unitRequired'),
  }),
  pcs_per_carton: z
    .number()
    .int({ message: i18n.t('validation.qtyInteger') })
    .positive({ message: i18n.t('validation.qtyPositive') })
    .optional(),
  moq: z
    .number()
    .int({ message: i18n.t('validation.moqInteger') })
    .positive({ message: i18n.t('validation.moqPositive') })
    .optional(),
  retail_price: z.number().positive({ message: i18n.t('validation.retailPricePositive') }).optional(),
  wholesale_price: z.number().positive({ message: i18n.t('validation.wholesalePricePositive') }).optional(),
});

export const priceTierSchema = z.object({
  min_qty: z
    .number()
    .int({ message: i18n.t('validation.minQtyInteger') })
    .positive({ message: i18n.t('validation.minQtyPositive') }),
  price: z.number().positive({ message: i18n.t('validation.pricePositive') }),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type PriceTierFormValues = z.infer<typeof priceTierSchema>;
