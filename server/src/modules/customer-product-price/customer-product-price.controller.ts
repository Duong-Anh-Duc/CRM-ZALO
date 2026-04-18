import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { CustomerProductPriceService } from './customer-product-price.service';
import { sendSuccess, sendMessage } from '../../utils/response';

export class CustomerProductPriceController {
  static async listByCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer_id = req.query.customer_id as string;
      if (!customer_id) { res.status(400).json({ success: false, message: 'customer_id required' }); return; }
      const data = await CustomerProductPriceService.listByCustomer(customer_id);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  }

  static async upsert(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await CustomerProductPriceService.upsert(req.body);
      sendSuccess(res, item);
    } catch (err) { next(err); }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await CustomerProductPriceService.delete(req.params.id as string);
      sendMessage(res, 'Đã xóa');
    } catch (err) { next(err); }
  }
}
