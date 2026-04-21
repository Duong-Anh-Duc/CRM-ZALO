import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSalesOrderSchema, updateStatusSchema } from './sales-order.validation';
import { SalesOrderController } from './sales-order.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'SalesOrder'), SalesOrderController.list);
router.get('/:id', validateIdParam, requireAbility('read', 'SalesOrder'), SalesOrderController.getById);
router.post('/', requireAbility('create', 'SalesOrder'), validate(createSalesOrderSchema), SalesOrderController.create);
router.patch('/:id', validateIdParam, requireAbility('update', 'SalesOrder'), SalesOrderController.update);
router.patch('/:id/status', validateIdParam, requireAbility('manage_status', 'SalesOrder'), validate(updateStatusSchema), SalesOrderController.updateStatus);
router.post('/:id/items', validateIdParam, requireAbility('manage_items', 'SalesOrder'), SalesOrderController.addItem);
router.patch('/:id/items/:itemId', validateIdParam, requireAbility('manage_items', 'SalesOrder'), SalesOrderController.updateItem);
router.delete('/:id/items/:itemId', validateIdParam, requireAbility('manage_items', 'SalesOrder'), SalesOrderController.removeItem);

export default router;
