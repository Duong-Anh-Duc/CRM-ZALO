import { z } from 'zod';
import i18n from '@/locales';

export const loginSchema = z.object({
  email: z.string({ message: i18n.t('validation.emailRequired') }).min(1, { message: i18n.t('validation.emailRequired') }).email({ message: i18n.t('validation.emailInvalid') }),
  password: z.string().min(6, { message: i18n.t('validation.passwordMin6') }),
});

export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1, { message: i18n.t('validation.oldPasswordRequired') }),
    new_password: z.string().min(6, { message: i18n.t('validation.newPasswordMin6') }),
    confirm_password: z.string().min(1, { message: i18n.t('validation.confirmPasswordRequired') }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: i18n.t('validation.passwordMismatch'),
    path: ['confirm_password'],
  });

export const createUserSchema = z.object({
  email: z.string().email({ message: i18n.t('validation.emailInvalid') }),
  password: z.string().min(6, { message: i18n.t('validation.passwordMin6') }),
  full_name: z.string().min(1, { message: i18n.t('validation.fullNameRequired') }),
  role: z.enum(['ADMIN', 'STAFF', 'VIEWER'], {
    message: i18n.t('validation.roleRequired'),
  }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;
