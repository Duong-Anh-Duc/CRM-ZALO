import { z } from 'zod';
import { t } from '../../locales';

/**
 * role_slug accepts any non-empty string — validity is enforced at the
 * service layer by checking the Role table.
 */
export const createUserSchema = z.object({
  email: z.string().email(t('validation.emailInvalid')),
  password: z.string().min(6, t('validation.passwordMin6')),
  full_name: z.string().min(1, t('validation.fullNameRequired')),
  role_slug: z.string().min(1, t('validation.roleRequired')),
});

export const updateUserSchema = z.object({
  email: z.string().email(t('validation.emailInvalid')).optional(),
  full_name: z.string().min(1).optional(),
  role_slug: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).partial();
