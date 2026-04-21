import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { AuditLogController } from './audit-log.controller';

const router = Router();
router.use(authenticate);
router.use(requireAbility('read', 'AuditLog'));

router.get('/', AuditLogController.list);
router.get('/models', AuditLogController.distinctModels);
router.get('/users', AuditLogController.distinctUsers);
router.get('/:id', AuditLogController.getById);

export default router;
