import { z } from 'zod';
import { t } from '../../locales';

export const createCustomerSchema = z.object({
  company_name: z.string().min(1, t('validation.companyNameRequired')),
  tax_code: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
  customer_type: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'OEM'], { message: t('validation.customerTypeRequired') }),
  debt_limit: z.number().min(0, t('validation.debtLimitNonNegative')).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const checkDebtLimitSchema = z.object({
  customer_id: z.string().min(1, t('validation.customerRequired')),
  order_total: z.number().positive(t('validation.amountPositive')),
});
