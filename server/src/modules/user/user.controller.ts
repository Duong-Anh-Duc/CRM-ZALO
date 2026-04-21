import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { UserService } from './user.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../../utils/response';

export class UserController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query;
      const result = await UserService.list(
        Number(page) || 1,
        Number(limit) || 20,
        search as string
      );
      sendPaginated(res, result.users, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await UserService.create(req.body);
      sendCreated(res, user);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await UserService.update(req.params.id as string, req.body, req.user?.userId);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await UserService.deactivate(req.params.id as string, req.user?.userId);
      sendMessage(res, t('user.deactivated'));
    } catch (err) {
      next(err);
    }
  }
}
