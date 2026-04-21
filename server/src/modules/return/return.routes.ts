import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSalesReturnSchema, createPurchaseReturnSchema, updateReturnStatusSchema } from './return.validation';
import { ReturnController } from './return.controller';

const router = Router();
router.use(authenticate);

// Sales Returns
router.get('/sales', requireAbility('read', 'Return'), ReturnController.listSalesReturns);
router.get('/sales/:id', validateIdParam, requireAbility('read', 'Return'), ReturnController.getSalesReturn);
router.post('/sales', requireAbility('create', 'Return'), validate(createSalesReturnSchema), ReturnController.createSalesReturn);
router.patch('/sales/:id/status', validateIdParam, requireAbility('update', 'Return'), validate(updateReturnStatusSchema), ReturnController.updateSalesReturnStatus);
router.delete('/sales/:id', validateIdParam, requireAbility('delete', 'Return'), ReturnController.deleteSalesReturn);

// Purchase Returns
router.get('/purchase', requireAbility('read', 'Return'), ReturnController.listPurchaseReturns);
router.get('/purchase/:id', validateIdParam, requireAbility('read', 'Return'), ReturnController.getPurchaseReturn);
router.post('/purchase', requireAbility('create', 'Return'), validate(createPurchaseReturnSchema), ReturnController.createPurchaseReturn);
router.patch('/purchase/:id/status', validateIdParam, requireAbility('update', 'Return'), validate(updateReturnStatusSchema), ReturnController.updatePurchaseReturnStatus);
router.delete('/purchase/:id', validateIdParam, requireAbility('delete', 'Return'), ReturnController.deletePurchaseReturn);

export default router;
