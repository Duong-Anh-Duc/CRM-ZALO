import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ReceivableService } from './receivable.service';
import { ReceivableLedgerService } from './receivable-ledger.service';
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
      sendPaginated(res, result.customers, { total: result.total, page: result.page, limit: result.limit }, { summary: result.summary });
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

  static async getCustomerLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const result = await ReceivableLedgerService.getCustomerLedger(req.params.customerId as string, from_date, to_date, lang);
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
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const pdf = await ReceivableService.exportCustomerPdf(req.params.customerId as string, from_date, to_date, lang);
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

  static async updatePaymentEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReceivableService.updatePaymentEvidence(req.params.paymentId as string, req.body.evidence_url);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async exportCustomerExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from_date, to_date } = req.query as { from_date?: string; to_date?: string };
      const lang = (req.headers['accept-language'] as string || 'vi').split(',')[0].split('-')[0];
      const buf = await ReceivableService.exportCustomerExcel(req.params.customerId as string, from_date, to_date, lang);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="chi-tiet-cong-no-${req.params.customerId}.xlsx"`,
        'Content-Length': buf.length.toString(),
      });
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }
}
