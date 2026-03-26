import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ReceivableService } from './receivable.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class ReceivableController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReceivableService.list(req.query as never);
      sendPaginated(res, result.receivables, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await ReceivableService.getSummary();
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  }

  static async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await ReceivableService.recordPayment(req.body);
      sendCreated(res, payment);
    } catch (err) {
      next(err);
    }
  }
}
