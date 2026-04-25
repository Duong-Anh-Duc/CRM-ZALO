import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { CustomerService } from './customer.service';
import { t } from '../../locales';
import dayjs from 'dayjs';
import { sendSuccess, sendCreated, sendPaginated, sendMessage, buildContentDisposition } from '../../utils/response';

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

  static async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CustomerService.approve(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async softDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await CustomerService.softDelete(req.params.id as string);
      sendMessage(res, t('customer.deleted'));
    } catch (err) {
      next(err);
    }
  }

  static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, customer_type, city, has_debt } = req.query as {
        search?: string;
        customer_type?: 'BUSINESS' | 'INDIVIDUAL';
        city?: string;
        has_debt?: string;
      };
      const buf = await CustomerService.exportExcel({
        search,
        customer_type,
        city,
        has_debt: has_debt === 'true' || has_debt === '1',
      });
      const filename = `danh-sach-khach-hang-${dayjs().format('YYYYMMDD')}.xlsx`;
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition('attachment', filename),
        'Content-Length': buf.length.toString(),
      });
      res.send(buf);
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
