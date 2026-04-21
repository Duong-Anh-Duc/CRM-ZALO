import { z } from 'zod';
import { t } from '../../locales';

// kebab-case: lowercase letters, digits, optional hyphen separators (no leading/trailing hyphen)
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createRoleSchema = z.object({
  slug: z
    .string()
    .min(1, t('validation.roleSlugRequired'))
    .max(50)
    .regex(slugRegex, t('validation.roleSlugFormat')),
  name: z.string().min(1, t('validation.roleNameRequired')).max(100),
  description: z.string().max(500).optional(),
  permission_ids: z.array(z.string().min(1)).optional(),
});

export const updateRoleSchema = z
  .object({
    name: z.string().min(1, t('validation.roleNameRequired')).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: t('validation.noFieldsToUpdate'),
  });

export const updateRolePermissionsSchema = z.object({
  permission_ids: z.array(z.string().min(1)),
});
