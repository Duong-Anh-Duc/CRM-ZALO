import { z } from 'zod';
import i18n from '@/locales';

export const supplierSchema = z.object({
  company_name: z.string().min(1, { message: i18n.t('validation.supplierNameRequired') }),
  tax_code: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email({ message: i18n.t('validation.emailInvalid') })
    .optional()
    .or(z.literal('')),
  payment_terms: z
    .enum(['PREPAID', 'COD', 'NET_15', 'NET_30', 'NET_45', 'NET_60'])
    .optional()
    .or(z.literal('')),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
