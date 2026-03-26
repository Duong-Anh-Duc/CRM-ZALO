import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createPurchaseOrderSchema, updateStatusSchema } from './purchase-order.validation';
import { PurchaseOrderController } from './purchase-order.controller';

const router = Router();
router.use(authenticate);

router.get('/', PurchaseOrderController.list);
router.get('/:id', validateIdParam, PurchaseOrderController.getById);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createPurchaseOrderSchema), PurchaseOrderController.create);
router.patch('/:id/status', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateStatusSchema), PurchaseOrderController.updateStatus);

export default router;
