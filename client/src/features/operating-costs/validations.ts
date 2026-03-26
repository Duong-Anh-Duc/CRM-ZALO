import { z } from 'zod';
import i18n from '@/locales';

export const operatingCostSchema = z.object({
  date: z.string().min(1, { message: i18n.t('validation.dateRequired') }),
  category_id: z.string().min(1, { message: i18n.t('validation.categoryRequired') }),
  description: z.string().optional(),
  amount: z.number().positive({ message: i18n.t('validation.amountPositive') }),
});

export const costCategorySchema = z.object({
  name: z.string().min(1, { message: i18n.t('validation.categoryNameRequired') }),
});

export type OperatingCostFormValues = z.infer<typeof operatingCostSchema>;
export type CostCategoryFormValues = z.infer<typeof costCategorySchema>;
