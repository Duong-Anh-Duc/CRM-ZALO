import { z } from 'zod';
import i18n from '@/locales';

const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[2689]|7[0-9]|8[1-9]|9[0-9])\d{7}$/;

export const customerSchema = z.object({
  company_name: z.string().min(1, { message: i18n.t('validation.companyNameRequired') }),
  tax_code: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z
    .string()
    .regex(vnPhoneRegex, { message: i18n.t('validation.phoneInvalid') })
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email({ message: i18n.t('validation.emailInvalid') })
    .optional()
    .or(z.literal('')),
  customer_type: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'OEM'], {
    message: i18n.t('validation.customerTypeRequired'),
  }),
  debt_limit: z.number().min(0, { message: i18n.t('validation.debtLimitNonNegative') }),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
