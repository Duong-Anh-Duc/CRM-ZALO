import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { CustomerService } from './customer.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../../utils/response';

export class CustomerController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CustomerService.list(req.query as never);
      sendPaginated(res, result.customers, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer = await CustomerService.getById(req.params.id as string);
      sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer = await CustomerService.create(req.body);
      sendCreated(res, customer);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer = await CustomerService.update(req.params.id as string, req.body);
      sendSuccess(res, customer);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await CustomerService.softDelete(req.params.id as string);
      sendMessage(res, t('customer.deleted'));
    } catch (err) {
      next(err);
    }
  }

  static async checkDebtLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { customer_id, order_total } = req.body;
      const result = await CustomerService.checkDebtLimit(customer_id, Number(order_total));
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
