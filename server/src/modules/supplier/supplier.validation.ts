import { z } from 'zod';
import { t } from '../../locales';

export const createSupplierSchema = z.object({
  company_name: z.string().min(1, t('validation.supplierNameRequired')),
  tax_code: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
  payment_terms: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();
