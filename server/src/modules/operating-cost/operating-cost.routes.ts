import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createCostSchema, updateCostSchema, createCategorySchema } from './operating-cost.validation';
import { OperatingCostController } from './operating-cost.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'OperatingCost'), OperatingCostController.list);
router.get('/monthly-summary', requireAbility('read', 'OperatingCost'), OperatingCostController.getMonthlySummary);
router.get('/categories', requireAbility('read', 'OperatingCost'), OperatingCostController.listCategories);
router.post('/categories', requireAbility('manage', 'OperatingCostCategory'), validate(createCategorySchema), OperatingCostController.createCategory);
router.post('/', requireAbility('create', 'OperatingCost'), validate(createCostSchema), OperatingCostController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'OperatingCost'), validate(updateCostSchema), OperatingCostController.update);
router.delete('/:id', validateIdParam, requireAbility('delete', 'OperatingCost'), OperatingCostController.delete);

export default router;
