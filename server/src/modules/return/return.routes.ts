import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSalesReturnSchema, createPurchaseReturnSchema, updateReturnStatusSchema } from './return.validation';
import { ReturnController } from './return.controller';

const router = Router();
router.use(authenticate);

// Sales Returns
router.get('/sales', ReturnController.listSalesReturns);
router.get('/sales/:id', validateIdParam, ReturnController.getSalesReturn);
router.post('/sales', requireRole('ADMIN', 'STAFF'), validate(createSalesReturnSchema), ReturnController.createSalesReturn);
router.patch('/sales/:id/status', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateReturnStatusSchema), ReturnController.updateSalesReturnStatus);
router.delete('/sales/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), ReturnController.deleteSalesReturn);

// Purchase Returns
router.get('/purchase', ReturnController.listPurchaseReturns);
router.get('/purchase/:id', validateIdParam, ReturnController.getPurchaseReturn);
router.post('/purchase', requireRole('ADMIN', 'STAFF'), validate(createPurchaseReturnSchema), ReturnController.createPurchaseReturn);
router.patch('/purchase/:id/status', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateReturnStatusSchema), ReturnController.updatePurchaseReturnStatus);
router.delete('/purchase/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), ReturnController.deletePurchaseReturn);

export default router;
