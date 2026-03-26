import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ReportService } from './report.service';
import { sendSuccess } from '../../utils/response';

export class ReportController {
  static async getPnl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query;
      const report = await ReportService.getPnlReport(from_date as string, to_date as string);
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }

  static async getDebtAging(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const report = await ReportService.getDebtAgingReport();
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }

  static async getProductSales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query;
      const report = await ReportService.getProductSalesReport(from_date as string, to_date as string);
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
}
