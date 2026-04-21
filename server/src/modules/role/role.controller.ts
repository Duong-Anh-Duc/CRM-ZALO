import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { RoleService } from './role.service';
import { sendSuccess, sendCreated, sendMessage } from '../../utils/response';
import { t } from '../../locales';

export class RoleController {
  static async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.list();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async listPermissions(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.listPermissions();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.getById(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.create(req.body);
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.update(req.params.id as string, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async updatePermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.updatePermissions(req.params.id as string, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await RoleService.delete(req.params.id as string, req.user?.userId);
      sendMessage(res, t('role.deleted'));
    } catch (err) {
      next(err);
    }
  }
}
