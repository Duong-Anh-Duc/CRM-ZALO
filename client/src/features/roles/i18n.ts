import type { TFunction } from 'i18next';

export function translateRoleName(
  t: TFunction,
  role: { slug: string; name: string },
): string {
  const key = `role.roleNames.${role.slug}`;
  const translated = t(key);
  return translated !== key ? translated : role.name;
}

export function translateRoleDescription(
  t: TFunction,
  role: { slug: string; description?: string | null },
): string | null {
  const key = `role.roleDescriptions.${role.slug}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return role.description ?? null;
}
