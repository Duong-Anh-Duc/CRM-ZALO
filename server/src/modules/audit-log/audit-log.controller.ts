import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { AuditLogService } from './audit-log.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class AuditLogController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.list(req.query as never);
      sendPaginated(res, result.logs, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.getById(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async distinctModels(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.distinctModels();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async distinctUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.distinctUsers();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
