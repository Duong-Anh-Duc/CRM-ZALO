import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { config } from '../../config';
import { JwtPayload } from '../../types';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { fetchUserPermissionKeys } from '../../lib/ability';

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user || !user.is_active) {
      throw new AppError(t('auth.loginFailed'), 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(t('auth.loginFailed'), 401);
    }

    const roleSlug = user.role?.slug ?? 'viewer';
    // @deprecated Legacy uppercase role label, included in JWT + `user` response for
    // backward-compat with frontend code that still reads `user.role` as a string.
    // Backend route guards have migrated to requireAbility(action, subject);
    // remove after FE migration (Phase 3 cleanup).
    const legacyRole =
      roleSlug === 'admin' ? 'ADMIN'
      : roleSlug === 'viewer' ? 'VIEWER'
      : 'STAFF';

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: legacyRole,
      roleSlug,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string | number,
    } as jwt.SignOptions);

    const permissions = await fetchUserPermissionKeys(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: legacyRole, // legacy field for existing FE checks
        role_slug: roleSlug,
        role_name: user.role?.name ?? null,
      },
      permissions,
    };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        created_at: true,
        role: {
          select: { id: true, slug: true, name: true, description: true },
        },
      },
    });
    if (!user) throw new AppError(t('user.notFound'), 404);

    const permissions = await fetchUserPermissionKeys(userId);

    const slug = user.role?.slug ?? null;
    const legacyRole =
      slug === 'admin' ? 'ADMIN'
      : slug === 'viewer' ? 'VIEWER'
      : slug ? 'STAFF'
      : null;

    return {
      ...user,
      // Legacy uppercase role field for FE code still reading `user.role` as a string.
      role: legacyRole,
      role_detail: user.role,
      role_slug: slug,
      permissions,
    };
  }

  static async updateProfile(userId: string, data: { full_name: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(t('user.notFound'), 404);

    return prisma.user.update({
      where: { id: userId },
      data: { full_name: data.full_name },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        role: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(t('user.notFound'), 404);

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) throw new AppError(t('auth.oldPasswordWrong'), 400);

    const password_hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password_hash } });
  }
}
