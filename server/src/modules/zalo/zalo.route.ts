import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { ZaloController } from './zalo.controller';

const router = Router();

router.post('/webhook', ZaloController.webhook);

router.use(authenticate);
router.get('/config', requireAbility('manage', 'ZaloConfig'), ZaloController.getConfig);
router.post('/config', requireAbility('manage', 'ZaloConfig'), ZaloController.saveConfig);
router.get('/messages', requireAbility('read', 'Zalo'), ZaloController.getMessages);
router.get('/stats', requireAbility('read', 'Zalo'), ZaloController.getStats);
router.get('/threads', requireAbility('read', 'Zalo'), ZaloController.getThreads);
router.get('/thread-messages', requireAbility('read', 'Zalo'), ZaloController.getThreadMessages);
router.get('/group-info', requireAbility('read', 'Zalo'), ZaloController.getGroupInfo);
router.get('/user-info', requireAbility('read', 'Zalo'), ZaloController.getUserInfo);
router.get('/user-info-extra', requireAbility('read', 'Zalo'), ZaloController.getUserInfoExtra);
router.post('/sync-messages', requireAbility('manage', 'ZaloMessage'), ZaloController.syncMessages);
router.get('/order-suggestions', requireAbility('read', 'Zalo'), ZaloController.listOrderSuggestions);
router.get('/order-suggestions/count', requireAbility('read', 'Zalo'), ZaloController.getOrderSuggestionCount);
router.post('/order-suggestions/:id/approve', requireAbility('create', 'SalesOrder'), ZaloController.approveOrderSuggestion);
router.post('/order-suggestions/:id/reject', requireAbility('read', 'Zalo'), ZaloController.rejectOrderSuggestion);
router.post('/ai-chat', requireAbility('use', 'AiChat'), ZaloController.aiChat);
router.get('/ai-chat/history', requireAbility('use', 'AiChat'), ZaloController.getChatHistory);
router.delete('/ai-chat/history', requireAbility('use', 'AiChat'), ZaloController.clearChatHistory);
router.get('/ai-summary', requireAbility('use', 'AiChat'), ZaloController.aiSummary);
router.get('/ai-training/categories', requireAbility('manage', 'AiTraining'), ZaloController.getTrainingCategories);
router.get('/ai-training', requireAbility('manage', 'AiTraining'), ZaloController.listTraining);
router.post('/ai-training', requireAbility('manage', 'AiTraining'), ZaloController.createTraining);
router.patch('/ai-training/:id', requireAbility('manage', 'AiTraining'), ZaloController.updateTraining);
router.delete('/ai-training/:id', requireAbility('manage', 'AiTraining'), ZaloController.removeTraining);

// Per-thread auto-reply settings
router.get('/threads/:thread_key/settings', requireAbility('read', 'Zalo'), ZaloController.getThreadSetting);
router.put('/threads/:thread_key/auto-reply', requireAbility('manage', 'ZaloConfig'), ZaloController.toggleAutoReply);

export default router;
