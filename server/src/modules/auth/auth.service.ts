import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { config } from '../../config';
import { JwtPayload } from '../../types';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      throw new AppError(t('auth.loginFailed'), 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(t('auth.loginFailed'), 401);
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string | number,
    } as jwt.SignOptions);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });
    if (!user) throw new AppError(t('user.notFound'), 404);
    return user;
  }

  static async updateProfile(userId: string, data: { full_name: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(t('user.notFound'), 404);

    return prisma.user.update({
      where: { id: userId },
      data: { full_name: data.full_name },
      select: { id: true, email: true, full_name: true, role: true, is_active: true },
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
