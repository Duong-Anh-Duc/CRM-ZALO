import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ZaloService } from './zalo.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import logger from '../../utils/logger';

export class ZaloController {
  static async getConfig(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.getConfig()); } catch (err) { next(err); }
  }

  static async saveConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.saveConfig(req.body)); } catch (err) { next(err); }
  }

  static async webhook(req: Request, res: Response) {
    try {
      const result = await ZaloService.handleWebhook(req.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.error('Webhook error:', err);
      res.status(200).json({ success: false });
    }
  }

  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ZaloService.getMessages(req.query as any);
      sendPaginated(res, result.messages, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }

  static async getStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.getStats()); } catch (err) { next(err); }
  }

  // Func.vn API proxies (no cache - always fresh)
  static async getThreads(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.set('Cache-Control', 'no-store');
      const data = await ZaloService.getThreads(Number(req.query.limit) || 50, req.query.type as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getThreadMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.set('Cache-Control', 'no-store');
      const data = await ZaloService.getMessagesByContact(req.query.contact_pid as string, Number(req.query.limit) || 50);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getGroupInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.getGroupInfo(req.query.group_id as string)); } catch (err) { next(err); }
  }

  static async getUserInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.getUserInfo(req.query.user_id as string)); } catch (err) { next(err); }
  }

  static async getUserInfoExtra(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.getUserInfoExtra(req.query.user_id as string)); } catch (err) { next(err); }
  }
}
