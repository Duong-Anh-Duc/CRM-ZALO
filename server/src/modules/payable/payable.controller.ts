import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { PayableService } from './payable.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class PayableController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayableService.list(req.query as never);
      sendPaginated(res, result.payables, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async listBySupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayableService.listBySupplier(req.query as never);
      sendPaginated(res, result.suppliers, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayableService.getSupplierDetail(req.params.supplierId as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await PayableService.getSummary();
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  }

  static async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await PayableService.recordPayment(req.body);
      sendCreated(res, payment);
    } catch (err) {
      next(err);
    }
  }

  static async exportSupplierPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pdf = await PayableService.exportSupplierPdf(req.params.supplierId as string);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payable-${req.params.supplierId}.pdf"`,
        'Content-Length': pdf.length.toString(),
      });
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  }

  static async updatePaymentEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayableService.updatePaymentEvidence(req.params.paymentId as string, req.body.evidence_url);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async exportSupplierExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const buf = await PayableService.exportSupplierExcel(req.params.supplierId as string);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="payable-${req.params.supplierId}.xlsx"`,
        'Content-Length': buf.length.toString(),
      });
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }
}
