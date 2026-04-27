import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { PurchaseOrderService } from './purchase-order.service';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../../utils/response';
import { t } from '../../locales';

export class PurchaseOrderController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseOrderService.list(req.query as never);
      sendPaginated(res, result.orders, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await PurchaseOrderService.getById(req.params.id as string);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await PurchaseOrderService.create(req.body);
      sendCreated(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await PurchaseOrderService.update(req.params.id as string, req.body);
      sendSuccess(res, order);
    } catch (err) { next(err); }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await PurchaseOrderService.updateStatus(req.params.id as string, req.body.status);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await PurchaseOrderService.delete(req.params.id as string);
      sendMessage(res, t('common.deleted'));
    } catch (err) { next(err); }
  }
}
