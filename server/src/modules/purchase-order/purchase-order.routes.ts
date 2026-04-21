import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createPurchaseOrderSchema, updateStatusSchema } from './purchase-order.validation';
import { PurchaseOrderController } from './purchase-order.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'PurchaseOrder'), PurchaseOrderController.list);
router.get('/:id', validateIdParam, requireAbility('read', 'PurchaseOrder'), PurchaseOrderController.getById);
router.post('/', requireAbility('create', 'PurchaseOrder'), validate(createPurchaseOrderSchema), PurchaseOrderController.create);
router.patch('/:id', validateIdParam, requireAbility('update', 'PurchaseOrder'), PurchaseOrderController.update);
router.patch('/:id/status', validateIdParam, requireAbility('manage_status', 'PurchaseOrder'), validate(updateStatusSchema), PurchaseOrderController.updateStatus);

export default router;
