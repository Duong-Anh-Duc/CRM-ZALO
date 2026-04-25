import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createCustomerSchema, updateCustomerSchema, checkDebtLimitSchema } from './customer.validation';
import { CustomerController } from './customer.controller';

const router = Router();

router.use(authenticate);
router.get('/', requireAbility('read', 'Customer'), CustomerController.list);
router.get('/export-excel', requireAbility('read', 'Customer'), CustomerController.exportExcel);
router.get('/:id', validateIdParam, requireAbility('read', 'Customer'), CustomerController.getById);
router.post('/', requireAbility('create', 'Customer'), validate(createCustomerSchema), CustomerController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'Customer'), validate(updateCustomerSchema), CustomerController.update);
router.patch('/:id/approve', validateIdParam, requireAbility('approve', 'Customer'), CustomerController.approve);
router.delete('/:id', validateIdParam, requireAbility('delete', 'Customer'), CustomerController.softDelete);
router.post('/check-debt-limit', requireAbility('update', 'Customer'), validate(checkDebtLimitSchema), CustomerController.checkDebtLimit);

export default router;
