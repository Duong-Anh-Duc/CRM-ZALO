import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { SalesOrderService } from './sales-order.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class SalesOrderController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesOrderService.list(req.query as never);
      sendPaginated(res, result.orders, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await SalesOrderService.getById(req.params.id as string);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await SalesOrderService.create(req.body);
      sendCreated(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await SalesOrderService.update(req.params.id as string, req.body);
      sendSuccess(res, order);
    } catch (err) { next(err); }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await SalesOrderService.updateStatus(req.params.id as string, req.body.status);
      sendSuccess(res, order);
    } catch (err) {
      next(err);
    }
  }

  static async addItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await SalesOrderService.addItem(req.params.id as string, req.body);
      sendCreated(res, item);
    } catch (err) { next(err); }
  }

  static async removeItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SalesOrderService.removeItem(req.params.id as string, req.params.itemId as string);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await SalesOrderService.updateItem(req.params.id as string, req.params.itemId as string, req.body);
      sendSuccess(res, item);
    } catch (err) { next(err); }
  }
}
