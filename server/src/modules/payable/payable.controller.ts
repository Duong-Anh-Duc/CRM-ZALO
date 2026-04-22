import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { PayableService } from './payable.service';
import { PayableLedgerService } from './payable-ledger.service';
import { sendSuccess, sendCreated, sendPaginated, buildContentDisposition } from '../../utils/response';

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
      sendPaginated(res, result.suppliers, { total: result.total, page: result.page, limit: result.limit }, { summary: result.summary });
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

  static async getSupplierLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const result = await PayableLedgerService.getSupplierLedger(req.params.supplierId as string, from_date, to_date, lang);
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
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const pdf = await PayableService.exportSupplierPdf(req.params.supplierId as string, from_date, to_date, lang);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDisposition('inline', `payable-${req.params.supplierId}.pdf`),
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
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const buf = await PayableService.exportSupplierExcel(req.params.supplierId as string, from_date, to_date, lang);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition('attachment', `chi-tiet-cong-no-ncc-${req.params.supplierId}.xlsx`),
        'Content-Length': buf.length.toString(),
      });
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }
}
