import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
} from './role.types';

const ADMIN_SLUG = 'admin';

function mapRoleWithPermissions<
  T extends {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    is_system: boolean;
    created_at: Date;
    updated_at: Date;
    permissions: Array<{
      permission: {
        id: string;
        key: string;
        action: string;
        subject: string;
        module: string;
        description: string | null;
      };
    }>;
    _count?: { users: number };
  },
>(role: T) {
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    is_system: role.is_system,
    created_at: role.created_at,
    updated_at: role.updated_at,
    user_count: role._count?.users ?? 0,
    permissions: role.permissions.map((rp) => rp.permission),
  };
}

export class RoleService {
  static async list() {
    const roles = await prisma.role.findMany({
      orderBy: [{ is_system: 'desc' }, { slug: 'asc' }],
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: { where: { is_active: true } } } },
      },
    });
    return roles.map(mapRoleWithPermissions);
  }

  static async getById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: { where: { is_active: true } } } },
      },
    });
    if (!role) throw new AppError(t('role.notFound'), 404);
    return mapRoleWithPermissions(role);
  }

  static async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { subject: 'asc' }, { action: 'asc' }],
    });
  }

  static async create(input: CreateRoleInput) {
    const existing = await prisma.role.findUnique({ where: { slug: input.slug } });
    if (existing) throw new AppError(t('role.slugExists'), 409);

    const permissionIds = input.permission_ids ?? [];
    if (permissionIds.length > 0) {
      await RoleService.assertPermissionsExist(permissionIds);
    }

    const role = await prisma.role.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        is_system: false,
        permissions: {
          create: permissionIds.map((pid) => ({ permission_id: pid })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: { where: { is_active: true } } } },
      },
    });

    return mapRoleWithPermissions(role);
  }

  static async update(id: string, input: UpdateRoleInput) {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new AppError(t('role.notFound'), 404);

    // Only metadata allowed. Slug + is_system mutation is blocked at the schema layer,
    // but we still explicitly strip here for defense-in-depth.
    const data: { name?: string; description?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    await prisma.role.update({ where: { id }, data });
    return RoleService.getById(id);
  }

  static async updatePermissions(id: string, input: UpdateRolePermissionsInput) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new AppError(t('role.notFound'), 404);

    // Safety: admin role must always retain every permission to prevent lockout.
    if (role.slug === ADMIN_SLUG) {
      throw new AppError(t('role.cannotModifyAdmin'), 400);
    }

    const permissionIds = Array.from(new Set(input.permission_ids));
    if (permissionIds.length > 0) {
      await RoleService.assertPermissionsExist(permissionIds);
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role_id: id } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pid) => ({ role_id: id, permission_id: pid })),
          skipDuplicates: true,
        });
      }
    });

    return RoleService.getById(id);
  }

  static async delete(id: string, actorId?: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new AppError(t('role.notFound'), 404);

    if (role.is_system) throw new AppError(t('role.cannotDeleteSystem'), 400);

    if (actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { role_id: true },
      });
      if (actor?.role_id === id) {
        throw new AppError(t('role.cannotDeleteOwnRole'), 400);
      }
    }

    if (role._count.users > 0) {
      throw new AppError(t('role.inUseByUsers'), 400);
    }

    // RolePermission cascade-deletes via schema onDelete rule.
    await prisma.role.delete({ where: { id } });
  }

  private static async assertPermissionsExist(ids: string[]) {
    const unique = Array.from(new Set(ids));
    const found = await prisma.permission.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new AppError(t('role.invalidPermissionIds'), 400);
    }
  }
}
