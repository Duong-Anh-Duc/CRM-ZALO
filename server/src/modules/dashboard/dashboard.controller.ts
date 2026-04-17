import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { DashboardService } from './dashboard.service';
import { sendSuccess } from '../../utils/response';

export class DashboardController {
  static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const data = await DashboardService.getOverview({ from_date, to_date });
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }
}
