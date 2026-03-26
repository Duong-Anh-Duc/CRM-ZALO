import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema } from './supplier.validation';
import { SupplierController } from './supplier.controller';

const router = Router();

router.use(authenticate);
router.get('/', SupplierController.list);
router.get('/:id', validateIdParam, SupplierController.getById);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(createSupplierSchema), SupplierController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateSupplierSchema), SupplierController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), SupplierController.softDelete);

export default router;
