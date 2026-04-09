import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ZaloService } from './zalo.service';
import { AiTrainingService } from '../ai/ai-training.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { t } from '../../locales';
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

  static async syncMessages(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloService.syncMessages()); } catch (err) { next(err); }
  }

  static async aiChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { question, limit } = req.body;
      if (!question) return res.status(400).json({ success: false, message: t('validation.questionRequired') });
      sendSuccess(res, await ZaloService.aiChat(question, limit || 100));
    } catch (err) { next(err); }
  }

  static async aiSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hours = Number(req.query.hours) || 24;
      const limit = Number(req.query.limit) || 100;
      sendSuccess(res, await ZaloService.aiSummary(hours, limit));
    } catch (err) { next(err); }
  }

  // AI Training CRUD
  static async getTrainingCategories(_req: AuthenticatedRequest, res: Response) {
    sendSuccess(res, AiTrainingService.getCategories());
  }

  static async listTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.list(req.query.category as string)); } catch (err) { next(err); }
  }

  static async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { category, title, content } = req.body;
      if (!category || !title || !content) return res.status(400).json({ success: false, message: t('validation.trainingFieldsRequired') });
      sendSuccess(res, await AiTrainingService.create({ ...req.body, created_by: (req.user as any)?.id }));
    } catch (err) { next(err); }
  }

  static async updateTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.update(req.params.id as string, req.body)); } catch (err) { next(err); }
  }

  static async removeTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.remove(req.params.id as string)); } catch (err) { next(err); }
  }
}
