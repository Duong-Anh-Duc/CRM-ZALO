import { Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import { AuthenticatedRequest } from '../../types';
import { SupplierService } from './supplier.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage, buildContentDisposition } from '../../utils/response';

export class SupplierController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SupplierService.list(req.query as never);
      sendPaginated(res, result.suppliers, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.getById(req.params.id as string);
      sendSuccess(res, supplier);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.create(req.body);
      sendCreated(res, supplier);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.update(req.params.id as string, req.body);
      sendSuccess(res, supplier);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await SupplierService.softDelete(req.params.id as string);
      sendMessage(res, t('supplier.deleted'));
    } catch (err) {
      next(err);
    }
  }

  static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query as { search?: string; city?: string; has_payable?: string };
      const has_payable = q.has_payable === 'true' || q.has_payable === '1';
      const buf = await SupplierService.exportExcel({
        search: q.search,
        city: q.city,
        has_payable,
      });
      const filename = `danh-sach-ncc-${dayjs().format('YYYYMMDD')}.xlsx`;
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
}
