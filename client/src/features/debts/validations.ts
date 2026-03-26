import { z } from 'zod';
import i18n from '@/locales';

export const paymentSchema = z.object({
  amount: z.number().positive({ message: i18n.t('validation.amountPositive') }),
  payment_date: z.string().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'OTHER'], {
    message: i18n.t('validation.paymentMethodRequired'),
  }),
  reference: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
