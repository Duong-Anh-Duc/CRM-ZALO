import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { AuthService } from './auth.service';
import { t } from '../../locales';
import { sendSuccess, sendMessage } from '../../utils/response';

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.cookie('token', result.token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getProfile(req.user!.userId);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { old_password, new_password } = req.body;
      await AuthService.changePassword(req.user!.userId, old_password, new_password);
      sendMessage(res, t('auth.passwordChanged'));
    } catch (err) {
      next(err);
    }
  }

  static async logout(_req: AuthenticatedRequest, res: Response) {
    res.clearCookie('token');
    sendMessage(res, t('auth.logoutSuccess'));
  }
}
