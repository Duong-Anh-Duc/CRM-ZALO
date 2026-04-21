import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';

interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role_slug: string;
}

interface UpdateUserInput {
  full_name?: string;
  role_slug?: string;
  is_active?: boolean;
}

async function resolveRoleIdBySlug(slug: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { slug } });
  if (!role) throw new AppError(t('validation.roleRequired'), 400);
  return role.id;
}

export class UserService {
  static async list(page = 1, limit = 20, search?: string) {
    const where = {
      ...(search && {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          full_name: true,
          is_active: true,
          created_at: true,
          role: { select: { id: true, slug: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async create(input: CreateUserInput) {
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError(t('user.emailExists'), 400);

    const role_id = await resolveRoleIdBySlug(input.role_slug);
    const password_hash = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: {
        email: input.email,
        password_hash,
        full_name: input.full_name,
        role_id,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        role: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  static async update(id: string, data: UpdateUserInput, actorId?: string) {
    const { role_slug, ...rest } = data;
    const updateData: {
      full_name?: string;
      is_active?: boolean;
      role_id?: string;
    } = { ...rest };

    // Self-protection: user editing themselves cannot disable or change their own role
    if (actorId && actorId === id) {
      if (data.is_active === false) throw new AppError(t('user.cannotDeactivateSelf'), 400);
      if (role_slug) {
        const current = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (current && current.role.slug !== role_slug) {
          throw new AppError(t('user.cannotChangeOwnRole'), 400);
        }
      }
    }

    if (role_slug) {
      updateData.role_id = await resolveRoleIdBySlug(role_slug);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        role: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  static async deactivate(id: string, actorId?: string) {
    if (actorId && actorId === id) {
      throw new AppError(t('user.cannotDeactivateSelf'), 400);
    }
    return prisma.user.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
