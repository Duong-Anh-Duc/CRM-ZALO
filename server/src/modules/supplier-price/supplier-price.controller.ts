import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { SupplierPriceService } from './supplier-price.service';
import { sendCreated, sendSuccess, sendMessage } from '../../utils/response';
import { t } from '../../locales';

export class SupplierPriceController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await SupplierPriceService.create(req.body);
      sendCreated(res, item);
    } catch (err) { next(err); }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await SupplierPriceService.update(req.params.id as string, req.body);
      sendSuccess(res, item);
    } catch (err) { next(err); }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await SupplierPriceService.delete(req.params.id as string);
      sendMessage(res, t('common.deleted'));
    } catch (err) { next(err); }
  }
}
