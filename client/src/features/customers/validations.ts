import { z } from 'zod';
import i18n from '@/locales';

export const customerSchema = z.object({
  company_name: z.string().optional().or(z.literal('')),
  tax_code: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email({ message: i18n.t('validation.emailInvalid') }).optional().or(z.literal('')),
  customer_type: z.enum(['INDIVIDUAL', 'BUSINESS'], {
    message: i18n.t('validation.customerTypeRequired'),
  }),
  debt_limit: z.number().min(0).optional(),
  zalo_user_id: z.string().optional().or(z.literal('')),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
