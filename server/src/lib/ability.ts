import { AbilityBuilder, PureAbility } from '@casl/ability';
import prisma from './prisma';

/**
 * Application-wide CASL ability. Actions and subjects are plain strings
 * (seeded from the Permission table), so we use PureAbility with a
 * [action, subject] tuple.
 */
export type AppAbility = PureAbility<[string, string]>;

interface UserWithRolePerms {
  id: string;
  is_active: boolean;
  role: {
    id: string;
    slug: string;
    permissions: Array<{
      permission: { action: string; subject: string; key: string };
    }>;
  } | null;
}

async function loadUserWithPerms(userId: string): Promise<UserWithRolePerms | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });
  return user as UserWithRolePerms | null;
}

/**
 * Build a CASL ability object from the user's current role & permissions.
 * A deactivated user or a user without a role ends up with an empty ability
 * (everything denied).
 */
export async function buildAbilityFor(userId: string): Promise<AppAbility> {
  const user = await loadUserWithPerms(userId);

  const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);

  if (!user || !user.is_active || !user.role) {
    return build();
  }

  for (const rp of user.role.permissions) {
    can(rp.permission.action, rp.permission.subject);
  }

  return build();
}

/**
 * Return the user-facing permission keys (e.g. "customer.view") assigned to
 * the user. Used to expose the permission list to the frontend on login /
 * profile.
 */
export async function fetchUserPermissionKeys(userId: string): Promise<string[]> {
  const user = await loadUserWithPerms(userId);
  if (!user || !user.role) return [];
  return user.role.permissions.map((rp) => rp.permission.key);
}
