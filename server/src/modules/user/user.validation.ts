import { z } from 'zod';
import { t } from '../../locales';

export const createUserSchema = z.object({
  email: z.string().email(t('validation.emailInvalid')),
  password: z.string().min(6, t('validation.passwordMin6')),
  full_name: z.string().min(1, t('validation.fullNameRequired')),
  role: z.enum(['ADMIN', 'STAFF', 'VIEWER'], { message: t('validation.roleRequired') }),
});

export const updateUserSchema = z.object({
  email: z.string().email(t('validation.emailInvalid')).optional(),
  full_name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'STAFF', 'VIEWER']).optional(),
  is_active: z.boolean().optional(),
}).partial();
