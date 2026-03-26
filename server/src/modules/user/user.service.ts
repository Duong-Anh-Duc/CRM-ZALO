import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { UserRole } from '@prisma/client';
import { t } from '../../locales';

interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
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
        select: { id: true, email: true, full_name: true, role: true, is_active: true, created_at: true },
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

    const password_hash = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: { email: input.email, password_hash, full_name: input.full_name, role: input.role },
      select: { id: true, email: true, full_name: true, role: true, is_active: true },
    });
  }

  static async update(id: string, data: { full_name?: string; role?: UserRole; is_active?: boolean }) {
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, full_name: true, role: true, is_active: true },
    });
  }

  static async deactivate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
