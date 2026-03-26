import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { OperatingCostService } from './operating-cost.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../../utils/response';

export class OperatingCostController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await OperatingCostService.list(req.query as never);
      sendPaginated(res, result.costs, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getMonthlySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const summary = await OperatingCostService.getMonthlySummary(year);
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const cost = await OperatingCostService.create(req.body);
      sendCreated(res, cost);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const cost = await OperatingCostService.update(req.params.id as string, req.body);
      sendSuccess(res, cost);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await OperatingCostService.delete(req.params.id as string);
      sendMessage(res, t('cost.deleted'));
    } catch (err) {
      next(err);
    }
  }

  static async listCategories(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await OperatingCostService.listCategories();
      sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const category = await OperatingCostService.createCategory(req.body.name);
      sendCreated(res, category);
    } catch (err) {
      next(err);
    }
  }
}
