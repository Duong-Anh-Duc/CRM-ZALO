import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { ZaloController } from './zalo.controller';

const router = Router();

router.post('/webhook', ZaloController.webhook);

router.use(authenticate);
router.get('/config', requireRole('ADMIN'), ZaloController.getConfig);
router.post('/config', requireRole('ADMIN'), ZaloController.saveConfig);
router.get('/messages', ZaloController.getMessages);
router.get('/stats', ZaloController.getStats);
router.get('/threads', ZaloController.getThreads);
router.get('/thread-messages', ZaloController.getThreadMessages);
router.get('/group-info', ZaloController.getGroupInfo);
router.get('/user-info', ZaloController.getUserInfo);
router.get('/user-info-extra', ZaloController.getUserInfoExtra);
router.post('/sync-messages', requireRole('ADMIN'), ZaloController.syncMessages);
router.post('/ai-chat', ZaloController.aiChat);
router.get('/ai-summary', ZaloController.aiSummary);
router.get('/ai-training/categories', ZaloController.getTrainingCategories);
router.get('/ai-training', ZaloController.listTraining);
router.post('/ai-training', ZaloController.createTraining);
router.patch('/ai-training/:id', ZaloController.updateTraining);
router.delete('/ai-training/:id', ZaloController.removeTraining);

export default router;
