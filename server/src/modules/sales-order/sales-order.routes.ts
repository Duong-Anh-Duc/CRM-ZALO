import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSalesOrderSchema, updateStatusSchema } from './sales-order.validation';
import { SalesOrderController } from './sales-order.controller';

const router = Router();
router.use(authenticate);

router.get('/', SalesOrderController.list);
router.get('/:id', validateIdParam, SalesOrderController.getById);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createSalesOrderSchema), SalesOrderController.create);
router.patch('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), SalesOrderController.update);
router.patch('/:id/status', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateStatusSchema), SalesOrderController.updateStatus);
router.post('/:id/items', validateIdParam, requireRole('ADMIN', 'STAFF'), SalesOrderController.addItem);
router.patch('/:id/items/:itemId', validateIdParam, requireRole('ADMIN', 'STAFF'), SalesOrderController.updateItem);
router.delete('/:id/items/:itemId', validateIdParam, requireRole('ADMIN', 'STAFF'), SalesOrderController.removeItem);

export default router;
