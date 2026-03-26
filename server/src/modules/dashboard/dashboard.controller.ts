import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { DashboardService } from './dashboard.service';
import { sendSuccess } from '../../utils/response';

export class DashboardController {
  static async getOverview(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getOverview();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }
}
