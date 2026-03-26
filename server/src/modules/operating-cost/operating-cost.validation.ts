import { z } from 'zod';
import { t } from '../../locales';

export const createCostSchema = z.object({
  date: z.string().min(1, t('validation.dateRequired')),
  category_id: z.string().min(1, t('validation.categoryRequired')),
  description: z.string().optional(),
  amount: z.number().positive(t('validation.amountPositive')),
});

export const updateCostSchema = createCostSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1, t('validation.categoryNameRequired')),
});
