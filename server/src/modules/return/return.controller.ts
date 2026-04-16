import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { SalesReturnService } from './sales-return.service';
import { PurchaseReturnService } from './purchase-return.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class ReturnController {
  // ── Sales Returns ──
  static async listSalesReturns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesReturnService.list(req.query as never);
      sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }

  static async getSalesReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesReturnService.getById(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async createSalesReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesReturnService.create(req.body);
      sendCreated(res, result);
    } catch (err) { next(err); }
  }

  static async updateSalesReturnStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesReturnService.updateStatus(req.params.id as string, req.body.status);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async deleteSalesReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await SalesReturnService.delete(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  }

  // ── Purchase Returns ──
  static async listPurchaseReturns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseReturnService.list(req.query as never);
      sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }

  static async getPurchaseReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseReturnService.getById(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async createPurchaseReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseReturnService.create(req.body);
      sendCreated(res, result);
    } catch (err) { next(err); }
  }

  static async deletePurchaseReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await PurchaseReturnService.delete(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  }

  static async updatePurchaseReturnStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseReturnService.updateStatus(req.params.id as string, req.body.status);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }
}
