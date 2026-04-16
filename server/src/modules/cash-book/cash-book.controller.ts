import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { CashBookService } from './cash-book.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class CashBookController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.list(req.query as never);
      sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.create(req.body);
      sendCreated(res, result);
    } catch (err) { next(err); }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.update(req.params.id as string, req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await CashBookService.delete(req.params.id as string);
      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  }

  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.getSummary(req.query as never);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async listCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.listCategories(req.query.type as string | undefined);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.createCategory(req.body);
      sendCreated(res, result);
    } catch (err) { next(err); }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CashBookService.updateCategory(req.params.id as string, req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }
}
