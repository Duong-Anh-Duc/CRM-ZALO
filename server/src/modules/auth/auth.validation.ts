import { z } from 'zod';
import { t } from '../../locales';

export const loginSchema = z.object({
  email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
  password: z.string().min(1, t('validation.passwordRequired')),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, t('validation.oldPasswordRequired')),
  new_password: z.string().min(6, t('validation.passwordMin6')),
});
