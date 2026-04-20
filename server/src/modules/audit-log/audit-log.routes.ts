import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { AuditLogController } from './audit-log.controller';

const router = Router();
router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/', AuditLogController.list);
router.get('/models', AuditLogController.distinctModels);
router.get('/users', AuditLogController.distinctUsers);
router.get('/:id', AuditLogController.getById);

export default router;
