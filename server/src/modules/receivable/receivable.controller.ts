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

  static async listByCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReceivableService.listByCustomer(req.query as never);
      sendPaginated(res, result.customers, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReceivableService.getCustomerDetail(req.params.customerId as string);
      sendSuccess(res, result);
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

  static async exportCustomerPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pdf = await ReceivableService.exportCustomerPdf(req.params.customerId as string);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="receivable-${req.params.customerId}.pdf"`,
        'Content-Length': pdf.length.toString(),
      });
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  }
}
