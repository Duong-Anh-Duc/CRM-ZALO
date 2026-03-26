import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { takeActionSchema } from './alert.validation';
import { AlertController } from './alert.controller';

const router = Router();
router.use(authenticate);

router.get('/', AlertController.list);
router.get('/unread-count', AlertController.getUnreadCount);
router.patch('/:id/read', validateIdParam, AlertController.markAsRead);
router.patch('/:id/action', validateIdParam, validate(takeActionSchema), AlertController.takeAction);

export default router;
