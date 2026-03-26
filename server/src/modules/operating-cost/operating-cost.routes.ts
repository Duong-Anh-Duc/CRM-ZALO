import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createCostSchema, updateCostSchema, createCategorySchema } from './operating-cost.validation';
import { OperatingCostController } from './operating-cost.controller';

const router = Router();
router.use(authenticate);

router.get('/', OperatingCostController.list);
router.get('/monthly-summary', OperatingCostController.getMonthlySummary);
router.get('/categories', OperatingCostController.listCategories);
router.post('/categories', requireRole('ADMIN'), validate(createCategorySchema), OperatingCostController.createCategory);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createCostSchema), OperatingCostController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateCostSchema), OperatingCostController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), OperatingCostController.delete);

export default router;
