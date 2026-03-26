import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createCustomerSchema, updateCustomerSchema, checkDebtLimitSchema } from './customer.validation';
import { CustomerController } from './customer.controller';

const router = Router();

router.use(authenticate);
router.get('/', CustomerController.list);
router.get('/:id', validateIdParam, CustomerController.getById);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createCustomerSchema), CustomerController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateCustomerSchema), CustomerController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), CustomerController.softDelete);
router.post('/check-debt-limit', requireRole('ADMIN', 'STAFF'), validate(checkDebtLimitSchema), CustomerController.checkDebtLimit);

export default router;
