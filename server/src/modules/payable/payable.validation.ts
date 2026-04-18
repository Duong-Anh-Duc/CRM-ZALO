import { z } from 'zod';
import { t } from '../../locales';

export const recordPaymentSchema = z.object({
  supplier_id: z.string().min(1),
  amount: z.number().positive(t('validation.amountPositive')),
  payment_date: z.string().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'OTHER'], { message: t('validation.paymentMethodRequired') }),
  reference: z.string().optional(),
  evidence_url: z.string().optional(),
});
