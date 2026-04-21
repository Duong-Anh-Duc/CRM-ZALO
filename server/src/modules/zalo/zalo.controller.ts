import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ZaloService } from './zalo.service';
import { ZaloOrderService } from './zalo-order.service';
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
      const data = await ZaloService.getThreads(Number(req.query.limit) || undefined, req.query.type as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getThreadMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.set('Cache-Control', 'no-store');
      const data = await ZaloService.getMessagesByContact(req.query.contact_pid as string, Number(req.query.limit) || undefined);
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

  // ──── Order Suggestions ────

  static async listOrderSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloOrderService.list(req.query.status as string)); } catch (err) { next(err); }
  }

  static async getOrderSuggestionCount(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, { count: await ZaloOrderService.getPendingCount() }); } catch (err) { next(err); }
  }

  static async approveOrderSuggestion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloOrderService.approve(req.params.id as string)); } catch (err) { next(err); }
  }

  static async rejectOrderSuggestion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await ZaloOrderService.reject(req.params.id as string, req.body.reason)); } catch (err) { next(err); }
  }

  static async aiChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { question, limit } = req.body;
      const userId = req.user?.userId;
      if (!question) return res.status(400).json({ success: false, message: t('validation.questionRequired') });
      sendSuccess(res, await ZaloService.aiChat(question, limit || 100, userId));
    } catch (err) { next(err); }
  }

  static async getChatHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const limit = Number(req.query.limit) || 200;
      sendSuccess(res, await ZaloService.getChatHistory(userId!, limit));
    } catch (err) { next(err); }
  }

  static async clearChatHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      sendSuccess(res, await ZaloService.clearChatHistory(userId!));
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
    sendSuccess(res, await AiTrainingService.getCategories());
  }

  static async listTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.list(req.query.category as string)); } catch (err) { next(err); }
  }

  static async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { category, title, content } = req.body;
      if (!category || !title || !content) return res.status(400).json({ success: false, message: t('validation.trainingFieldsRequired') });
      sendSuccess(res, await AiTrainingService.create({ ...req.body, created_by: req.user?.userId }));
    } catch (err) { next(err); }
  }

  static async updateTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.update(req.params.id as string, req.body)); } catch (err) { next(err); }
  }

  static async removeTraining(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await AiTrainingService.remove(req.params.id as string)); } catch (err) { next(err); }
  }

  // ──── Per-thread auto-reply settings ────

  static async getThreadSetting(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await ZaloService.getThreadSetting(req.params.thread_key as string));
    } catch (err) { next(err); }
  }

  static async toggleAutoReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { enabled } = req.body;
      sendSuccess(res, await ZaloService.toggleThreadAutoReply(req.params.thread_key as string, !!enabled));
    } catch (err) { next(err); }
  }
}
