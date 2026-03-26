import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { AlertService } from './alert.service';
import { t } from '../../locales';
import { sendSuccess, sendPaginated, sendMessage } from '../../utils/response';

export class AlertController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AlertService.list(req.query as never);
      sendPaginated(res, result.alerts, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await AlertService.getUnreadCount();
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await AlertService.markAsRead(req.params.id as string);
      sendMessage(res, t('alert.markedRead'));
    } catch (err) {
      next(err);
    }
  }

  static async takeAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { action, new_expected_date } = req.body;
      const alert = await AlertService.takeAction(req.params.id as string, action, new_expected_date);
      sendSuccess(res, alert);
    } catch (err) {
      next(err);
    }
  }
}
